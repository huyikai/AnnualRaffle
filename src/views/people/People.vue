<template>
  <div class="people-page">
    <!-- 顶部栏 -->
    <header class="people-header">
      <div class="people-header-left">
        <el-button text class="back-btn" @click="router.push('/')"
          >← 返回抽奖</el-button
        >
        <h1 class="people-title">人员管理</h1>
      </div>
      <div class="people-header-right">
        <el-button size="small" @click="handleExport">导出备份</el-button>
        <el-button size="small" @click="handleRestore">恢复备份</el-button>
        <el-button size="small" @click="openBatchPhotos">导入照片</el-button>
        <el-button size="small" @click="handleCleanOrphans"
          >清理无用照片</el-button
        >
        <el-button size="small" type="primary" @click="importVisible = true"
          >批量导入</el-button
        >
        <el-button size="small" @click="openCreate">新增人员</el-button>
      </div>
    </header>

    <!-- 统计条 -->
    <div class="people-stats">
      <span
        >共 <strong>{{ store.list.length }}</strong> 人</span
      >
      <span class="dot">·</span>
      <span
        >参与 <strong class="ok">{{ store.activeCount }}</strong> 人</span
      >
      <span class="dot">·</span>
      <span
        >排除
        <strong class="off">{{ store.list.length - store.activeCount }}</strong>
        人</span
      >
      <span class="dot">·</span>
      <span
        >已中奖 <strong class="win">{{ winnerTotal }}</strong> 人次</span
      >
    </div>

    <!-- 搜索与批量操作 -->
    <div class="people-toolbar">
      <el-input
        v-model="keyword"
        placeholder="按工号或姓名搜索"
        clearable
        class="people-search"
      />
      <div class="people-batch" v-if="selection.length > 0">
        <span class="batch-count">已选 {{ selection.length }} 人</span>
        <el-button size="small" @click="batchSetEnabled(true)"
          >批量启用</el-button
        >
        <el-button size="small" @click="batchSetEnabled(false)"
          >批量停用</el-button
        >
        <el-button size="small" type="danger" plain @click="batchDelete"
          >批量删除</el-button
        >
      </div>
    </div>

    <!-- 表格 -->
    <div class="people-table-wrap">
      <el-table
        :data="filteredList"
        height="100%"
        row-key="key"
        @selection-change="(rows: Person[]) => (selection = rows)"
      >
        <el-table-column type="selection" width="45" />
        <el-table-column label="照片" width="70">
          <template #default="{ row }">
            <img
              :src="avatarSrc(row.key)"
              class="avatar-cell"
              :title="row.key"
              alt=""
              @click.stop="openSinglePhoto(row)"
              @error="onAvatarError"
            />
          </template>
        </el-table-column>
        <el-table-column label="参与" width="70">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              @change="(val: boolean) => toggleEnabled(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="key" label="工号" width="150" sortable />
        <el-table-column prop="name" label="姓名" width="150" sortable />
        <el-table-column label="可参与奖项" min-width="220">
          <template #default="{ row }">
            <span
              v-if="!row.allowedPrizes || row.allowedPrizes.length === 0"
              class="muted"
            >
              全部奖项
            </span>
            <template v-else>
              <el-tag
                v-for="prizeKey in row.allowedPrizes"
                :key="prizeKey"
                size="small"
                :type="prizeExists(prizeKey) ? 'warning' : 'info'"
                class="prize-tag"
              >
                {{ prizeName(prizeKey) }}
              </el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="中奖" width="90">
          <template #default="{ row }">
            <span v-if="winnerCount(row.key) > 0" class="winner-badge">
              {{ winnerCount(row.key) }} 次
            </span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link size="small" type="danger" @click="removeOne(row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-slot">
            <p class="empty-title">还没有人员名单</p>
            <p class="empty-desc">从 CSV 导入，或直接新增人员</p>
            <div class="empty-actions">
              <el-button type="primary" @click="importVisible = true"
                >导入名单</el-button
              >
              <el-button @click="openCreate">新增人员</el-button>
            </div>
          </div>
        </template>
      </el-table>
    </div>

    <!-- 新增 / 编辑 -->
    <el-dialog
      v-model="editorVisible"
      :title="editing ? '编辑人员' : '新增人员'"
      width="420px"
    >
      <el-form :model="form" label-width="80px" size="small">
        <el-form-item label="工号" required>
          <el-input
            v-model="form.key"
            placeholder="唯一标识，导入后用于匹配照片"
          />
          <div v-if="form.keyError" class="field-error">
            {{ form.keyError }}
          </div>
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input v-model="form.name" placeholder="姓名" />
        </el-form-item>
        <el-form-item label="参与抽奖">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="可参与奖项">
          <div class="prize-scope">
            <div class="prize-scope-hint">
              {{
                form.allowedPrizes.length === 0
                  ? '当前：参与全部奖项'
                  : '当前：仅参与下方勾选的奖项'
              }}
            </div>
            <el-checkbox-group
              v-model="form.allowedPrizes"
              class="prize-scope-list"
            >
              <el-checkbox
                v-for="prize in store.prizes"
                :key="prize.key"
                :value="prize.key"
              >
                {{ prize.name }}
              </el-checkbox>
            </el-checkbox-group>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEditor">确定</el-button>
      </template>
    </el-dialog>

    <ImportDialog
      v-model:visible="importVisible"
      :roster="store.list"
      @imported="applyImported"
    />
    <PhotoDialog
      v-model:visible="photoVisible"
      :mode="photoMode"
      :person="photoPerson"
      :roster="store.list"
      :revision="photoRevision"
      @changed="onPhotosChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useLotteryStore } from '@/stores/lottery';
