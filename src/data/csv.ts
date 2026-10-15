/**
 * 中奖结果导出
 *
 * 用 CSV 而不是 xlsx：不引第三方库、零体积，Excel 与 WPS 双击都能直接打开。
 * 必须带 UTF-8 BOM——没有 BOM 时 Excel 会按本地编码解析，中文全变乱码。
 */

import type { Person } from '@/data/person';
import type { Prize } from '@/data/prizes';
import type { ResultKeys, ResultMeta } from '@/storage/result';

export interface CsvRow {
  key: string;
  name: string;
  prize: string;
  time: number;
}

/** 转义 CSV 字段：含分隔符、引号、换行时用引号包裹，内部引号翻倍 */
function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * 汇总中奖记录。
 *
 * 姓名优先取名册（改名后展示新名），名册里查不到时回退到抽奖当时的快照——
 * 与结果页展示口径保持一致，否则导出的表和屏幕上看到的会对不上。
 *
 * @param category 限定单个奖项；不传则导出全部
 */
export function collectWinners(
  result: ResultKeys,
  meta: ResultMeta,
  roster: Person[],
  prizes: Prize[],
  category?: string,
): CsvRow[] {
  const nameOf = new Map(roster.map((person) => [person.key, person.name]));
  const prizeOf = new Map(prizes.map((prize) => [prize.key, prize.name]));
  const order = prizes.map((prize) => prize.key);
  // 奖项被删后 config 里可能还有残留 key，补到列表末尾避免漏导
  Object.keys(result).forEach((key) => {
    if (!order.includes(key)) order.push(key);
  });

  const targets = category ? [category] : order;
  const rows: CsvRow[] = [];

  targets.forEach((prizeKey) => {
    const keys = result[prizeKey];
    if (!keys || keys.length === 0) return;
    keys.forEach((key) => {
      rows.push({
        key,
        name: nameOf.get(key) ?? meta[prizeKey]?.[key]?.name ?? `工号 ${key}`,
        prize: prizeOf.get(prizeKey) ?? '已删除奖项',
        time: meta[prizeKey]?.[key]?.time ?? 0,
      });
    });
  });

  return rows;
}

function formatTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/**
 * 生成 CSV 文本（含 UTF-8 BOM）。
 * 列：工号 / 姓名 / 奖项 / 中奖时间
 */
export function buildWinnersCsv(
  result: ResultKeys,
  meta: ResultMeta,
  roster: Person[],
  prizes: Prize[],
  category?: string,
): string {
  const rows = collectWinners(result, meta, roster, prizes, category);
  const lines = ['工号,姓名,奖项,中奖时间'];
  rows.forEach((row) => {
    lines.push(
      [row.key, row.name, row.prize, formatTime(row.time)]
        .map((field) => escapeField(field))
        .join(','),
    );
  });
  return '﻿' + lines.join('\r\n');
}

/** 触发浏览器下载 */
export function downloadCsv(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  );
}

/** 导出中奖结果，可选单个奖项或全部 */
export function exportWinnersCsv(
  result: ResultKeys,
  meta: ResultMeta,
  roster: Person[],
  prizes: Prize[],
  category?: string,
): { fileName: string; count: number } {
  const csv = buildWinnersCsv(result, meta, roster, prizes, category);
  const rows = collectWinners(result, meta, roster, prizes, category);
  const label = category
    ? (prizes.find((p) => p.key === category)?.name ?? '中奖结果')
    : '全部中奖结果';
  const fileName = `${label}-${stamp()}.csv`;
  downloadCsv(csv, fileName);
  return { fileName, count: rows.length };
}
