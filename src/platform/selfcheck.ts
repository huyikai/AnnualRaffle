/**
 * 桌面端全链路自检（仅开发模式）
 *
 * 背景：照片、背景、音频这些能力只在 Tauri 下可用，浏览器里跑不到，
 * 而原生窗口又无法在开发时自动点。因此把这几条链路在启动时真跑一遍，
 * 结果写进应用数据目录，终端可直接读取：
 *
 *   ① 造一张真实位图（Canvas）
 *   ② 走真实的 compressImage（Canvas → 最长边 512 → JPEG q0.85）
 *   ③ writeAvatar / writeCustomBackground 写入 app data
 *   ④ assetUrlSync 解析出的地址能被 <img> 加载并解码
 *   ⑤ listAvatarKeys / 孤儿检测 / 快照写入
 *
 * 六项全过才说明「导入照片」这条路在桌面端是通的。
 * 文件选择器对话框本身无法自动验证，需人工点一次。
 */

import { isTauri, appDataDirSync, assetUrlSync } from '@/platform';
import { compressImage } from '@/avatar/compress';
import {
  writeAvatar,
  listAvatarKeys,
  avatarUrl,
  findOrphanAvatars,
  removeAvatar,
} from '@/avatar/resolve';
import {
  writeCustomBackground,
  listCustomBackgrounds,
} from '@/data/appearance';
import { validateFile } from '@/avatar/validate';

export interface SelfCheckReport {
  ok: boolean;
  steps: Array<{ name: string; ok: boolean; detail: string; ms: number }>;
  finishedAt: string;
}

/** 用 Canvas 造一张真实的 PNG（不需要外部文件） */
async function makeTestImage(width = 1200, height = 800): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 上下文');

  // 画点有细节的内容，这样压缩才有意义（纯色块压缩后看不出差别）
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#5E0F08');
  gradient.addColorStop(1, '#E1A857');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 60; i++) {
    ctx.beginPath();
    ctx.arc(
      Math.random() * width,
      Math.random() * height,
      10 + Math.random() * 60,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.2})`;
    ctx.fill();
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('Canvas 导出 PNG 失败');
  return new Uint8Array(await blob.arrayBuffer());
}

/** 验证一个 URL 能被 <img> 加载并解码 */
function canLoad(url: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const img = new Image();
    const timer = setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

export async function runDesktopSelfCheck(): Promise<SelfCheckReport | null> {
  if (!isTauri()) return null;

  const steps: SelfCheckReport['steps'] = [];
  const record = (name: string, ok: boolean, detail: string, ms: number) =>
    steps.push({ name, ok, detail, ms });

  const probeKey = '__selfcheck__';

  try {
    // ① 造图
    let t = performance.now();
    const original = await makeTestImage();
    record(
      '造图',
      original.length > 0,
      `PNG ${(original.length / 1024).toFixed(0)} KB`,
      performance.now() - t,
    );

    // ② 格式校验
    t = performance.now();
    const validation = validateFile('selfcheck.png', original);
    record(
      '格式校验',
      validation.ok,
      validation.ok ? 'PNG 文件头识别通过' : (validation.reason ?? '未知'),
      performance.now() - t,
    );

    // ③ 压缩
    t = performance.now();
    const compressed = await compressImage(original);
    const shrunk = compressed.bytes.length < compressed.originalBytes;
    record(
      '压缩',
      shrunk && compressed.width <= 512,
      `${(compressed.originalBytes / 1024).toFixed(0)} KB → ${(compressed.bytes.length / 1024).toFixed(0)} KB，` +
        `${compressed.originalBytes ? '' : ''}${compressed.width}×${compressed.height}`,
      performance.now() - t,
    );

    // ④ 写头像
    t = performance.now();
    const written = await writeAvatar(probeKey, compressed.bytes);
    record(
      '写入头像',
      written,
      written ? 'app data/avatars 写入成功' : '写入失败',
      performance.now() - t,
    );

    // ⑤ 资产协议读回
    t = performance.now();
    const url = avatarUrl(probeKey);
    const loaded = await canLoad(url);
    record(
      '资产协议读回',
      loaded,
      loaded ? url.slice(0, 60) : `${url.slice(0, 60)} 加载失败`,
      performance.now() - t,
    );

    // ⑥ 列出 / 孤儿检测 / 清理
    t = performance.now();
    const keys = await listAvatarKeys();
    const orphans = await findOrphanAvatars([]);
    const cleaned = await removeAvatar(probeKey);
    const after = await listAvatarKeys();
    record(
      '枚举与清理',
      keys.includes(probeKey) &&
        orphans.includes(probeKey) &&
        cleaned &&
        !after.includes(probeKey),
      `列出 ${keys.length} 张 / 检出孤儿 ${orphans.length} 张 / 清理后 ${after.length} 张`,
      performance.now() - t,
    );

    // ⑦ 自定义背景写入
    t = performance.now();
    const bgName = await writeCustomBackground(
      'selfcheck.png',
      compressed.bytes,
    );
    const bgList = await listCustomBackgrounds();
    const bgUrl = bgName
      ? assetUrlSync(`${appDataDirSync()}/backgrounds/${bgName}`)
      : '';
    const bgLoaded = await canLoad(bgUrl);
    record(
      '自定义背景',
      !!bgName && bgList.includes(bgName) && bgLoaded,
      bgLoaded ? `${bgName} 写入并可加载` : '写入或加载失败',
      performance.now() - t,
    );

    // ⑧ 快照写入
    t = performance.now();
    const { snapshotNow } = await import('@/storage/backup');
    const snapshotFile = await snapshotNow();
    record(
      '自动快照',
      !!snapshotFile,
      snapshotFile ? (snapshotFile.split('/').pop() ?? '写入成功') : '写入失败',
      performance.now() - t,
    );
  } catch (error) {
    record(
      '异常',
      false,
      error instanceof Error ? error.message : String(error),
      0,
    );
  }

  const report: SelfCheckReport = {
    ok: steps.every((step) => step.ok),
    steps,
    finishedAt: new Date().toISOString(),
  };

  await writeReport(report);
  return report;
}

/** 把自检结果写到 app data，供终端读取 */
async function writeReport(report: SelfCheckReport): Promise<void> {
  try {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');
    const dir = appDataDirSync();
    if (!dir) return;
    await writeTextFile(
      await join(dir, 'selfcheck.json'),
      JSON.stringify(report, null, 2),
    );
  } catch {
    /* 写不出去就算了，不影响主流程 */
  }
}