import { normalizeKey } from '@/data/person';
import type { Person } from '@/data/person';
import { saveRoster } from '@/storage/roster';
import {
  exportBackupToFile,
  pickBackupFile,
  restoreBackup,
  scheduleSnapshot,
} from '@/storage/backup';
import ImportDialog from './ImportDialog.vue';
import PhotoDialog from './PhotoDialog.vue';
import {
  avatarUrl,
  cleanOrphanAvatars,
  findOrphanAvatars,
  canWriteAvatars,
} from '@/avatar/resolve';
import { handleAvatarError } from '@/utils/avatar';

const router = useRouter();
const store = useLotteryStore();

const keyword = ref('');
const selection = ref<Person[]>([]);
const importVisible = ref(false);

// ========== 名单读写 ==========

/** 名册任何变更都走这里：落盘 + 安排自动快照 + 通知 TagCanvas 重绘 */
function commit(next: Person[]) {
  store.setList(next);
  saveRoster(next);
  scheduleSnapshot();
}

const filteredList = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return store.list;
  return store.list.filter(
    (person) =>
      person.key.toLowerCase().includes(q) ||
      person.name.toLowerCase().includes(q),
  );
});

const winnerTotal = computed(() => {
  const keys = new Set<string>();
  Object.values(store.result).forEach((list) =>
    list.forEach((key) => keys.add(key)),
  );
  return keys.size;
});

function winnerCount(key: string): number {
  let total = 0;
  Object.values(store.result).forEach((list) => {
    if (list.includes(key)) total++;
  });
  return total;
}

function prizeName(prizeKey: string): string {
  return (
    store.prizes.find((p) => p.key === prizeKey)?.name ??
    `已删除奖项(${prizeKey})`
  );
}

function prizeExists(prizeKey: string): boolean {
  return store.prizes.some((p) => p.key === prizeKey);
}

// ========== 单人操作 ==========

function toggleEnabled(person: Person, value: boolean) {
  commit(
    store.list.map((p) =>
      p.key === person.key ? { ...p, enabled: value } : p,
    ),
  );
}

const editorVisible = ref(false);
const editing = ref(false);
const form = reactive<{
  key: string;
  name: string;
  enabled: boolean;
  allowedPrizes: string[];
  keyError: string;
}>({
  key: '',
  name: '',
  enabled: true,
  allowedPrizes: [],
  keyError: '',
});

const originalKey = ref('');

function openCreate() {
  editing.value = false;
  originalKey.value = '';
  form.key = '';
  form.name = '';
  form.enabled = true;
  form.allowedPrizes = [];
  form.keyError = '';
  editorVisible.value = true;
}

