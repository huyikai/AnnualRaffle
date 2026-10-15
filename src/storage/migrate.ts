/**
 * schema 迁移
 *
 * v1 的存储形态：
 *   list[]                        { key: number, name, allowedPrizes? }   名单
 *   config[key].preset            逗号拼接字符串 "1,2,3"                 预设名单
 *   config[key].excludedPersons   逗号拼接字符串                          奖项级排除人员
 *   result[key]                  number[]                               中奖结果
 *   newLottery[]                  { key, name }                          全部奖项（内置+自定义）
 *
 * v2：
 *   roster[]                      Person[]（key 为 string，含 enabled）   名单
 *   config[key].preset            string[]                               预设名单
 *   config[key].excludedPersons   string[]                               奖项级排除人员
 *   result[key]                  string[]                               中奖结果
 *   prizes[]                      Prize[]（含 builtin 标记）              奖项
 *
 * 另有一处结构性变化：v1 的 excludedUsers 是构建期写死、从不落盘的独立数组，
 * v2 把它折叠为名册的 enabled 字段。首次迁移时若检测到旧名单，
 * 会用示例数据中的排除名单回填，避免「迁移后原本被排除的人突然可以中奖」。
 */

import { getData, setData, removeData } from '@/helper/index';
import { SEED_PEOPLE, SEED_EXCLUDED_KEYS } from '@/data/seed';
import { toPerson } from '@/data/person';
import { BUILTIN_PRIZE_KEYS } from '@/config/lottery';
import type { Person, LegacyUserItem } from '@/data/person';
import type { LotteryConfigType } from '@/config/lottery';
import type { Prize } from '@/data/prizes';

export const SCHEMA_VERSION = 2;

export const schemaVersionField = 'schemaVersion';
export const rosterField = 'roster';
export const legacyListField = 'list';
export const legacyNewLotteryField = 'newLottery';

/** 迁移结果 */
export interface MigrationReport {
  /** 是否真的执行了迁移 */
  migrated: boolean;
  fromVersion: number;
  /** 需要提示用户的告警 */
  warnings: string[];
  peopleCount: number;
}

