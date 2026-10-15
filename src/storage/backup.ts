/**
 * 数据备份与自动快照
 *
 * 备份内容只包含「不可再生」的数据——名单、奖项配置、中奖记录。
 * 照片与音频不入快照：体积过大，且可以从源目录重新导入。
 *
 * 桌面端写入应用数据目录的 backups/，滚动保留最近 10 份；
 * 网页版没有文件系统，自动快照不可用，只保留手动下载。
 */

import { getData, setData } from '@/helper/index';
import type { Person } from '@/data/person';
import type { Prize, PrizeTombstones } from '@/data/prizes';
import type { LotteryConfigType } from '@/config/lottery';
import type { ResultKeys, ResultMeta } from '@/storage/result';
import { isTauri } from '@/platform';

export const BACKUP_VERSION = 2;
export const SNAPSHOT_KEEP = 10;
export const SNAPSHOT_DEBOUNCE_MS = 3000;

/** 备份文件结构 */
export interface BackupPayload {
  version: number;
  exportedAt: string;
  roster: Person[];
  prizes: Prize[];
  prizeTombstones: PrizeTombstones;
  config: LotteryConfigType;
  result: ResultKeys;
  resultMeta: ResultMeta;
  excludeWinners: boolean;
}

/** 汇总各存储来源，产出可导出的备份对象 */
export function buildBackup(): BackupPayload {
  const pick = <T>(key: string, fallback: T): T => {
    const value = getData(key);
    return value === null || value === undefined ? fallback : (value as T);
  };

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    roster: pick<Person[]>('roster', []),
    prizes: pick<Prize[]>('prizes', []),
    prizeTombstones: pick<PrizeTombstones>('prizeTombstones', {}),
    config: pick<LotteryConfigType>('config', {} as LotteryConfigType),
    result: pick<ResultKeys>('result', {}),
    resultMeta: pick<ResultMeta>('resultMeta', {}),
    excludeWinners: pick<boolean>('excludeWinners', true),
  };
}

/** 校验外部备份文件的结构 */
export function validateBackup(input: unknown): BackupPayload | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const payload = input as Partial<BackupPayload>;
  if (!Array.isArray(payload.roster)) return null;
  if (payload.version !== undefined && typeof payload.version !== 'number')
    return null;

  return {
    version: typeof payload.version === 'number' ? payload.version : 1,
    exportedAt:
      typeof payload.exportedAt === 'string' ? payload.exportedAt : '',
    roster: payload.roster.filter(
      (item): item is Person =>
        !!item && typeof item.key === 'string' && typeof item.name === 'string',
    ),
    prizes: Array.isArray(payload.prizes) ? payload.prizes : [],
    prizeTombstones:
      payload.prizeTombstones && typeof payload.prizeTombstones === 'object'
        ? payload.prizeTombstones
        : {},
    config:
      payload.config && typeof payload.config === 'object'
        ? (payload.config as LotteryConfigType)
        : ({} as LotteryConfigType),
    result:
      payload.result && typeof payload.result === 'object'
        ? (payload.result as ResultKeys)
        : {},
    resultMeta:
      payload.resultMeta && typeof payload.resultMeta === 'object'
        ? (payload.resultMeta as ResultMeta)
        : {},
    excludeWinners:
      typeof payload.excludeWinners === 'boolean'
        ? payload.excludeWinners
        : true,
  };
}

/** 把备份内容写回各存储 */
export function restoreBackup(payload: BackupPayload): void {
  setData('roster', payload.roster);
  if (payload.prizes.length > 0) setData('prizes', payload.prizes);
  setData('prizeTombstones', payload.prizeTombstones);
  setData('config', payload.config);
  setData('result', payload.result);
  setData('resultMeta', payload.resultMeta);
  setData('excludeWinners', payload.excludeWinners);
}

// ========== 手动导出 / 导入 ==========

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * 手动导出：桌面端写入应用数据目录，网页端触发浏览器下载。
 * @returns 保存位置的可读描述
 */
export async function exportBackupToFile(): Promise<string> {
  const payload = buildBackup();
  const json = JSON.stringify(payload, null, 2);
  const fileName = `年会抽奖-备份-${stamp()}.json`;

  if (isTauri()) {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const { appDataDir } = await import('@tauri-apps/api/path');
    const { join } = await import('@tauri-apps/api/path');

    const defaultPath = await join(await appDataDir(), 'backups', fileName);
    const target = await save({
      defaultPath,
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    });
    if (!target) throw new Error('已取消保存');
    await writeTextFile(target, json);
    return target;
  }

  // 网页端：Blob 下载
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return fileName;
}

/**
 * 选择并读取一个备份文件。
 * @returns 解析并校验后的备份内容；用户取消时返回 null
 */
export async function pickBackupFile(): Promise<BackupPayload | null> {
  let text: string;

  if (isTauri()) {
    const [{ open }, { readTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    const selected = await open({
      multiple: false,
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    });
    if (!selected || Array.isArray(selected)) return null;
    text = await readTextFile(selected);
  } else {
    const picked = await pickFileViaInput();
    if (!picked) return null;
    text = picked;
  }

  try {
    return validateBackup(JSON.parse(text));
  } catch {
    throw new Error('文件不是有效的 JSON');
  }
}

/** 网页端用隐藏的 file input 选文件 */
function pickFileViaInput(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(file, 'utf-8');
    });
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

// ========== 自动快照 ==========

let snapshotTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 安排一次自动快照。
 *
 * 批量导入 200 人会连续触发数十次变更，不做节流就会同步写盘数十次。
 * 这里用静默期合并：最后一次变更后 3 秒才落盘。
 *
 * 网页端没有文件系统，调用会被静默跳过（仅手动导出可用）。
 */
export function scheduleSnapshot(): void {
  if (!isTauri()) return;
  if (snapshotTimer) clearTimeout(snapshotTimer);

  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    void writeSnapshot();
  }, SNAPSHOT_DEBOUNCE_MS);
}

/** 立即落盘一份快照 */
export async function writeSnapshot(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs');
    const { appDataDir, join } = await import('@tauri-apps/api/path');

    const dir = await join(await appDataDir(), 'backups');
    await mkdir(dir, { recursive: true });

    const file = await join(dir, `snapshot-${stamp()}.json`);
    await writeTextFile(file, JSON.stringify(buildBackup()));

    await pruneSnapshots(dir);
    return file;
  } catch (error) {
    console.warn('[backup] 自动快照失败：', error);
    return null;
  }
}

/** 滚动清理，只保留最近 SNAPSHOT_KEEP 份 */
async function pruneSnapshots(dir: string): Promise<void> {
  const { readDir, remove } = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');

  const entries = (await readDir(dir)) as Array<{
    name?: string;
    isFile?: boolean;
  }>;
  const snapshots = entries
    .filter((entry) => entry.name?.startsWith('snapshot-'))
    // 文件名内嵌时间戳，字典序即时间序
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

  const excess = snapshots.length - SNAPSHOT_KEEP;
  for (let i = 0; i < excess; i++) {
    const target = await join(dir, snapshots[i].name!);
    await remove(target);
  }
}

/** 手动触发一次快照（设置页的「立即备份」按钮） */
export async function snapshotNow(): Promise<string | null> {
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;
  }
  return writeSnapshot();
}
