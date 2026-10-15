/**
 * 全局类型声明
 */

/**
 * TagCanvas 通过 window 读取默认头像。
 * 旧版在两处用 `(window as any).__defaultAvatarUrl = ...` 注入，
 * 这里声明成正式的全局成员，去掉 as any。
 */
declare global {
  interface Window {
    /** 头像加载失败时的回退图片 URL */
    __defaultAvatarUrl?: string;
  }
}

export {};
