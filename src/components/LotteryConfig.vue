<template>
  <el-dialog
    v-model="dialogVisible"
    :append-to-body="true"
    width="390px"
    class="c-LotteryConfig"
  >
    <template #header>
      <div class="c-LotteryConfigtitle">
        <span class="text-xl font-bold">抽奖配置</span>
      </div>
    </template>
    <div class="container h-full overflow-y-auto px-2.5">
      <!-- 音频设置卡片 -->
      <div class="audio-settings-card">
        <div class="audio-settings-header">
          <span class="audio-settings-title">音频设置</span>
        </div>
        <div class="audio-settings-content">
          <el-button size="small" @click="handleToggleMute" class="mute-button">
            {{ isMuted ? '取消静音' : '静音' }}
          </el-button>
          <div class="volume-control">
            <span class="volume-label">音量：</span>
            <el-slider
              :model-value="volume"
              :min="0"
              :max="100"
              :show-tooltip="true"
              :format-tooltip="(val: number) => `${val}%`"
              class="volume-slider"
              @input="handleVolumeChange"
            />
          </div>
        </div>
      </div>

      <!-- 抽奖设置卡片 -->
      <div class="lottery-settings-card">
        <div class="lottery-settings-header">
          <span class="lottery-settings-title">抽奖设置</span>
        </div>
        <div class="lottery-settings-content">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-sm">排除已中奖人员</span>
              <div class="text-gray-400 text-xs mt-0.5">
                开启后，已中奖人员默认不参与后续抽奖
              </div>
            </div>
            <el-switch
              :model-value="store.excludeWinners"
              @change="(val: boolean) => store.setExcludeWinners(val)"
            />
          </div>
        </div>
      </div>

      <!-- 奖项配置 -->
      <el-form ref="formRef" :model="form" size="small" class="lottery-form">
        <div v-for="newitem in prizes" :key="newitem.key" class="category-card">
          <div class="category-card-header">
            <span>{{ newitem.name }}</span>
            <span class="category-card-actions">
              <el-button
                link
                class="prize-action"
                @click="openRenamePrize(newitem.key)"
                >改名</el-button
              >
              <el-button
                link
                class="prize-action"
                @click="handleDeletePrize(newitem.key)"
                >删除</el-button
              >
            </span>
          </div>
          <div class="category-card-body">
            <el-form-item label="数量">
              <el-input
                type="number"
                :min="0"
                :step="1"
                v-model.number="getItemConfig(newitem.key).count"
                placeholder="请输入数量"
              ></el-input>
            </el-form-item>
            <el-form-item label="排除模式" class="exclude-item">
              <div class="exclude-settings">
                <el-select
                  :model-value="
                    getItemConfig(newitem.key).excludeMode || 'global'
                  "
                  @change="
                    (val: string) =>
                      handleExcludeModeChange(
                        newitem.key,
                        val as 'global' | 'custom',
                      )
                  "
                  size="small"
                  class="exclude-mode-select"
                  popper-class="exclude-mode-popper"
                >
                  <el-option label="跟随全局" value="global" />
                  <el-option label="自定义" value="custom" />
                </el-select>
                <template
                  v-if="getItemConfig(newitem.key).excludeMode === 'custom'"
                >
                  <div class="custom-exclude-options">
                    <div class="flex items-center gap-2">
                      <el-checkbox
                        :model-value="
                          getItemConfig(newitem.key).excludeWinners !== false
                        "
                        @change="
                          (val: boolean) =>
                            handleCategoryExcludeWinnersChange(newitem.key, val)
                        "
                        >排除已中奖人员</el-checkbox
                      >
                    </div>
                    <div class="flex items-center gap-2">
                      <el-button
                        size="small"
                        @click="openExcludedPersonsSelect(newitem.key)"
                      >
                        排除指定人员
                      </el-button>
                      <span
                        v-if="getExcludedPersonIds(newitem.key).length"
                        class="text-gray-500 text-xs"
                      >
                        已选 {{ getExcludedPersonIds(newitem.key).length }} 人
                      </span>
                      <span v-else class="text-gray-400 text-xs">未选择</span>
                    </div>
                  </div>
                </template>
              </div>
            </el-form-item>
            <el-form-item label="预设名单" class="preset-item">
              <div class="flex items-center gap-2">
                <el-switch
                  v-model="presetEnabled[newitem.key]"
                  @change="handlePresetToggle(newitem.key)"
                />
                <template v-if="presetEnabled[newitem.key]">
                  <el-button
                    size="small"
                    @click="openPresetSelect(newitem.key)"
                  >
                    选择预设名单
                  </el-button>
                  <span
                    v-if="getPresetIds(newitem.key).length"
                    class="text-gray-500 text-xs"
                  >
                    已选 {{ getPresetIds(newitem.key).length }} 人
                  </span>
                </template>
                <span v-else class="text-gray-400 text-xs">未启用</span>
              </div>
            </el-form-item>
          </div>
        </div>
      </el-form>

      <!-- 操作按钮区域 -->
      <div class="action-buttons">
        <el-button size="small" @click="openAddPrize">增加奖项</el-button>
        <el-button
          v-if="missingBuiltin.length"
          size="small"
          text
          @click="handleRestoreBuiltin"
        >
          恢复内置奖项
        </el-button>
        <el-button size="small" type="primary" @click="onSubmit"
          >完成</el-button
        >
      </div>
    </div>

    <PresetSelectDialog
      :key="editingPresetCategory ?? 'closed'"
      v-model:visible="presetSelectVisible"
      v-model:model-value="selectedPresetIds"
      :category-key="editingPresetCategory ?? ''"
      :user-list="store.list"
      :disabled-reasons="presetDisabledReasons"
    />

    <PresetSelectDialog
      :key="'exclude-' + (editingExcludeCategory ?? 'closed')"
      v-model:visible="excludePersonsSelectVisible"
      v-model:model-value="selectedExcludedPersonIds"
      category-key=""
      :user-list="store.list"
      title="选择排除人员"
    />

    <!-- 新增 / 改名奖项 -->
    <el-dialog
      v-model="showEditPrize"
      :append-to-body="true"
      width="300px"
      class="dialog-showEditPrize"
    >
      <template #header>
        <div class="add-title">
          {{ editingPrizeKey ? '修改奖项名称' : '增加奖项' }}
        </div>
      </template>
      <el-form ref="editPrizeRef" :model="prizeForm" size="small">
        <el-form-item label="奖项名称">
          <el-input v-model="prizeForm.name"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submitPrize">确定</el-button>
          <el-button @click="showEditPrize = false">取消</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { setData, configField } from '@/helper/index';
