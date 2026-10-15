/**
 * 头像工具函数
 *
 * 统一收口，供 TagCanvas 标签、结果卡、预设选择弹窗等处调用。
 * 具体的路径解析交给 avatar/resolve.ts —— 桌面端与应用数据目录联动，
 * 网页版沿用 public/user/ 约定。
 */

import { avatarUrl } from '@/avatar/resolve';

const baseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : import.meta.env.BASE_URL + '/';

/** 默认头像 */
export const defaultAvatarUrl = baseUrl + 'default-avatar.png';

/**
 * 获取人员头像 URL
 * @param key 工号
 */
export function getUserAvatarUrl(key: number | string): string {
  return avatarUrl(String(key));
}

/**
 * 处理头像加载失败，回退到默认头像。
 * 用 dataset 标记避免默认头像自身失败时陷入死循环。
 */
export function handleAvatarError(event: Event): void {
  const img = event.target as HTMLImageElement;
  if (!img || img.dataset.fallbackApplied === '1') {
    return;
  }
  img.dataset.fallbackApplied = '1';
  if (img.src !== defaultAvatarUrl) {
    img.src = defaultAvatarUrl;
  }
}
