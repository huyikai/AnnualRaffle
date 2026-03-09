<template>
  <el-dialog
    v-model="dialogVisible"
    :append-to-body="true"
    width="390px"
    class="c-LotteryConfig"
    :z-index="10100"
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
          <el-button
            size="small"
            @click="handleToggleMute"
            class="mute-button"
          >
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
              <div class="text-gray-400 text-xs mt-0.5">开启后，已中奖人员默认不参与后续抽奖</div>
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
        <div v-for="newitem in storeNewLottery" :key="newitem.key" class="category-card">
          <div class="category-card-header">{{ newitem.name }}</div>
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
                  :model-value="getItemConfig(newitem.key).excludeMode || 'global'"
                  @change="(val: string) => handleExcludeModeChange(newitem.key, val as 'global' | 'custom')"
                  size="small"
                  class="exclude-mode-select"
                  popper-class="exclude-mode-popper"
                >
                  <el-option label="跟随全局" value="global" />
                  <el-option label="自定义" value="custom" />
                </el-select>
                <template v-if="getItemConfig(newitem.key).excludeMode === 'custom'">
                  <div class="custom-exclude-options">
                    <div class="flex items-center gap-2">
                      <el-checkbox
                        :model-value="getItemConfig(newitem.key).excludeWinners !== false"
                        @change="(val: boolean) => handleCategoryExcludeWinnersChange(newitem.key, val)"
                      >排除已中奖人员</el-checkbox>
                    </div>
                    <div class="flex items-center gap-2">
                      <el-button
                        size="small"
                        @click="openExcludedPersonsSelect(newitem.key)"
                      >
                        排除指定人员
                      </el-button>
                      <span v-if="getExcludedPersonIds(newitem.key).length" class="text-gray-500 text-xs">
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
                  <span v-if="getPresetIds(newitem.key).length" class="text-gray-500 text-xs">
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
        <el-button size="small" @click="addLottery">增加奖项</el-button>
        <el-button size="small" type="primary" @click="onSubmit">完成</el-button>
      </div>
    </div>

    <PresetSelectDialog
      :key="editingPresetCategory ?? 'closed'"
      v-model:visible="presetSelectVisible"
      v-model:model-value="selectedPresetIds"
      :category-key="editingPresetCategory ?? ''"
      :user-list="store.list"
    />

    <PresetSelectDialog
      :key="'exclude-' + (editingExcludeCategory ?? 'closed')"
      v-model:visible="excludePersonsSelectVisible"
      v-model:model-value="selectedExcludedPersonIds"
      category-key=""
      :user-list="store.list"
      title="选择排除人员"
    />

    <el-dialog
      v-model="showAddLottery"
      :append-to-body="true"
      width="300px"
      class="dialog-showAddLottery"
      :z-index="10200"
    >
      <template #header>
        <div class="add-title">增加奖项</div>
      </template>
      <el-form ref="newLotteryRef" :model="newLottery" size="small">
        <el-form-item label="奖项名称">
          <el-input v-model="newLottery.name"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="addHandler">增加奖项</el-button>
          <el-button @click="showAddLottery = false">取消</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import { setData, configField } from '@/helper/index';
import { randomNum } from '@/helper/algorithm';
import { useLotteryStore } from '@/stores/lottery';
import { useAudio } from '@/composables/useAudio';
import type { LotteryItemConfig } from '@/config/lottery';
import { getLotteryPreset, getLotteryExcludedPersons } from '@/config/lottery';
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
const { isMuted, volume, audioEnabled, enableAudio, toggleMute, setVolume } = useAudio();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
});

const form = computed(() => store.config);
const storeNewLottery = computed(() => store.newLottery);

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

// 初始化预设名单启用状态（preset 存在即视为启用，含空字符串）
watch(
  () => [storeNewLottery.value, form.value],
  () => {
    storeNewLottery.value.forEach(item => {
      const config = getItemConfig(item.key);
      presetEnabled[item.key] = 'preset' in config;
      // 确保配置项格式正确
      getItemConfig(item.key);
    });
  },
  { immediate: true, deep: true }
);

