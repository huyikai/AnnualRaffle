/**
 * 头像工具函数
 * 统一管理用户头像 URL 和加载错误处理
 */

const baseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : import.meta.env.BASE_URL + '/';

/** 默认头像 URL */
export const defaultAvatarUrl = baseUrl + 'default-avatar.png';

/**
 * 获取用户头像 URL
 * @param userId 用户 ID
 * @returns 头像 URL
 */
export function getUserAvatarUrl(userId: number | string): string {
  return `${baseUrl}user/${userId}.jpg`;
}

/**
 * 处理头像加载错误，回退到默认头像
 * @param event 图片加载错误事件
 */
export function handleAvatarError(event: Event): void {
  const img = event.target as HTMLImageElement;
  if (img && img.src !== defaultAvatarUrl) {
    img.src = defaultAvatarUrl;
  }
}
