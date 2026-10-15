/**
 * 统一奖项配置模块
 * 集中管理所有奖项相关的配置、类型定义和工具函数
 */

import type { Person } from '@/data/person';

// 奖项定义接口
export interface LotteryItem {
  key: string;
  name: string;
  defaultCount: number;
}

// 奖项配置项接口（支持预设名单和排除设置）
export interface LotteryItemConfig {
  count: number;
  preset?: string[]; // 可选，参与该奖项的工号列表
  excludeMode?: 'global' | 'custom'; // 排除模式：跟随全局 / 自定义（默认 global）
  excludeWinners?: boolean; // 自定义模式下：是否排除已中奖人员
  excludedPersons?: string[]; // 自定义模式下：排除指定人员（工号列表）
}

// 奖项定义数组（单一数据源）
export const LOTTERY_ITEMS: LotteryItem[] = [
  { key: 'firstPrize', name: '一等奖', defaultCount: 1 },
  { key: 'secondPrize', name: '二等奖', defaultCount: 2 },
  { key: 'thirdPrize', name: '三等奖', defaultCount: 5 },
  { key: 'luckyFirst', name: '幸运奖第一轮', defaultCount: 10 },
  { key: 'luckySecond', name: '幸运奖第二轮', defaultCount: 10 },
];

/** 内置奖项 key 集合，用于区分内置与自定义奖项 */
export const BUILTIN_PRIZE_KEYS: Set<string> = new Set(
  LOTTERY_ITEMS.map((item) => item.key),
);

// 奖项配置类型定义
export type LotteryConfigType = Record<string, LotteryItemConfig>;

// 结果类型定义（从奖项定义自动生成，无需手动维护）
export type ResultType = Record<string, string[]>;

// 从奖项定义自动生成默认配置（新格式）
export const defaultConfig: LotteryConfigType = LOTTERY_ITEMS.reduce(
  (config, item) => {
    config[item.key] = { count: item.defaultCount };
    return config;
  },
  {} as LotteryConfigType,
);

// 奖项列表（用于向后兼容，从奖项定义生成）
export const lottery: Array<{ key: string; name: string }> = LOTTERY_ITEMS.map(
  (item) => ({
    key: item.key,
    name: item.name,
  }),
);

// 默认结果配置（从奖项定义生成）
export const defaultResult: ResultType = LOTTERY_ITEMS.reduce(
  (result, item) => {
    result[item.key] = [];
    return result;
  },
  {} as ResultType,
);

// 辅助函数：安全获取奖项数量
export function getLotteryCount(
  config: LotteryConfigType,
  key: string,
): number {
  const value = config[key];
  if (value && typeof value === 'object') {
    return value.count ?? 0;
  }
  return 0;
}

/**
 * 获取奖项的预设名单
 * @returns 工号数组；未启用预设时返回 undefined
 */
export function getLotteryPreset(
  config: LotteryConfigType,
  key: string,
): string[] | undefined {
  const value = config[key];
  if (value && typeof value === 'object' && Array.isArray(value.preset)) {
    return value.preset;
  }
  return undefined;
}

/**
 * 获取排除模式
 * @returns 'global' | 'custom'，缺省为 'global'
 */
export function getLotteryExcludeMode(
  config: LotteryConfigType,
  key: string,
): 'global' | 'custom' {
  const value = config[key];
  if (value && typeof value === 'object' && value.excludeMode) {
    return value.excludeMode;
  }
  return 'global';
}

/**
 * 获取自定义模式下是否排除已中奖
 * @returns 缺省为 true
 */
export function getLotteryExcludeWinners(
  config: LotteryConfigType,
  key: string,
): boolean {
  const value = config[key];
  if (
    value &&
    typeof value === 'object' &&
    value.excludeWinners !== undefined
  ) {
    return value.excludeWinners;
  }
  return true;
}

/**
 * 获取自定义模式下排除指定人员列表
 * @returns 工号数组，缺省为空数组
 */
export function getLotteryExcludedPersons(
  config: LotteryConfigType,
  key: string,
): string[] {
  const value = config[key];
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.excludedPersons)
  ) {
    return value.excludedPersons.filter(Boolean);
  }
  return [];
}

// 生效排除设置（奖项级自定义优先于全局）
export interface EffectiveExcludeSettings {
  excludeWinners: boolean;
  excludedPersons: string[];
}

/**
 * 检查人员是否可以参加指定奖项
 * @param person 人员对象
 * @param prizeKey 奖项 key
 * @returns 是否可以参加
 */
export function canUserParticipate(
  person: Person,
  prizeKey: string | undefined,
): boolean {
  // 如果没有指定奖项，允许参加
  if (!prizeKey) {
    return true;
  }
  // 如果没有限制，可以参加所有奖项
  if (!person.allowedPrizes || person.allowedPrizes.length === 0) {
    return true;
  }
  // 检查当前奖项是否在允许列表中
  return person.allowedPrizes.includes(prizeKey);
}

/**
 * 获取奖项的生效排除设置：奖项级自定义优先于全局开关
 * @param config 奖项配置
 * @param key 奖项 key
 * @param globalExcludeWinners 全局「排除已中奖人员」开关
 */
export function getEffectiveExcludeSettings(
  config: LotteryConfigType,
  key: string,
  globalExcludeWinners: boolean,
): EffectiveExcludeSettings {
  if (getLotteryExcludeMode(config, key) === 'custom') {
    return {
      excludeWinners: getLotteryExcludeWinners(config, key),
      excludedPersons: getLotteryExcludedPersons(config, key),
    };
  }
  return { excludeWinners: globalExcludeWinners, excludedPersons: [] };
}

