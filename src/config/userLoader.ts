/**
 * 用户配置加载器
 * 当 user.ts 文件不存在时，自动回退到 user.example.ts
 * 
 * 实现方式：
 * 1. 优先尝试导入 user.ts
 * 2. 如果导入失败（文件不存在），则使用 user.example.ts 作为后备
 * 
 * 注意：使用 top-level await 来同步等待动态导入完成，确保导出的值是正确的。
 */

import type { UserItem } from './user.example';
import { user as exampleUser, excludedUsers as exampleExcludedUsers } from './user.example';

// 使用 top-level await 来同步等待动态导入完成
let user: UserItem[];
let excludedUsers: UserItem[];

try {
  const userModule = await import('./user');
  user = userModule.user;
  excludedUsers = userModule.excludedUsers || exampleExcludedUsers;
} catch (error) {
  // 如果 user.ts 不存在或导入失败，使用示例数据
  console.log('user.ts 文件不存在，使用 user.example.ts 作为默认配置');
  user = exampleUser;
  excludedUsers = exampleExcludedUsers;
}

export { user, excludedUsers };
export type { UserItem };
