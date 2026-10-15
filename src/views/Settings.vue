<template>
  <div class="settings-page">
    <header class="settings-header">
      <div class="settings-header-left">
        <el-button text class="back-btn" @click="router.push('/')"
          >← 返回抽奖</el-button
        >
        <h1 class="settings-title">设置</h1>
      </div>
    </header>

    <el-tabs v-model="tab" class="settings-tabs">
      <!-- ===== 背景 ===== -->
      <el-tab-pane label="背景" name="background">
        <section class="block">
          <h2 class="block-title">适配方式</h2>
          <el-radio-group
            :model-value="fitMode"
            @change="(v: FitMode) => setFitMode(v)"
          >
            <el-radio-button
              v-for="m in FIT_MODES"
              :key="m.value"
              :value="m.value"
            >
              {{ m.label }}
            </el-radio-button>
          </el-radio-group>
          <p class="block-hint">{{ currentHint }}</p>
        </section>

        <section class="block">
          <h2 class="block-title">
            预设背景
            <span class="block-sub">共 {{ presets.length }} 张</span>
          </h2>
          <div class="bg-grid">
            <button
              v-for="item in presets"
              :key="item.id"
              class="bg-cell"
              :class="{ 'is-active': isActivePreset(item) }"
              @click="usePreset(item.id)"
            >
              <img :src="item.src" :alt="item.name" loading="lazy" />
              <span class="bg-name">{{ item.name }}</span>
            </button>
          </div>
        </section>

        <section class="block">
          <h2 class="block-title">
            自定义背景
            <span v-if="!canCustomize" class="block-sub"
              >当前环境不支持上传</span
            >
          </h2>
          <div class="custom-row">
            <el-button
              size="small"
              type="primary"
              :disabled="!canCustomize"
              @click="pickCustom"
            >
              上传背景图
            </el-button>
            <span class="block-hint">
              支持 JPG / PNG / WebP，会等比压缩到最长边 1920px
              后存入应用数据目录
            </span>
          </div>

          <div v-if="customFiles.length > 0" class="bg-grid">
            <button
              v-for="name in customFiles"
              :key="name"
              class="bg-cell"
              :class="{ 'is-active': stored.customBackground === name }"
              @click="selectCustom(name)"
            >
              <img :src="customUrl(name)" :alt="name" loading="lazy" />
              <span class="bg-name" :title="name">{{ shortName(name) }}</span>
              <span class="bg-remove" title="删除" @click.stop="removeOne(name)"
                >×</span
              >
            </button>
          </div>
        </section>
      </el-tab-pane>

      <!-- ===== 音频 ===== -->
      <el-tab-pane label="音频" name="audio">
        <section class="block">
          <div class="row-between">
            <span class="row-label">静音</span>
            <el-switch :model-value="isMuted" @change="toggleMute" />
          </div>
        </section>

        <section class="block">
          <div class="row-between">
            <div>
              <div class="row-label">背景音乐音量</div>
              <div class="block-hint">年会现场通常压低，避免盖住主持人</div>
            </div>
            <div class="row-control">
              <el-slider
                :model-value="bgmVolume"
                :min="0"
                :max="100"
                :show-tooltip="true"
                :format-tooltip="(v: number) => `${v}%`"
                class="vol-slider"
                @input="(v: number) => setBgmVolume(v)"
              />
              <el-button size="small" @click="previewBgm">试听</el-button>
            </div>
          </div>

          <div class="row-between">
            <div>
              <div class="row-label">音效音量</div>
              <div class="block-hint">抽奖开始音，需盖过背景音乐</div>
            </div>
            <div class="row-control">
              <el-slider
                :model-value="sfxVolume"
                :min="0"
                :max="100"
                :show-tooltip="true"
                :format-tooltip="(v: number) => `${v}%`"
                class="vol-slider"
                @input="(v: number) => setSfxVolume(v)"
              />
              <el-button size="small" @click="previewSfx">试听</el-button>
            </div>
          </div>
        </section>

        <section class="block">
          <h2 class="block-title">自定义音频</h2>
          <div v-if="!canCustomize" class="block-hint">
            网页版无法上传音频文件，只能使用内置音乐与音效
          </div>

          <div class="audio-slot">
            <div class="row-between">
              <div>
                <div class="row-label">背景音乐</div>
                <div class="block-hint">
                  {{ customBgm || '当前：内置音乐' }}
                </div>
              </div>
              <div class="row-control">
                <el-button
                  size="small"
                  :disabled="!canCustomize"
                  @click="pickCustomBgm"
                >
                  {{ customBgm ? '更换' : '上传' }}
                </el-button>
                <el-button v-if="customBgm" size="small" text @click="resetBgm"
                  >恢复默认</el-button
                >
              </div>
            </div>
          </div>

          <div class="audio-slot">
            <div class="row-between">
              <div>
                <div class="row-label">抽奖音效</div>
                <div class="block-hint">
                  {{ customSfx || '当前：内置音效' }}
                </div>
              </div>
              <div class="row-control">
                <el-button
                  size="small"
                  :disabled="!canCustomize"
                  @click="pickCustomSfx"
                >
                  {{ customSfx ? '更换' : '上传' }}
                </el-button>
                <el-button v-if="customSfx" size="small" text @click="resetSfx"
                  >恢复默认</el-button
                >
              </div>
            </div>
          </div>
        </section>
      </el-tab-pane>

      <!-- ===== 关于 ===== -->
      <el-tab-pane label="关于" name="about">
        <section class="block">
          <h2 class="block-title">年会抽奖</h2>
          <p class="about-text">
            桌面客户端与网页版并行。桌面端支持人员管理、照片头像、自定义背景与音乐，
            数据保存在本机应用数据目录中，不上传任何服务器。
          </p>
          <div class="about-row">
            <span>版本</span><span>{{ APP_VERSION }}</span>
          </div>
          <div class="about-row">
            <span>运行环境</span
            ><span>{{ isTauriApp ? '桌面客户端' : '网页版' }}</span>
          </div>
          <div class="about-row">
            <span>已内置背景</span><span>{{ presets.length }} 张</span>
          </div>
        </section>

        <section class="block">
          <h2 class="block-title">数据备份</h2>
          <p class="about-hint">
            <template v-if="canCustomize">
              每次修改名单后会自动在应用数据目录的 backups/ 下滚动保留最近 10
              份快照。
            </template>
            <template v-else>
              网页版无法写入文件系统，仅支持手动导出备份文件。
            </template>
          </p>
          <div class="about-actions">
            <el-button size="small" @click="handleExport"
              >导出备份文件</el-button
            >
            <el-button v-if="canCustomize" size="small" @click="handleSnapshot">
              创建本地快照
            </el-button>
            <el-button size="small" @click="handleRestore"
              >从备份恢复</el-button
            >
          </div>
        </section>

        <section class="block">
          <h2 class="block-title">版本更新</h2>
          <p class="about-hint">
            未签名的安装包无法自动更新，请下载新版本后手动替换。
          </p>
          <div class="about-actions">
            <el-button
              size="small"
              type="primary"
              :loading="checking"
              @click="checkUpdate"
            >
              检查新版本
            </el-button>
          </div>
          <div v-if="updateInfo" class="update-card">
            <p class="update-title">发现新版本 {{ updateInfo.latest }}</p>
            <p class="update-sub">
              当前 {{ updateInfo.current
              }}<span v-if="updateInfo.publishedAt">
                · 发布于 {{ formatDate(updateInfo.publishedAt) }}</span
              >
            </p>
            <p v-if="updateInfo.notes" class="update-notes">
              {{ updateInfo.notes }}
            </p>
            <el-button
              size="small"
              type="primary"
              tag="a"
              :href="updateInfo.url"
              target="_blank"
              rel="noopener"
            >
              前往下载
            </el-button>
          </div>
        </section>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { FIT_MODES, customBackgroundUrl } from '@/data/appearance';
