/**
 * 背景与外观
 *
 * 12 张预设背景用 import.meta.glob 以静态 import 方式打进产物——
 * 不用运行时的动态加载，避免首屏等网络；用 glob 而不是逐个 import，
 * 是为了新增或改名素材时不必改代码。
 */

import { isTauri, appDataDirSync, assetUrlSync } from '@/platform';

export type FitMode = 'cover' | 'contain' | 'stretch';

export const FIT_MODES: Array<{ value: FitMode; label: string; hint: string }> =
  [
    {
      value: 'cover',
      label: '铺满',
      hint: '等比铺满窗口，裁掉溢出部分，不变形（推荐）',
    },
    { value: 'contain', label: '完整', hint: '整张图完整显示，可能留边' },
    { value: 'stretch', label: '拉伸', hint: '拉伸填满，会变形（旧行为）' },
  ];

export interface BackgroundItem {
  /** 'preset-01' … 'preset-12' | 'custom-<hash>' */
  id: string;
  name: string;
  builtin: boolean;
  /** 预设背景的打包 URL */
  src?: string;
  /** 自定义背景在应用数据目录下的绝对路径 */
  path?: string;
}

/** Vite 会把这里的键按字典序排好，再编号保证顺序稳定 */
const presetModules = import.meta.glob<string>(
  '@/assets/backgrounds/*.{jpg,jpeg,png,webp}',
  { eager: true, query: '?url', import: 'default' },
);

const PRESET_NAMES = [
  '红云祥纹',
  '红灯笼',
  '舞台光束',
  '几何金线',
  '丝绒帷幕',
  '烟花',
  '祥云满月',
  '流光',
  '剪纸窗花',
  '锦鲤',
  '金色光斑',
  '远山明月',
];

/** 12 张预设背景，按文件名排序后与中文名一一对应 */
export const PRESET_BACKGROUNDS: BackgroundItem[] = Object.keys(presetModules)
  .sort()
  .map((path, index) => ({
    id: `preset-${String(index + 1).padStart(2, '0')}`,
    name: PRESET_NAMES[index] ?? `预设背景 ${index + 1}`,
    builtin: true,
    src: presetModules[path],
  }));

/** 默认背景 */
export const DEFAULT_BACKGROUND_ID = PRESET_BACKGROUNDS[0]?.id ?? '';

// ========== 自定义背景 ==========

export const BG_SUBDIR = 'backgrounds';

/** 自定义背景的绝对路径 */
export async function customBackgroundPath(
  fileName: string,
): Promise<string | null> {
  const dir = appDataDirSync();
  if (!dir) return null;
  const { join } = await import('@tauri-apps/api/path');
  return join(dir, BG_SUBDIR, fileName);
}

/** 自定义背景的可加载 URL */
export function customBackgroundUrl(fileName: string): string {
  const dir = appDataDirSync();
  if (!dir) return '';
  return assetUrlSync(`${dir}/${BG_SUBDIR}/${fileName}`);
}

/** 写入一张自定义背景，返回用于持久化的文件名 */
export async function writeCustomBackground(
  originalName: string,
  bytes: Uint8Array,
): Promise<string | null> {
  const dir = appDataDirSync();
  if (!dir || !isTauri()) return null;
  try {
    const [{ mkdir, writeFile }, { join }] = await Promise.all([
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/api/path'),
    ]);
    const folder = await join(dir, BG_SUBDIR);
    await mkdir(folder, { recursive: true });

    // 文件名带内容哈希：同名重复上传会覆盖而不是堆积，
    // 同时保留原始基名便于用户在设置页辨认
    const base = originalName
      .replace(/\.[^.]+$/, '')
      .slice(0, 24)
      .replace(/[^\w一-龥-]/g, '_');
    const name = `custom-${base}-${hashBytes(bytes)}.jpg`;
    await writeFile(await join(folder, name), bytes);
    return name;
  } catch (error) {
    console.warn('[appearance] 写入自定义背景失败:', error);
    return null;
  }
}

/** 删除一张自定义背景 */
export async function removeCustomBackground(
  fileName: string,
): Promise<boolean> {
  const path = await customBackgroundPath(fileName);
  if (!path) return false;
  try {
    const { remove, exists } = await import('@tauri-apps/plugin-fs');
    if (!(await exists(path))) return true;
    await remove(path);
    return true;
  } catch (error) {
    console.warn('[appearance] 删除自定义背景失败:', error);
    return false;
  }
}

/** 列出磁盘上的自定义背景文件名 */
export async function listCustomBackgrounds(): Promise<string[]> {
  const dir = appDataDirSync();
  if (!dir) return [];
  try {
    const [{ readDir }, { join }] = await Promise.all([
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/api/path'),
    ]);
    const entries = (await readDir(await join(dir, BG_SUBDIR))) as Array<{
      name?: string;
      isFile?: boolean;
    }>;
    return entries
      .filter((entry) => entry.isFile && entry.name?.startsWith('custom-'))
      .map((entry) => entry.name!);
  } catch {
    return [];
  }
}

/** FNV-1a 32 位哈希，用于给自定义文件生成稳定文件名 */
function hashBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  // 只取前 4 KB 参与哈希，够用且避免遍历整张图
  const limit = Math.min(bytes.length, 4096);
  for (let i = 0; i < limit; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

// ========== 解析 ==========

/** 把背景项解析成可直接给 CSS 的 url() */
export function backgroundCssUrl(
  item: BackgroundItem | null | undefined,
): string {
  if (!item) return '';
  if (item.builtin && item.src) return `url(${item.src})`;
  if (item.path) return `url(${assetUrlSync(item.path)})`;
  return '';
}

/** fitMode → CSS background-size */
export function fitToBackgroundSize(mode: FitMode): string {
  if (mode === 'contain') return 'contain';
  if (mode === 'stretch') return '100% 100%';
  return 'cover';
}
