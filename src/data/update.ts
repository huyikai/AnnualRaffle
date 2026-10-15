/**
 * 检查新版本
 *
 * 走 GitHub Releases API 的公开接口：无需鉴权、CORS 允许任意源，
 * 因此网页版和桌面端都能直接 fetch，不需要额外后端。
 *
 * 注意：无签名安装包无法使用 Tauri 内置 updater（需要 minisign 密钥），
 * 所以这里只做「提示 + 给下载链接」，由用户自己下载替换。
 */

import { REPO, APP_VERSION } from '@/config/release';

export interface UpdateInfo {
  current: string;
  latest: string;
  /** 最新 Release 的页面地址 */
  url: string;
  publishedAt?: string;
  /** Release notes 的纯文本片段 */
  notes?: string;
}

/** 解析 `v1.2.3` / `1.2.3` / `1.2.3-beta.1` */
export function parseVersion(tag: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(tag.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** a > b 返回正数 */
export function compareVersion(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** 把 Release notes 的 Markdown 压成纯文本摘要 */
function summarize(markdown: string | undefined): string | undefined {
  if (!markdown) return undefined;
  const text = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[#>\-*]+\s*/gm, '')
    .trim();
  if (!text) return undefined;
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

/**
 * 查询最新 Release。
 * @returns 有新版时返回信息；已是最新返回 null；网络失败抛错由调用方处理
 */
export async function checkLatestRelease(
  repo: string = REPO,
  current: string = APP_VERSION,
): Promise<UpdateInfo | null> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/releases/latest`,
    {
      headers: { Accept: 'application/vnd.github+json' },
    },
  );

  if (response.status === 404) {
    throw new Error('仓库尚未发布任何 Release');
  }
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('请求过于频繁，请稍后再试');
    }
    throw new Error(`查询失败（HTTP ${response.status}）`);
  }

  const release = (await response.json()) as {
    tag_name?: string;
    html_url?: string;
    published_at?: string;
    body?: string;
  };

  const latest = release.tag_name ?? '';
  if (!latest) return null;

  // compareVersion > 0 才算有更新
  if (compareVersion(latest, current) <= 0) return null;

  return {
    current,
    latest,
    url: release.html_url ?? `https://github.com/${repo}/releases`,
    publishedAt: release.published_at,
    notes: summarize(release.body),
  };
}
