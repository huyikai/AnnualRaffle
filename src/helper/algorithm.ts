/**
 * chrome v8 实现
 */
/*
// ECMA 262 - 15.8.2.14
	var rngstate;  // Initialized with a 32-bit seed
	var r0;        // Previous rng state
	var r1;        // Latest rng state
	function MathRandom() {
		r0 = r1;
		r1 = Imul(16807, r1) % 2147483647;
		var result = r1 / 2147483647;
		return result;
	}
*/

export function generateArray(start: number, end: number): number[] {
  return Array.from(new Array(end + 1).keys()).slice(start);
}

/**
 * 取范围内随机整数
 */
export function randomNum(minNum: number = 1, maxNum: number): number {
  return parseInt(String(Math.random() * (maxNum - minNum + 1) + minNum), 10);
}

interface LotteryConfig {
  won?: string[];
  num: number;
  category?: string;
  excludeWinners?: boolean;
  excludedPersons?: string[];
}

import type { LotteryConfigType, ResultType } from '@/config/lottery';
import { canUserParticipate, getLotteryPreset } from '@/config/lottery';
import type { Person } from '@/data/person';

interface LotteryStore {
  result: ResultType;
  list: Person[];
  config: LotteryConfigType;
}

/**
 * 检查人员是否可以参加指定奖项
 * 实现已迁移至 @/config/lottery，此处保留导出以兼容既有引用
 */
export { canUserParticipate };

/**
 * 单次抽奖
 * @param config 抽奖配置
 * @param store 抽奖 store
 * @param excludedUsers 全局排除名单（适用于所有奖项）
 * @returns 中奖工号数组
 */
export function annualRaffleHandler(
  config: LotteryConfig,
  store: LotteryStore,
  excludedUsers: Array<{ key: string; name: string }> = [],
): string[] {
  const {
    won = [],
    num,
    category,
    excludeWinners = true,
    excludedPersons = [],
  } = config;

  const wonSet = new Set<string>();

  // 1. 始终排除：全局排除名单（由名册 enabled=false 派生）
  excludedUsers.forEach((item) => wonSet.add(item.key));

  // 2. 始终排除：同奖项已中奖者（防止同一人在同一奖项重复出现）
  if (category && store.result[category]) {
    store.result[category].forEach((key) => wonSet.add(key));
  }

  // 3. 按设置排除：所有奖项的已中奖者
  if (excludeWinners) {
    won.forEach((key) => wonSet.add(key));
    Object.values(store.result)
      .flat()
      .forEach((key) => wonSet.add(key));
  }

  // 4. 按设置排除：指定人员
  if (excludedPersons.length > 0) {
    excludedPersons.forEach((key) => wonSet.add(key));
  }

  // 检查是否有预设名单
  if (category) {
    const presetIds = getLotteryPreset(store.config, category);
    if (presetIds && presetIds.length > 0) {
      // 过滤掉已中奖的人员，得到有效预设人员
      const validPresetIds = presetIds.filter((id) => !wonSet.has(id));

      // 检查预设人员是否符合奖项限制
      const validPresetIdsWithRestriction = validPresetIds.filter((id) => {
        const person = store.list.find((p) => p.key === id);
        return person && canUserParticipate(person, category);
      });

      // 如果有效预设人员数量 >= 奖项人数，按照预设顺序取前 num 个
      if (validPresetIdsWithRestriction.length >= num) {
        return validPresetIdsWithRestriction.slice(0, num);
      }

      // 如果有效预设人员数量 < 奖项人数，使用所有有效预设人员，然后补充随机抽取
      if (validPresetIdsWithRestriction.length > 0) {
        // 将有效预设人员添加到已中奖集合中，避免随机抽取时重复
        validPresetIdsWithRestriction.forEach((id) => wonSet.add(id));

        // 计算剩余需要抽取的名额
        const remaining = num - validPresetIdsWithRestriction.length;

        // 预先计算可抽奖用户列表（排除已中奖、预设人员和不符合奖项限制的用户）
        const availableUsers = store.list
          .filter(
            (person) =>
              !wonSet.has(person.key) && canUserParticipate(person, category),
          )
          .map((item) => item.key);

        // 验证可抽奖人数是否足够
        if (availableUsers.length < remaining) {
          throw new Error(
            `可抽奖人数不足：预设名单已使用 ${validPresetIdsWithRestriction.length} 人，还需要 ${remaining} 人，但只有 ${availableUsers.length} 人可抽`,
          );
        }

        // 随机抽取剩余名额
        const randomResults: string[] = [];
        const availableSet = new Set<string>(availableUsers);

        for (let j = 0; j < remaining; j++) {
          const availableArray = Array.from(availableSet);
          if (availableArray.length === 0) {
            break; // 防止无限循环
          }

          const randomIndex = randomNum(1, availableArray.length) - 1;
          const selected = availableArray[randomIndex];

          randomResults.push(selected);
          availableSet.delete(selected);
        }

        // 返回预设人员 + 随机抽取的人员
        return [...validPresetIdsWithRestriction, ...randomResults];
      }
      // 如果有效预设人员为0，继续走随机抽取逻辑
    }
  }

  // 预先计算可抽奖用户列表，避免重复过滤（排除已中奖和不符合奖项限制的用户）
  const availableUsers = store.list
    .filter(
      (person) =>
        !wonSet.has(person.key) && canUserParticipate(person, category),
    )
    .map((item) => item.key);

  // 验证可抽奖人数是否足够
  if (availableUsers.length < num) {
    throw new Error(
      `可抽奖人数不足：需要 ${num} 人，但只有 ${availableUsers.length} 人可抽`,
    );
  }

  // 随机抽取
  const res: string[] = [];
  const availableSet = new Set<string>(availableUsers); // 用于快速移除已选中的用户

  for (let j = 0; j < num; j++) {
    const availableArray = Array.from(availableSet);
    if (availableArray.length === 0) {
      break; // 防止无限循环
    }

    const randomIndex = randomNum(1, availableArray.length) - 1;
    const selected = availableArray[randomIndex];

    res.push(selected);
    availableSet.delete(selected); // 从可用列表中移除，避免重复抽取
  }

  return res;
}

// 导出类型供其他模块使用
export type { LotteryConfig };
