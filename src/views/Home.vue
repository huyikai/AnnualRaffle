<template>
  <div
    id="root"
    class="relative"
    :class="{ 'is-presenting': presenting }"
    :style="{
      backgroundColor: 'var(--ar-stage-bg)',
      backgroundImage: backgroundImageCss,
      backgroundSize: backgroundSizeCss,
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
    }"
  >
    <header v-show="!presenting" class="h-[50px] leading-[50px] relative">
      <el-button
        class="res absolute top-[17px] right-5 p-0"
        style="
          color: var(--ar-accent);
          background: transparent;
          border: none;
          z-index: var(--ar-z-header);
        "
        link
        @click="showResult = true"
      >
        抽奖结果
      </el-button>
      <el-button
        class="con absolute top-[17px] right-[100px] p-0"
        style="
          color: var(--ar-accent);
          background: transparent;
          border: none;
          z-index: var(--ar-z-header);
        "
        link
        @click="showConfig = true"
      >
        抽奖配置
      </el-button>
      <el-button
        class="people-entry absolute top-[17px] right-[160px] p-0"
        style="
          color: var(--ar-accent);
          background: transparent;
          border: none;
          z-index: var(--ar-z-header);
        "
        link
        @click="router.push('/people')"
      >
        人员管理
      </el-button>
      <el-button
        class="settings-entry absolute top-[17px] right-[220px] p-0"
        style="
          color: var(--ar-accent);
          background: transparent;
          border: none;
          z-index: var(--ar-z-header);
        "
        link
        @click="router.push('/settings')"
      >
        设置
      </el-button>
      <el-button
        class="present-entry absolute top-[17px] right-[265px] p-0"
        style="
          color: var(--ar-accent);
          background: transparent;
          border: none;
          z-index: var(--ar-z-header);
        "
        link
        @click="enterPresentation"
      >
        演示模式
      </el-button>
    </header>

    <!-- 空状态引导：名单为空时给出明确的下一步（决策 16） -->
    <div v-if="store.list.length === 0" class="stage-empty">
      <p class="stage-empty-title">还没有人员名单</p>
      <p class="stage-empty-desc">
        抽奖需要一份参与名单。前往「人员管理」从 CSV 导入，或直接新增人员。
        <br />
        若从 Excel 导出，请先「另存为 CSV」。
      </p>
      <el-button type="primary" @click="router.push('/people')"
        >去导入名单</el-button
      >
    </div>

    <div
      id="main"
      :class="{ 'blur-[5px]': showRes }"
      class="relative"
      style="z-index: 1; width: 100vw; height: 100vh; margin: 0; padding: 0"
    ></div>
    <div id="tags" style="display: none">
      <ul v-for="item in datas" :key="item.key">
        <li>
          <a
            href="javascript:void(0);"
            :style="{
              color: '#fff',
            }"
          >
            <img
              v-if="item.key"
              :src="getUserAvatarUrl(item.key)"
              @error="handleAvatarError"
              class="object-contain rounded-full"
              :width="58"
              :height="76"
            />
            <span>{{ item.name }}</span>
          </a>
        </li>
      </ul>
    </div>
    <transition name="bounce">
      <div
        id="resbox"
        v-show="showRes"
        class="absolute text-center"
        style="
          z-index: var(--ar-z-dialog);
          top: 50%;
          left: 50%;
          width: min(1280px, 92vw);
          transform: translate(-50%, -50%);
        "
      >
        <p
          @click="showRes = false"
          class="text-red-500 text-[50px] leading-[120px] font-bold"
        >
          {{ categoryName }}抽奖结果：
        </p>
        <div
          class="container flex justify-center items-center flex-wrap gap-2.5 mx-auto"
          :style="`width: calc(170px * 5 + 40px);`"
        >
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
              :src="getUserAvatarUrl(item)"
              @error="handleAvatarError"
              class="block object-contain w-[125px] h-[125px]"
              draggable="false"
              @contextmenu.prevent
            />
            <span class="resname text-2xl leading-6 text-[#3d3d3d] text-center">
              {{ winnerName(item) }}
            </span>
          </div>
        </div>
      </div>
    </transition>

    <LotteryConfig
      v-model:visible="showConfig"
      @resetconfig="reloadTagCanvas"
    />
    <Tool
      :class="{ 'is-hidden-in-present': presenting }"
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
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from 'vue';
import { ElNotification } from 'element-plus';
import LotteryConfig from '@/components/LotteryConfig.vue';
import Tool from '@/components/Tool.vue';
import Result from '@/components/Result.vue';
import { useLotteryStore } from '@/stores/lottery';
import { conversionCategoryName } from '@/helper/index';
import { useAppearance } from '@/composables/useAppearance';
import type { LotteryForm } from '@/types';
import { FONT_SIZE_CONFIG, TAG_CANVAS_CONFIG } from '@/constants';
import { useTagCanvas } from '@/composables/useTagCanvas';
import { useLottery } from '@/composables/useLottery';
import { useAudio } from '@/composables/useAudio';
import { annualRaffleHandler } from '@/helper/algorithm';
import {
  defaultAvatarUrl,
  getUserAvatarUrl,
  handleAvatarError,
} from '@/utils/avatar';
import { useRouter } from 'vue-router';