/** 逗号分隔字符串 → 字符串数组；无有效内容返回 undefined */
function splitLegacyList(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const items = raw.map((item) => String(item).trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
  if (typeof raw === 'string') {
    if (!raw.trim()) return undefined;
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

/** 工号去重，保留首条 */
function dedupeRoster(people: Person[]): Person[] {
  const seen = new Set<string>();
  const result: Person[] = [];
  people.forEach((person) => {
    if (seen.has(person.key)) return;
    seen.add(person.key);
    result.push(person);
  });
  return result;
}

/** 执行 v1 → v2 迁移。已是 v2 时为空操作。 */
export function migrateSchema(): MigrationReport {
  const rawVersion = getData(schemaVersionField);
  const currentVersion = typeof rawVersion === 'number' ? rawVersion : 1;

  if (currentVersion >= SCHEMA_VERSION) {
    const existing = getData(rosterField);
    return {
      migrated: false,
      fromVersion: currentVersion,
      warnings: [],
      peopleCount: Array.isArray(existing) ? existing.length : 0,
    };
  }

  const warnings: string[] = [];

  // ---- 1. 名单：list → roster ----
  const legacyList = getData(legacyListField);
  let people: Person[];

  if (Array.isArray(legacyList) && legacyList.length > 0) {
    people = (legacyList as Array<LegacyUserItem | Person>).map(toPerson);

    if (
      (legacyList as Array<LegacyUserItem | Person>).some(
        (item) => typeof item.key === 'number',
      )
    ) {
      warnings.push(
        '旧版名单的工号为数字格式，已转换为字符串。若原始数据存在前导零（如 0012345），该前导零在导入时已丢失且无法还原。',
      );
    }

    // v1 的 excludedUsers 不在 localStorage 里，无法逐人回填 enabled。
    // 旧名单里若包含示例数据中被排除的人，按种子名单回填，其余一律视为参与。
    people = people.map((person) => ({
      ...person,
      enabled: SEED_EXCLUDED_KEYS.has(person.key)
        ? false
        : (person.enabled ?? true),
    }));

    warnings.push(
      '旧版「排除名单」是构建期写在代码里、从不保存的。已按示例名单回填参与状态，请在「人员管理」中确认排除人员是否正确。',
    );
  } else {
    // 首次启动：写入示例种子
    people = SEED_PEOPLE.map((p) => ({
      ...p,
      allowedPrizes: [...p.allowedPrizes],
    }));
    if (people.length > 0) {
      warnings.push(
        '未检测到历史名单，已载入示例数据。请在「人员管理」中导入正式名单。',
      );
    }
  }

  const deduped = dedupeRoster(people);
  if (deduped.length !== people.length) {
    warnings.push(
      `迁移时发现 ${people.length - deduped.length} 条重复工号，已保留首条记录。`,
    );
  }

  setData(rosterField, deduped);
  removeData(legacyListField);

  // ---- 2. config：逗号字符串 → 数组 ----
  migrateLegacyConfig(warnings);

  // ---- 3. result：number[] → string[] ----
  migrateLegacyResult();

  // ---- 4. newLottery → prizes ----
  migrateLegacyPrizes();

  setData(schemaVersionField, SCHEMA_VERSION);

  return {
    migrated: true,
    fromVersion: currentVersion,
    warnings,
    peopleCount: deduped.length,
  };
}

function migrateLegacyConfig(warnings: string[]): void {
  const legacyConfig = getData('config');
  if (
    !legacyConfig ||
    typeof legacyConfig !== 'object' ||
    Array.isArray(legacyConfig)
  ) {
    return;
  }

  const config = legacyConfig as Record<string, unknown>;
  let touched = false;

  Object.keys(config).forEach((prizeKey) => {
    const item = config[prizeKey];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const typed = item as Record<string, unknown>;

    if (typeof typed.preset === 'string' || Array.isArray(typed.preset)) {
      const next = splitLegacyList(typed.preset);
      if (next !== undefined) {
        typed.preset = next;
        touched = true;
      }
    }

    if (
      typeof typed.excludedPersons === 'string' ||
      Array.isArray(typed.excludedPersons)
    ) {
      const next = splitLegacyList(typed.excludedPersons);
      if (next !== undefined) {
        typed.excludedPersons = next;
        touched = true;
      }
    }
  });

  if (touched) {
    setData('config', config as LotteryConfigType);
    warnings.push('预设名单与奖项级排除人员已由逗号分隔字符串改为数组格式。');
  }
}

function migrateLegacyResult(): void {
  const legacyResult = getData('result');
  if (
    !legacyResult ||
    typeof legacyResult !== 'object' ||
    Array.isArray(legacyResult)
  ) {
    return;
  }

  const result = legacyResult as Record<string, unknown>;
  let touched = false;

  Object.keys(result).forEach((prizeKey) => {
    const value = result[prizeKey];
    if (Array.isArray(value)) {
      result[prizeKey] = value.map((item) => String(item));
      touched = true;
    }
  });

  if (touched) {
    setData('result', result as Record<string, string[]>);
  }
}

function migrateLegacyPrizes(): void {
  const legacy = getData(legacyNewLotteryField);
  if (!Array.isArray(legacy) || legacy.length === 0) {
    // 没有历史奖项数据时，loadPrizes 会自动回落到内置奖项
    return;
  }

  const prizes: Prize[] = (legacy as Array<{ key: string; name: string }>).map(
    (item) => ({
      key: item.key,
      name: item.name,
      builtin: BUILTIN_PRIZE_KEYS.has(item.key),
    }),
  );

  setData('prizes', prizes);
  removeData(legacyNewLotteryField);
}