import type { FitMode, BackgroundItem } from '@/data/appearance';
import { useAppearance } from '@/composables/useAppearance';
import { useAudio } from '@/composables/useAudio';
import { validateAudio } from '@/data/audio';
import { checkLatestRelease } from '@/data/update';
import type { UpdateInfo } from '@/data/update';
import { APP_VERSION } from '@/config/release';
import { useLotteryStore } from '@/stores/lottery';
import {
  exportBackupToFile,
  pickBackupFile,
  restoreBackup,
  snapshotNow,
} from '@/storage/backup';
import { isTauri } from '@/platform';

const router = useRouter();
const store = useLotteryStore();
const tab = ref('background');
const isTauriApp = isTauri();

const {
  presets,
  stored,
  fitMode,
  customFiles,
  canCustomize,
  refreshCustom,
  usePreset,
  useCustom,
  uploadCustom,
  removeCustom,
  setFitMode,
} = useAppearance();

const {
  isMuted,
  bgmVolume,
  sfxVolume,
  customBgm,
  customSfx,
  toggleMute,
  setBgmVolume,
  setSfxVolume,
  setCustomBgm,
  setCustomSfx,
  previewBgm,
  previewSfx,
  stopPreview,
} = useAudio();

const currentHint = computed(
  () => FIT_MODES.find((m) => m.value === fitMode.value)?.hint ?? '',
);

