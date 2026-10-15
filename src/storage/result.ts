/**
 * 抽奖结果持久化（双轨）
 *
 * result     —— 纯工号数组，算法层直接消费，签名与旧版一致
 * resultMeta —— 抽奖当时的姓名与时间快照，供展示层使用
 *
 * 为什么需要双轨：结果页原本靠 store.list 反查姓名。一旦名单被改动
 * （删人、改工号、重新导入覆盖），中奖记录就变成孤儿，页面显示空白。
 * 快照保证「当时谁中了」这个事实不会因为事后改名而丢失或被篡改。
 */

import { getData, setData } from '@/helper/index';
import type { Person } from '@/data/person';

export const resultMetaField = 'resultMeta';

/** 单条中奖记录 */
export interface WinRecord {
  /** 抽奖当时的姓名，之后改名不影响此记录 */
  name: string;
  /** 中奖时间戳 */
  time: number;
}

/** 算法消费：奖项 key → 工号数组 */
export type ResultKeys = Record<string, string[]>;

/** 展示消费：奖项 key → 工号 → 快照 */
export type ResultMeta = Record<string, Record<string, WinRecord>>;

/** 读取结果（工号数组） */
export function loadResult(): ResultKeys {
  const data = getData('result');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  // 兜底：历史数据若仍是数字，转换为字符串
  const result = data as Record<string, unknown>;
  const normalized: ResultKeys = {};
  Object.keys(result).forEach((key) => {
    const value = result[key];
    if (Array.isArray(value)) {
      normalized[key] = value.map((item) => String(item));
    }
  });
  return normalized;
}

/** 写入结果（工号数组） */
export function saveResult(result: ResultKeys): void {
  setData('result', result);
}

/** 读取中奖快照 */
export function loadResultMeta(): ResultMeta {
  const data = getData(resultMetaField);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  return data as ResultMeta;
}

/** 写入中奖快照 */
export function saveResultMeta(meta: ResultMeta): void {
  setData(resultMetaField, meta);
}

/**
 * 记录一次中奖：同时写入工号数组与姓名快照。
 *
 * @param category 奖项 key
 * @param keys 本次抽中的工号
 * @param roster 当前名册，用于取姓名快照
 * @returns 新的 result 与 resultMeta（均为新对象，便于直接交给 store）
 */
export function recordWins(
  result: ResultKeys,
  meta: ResultMeta,
  category: string,
  keys: string[],
  roster: Person[],
): { result: ResultKeys; meta: ResultMeta } {
  const now = Date.now();
  const existing = result[category] ?? [];
  const existingMeta = meta[category] ?? {};

  const nextMetaForCategory: Record<string, WinRecord> = { ...existingMeta };
  const nameOf = new Map(roster.map((p) => [p.key, p.name]));

  keys.forEach((key) => {
    nextMetaForCategory[key] = {
      // 名单里查不到时用工号兜底，保证记录始终可读
      name: nameOf.get(key) ?? `工号 ${key}`,
      time: now,
    };
  });

  return {
    result: { ...result, [category]: existing.concat(keys) },
    meta: { ...meta, [category]: nextMetaForCategory },
  };
}

/**
 * 移除一条中奖记录（结果页点击号码删除）。
 * 工号数组与快照必须同步清理，否则会留下无主快照。
 */
export function removeWin(
  result: ResultKeys,
  meta: ResultMeta,
  category: string,
  key: string,
): { result: ResultKeys; meta: ResultMeta } {
  const keys = result[category] ?? [];
  const records = meta[category] ?? {};

  const nextRecords = { ...records };
  delete nextRecords[key];

  return {
    result: { ...result, [category]: keys.filter((item) => item !== key) },
    meta: { ...meta, [category]: nextRecords },
  };
}

/**
 * 解析中奖人姓名：名册优先（改名后展示新名），查不到时回退到快照。
 */
export function resolveWinnerName(
  roster: Person[],
  meta: ResultMeta,
  category: string,
  key: string,
): string {
  const person = roster.find((p) => p.key === key);
  if (person) {
    return person.name;
  }
  return meta[category]?.[key]?.name ?? `工号 ${key}`;
}
