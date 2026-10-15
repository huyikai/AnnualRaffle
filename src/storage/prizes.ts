/**
 * 奖项持久化
 *
 * v1 用 localStorage 的 newLottery 存「全部奖项」（内置 + 自定义混在一起，
 * 内置的无法改名也无法删除）。v2 统一为 prizes 数组，用 builtin 字段区分，
 * 内置奖项可删除但可一键恢复。
 */

import { getData, setData } from '@/helper/index';
import { LOTTERY_ITEMS, BUILTIN_PRIZE_KEYS } from '@/config/lottery';
import type { Prize, PrizeTombstones } from '@/data/prizes';

export const prizesField = 'prizes';
export const prizeTombstonesField = 'prizeTombstones';

/** 由内置奖项定义生成初始奖项列表 */
export function builtinPrizes(): Prize[] {
  return LOTTERY_ITEMS.map((item) => ({
    key: item.key,
    name: item.name,
    builtin: true,
  }));
}

/** 读取奖项列表；无数据时回落到内置奖项 */
export function loadPrizes(): Prize[] {
  const data = getData(prizesField);
  if (!Array.isArray(data) || data.length === 0) {
    return builtinPrizes();
  }
  return (data as Prize[]).map((item) => ({
    key: item.key,
    name: item.name,
    builtin: BUILTIN_PRIZE_KEYS.has(item.key),
  }));
}

/** 写入奖项列表 */
export function savePrizes(prizes: Prize[]): void {
  setData(prizesField, prizes);
}

/** 读取已删除奖项的名称映射 */
export function loadPrizeTombstones(): PrizeTombstones {
  const data = getData(prizeTombstonesField);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  return data as PrizeTombstones;
}

/** 写入已删除奖项的名称映射 */
export function savePrizeTombstones(tombstones: PrizeTombstones): void {
  setData(prizeTombstonesField, tombstones);
}