const store = useLotteryStore();
const router = useRouter();
const { startTagCanvas, reloadTagCanvas, handleResize, initTagCanvas } =
  useTagCanvas();
const {
  running,
  showRes,
  resArr,
  category,
  toggleDraw,
  stopDraw,
  closeResult,
} = useLottery();
const { enableAudio } = useAudio();
const { backgroundImageCss, backgroundSizeCss } = useAppearance();

// 设置全局变量，供 TagCanvas 使用（应用外壳已注入默认值，这里保留兼容）
window.__defaultAvatarUrl = defaultAvatarUrl;

const showConfig = ref(false);
const showResult = ref(false);

/**
 * 结果卡字号：视口与人数双因子，取较小值。
 *
 * 旧版只按人数分档，在 4K 投影上字会小到看不清；
 * 只按视口又会在 50 人时挤成一团。两个约束取 min 才在两种极端下都成立。
 */
const resCardStyle = computed(() => {
  const number = store.config.number ?? 0;
  const headCount = FONT_SIZE_CONFIG.XTRA_LARGE_POOL;
  const midCount = FONT_SIZE_CONFIG.MEDIUM_POOL;

  // 显式标注 number：常量用了 as const，不标注会推断成字面量类型 100
  let cap: number = FONT_SIZE_CONFIG.XTRA_LARGE;
  if (number > midCount) cap = FONT_SIZE_CONFIG.MEDIUM;
  else if (number > headCount) cap = FONT_SIZE_CONFIG.LARGE;

  // 视口给出的上限（1280px 视口 → 48px，1920 → 72px，2560 → 96px）
  const viewportCap =
    FONT_SIZE_CONFIG.VIEWPORT_BASE * (window.innerWidth / 1280);
  const fontSize = Math.min(
    cap,
    Math.max(FONT_SIZE_CONFIG.MIN_PX, viewportCap),
  );

  return { fontSize: `${Math.round(fontSize)}px` };
});

// ========== 演示模式 ==========

/**
 * 全屏演示模式：隐藏所有设置入口与工具条，只留标签云和抽奖按钮。
 *
 * 投屏时右上角的「人员管理 / 设置 / 抽奖配置」全暴露在观众视野里，
 * 误触的风险比想象中大——尤其是「重置」按钮就在右下角常驻。
 */
const presenting = ref(false);

const enterPresentation = () => {
  presenting.value = true;
  document.documentElement.requestFullscreen?.().catch(() => {
    // 浏览器可能拒绝全屏（如需用户手势），静默降级为仅隐藏界面
  });
};

const exitPresentation = () => {
  presenting.value = false;
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  }
};

const togglePresentation = () => {
  if (presenting.value) exitPresentation();
  else enterPresentation();
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'F11') {
    event.preventDefault();
    togglePresentation();
  } else if (event.key === 'Escape' && presenting.value) {
    exitPresentation();
  }
};

/** 中奖人姓名：名册优先，查不到时回退到中奖快照，保证结果页不出现空白 */
const winnerName = (key: string): string => {
  const person = store.list.find((item) => item.key === key);
  if (person) return person.name;
  return store.resultMeta[category.value]?.[key]?.name ?? `工号 ${key}`;
};

