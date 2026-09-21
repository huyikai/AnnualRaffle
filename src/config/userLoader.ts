/**
 * 用户配置加载器
 * 当 user.ts 文件不存在时，自动回退到 user.example.ts
 *
 * 使用 import.meta.glob 声明可选配置，避免构建工具在 user.ts 不存在时解析失败。
 */

import type { UserItem } from './user.example';
import { user as exampleUser, excludedUsers as exampleExcludedUsers } from './user.example';

interface UserModule {
  user: UserItem[];
  excludedUsers?: UserItem[];
}

const userModules = import.meta.glob<UserModule>('./user.ts', { eager: true });
const userModule = userModules['./user.ts'];

if (userModule) {
  console.log('使用 src/config/user.ts 中的用户配置');
}
else {
  console.log('user.ts 文件不存在，使用 user.example.ts 作为默认配置');
}

const user = userModule?.user ?? exampleUser;
const excludedUsers = userModule?.excludedUsers ?? exampleExcludedUsers;

export { user, excludedUsers };
export type { UserItem };
