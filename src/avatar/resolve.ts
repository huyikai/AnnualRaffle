/**
 * 头像存储与解析（双轨）
 *
 *   桌面端：应用数据目录 avatars/{工号}.jpg，经资产协议读取
 *   网页版：沿用 public/user/{工号}.jpg 约定（只读，由构建时提供）
 *
 * 压缩后一律存为 JPEG，因此文件名固定为 {工号}.jpg，
 * 解析时不需要探测扩展名。
 */

import { isTauri, appDataDirSync, assetUrlSync } from '@/platform';
import type { Person } from '@/data/person';

export const AVATAR_SUBDIR = 'avatars';

/** 站点资源前缀，网页版用它拼 public/ 下的路径 */
function webBase(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return base.endsWith('/') ? base : base + '/';
}

/** 头像在应用数据目录下的绝对路径 */
export async function avatarPath(key: string): Promise<string | null> {
  const dir = appDataDirSync();
  if (!dir) return null;
  const { join } = await import('@tauri-apps/api/path');
  return join(dir, AVATAR_SUBDIR, `${key}.jpg`);
}

/**
 * 头像的可加载 URL（同步）。
 *
 * 模板里每个标签、每张结果卡都会调用它，必须同步。
 * 桌面端启动自检未完成时返回空串，img 的 onerror 会回退到默认头像。
 */
export function avatarUrl(key: string): string {
  if (!key) return '';
  const dir = appDataDirSync();
  if (dir) {
    return assetUrlSync(`${dir}/${AVATAR_SUBDIR}/${key}.jpg`);
  }
  return `${webBase()}user/${key}.jpg`;
}

/** 桌面端是否具备写入能力 */
export function canWriteAvatars(): boolean {
  return isTauri() && !!appDataDirSync();
}

/** 写入一张头像（传入压缩后的 JPEG 字节） */
export async function writeAvatar(
  key: string,
  bytes: Uint8Array,
): Promise<boolean> {
  const dir = appDataDirSync();
  if (!dir) return false;
  try {
    const [{ mkdir, writeFile }, { join }] = await Promise.all([
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/api/path'),
    ]);
    const target = await join(dir, AVATAR_SUBDIR, `${key}.jpg`);
    await mkdir(await join(dir, AVATAR_SUBDIR), { recursive: true });
    await writeFile(target, bytes);
    return true;
  } catch (error) {
    console.warn('[avatar] 写入失败:', key, error);
    return false;
  }
}

/** 删除某人的头像 */
export async function removeAvatar(key: string): Promise<boolean> {
  const path = await avatarPath(key);
  if (!path) return false;
  try {
    const { remove, exists } = await import('@tauri-apps/plugin-fs');
    if (!(await exists(path))) return true;
    await remove(path);
    return true;
  } catch (error) {
    console.warn('[avatar] 删除失败:', key, error);
    return false;
  }
}

/** 列出磁盘上已有的头像工号 */
export async function listAvatarKeys(): Promise<string[]> {
  const dir = appDataDirSync();
  if (!dir) return [];
  try {
    const [{ readDir }, { join }] = await Promise.all([
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/api/path'),
    ]);
    const folder = await join(dir, AVATAR_SUBDIR);
    const entries = (await readDir(folder)) as Array<{
      name?: string;
      isFile?: boolean;
    }>;
    return entries
      .filter(
        (entry) => entry.isFile && entry.name?.toLowerCase().endsWith('.jpg'),
      )
      .map((entry) => entry.name!.replace(/\.jpg$/i, ''));
  } catch {
    return [];
  }
}

/**
 * 找出「磁盘上有、名册里没有」的头像（孤儿）。
 *
 * 典型来源：IT 先导照片、行政后导名单，且名单里没有那个人。
 * 孤儿照片不占多少空间，但会让人以为「导入没生效」。
 */
export async function findOrphanAvatars(roster: Person[]): Promise<string[]> {
  const keys = await listAvatarKeys();
  const known = new Set(roster.map((person) => person.key));
  return keys.filter((key) => !known.has(key));
}

/** 清理孤儿头像，返回清理掉的工号列表 */
export async function cleanOrphanAvatars(roster: Person[]): Promise<string[]> {
  const orphans = await findOrphanAvatars(roster);
  const removed: string[] = [];
  for (const key of orphans) {
    if (await removeAvatar(key)) removed.push(key);
  }
  return removed;
}
