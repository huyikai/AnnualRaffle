<template>
  <div>
    <div
      id="tool"
      class="fixed bottom-[30px] left-1/2 -translate-x-1/2 text-center flex flex-col items-center justify-center gap-2.5"
      style="z-index: var(--ar-z-float)"
    >
      <div class="relative w-[150px]">
        <el-select
          v-model="form.category"
          placeholder="请选取本次抽取的奖项"
          class="custom-select w-[150px]"
          popper-class="tool-select-dropdown"
          :popper-append-to-body="true"
          placement="top"
        >
          <el-option
            :label="item.label"
            :value="item.value"
            v-for="(item, index) in categorys"
            :key="index"
          ></el-option>
        </el-select>
        <el-tooltip
          :disabled="!presetIssues.length"
          placement="top"
          effect="dark"
        >
          <template #content>
            <div class="preset-issue-line">
              预设名单中有 {{ presetIssues.length }} 人无法参与本奖项：
            </div>
            <div
              v-for="issue in presetIssues"
              :key="issue.key"
              class="preset-issue-line"
            >
              {{ issue.name }}（{{ issue.reason }}）
            </div>
            <div class="preset-issue-line">
              可在「抽奖配置」中调整预设名单或排除设置
            </div>
          </template>
          <span v-if="presetIssues.length" class="preset-alert-dot"></span>
        </el-tooltip>
      </div>
      <el-button
        :class="running ? 'btn-stop' : 'btn-start'"
        type="primary"
        @click="onSubmit"
        >{{ running ? '停止' : '开始抽奖' }}</el-button
      >

      <el-dialog
        :append-to-body="true"
        v-model="showSetwat"
        class="setwat-dialog"
        width="400px"
      >
        <el-form ref="formRef" :model="form" label-width="80px" size="small">
          <el-form-item label="抽取奖项">
            <el-select
              v-model="form.category"
              placeholder="请选取本次抽取的奖项"
            >
              <el-option
                :label="item.label"
                :value="item.value"
                v-for="(item, index) in categorys"
                :key="index"
              ></el-option>
            </el-select>
          </el-form-item>

          <el-form-item label=" " v-if="form.category">
            <span>
              共&nbsp;
              <span class="text-red-500 font-bold">{{
                getCategoryCount(form.category)
              }}</span>
              &nbsp;名
            </span>
            <span class="ml-5">
              剩余&nbsp;
              <span class="text-red-500 font-bold">{{ remain }}</span>
              &nbsp;名
            </span>
          </el-form-item>

          <el-form-item>
            <el-button class="btn-start" type="primary" @click="onSubmit"
              >立即抽奖</el-button
            >
            <el-button @click="showSetwat = false">取消</el-button>
          </el-form-item>
        </el-form>
      </el-dialog>

      <el-dialog
        v-model="showRemoveoptions"
        width="300px"
        class="c-removeoptions"
        :append-to-body="true"
      >
        <el-form
          ref="formRef"
          :model="removeInfo"
          label-width="80px"
          size="small"
        >
          <el-form-item label="重置选项">
            <el-radio-group v-model="removeInfo.type">
              <el-radio border :label="ResetType.ALL">重置全部数据</el-radio>
              <el-radio border :label="ResetType.CONFIG">重置抽奖配置</el-radio>
              <el-radio border :label="ResetType.LIST">重置名单</el-radio>
              <el-radio border :label="ResetType.RESULT">重置抽奖结果</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="resetConfig">确定重置</el-button>
            <el-button @click="showRemoveoptions = false">取消</el-button>
          </el-form-item>
        </el-form>
      </el-dialog>
    </div>
    <a
      class="btn-reset fixed bottom-2.5 right-2.5 bg-transparent border-transparent text-[#b08031] text-xs cursor-pointer"
      style="z-index: var(--ar-z-float)"
      @click="resetConfig"
    >
      重置
    </a>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  clearData,
  removeData,
  configField,
  resultField,
} from '@/helper/index';
import { useLotteryStore } from '@/stores/lottery';
import { DEFAULT_CONFIG, LOTTERY_MODE, LOTTERY_TIMING } from '@/constants';
import type { LotteryForm } from '@/types';
import { ResetType } from '@/types';
import { getLotteryCount, getPresetIssues } from '@/config/lottery';
import { rosterField } from '@/storage/roster';

interface Props {
  running: boolean;
  closeRes?: () => void;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  toggle: [form: LotteryForm];
  stop: [];
  resetConfig: [];
}>();

const store = useLotteryStore();

const config = computed(() => store.config);
const result = computed(() => store.result);

// 获取奖项数量（兼容新旧格式）
const getCategoryCount = (category: string): number => {
  return getLotteryCount(config.value, category);
};

const remain = computed(() => {
  return (
    getCategoryCount(form.category) -
    (result.value[form.category] ? result.value[form.category].length : 0)
  );
});

