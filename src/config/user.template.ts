/**
 * 用户数据模板文件
 * 
 * 使用说明：
 * 1. 将此文件复制为 user.ts
 * 2. 在 user 数组中添加你的用户数据
 * 3. 在 luckyExclude 数组中添加需要排除的用户（可选）
 * 
 * 数据结构说明：
 * - key: 用户唯一标识（数字），建议使用员工ID或抽奖号码
 * - name: 用户姓名（字符串）
 * 
 * 注意事项：
 * - key 值必须唯一，不能重复
 * - 如果不需要姓名，可以设置为空字符串，但 key 必须存在
 * - luckyExclude 数组中的用户将不会参与抽奖
 */

export interface UserItem {
  key: number;
  name: string;
}

/**
 * 用户列表
 * 请在此处添加你的用户数据
 * 
 * 格式示例：
 * export const user: UserItem[] = [
 *   { key: 1001, name: '张三' },
 *   { key: 1002, name: '李四' },
 *   { key: 1003, name: '王五' },
 *   // ... 更多用户
 * ];
 */
export const user: UserItem[] = [
  // 请在此处添加用户数据
  // 示例：
  // { key: 1001, name: '张三' },
  // { key: 1002, name: '李四' },
];

/**
 * 排除抽奖的用户列表（可选）
 * 这些用户将不会参与任何抽奖
 * 
 * 格式示例：
 * export const luckyExclude: UserItem[] = [
 *   { key: 1001, name: '张三' },
 *   // ... 更多需要排除的用户
 * ];
 */
export const luckyExclude: UserItem[] = [
  // 请在此处添加需要排除的用户（可选）
];