import { useLotteryStore } from '@/stores/lottery';
import { useAudio } from '@/composables/useAudio';
import type { LotteryItemConfig } from '@/config/lottery';
import {
  getLotteryPreset,
  getLotteryExcludedPersons,
  getPresetDisabledReasons,
  getPresetIssues,
  LOTTERY_ITEMS,
} from '@/config/lottery';
import {
  randomPrizeKey,
  affectedByPrize,
  addPrizeTo,
  stripOrphaned,
} from '@/data/prizes';
import PresetSelectDialog from './PresetSelectDialog.vue';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
  resetconfig: [];
}>();

const store = useLotteryStore();
const { isMuted, volume, audioEnabled, enableAudio, toggleMute, setVolume } =
  useAudio();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const form = computed(() => store.config);
const prizes = computed(() => store.prizes);

// 预设名单启用状态
const presetEnabled = reactive<Record<string, boolean>>({});

// 获取配置项，确保返回对象格式
const getItemConfig = (key: string): LotteryItemConfig => {
  const value = form.value[key];
  if (value && typeof value === 'object') {
    return value as LotteryItemConfig;
  }
  // 默认值
  form.value[key] = { count: 0 };
  return form.value[key] as LotteryItemConfig;
};

// 初始化预设名单启用状态（preset 存在即视为启用，含空数组）
watch(
  () => [store.prizes, form.value],
  () => {
    store.prizes.forEach((item) => {
      const config = getItemConfig(item.key);
      presetEnabled[item.key] = 'preset' in config;
      // 确保配置项格式正确
      getItemConfig(item.key);
    });
  },
  { immediate: true, deep: true },
);

// 监听 form 变更（含 count），即时持久化
watch(
  () => form.value,
  (val) => setData(configField, val),
  { deep: true },
);