// 当前选中奖项的预设失效成员：开奖结果提交后实时更新，
// 仅以小红点 + 悬停明细提醒操作者，不在大屏弹出任何文字
const presetIssues = computed(() => {
  return getPresetIssues({
    config: config.value,
    categoryKey: form.category,
    globalExcludeWinners: store.excludeWinners,
    result: result.value,
    // 排除名单现从名册派生，不再是构建期静态 import
    excludedUsers: store.excludedUsers,
    list: store.list,
  }).map((issue) => ({
    ...issue,
    name:
      store.list.find((u) => u.key === issue.key)?.name ?? `工号 ${issue.key}`,
  }));
});

// 奖项下拉：遍历奖项列表而非 config 的键，避免删除奖项后残留项仍出现在下拉中
const categorys = computed(() => {
  const options: Array<{ label: string; value: string }> = [];
  store.prizes.forEach((prize) => {
    const count = getLotteryCount(config.value, prize.key);
    if (count > 0) {
      options.push({ label: prize.name, value: prize.key });
    }
  });
  return options;
});

const showSetwat = ref(false);
const showRemoveoptions = ref(false);
const lastClickTime = ref(0);
const removeInfo = reactive<{ type: ResetType }>({ type: ResetType.RESULT });
const form = reactive<LotteryForm>({
  category: DEFAULT_CONFIG.DEFAULT_CATEGORY,
  mode: DEFAULT_CONFIG.DEFAULT_MODE as number,
  qty: DEFAULT_CONFIG.DEFAULT_QTY,
  remain: 0,
});

watch(showRemoveoptions, (v) => {
  if (!v) {
    removeInfo.type = ResetType.RESULT;
  }
});

const resetConfig = () => {
  const type = removeInfo.type;
  ElMessageBox.confirm('此操作将重置所选数据，是否继续?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      switch (type) {
        case ResetType.ALL:
          clearData();
          store.setClearStore();
          break;
        case ResetType.CONFIG:
          removeData(configField);
          store.setClearConfig();
          break;
        case ResetType.LIST:
          removeData(rosterField);
          store.setClearList();
          break;
        case ResetType.RESULT:
          removeData(resultField);
          store.setClearResult();
          break;
        default:
          break;
      }

      props.closeRes && props.closeRes();

      showRemoveoptions.value = false;
      ElMessage({
        type: 'success',
        message: '重置成功!',
      });

      emit('resetConfig');
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '已取消',
      });
    });
};

const onSubmit = () => {
  const now = Date.now();
  if (now - lastClickTime.value < LOTTERY_TIMING.BUTTON_THROTTLE) {
    return;
  }
  lastClickTime.value = now;

  if (props.running) {
    emit('stop');
  } else {
    if (!form.category) {
      return ElMessage.error('请选择本次抽取的奖项');
    }
    if (remain.value <= 0) {
      return ElMessage.error('该奖项剩余人数不足');
    }
    if (form.mode === LOTTERY_MODE.CUSTOM) {
      if (form.qty <= 0) {
        return ElMessage.error('必须输入本次抽取人数');
      }
      if (form.qty > remain.value) {
        return ElMessage.error('本次抽奖人数已超过本奖项的剩余人数');
      }
    }
    if (form.mode === LOTTERY_MODE.ONE || form.mode === LOTTERY_MODE.FIVE) {
      if (form.mode > remain.value) {
        return ElMessage.error('本次抽奖人数已超过本奖项的剩余人数');
      }
    }
    showSetwat.value = false;
    emit('toggle', Object.assign({}, form, { remain: remain.value }));
  }
};
</script>

<style scoped>
.custom-select :deep(.el-input .el-input__inner) {
  background-color: #5b1411;
  border-color: #8a5408 !important;
  color: #d9a964;
}

.custom-select :deep(.el-input.is-focus .el-input__inner) {
  border-color: #8a5408 !important;
}

.btn-start {
  width: 150px !important;
  background-color: #e23b32 !important;
  border-color: #e23b32 !important;
  color: #fedaa1 !important;
  font-size: 18px !important;
}
.btn-stop {
  width: 150px !important;
  background-color: #e1a857 !important;
  border-color: #e1a857 !important;
  color: #572904 !important;
  font-size: 18px !important;
}

.c-removeoptions :deep(.el-dialog) {
  height: 290px;
}
.c-removeoptions :deep(.el-radio.is-bordered + .el-radio.is-bordered) {
  margin-left: 0px;
}
.c-removeoptions :deep(.el-radio.is-bordered) {
  margin-bottom: 10px;
}

/* 注：原先的 `:deep(.tool-select-dropdown) { z-index: 10001 !important }` 与
   `.preset-alert-dot` 样式已迁至 design/tokens.css：
   popper 被 teleport 到 body 后 scoped :deep 匹配不到，必须写成全局规则。
   小红点同时去掉了霓虹外发光，并从无限循环改为播放 3 次。 */
</style>
