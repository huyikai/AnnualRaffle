/**
 * 照片文件名匹配
 *
 * 约定的三种命名，按优先级由严到宽逐级放宽：
 *   1. {工号}.jpg          最可靠
 *   2. {工号}-{姓名}.jpg   HR 系统导出常见
 *   3. {姓名}.jpg          仅当该姓名在名册中全局唯一时才采用
 *
 * 第 3 级刻意要求唯一：年会这种全员场合同名很常见，
 * 猜错就是把别人的照片挂到别人头上，且不会有任何提示。
 */

import { normalizeKey } from '@/data/person';
import type { Person } from '@/data/person';

/** 匹配策略，按优先级排列 */
export type MatchStrategy = 'key' | 'key-name' | 'name' | 'none';

/** 单个文件的匹配结果 */
export interface MatchResult {
  fileName: string;
  /** 无扩展名的原始文件名 */
  stem: string;
  /** 匹配到的工号 */
  key?: string;
  /** 匹配到的姓名 */
  name?: string;
  strategy: MatchStrategy;
  /** 未匹配上的原因 */
  reason?: string;
}

/** 汇总结果 */
export interface MatchSummary {
  results: MatchResult[];
  /** 工号 → 命中的文件（同一工号只保留第一个命中的） */
  assigned: Map<string, MatchResult>;
  counts: {
    total: number;
    key: number;
    keyName: number;
    name: number;
    unmatched: number;
  };
}

const SEPARATORS = ['-', '_', ' '];

/** 去掉扩展名（只处理最后一个点号之后的部分） */
export function stripExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index > 0 ? fileName.slice(0, index) : fileName;
}

/**
 * 为一批文件名做匹配。
 *
 * @param fileNames 待匹配的文件名（不含路径）
 * @param roster 当前名册，提供工号与姓名索引
 */
export function matchFiles(
  fileNames: string[],
  roster: Person[],
): MatchSummary {
  const keySet = new Set(roster.map((person) => person.key));
  const nameCount = new Map<string, number>();
  const nameToKey = new Map<string, string>();
  roster.forEach((person) => {
    nameCount.set(person.name, (nameCount.get(person.name) ?? 0) + 1);
    if (!nameToKey.has(person.name)) {
      nameToKey.set(person.name, person.key);
    }
  });

  const results: MatchResult[] = fileNames.map((fileName) => {
    const stem = stripExtension(fileName).trim();

    // 1. 整个文件名就是工号
    const direct = normalizeKey(stem);
    if (direct.ok && keySet.has(direct.value)) {
      return { fileName, stem, key: direct.value, strategy: 'key' };
    }

    // 2. {工号}-{姓名}
    for (const separator of SEPARATORS) {
      const index = stem.indexOf(separator);
      if (index <= 0) continue;
      const keyPart = normalizeKey(stem.slice(0, index));
      const namePart = stem.slice(index + separator.length).trim();
      if (!keyPart.ok || !namePart) continue;

      if (keySet.has(keyPart.value)) {
        const person = roster.find((p) => p.key === keyPart.value)!;
        return {
          fileName,
          stem,
          key: keyPart.value,
          name: person.name,
          strategy: 'key-name',
        };
      }
    }

    // 3. 纯姓名（要求全局唯一）
    const nameOnly = stem.trim();
    if (nameOnly && nameCount.get(nameOnly) === 1) {
      return {
        fileName,
        stem,
        key: nameToKey.get(nameOnly)!,
        name: nameOnly,
        strategy: 'name',
      };
    }
    if (nameOnly && (nameCount.get(nameOnly) ?? 0) > 1) {
      return {
        fileName,
        stem,
        strategy: 'none',
        reason: `名册中有 ${nameCount.get(nameOnly)} 位「${nameOnly}」，无法确定是哪一位`,
      };
    }

    return {
      fileName,
      stem,
      strategy: 'none',
      reason:
        keySet.size === 0
          ? '名册为空，请先导入人员名单'
          : `未找到工号「${stem}」或同名人员`,
    };
  });

  // 同一工号被多个文件命中时，保留优先级最高的（key > key-name > name）
  const priority: Record<MatchStrategy, number> = {
    key: 0,
    'key-name': 1,
    name: 2,
    none: 3,
  };
  const assigned = new Map<string, MatchResult>();
  results
    .filter((result): result is MatchResult & { key: string } => !!result.key)
    .sort((a, b) => priority[a.strategy] - priority[b.strategy])
    .forEach((result) => {
      if (!assigned.has(result.key)) {
        assigned.set(result.key, result);
      }
    });

  const counts = {
    total: results.length,
    key: results.filter((r) => r.strategy === 'key').length,
    keyName: results.filter((r) => r.strategy === 'key-name').length,
    name: results.filter((r) => r.strategy === 'name').length,
    unmatched: results.filter((r) => r.strategy === 'none').length,
  };

  return { results, assigned, counts };
}

export const STRATEGY_LABEL: Record<MatchStrategy, string> = {
  key: '工号',
  'key-name': '工号+姓名',
  name: '姓名',
  none: '未匹配',
};