const handlePresetToggle = (key: string) => {
  const config = getItemConfig(key);
  if (!presetEnabled[key]) {
    // 禁用预设名单
    delete config.preset;
  } else {
    // 启用预设名单，初始化为空数组
    if (!config.preset) {
      config.preset = [];
    }
  }
  setData(configField, form.value);
};

// ===== 排除模式相关 =====

const handleExcludeModeChange = (key: string, mode: 'global' | 'custom') => {
  const config = getItemConfig(key);
  config.excludeMode = mode;
  if (mode === 'custom' && config.excludeWinners === undefined) {
    config.excludeWinners = true;
  }
  if (mode === 'global') {
    delete config.excludeWinners;
    delete config.excludedPersons;
    delete config.excludeMode;
  }
  setData(configField, form.value);
};

const handleCategoryExcludeWinnersChange = (key: string, val: boolean) => {
  const config = getItemConfig(key);
  config.excludeWinners = val;
  setData(configField, form.value);
};

const getExcludedPersonIds = (key: string): string[] => {
  return getLotteryExcludedPersons(form.value, key);
};

// 排除人员选择弹窗
const excludePersonsSelectVisible = ref(false);
const editingExcludeCategory = ref<string | null>(null);
const excludeByCategory = reactive<Record<string, string[]>>({});

const selectedExcludedPersonIds = computed({
  get: () => {
    const key = editingExcludeCategory.value;
    return key ? (excludeByCategory[key] ?? getExcludedPersonIds(key)) : [];
  },
  set: (val: string[]) => {
    const key = editingExcludeCategory.value;
    if (key) {
      excludeByCategory[key] = [...val];
      const config = getItemConfig(key);
      config.excludedPersons = [...val];
      setData(configField, form.value);
    }
  },
});

const openExcludedPersonsSelect = (categoryKey: string) => {
  editingExcludeCategory.value = categoryKey;
  excludeByCategory[categoryKey] = getExcludedPersonIds(categoryKey);
  excludePersonsSelectVisible.value = true;
};

watch(excludePersonsSelectVisible, (visible) => {
  if (!visible) {
    editingExcludeCategory.value = null;
  }
});

// ===== 奖项增删改 =====

const showEditPrize = ref(false);
const editingPrizeKey = ref<string | null>(null);
const prizeForm = reactive({ name: '' });

/** 内置奖项是否被删除过（用于显示恢复入口） */
const missingBuiltin = computed(() => {
  const existing = new Set(prizes.value.map((p) => p.key));
  return LOTTERY_ITEMS.filter((item) => !existing.has(item.key));
});

const openAddPrize = () => {
  editingPrizeKey.value = null;
  prizeForm.name = '';
  showEditPrize.value = true;
};

const openRenamePrize = (prizeKey: string) => {
  editingPrizeKey.value = prizeKey;
  prizeForm.name = prizes.value.find((p) => p.key === prizeKey)?.name ?? '';
  showEditPrize.value = true;
};

/**
 * 提交新增 / 改名。
 *
 * 对策二：新增奖项时，主动告知有多少人因参与限制无法参加这个新奖项，
 * 默认提供「一并加入」。多数场景下新奖项的本意就是全员参与。
 */
const submitPrize = () => {
  const name = prizeForm.name.trim();
  if (!name) {
    ElMessage.warning('请输入奖项名称');
    return;
  }

  if (editingPrizeKey.value) {
    // 改名：key 不变，人员的参与限制自动跟随
    store.renamePrizeByKey(editingPrizeKey.value, name);
    showEditPrize.value = false;
    emit('resetconfig');
    return;
  }

  const newKey = randomPrizeKey();
  const added = store.addPrize({ key: newKey, name, builtin: false });
  if (!added) {
    ElMessage.warning('已存在同名奖项');
    return;
  }
  // 新奖项默认配置项
  form.value[newKey] = { count: 0 };
  presetEnabled[newKey] = false;
  setData(configField, form.value);
  showEditPrize.value = false;

  // 对策二：提示受参与限制影响的人员
  const affected = affectedByPrize(store.list, newKey);
  if (affected.length > 0) {
    const preview = affected
      .slice(0, 8)
      .map((p) => p.name)
      .join('、');
    const more =
      affected.length > 8
        ? ` 等 ${affected.length} 人`
        : `（共 ${affected.length} 人）`;
    ElMessageBox.confirm(
      `新增奖项「${name}」，有 ${affected.length} 人设置了参与限制、无法参加本奖项：${preview}${more}。是否一并加入？`,
      '参与限制提示',
      {
        confirmButtonText: '一并加入',
        cancelButtonText: '保持不变',
        type: 'warning',
      },
    )
      .then(() => {
        store.setList(addPrizeTo(store.list, newKey, affected));
        ElMessage.success(`已为 ${affected.length} 人加入本奖项`);
        emit('resetconfig');
      })
      .catch(() => {
        emit('resetconfig');
      });
  } else {
    emit('resetconfig');
  }
};

