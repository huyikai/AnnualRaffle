<template>
  <el-dialog
    v-model="dialogVisible"
    :title="stage === 'pick' ? '批量导入名单' : '导入结果'"
    width="760px"
    class="c-ImportDialog"
    :close-on-click-modal="false"
  >
    <!-- ===== 第一步：选择来源 + 预检 ===== -->
    <template v-if="stage === 'pick'">
      <el-tabs v-model="tab">
        <!-- CSV 文件 -->
        <el-tab-pane label="CSV 文件" name="file">
          <div
            class="dropzone"
            :class="{ 'is-over': dragOver }"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="onDrop"
            @click="pickFile"
          >
            <p class="dropzone-title">点击选择，或把 CSV 文件拖到这里</p>
            <p class="dropzone-desc">
              支持 UTF-8 与 GBK 编码；自动识别表头与分隔符
            </p>
          </div>
        </el-tab-pane>

        <!-- 批量粘贴 -->
        <el-tab-pane label="批量粘贴" name="paste">
          <el-input
            v-model="pasteText"
            type="textarea"
            :rows="9"
            placeholder="从 Excel / WPS / 飞书表格里整块复制后粘贴到这里。&#10;例如：&#10;工号,姓名&#10;10001,张三&#10;10002,李四"
            class="paste-area"
          />
          <div class="paste-actions">
            <el-button
              size="small"
              type="primary"
              :disabled="!pasteText.trim()"
              @click="analyzePaste"
            >
              解析
            </el-button>
            <span class="paste-hint">自动识别制表符、逗号、中文逗号与分号</span>
          </div>
        </el-tab-pane>
      </el-tabs>

      <div class="import-meta" v-if="plan && !plan.blocked">
        <span
          >识别分隔符：<code>{{ planDelimiter }}</code></span
        >
        <span v-if="encoding"
          >编码：<code>{{ encoding }}</code></span
        >
        <span :class="{ warn: plan.stats.changedCount > 0 }">
          共 {{ plan.stats.total }} 行 · 可导入 {{ plan.stats.ok }} · 异常
          {{ plan.stats.error }} · 与现有冲突 {{ plan.stats.conflictCount }}
          <template v-if="plan.stats.changedCount > 0">
            · {{ plan.stats.changedCount }} 行经归一化修正
          </template>
        </span>
      </div>

      <!-- 阻断提示：格式完全不可用时不给「继续」的机会 -->
      <el-alert
        v-if="plan && plan.blocked"
        type="error"
        :closable="false"
        :title="plan.blocked"
        show-icon
      />

      <!-- 预检表 -->
      <div v-if="plan && !plan.blocked" class="preview-wrap">
        <el-table
          :data="plan.rows"
          height="280"
          size="small"
          class="preview-table"
        >
          <el-table-column
            prop="rowNumber"
            label="行"
            width="55"
            align="center"
          />
          <el-table-column label="状态" width="72">
            <template #default="{ row }">
              <span class="status" :class="statusClass(row)">{{
                statusText(row)
              }}</span>
            </template>
          </el-table-column>
          <el-table-column label="工号（原始 → 归一化）" min-width="220">
            <template #default="{ row }">
              <span class="raw">{{ row.rawKey || '（空）' }}</span>
              <span v-if="row.changed" class="arrow">→</span>
              <span v-if="row.changed" class="normalized">{{ row.key }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="姓名" width="110" />
          <el-table-column label="说明" min-width="160">
            <template #default="{ row }">
              <span v-if="row.reason" class="reason-error">{{
                row.reason
              }}</span>
              <span v-else-if="row.conflict" class="reason-conflict"
                >工号已存在于当前名单</span
              >
              <span v-else class="reason-ok">新增</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 冲突策略 -->
      <div
        v-if="plan && !plan.blocked && plan.stats.conflictCount > 0"
        class="strategy-row"
      >
        <span class="strategy-label">冲突处理：</span>
        <el-radio-group v-model="strategy" size="small">
          <el-radio-button
            v-for="option in CONFLICT_STRATEGIES"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </el-radio-button>
        </el-radio-group>
        <span class="strategy-hint">{{ currentHint }}</span>
      </div>
    </template>

    <!-- ===== 第二步：结果汇总 ===== -->
    <template v-else>
      <div class="result-panel">
        <p class="result-lead">{{ resultLead }}</p>
        <ul class="result-list">
          <li>
            <span class="ok">新增 {{ result.added }} 人</span>
          </li>
          <li v-if="result.overwritten">
            <span class="warn">覆盖 {{ result.overwritten }} 人</span>
          </li>
          <li v-if="result.skipped">
            <span class="muted">跳过 {{ result.skipped }} 人</span>
          </li>
          <li v-if="result.errored">
            <span class="bad">异常 {{ result.errored }} 行未导入</span>
          </li>
        </ul>

        <el-collapse v-if="failedRows.length > 0" class="result-detail">
          <el-collapse-item
            :title="`查看 ${failedRows.length} 行异常明细`"
            name="failed"
          >
            <ul class="detail-list">
              <li v-for="row in failedRows" :key="row.rowNumber">
                第 {{ row.rowNumber }} 行：{{ row.rawKey || '（空工号）' }}
                {{ row.rawName }} —— {{ row.reason }}
              </li>
            </ul>
          </el-collapse-item>
        </el-collapse>
      </div>
    </template>

    <template #footer>
      <template v-if="stage === 'pick'">
        <el-button text class="template-btn" @click="downloadTemplate"
          >下载模板</el-button
        >
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!canApply" @click="apply">
          导入 {{ plan?.stats.ok ?? 0 }} 人
        </el-button>
      </template>
      <template v-else>
        <el-button type="primary" @click="dialogVisible = false"
          >完成</el-button
        >
      </template>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  decodeBuffer,
  parseImport,
  parsePasted,
  applyImport,
  CONFLICT_STRATEGIES,
  TEMPLATE_CSV,
} from '@/data/importer';
import type {
  ImportPlan,
  ImportRow,
  ConflictStrategy,
  ApplySummary,
} from '@/data/importer';
import type { Person } from '@/data/person';
import { isTauri } from '@/platform';

