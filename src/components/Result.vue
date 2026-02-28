<template>
  <el-dialog
    v-model="dialogVisible"
    width="600px"
    class="c-Result"
    :append-to-body="true"
    :z-index="10100"
  >
    <template #header>
      <div class="dialog-title">
        <span class="text-2xl font-bold">抽奖结果</span>
        <span class="text-sm text-gray-500 ml-2.5">(点击号码可以删除)</span>
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
        <span v-if="item.value && item.value.length === 0">
          暂未抽奖
        </span>
        <span
          class="card inline-block px-1.5 leading-8 text-center text-lg font-bold rounded border border-gray-300 bg-gray-100 relative cursor-pointer hover:before:content-['删除'] hover:before:w-full hover:before:h-full hover:before:bg-gray-300 hover:before:absolute hover:before:left-0 hover:before:top-0 hover:before:text-red-500"
          v-for="(data, j) in item.value"
          :key="j"
          :data-res="data"
        >
          {{ userList.find((item) => item.key === data)?.name || `用户${data}` }}
        </span>
      </span>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { conversionCategoryName, getDomData } from '@/helper/index';
import { lottery } from '@/config/lottery';
import { useLotteryStore } from '@/stores/lottery';
import type { ResultListItem } from '@/types';

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
  set: (val) => emit('update:visible', val)
});

const result = computed(() => store.result);
const userList = computed(() => store.list || []);

  const resultList = computed((): ResultListItem[] => {
    const list: ResultListItem[] = [];
    // 合并默认奖项和自定义奖项
    const allLotteries = [
      ...lottery,
      ...store.newLottery
    ];
    // 使用 Set 去重，确保键的唯一性，避免重复显示
    const lotteryList = [...new Set(allLotteries.map(item => item.key))];
  
  // 遍历所有奖项（包括自定义奖项）
  for (const key of lotteryList) {
    if (result.value.hasOwnProperty(key)) {
      const element = result.value[key];
      let name = conversionCategoryName(key);
      list.push({
        label: key,
        name,
        value: element
      });
    }
  }
  
  // 也检查配置中存在的其他奖项（防止遗漏）
  for (const key in result.value) {
    if (result.value.hasOwnProperty(key) && !lotteryList.includes(key)) {
      // 跳过特殊字段
      if (key === 'name' || key === 'number') {
        continue;
      }
      const element = result.value[key];
      let name = conversionCategoryName(key);
      list.push({
        label: key,
        name,
        value: element
      });
    }
  }
  
  return list;
});

const deleteRes = (event: MouseEvent, row: ResultListItem) => {
  const Index = getDomData(event.target as Element, 'res');
  if (!Index) {
    return;
  }
  ElMessageBox.confirm('此操作将移除该中奖号码，确认删除?', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      if (Index) {
        const newResult = { ...result.value };
        newResult[row.label] = result.value[row.label].filter(
          item => item !== Number(Index)
        );
        store.setResult(newResult);
        ElMessage({
          type: 'success',
          message: '删除成功!'
        });
      }
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '已取消'
      });
    });
};
</script>

<style scoped>
.c-Result :deep(.el-dialog__body) {
  max-height: 500px;
  overflow-y: auto;
}
</style>
