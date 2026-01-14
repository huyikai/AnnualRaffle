/**
 * 统一奖项配置模块
 * 集中管理所有奖项相关的配置、类型定义和工具函数
 */

// 奖项定义接口
export interface LotteryItem {
  key: string;
  name: string;
  defaultCount: number;
}

// 奖项配置项接口（支持预设名单）
export interface LotteryItemConfig {
  count: number;
  preset?: string;  // 可选，逗号分隔的用户ID字符串
}

// 奖项定义数组（单一数据源）
export const LOTTERY_ITEMS: LotteryItem[] = [
  { key: 'firstPrize', name: '一等奖', defaultCount: 1 },
  { key: 'secondPrize', name: '二等奖', defaultCount: 2 },
  { key: 'thirdPrize', name: '三等奖', defaultCount: 3 },
  { key: 'luckyFirst', name: '幸运奖第一轮', defaultCount: 15 },
  { key: 'luckySecond', name: '幸运奖第二轮', defaultCount: 15 },
];

// 奖项配置类型定义
export type LotteryConfigType = Record<string, LotteryItemConfig>;

// 从奖项定义自动生成默认配置（新格式）
export const defaultConfig: LotteryConfigType = LOTTERY_ITEMS.reduce((config, item) => {
  config[item.key] = { count: item.defaultCount };
  return config;
}, {} as LotteryConfigType);

// 奖项列表（用于向后兼容，从奖项定义生成）
export const lottery: Array<{ key: string; name: string }> = LOTTERY_ITEMS.map(item => ({
  key: item.key,
  name: item.name,
}));

// 辅助函数：安全获取奖项数量
export function getLotteryCount(config: LotteryConfigType, key: string): number {
  const value = config[key];
  if (value && typeof value === 'object') {
    return value.count ?? 0;
  }
  return 0;
}

// 辅助函数：获取预设名单
export function getLotteryPreset(config: LotteryConfigType, key: string): string | undefined {
  const value = config[key];
  if (value && typeof value === 'object') {
    return value.preset;
  }
  return undefined;
}

// 结果类型定义（从奖项定义自动生成，无需手动维护）
export type ResultType = Record<string, number[]>;

// 默认结果配置（从奖项定义生成）
export const defaultResult: ResultType = LOTTERY_ITEMS.reduce((result, item) => {
  result[item.key] = [];
  return result;
}, {} as ResultType);

/**
 * 获取奖项名称
 * @param key 奖项key
 * @param customLotteries 自定义奖项列表（从localStorage获取）
 * @returns 奖项名称
 */
export function getLotteryName(key: string, customLotteries?: Array<{ key: string; name: string }>): string {
  // 先从自定义奖项中查找
  if (customLotteries) {
    const customItem = customLotteries.find(item => item.key === key);
    if (customItem) {
      return customItem.name;
    }
  }
  
  // 从默认奖项定义中查找
  const defaultItem = LOTTERY_ITEMS.find(item => item.key === key);
  if (defaultItem) {
    return defaultItem.name;
  }
  
  return '';
}

// 导出 config 别名，用于向后兼容
export { defaultConfig as config };
