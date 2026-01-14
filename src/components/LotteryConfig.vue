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

      <!-- 奖项配置表单 -->
      <el-form ref="formRef" :model="form" size="small" class="lottery-form">
        <template v-for="newitem in storeNewLottery" :key="newitem.key">
          <el-form-item :label="newitem.name">
            <el-input
              type="number"
              :min="0"
              :step="1"
              v-model.number="getItemConfig(newitem.key).count"
              placeholder="请输入数量"
            ></el-input>
          </el-form-item>
          <el-form-item :label="`${newitem.name}预设名单`" class="preset-item">
            <div class="flex items-center gap-2">
              <el-switch
                v-model="presetEnabled[newitem.key]"
                @change="handlePresetToggle(newitem.key)"
              />
              <el-input
                v-if="presetEnabled[newitem.key]"
                type="text"
                v-model="getItemConfig(newitem.key).preset"
                placeholder="用户ID，逗号分隔"
                :disabled="!presetEnabled[newitem.key]"
              ></el-input>
              <span v-else class="text-gray-400 text-xs">未启用</span>
            </div>
          </el-form-item>
        </template>
      </el-form>

      <!-- 操作按钮区域 -->
      <div class="action-buttons">
        <el-button size="small" @click="addLottery">增加奖项</el-button>
        <el-button size="small" type="primary" @click="onSubmit"
          >保存配置</el-button
        >
        <el-button size="small" @click="dialogVisible = false"
          >取消</el-button
        >
      </div>
    </div>

    <el-dialog
      v-model="showAddLottery"
      :append-to-body="true"
      width="300px"
      class="dialog-showAddLottery"
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
import { ElMessage } from 'element-plus';
import { setData, configField } from '@/helper/index';
import { randomNum } from '@/helper/algorithm';
import { useLotteryStore } from '@/stores/lottery';
import { useAudio } from '@/composables/useAudio';
import type { LotteryItemConfig } from '@/config/lottery';
import { getLotteryPreset } from '@/config/lottery';

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

// 初始化预设名单启用状态
watch(
  () => [storeNewLottery.value, form.value],
  () => {
    storeNewLottery.value.forEach(item => {
      const preset = getLotteryPreset(form.value, item.key);
      presetEnabled[item.key] = !!preset;
      // 确保配置项格式正确
      getItemConfig(item.key);
    });
  },
  { immediate: true, deep: true }
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
};

const showAddLottery = ref(false);
const newLottery = reactive({ name: '' });

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

  ElMessage({
    message: '保存成功',
    type: 'success'
  });

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
  height: 340px;
}
.dialog-showAddLottery :deep(.el-dialog) {
  height: 186px;
}

/* 音频设置卡片样式 */
.audio-settings-card {
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

.preset-item {
  margin-top: -10px;
  margin-bottom: 10px;
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
