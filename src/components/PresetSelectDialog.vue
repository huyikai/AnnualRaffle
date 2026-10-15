<template>
  <el-dialog
    v-model="dialogVisible"
    :title="title"
    :append-to-body="true"
    width="640px"
    class="preset-select-dialog"
    @close="handleClose"
  >
    <el-transfer
      v-model="selectedIds"
      :data="transferData"
      :props="{ key: 'key', label: 'label', disabled: 'disabled' }"
      filterable
      filter-placeholder="按姓名或ID搜索"
      :filter-method="filterMethod"
      :titles="['可选人员', '已选名单']"
    >
      <template #default="{ option }">
        <el-tooltip
          :content="
            disabledReasons[option.key]
              ? `${disabledReasons[option.key]}（ID: ${option.key}）`
              : `ID: ${option.key}`
          "
          placement="top"
        >
          <div class="preset-transfer-item">
            <img
              :src="getUserAvatarUrl(option.key)"
              class="preset-avatar"
              alt=""
              @error="handleAvatarError"
            />
            <div class="preset-text">
              <span
                class="preset-name"
                :class="{ 'preset-name-disabled': disabledReasons[option.key] }"
                >{{ option.label }}</span
              >
              <span
                v-if="disabledReasons[option.key]"
                class="preset-disabled-reason"
                >{{ disabledReasons[option.key] }}</span
              >
            </div>
          </div>
        </el-tooltip>
      </template>
    </el-transfer>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getUserAvatarUrl, handleAvatarError } from '@/utils/avatar';
import { canUserParticipate } from '@/helper/algorithm';
import type { Person } from '@/data/person';

interface TransferOption {
  key: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  visible: boolean;
  modelValue: string[];
  categoryKey: string;
  userList: Person[];
  title?: string;
  /** 工号 → 禁选原因；有原因的人员置灰不可选，悬停及列表中展示原因 */
  disabledReasons?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  title: '选择预设名单',
  disabledReasons: () => ({}),
});
const emit = defineEmits<{
  'update:visible': [value: boolean];
  'update:modelValue': [value: string[]];
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

// 使用本地 ref 供 el-transfer 直接绑定，避免 computed 导致的双向绑定失效
const selectedIds = ref<string[]>([]);

// 弹窗打开时从 props 同步初始值
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      selectedIds.value = [...props.modelValue];
    }
  },
  { immediate: true },
);

// 监听本地选中变化，同步到父组件
watch(
  selectedIds,
  (ids) => {
    emit('update:modelValue', [...ids]);
  },
  { deep: true },
);

// 过滤出可参与当前奖项的人员，构建 transfer 数据源（存在禁选原因的人员置灰不可选）
const transferData = computed((): TransferOption[] => {
  return props.userList
    .filter((person) => canUserParticipate(person, props.categoryKey))
    .map((person) => ({
      key: person.key,
      label: person.name,
      disabled: !!props.disabledReasons[person.key],
    }));
});

const filterMethod = (query: string, item: TransferOption) => {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    item.label.toLowerCase().includes(q) ||
    String(item.key).toLowerCase().includes(q)
  );
};

const handleClose = () => {
  emit('update:modelValue', [...selectedIds.value]);
};
</script>

<style scoped>
.preset-transfer-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.preset-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.preset-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-name-disabled {
  color: #c0c4cc;
}

.preset-disabled-reason {
  font-size: 11px;
  color: #f56c6c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-select-dialog :deep(.el-transfer) {
  display: flex;
  flex-wrap: nowrap;
  flex-direction: row;
  justify-content: center;
  align-items: stretch;
  min-width: 560px;
}

.preset-select-dialog :deep(.el-transfer-panel) {
  width: 240px;
  min-width: 240px;
  flex-shrink: 0;
}

.preset-select-dialog :deep(.el-transfer__buttons) {
  flex-shrink: 0;
}

.preset-select-dialog :deep(.el-transfer-panel__body) {
  height: 360px;
}

.preset-select-dialog :deep(.el-transfer-panel__list) {
  height: 320px;
}
</style>
