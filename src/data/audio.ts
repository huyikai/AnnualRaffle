/**
 * 自定义音频
 *
 * 年会几乎一定要放公司自己的音乐，内置的 BGM 只是占位。
 * 桌面端允许上传替换；网页版没有文件系统，只能用内置的。
 */

import { isTauri, appDataDirSync, assetUrlSync } from '@/platform';

export const AUDIO_SUBDIR = 'audio';

/** 浏览器原生可解码的音频格式 */
export const ALLOWED_AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'flac',
  'webm',
] as const;

/** 单个音频上限 30 MB（年会 BGM 通常 3–8 MB） */
export const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

/** 各格式的文件头特征 */
const MAGIC: Array<{ ext: string; head: number[]; offset?: number }> = [
  { ext: 'mp3', head: [0x49, 0x44, 0x33] }, // ID3
  { ext: 'mp3', head: [0xff, 0xfb] }, // 帧同步
  { ext: 'wav', head: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  { ext: 'ogg', head: [0x4f, 0x67, 0x67, 0x53] }, // OggS
  { ext: 'm4a', head: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp
  { ext: 'flac', head: [0x66, 0x4c, 0x61, 0x43] }, // fLaC
  { ext: 'webm', head: [0x1a, 0x45, 0xdf, 0xa3] }, // EBML
];

export interface AudioValidation {
  ok: boolean;
  reason?: string;
}

function extOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index > 0 ? fileName.slice(index + 1).toLowerCase() : '';
}

/**
 * 校验音频文件。
 *
 * 扩展名 + 文件头双重判断：只信扩展名的话，改个名就能把任意文件塞进来，
 * 而 <audio> 解码失败时没有任何用户可见的报错。
 */
export function validateAudio(
  fileName: string,
  bytes: Uint8Array,
): AudioValidation {
  const ext = extOf(fileName);
  if (!ext) return { ok: false, reason: '没有扩展名，无法识别格式' };
  if (!(ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      ok: false,
      reason: `不支持的格式 .${ext}（支持 ${ALLOWED_AUDIO_EXTENSIONS.join(' / ')}）`,
    };
  }
  if (bytes.length === 0) return { ok: false, reason: '文件为空' };
  if (bytes.length > MAX_AUDIO_BYTES) {
    return {
      ok: false,
      reason: `文件 ${(bytes.length / 1024 / 1024).toFixed(1)} MB，超过 ${MAX_AUDIO_BYTES / 1024 / 1024} MB 上限`,
    };
  }

  const matched = MAGIC.some((rule) => {
    const offset = rule.offset ?? 0;
    if (bytes.length < offset + rule.head.length) return false;
    return rule.head.every((byte, index) => bytes[offset + index] === byte);
  });

  if (!matched) {
    return { ok: false, reason: '文件内容不是有效的音频（扩展名可能被改过）' };
  }
  return { ok: true };
}

export function customAudioPath(fileName: string): Promise<string | null> {
  const dir = appDataDirSync();
  if (!dir) return Promise.resolve(null);
  return import('@tauri-apps/api/path').then(({ join }) =>
    join(dir, AUDIO_SUBDIR, fileName),
  );
}

export function customAudioUrl(fileName: string): string {
  const dir = appDataDirSync();
  if (!dir) return '';
  return assetUrlSync(`${dir}/${AUDIO_SUBDIR}/${fileName}`);
}

function hashBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  const limit = Math.min(bytes.length, 4096);
  for (let i = 0; i < limit; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** 写入自定义音频，返回持久化用的文件名 */
export async function writeCustomAudio(
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
    const folder = await join(dir, AUDIO_SUBDIR);
    await mkdir(folder, { recursive: true });

    const ext = extOf(originalName) || 'mp3';
    const base = originalName
      .replace(/\.[^.]+$/, '')
      .slice(0, 24)
      .replace(/[^\w一-龥-]/g, '_');
    const name = `${base}-${hashBytes(bytes)}.${ext}`;
    await writeFile(await join(folder, name), bytes);
    return name;
  } catch (error) {
    console.warn('[audio] 写入失败:', error);
    return null;
  }
}

export async function removeCustomAudio(fileName: string): Promise<boolean> {
  const path = await customAudioPath(fileName);
  if (!path) return false;
  try {
    const { remove, exists } = await import('@tauri-apps/plugin-fs');
    if (!(await exists(path))) return true;
    await remove(path);
    return true;
  } catch (error) {
    console.warn('[audio] 删除失败:', error);
    return false;
  }
}

export async function listCustomAudio(): Promise<string[]> {
  const dir = appDataDirSync();
  if (!dir) return [];
  try {
    const [{ readDir }, { join }] = await Promise.all([
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/api/path'),
    ]);
    const entries = (await readDir(await join(dir, AUDIO_SUBDIR))) as Array<{
      name?: string;
      isFile?: boolean;
    }>;
    return entries
      .filter((entry) => entry.isFile && entry.name)
      .map((entry) => entry.name!);
  } catch {
    return [];
  }
}
