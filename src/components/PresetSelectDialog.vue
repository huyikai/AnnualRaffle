<template>
  <el-dialog
    v-model="dialogVisible"
    :title="title"
    :append-to-body="true"
    width="640px"
    :z-index="10250"
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
        <el-tooltip :content="`ID: ${option.key}`" placement="top">
          <div class="preset-transfer-item">
            <img
              :src="getUserAvatarUrl(option.key)"
              class="preset-avatar"
              alt=""
              @error="handleAvatarError"
            />
            <span class="preset-name">{{ option.label }}</span>
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
import type { UserItem } from '@/config/userLoader';

interface TransferOption {
  key: number;
  label: string;
  disabled?: boolean;
}

interface Props {
  visible: boolean;
  modelValue: number[];
  categoryKey: string;
  userList: UserItem[];
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '选择预设名单'
});
const emit = defineEmits<{
  'update:visible': [value: boolean];
  'update:modelValue': [value: number[]];
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
});

// 使用本地 ref 供 el-transfer 直接绑定，避免 computed 导致的双向绑定失效
const selectedIds = ref<number[]>([]);

// 弹窗打开时从 props 同步初始值
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      selectedIds.value = [...props.modelValue];
    }
  },
  { immediate: true }
);

// 监听本地选中变化，同步到父组件
watch(
  selectedIds,
  (ids) => {
    emit('update:modelValue', [...ids]);
  },
  { deep: true }
);

// 过滤出可参与当前奖项的用户，构建 transfer 数据源
const transferData = computed((): TransferOption[] => {
  return props.userList
    .filter((user) => canUserParticipate(user, props.categoryKey))
    .map((user) => ({
      key: user.key,
      label: user.name,
      disabled: false
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

.preset-name {
  flex: 1;
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