const isActivePreset = (item: BackgroundItem) =>
  !stored.value.customBackground && stored.value.backgroundId === item.id;

/**
 * 自定义背景的缓存版本号。
 *
 * 这些图走的是磁盘文件（桌面端 asset 协议），同名覆盖后浏览器仍会命中旧缓存，
 * 所以需要一个「内容真的变了才变」的版本号。之前这里直接用 Date.now()，
 * 结果每次响应式更新都给所有缩略图换一个新 URL：缓存永远不命中，
 * 切个 tab、动个音量就把磁盘上的图重新下一遍，图片还会闪一下。
 */
const customRevision = ref(0);
const bumpCustomRevision = () => {
  customRevision.value++;
};

const customUrl = (name: string) =>
  `${customBackgroundUrl(name)}?v=${customRevision.value}`;

const shortName = (name: string) => {
  const stripped = name.replace(/^custom-/, '').replace(/\.[^.]+$/, '');
  return stripped.length > 16 ? `${stripped.slice(0, 16)}…` : stripped;
};

const selectCustom = (name: string) => useCustom(name);

// ---- 自定义背景上传 ----

async function pickCustom() {
  if (!isTauri()) return;
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
  const name = selected.split('/').pop() ?? 'background';
  const size = bytes.length;
  if (size > 20 * 1024 * 1024) {
    ElMessage.error('背景图超过 20 MB，请先压缩');
    return;
  }
  if (await uploadCustom(name, bytes)) {
    bumpCustomRevision();
    ElMessage.success('背景已更新');
  } else {
    ElMessage.error('保存失败，请重试');
  }
}

async function removeOne(name: string) {
  try {
    await ElMessageBox.confirm('删除这张自定义背景？', '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  if (await removeCustom(name)) {
    bumpCustomRevision();
    ElMessage.success('已删除');
  }
}

// ---- 自定义音频上传 ----

async function pickAudio(
  onDone: (fileName: string) => Promise<void>,
  label: string,
) {
  if (!isTauri()) return;
  const [{ open }, { readFile }, audioFs] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
    import('@/data/audio'),
  ]);
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: '音频',
        extensions: [...audioFs.ALLOWED_AUDIO_EXTENSIONS] as string[],
      },
    ],
  });
  if (!selected || Array.isArray(selected)) return;

  const name = selected.split('/').pop() ?? 'audio';
  const bytes = await readFile(selected);
  const validation = validateAudio(name, bytes);
  if (!validation.ok) {
    ElMessage.error(`${label}：${validation.reason}`);
    return;
  }
  const storedName = await audioFs.writeCustomAudio(name, bytes);
  if (!storedName) {
    ElMessage.error('保存失败');
    return;
  }
  await onDone(storedName);
  ElMessage.success(`${label}已更新`);
}

const pickCustomBgm = () => pickAudio(setCustomBgm, '背景音乐');
const pickCustomSfx = () => pickAudio(setCustomSfx, '抽奖音效');
const resetBgm = () => setCustomBgm('');
const resetSfx = () => setCustomSfx('');

// ---- 备份 ----

