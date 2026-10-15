import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  setData,
  resultField,
  configField,
  excludeWinnersField,
} from '@/helper/index';
import type { LotteryConfigType, ResultType } from '@/config/lottery';
import {
  defaultConfig,
  defaultResult,
  getLotteryCount,
  getLotteryPreset,
} from '@/config/lottery';
import type { Person } from '@/data/person';
import { deriveExcluded } from '@/data/person';
import type { Prize, PrizeTombstones } from '@/data/prizes';
import {
  removePrize as removePrizeFrom,
  renamePrize as renamePrizeIn,
} from '@/data/prizes';
import type { ResultMeta } from '@/storage/result';
import { recordWins, removeWin } from '@/storage/result';
import {
  savePrizes,
  savePrizeTombstones,
  builtinPrizes,
} from '@/storage/prizes';

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
    return Object.assign({}, defaultConfig, {
      name: DEFAULT_LOTTERY_NAME,
      number: DEFAULT_LOTTERY_NUMBER,
    }) as ExtendedLotteryConfig;
  }

  // ========== State ==========
  /** 抽奖配置（包含名称、数量和奖项配置） */
  const config = ref<ExtendedLotteryConfig>(createDefaultConfig());
  /** 抽奖结果（工号数组，算法层消费） */
  const result = ref<ResultType>({ ...defaultResult });
  /** 中奖快照（抽奖当时的姓名与时间，展示层消费） */
  const resultMeta = ref<ResultMeta>({});
  /** 全部奖项（内置 + 自定义） */
  const prizes = ref<Prize[]>(builtinPrizes());
  /** 已删除奖项的 key → 名称，用于把悬空的参与限制显示成「已失效：xxx」 */
  const prizeTombstones = ref<PrizeTombstones>({});
  /** 参与抽奖的人员名册 */
  const list = ref<Person[]>([]);
  /** 全局排除已中奖人员 */
  const excludeWinners = ref(true);

  // ========== Getters ==========
  /**
   * 全局排除人员，由名册的 enabled=false 派生。
   *
   * 旧版 excludedUsers 是构建期静态 import，从不落盘，用户改了排除设置重启就还原。
   * 现在改为从名册派生，随名册一起持久化。
   */
  const excludedUsers = computed(() => deriveExcluded(list.value));

  /** 参与抽奖的人数（enabled=true） */
  const activeCount = computed(
    () => list.value.filter((p) => p.enabled).length,
  );

  // ========== Actions ==========
  /**
   * 获取指定奖项的数量
   */
  function getCount(key: string): number {
    return getLotteryCount(config.value, key);
  }

  /**
   * 获取指定奖项的预设名单
   */
  function getPreset(key: string): string[] | undefined {
    return getLotteryPreset(config.value, key);
  }

  /**
   * 设置全局排除已中奖人员
   */
  function setExcludeWinners(value: boolean) {
    excludeWinners.value = value;
    setData(excludeWinnersField, value);
  }

  /** 清除配置和奖项 */
  function setClearConfig() {
    config.value = createDefaultConfig();
    prizes.value = builtinPrizes();
    prizeTombstones.value = {};
    excludeWinners.value = true;
  }

  /** 清除人员名单 */
  function setClearList() {
    list.value = [];
  }

  /** 清除抽奖结果（含快照） */
  function setClearResult() {
    result.value = { ...defaultResult };
    resultMeta.value = {};
  }

  /** 清除所有状态数据 */
  function setClearStore() {
    config.value = createDefaultConfig();
    result.value = { ...defaultResult };
    resultMeta.value = {};
    prizes.value = builtinPrizes();
    prizeTombstones.value = {};
    list.value = [];
    excludeWinners.value = true;
  }

  /** 设置抽奖配置 */
  function setConfig(newConfig: ExtendedLotteryConfig) {
    config.value = newConfig;
    setData(configField, config.value);
  }

  /** 设置抽奖结果（工号数组） */
  function setResult(newResult: ResultType = { ...defaultResult }) {
    result.value = newResult;
    setData(resultField, newResult);
  }

  /** 设置中奖快照 */
  function setResultMeta(newMeta: ResultMeta) {
    resultMeta.value = newMeta;
  }

  /**
   * 记录一次中奖：同时写入工号数组与姓名快照
   */
  function recordWin(category: string, keys: string[]) {
    const next = recordWins(
      result.value,
      resultMeta.value,
      category,
      keys,
      list.value,
    );
    result.value = next.result;
    resultMeta.value = next.meta;
    setData(resultField, next.result);
  }

  /**
   * 移除一条中奖记录，结果与快照同步清理
   */
  function removeWinner(category: string, key: string) {
    const next = removeWin(result.value, resultMeta.value, category, key);
    result.value = next.result;
    resultMeta.value = next.meta;
    setData(resultField, next.result);
  }

  /** 设置人员名册 */
  function setList(newList: Person[]) {
    list.value = newList;
  }

  /** 设置奖项列表 */
  function setPrizes(newPrizes: Prize[]) {
    prizes.value = newPrizes;
    savePrizes(newPrizes);
  }

  /** 设置已删除奖项的名称映射 */
  function setPrizeTombstones(tombstones: PrizeTombstones) {
    prizeTombstones.value = tombstones;
    savePrizeTombstones(tombstones);
  }

  /** 新增自定义奖项（重名时忽略） */
  function addPrize(prize: Prize) {
    if (prizes.value.find((p) => p.name === prize.name)) {
      return false;
    }
    setPrizes([...prizes.value, prize]);
    return true;
  }

  /**
   * 删除奖项，同时记录墓碑，供悬空的参与限制显示为「已失效：xxx」
   */
  function deletePrize(prizeKey: string) {
    const { prizes: nextPrizes, tombstones } = removePrizeFrom(
      prizes.value,
      prizeTombstones.value,
      prizeKey,
    );
    setPrizes(nextPrizes);
    setPrizeTombstones(tombstones);
  }

  /**
   * 重命名奖项。key 不变，因此人员的参与限制自动跟随
   */
  function renamePrizeByKey(prizeKey: string, name: string) {
    setPrizes(renamePrizeIn(prizes.value, prizeKey, name));
  }

  /** 恢复被删除的内置奖项 */
  function restoreBuiltinPrizes() {
    const existing = new Set(prizes.value.map((p) => p.key));
    const missing = builtinPrizes().filter((p) => !existing.has(p.key));
    if (missing.length > 0) {
      setPrizes([...prizes.value, ...missing]);
    }
    return missing.length;
  }

  /** 奖项名称查询 */
  function getPrizeName(prizeKey: string): string {
    return prizes.value.find((p) => p.key === prizeKey)?.name ?? '';
  }

  return {
    // State
    config,
    result,
    resultMeta,
    prizes,
    prizeTombstones,
    list,
    excludeWinners,
    // Getters
    excludedUsers,
    activeCount,
    // Actions
    getCount,
    getPreset,
    getPrizeName,
    setExcludeWinners,
    setClearConfig,
    setClearList,
    setClearResult,
    setClearStore,
    setConfig,
    setResult,
    setResultMeta,
    recordWin,
    removeWinner,
    setList,
    setPrizes,
    setPrizeTombstones,
    addPrize,
    deletePrize,
    renamePrizeByKey,
    restoreBuiltinPrizes,
  };
});
