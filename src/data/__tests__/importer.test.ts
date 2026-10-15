import { describe, it, expect } from 'vitest';
import {
  decodeBuffer,
  detectDelimiter,
  splitCsvLine,
  matchHeader,
  parseImport,
  applyImport,
} from '../importer';
import { normalizeKey } from '../person';
import type { Person } from '../person';

// ========== 工号归一化 ==========

describe('normalizeKey（静默失败防护）', () => {
  it('保留前导零（数字类型会把它吃掉）', () => {
    const r = normalizeKey('0012345');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('0012345');
  });

  it('全角数字转半角', () => {
    const r = normalizeKey('２２０００３０');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('2200030');
  });

  it('去首尾空格与表意空格', () => {
    expect(normalizeKey('  2200030  ').value).toBe('2200030');
    expect(normalizeKey('　2200030　').value).toBe('2200030');
  });

  it('去零宽字符与 BOM', () => {
    expect(normalizeKey('2200030﻿').value).toBe('2200030');
  });

  it('保留字母前缀的工号（数字类型会变成 NaN）', () => {
    const r = normalizeKey('E00123');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('E00123');
  });

  it('拒绝科学计数法：源头已被 Excel 损坏，不可还原', () => {
    const r = normalizeKey('2.20003E+15');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('科学计数法');
  });

  it('空工号判为失败', () => {
    expect(normalizeKey('   ').ok).toBe(false);
    expect(normalizeKey(null).ok).toBe(false);
  });

  it('不做大小写归一（是否同一人是业务判断，不是技术判断）', () => {
    expect(normalizeKey('EMP001').value).toBe('EMP001');
  });

  it('归一化后与原值不同则标记 changed', () => {
    const r = normalizeKey(' 2200030 ');
    expect(r.ok).toBe(true);
    expect(r.value).not.toBe(r.raw);
  });
});

// ========== 解码 ==========

describe('decodeBuffer（中文 CSV 乱码防护）', () => {
  const utf8 = (text: string) => new TextEncoder().encode(text);

  it('UTF-8 无 BOM', () => {
    const r = decodeBuffer(utf8('工号,姓名'));
    expect(r.encoding).toBe('UTF-8');
    expect(r.text).toBe('工号,姓名');
  });

  it('UTF-8 带 BOM 会被剥离', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('工号')]);
    const r = decodeBuffer(bytes);
    expect(r.encoding).toContain('BOM');
    expect(r.text).toBe('工号');
  });

  it('GBK 内容不会按 UTF-8 解出乱码', () => {
    // "10001,张三" 的 GBK 编码：张=D5C5 三=C8FD
    const gbk = new Uint8Array([
      0x31, 0x30, 0x30, 0x30, 0x31, 0x2c, 0xd5, 0xc5, 0xc8, 0xfd,
    ]);
    const r = decodeBuffer(gbk);
    expect(r.encoding).toBe('GBK');
    expect(r.text).toBe('10001,张三');
    // 关键是它不是按 UTF-8 解出来的（那样会是乱码）
    expect(r.text).not.toContain('�');
  });

  it('接受 Uint8Array（Tauri readFile 的返回类型）', () => {
    const r = decodeBuffer(utf8('姓名'));
    expect(r.text).toBe('姓名');
  });
});

// ========== 分隔符 ==========

describe('detectDelimiter', () => {
  it('逗号', () => {
    expect(detectDelimiter(['1,张三', '2,李四', '3,王五'])).toBe(',');
  });

  it('制表符（Excel 整块复制）', () => {
    expect(detectDelimiter(['1\t张三', '2\t李四', '3\t王五'])).toBe('\t');
  });

  it('中文逗号', () => {
    expect(detectDelimiter(['1，张三', '2，李四', '3，王五'])).toBe('，');
  });

  it('各行分隔一致才判定，单行偶然出现不算', () => {
    expect(detectDelimiter(['1,张三,备注', '2,李四'])).toBe(',');
  });
});

describe('splitCsvLine（引号包裹）', () => {
  it('引号内的分隔符不切分', () => {
    expect(splitCsvLine('10001,"张,三",研发部', ',')).toEqual([
      '10001',
      '张,三',
      '研发部',
    ]);
  });

  it('双引号转义', () => {
    expect(splitCsvLine('10001,"张""三"', ',')).toEqual(['10001', '张"三']);
  });

  it('去除字段首尾空白', () => {
    expect(splitCsvLine(' 10001 , 张三 ', ',')).toEqual(['10001', '张三']);
  });
});

// ========== 表头 ==========

describe('matchHeader', () => {
  it('中文表头', () => {
    const r = matchHeader([['姓名', '工号', '部门']]);
    expect(r.hasHeader).toBe(true);
    expect(r.keyColumn).toBe(1);
    expect(r.nameColumn).toBe(0);
  });

  it('英文表头', () => {
    const r = matchHeader([['no', 'name']]);
    expect(r.hasHeader).toBe(true);
    expect(r.keyColumn).toBe(0);
    expect(r.nameColumn).toBe(1);
  });

  it('无表头时按「第一列工号、第二列姓名」', () => {
    const r = matchHeader([['10001', '张三']]);
    expect(r.hasHeader).toBe(false);
    expect(r.keyColumn).toBe(0);
    expect(r.nameColumn).toBe(1);
  });
});

