<template>
  <!-- 路由出口：/ → 抽奖舞台，/people → 人员管理，/settings → 设置 -->
  <router-view v-slot="{ Component }">
    <component :is="Component" />
  </router-view>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';
import { ElNotification } from 'element-plus';
import { defaultAvatarUrl } from '@/utils/avatar';
import { useLotteryStore } from '@/stores/lottery';
import { migrateSchema } from '@/storage/migrate';
import { loadRoster, saveRoster } from '@/storage/roster';
import { loadPrizes, loadPrizeTombstones } from '@/storage/prizes';
import { loadResultMeta } from '@/storage/result';
import { initPlatform, isTauri } from '@/platform';
import { runDesktopSelfCheck } from '@/platform/selfcheck';
import {
  getData,
  configField,
  resultField,
  excludeWinnersField,
} from '@/helper/index';
import { config } from '@/config/lottery';
import type { LotteryConfigType, ResultType } from '@/config/lottery';

const store = useLotteryStore();

// TagCanvas 通过 window 全局变量取默认头像，在应用挂载时一次性注入
window.__defaultAvatarUrl = defaultAvatarUrl;

/**
 * 应用级数据初始化。
 *
 * 必须放在外壳而不是各个视图里：用户可以直接从「人员管理」进入应用，
 * 若初始化挂在抽奖页，直接访问 #/people 时 store 会是空的——
 * 表现为「导入成功、刷新全没」。
 */
onMounted(async () => {
  // 先确认原生环境可用（桌面端取一次应用数据目录）
  const appDir = await initPlatform();
  if (isTauri() && !appDir) {
    ElNotification({
      title: '原生环境异常',
      type: 'error',
      duration: 0,
      message:
        '无法访问应用数据目录，导入照片与自定义背景将不可用。请重启应用；仍失败请重新安装。',
    });
  }

  // 开发模式下跑一遍桌面端全链路自检：
  // 造图 → 校验 → 压缩 → 写 app data → 资产协议读回 → 枚举/清理 → 背景写入 → 快照。
  // 这些路径只有 Tauri 下才存在，而原生窗口无法自动点击，
  // 跑完把结果写到 app data/selfcheck.json，终端可直接读。
  // import.meta.env.DEV 在生产构建中被静态消除，不产生运行时开销。
  if (import.meta.env.DEV) {
    void runDesktopSelfCheck();
  }

  // schema 迁移（v1 → v2）
  const report = migrateSchema();
  if (report.migrated && report.warnings.length > 0) {
    ElNotification({
      title: '数据已升级',
      type: 'warning',
      duration: 0,
      message: report.warnings.join(' '),
    });
  }

  try {
    const configData = getData(configField);
    if (
      configData &&
      typeof configData === 'object' &&
      !Array.isArray(configData) &&
      configData !== null
    ) {
      const migrated = configData as LotteryConfigType & {
        name?: string;
        number?: number;
      };
      store.setConfig(
        Object.keys(migrated).length > 0
          ? migrated
          : (config as LotteryConfigType),
      );
    } else {
      store.setConfig(config);
    }

    const storedResult = getData(resultField);
    if (storedResult) {
      store.setResult(storedResult as ResultType);
    }

    store.setResultMeta(loadResultMeta());
    store.setPrizes(loadPrizes());
    store.setPrizeTombstones(loadPrizeTombstones());

    // 确保每个奖项都有配置项（新增奖项或历史数据缺项时的兜底）
    const currentConfig = { ...store.config };
    store.prizes.forEach((prize) => {
      if (!currentConfig[prize.key]) {
        currentConfig[prize.key] = { count: 0 };
      }
    });
    store.setConfig(currentConfig);

    store.setList(loadRoster());

    const savedExcludeWinners = getData(excludeWinnersField);
    if (typeof savedExcludeWinners === 'boolean') {
      store.setExcludeWinners(savedExcludeWinners);
    }
  } catch (error) {
    console.error('数据初始化失败:', error);
    store.setConfig(config);
    store.setList(loadRoster());
  }
});

onBeforeUnmount(() => {
  // 外壳通常不会卸载，这里只做兜底：确保数据已落盘
  try {
    saveRoster(store.list);
  } catch {
    /* 落盘失败不阻断卸载 */
  }
});
</script>
