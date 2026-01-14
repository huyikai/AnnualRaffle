/**
 * 统一类型定义文件
 */

import type { UserItem } from '@/config/userLoader';
import type { LotteryConfigType, ResultType } from '@/config/lottery';

/**
 * 抽奖表单类型
 */
export interface LotteryForm {
  category: string;
  mode: number;
  qty: number;
  remain: number;
  allin: boolean;
}

/**
 * 抽奖配置项
 */
export interface NewLotteryItem {
  key: string;
  name: string;
}

/**
 * 存储字段键名
 */
export type StorageField = 'config' | 'preset' | 'result' | 'newLottery' | 'list';

/**
 * localStorage 存储的值类型
 */
export type StorageValue = 
  | LotteryConfigType 
  | Record<string, string>  // 兼容旧的 preset 数据格式
  | ResultType 
  | NewLotteryItem[] 
  | UserItem[] 
  | string 
  | number 
  | boolean 
  | null;

/**
 * 抽奖模式枚举
 */
export enum LotteryMode {
  /** 抽取剩余人数 */
  REMAIN = 0,
  /** 抽取1人 */
  ONE = 1,
  /** 抽取5人 */
  FIVE = 5,
  /** 自定义数量 */
  CUSTOM = 99
}

/**
 * 重置类型枚举
 */
export enum ResetType {
  /** 重置全部数据 */
  ALL = 0,
  /** 重置抽奖配置 */
  CONFIG = 1,
  /** 重置名单 */
  LIST = 2,
  /** 重置照片 */
  PHOTOS = 3,
  /** 重置抽奖结果 */
  RESULT = 4
}

/**
 * 抽奖选项
 */
export interface LotteryOption {
  label: string;
  value: string;
}

/**
 * 结果列表项
 */
export interface ResultListItem {
  label: string;
  name: string;
  value: number[];
}
