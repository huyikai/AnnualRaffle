<template>
  <el-dialog
    v-model="dialogVisible"
    :title="mode === 'batch' ? '批量导入照片' : `${person?.name ?? ''} 的照片`"
    width="720px"
    class="c-PhotoDialog"
  >
    <!-- ===== 单人模式 ===== -->
    <template v-if="mode === 'single'">
      <div class="single-preview">
        <img
          :src="singlePreviewUrl"
          class="single-img"
          alt=""
          @error="onPreviewError"
        />
        <div class="single-actions">
          <el-button size="small" type="primary" @click="pickSingle">
            {{ hasExisting ? '更换照片' : '选择照片' }}
          </el-button>
          <el-button size="small" :disabled="!hasExisting" @click="clearSingle"
            >清除照片</el-button
          >
        </div>
        <p class="single-hint">
          支持 JPG / PNG / WebP，≤10 MB。会等比压缩到最长边 512px 后保存。
        </p>
      </div>
    </template>

    <!-- ===== 批量模式 ===== -->
    <template v-else>
      <div class="batch-toolbar">
        <el-button
          size="small"
          type="primary"
          :disabled="!canWrite"
          @click="pickFolder"
        >
          选择照片文件夹
        </el-button>
        <el-button size="small" :disabled="!canWrite" @click="pickFiles"
          >选择多个文件</el-button
        >
        <span v-if="!canWrite" class="batch-note">
          当前环境不支持写入照片文件（网页版仅支持读取 public/user/ 下的图片）
        </span>
      </div>

      <div v-if="entries.length > 0" class="batch-summary">
        <span>共 {{ entries.length }} 个文件</span>
        <span class="dot">·</span>
        <span class="ok">按工号匹配 {{ counts.key }}</span>
        <span class="dot">·</span>
        <span class="ok">按工号+姓名 {{ counts.keyName }}</span>
        <span class="dot">·</span>
        <span class="warn">按姓名 {{ counts.name }}</span>
        <span class="dot">·</span>
        <span class="bad">未匹配 {{ counts.unmatched }}</span>
      </div>

      <el-table
        v-if="entries.length > 0"
        :data="entries"
        height="300"
        size="small"
        class="batch-table"
      >
        <el-table-column
          prop="fileName"
          label="文件"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column label="匹配方式" width="100">
          <template #default="{ row }">
            <span class="match-tag" :class="`is-${(row as Entry).strategy}`">
              {{ STRATEGY_LABEL[(row as Entry).strategy] }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="结果" min-width="150">
          <template #default="{ row }">
            <span v-if="row.error" class="bad">{{ row.error }}</span>
            <span v-else-if="row.skipped" class="warn">{{ row.skipped }}</span>
            <span v-else-if="row.saved" class="ok">
              已保存 {{ formatBytes(row.savedBytes) }}
              <span v-if="row.shrunk" class="shrink"
                >（原 {{ formatBytes(row.originalBytes) }}）</span
              >
            </span>
          </template>
        </el-table-column>
      </el-table>

      <div v-else-if="running" class="batch-progress">
        <el-progress :percentage="progress" :stroke-width="6" />
        <p class="batch-note">正在校验并压缩 {{ progress }} / {{ pending }}…</p>
      </div>

      <el-empty v-else description="还没有选择文件" :image-size="80" />
    </template>

    <template #footer>
      <template v-if="mode === 'batch'">
        <el-button @click="dialogVisible = false">关闭</el-button>
        <el-button
          type="primary"
          :disabled="!canWrite || matchedCount === 0 || running"
          @click="runImport"
        >
          导入 {{ matchedCount }} 张
        </el-button>
      </template>
      <template v-else>
        <el-button @click="dialogVisible = false">关闭</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { Person } from '@/data/person';
import { matchFiles, STRATEGY_LABEL } from '@/avatar/match';
import type { MatchResult } from '@/avatar/match';
import { validateFile, validateDecodable } from '@/avatar/validate';
import { compressImage, formatBytes } from '@/avatar/compress';
import {
  avatarUrl,
  canWriteAvatars,
  writeAvatar,
  removeAvatar,
  avatarPath,
} from '@/avatar/resolve';
import { isTauri } from '@/platform';
import { defaultAvatarUrl } from '@/utils/avatar';

const props = defineProps<{
  visible: boolean;
  mode: 'batch' | 'single';
  /** 单人模式的目标人员 */
  person?: Person;
  /** 当前名册，批量匹配时提供工号与姓名索引 */
  roster: Person[];
  /** 单人模式：外部变更计数，用于强制刷新预览 */
  revision?: number;
}>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
  changed: [keys: string[]];
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const canWrite = ref(canWriteAvatars());

/** 批量模式的状态 */
interface Entry extends MatchResult {
  /** 绝对路径（Tauri）或 File 对象（网页） */
  source: unknown;
  error?: string;
  skipped?: string;
  saved?: boolean;
  savedBytes?: number;
  originalBytes?: number;
  shrunk?: boolean;
}

const entries = ref<Entry[]>([]);
const running = ref(false);
const progress = ref(0);
const pending = ref(0);

const counts = computed(() => {
  const base = { key: 0, keyName: 0, name: 0, unmatched: 0 };
  for (const row of entries.value) {
    if (row.strategy === 'key') base.key++;
    else if (row.strategy === 'key-name') base.keyName++;
    else if (row.strategy === 'name') base.name++;
    else base.unmatched++;
  }
  return base;
});

const matchedCount = computed(
  () => entries.value.filter((e) => !!e.key).length,
);

// ---- 单人模式 ----

const singlePreviewUrl = ref('');
const hasExisting = ref(false);

const onPreviewError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  if (img.src !== defaultAvatarUrl) img.src = defaultAvatarUrl;
};

