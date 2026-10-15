/**
 * 首次启动的示例数据
 *
 * 旧版通过 src/config/user.ts 在构建期注入名单（被 .gitignore 忽略），
 * 名单因此被烤进产物，改一个人就要重新发版，且 excludedUsers 从不落盘。
 * 现在名单改为运行时数据，本模块只在「首次启动」与「无 localStorage 数据」时作为种子。
 */

import { user, excludedUsers } from '@/config/user.example';
import { fromLegacy } from './person';
import type { Person } from './person';

/** 示例数据中被排除人员的工号 */
export const SEED_EXCLUDED_KEYS = new Set(
  excludedUsers.map((item) => String(item.key)),
);

/**
 * 示例名册。
 * 示例数据里 excludedUsers 的人是「排除」状态，这里落到 enabled=false，
 * 以保证首次启动的行为与旧版完全一致。
 */
export const SEED_PEOPLE: Person[] = user.map((item) => {
  const person = fromLegacy(item);
  return {
    ...person,
    enabled: !SEED_EXCLUDED_KEYS.has(person.key),
  };
});