const props = defineProps<{ visible: boolean; roster: Person[] }>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
  imported: [next: Person[]];
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const tab = ref<'file' | 'paste'>('file');
const pasteText = ref('');
const dragOver = ref(false);
const encoding = ref('');
const strategy = ref<ConflictStrategy>('skip');
const stage = ref<'pick' | 'result'>('pick');
const result = ref<ApplySummary>({
  added: 0,
  overwritten: 0,
  skipped: 0,
  errored: 0,
  next: [],
});

const plan = ref<ImportPlan | null>(null);

const planDelimiter = computed(() => {
  if (!plan.value) return '';
  const map: Record<string, string> = {
    '\t': '制表符',
    ',': '逗号',
    '，': '中文逗号',
    ';': '分号',
    '；': '中文分号',
  };
  return map[plan.value.delimiter] ?? plan.value.delimiter;
});

const currentHint = computed(
  () => CONFLICT_STRATEGIES.find((s) => s.value === strategy.value)?.hint ?? '',
);

const canApply = computed(
  () => !!plan.value && !plan.value.blocked && plan.value.stats.ok > 0,
);

const failedRows = computed<ImportRow[]>(() =>
  (plan.value?.rows ?? []).filter((row) => row.status === 'error'),
);

const resultLead = computed(() => {
  if (!result.value) return '';
  const parts: string[] = [];
  if (result.value.added > 0) parts.push(`新增 ${result.value.added} 人`);
  if (result.value.overwritten > 0)
    parts.push(`覆盖 ${result.value.overwritten} 人`);
  if (result.value.skipped > 0) parts.push(`跳过 ${result.value.skipped} 人`);
  return parts.length > 0
    ? `导入完成：${parts.join('，')}。`
    : '没有可导入的记录。';
});

function statusText(row: ImportRow): string {
  if (row.status === 'error') return '异常';
  return row.conflict ? '冲突' : '新增';
}

function statusClass(row: ImportRow): string {
  if (row.status === 'error') return 'is-error';
  return row.conflict ? 'is-conflict' : 'is-new';
}

// ========== 打开时重置 ==========

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    stage.value = 'pick';
    tab.value = 'file';
    pasteText.value = '';
    plan.value = null;
    encoding.value = '';
    strategy.value = 'skip';
    dragOver.value = false;
  },
);

// ========== 文件来源 ==========

async function pickFile() {
  if (isTauri()) {
    const [{ open }, { readFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const selected = await open({
      multiple: false,
      filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }],
    });
    if (!selected || Array.isArray(selected)) return;
    const buffer = await readFile(selected);
    await analyzeBuffer(buffer);
    return;
  }
  await pickViaInput();
}

