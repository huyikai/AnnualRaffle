<template>
  <div id="root" class="relative" :style="{ backgroundColor: '#5E0F08', backgroundImage: `url(${bgImage})`, backgroundSize: '100% 100%', backgroundPosition: 'center center', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh', margin: 0, padding: 0 }">
    <header class="h-[50px] leading-[50px] relative">
      <el-button
        class="res absolute top-[17px] right-5 p-0 z-[9999]"
        style="color:#E1A857; background: transparent; border: none;"
        link
        @click="showResult = true"
      >
        抽奖结果
      </el-button>
      <el-button
        class="con absolute top-[17px] right-[100px] p-0 z-[9999]"
        style="color:#E1A857; background: transparent; border: none;"
        link
        @click="showConfig = true"
      >
        抽奖配置
      </el-button>
    </header>
    <div id="main" :class="{ 'blur-[5px]': showRes }" class="relative" style="z-index: 1; width: 100vw; height: 100vh; margin: 0; padding: 0;"></div>
    <div id="tags" style="display: none;">
      <ul v-for="item in datas" :key="item.key">
        <li>
          <a
            href="javascript:void(0);"
            :style="{
              color: '#fff'
            }"
          >
            <img
              v-if="item.key"
              :src="`user/${item.key}.jpg`"
              @error="(e) => { const img = e.target as HTMLImageElement; if (img && img.src !== '/default-avatar.png') img.src = '/default-avatar.png'; }"
              class="object-contain rounded-full"
              :width="50"
              :height="50"
            />
            <span>{{ item.name }}</span>
          </a>
        </li>
      </ul>
    </div>
    <transition name="bounce">
      <div id="resbox" v-show="showRes" class="absolute text-center" style="z-index: 10001; top: 50%; left: 50%; width: 1280px; transform: translate(-50%, -50%);">
        <p @click="showRes = false" class="text-red-500 text-[50px] leading-[120px] font-bold">{{ categoryName }}抽奖结果：</p>
        <div class="container flex justify-center items-center flex-wrap gap-2.5 mx-auto" :style="`width: calc(170px * 5 + 40px);`">
          <div
            v-for="item in resArr"
            :key="item"
            class="itemres bg-white p-2.5 rounded-lg font-bold cursor-pointer flex flex-col items-center justify-center relative gap-2.5"
            :style="resCardStyle"
            :data-id="item"
            @click="showRes = false"
          >
            <img
              v-if="item"
              :src="`user/${item}.jpg`"
              @error="(e) => { const img = e.target as HTMLImageElement; if (img && img.src !== '/default-avatar.png') img.src = '/default-avatar.png'; }"
              class="block object-contain w-[125px] h-[125px]"
              draggable="false"
              @contextmenu.prevent
            />
            <span class="resname text-2xl leading-6 text-[#3d3d3d] text-center">
              {{ store.list.find((d: { key: number; name: string }) => d.key === item)?.name }}
            </span>
          </div>
        </div>
      </div>
    </transition>

    <LotteryConfig v-model:visible="showConfig" @resetconfig="reloadTagCanvas" />
    <Tool
      @toggle="toggle"
      @resetConfig="reloadTagCanvas"
      :running="running"
      :closeRes="closeRes"
      @stop="stop"
    />
    <Result v-model:visible="showResult"></Result>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import LotteryConfig from '@/components/LotteryConfig.vue';
import Tool from '@/components/Tool.vue';
import Result from '@/components/Result.vue';
import {
  getData,
  configField,
  resultField,
  newLotteryField,
  conversionCategoryName,
  listField
} from '@/helper/index';
import { user, luckyExclude } from '@/config/userLoader';
import { lottery, config } from '@/config/lottery';
import { useLotteryStore } from '@/stores/lottery';
import bgImage from '@/assets/bg.jpg';
import type { LotteryForm, NewLotteryItem } from '@/types';
import type { ResultType } from '@/config/lottery';
import type { UserItem } from '@/config/userLoader';
import { FONT_SIZE_CONFIG, TAG_CANVAS_CONFIG } from '@/constants';
import type { LotteryConfigType } from '@/config/lottery';
import { useTagCanvas } from '@/composables/useTagCanvas';
import { useLottery } from '@/composables/useLottery';
import { useAudio } from '@/composables/useAudio';
import { annualRaffleHandler } from '@/helper/algorithm';

const store = useLotteryStore();
const { startTagCanvas, reloadTagCanvas, handleResize, initTagCanvas } = useTagCanvas();
const { running, showRes, resArr, category, toggleDraw, stopDraw, closeResult } = useLottery(luckyExclude);
const { enableAudio } = useAudio();

const showConfig = ref(false);
const showResult = ref(false);

const resCardStyle = computed(() => {
  const style: { fontSize: string } = { fontSize: FONT_SIZE_CONFIG.DEFAULT };
  const number = store.config.number;
  if (number && number < FONT_SIZE_CONFIG.THRESHOLD_100) {
    style.fontSize = FONT_SIZE_CONFIG.SMALL;
  } else if (number && number < FONT_SIZE_CONFIG.THRESHOLD_1000) {
    style.fontSize = FONT_SIZE_CONFIG.MEDIUM;
  } else if (number && number < FONT_SIZE_CONFIG.THRESHOLD_10000) {
    style.fontSize = FONT_SIZE_CONFIG.LARGE;
  }
  return style;
});


