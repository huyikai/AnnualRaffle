/**
 * 名册持久化
 *
 * 存储介质沿用 localStorage（沿用 helper/index.ts 现有封装，不另建 kv 层）：
 * 名册量级为几百到几千条、不到 1MB JSON，远未逼近 5MB 上限。
 */

import { getData, setData } from '@/helper/index';
import { toPerson } from '@/data/person';
import type { Person, LegacyUserItem } from '@/data/person';

export const rosterField = 'roster';

/** 读取名册；无数据时返回空数组 */
export function loadRoster(): Person[] {
  const data = getData(rosterField);
  if (!Array.isArray(data)) {
    return [];
  }
  return (data as Array<Person | LegacyUserItem>).map(toPerson);
}

/** 写入名册 */
export function saveRoster(list: Person[]): void {
  setData(rosterField, list);
}
