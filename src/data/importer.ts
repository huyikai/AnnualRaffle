/**
 * 名单导入管线
 *
 * CSV 文件与批量粘贴共用这一条管线，差异只在「字节 → 文本」这一步：
 *   文件：ArrayBuffer → decodeBuffer（UTF-8 / GBK 自动探测）
 *   粘贴：已经是字符串，跳过解码
 *
 * 之后完全一致：分隔符识别 → 行解析（支持引号包裹）→ 表头识别 →
 * 工号归一化 → 预检（缺工号 / 缺姓名 / 工号重复 / 与现有冲突）→ 应用
 */

import { normalizeKey } from './person';
import type { Person } from './person';

// ========== 解码 ==========

export interface DecodeResult {
  text: string;
  encoding: string;
}

/**
 * 字节流解码，自动在 UTF-8 与 GBK/GB2312 之间选择。
 *
 * 国内 Excel 另存的中文 CSV 绝大多数是 GBK，不处理会整篇乱码。
 * 判据是「严格 UTF-8 解码是否抛错」——非法字节序列只有在非 UTF-8 时才会出现。
 *
 * 接受 ArrayBuffer 或 Uint8Array：网页端 File.arrayBuffer() 给前者，
 * Tauri 的 readFile() 给后者。
 */
export function decodeBuffer(input: ArrayBuffer | Uint8Array): DecodeResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  // BOM 优先
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return {
      text: new TextDecoder('utf-8').decode(bytes.subarray(3)),
      encoding: 'UTF-8（带 BOM）',
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      text: new TextDecoder('utf-16le').decode(bytes),
      encoding: 'UTF-16LE',
    };
  }

  // 严格 UTF-8 校验
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text, encoding: 'UTF-8' };
  } catch {
    /* 非法 UTF-8 序列，继续尝试中文编码 */
  }

  // GBK → GB18030（后者是前者的超集，覆盖 GB2312 与生僻字）
  for (const encoding of ['gbk', 'gb18030']) {
    try {
      const text = new TextDecoder(encoding).decode(bytes);
      return { text, encoding: encoding.toUpperCase() };
    } catch {
      /* 该编码在当前运行环境不可用 */
    }
  }

  return {
    text: new TextDecoder('utf-8').decode(bytes),
    encoding: 'UTF-8（回退）',
  };
}

// ========== 分隔符与行解析 ==========

const DELIMITER_CANDIDATES = ['\t', ',', '，', ';', '；'] as const;

/**
 * 分隔符探测：在前若干行里统计各候选分隔符的出现次数，取最多者。
 * 制表符优先于逗号——从 Excel 整块复制的内容里常同时含逗号。
 */
export function detectDelimiter(lines: string[]): string {
  const sample = lines.filter((line) => line.trim()).slice(0, 10);
  if (sample.length === 0) return ',';

  let best = ',';
  let bestCount = 0;
  for (const delimiter of DELIMITER_CANDIDATES) {
    // 取各行出现次数的最小值，保证「每行都分隔得一样」的行才胜出
    const counts = sample.map((line) => line.split(delimiter).length - 1);
    const min = Math.min(...counts);
    if (min > bestCount) {
      bestCount = min;
      best = delimiter;
    }
  }
  return bestCount > 0 ? best : ',';
}

/**
 * 解析一行 CSV，支持双引号包裹与 "" 转义。
 * 引号内的分隔符不参与切分。
 */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

// ========== 表头识别 ==========

const KEY_HEADERS = [
  '工号',
  '编号',
  '员工号',
  '员工编号',
  '工号编号',
  '人员编号',
  'id',
  'no',
  'number',
  'empno',
  'emp_no',
  'employeeid',
  'employee id',
  'jobnumber',
  'job no',
];

const NAME_HEADERS = [
  '姓名',
  '名字',
  '员工姓名',
  '人员姓名',
  'name',
  'fullname',
  'username',
];