async function refreshSingle() {
  if (props.mode !== 'single' || !props.person) return;
  const key = props.person.key;
  // 加时间戳避免同名文件被浏览器缓存住
  singlePreviewUrl.value =
    avatarUrl(key) + (avatarUrl(key) ? `?v=${props.revision ?? 0}` : '');
  hasExisting.value = false;
  const path = await avatarPath(key);
  if (path) {
    try {
      const { exists } = await import('@tauri-apps/plugin-fs');
      hasExisting.value = await exists(path);
    } catch {
      hasExisting.value = false;
    }
  }
}

async function pickSingle() {
  if (!props.person) return;
  try {
    if (isTauri()) {
      const [{ open }, { readFile }] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs'),
      ]);
      const selected = await open({
        multiple: false,
        filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      });
      if (!selected || Array.isArray(selected)) return;
      const bytes = await readFile(selected);
      const ok = await saveOne(
        props.person.key,
        selected.split('/').pop() ?? 'photo',
        bytes,
      );
      if (ok) {
        refreshSingle();
        emit('changed', [props.person.key]);
      }
      return;
    }

    const bytes = await pickViaInput(false);
    if (!bytes) return;
    const ok = await saveOne(props.person.key, bytes.name, bytes.bytes);
    if (ok) {
      refreshSingle();
      emit('changed', [props.person.key]);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error));
  }
}

async function clearSingle() {
  if (!props.person) return;
  if (await removeAvatar(props.person.key)) {
    singlePreviewUrl.value = defaultAvatarUrl;
    hasExisting.value = false;
    ElMessage.success('已清除照片');
    emit('changed', [props.person.key]);
  }
}

/** 校验 → 压缩 → 写入，返回是否成功 */
async function saveOne(
  key: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<boolean> {
  const basic = validateFile(fileName, bytes);
  if (!basic.ok) {
    ElMessage.error(`${fileName}：${basic.reason}`);
    return false;
  }
  const decodable = await validateDecodable(bytes);
  if (!decodable.ok) {
    ElMessage.error(`${fileName}：${decodable.reason}`);
    return false;
  }
  try {
    const compressed = await compressImage(bytes);
    const written = await writeAvatar(key, compressed.bytes);
    if (!written) {
      ElMessage.error(`${fileName}：写入失败，请检查应用是否具有文件权限`);
      return false;
    }
    const saved = formatBytes(compressed.bytes.length);
    const original = formatBytes(compressed.originalBytes);
    ElMessage.success(
      compressed.bytes.length < compressed.originalBytes
        ? `已保存（${original} → ${saved}）`
        : `已保存（${original}）`,
    );
    return true;
  } catch (error) {
    ElMessage.error(
      `${fileName}：处理失败（${error instanceof Error ? error.message : error}）`,
    );
    return false;
  }
}

// ---- 批量：文件选择 ----

async function pickFolder() {
  if (!isTauri()) return pickViaInput(true);
  const [{ open }, { readDir }, pathApi] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
    import('@tauri-apps/api/path'),
  ]);
  const selected = await open({ directory: true, multiple: false });
  if (!selected || Array.isArray(selected)) return;

  const items = (await readDir(selected)) as Array<{
    name?: string;
    isFile?: boolean;
  }>;
  const namespaced = items.filter((item) => item.isFile && item.name);
  // Tauri v2 的 join 是异步的，必须逐个 await
  const files: SelectedFile[] = await Promise.all(
    namespaced.map(async (item) => ({
      name: item.name!,
      path: await pathApi.join(selected, item.name!),
    })),
  );

  applySelection(files);
}

async function pickFiles() {
  if (!isTauri()) return pickViaInput(true);
  const [{ open }] = await Promise.all([import('@tauri-apps/plugin-dialog')]);
  const selected = await open({
    multiple: true,
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
  });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  applySelection(
    paths.map((path) => ({ name: path.split('/').pop() ?? path, path })),
  );
}

interface SelectedFile {
  name: string;
  path?: string;
  file?: File;
}

function applySelection(files: SelectedFile[]) {
  const summary = matchFiles(
    files.map((f) => f.name),
    props.roster,
  );
  entries.value = summary.results.map((result, index) => ({
    ...result,
    source: files[index],
  }));
  progress.value = 0;
  pending.value = 0;
  webBytes.value = [];
}

