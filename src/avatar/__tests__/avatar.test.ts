import { describe, it, expect } from 'vitest';
import { matchFiles, stripExtension } from '../match';
import { validateFile, sniffFormat, MAX_BYTES } from '../validate';
import type { Person } from '../../data/person';

const roster: Person[] = [
  { key: '10001', name: '张三', enabled: true, allowedPrizes: [] },
  { key: '10002', name: '李四', enabled: true, allowedPrizes: [] },
  { key: 'E00123', name: '王五', enabled: true, allowedPrizes: [] },
  // 同名，用于验证「姓名匹配必须唯一」
  { key: '10004', name: '赵六', enabled: true, allowedPrizes: [] },
  { key: '10005', name: '赵六', enabled: true, allowedPrizes: [] },
];

// ========== 文件名匹配 ==========

describe('stripExtension', () => {
  it('去掉最后一个点之后的部分', () => {
    expect(stripExtension('10001.jpg')).toBe('10001');
    expect(stripExtension('10001.tar.gz')).toBe('10001.tar');
    expect(stripExtension('无扩展名')).toBe('无扩展名');
    expect(stripExtension('.gitignore')).toBe('.gitignore');
  });
});

describe('matchFiles（级联匹配）', () => {
  it('第一级：纯工号', () => {
    const r = matchFiles(['10001.jpg'], roster);
    expect(r.counts.key).toBe(1);
    expect(r.results[0]).toMatchObject({ key: '10001', strategy: 'key' });
  });

  it('第二级：工号-姓名', () => {
    const r = matchFiles(['10002-李四.png'], roster);
    expect(r.results[0]).toMatchObject({
      key: '10002',
      name: '李四',
      strategy: 'key-name',
    });
  });

  it('分隔符支持 - _ 与空格', () => {
    expect(matchFiles(['10002_李四.png'], roster).results[0].strategy).toBe(
      'key-name',
    );
    expect(matchFiles(['10002 李四.png'], roster).results[0].strategy).toBe(
      'key-name',
    );
  });

  it('第三级：纯姓名，但要求全局唯一', () => {
    const r = matchFiles(['王五.jpg'], roster);
    expect(r.results[0]).toMatchObject({
      key: 'E00123',
      name: '王五',
      strategy: 'name',
    });
  });

  it('同名时不猜，明确报歧义', () => {
    const r = matchFiles(['赵六.jpg'], roster);
    expect(r.results[0].strategy).toBe('none');
    expect(r.results[0].reason).toContain('2 位');
    // 绝不猜：猜错就是把别人的照片挂到别人头上，且不会有任何提示
    expect(r.results[0].key).toBeUndefined();
  });

  it('工号含字母也能匹配（数字类型下会是 NaN）', () => {
    const r = matchFiles(['E00123.jpg'], roster);
    expect(r.results[0]).toMatchObject({ key: 'E00123', strategy: 'key' });
  });

  it('工号带前导零不会被吃掉', () => {
    const withZeros: Person[] = [
      { key: '0012345', name: '甲', enabled: true, allowedPrizes: [] },
    ];
    const r = matchFiles(['0012345.jpg'], withZeros);
    expect(r.results[0].key).toBe('0012345');
  });

  it('未匹配时给出可执行的原因', () => {
    const r = matchFiles(['99999.jpg'], roster);
    expect(r.results[0].strategy).toBe('none');
    expect(r.results[0].reason).toContain('未找到');
  });

  it('名册为空时提示先导入名单', () => {
    const r = matchFiles(['10001.jpg'], []);
    expect(r.results[0].reason).toContain('名册为空');
  });

  it('同名文件按优先级去重：工号优先于姓名', () => {
    // 王五.jpg 命中 E00123，E00123-王五.jpg 也命中同一个工号
    const r = matchFiles(['王五.jpg', 'E00123-王五.jpg'], roster);
    expect(r.assigned.size).toBe(1);
    expect(r.assigned.get('E00123')!.strategy).toBe('key-name');
  });

  it('统计四类命中数', () => {
    const r = matchFiles(
      ['10001.jpg', '10002-李四.png', '王五.jpg', '赵六.jpg', '99999.jpg'],
      roster,
    );
    expect(r.counts).toEqual({
      total: 5,
      key: 1,
      keyName: 1,
      name: 1,
      unmatched: 2,
    });
  });
});

// ========== 格式校验 ==========

/** 构造带指定文件头的字节 */
function bytesWithHeader(head: number[], total = 64): Uint8Array {
  const bytes = new Uint8Array(total);
  bytes.set(head, 0);
  return bytes;
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
];

describe('sniffFormat（文件头嗅探）', () => {
  it('识别 JPEG / PNG / WebP', () => {
    expect(sniffFormat(bytesWithHeader(JPEG, 16))).toBe('jpg');
    expect(sniffFormat(bytesWithHeader(PNG, 16))).toBe('png');
    expect(sniffFormat(bytesWithHeader(WEBP, 16))).toBe('webp');
  });

  it('把 exe 改名成 jpg 会被识破', () => {
    expect(
      sniffFormat(bytesWithHeader([0x4d, 0x5a, 0x90, 0x00], 16)),
    ).toBeNull();
  });
});

describe('validateFile', () => {
  it('正常 JPG 通过', () => {
    expect(validateFile('10001.jpg', bytesWithHeader(JPEG)).ok).toBe(true);
  });

  it('.jpeg 与 .jpg 视为等价', () => {
    expect(validateFile('10001.jpeg', bytesWithHeader(JPEG)).ok).toBe(true);
  });

  it('扩展名与真实格式不符时拒绝', () => {
    // 把 PNG 改名成 .jpg —— 只看扩展名会放行
    const r = validateFile('fake.jpg', bytesWithHeader(PNG));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('不符');
  });

  it('不支持的格式被拒绝', () => {
    const r = validateFile('a.gif', bytesWithHeader(JPEG));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('不支持');
  });

  it('超过大小上限被拒绝', () => {
    const big = new Uint8Array(MAX_BYTES + 1);
    big.set(JPEG, 0);
    const r = validateFile('big.jpg', big);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('上限');
  });

  it('空文件被拒绝', () => {
    expect(validateFile('empty.jpg', new Uint8Array(0)).ok).toBe(false);
  });

  it('无扩展名被拒绝', () => {
    expect(validateFile('noext', bytesWithHeader(JPEG)).ok).toBe(false);
  });

  it('伪装成图片的非图片被拒绝', () => {
    const r = validateFile(
      'virus.jpg',
      bytesWithHeader([0x4d, 0x5a, 0x90, 0x00]),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('不是有效的图片');
  });
});
