/**
 * 外观设置持久化
 *
 * 只存「引用」不存图片数据：背景本体要么打包在产物里，要么躺在应用数据目录。
 * 导出备份时带走的是文件名，导入后在另一台机器上会重新匹配到磁盘文件。
 */

import { getData, setData } from '@/helper/index';
import type { FitMode, BackgroundItem } from '@/data/appearance';
import { DEFAULT_BACKGROUND_ID } from '@/data/appearance';

export const appearanceField = 'appearance';

export interface StoredAppearance {
  backgroundId: string;
  /** 自定义背景文件名 */
  customBackground?: string;
  fitMode: FitMode;
}

export const DEFAULT_APPEARANCE: StoredAppearance = {
  backgroundId: DEFAULT_BACKGROUND_ID,
  fitMode: 'cover',
};

export function loadAppearance(): StoredAppearance {
  const stored = getData(appearanceField) as Partial<StoredAppearance> | null;
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_APPEARANCE };
  }
  return {
    backgroundId: stored.backgroundId || DEFAULT_BACKGROUND_ID,
    customBackground: stored.customBackground || undefined,
    fitMode: (stored.fitMode as FitMode) || 'cover',
  };
}

export function saveAppearance(value: StoredAppearance): void {
  setData(appearanceField, value);
}

/**
 * 从存储还原出完整的背景项。
 *
 * 预设背景按 id 从静态表里找；自定义背景用文件名拼出路径。
 * 找不到对应文件时回落到默认背景，避免出现「设置指向一张不存在的图」。
 */
export function resolveBackground(
  appearance: StoredAppearance,
  presets: BackgroundItem[],
  customUrlBuilder: (fileName: string) => string,
): BackgroundItem | null {
  if (appearance.customBackground) {
    const url = customUrlBuilder(appearance.customBackground);
    if (url) {
      return {
        id: `custom-${appearance.customBackground}`,
        name: '自定义背景',
        builtin: false,
        src: url,
      };
    }
  }

  const preset =
    presets.find((item) => item.id === appearance.backgroundId) ??
    presets.find((item) => item.id === DEFAULT_BACKGROUND_ID) ??
    presets[0];

  return preset ?? null;
}
