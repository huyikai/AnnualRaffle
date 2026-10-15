/**
 * 奖项模型与「奖项增删」健壮性处理
 *
 * 根因：自定义奖项的 key 由 randomPrizeKey() 随机生成。删除某奖项后再新增同名奖项，
 * 两者 key 完全不同，于是人员 allowedPrizes 里的旧 key 变成悬空引用——
 * 用户会看到「我明明没勾这个奖项，为什么不能参加」。
 *
 * 四条对策集中实现在本模块，调用方（人员编辑弹窗、奖项管理）只负责呈现。
 */

import type { Person } from './person';

/** 奖项定义 */
export interface Prize {
  key: string;
  name: string;
  /** 内置奖项可删除，但支持一键恢复；自定义奖项不可恢复 */
  builtin?: boolean;
}

/** 已删除奖项的 key → 名称，用于把悬空引用显示成「已失效：幸运奖第三轮」 */
export type PrizeTombstones = Record<string, string>;

/** 人员可参与奖项的解析结果 */
export interface AllowedPrizesResolution {
  /** 当前真实存在的奖项 key */
  active: string[];
  /** 指向已删除奖项的悬空 key */
  orphaned: Array<{ key: string; name: string }>;
}

/**
 * 解析人员可参与奖项，分离出仍然有效的与悬空的。
 * @param allowedPrizes 人员上配置的奖项 key 列表（空数组 = 全部奖项）
 * @param prizes 当前存在的奖项
 * @param tombstones 已删除奖项的名称映射
 */
export function resolveAllowedPrizes(
  allowedPrizes: string[] | undefined,
  prizes: Prize[],
  tombstones: PrizeTombstones = {},
): AllowedPrizesResolution {
  // 空数组 / 未设置 = 参与全部奖项
  if (!allowedPrizes || allowedPrizes.length === 0) {
    return { active: [], orphaned: [] };
  }

  const existing = new Set(prizes.map((p) => p.key));
  const active: string[] = [];
  const orphaned: Array<{ key: string; name: string }> = [];

  allowedPrizes.forEach((key) => {
    if (existing.has(key)) {
      active.push(key);
    } else {
      orphaned.push({ key, name: tombstones[key] ?? `未知奖项(${key})` });
    }
  });

  return { active, orphaned };
}

/**
 * 找出因指定奖项缺失而无法参加该奖项的人员。
 * 用于「新增奖项时提示」和「删除奖项时预告影响」。
 *
 * 注意：allowedPrizes 为空的人员参与全部奖项，不受影响。
 */
export function affectedByPrize(list: Person[], prizeKey: string): Person[] {
  return list.filter((person) => {
    if (!person.allowedPrizes || person.allowedPrizes.length === 0) {
      return false; // 参与全部奖项，不受影响
    }
    return person.allowedPrizes.includes(prizeKey);
  });
}

/**
 * 新增奖项后，为指定人员补上该奖项。
 * 人员原本「参与全部奖项」（allowedPrizes 为空）的不需要处理——
 * 新增的奖项对他们自动生效。
 */
export function addPrizeTo(
  list: Person[],
  prizeKey: string,
  only: Person[] = [],
): Person[] {
  const targets = new Set(only.map((p) => p.key));
  return list.map((person) => {
    if (targets.size > 0 && !targets.has(person.key)) {
      return person;
    }
    // 原本参与全部奖项的用户不要写成显式列表，否则会锁死其余奖项
    if (!person.allowedPrizes || person.allowedPrizes.length === 0) {
      return person;
    }
    if (person.allowedPrizes.includes(prizeKey)) {
      return person;
    }
    return { ...person, allowedPrizes: [...person.allowedPrizes, prizeKey] };
  });
}

/**
 * 从人员的 allowedPrizes 中剔除已删除的奖项 key。
 * 对策一：展示层过滤 + 一键清理。
 */
export function stripOrphaned(list: Person[], prizes: Prize[]): Person[] {
  const existing = new Set(prizes.map((p) => p.key));
  return list.map((person) => {
    if (!person.allowedPrizes || person.allowedPrizes.length === 0) {
      return person;
    }
    const kept = person.allowedPrizes.filter((key) => existing.has(key));
    if (kept.length === person.allowedPrizes.length) {
      return person;
    }
    return { ...person, allowedPrizes: kept };
  });
}

/** 生成自定义奖项 key（10 位随机小写字母 + 时间戳） */
export function randomPrizeKey(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let prefix = '';
  for (let i = 0; i < 10; i++) {
    prefix += letters[Math.floor(Math.random() * letters.length)];
  }
  return `${prefix}${Date.now()}`;
}

/**
 * 删除奖项。
 * @returns 新的奖项列表与新增的墓碑映射
 */
export function removePrize(
  prizes: Prize[],
  tombstones: PrizeTombstones,
  prizeKey: string,
): { prizes: Prize[]; tombstones: PrizeTombstones } {
  const target = prizes.find((p) => p.key === prizeKey);
  if (!target) {
    return { prizes, tombstones };
  }
  const next = prizes.filter((p) => p.key !== prizeKey);
  const nextTombstones = { ...tombstones, [prizeKey]: target.name };
  return { prizes: next, tombstones: nextTombstones };
}

/** 重命名奖项（key 不变，因此人员的参与限制自动跟随） */
export function renamePrize(
  prizes: Prize[],
  prizeKey: string,
  name: string,
): Prize[] {
  return prizes.map((p) => (p.key === prizeKey ? { ...p, name } : p));
}