/**
 * 删除奖项。
 *
 * 对策三：删除前预告有多少人的参与限制会失效，并提供名单预览。
 * 内置奖项删除后可一键恢复。
 */
const handleDeletePrize = (prizeKey: string) => {
  const prize = prizes.value.find((p) => p.key === prizeKey);
  if (!prize) return;

  const affected = affectedByPrize(store.list, prizeKey);
  const detail =
    affected.length > 0
      ? `\n\n有 ${affected.length} 人的参与限制包含本奖项，删除后该限制失效：\n` +
        affected
          .slice(0, 10)
          .map((p) => `${p.name}（${p.key}）`)
          .join('\n') +
        (affected.length > 10 ? `\n…共 ${affected.length} 人` : '')
      : '';

  ElMessageBox.confirm(
    `确定删除奖项「${prize.name}」？已抽出的中奖记录会保留。${detail}`,
    '删除奖项',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'prize-delete-confirm',
    },
  )
    .then(() => {
      store.deletePrize(prizeKey);
      // 清理配置项，避免残留的 count 影响「恢复内置奖项」
      delete form.value[prizeKey];
      delete presetEnabled[prizeKey];
      setData(configField, form.value);

      // 对策一：清理名册里指向已删除奖项的悬空限制
      const cleaned = stripOrphaned(store.list, store.prizes);
      if (
        cleaned.length !== store.list.length ||
        cleaned.some((p, i) => p !== store.list[i])
      ) {
        store.setList(cleaned);
      }

      if (affected.length > 0) {
        ElMessage.success(`已删除，${affected.length} 人的参与限制同步清理`);
      } else {
        ElMessage.success('已删除');
      }
      emit('resetconfig');
    })
    .catch(() => {
      /* 用户取消 */
    });
};

const handleRestoreBuiltin = () => {
  const count = store.restoreBuiltinPrizes();
  // 恢复后补齐配置项
  const currentConfig = { ...store.config };
  LOTTERY_ITEMS.forEach((item) => {
    if (!currentConfig[item.key]) {
      currentConfig[item.key] = { count: item.defaultCount };
    }
  });
  store.setConfig(currentConfig);
  ElMessage.success(`已恢复 ${count} 个内置奖项`);
  emit('resetconfig');
};

// ===== 预设名单 =====

const presetSelectVisible = ref(false);
const editingPresetCategory = ref<string | null>(null);
const presetByCategory = reactive<Record<string, string[]>>({});

const getPresetIds = (key: string): string[] => {
  return getLotteryPreset(form.value, key) ?? [];
};

const selectedPresetIds = computed({
  get: () => {
    const key = editingPresetCategory.value;
    return key ? (presetByCategory[key] ?? getPresetIds(key)) : [];
  },
  set: (val: string[]) => {
    const key = editingPresetCategory.value;
    if (key) {
      presetByCategory[key] = [...val];
      const config = getItemConfig(key);
      config.preset = [...val];
      // 实时持久化到 localStorage，避免刷新丢失
      setData(configField, form.value);
    }
  },
});

// 预设弹窗禁选原因：与抽奖排除规则一致，由 lottery.ts 统一计算
const presetDisabledReasons = computed<Record<string, string>>(() => {
  const key = editingPresetCategory.value;
  if (!key) return {};
  return getPresetDisabledReasons({
    config: form.value,
    categoryKey: key,
    globalExcludeWinners: store.excludeWinners,
    result: store.result,
    // 排除名单现从名册派生
    excludedUsers: store.excludedUsers,
    list: store.list,
  });
});