const datas = computed(() => {
  if (!store.list || store.list.length === 0) {
    return [];
  }

  try {
    const wonSet = new Set<string>();
    store.excludedUsers.forEach((item) => wonSet.add(item.key));

    // TagCanvas 球体跟随全局排除设置
    if (store.excludeWinners) {
      Object.values(store.result)
        .flat()
        .forEach((key) => wonSet.add(key));
    }

    const availableUsers = store.list
      .map((item) => item.key)
      .filter((key) => !wonSet.has(key));

    const numToShow = Math.min(availableUsers.length, store.list.length);

    if (numToShow === 0) {
      return [];
    }

    const randomShowNums = annualRaffleHandler(
      {
        won: [],
        num: numToShow,
        excludeWinners: store.excludeWinners,
      },
      {
        result: store.result,
        list: store.list,
        config: store.config,
      },
      store.excludedUsers,
    );

    const randomShowDatas = randomShowNums.map((item) => {
      const listData = store.list.find((d) => d.key === item);
      return {
        key: item,
        name: listData ? listData.name : '',
      };
    });
    return randomShowDatas;
  } catch (error) {
    console.warn('生成标签数据失败:', error);
    return [];
  }
});

const categoryName = computed(() => {
  return conversionCategoryName(category.value);
});

// 监听数据变化，当数据加载完成后初始化 TagCanvas
watch(
  () => [store.list.length, datas.value.length],
  ([listLength, datasLength]) => {
    if (listLength > 0 && datasLength > 0) {
      nextTick(() => {
        const canvas = document.querySelector(
          `#${TAG_CANVAS_CONFIG.CANVAS_ID}`,
        );
        if (!canvas) {
          startTagCanvas();
        } else {
          reloadTagCanvas();
        }
      });
    }
  },
  { immediate: false },
);

onMounted(() => {
  // 数据初始化（迁移、加载名册与配置）已上移到应用外壳 App.vue：
  // 直接从「人员管理」进入时抽奖页不会挂载，初始化放在这里会导致名册加载不到。
  // 本视图只负责视图级的事——标签云、窗口缩放、音频解锁。
  // 确保 DOM 完全加载后再初始化 TagCanvas
  nextTick(() => {
    initTagCanvas(() => store.list.length > 0 && datas.value.length > 0);
  });
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', onKeydown);

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
  window.removeEventListener('keydown', onKeydown);
});

const toggle = (form: LotteryForm) => {
  const success = toggleDraw(form);
  if (!success && !running.value) {
    // 如果抽奖失败，显示错误提示
    ElNotification.error('抽奖失败，请检查可抽奖人数是否充足');
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

/* 注：原先此处有 4 条 `:deep(.el-select-dropdown) { ... !important }` 覆写，
   意图把下拉面板染成舞台的深红金。但 el-select 的 popper 会被 teleport 到 body，
   脱离了带 scoped 属性的组件树，`:deep()` 匹配不到——这段样式一直是死代码。
   现在改由 design/tokens.css 里针对 popper-class 的全局规则接管，且只作用于
   舞台上的下拉（.tool-select-dropdown / .exclude-mode-popper / .ar-select-on-stage），
   管理弹窗内的下拉保持浅色，符合双表面主题锁。 */

#resbox img {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-user-drag: none;
  -khtml-user-drag: none;
}

#resbox .itemres {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}

/* 演示模式：隐藏一切操作入口，只留舞台。
   投屏时「重置」按钮常驻右下角，误触的代价是整场活动数据清空。 */
.is-presenting {
  cursor: none;
}

.is-hidden-in-present {
  display: none;
}

/* 空状态引导 */
.stage-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: var(--ar-z-dialog);
  text-align: center;
  padding: 28px 36px;
  border-radius: var(--ar-radius-lg);
  background: var(--ar-stage-overlay);
  max-width: 520px;
}

.stage-empty-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--ar-on-stage);
  margin: 0 0 10px;
}

.stage-empty-desc {
  font-size: 13px;
  line-height: 1.8;
  color: var(--ar-on-stage-muted);
  margin: 0 0 18px;
}
</style>
