/**
 * chrome v8 实现
 */
/*
// ECMA 262 - 15.8.2.14
	var rngstate;  // Initialized to a Uint32Array during genesis.
	function MathRandom() {
		var r0 = (MathImul(18030, rngstate[0] & 0xFFFF) + (rngstate[0] >>> 16)) | 0;
		rngstate[0] = r0;
		var r1 = (MathImul(36969, rngstate[1] & 0xFFFF) + (rngstate[1] >>> 16)) | 0;
		rngstate[1] = r1;
		var x = ((r0 << 16) + (r1 & 0xFFFF)) | 0;
		// Division by 0x100000000 through multiplication by reciprocal.
		return (x < 0 ? (x + 0x100000000) : x) * 2.3283064365386962890625e-10;
	} 
*/

export function generateArray(start: number, end: number): number[] {
  return Array.from(new Array(end + 1).keys()).slice(start);
}

/**
 * 取范围内随机整数
 * @param minNum
 * @param maxNum
 */
export function randomNum(minNum: number = 1, maxNum: number): number {
  return parseInt(String(Math.random() * (maxNum - minNum + 1) + minNum), 10);
}

interface LotteryConfig {
  won?: number[];
  num: number;
  category?: string;
}

import type { LotteryConfigType } from '@/config/lottery';
import { getLotteryPreset } from '@/config/lottery';
import type { UserItem } from '@/config/userLoader';

interface LotteryStore {
  result: {
    [key: string]: number[];
  };
  list: UserItem[];
  config: LotteryConfigType;
}

/**
 * 检查用户是否可以参加指定奖项
 * @param user 用户对象
 * @param prizeKey 奖项 key
 * @returns 是否可以参加
 */
function canUserParticipate(user: UserItem, prizeKey: string | undefined): boolean {
  // 如果没有指定奖项，允许参加
  if (!prizeKey) {
    return true;
  }
  // 如果用户没有限制，可以参加所有奖项
  if (!user.allowedPrizes || user.allowedPrizes.length === 0) {
    return true;
  }
  // 检查当前奖项是否在允许列表中
  return user.allowedPrizes.includes(prizeKey);
}

/**
 * 单次抽奖
 * @param config 抽奖配置
 * @param store 抽奖 store
 * @param excludedUsers 全局排除名单（适用于所有奖项）
 * @returns 中奖用户 key 数组
 */
export function annualRaffleHandler(
  config: LotteryConfig,
  store: LotteryStore,
  excludedUsers: Array<{ key: number; name: string }> = []
): number[] {
  const { won = [], num, category } = config;
  
  // 使用 Set 存储已中奖用户，提升查找性能 O(1)
  const wonSet = new Set<number>();
  
  // 添加已中奖用户
  won.forEach(key => wonSet.add(key));
  Object.values(store.result).flat().forEach(key => wonSet.add(key));
  
  // 添加全局排除名单（适用于所有奖项）
  excludedUsers.forEach(item => wonSet.add(item.key));
  
  // 检查是否有预设名单
  if (category) {
    const preset = getLotteryPreset(store.config, category);
    if (preset && preset.trim()) {
      // 解析预设名单，获取所有预设人员ID
      const presetIds = preset.split(',').map(item => Number(item.trim())).filter(Boolean);
      
      // 过滤掉已中奖的人员，得到有效预设人员
      const validPresetIds = presetIds.filter(id => !wonSet.has(id));
      
      // 检查预设人员是否符合奖项限制
      const validPresetIdsWithRestriction = validPresetIds.filter(id => {
        const user = store.list.find(u => u.key === id);
        return user && canUserParticipate(user, category);
      });
      
      // 如果有效预设人员数量 >= 奖项人数，按照预设顺序取前 num 个
      if (validPresetIdsWithRestriction.length >= num) {
        return validPresetIdsWithRestriction.slice(0, num);
      }
      
      // 如果有效预设人员数量 < 奖项人数，使用所有有效预设人员，然后补充随机抽取
      if (validPresetIdsWithRestriction.length > 0) {
        // 将有效预设人员添加到已中奖集合中，避免随机抽取时重复
        validPresetIdsWithRestriction.forEach(id => wonSet.add(id));
        
        // 计算剩余需要抽取的名额
        const remaining = num - validPresetIdsWithRestriction.length;
        
        // 预先计算可抽奖用户列表（排除已中奖、预设人员和不符合奖项限制的用户）
        const availableUsers = store.list
          .filter(user => !wonSet.has(user.key) && canUserParticipate(user, category))
          .map(item => item.key);
        
        // 验证可抽奖人数是否足够
        if (availableUsers.length < remaining) {
          throw new Error(`可抽奖人数不足：预设名单已使用 ${validPresetIdsWithRestriction.length} 人，还需要 ${remaining} 人，但只有 ${availableUsers.length} 人可抽`);
        }
        
        // 随机抽取剩余名额
        const randomResults: number[] = [];
        const availableSet = new Set(availableUsers);
        
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
    .filter(user => !wonSet.has(user.key) && canUserParticipate(user, category))
    .map(item => item.key);
  
  // 验证可抽奖人数是否足够
  if (availableUsers.length < num) {
    throw new Error(`可抽奖人数不足：需要 ${num} 人，但只有 ${availableUsers.length} 人可抽`);
  }
  
  // 随机抽取
  const res: number[] = [];
  const availableSet = new Set(availableUsers); // 用于快速移除已选中的用户
  
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
