/**
 * 运行环境适配层
 *
 * 同一份前端要同时跑在两处：
 *   - Tauri 桌面端（macOS / Windows）：有原生文件系统与资产协议
 *   - GitHub Pages 网页版：只有浏览器能力，文件系统不可用
 *
 * 所有 Tauri API 一律动态 import 并在 isTauri() 之后调用，
 * 这样网页版构建不会因为 import 到原生模块而报错，
 * 未使用的原生代码也会被 Vite 拆成独立 chunk。
 */

/** 是否运行在 Tauri 桌面端 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// 应用数据目录与资产协议转换函数在启动时缓存一次，
// 让后续所有「解析头像 URL」都能走同步接口——
// 模板里几百个 <img> 没法各自 await。
let cachedAppDataDir: string | null = null;
let cachedConvertFileSrc: ((path: string, protocol?: string) => string) | null =
  null;

/** 已缓存的应用数据目录；未初始化或非桌面端时为 null */
export function appDataDirSync(): string | null {
  return cachedAppDataDir;
}

/**
 * 同步地把绝对路径转成可加载的资产 URL。
 * 启动自检尚未完成时原样返回，图片加载失败会回退到默认头像。
 */
export function assetUrlSync(absolutePath: string): string {
  if (!cachedConvertFileSrc) return absolutePath;
  return cachedConvertFileSrc(absolutePath);
}

/** 应用数据目录；网页版返回 null */
export async function getAppDataDir(): Promise<string | null> {
  if (!isTauri()) return null;
  const { appDataDir } = await import('@tauri-apps/api/path');
  return appDataDir();
}

/**
 * 初始化原生环境。
 *
 * 目前只做一件事：向 Rust 取一次应用数据目录并确保其存在。
 * 这个调用同时验证了 invoke 通路、权限配置与路径解析是否正常——
 * 若这三者任一出问题，应用会在启动时立刻拿到 null 并在控制台报警，
 * 而不是等到阶段 3 导入照片时才暴露。
 */
export async function initPlatform(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const [{ invoke }, { appDataDir }, core] = await Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/path'),
      import('@tauri-apps/api/core'),
    ]);
    cachedConvertFileSrc = core.convertFileSrc;
    // Rust 侧会确保目录存在，并打印路径供启动日志观察
    const dir = await invoke<string>('app_data_dir');
    cachedAppDataDir = dir ?? (await appDataDir());
    return cachedAppDataDir;
  } catch (error) {
    console.error('[platform] 原生环境初始化失败：', error);
    return null;
  }
}

/**
 * 把应用数据目录下的绝对路径转换为可被 <img> / <video> 加载的 URL。
 *
 * 依赖 tauri.conf.json 中 app.security.assetProtocol：
 *   enable: true
 *   scope:  ["$APPDATA/**", "$APPCONFIG/**"]
 * scope 漏配是这一步最常见的失败原因，表现为图片静默不显示。
 */
export async function assetUrl(absolutePath: string): Promise<string> {
  if (!isTauri()) return absolutePath;
  const { convertFileSrc } = await import('@tauri-apps/api/core');
  return convertFileSrc(absolutePath);
}

/** 拼接应用数据目录下的路径（跨平台安全，不手动拼分隔符） */
export async function appPath(...segments: string[]): Promise<string | null> {
  if (!isTauri()) return null;
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const base = await appDataDir();
  return segments.length > 0 ? join(base, ...segments) : base;
}

/** 确保应用数据目录下的子目录存在 */
export async function ensureAppDir(
  ...segments: string[]
): Promise<string | null> {
  if (!isTauri()) return null;
  const { mkdir } = await import('@tauri-apps/plugin-fs');
  const target = await appPath(...segments);
  if (!target) return null;
  await mkdir(target, { recursive: true });
  return target;
}
