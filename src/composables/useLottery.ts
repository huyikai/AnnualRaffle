/**
 * 抽奖业务逻辑 Composable
 * 封装抽奖开始、停止、结果显示等逻辑
 */

import { ref, nextTick } from 'vue';
import { annualRaffleHandler } from '@/helper/algorithm';
import { useLotteryStore } from '@/stores/lottery';
import type { LotteryForm } from '@/types';
import type { UserItem } from '@/config/userLoader';
import { getLotteryExcludeMode, getLotteryExcludeWinners, getLotteryExcludedPersons } from '@/config/lottery';
import { LOTTERY_MODE, LOTTERY_TIMING, TAG_CANVAS_CONFIG } from '@/constants';
import { ElMessage } from 'element-plus';
import { useTagCanvas } from './useTagCanvas';
import { useAudio } from './useAudio';

/**
 * 使用抽奖功能的组合式函数
 */
export function useLottery(excludedUsers: UserItem[] = []) {
  const store = useLotteryStore();
  const { setSpeed, reloadTagCanvas, getNormalSpeed } = useTagCanvas();
  const { audioEnabled, enableAudio, playBeginSound } = useAudio();

  const running = ref(false);
  const showRes = ref(false);
  const resArr = ref<number[]>([]);
  const category = ref('');
  let drawStartTime = 0;

  /**
   * 开始抽奖
   * @returns 是否成功开始抽奖
   */
  const startDraw = (form: LotteryForm): boolean => {
    if (!form) {
      return false;
    }

    const { category: formCategory, mode, qty, remain } = form;
    let num = 1;
    if (mode === LOTTERY_MODE.ONE || mode === LOTTERY_MODE.FIVE) {
      num = mode;
    } else if (mode === LOTTERY_MODE.REMAIN) {
      num = remain;
    } else if (mode === LOTTERY_MODE.CUSTOM) {
      num = qty;
    }

    // 计算有效排除参数：奖项级设置优先于全局
    const categoryMode = getLotteryExcludeMode(store.config, formCategory);
    let effectiveExcludeWinners: boolean;
    let effectiveExcludedPersons: number[];

    if (categoryMode === 'custom') {
      effectiveExcludeWinners = getLotteryExcludeWinners(store.config, formCategory);
      effectiveExcludedPersons = getLotteryExcludedPersons(store.config, formCategory);
    } else {
      effectiveExcludeWinners = store.excludeWinners;
      effectiveExcludedPersons = [];
    }

    try {
      const resArrResult = annualRaffleHandler(
        {
          category: formCategory,
          num,
          excludeWinners: effectiveExcludeWinners,
          excludedPersons: effectiveExcludedPersons
        },
        {
          result: store.result,
          list: store.list,
          config: store.config
        },
        excludedUsers
      );
      
      // 只有在抽奖成功后才更新状态
      showRes.value = false;
      setSpeed(TAG_CANVAS_CONFIG.DRAW_SPEED);
      running.value = true;
      drawStartTime = Date.now();
      resArr.value = resArrResult;

      category.value = formCategory;
      const currentResult = { ...store.result };
      if (!currentResult[formCategory]) {
        currentResult[formCategory] = [];
      }
      const oldRes = currentResult[formCategory] || [];
      const data = {
        ...currentResult,
        [formCategory]: oldRes.concat(resArrResult)
      };
      store.setResult(data);
      
      // 启用音频（如果尚未启用）
      if (!audioEnabled.value) {
        enableAudio();
      }
      // 播放开始音效
      playBeginSound();
      
      return true;
    } catch (error) {
      console.error('抽奖失败:', error);
      // 确保状态重置
      running.value = false;
      setSpeed(getNormalSpeed());
      return false;
    }
  };

  /**
   * 停止抽奖
   */
  const stopDraw = (): void => {
    if (
      running.value &&
      Date.now() - drawStartTime < LOTTERY_TIMING.MIN_DRAW_DURATION
    ) {
      ElMessage.warning(
        `转盘至少转动${LOTTERY_TIMING.MIN_DRAW_DURATION / 1000}秒，请稍候`
      );
      return;
    }
    setSpeed(getNormalSpeed());
    showRes.value = true;
    running.value = false;
    nextTick(() => {
      reloadTagCanvas();
    });
  };

  /**
   * 切换抽奖状态（开始/停止）
   * @returns 是否成功切换状态
   */
  const toggleDraw = (form: LotteryForm): boolean => {
    if (running.value) {
      stopDraw();
      return true;
    } else {
      return startDraw(form);
    }
  };

  /**
   * 关闭结果显示
   */
  const closeResult = (): void => {
    showRes.value = false;
  };

  return {
    running,
    showRes,
    resArr,
    category,
    startDraw,
    stopDraw,
    toggleDraw,
    closeResult
  };
}