// 预设名单禁选原因计算参数
export interface PresetDisabledReasonsOptions {
  config: LotteryConfigType;
  categoryKey: string;
  globalExcludeWinners: boolean;
  result: ResultType;
  excludedUsers: Array<{ key: string; name: string }>;
  list: Person[];
  /** 可选：需校验的预设名单 ID，用于识别已不在参与名单中的脏数据 */
  presetIds?: string[];
}

/**
 * 计算预设名单弹窗中各人员的禁选原因，规则与 annualRaffleHandler 的排除逻辑一一对应：
 * 1. 不在参与名单中的预设 ID（脏数据，任何设置下都无法中奖）
 * 2. 全局排除名单（excludedUsers，任何设置下都无法中奖）
 * 3. 已中过本奖项（防重复中奖，始终禁选）
 * 4. 已中其他奖项（仅当生效「排除已中奖」时禁选）
 * 5. 被设为该奖项「排除指定人员」（仅自定义排除模式下生效）
 * @returns 工号 → 禁选原因，无对应 key 表示可选
 */
export function getPresetDisabledReasons(
  options: PresetDisabledReasonsOptions,
): Record<string, string> {
  const {
    config,
    categoryKey,
    globalExcludeWinners,
    result,
    excludedUsers,
    list,
    presetIds = [],
  } = options;
  const reasons: Record<string, string> = {};
  const listKeys = new Set(list.map((person) => person.key));

  // 1. 预设中已不在参与名单里的 ID（脏数据）
  presetIds.forEach((id) => {
    if (!listKeys.has(id)) {
      reasons[id] = '不在参与名单中';
    }
  });

  // 2. 全局排除名单，任何设置下都无法中奖
  excludedUsers.forEach((user) => {
    if (reasons[user.key] === undefined) {
      reasons[user.key] = '已列入全局排除名单，无法中奖';
    }
  });

  // 3. 已中过本奖项，任何设置下都不能重复中该奖项
  (result[categoryKey] ?? []).forEach((key) => {
    if (reasons[key] === undefined) {
      reasons[key] = '已中过本奖项，不能重复中奖';
    }
  });

  // 4. 已中其他奖项：生效「排除已中奖」时禁选（含本奖项 key，但已被第 3 条以更具体原因占用）
  const { excludeWinners, excludedPersons } = getEffectiveExcludeSettings(
    config,
    categoryKey,
    globalExcludeWinners,
  );
  if (excludeWinners) {
    Object.values(result)
      .flat()
      .forEach((key) => {
        if (reasons[key] === undefined) {
          reasons[key] = '已中奖，按当前设置不再参与抽奖';
        }
      });
  }

  // 5. 该奖项的自定义排除人员
  excludedPersons.forEach((key) => {
    if (reasons[key] === undefined) {
      reasons[key] = '已被设置为该奖项的排除人员';
    }
  });

  return reasons;
}

// 预设名单失效项
export interface PresetIssue {
  key: string;
  reason: string;
}

// 预设名单检查参数
export interface PresetIssuesOptions {
  config: LotteryConfigType;
  categoryKey: string;
  globalExcludeWinners: boolean;
  result: ResultType;
  excludedUsers: Array<{ key: string; name: string }>;
  list: Person[];
}

/**
 * 检查指定奖项的预设名单，返回已无法中奖的成员及原因。
 * 规则与 annualRaffleHandler 的排除逻辑一致（含奖项限制），供抽奖前提示与预设弹窗清理共用。
 */
export function getPresetIssues(options: PresetIssuesOptions): PresetIssue[] {
  const {
    config,
    categoryKey,
    globalExcludeWinners,
    result,
    excludedUsers,
    list,
  } = options;
  const preset = getLotteryPreset(config, categoryKey);
  if (!preset || preset.length === 0) {
    return [];
  }
  const ids = [...new Set(preset.filter(Boolean))];
  const reasons = getPresetDisabledReasons({
    config,
    categoryKey,
    globalExcludeWinners,
    result,
    excludedUsers,
    list,
    presetIds: ids,
  });
  const issues: PresetIssue[] = [];
  ids.forEach((key) => {
    if (reasons[key]) {
      issues.push({ key, reason: reasons[key] });
      return;
    }
    const person = list.find((p) => p.key === key);
    if (!person) {
      issues.push({ key, reason: '不在参与名单中' });
    } else if (!canUserParticipate(person, categoryKey)) {
      issues.push({ key, reason: '不符合该奖项的参与限制' });
    }
  });
  return issues;
}

/**
 * 获取奖项名称
 * @param key 奖项key
 * @param customLotteries 自定义奖项列表
 * @returns 奖项名称
 */
export function getLotteryName(
  key: string,
  customLotteries?: Array<{ key: string; name: string }>,
): string {
  // 先从自定义奖项中查找
  if (customLotteries) {
    const customItem = customLotteries.find((item) => item.key === key);
    if (customItem) {
      return customItem.name;
    }
  }

  // 从默认奖项定义中查找
  const defaultItem = LOTTERY_ITEMS.find((item) => item.key === key);
  if (defaultItem) {
    return defaultItem.name;
  }

  return '';
}

// 导出 config 别名，用于向后兼容
export { defaultConfig as config };