// ========== 预检 ==========

const existing: Person[] = [
  { key: '10001', name: '张三', enabled: true, allowedPrizes: [] },
];

describe('parseImport', () => {
  it('无表头 CSV 正常解析', () => {
    const plan = parseImport('10002,李四\n10003,王五', new Set(['10001']));
    expect(plan.blocked).toBeUndefined();
    expect(plan.stats.ok).toBe(2);
    expect(plan.stats.newCount).toBe(2);
  });

  it('跳过表头行', () => {
    const plan = parseImport('工号,姓名\n10002,李四', new Set());
    expect(plan.hasHeader).toBe(true);
    expect(plan.stats.total).toBe(1);
    expect(plan.rows[0].key).toBe('10002');
  });

  it('缺工号的行判为异常，不静默丢弃', () => {
    const plan = parseImport(',李四\n10002,王五', new Set());
    expect(plan.stats.error).toBe(1);
    expect(plan.stats.ok).toBe(1);
    expect(plan.rows[0].reason).toContain('工号');
  });

  it('缺姓名的行判为异常', () => {
    const plan = parseImport('10002,\n10003,王五', new Set());
    expect(plan.stats.error).toBe(1);
    expect(plan.rows[0].reason).toContain('姓名');
  });

  it('文件内工号重复标出重复行号', () => {
    const plan = parseImport('10002,李四\n10002,王五', new Set());
    expect(plan.stats.error).toBe(1);
    expect(plan.rows[1].reason).toContain('第 1 行');
  });

  it('与现有名单冲突会被标记但不阻断', () => {
    const plan = parseImport('10001,张三\n10002,李四', new Set(['10001']));
    expect(plan.stats.conflictCount).toBe(1);
    expect(plan.stats.newCount).toBe(1);
    expect(plan.stats.error).toBe(0);
  });

  it('归一化后的值被标记为 changed，供预检双列展示', () => {
    const plan = parseImport('２２０００３０,李四', new Set());
    expect(plan.rows[0].rawKey).toBe('２２０００３０');
    expect(plan.rows[0].key).toBe('2200030');
    expect(plan.rows[0].changed).toBe(true);
    expect(plan.stats.changedCount).toBe(1);
  });

  it('只有一列时阻断，不让用户对着 0 行表格发呆', () => {
    const plan = parseImport('10001\n10002', new Set());
    expect(plan.blocked).toBeDefined();
    expect(plan.blocked).toContain('两列');
  });

  it('空内容阻断', () => {
    expect(parseImport('', new Set()).blocked).toBeDefined();
  });

  it('尾部空行不计入总数', () => {
    const plan = parseImport('10002,李四\n10003,王五\n', new Set());
    expect(plan.stats.total).toBe(2);
  });
});

// ========== 应用 ==========

const planWithConflict = parseImport(
  '10001,张三改\n10002,李四',
  new Set(['10001']),
);
const okRows = planWithConflict.rows.filter((row) => row.status === 'ok');

describe('applyImport', () => {
  it('跳过策略：保留现有名单记录', () => {
    const summary = applyImport(planWithConflict, 'skip', existing);
    expect(summary.added).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.next.find((p) => p.key === '10001')?.name).toBe('张三');
  });

  it('覆盖策略：替换姓名并重置参与设置', () => {
    const dirty: Person[] = [
      {
        key: '10001',
        name: '张三',
        enabled: false,
        allowedPrizes: ['luckyFirst'],
      },
    ];
    const summary = applyImport(planWithConflict, 'overwrite', dirty);
    const updated = summary.next.find((p) => p.key === '10001');
    expect(updated?.name).toBe('张三改');
    // 导入只带工号+姓名，沿用旧值会让用户误以为这些设置也被更新了
    expect(updated?.enabled).toBe(true);
    expect(updated?.allowedPrizes).toEqual([]);
  });

  it('新增策略：同工号追加，不去重', () => {
    const summary = applyImport(planWithConflict, 'add', existing);
    expect(summary.added).toBe(2);
    expect(summary.next.filter((p) => p.key === '10001')).toHaveLength(2);
  });

  it('异常行不会进入结果', () => {
    const withError = parseImport('10002,\n10003,王五', new Set());
    const summary = applyImport(withError, 'skip', existing);
    expect(summary.errored).toBe(1);
    expect(summary.next.some((p) => p.key === '10002')).toBe(false);
  });

  it('阻断时不改动现有数据', () => {
    const blocked = parseImport('10001', new Set());
    const summary = applyImport(blocked, 'overwrite', existing);
    expect(summary.next).toBe(existing);
  });

  it('全部可导入行数与预检一致', () => {
    expect(okRows).toHaveLength(2);
    expect(applyImport(planWithConflict, 'skip', []).added).toBe(2);
  });
});
