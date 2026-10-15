/**
 * 外观设置（单例）
 *
 * 与 useAudio 同一套模式：模块级共享状态，多个视图读写的是同一份。
 */

import { ref, computed } from 'vue';
import {
  PRESET_BACKGROUNDS,
  DEFAULT_BACKGROUND_ID,
  customBackgroundUrl,
  writeCustomBackground,
  removeCustomBackground,
  listCustomBackgrounds,
  fitToBackgroundSize,
} from '@/data/appearance';
import type { BackgroundItem, FitMode } from '@/data/appearance';
import {
  loadAppearance,
  saveAppearance,
  resolveBackground,
} from '@/storage/appearance';
import type { StoredAppearance } from '@/storage/appearance';
import { isTauri } from '@/platform';

const stored = ref<StoredAppearance>(loadAppearance());
/** 自定义背景文件名列表（磁盘上的全部） */
const customFiles = ref<string[]>([]);
/** 强制刷新计数，给 <img> 加缓存穿透参数 */
const revision = ref(0);

const currentBackground = computed<BackgroundItem | null>(() =>
  resolveBackground(stored.value, PRESET_BACKGROUNDS, customBackgroundUrl),
);

const fitMode = computed<FitMode>(() => stored.value.fitMode);

const backgroundImageCss = computed(() => {
  const item = currentBackground.value;
  if (!item?.src) return 'none';
  return `url(${item.src}${item.src.includes('?') ? '&' : '?'}v=${revision.value})`;
});

const backgroundSizeCss = computed(() =>
  fitToBackgroundSize(stored.value.fitMode),
);

const canCustomize = computed(() => isTauri());

function persist(next: Partial<StoredAppearance>) {
  stored.value = { ...stored.value, ...next };
  saveAppearance(stored.value);
  revision.value++;
}

/** 从磁盘刷新自定义背景列表 */
async function refreshCustom() {
  customFiles.value = await listCustomBackgrounds();
}

/** 选择一张预设背景 */
function usePreset(id: string) {
  persist({ backgroundId: id, customBackground: undefined });
}

/** 选择一张已上传的自定义背景 */
function useCustom(fileName: string) {
  persist({ customBackground: fileName });
}

/** 上传自定义背景，返回是否成功 */
async function uploadCustom(
  fileName: string,
  bytes: Uint8Array,
): Promise<boolean> {
  const storedName = await writeCustomBackground(fileName, bytes);
  if (!storedName) return false;
  await refreshCustom();
  persist({ customBackground: storedName });
  return true;
}

/** 删除一张自定义背景 */
async function removeCustom(fileName: string): Promise<boolean> {
  const ok = await removeCustomBackground(fileName);
  if (ok) {
    if (stored.value.customBackground === fileName) {
      persist({ customBackground: undefined });
    }
    await refreshCustom();
    revision.value++;
  }
  return ok;
}

function setFitMode(mode: FitMode) {
  persist({ fitMode: mode });
}

export function useAppearance() {
  return {
    presets: PRESET_BACKGROUNDS,
    defaultId: DEFAULT_BACKGROUND_ID,
    stored,
    currentBackground,
    fitMode,
    backgroundImageCss,
    backgroundSizeCss,
    customFiles,
    canCustomize,
    revision,
    refreshCustom,
    usePreset,
    useCustom,
    uploadCustom,
    removeCustom,
    setFitMode,
  };
}
