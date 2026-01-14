/**
 * 抽奖业务逻辑 Composable
 * 封装抽奖开始、停止、结果显示等逻辑
 */

import { ref, computed, nextTick } from 'vue';
import { annualRaffleHandler } from '@/helper/algorithm';
import { useLotteryStore } from '@/stores/lottery';
import type { LotteryForm } from '@/types';
import type { UserItem } from '@/config/userLoader';
import { LOTTERY_MODE, TAG_CANVAS_CONFIG } from '@/constants';
import { useTagCanvas } from './useTagCanvas';
import { useAudio } from './useAudio';

/**
 * 使用抽奖功能的组合式函数
 */
export function useLottery(luckyExclude: UserItem[] = []) {
  const store = useLotteryStore();
  const { setSpeed, reloadTagCanvas, getNormalSpeed } = useTagCanvas();
  const { audioEnabled, enableAudio, playBeginSound } = useAudio();

  const running = ref(false);
  const showRes = ref(false);
  const resArr = ref<number[]>([]);
  const category = ref('');

  /**
   * 计算所有已中奖结果
   */
  const allresult = computed(() => {
    const allresult: number[] = [];
    for (const key in store.result) {
      if (store.result.hasOwnProperty(key)) {
        const element = store.result[key];
        allresult.push(...element);
      }
    }
    return allresult;
  });

  /**
   * 开始抽奖
   * @returns 是否成功开始抽奖
   */
  const startDraw = (form: LotteryForm): boolean => {
    if (!form) {
      return false;
    }

    const { category: formCategory, mode, qty, remain, allin } = form;
    let num = 1;
    if (mode === LOTTERY_MODE.ONE || mode === LOTTERY_MODE.FIVE) {
      num = mode;
    } else if (mode === LOTTERY_MODE.REMAIN) {
      num = remain;
    } else if (mode === LOTTERY_MODE.CUSTOM) {
      num = qty;
    }

    try {
      const resArrResult = annualRaffleHandler(
        {
          category: formCategory,
          won: allin ? [] : allresult.value,
          num
        },
        {
          result: store.result,
          list: store.list,
          config: store.config
        },
        luckyExclude
      );
      
      // 只有在抽奖成功后才更新状态
      showRes.value = false;
      setSpeed(TAG_CANVAS_CONFIG.DRAW_SPEED);
      running.value = true;
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
    allresult,
    startDraw,
    stopDraw,
    toggleDraw,
    closeResult
  };
}
