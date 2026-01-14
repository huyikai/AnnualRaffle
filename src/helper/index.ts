import type { StorageValue, NewLotteryItem } from '@/types';
import { getLotteryName } from '@/config/lottery';

/**
 * 设置 localStorage 数据
 * @param key 存储键
 * @param value 存储值
 * @throws Error 当存储失败时抛出错误
 */
export function setData(key: string, value: StorageValue): void {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`Failed to set data for key "${key}":`, error.message);
    throw new Error(`存储数据失败: ${error.message}`);
  }
}

/**
 * 获取 localStorage 数据
 * @param key 存储键
 * @returns 存储值，如果不存在则返回 null
 */
export function getData(key: string): StorageValue {
  try {
    const value = localStorage.getItem(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value) as StorageValue;
    } catch {
      // 如果不是 JSON 格式，返回原始字符串
      return value;
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`Failed to get data for key "${key}":`, error.message);
    return null;
  }
}

/**
 * 删除 localStorage 数据
 * @param key 存储键
 */
export function removeData(key: string): void {
  localStorage.removeItem(key);
}

/**
 * 清空所有 localStorage 数据
 */
export function clearData(): void {
  localStorage.clear();
}

/**
 * 从 DOM 元素获取 data 属性值
 * @param element DOM 元素，如果为 null 则返回 undefined
 * @param dataName data 属性名称（不包含 "data-" 前缀）
 * @returns data 属性值，如果元素不存在或属性不存在则返回 undefined
 */
export function getDomData(element: Element | null, dataName: string): string | undefined {
  if (!element || !dataName || !element.getAttribute) {
    return undefined;
  }
  return element.getAttribute(`data-${dataName}`) || undefined;
}

/**
 * localStorage 存储字段键名常量
 */
export const configField = 'config'; // 配置数据
export const resultField = 'result'; // 抽奖结果
export const newLotteryField = 'newLottery'; // 新增奖项
export const listField = 'list'; // 名单

/**
 * 转换奖项分类名称
 * @param key 奖项键名
 * @returns 奖项显示名称
 */
export function conversionCategoryName(key: string): string {
  const newLottery = getData(newLotteryField);
  const lotteryArray: NewLotteryItem[] = Array.isArray(newLottery) 
    ? (newLottery as NewLotteryItem[])
    : [];
  return getLotteryName(key, lotteryArray);
}