function openEdit(person: Person) {
  editing.value = true;
  originalKey.value = person.key;
  form.key = person.key;
  form.name = person.name;
  form.enabled = person.enabled;
  // 悬空的奖项 key 也带进来，用户可在编辑时顺手清理
  form.allowedPrizes = [...(person.allowedPrizes ?? [])];
  form.keyError = '';
  editorVisible.value = true;
}

function submitEditor() {
  const normalized = normalizeKey(form.key);
  if (!normalized.ok) {
    form.keyError = normalized.reason ?? '工号无效';
    return;
  }
  const name = form.name.trim();
  if (!name) {
    ElMessage.warning('请填写姓名');
    return;
  }

  const key = normalized.value;
  const duplicated = store.list.some(
    (p) => p.key === key && (!editing.value || p.key !== originalKey.value),
  );
  if (duplicated) {
    form.keyError = '该工号已存在';
    return;
  }

  if (editing.value) {
    const old = originalKey.value;
    commit(
      store.list.map((p) =>
        p.key === old
          ? {
              key,
              name,
              enabled: form.enabled,
              allowedPrizes: [...form.allowedPrizes],
            }
          : p,
      ),
    );
    // 改工号会让既有的中奖记录指向不存在的 key，提示但不阻断：
    // resultMeta 的姓名快照仍能让结果页正常显示
    if (old !== key && winnerCount(old) > 0) {
      ElMessage.warning(
        `工号已从 ${old} 改为 ${key}。该人员已有 ${winnerCount(old)} 次中奖记录，结果页将按抽奖当时的姓名快照显示。`,
      );
    }
  } else {
    commit([
      ...store.list,
      {
        key,
        name,
        enabled: form.enabled,
        allowedPrizes: [...form.allowedPrizes],
      },
    ]);
  }

  editorVisible.value = false;
  ElMessage.success(editing.value ? '已保存' : '已新增');
}

async function removeOne(person: Person) {
  const wins = winnerCount(person.key);
  const message =
    wins > 0
      ? `删除「${person.name}」？该人员已中 ${wins} 次奖。中奖记录会保留并显示抽奖当时的姓名快照。`
      : `确定删除「${person.name}」（${person.key}）？`;
  try {
    await ElMessageBox.confirm(message, '删除人员', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  commit(store.list.filter((p) => p.key !== person.key));
  ElMessage.success('已删除');
}

// ========== 批量操作 ==========

function batchSetEnabled(enabled: boolean) {
  const targets = new Set(selection.value.map((p) => p.key));
  commit(store.list.map((p) => (targets.has(p.key) ? { ...p, enabled } : p)));
  ElMessage.success(`已${enabled ? '启用' : '停用'} ${targets.size} 人`);
  selection.value = [];
}

async function batchDelete() {
  const count = selection.value.length;
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${count} 人？此操作不可撤销。`,
      '批量删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }
  const targets = new Set(selection.value.map((p) => p.key));
  commit(store.list.filter((p) => !targets.has(p.key)));
  selection.value = [];
  ElMessage.success(`已删除 ${count} 人`);
}

// ========== 照片 ==========

const photoVisible = ref(false);
const photoMode = ref<'batch' | 'single'>('batch');
const photoPerson = ref<Person | undefined>();
/** 递增以强制刷新图片（避免同名文件被浏览器缓存） */
const photoRevision = ref(0);

function avatarSrc(key: string): string {
  const url = avatarUrl(key);
  return url ? `${url}?v=${photoRevision.value}` : '';
}

const onAvatarError = handleAvatarError;

function openBatchPhotos() {
  photoMode.value = 'batch';
  photoPerson.value = undefined;
  photoVisible.value = true;
}

function openSinglePhoto(person: Person) {
  photoMode.value = 'single';
  photoPerson.value = person;
  photoVisible.value = true;
}

function onPhotosChanged(keys: string[]) {
  photoRevision.value++;
  if (keys.length === 0) return;
  // 名字变更时同步刷新列表里的显示
  void keys;
}

async function handleCleanOrphans() {
  if (!canWriteAvatars()) {
    ElMessage.info('当前环境不支持管理照片文件');
    return;
  }
  const orphans = await findOrphanAvatars(store.list);
  if (orphans.length === 0) {
    ElMessage.success('没有需要清理的照片');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `发现 ${orphans.length} 个名册中已不存在的人员照片：${orphans.slice(0, 10).join('、')}${orphans.length > 10 ? ' 等' : ''}。是否删除？`,
      '清理无用照片',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }
  const removed = await cleanOrphanAvatars(store.list);
  ElMessage.success(`已清理 ${removed.length} 张`);
}

// ========== 导入 / 备份 ==========

function applyImported(next: Person[]) {
  commit(next);
}

async function handleExport() {
  try {
    const target = await exportBackupToFile();
    ElMessage.success(`备份已导出：${target}`);
  } catch (error) {
    if (String(error) !== 'Error: 已取消保存') {
      ElMessage.error(
        `导出失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

async function handleRestore() {
  try {
    const payload = await pickBackupFile();
    if (!payload) return;
    await ElMessageBox.confirm(
      `将用备份覆盖当前数据：名单 ${payload.roster.length} 人、奖项 ${payload.prizes.length} 个、中奖记录 ${Object.values(payload.result).flat().length} 条。是否继续？`,
      '恢复备份',
      {
        confirmButtonText: '覆盖恢复',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
    restoreBackup(payload);
    store.setList(payload.roster);
    if (payload.prizes.length > 0) store.setPrizes(payload.prizes);
    store.setPrizeTombstones(payload.prizeTombstones);
    store.setConfig(payload.config);
    store.setResult(payload.result);
    store.setResultMeta(payload.resultMeta);
    store.setExcludeWinners(payload.excludeWinners);
    saveRoster(payload.roster);
    scheduleSnapshot();
    ElMessage.success('已恢复备份');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('cancel') || message.includes('取消')) return;
    ElMessage.error(`恢复失败：${message}`);
  }
}
</script>

<style scoped>
.people-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--ar-bg);
  color: var(--ar-text);
}

.people-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--ar-surface);
  border-bottom: 1px solid var(--ar-border);
}

