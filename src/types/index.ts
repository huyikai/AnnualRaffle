/**
 * 统一类型定义文件
 */

import type { LotteryConfigType, ResultType } from '@/config/lottery';
import type { Person } from '@/data/person';
import type { ResultKeys, ResultMeta } from '@/storage/result';

/**
 * 抽奖表单类型
 */
export interface LotteryForm {
  category: string;
  mode: number;
  qty: number;
  remain: number;
}

/**
 * 存储字段键名
 */
export type StorageField =
  | 'config'
  | 'preset'
  | 'result'
  | 'newLottery'
  | 'list'
  | 'roster'
  | 'prizes'
  | 'resultMeta'
  | 'schemaVersion'
  | 'prizeTombstones';

/**
 * localStorage 存储的值类型
 *
 * 含 interface 类型时不能只用 Record<string, unknown> 兜底——
 * TypeScript 的 interface 没有隐式索引签名，赋不过去。
 */
export type StorageValue =
  | LotteryConfigType
  | ResultKeys
  | ResultMeta
  | Person[]
  | Array<{ key: string; name: string }>
  | Record<string, string>
  | Record<string, string[]>
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
  CUSTOM = 99,
}

/**
 * 重置类型枚举
 *
 * 旧版有 PHOTOS（重置照片），对应的是一个从未被写入过的 IndexedDB store，
 * 实际是空操作，已移除。照片管理在阶段 3 落地后以真实行为重新加入。
 */
export enum ResetType {
  /** 重置全部数据 */
  ALL = 0,
  /** 重置抽奖配置 */
  CONFIG = 1,
  /** 重置名单 */
  LIST = 2,
  /** 重置抽奖结果 */
  RESULT = 3,
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
  value: string[];
}

// 兼容旧引用：结果类型与存储类型统一由 config/lottery 与 storage/result 提供
export type { Person, ResultType };