// 监听 form 变更（含 count），即时持久化
watch(
  () => form.value,
  (val) => setData(configField, val),
  { deep: true }
);

const handlePresetToggle = (key: string) => {
  const config = getItemConfig(key);
  if (!presetEnabled[key]) {
    // 禁用预设名单
    delete config.preset;
  } else {
    // 启用预设名单，初始化为空字符串
    if (!config.preset) {
      config.preset = '';
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

const getExcludedPersonIds = (key: string): number[] => {
  return getLotteryExcludedPersons(form.value, key);
};

// 排除人员选择弹窗
const excludePersonsSelectVisible = ref(false);
const editingExcludeCategory = ref<string | null>(null);
const excludeByCategory = reactive<Record<string, number[]>>({});

const selectedExcludedPersonIds = computed({
  get: () => {
    const key = editingExcludeCategory.value;
    return key ? (excludeByCategory[key] ?? getExcludedPersonIds(key)) : [];
  },
  set: (val: number[]) => {
    const key = editingExcludeCategory.value;
    if (key) {
      excludeByCategory[key] = [...val];
      const config = getItemConfig(key);
      config.excludedPersons = val.length ? val.join(',') : '';
      setData(configField, form.value);
    }
  }
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

// ===== 新增奖项 =====

const showAddLottery = ref(false);
const newLottery = reactive({ name: '' });

// 预设名单选择弹窗 - 每个奖项独立存储，避免相互影响
const presetSelectVisible = ref(false);
const editingPresetCategory = ref<string | null>(null);
const presetByCategory = reactive<Record<string, number[]>>({});

// 解析预设名单字符串为 ID 数组
const getPresetIds = (key: string): number[] => {
  const preset = getLotteryPreset(form.value, key);
  if (!preset || !preset.trim()) return [];
  return preset.split(',').map((item) => Number(item.trim())).filter(Boolean);
};

// 当前编辑奖项的已选 ID（供 PresetSelectDialog 使用）
const selectedPresetIds = computed({
  get: () => {
    const key = editingPresetCategory.value;
    return key ? (presetByCategory[key] ?? getPresetIds(key)) : [];
  },
  set: (val: number[]) => {
    const key = editingPresetCategory.value;
    if (key) {
      presetByCategory[key] = [...val];
      const config = getItemConfig(key);
      config.preset = val.length ? val.join(',') : '';
      // 实时持久化到 localStorage，避免刷新丢失
      setData(configField, form.value);
    }
  }
});

const openPresetSelect = (categoryKey: string) => {
  editingPresetCategory.value = categoryKey;
  presetByCategory[categoryKey] = getPresetIds(categoryKey);
  presetSelectVisible.value = true;
};

// 弹窗关闭时清理编辑状态
watch(presetSelectVisible, (visible) => {
  if (!visible) {
    editingPresetCategory.value = null;
  }
});

const formRef = ref();
const newLotteryRef = ref();

const onSubmit = () => {
  // 清理未启用的预设名单
  storeNewLottery.value.forEach(item => {
    const config = getItemConfig(item.key);
    if (!presetEnabled[item.key] && config.preset === '') {
      delete config.preset;
    }
  });
  
  setData(configField, form.value);
  store.setConfig(form.value);
  dialogVisible.value = false;
  emit('resetconfig');
};

const addLottery = () => {
  showAddLottery.value = true;
};

const randomField = (): string => {
  const str = 'abcdefghijklmnopqrstuvwxyz';
  let fieldStr = '';
  for (let index = 0; index < 10; index++) {
    fieldStr += str.split('')[randomNum(1, 27) - 1];
  }
  return `${fieldStr}${Date.now()}`;
};

const addHandler = () => {
  const field = randomField();
  const data = {
    key: field,
    name: newLottery.name
  };
  store.setNewLottery(data);
  // 初始化新奖项的配置
  form.value[field] = { count: 0 };
  presetEnabled[field] = false;
  newLottery.name = '';
  showAddLottery.value = false;
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
.dialog-showAddLottery :deep(.el-dialog) {
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

<style>
.exclude-mode-popper {
  z-index: 10200 !important;
}
</style>