.people-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.back-btn {
  color: var(--ar-text-regular);
}

.people-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  /* 窗口较窄时不希望标题被压成竖排或被挤没 */
  white-space: nowrap;
  flex-shrink: 0;
}

.people-header-right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.people-stats {
  padding: 10px 20px;
  font-size: 13px;
  color: var(--ar-text-secondary);
  background: var(--ar-surface);
  border-bottom: 1px solid var(--ar-border);
}

.people-stats strong {
  color: var(--ar-text);
  margin: 0 2px;
}
.people-stats .ok {
  color: var(--ar-success);
}
.people-stats .off {
  color: var(--ar-text-disabled);
}
.people-stats .win {
  color: var(--ar-accent-press);
}
.people-stats .dot {
  margin: 0 8px;
  opacity: 0.5;
}

.people-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
}

.people-search {
  width: 260px;
}

.people-batch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-count {
  font-size: 13px;
  color: var(--ar-text-secondary);
}

.people-table-wrap {
  flex: 1;
  padding: 0 20px 20px;
  min-height: 0;
}

.muted {
  color: var(--ar-text-disabled);
  font-size: 12px;
}

.prize-tag {
  margin-right: 4px;
}

.winner-badge {
  font-size: 12px;
  color: var(--ar-accent-press);
  background: rgba(226, 180, 87, 0.18);
  padding: 2px 8px;
  border-radius: var(--ar-radius-sm);
}

.empty-slot {
  padding: 48px 0;
  text-align: center;
}

.empty-title {
  font-size: 15px;
  color: var(--ar-text);
  margin: 0 0 6px;
}

.empty-desc {
  font-size: 13px;
  color: var(--ar-text-secondary);
  margin: 0 0 16px;
}

.empty-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.avatar-cell {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: var(--ar-radius-full);
  background: var(--ar-surface-sunken);
  cursor: pointer;
  display: block;
}

.avatar-cell:hover {
  outline: 2px solid var(--ar-accent);
  outline-offset: 1px;
}

.field-error {
  color: var(--ar-danger);
  font-size: 12px;
  line-height: 1.4;
  margin-top: 2px;
}

.prize-scope-hint {
  font-size: 12px;
  color: var(--ar-text-secondary);
  margin-bottom: 6px;
}

.prize-scope-list {
  display: flex;
  flex-direction: column;
}
</style>