const openPresetSelect = (categoryKey: string) => {
  editingPresetCategory.value = categoryKey;

  // 自动清理已保存但现已无法中奖的预设成员（与抽奖排除规则一致），
  // 避免 el-transfer 中 disabled 项被卡在右侧无法移除
  const currentIds = [...new Set(getPresetIds(categoryKey))];
  const issues = getPresetIssues({
    config: form.value,
    categoryKey,
    globalExcludeWinners: store.excludeWinners,
    result: store.result,
    excludedUsers: store.excludedUsers,
    list: store.list,
  });
  const issueByKey = new Map(issues.map((issue) => [issue.key, issue]));
  const keptIds = currentIds.filter((id) => !issueByKey.has(id));

  if (keptIds.length !== currentIds.length) {
    const removedDetail = currentIds
      .filter((id) => issueByKey.has(id))
      .map((id) => {
        const issue = issueByKey.get(id)!;
        const name = store.list.find((u) => u.key === id)?.name;
        return name
          ? `${name}（${issue.reason}）`
          : `工号 ${id}（${issue.reason}）`;
      })
      .join('、');
    ElMessage.warning(`已从预设名单移除无法中奖的人员：${removedDetail}`);
    getItemConfig(categoryKey).preset = keptIds;
    setData(configField, form.value);
  }

  presetByCategory[categoryKey] = keptIds;
  presetSelectVisible.value = true;
};

// 弹窗关闭时清理编辑状态
watch(presetSelectVisible, (visible) => {
  if (!visible) {
    editingPresetCategory.value = null;
  }
});

const formRef = ref();
const editPrizeRef = ref();

const onSubmit = () => {
  // 清理未启用的预设名单
  store.prizes.forEach((item) => {
    const config = getItemConfig(item.key);
    if (
      !presetEnabled[item.key] &&
      Array.isArray(config.preset) &&
      config.preset.length === 0
    ) {
      delete config.preset;
    }
  });

  setData(configField, form.value);
  store.setConfig(form.value);
  dialogVisible.value = false;
  emit('resetconfig');
};

const handleToggleMute = () => {
  // 启用音频（如果尚未启用）
  if (!audioEnabled.value) {
    enableAudio();
  }
  toggleMute();
};

const handleVolumeChange = (val: number) => {
  setVolume(val);
};
</script>

<style scoped>
.c-LotteryConfig :deep(.el-dialog__body) {
  height: 480px;
}
.dialog-showEditPrize :deep(.el-dialog) {
  height: 186px;
}

/* 通用设置卡片样式 */
.audio-settings-card,
.lottery-settings-card {
  background-color: #f5f7fa;
  border-radius: 4px;
  padding: 10px 14px;
  margin-bottom: 12px;
  border: 1px solid #e4e7ed;
}

.audio-settings-header {
  margin-bottom: 8px;
}

.audio-settings-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.audio-settings-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mute-button {
  flex-shrink: 0;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.volume-label {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.volume-slider {
  flex: 1;
  min-width: 120px;
}

/* 奖项配置表单样式 */
.lottery-form {
  margin-top: 0;
}

.category-card {
  background-color: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  margin-bottom: 10px;
  overflow: hidden;
}

.category-card-header {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  padding: 8px 12px;
  background-color: #ebeef5;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.category-card-actions {
  display: flex;
  gap: 4px;
}

.prize-action {
  font-size: 12px;
  padding: 0 4px;
  height: auto;
}

.category-card-body {
  padding: 10px 12px 2px;
}

.category-card-body :deep(.el-form-item) {
  margin-bottom: 10px;
}

.exclude-item {
  margin-bottom: 8px;
}
.exclude-item :deep(.el-form-item__label) {
  font-size: 12px;
  color: #909399;
}

.exclude-settings {
  width: 100%;
}

.exclude-mode-select {
  width: 120px;
}

.custom-exclude-options {
  margin-top: 6px;
  padding: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lottery-settings-header {
  margin-bottom: 8px;
}

.lottery-settings-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.lottery-settings-content {
  padding: 2px 0;
}

.preset-item {
  margin-bottom: 8px;
}
.preset-item :deep(.el-form-item__label) {
  font-size: 12px;
  color: #909399;
}

/* 操作按钮区域样式 */
.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
}
</style>

<!-- 注：原先此处有一个非 scoped 的 `.exclude-mode-popper { z-index: 10200 !important }`，
     已迁至 design/tokens.css 的统一 z-index 刻度，并改为变量驱动的深色舞台样式。 -->
