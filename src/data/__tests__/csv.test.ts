import { describe, it, expect } from 'vitest';
import { buildWinnersCsv, collectWinners } from '../csv';
import { parseVersion, compareVersion } from '../update';
import type { Person } from '../../data/person';
import type { Prize } from '../../data/prizes';
import type { ResultKeys, ResultMeta } from '../../storage/result';

const roster: Person[] = [
  { key: '10001', name: '张三', enabled: true, allowedPrizes: [] },
  { key: '10002', name: '李四', enabled: true, allowedPrizes: [] },
  { key: '0012345', name: '王五,五', enabled: true, allowedPrizes: [] },
];

const prizes: Prize[] = [
  { key: 'firstPrize', name: '一等奖', builtin: true },
  { key: 'thirdPrize', name: '三等奖', builtin: true },
  { key: 'luckyFirst', name: '幸运奖第一轮', builtin: true },
];

const result: ResultKeys = {
  firstPrize: ['10001'],
  thirdPrize: ['10002', '0012345'],
  luckyFirst: [],
};

const meta: ResultMeta = {
  firstPrize: { '10001': { name: '张三旧名', time: 1700000000000 } },
  thirdPrize: {
    '10002': { name: '李四', time: 1700000001000 },
    '0012345': { name: '王五', time: 1700000002000 },
  },
};

describe('collectWinners', () => {
  it('按奖项定义顺序汇总，忽略空奖项', () => {
    const rows = collectWinners(result, meta, roster, prizes);
    expect(rows.map((r) => r.key)).toEqual(['10001', '10002', '0012345']);
  });

  it('可限定单个奖项', () => {
    const rows = collectWinners(result, meta, roster, prizes, 'thirdPrize');
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.prize === '三等奖')).toBe(true);
  });

  it('姓名优先取名册，改名后导出的是新名', () => {
    const rows = collectWinners(result, meta, roster, prizes, 'firstPrize');
    expect(rows[0].name).toBe('张三');
  });

  it('名册查不到时回退到中奖当时的快照，而不是显示「工号 xxx」', () => {
    const gone: Person[] = roster.filter((p) => p.key !== '10001');
    const rows = collectWinners(result, meta, gone, prizes, 'firstPrize');
    expect(rows[0].name).toBe('张三旧名');
  });

  it('名册为空但有快照时回退到快照', () => {
    const rows = collectWinners(result, meta, [], prizes, 'firstPrize');
    expect(rows[0].name).toBe('张三旧名');
  });

  it('名册与快照都没有时才用工号兜底', () => {
    // 快照缺失：例如导入了一份旧备份，其中结果有工号但没有 resultMeta
    const noMeta: ResultMeta = {};
    const rows = collectWinners(result, noMeta, [], prizes, 'firstPrize');
    expect(rows[0].name).toBe('工号 10001');
  });

  it('奖项被删除后仍能导出，不静默丢失记录', () => {
    const withDeleted: ResultKeys = { gonePrize: ['10001'] };
    const rows = collectWinners(withDeleted, meta, roster, prizes);
    expect(rows).toHaveLength(1);
    expect(rows[0].prize).toBe('已删除奖项');
  });

  it('保留前导零工号', () => {
    const rows = collectWinners(result, meta, roster, prizes, 'thirdPrize');
    expect(rows.map((r) => r.key)).toContain('0012345');
  });
});

describe('buildWinnersCsv', () => {
  it('以 UTF-8 BOM 开头，否则 Excel 会把中文当本地编码解析成乱码', () => {
    const csv = buildWinnersCsv(result, meta, roster, prizes);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('表头固定为工号/姓名/奖项/中奖时间', () => {
    const csv = buildWinnersCsv(result, meta, roster, prizes);
    expect(csv.split('\r\n')[0]).toBe('﻿工号,姓名,奖项,中奖时间');
  });

  it('含逗号的字段被引号包裹', () => {
    const csv = buildWinnersCsv(result, meta, roster, prizes);
    expect(csv).toContain('"王五,五"');
  });

  it('中奖时间格式化为可读日期', () => {
    const csv = buildWinnersCsv(result, meta, roster, prizes, 'firstPrize');
    expect(csv).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });

  it('无中奖记录时只有表头', () => {
    const csv = buildWinnersCsv({}, {}, roster, prizes);
    expect(csv.split('\r\n')).toHaveLength(1);
  });
});

describe('版本比较', () => {
  it('解析 v 前缀', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2.3-beta.1')).toEqual([1, 2, 3]);
  });

  it('无法解析时返回 null', () => {
    expect(parseVersion('latest')).toBeNull();
  });

  it('按主次修订号逐级比较', () => {
    expect(compareVersion('v1.2.4', 'v1.2.3')).toBeGreaterThan(0);
    expect(compareVersion('v1.2.3', 'v1.2.4')).toBeLessThan(0);
    expect(compareVersion('v2.0.0', 'v1.9.9')).toBeGreaterThan(0);
    expect(compareVersion('v1.2.3', 'v1.2.3')).toBe(0);
  });

  it('预发布版本按基础版本号比较（无签名场景下够用）', () => {
    expect(compareVersion('v1.3.0-beta.1', 'v1.2.9')).toBeGreaterThan(0);
  });
});
