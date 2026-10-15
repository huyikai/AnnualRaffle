<template>
  <el-dialog
    v-model="dialogVisible"
    width="600px"
    class="c-Result"
    :append-to-body="true"
  >
    <template #header>
      <div class="dialog-title">
        <span class="text-2xl font-bold">抽奖结果</span>
        <span class="text-sm text-gray-500 ml-2.5">(点击号码可以删除)</span>
        <el-dropdown class="ml-3" @command="handleExport">
          <el-button size="small" text type="primary">导出 CSV</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="all">导出全部奖项</el-dropdown-item>
              <el-dropdown-item
                v-for="item in exportableCategories"
                :key="item.label"
                :command="item.label"
              >
                仅导出「{{ item.name }}」
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </template>
    <div
      v-for="(item, index) in resultList"
      :key="index"
      class="listrow flex leading-8 mb-4"
      @click="(event) => deleteRes(event, item)"
    >
      <span class="name w-[100px] font-bold">
        {{ item.name }}
      </span>
      <span class="value flex-1 flex flex-wrap gap-2">
        <span v-if="item.value && item.value.length === 0"> 暂未抽奖 </span>
        <span
          class="card inline-block px-1.5 leading-8 text-center text-lg font-bold rounded border border-gray-300 bg-gray-100 relative cursor-pointer hover:before:content-['删除'] hover:before:w-full hover:before:h-full hover:before:bg-gray-300 hover:before:absolute hover:before:left-0 hover:before:top-0 hover:before:text-red-500"
          v-for="(data, j) in item.value"
          :key="j"
          :data-res="data"
        >
          {{ resolveName(item.label, data) }}
        </span>
      </span>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getDomData } from '@/helper/index';
import { useLotteryStore } from '@/stores/lottery';
import type { ResultListItem } from '@/types';
import { resolveWinnerName } from '@/storage/result';
import { exportWinnersCsv } from '@/data/csv';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const store = useLotteryStore();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const result = computed(() => store.result);

/**
 * 解析中奖人姓名。
 * 名单优先（改名后展示新名），名单里查不到时回退到抽奖当时的快照——
 * 这样删除人员或改工号之后，历史中奖记录依然可读。
 */
const resolveName = (categoryKey: string, key: string): string =>
  resolveWinnerName(store.list, store.resultMeta, categoryKey, key);

const resultList = computed((): ResultListItem[] => {
  const list: ResultListItem[] = [];

  // 遍历全部奖项（含自定义奖项）
  for (const prize of store.prizes) {
    if (Object.prototype.hasOwnProperty.call(result.value, prize.key)) {
      list.push({
        label: prize.key,
        name: prize.name,
        value: result.value[prize.key],
      });
    }
  }

  // 兜底：结果里存在但奖项列表中没有的 key（历史数据残留），避免记录丢失
  for (const key of Object.keys(result.value)) {
    if (key === 'name' || key === 'number') continue;
    if (store.prizes.some((prize) => prize.key === key)) continue;
    list.push({
      label: key,
      name: store.getPrizeName(key) || '未知奖项',
      value: result.value[key],
    });
  }

  return list;
});

/** 有中奖记录的奖项，供导出菜单使用 */
const exportableCategories = computed(() =>
  resultList.value.filter((item) => item.value.length > 0),
);

/**
 * 导出中奖结果。
 * 导出姓名口径与页面展示一致（名册优先、回退快照），否则表和屏幕会对不上。
 */
const handleExport = (command: string) => {
  const category = command === 'all' ? undefined : command;
  try {
    const { fileName, count } = exportWinnersCsv(
      store.result,
      store.resultMeta,
      store.list,
      store.prizes,
      category,
    );
    if (count === 0) {
      ElMessage.warning('没有可导出的中奖记录');
      return;
    }
    ElMessage.success(`已导出 ${count} 条记录：${fileName}`);
  } catch (error) {
    ElMessage.error(
      `导出失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const deleteRes = (event: MouseEvent, row: ResultListItem) => {
  const key = getDomData(event.target as Element, 'res');
  if (!key) {
    return;
  }
  ElMessageBox.confirm('此操作将移除该中奖号码，确认删除?', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      // 工号与快照同步移除，避免留下无主快照
      store.removeWinner(row.label, key);
      ElMessage({
        type: 'success',
        message: '删除成功!',
      });
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '已取消',
      });
    });
};
</script>

<style scoped>
.c-Result :deep(.el-dialog__body) {
  max-height: 70vh;
  min-height: 0;
  overflow-y: auto;
}

.dialog-title {
  display: flex;
  align-items: center;
}
</style>