function pickViaInput(): Promise<void> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,text/csv';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (file) await analyzeBuffer(await file.arrayBuffer());
      resolve();
    });
    document.body.appendChild(input);
    input.click();
  });
}

async function onDrop(event: DragEvent) {
  dragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  await analyzeBuffer(await file.arrayBuffer());
}

async function analyzeBuffer(buffer: ArrayBuffer | Uint8Array) {
  const decoded = decodeBuffer(buffer);
  encoding.value = decoded.encoding;
  plan.value = parseImport(decoded.text, currentKeys());
}

// ========== 粘贴来源 ==========

function analyzePaste() {
  encoding.value = '粘贴文本';
  plan.value = parsePasted(pasteText.value, currentKeys());
}

/** 当前名册的工号集合，用于预检时判定冲突 */
function currentKeys(): Set<string> {
  return new Set(props.roster.map((person) => person.key));
}

// ========== 应用 ==========

function apply() {
  const current = plan.value;
  if (!current || current.blocked) return;

  const summary = applyImport(current, strategy.value, props.roster);
  result.value = summary;
  stage.value = 'result';
  emit('imported', summary.next);

  const bits: string[] = [`新增 ${summary.added} 人`];
  if (summary.overwritten) bits.push(`覆盖 ${summary.overwritten} 人`);
  if (summary.skipped) bits.push(`跳过 ${summary.skipped} 人`);
  if (summary.errored) bits.push(`${summary.errored} 行异常`);
  ElMessage.success(bits.join(' · '));
}

// ========== 模板 ==========

function downloadTemplate() {
  // 前置单引号已在模板内容里，避免 Excel 把工号列转成数值
  const blob = new Blob(['﻿' + TEMPLATE_CSV], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '名单模板.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.dropzone {
  border: 2px dashed var(--ar-border-strong);
  border-radius: var(--ar-radius-md);
  padding: 36px 20px;
  text-align: center;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background-color 0.15s;
}

.dropzone:hover,
.dropzone.is-over {
  border-color: var(--ar-accent);
  background: rgba(226, 180, 87, 0.08);
}

.dropzone-title {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--ar-text);
}

.dropzone-desc {
  margin: 0;
  font-size: 12px;
  color: var(--ar-text-secondary);
}

.paste-area {
  margin-bottom: 8px;
}

.paste-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.paste-hint {
  font-size: 12px;
  color: var(--ar-text-secondary);
}

.import-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 10px 2px;
  font-size: 12px;
  color: var(--ar-text-secondary);
}

.import-meta .warn {
  color: var(--ar-warning);
}

.import-meta code {
  background: var(--ar-surface-sunken);
  padding: 1px 6px;
  border-radius: var(--ar-radius-sm);
  color: var(--ar-text-regular);
}

.preview-wrap {
  margin-top: 8px;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  overflow: hidden;
}

.raw {
  color: var(--ar-text-secondary);
}

.arrow {
  margin: 0 6px;
  color: var(--ar-accent-press);
}

.normalized {
  color: var(--ar-text);
  font-weight: 600;
}

.status {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: var(--ar-radius-sm);
}
.status.is-new {
  color: var(--ar-success);
  background: rgba(62, 142, 90, 0.12);
}
.status.is-conflict {
  color: var(--ar-warning);
  background: rgba(200, 138, 46, 0.14);
}
.status.is-error {
  color: var(--ar-danger);
  background: var(--ar-danger-bg);
}

.reason-ok {
  color: var(--ar-text-disabled);
  font-size: 12px;
}
.reason-conflict {
  color: var(--ar-warning);
  font-size: 12px;
}
.reason-error {
  color: var(--ar-danger);
  font-size: 12px;
}

.strategy-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.strategy-label {
  font-size: 13px;
  color: var(--ar-text-regular);
}

.strategy-hint {
  font-size: 12px;
  color: var(--ar-text-secondary);
}

.result-panel {
  padding: 8px 4px;
}

.result-lead {
  font-size: 14px;
  color: var(--ar-text);
  margin: 0 0 10px;
}

.result-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  gap: 20px;
  font-size: 13px;
}

.result-list .ok {
  color: var(--ar-success);
}
.result-list .warn {
  color: var(--ar-warning);
}
.result-list .bad {
  color: var(--ar-danger);
}
.result-list .muted {
  color: var(--ar-text-disabled);
}

.detail-list {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--ar-text-regular);
  line-height: 1.7;
  max-height: 180px;
  overflow-y: auto;
}

.template-btn {
  margin-right: auto;
}
</style>
