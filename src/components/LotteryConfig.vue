<template>
  <el-dialog
    v-model="dialogVisible"
    :append-to-body="true"
    width="390px"
    class="c-LotteryConfig"
  >
    <template #header>
      <div class="c-LotteryConfigtitle flex items-center">
        <span class="text-base mr-5">抽奖配置</span>
        <el-button size="small" @click="addLottery">增加奖项</el-button>
        <el-button size="small" type="primary" @click="onSubmit"
          >保存配置</el-button
        >
        <el-button size="small" @click="dialogVisible = false"
          >取消</el-button
        >
      </div>
    </template>
    <div class="container h-full overflow-y-auto px-2.5">
      <el-form ref="formRef" :model="form" size="small">
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
</script>

<style scoped>
.c-LotteryConfig :deep(.el-dialog__body) {
  height: 340px;
}
.dialog-showAddLottery :deep(.el-dialog) {
  height: 186px;
}
.preset-item {
  margin-top: -10px;
  margin-bottom: 10px;
}
.preset-item :deep(.el-form-item__label) {
  font-size: 12px;
  color: #909399;
}
</style>