/** 归一化表头文本以便比对：去空格、转小写 */
function normalizeHeader(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

export interface HeaderMatch {
  hasHeader: boolean;
  keyColumn: number;
  nameColumn: number;
}

/**
 * 识别表头行。
 * 命中任一已知工号/姓名列名即视为有表头；否则按「第一列=工号，第二列=姓名」处理。
 */
export function matchHeader(rows: string[][]): HeaderMatch {
  if (rows.length === 0) {
    return { hasHeader: false, keyColumn: 0, nameColumn: 1 };
  }

  const first = rows[0].map(normalizeHeader);
  let keyColumn = -1;
  let nameColumn = -1;

  first.forEach((cell, index) => {
    if (
      keyColumn === -1 &&
      KEY_HEADERS.some((h) => cell === h || cell.includes(h))
    ) {
      keyColumn = index;
    }
    if (
      nameColumn === -1 &&
      NAME_HEADERS.some((h) => cell === h || cell.includes(h))
    ) {
      nameColumn = index;
    }
  });

  if (keyColumn === -1 || nameColumn === -1) {
    return { hasHeader: false, keyColumn: 0, nameColumn: 1 };
  }
  return { hasHeader: true, keyColumn, nameColumn };
}

// ========== 预检 ==========

/** 单行的判定结果 */
export interface ImportRow {
  /** 原始行号（1 起，含表头行） */
  rowNumber: number;
  /** 原始工号文本，用于「原始值 → 归一化值」双列展示 */
  rawKey: string;
  rawName: string;
  /** 归一化后的工号 */
  key: string;
  /** 清洗后的姓名 */
  name: string;
  status: 'ok' | 'skip' | 'error';
  /** 跳过或失败的原因 */
  reason?: string;
  /** 与现有名单冲突 */
  conflict: boolean;
  /** 归一化/清洗改变了原始值 */
  changed: boolean;
}

export interface ImportPlan {
  rows: ImportRow[];
  hasHeader: boolean;
  delimiter: string;
  /** 无法继续时的阻断原因 */
  blocked?: string;
  stats: {
    total: number;
    ok: number;
    error: number;
    skip: number;
    newCount: number;
    conflictCount: number;
    changedCount: number;
  };
}

/**
 * 解析并预检。
 * @param text 原始文本（已解码）
 * @param existingKeys 现有名册的工号集合，用于判定冲突
 */
export function parseImport(
  text: string,
  existingKeys: Set<string>,
): ImportPlan {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter(
      (line, index, all) => !(line.trim() === '' && index === all.length - 1),
    );

  const delimiter = detectDelimiter(lines);
  const matrix = lines.map((line) => splitCsvLine(line, delimiter));

  // 阻断：没有任何一行能分出两列，说明根本不是名单
  const maxColumns = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  if (matrix.length === 0) {
    return {
      rows: [],
      hasHeader: false,
      delimiter,
      blocked: '内容为空，没有可导入的数据',
      stats: {
        total: 0,
        ok: 0,
        error: 0,
        skip: 0,
        newCount: 0,
        conflictCount: 0,
        changedCount: 0,
      },
    };
  }
  if (maxColumns < 2) {
    return {
      rows: [],
      hasHeader: false,
      delimiter,
      blocked:
        '未识别到工号与姓名两列，请确认文件格式（第一列工号、第二列姓名）',
      stats: {
        total: 0,
        ok: 0,
        error: 0,
        skip: 0,
        newCount: 0,
        conflictCount: 0,
        changedCount: 0,
      },
    };
  }

  const header = matchHeader(matrix);
  const dataStart = header.hasHeader ? 1 : 0;

  const rows: ImportRow[] = [];
  const seenKeys = new Map<string, number>();

  for (let i = dataStart; i < matrix.length; i++) {
    const row = matrix[i];
    // 整行为空则跳过，不计入总数
    if (row.every((cell) => !cell)) continue;

    const rowNumber = i + 1;
    const rawKey = row[header.keyColumn] ?? '';
    const rawName = row[header.nameColumn] ?? '';

    const normalized = normalizeKey(rawKey);
    const name = rawName.trim();

    const base: ImportRow = {
      rowNumber,
      rawKey,
      rawName,
      key: normalized.value,
      name,
      status: 'ok',
      conflict: false,
      changed: normalized.ok && normalized.value !== rawKey,
    };

    if (!normalized.ok) {
      rows.push({ ...base, status: 'error', reason: normalized.reason });
      continue;
    }
    if (!name) {
      rows.push({ ...base, status: 'error', reason: '姓名为空' });
      continue;
    }
    if (seenKeys.has(base.key)) {
      rows.push({
        ...base,
        status: 'error',
        reason: `工号与第 ${seenKeys.get(base.key)} 行重复`,
      });
      continue;
    }

    seenKeys.set(base.key, rowNumber);
    base.conflict = existingKeys.has(base.key);
    rows.push(base);
  }

  const okRows = rows.filter((row) => row.status === 'ok');
  const errorRows = rows.filter((row) => row.status === 'error');

  return {
    rows,
    hasHeader: header.hasHeader,
    delimiter,
    stats: {
      total: rows.length,
      ok: okRows.length,
      error: errorRows.length,
      skip: 0,
      newCount: okRows.filter((row) => !row.conflict).length,
      conflictCount: okRows.filter((row) => row.conflict).length,
      changedCount: rows.filter((row) => row.changed).length,
    },
  };
}

// ========== 应用 ==========

/** 冲突处理策略 */
export type ConflictStrategy = 'skip' | 'overwrite' | 'add';

export const CONFLICT_STRATEGIES: Array<{
  value: ConflictStrategy;
  label: string;
  hint: string;
}> = [
  {
    value: 'skip',
    label: '跳过',
    hint: '保留现有名单中的记录，忽略本次导入的同工号人员',
  },
  {
    value: 'overwrite',
    label: '覆盖',
    hint: '用导入数据替换现有名单中的同工号记录（参与开关与奖项限制会被重置）',
  },
  {
    value: 'add',
    label: '新增',
    hint: '同工号再追加一条新记录（工号将不再唯一，不推荐）',
  },
];

export interface ApplySummary {
  added: number;
  overwritten: number;
  skipped: number;
  errored: number;
  next: Person[];
}

/**
 * 把预检结果应用到名册。
 */
export function applyImport(
  plan: ImportPlan,
  strategy: ConflictStrategy,
  existing: Person[],
): ApplySummary {
  if (plan.blocked) {
    return { added: 0, overwritten: 0, skipped: 0, errored: 0, next: existing };
  }

  const okRows = plan.rows.filter((row) => row.status === 'ok');
  const errored = plan.rows.filter((row) => row.status === 'error').length;

  if (strategy === 'add') {
    const appended: Person[] = okRows.map((row) => ({
      key: row.key,
      name: row.name,
      enabled: true,
      allowedPrizes: [],
    }));
    return {
      added: appended.length,
      overwritten: 0,
      skipped: 0,
      errored,
      next: [...existing, ...appended],
    };
  }

  const incoming = new Map(okRows.map((row) => [row.key, row]));
  let added = 0;
  let overwritten = 0;
  let skipped = 0;

  const next: Person[] = existing.map((person) => {
    const row = incoming.get(person.key);
    if (!row) return person;

    incoming.delete(person.key);
    if (strategy === 'skip') {
      skipped++;
      return person;
    }
    overwritten++;
    // 覆盖时重置参与开关与奖项限制：导入的是基础信息（工号+姓名），
    // 若沿用旧值，用户会以为这些设置也跟着更新了。
    return {
      key: person.key,
      name: row.name,
      enabled: true,
      allowedPrizes: [],
    };
  });

  // 剩余的都是新工号
  incoming.forEach((row) => {
    next.push({
      key: row.key,
      name: row.name,
      enabled: true,
      allowedPrizes: [],
    });
    added++;
  });

  return { added, overwritten, skipped, errored, next };
}

// ========== 纯文本粘贴入口 ==========

/** 批量粘贴：与 CSV 共用管线，只跳过解码步骤 */
export function parsePasted(
  text: string,
  existingKeys: Set<string>,
): ImportPlan {
  return parseImport(text, existingKeys);
}

// ========== 模板 ==========

/** 下载模板 CSV 用的内容。首行是表头，工号列前置单引号防止 Excel 转成数值。 */
export const TEMPLATE_CSV = [
  '工号,姓名',
  "'10001,张三",
  "'10002,李四",
  "'10003,王五",
].join('\n');