async function pickViaInput(
  multiple: boolean,
): Promise<{ name: string; bytes: Uint8Array } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (multiple) {
      input.multiple = true;
      input.setAttribute('webkitdirectory', '');
    }
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const list = Array.from(input.files ?? []);
      document.body.removeChild(input);
      if (list.length === 0) {
        resolve(null);
        return;
      }
      Promise.all(
        list.map(async (file) => ({
          name: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
          file,
        })),
      ).then((items) => {
        if (multiple) {
          applySelection(
            items.map((item) => ({ name: item.name, file: item.file })),
          );
          webBytes.value = items;
        } else {
          resolve(items[0]);
        }
      });
    });
    document.body.appendChild(input);
    input.click();
  });
}

/** 网页版批量：字节与表格分开存，读取留到真正执行时 */
const webBytes = ref<Array<{ name: string; bytes: Uint8Array }>>([]);

// ---- 批量：执行 ----

async function readBytes(row: Entry): Promise<Uint8Array | null> {
  const source = row.source as { path?: string; file?: File };
  if (source?.path) {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    return readFile(source.path);
  }
  if (source?.file) {
    return new Uint8Array(await source.file.arrayBuffer());
  }
  // 网页版批量：按顺序从 webBytes 里取
  const index = entries.value.indexOf(row);
  return webBytes.value[index]?.bytes ?? null;
}

async function runImport() {
  const targets = entries.value.filter((row) => row.key);
  if (targets.length === 0) return;

  running.value = true;
  progress.value = 0;
  pending.value = targets.length;

  let saved = 0;
  let failed = 0;

  for (const row of targets) {
    const bytes = await readBytes(row);
    if (!bytes) {
      row.error = '无法读取文件内容';
      failed++;
    } else {
      const basic = validateFile(row.fileName, bytes);
      if (!basic.ok) {
        row.error = basic.reason;
        failed++;
      } else {
        const decodable = await validateDecodable(bytes);
        if (!decodable.ok) {
          row.error = decodable.reason;
          failed++;
        } else {
          try {
            const compressed = await compressImage(bytes);
            const written = await writeAvatar(row.key!, compressed.bytes);
            if (written) {
              row.saved = true;
              row.savedBytes = compressed.bytes.length;
              row.originalBytes = compressed.originalBytes;
              row.shrunk = compressed.bytes.length < compressed.originalBytes;
              saved++;
            } else {
              row.error = '写入失败';
              failed++;
            }
          } catch (error) {
            row.error = error instanceof Error ? error.message : String(error);
            failed++;
          }
        }
      }
    }
    progress.value++;
  }

  running.value = false;
  pending.value = 0;

  const bits = [`成功 ${saved} 张`];
  if (failed > 0) bits.push(`失败 ${failed} 张`);
  if (failed > 0) ElMessage.warning(bits.join(' · '));
  else ElMessage.success(bits.join(' · '));

  if (saved > 0) {
    emit(
      'changed',
      targets.filter((r) => r.saved).map((r) => r.key!),
    );
  }
}

// ---- 打开时初始化 ----

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return;
    canWrite.value = canWriteAvatars();
    if (props.mode === 'single') {
      await refreshSingle();
    } else {
      entries.value = [];
      webBytes.value = [];
      progress.value = 0;
    }
  },
);
</script>

<style scoped>
.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.batch-note {
  font-size: 12px;
  color: var(--ar-text-secondary);
}

.batch-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--ar-text-secondary);
  padding: 8px 2px;
}
.batch-summary .dot {
  opacity: 0.5;
}
.batch-summary .ok {
  color: var(--ar-success);
}
.batch-summary .warn {
  color: var(--ar-warning);
}
.batch-summary .bad {
  color: var(--ar-danger);
}

.match-tag {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: var(--ar-radius-sm);
}
.match-tag.is-key {
  color: var(--ar-success);
  background: rgba(62, 142, 90, 0.12);
}
.match-tag.is-key-name {
  color: var(--ar-success);
  background: rgba(62, 142, 90, 0.12);
}
.match-tag.is-name {
  color: var(--ar-warning);
  background: rgba(200, 138, 46, 0.14);
}
.match-tag.is-none {
  color: var(--ar-danger);
  background: var(--ar-danger-bg);
}

.batch-table {
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
}

.ok {
  color: var(--ar-success);
}
.warn {
  color: var(--ar-warning);
}
.bad {
  color: var(--ar-danger);
}
.shrink {
  color: var(--ar-text-disabled);
  font-size: 11px;
}

.batch-progress {
  padding: 24px 4px;
}

.single-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}

.single-img {
  width: 160px;
  height: 160px;
  object-fit: contain;
  border-radius: var(--ar-radius-md);
  background: var(--ar-surface-sunken);
}

.single-actions {
  display: flex;
  gap: 8px;
}

.single-hint {
  font-size: 12px;
  color: var(--ar-text-secondary);
  margin: 0;
}
</style>