async function handleExport() {
  try {
    const target = await exportBackupToFile();
    ElMessage.success(`备份已导出：${target}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('取消')) ElMessage.error(`导出失败：${message}`);
  }
}

/** 立即落盘一份快照（不等 3 秒 debounce） */
async function handleSnapshot() {
  const file = await snapshotNow();
  if (file) ElMessage.success('已创建快照');
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
    // 只落盘不更新 store 的话，用户不刷新就继续编辑，内存里的旧值会在
    // 下一次 commit 时把刚恢复的数据覆盖掉，且全程没有任何提示。
    store.applyBackup(payload);
    ElMessage.success('已恢复备份');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('cancel') || message.includes('取消')) return;
    ElMessage.error(`恢复失败：${message}`);
  }
}

// ---- 版本更新 ----

const checking = ref(false);
const updateInfo = ref<UpdateInfo | null>(null);

const formatDate = (iso: string) => iso.slice(0, 10);

async function checkUpdate() {
  checking.value = true;
  updateInfo.value = null;
  try {
    const info = await checkLatestRelease();
    if (info) {
      updateInfo.value = info;
      ElMessage.success(`发现新版本 ${info.latest}`);
    } else {
      ElMessage.success('当前已是最新版本');
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error));
  } finally {
    checking.value = false;
  }
}

onMounted(() => {
  void refreshCustom();
});

// 试听是一次性音频，不会随组件销毁而停止。
// 不在这里收尾的话，离开设置页后音乐会继续在后台放完剩下的 5 秒。
onBeforeUnmount(() => {
  stopPreview();
});
</script>

<style scoped>
.settings-page {
  height: 100vh;
  background: var(--ar-bg);
  color: var(--ar-text);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  padding: 12px 20px;
  background: var(--ar-surface);
  border-bottom: 1px solid var(--ar-border);
}

.settings-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
}

.back-btn {
  color: var(--ar-text-regular);
}

.settings-tabs {
  flex: 1;
  padding: 0 20px;
  overflow-y: auto;
  min-height: 0;
}

.block {
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-md);
  padding: 16px 18px;
  margin: 16px 0;
}

.block-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.block-sub {
  font-size: 12px;
  font-weight: 400;
  color: var(--ar-text-secondary);
}

.block-hint {
  font-size: 12px;
  color: var(--ar-text-secondary);
  margin: 8px 0 0;
}

.bg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 12px;
  margin-top: 8px;
}

.bg-cell {
  position: relative;
  border: 2px solid var(--ar-border);
  border-radius: var(--ar-radius-md);
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  background: var(--ar-surface-sunken);
}

.bg-cell:hover {
  border-color: var(--ar-accent);
}

.bg-cell.is-active {
  border-color: var(--ar-accent);
  box-shadow: 0 0 0 1px var(--ar-accent);
}

.bg-cell img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.bg-name {
  display: block;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--ar-text-regular);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bg-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: var(--ar-radius-full);
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 14px;
  line-height: 18px;
  text-align: center;
}

.bg-remove:hover {
  background: var(--ar-danger);
}

.custom-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}

.row-label {
  font-size: 13px;
  color: var(--ar-text);
}

.row-control {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.vol-slider {
  width: 160px;
}

.audio-slot {
  padding: 4px 0;
  border-top: 1px solid var(--ar-border);
}

.audio-slot:first-of-type {
  border-top: none;
}

.about-text {
  font-size: 13px;
  line-height: 1.8;
  color: var(--ar-text-secondary);
  margin: 0 0 14px;
}

.about-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 6px 0;
  color: var(--ar-text-regular);
}

.about-hint {
  font-size: 12px;
  color: var(--ar-text-secondary);
  margin: 0 0 10px;
}

.about-actions {
  display: flex;
  gap: 8px;
}

.update-card {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--ar-accent);
  border-radius: var(--ar-radius-md);
  background: rgba(226, 180, 87, 0.08);
}

.update-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ar-text);
  margin: 0 0 4px;
}

.update-sub {
  font-size: 12px;
  color: var(--ar-text-secondary);
  margin: 0 0 8px;
}

.update-notes {
  font-size: 12px;
  line-height: 1.7;
  color: var(--ar-text-regular);
  margin: 0 0 10px;
  white-space: pre-wrap;
}
</style>
