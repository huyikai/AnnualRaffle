<template>
  <div class="c-Publicity">
    <el-carousel
      height="50px"
      :autoplay="true"
      indicator-position="none"
      arrow="never"
      :interval="3000"
    >
      <el-carousel-item v-for="item in message" :key="item.key">
        <div class="item" :class="{ actiname: item.key === 0 }">
          <span v-if="item.title" class="title"> {{ item.title }}</span>
          <span v-if="item.value" class="value">
            {{ item.value }}
          </span>
        </div>
      </el-carousel-item>
    </el-carousel>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { conversionCategoryName } from '@/helper/index';
import { useLotteryStore } from '@/stores/lottery';

interface MessageItem {
  key: number;
  title?: string;
  value?: string;
}

const store = useLotteryStore();

const config = computed(() => store.config);
const result = computed(() => store.result);

const message = computed((): MessageItem[] => {
  const fields = Object.keys(config.value);
  const messageList: MessageItem[] = [{ key: 0, title: config.value.name as string }];
  
  fields.forEach((item, index) => {
    // 跳过特殊字段
    if (item === 'name' || item === 'number') {
      return;
    }
    
    const label = conversionCategoryName(item);
    const resultValue = result.value[item];
    const configValue = config.value[item];
    
    // 获取配置数量
    const count = (configValue && typeof configValue === 'object' && 'count' in configValue)
      ? (configValue as { count: number }).count
      : 0;
    
    if (resultValue && count > 0) {
      messageList.push({
        key: index + 1,
        title: `${label}抽奖结果:`,
        value: resultValue.length > 0 ? resultValue.join('、') : '暂未抽取'
      });
    }
  });

  return messageList;
});
</script>
<style lang="scss">
.c-Publicity {
  height: 100%;
  // width: 1000px;
  background-color: rgba(255, 255, 255, 0.1);
  margin: 0 auto;
  position: relative;
  overflow: hidden;
  .el-carousel {
    width: 80vw;
    margin: 0 auto;
  }
  .item {
    text-align: center;
    color: #fff;
    font-size: 16px;
    .title {
      color: #ccc;
    }
    .value {
      margin-left: 10px;
    }
    &.actiname {
      .title {
        color: red;
        font-size: 20px;
      }
    }
  }
}
</style>