const datas = computed(() => {
  if (!store.list || store.list.length === 0) {
    return [];
  }
  
  try {
    // 计算可用的用户数量（排除已中奖和排除名单）
    const wonSet = new Set<number>();
    Object.values(store.result).flat().forEach(key => wonSet.add(key));
    luckyExclude.forEach(item => wonSet.add(item.key));
    
    const availableUsers = store.list
      .map(item => item.key)
      .filter(key => !wonSet.has(key));
    
    // 如果可用用户数量不足，只显示可用用户
    const numToShow = Math.min(availableUsers.length, store.list.length);
    
    if (numToShow === 0) {
      return [];
    }
    
    const randomShowNums = annualRaffleHandler(
      {
        won: [],
        num: numToShow
      },
      {
        result: store.result,
        list: store.list,
        config: store.config
      },
      luckyExclude
    );
    
    const randomShowDatas = randomShowNums.map(item => {
      const listData = store.list.find(d => d.key === item);
      const photo = store.photos.find(d => d.id === item);
      return {
        key: item,
        name: listData ? listData.name : '',
        photo: photo ? photo.value : ''
      };
    });
    return randomShowDatas;
  } catch (error) {
    // 如果抽奖失败，返回空数组，避免阻塞 UI
    console.warn('生成标签数据失败:', error);
    return [];
  }
});

const categoryName = computed(() => {
  return conversionCategoryName(category.value);
});

watch(
  () => store.photos,
  () => {
    nextTick(() => {
      reloadTagCanvas();
    });
  },
  { deep: true }
);

// 监听数据变化，当数据加载完成后初始化 TagCanvas
watch(
  () => [store.list.length, datas.value.length],
  ([listLength, datasLength]) => {
    if (listLength > 0 && datasLength > 0) {
      nextTick(() => {
        const canvas = document.querySelector(`#${TAG_CANVAS_CONFIG.CANVAS_ID}`);
        if (!canvas) {
          startTagCanvas();
        } else {
          reloadTagCanvas();
        }
      });
    }
  },
  { immediate: false }
);

onMounted(() => {
  // 初始化数据
  try {
    const configData = getData(configField);
    
    if (configData && typeof configData === 'object' && !Array.isArray(configData) && configData !== null) {
      const migratedConfig = configData as LotteryConfigType & { name?: string; number?: number };
      if (Object.keys(migratedConfig).length > 0) {
        store.setConfig(migratedConfig);
      } else {
        store.setConfig(config);
      }
    } else {
      store.setConfig(config);
    }

    const result = getData(resultField);
    if (result) {
      store.setResult(result as ResultType);
    }

    const newLottery = getData(newLotteryField) as NewLotteryItem[] | null;
    if (newLottery && Array.isArray(newLottery)) {
      const currentConfig = { ...store.config };
      newLottery.forEach((item: NewLotteryItem) => {
        store.setNewLottery(item);
        // 确保新奖项有配置
        if (!currentConfig[item.key]) {
          currentConfig[item.key] = { count: 0 };
        }
      });
      store.setConfig(currentConfig);
    } else {
      const currentConfig = { ...store.config };
      lottery.forEach(item => {
        store.setNewLottery(item);
        // 确保有配置
        if (!currentConfig[item.key]) {
          currentConfig[item.key] = { count: 0 };
        }
      });
      store.setConfig(currentConfig);
    }

    const list = getData(listField);
    if (list) {
      store.setList(list as UserItem[]);
    } else {
      store.setList(user);
    }
  } catch (error) {
    console.error('数据初始化失败:', error);
    // 使用默认数据
    store.setConfig(config);
    store.setList(user);
  }

  // 确保 DOM 完全加载后再初始化 TagCanvas
  nextTick(() => {
    initTagCanvas(() => store.list.length > 0 && datas.value.length > 0);
  });
  window.addEventListener('resize', handleResize);

  // 添加首次点击事件监听器，用于启用音频（处理浏览器自动播放策略）
  const handleFirstClick = () => {
    enableAudio();
    document.removeEventListener('click', handleFirstClick);
    document.removeEventListener('touchstart', handleFirstClick);
  };
  document.addEventListener('click', handleFirstClick, { once: true });
  document.addEventListener('touchstart', handleFirstClick, { once: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

const toggle = (form: LotteryForm) => {
  const success = toggleDraw(form);
  if (!success && !running.value) {
    // 如果抽奖失败，显示错误提示
    ElMessage.error('抽奖失败，请检查可抽奖人数是否充足');
  }
};

const stop = () => {
  stopDraw();
};

const closeRes = () => {
  closeResult();
};
</script>

<style scoped>
.bounce-enter-active {
  animation: bounce-in 1.5s;
}
.bounce-leave-active {
  animation: bounce-in 0s reverse;
}

@keyframes bounce-in {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.05);
    opacity: 1;
  }
  70% {
    transform: translate(-50%, -50%) scale(0.9);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

:deep(.el-select-dropdown) {
  background-color: #5b1411 !important;
}
:deep(.el-select-dropdown__item) {
  color: #ccc !important;
}
:deep(.el-select-dropdown__item.selected) {
  color: #ebc68b !important;
}
:deep(.el-select-dropdown__item.hover),
:deep(.el-select-dropdown__item:hover) {
  background-color: #8f2925 !important;
}

#resbox img {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
}

#resbox .itemres {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}
</style>
