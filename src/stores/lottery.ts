import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  setData,
  resultField,
  newLotteryField,
  listField,
  configField,
} from '@/helper/index';
import type { LotteryConfigType, ResultType } from '@/config/lottery';
import { defaultConfig, defaultResult, getLotteryCount, getLotteryPreset } from '@/config/lottery';
import type { UserItem } from '@/config/user';
import type { PhotoItem } from '@/helper/db';
import type { NewLotteryItem } from '@/types';

// 默认配置常量
const DEFAULT_LOTTERY_NAME = '年会抽奖';
const DEFAULT_LOTTERY_NUMBER = 132;

// 扩展的抽奖配置类型
type ExtendedLotteryConfig = LotteryConfigType & { 
  name?: string; 
  number?: number;
};

export const useLotteryStore = defineStore('lottery', () => {
  /**
   * 创建默认配置
   * @returns 包含默认名称、数量和奖项配置的对象
   */
  function createDefaultConfig(): ExtendedLotteryConfig {
    return Object.assign(
      {},
      defaultConfig,
      {
        name: DEFAULT_LOTTERY_NAME,
        number: DEFAULT_LOTTERY_NUMBER,
      }
    ) as ExtendedLotteryConfig;
  }

  // ========== State ==========
  /** 抽奖配置（包含名称、数量和奖项配置） */
  const config = ref<ExtendedLotteryConfig>(createDefaultConfig());
  /** 抽奖结果 */
  const result = ref<ResultType>({ ...defaultResult });
  /** 新增的自定义奖项列表 */
  const newLottery = ref<NewLotteryItem[]>([]);
  /** 参与抽奖的用户列表 */
  const list = ref<UserItem[]>([]);
  /** 用户照片列表 */
  const photos = ref<PhotoItem[]>([]);

  // ========== Actions ==========
  /**
   * 获取指定奖项的数量
   * @param key 奖项键名
   * @returns 奖项数量
   */
  function getCount(key: string): number {
    return getLotteryCount(config.value, key);
  }

  /**
   * 获取指定奖项的预设名单
   * @param key 奖项键名
   * @returns 预设名单（逗号分隔的用户ID字符串），如果不存在则返回 undefined
   */
  function getPreset(key: string): string | undefined {
    return getLotteryPreset(config.value, key);
  }

  /**
   * 清除配置和新增奖项
   */
  function setClearConfig() {
    config.value = createDefaultConfig();
    newLottery.value = [];
  }

  /**
   * 清除用户列表
   */
  function setClearList() {
    list.value = [];
  }

  /**
   * 清除照片列表
   */
  function setClearPhotos() {
    photos.value = [];
  }

  /**
   * 清除抽奖结果
   */
  function setClearResult() {
    result.value = { ...defaultResult };
  }

  /**
   * 清除所有状态数据
   */
  function setClearStore() {
    config.value = createDefaultConfig();
    result.value = { ...defaultResult };
    newLottery.value = [];
    list.value = [];
    photos.value = [];
  }

  /**
   * 设置抽奖配置
   * @param newConfig 新的配置对象
   */
  function setConfig(newConfig: ExtendedLotteryConfig) {
    config.value = newConfig;
    setData(configField, config.value);
  }

  /**
   * 设置抽奖结果
   * @param newResult 新的结果对象，默认为空结果
   */
  function setResult(newResult: ResultType = { ...defaultResult }) {
    result.value = newResult;
    setData(resultField, result.value);
  }

  /**
   * 添加新的自定义奖项
   * @param item 奖项项（如果名称已存在则不会重复添加）
   */
  function setNewLottery(item: NewLotteryItem) {
    if (newLottery.value.find((lottery) => lottery.name === item.name)) {
      return;
    }
    newLottery.value.push(item);
    setData(newLotteryField, newLottery.value);
  }

  /**
   * 设置用户列表
   * @param newList 新的用户列表
   */
  function setList(newList: UserItem[]) {
    list.value = newList;
    setData(listField, list.value);
  }

  /**
   * 设置照片列表
   * @param newPhotos 新的照片列表
   */
  function setPhotos(newPhotos: PhotoItem[]) {
    photos.value = newPhotos;
  }

  return {
    // State
    config,
    result,
    newLottery,
    list,
    photos,
    // Actions
    getCount,
    getPreset,
    setClearConfig,
    setClearList,
    setClearPhotos,
    setClearResult,
    setClearStore,
    setConfig,
    setResult,
    setNewLottery,
    setList,
    setPhotos,
  };
});
