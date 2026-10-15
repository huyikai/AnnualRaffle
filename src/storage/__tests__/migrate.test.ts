import { describe, it, expect, beforeEach } from 'vitest';
import { migrateSchema, SCHEMA_VERSION } from '../migrate';
import { SEED_PEOPLE } from '@/data/seed';
import type { Person } from '@/data/person';

/**
 * migrateSchema 的关键不变式。
 *
 * 背景：Tool.vue 的「重置全部数据」走的是 clearData()，它会把 localStorage
 * 连同 schemaVersion 一起抹掉。下次启动时 migrateSchema 读到「版本 < 2 且没有旧
 * list」，会判定为首次安装并重新灌入 152 条示例数据——重置等于白做。
 * 因此 clearData 之后必须把 schemaVersion 补回去，而本文件守住的就是
 * 「版本号在、数据空 ≠ 首次安装」这条规则。
 */

// vitest 默认跑在 node 环境，没有 localStorage，这里补一个最小实现
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

function readRoster(): Person[] {
  const raw = globalThis.localStorage.getItem('roster');
  return raw ? (JSON.parse(raw) as Person[]) : [];
}

describe('migrateSchema', () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
  });

  it('首次安装（无版本号、无旧名单）灌入示例数据', () => {
    const report = migrateSchema();

    expect(report.migrated).toBe(true);
    expect(report.fromVersion).toBe(1);
    expect(readRoster()).toHaveLength(SEED_PEOPLE.length);
    expect(globalThis.localStorage.getItem('schemaVersion')).toBe(
      String(SCHEMA_VERSION),
    );
  });

  it('版本号在但名单为空时不再灌入示例数据（重置后的状态）', () => {
    globalThis.localStorage.setItem('schemaVersion', String(SCHEMA_VERSION));

    const report = migrateSchema();

    expect(report.migrated).toBe(false);
    expect(report.peopleCount).toBe(0);
    expect(readRoster()).toHaveLength(0);
  });

  it('版本号在但名单为空时不会凭空多出 roster 键', () => {
    globalThis.localStorage.setItem('schemaVersion', String(SCHEMA_VERSION));
    migrateSchema();

    // 关键：roster 必须保持「不存在」而不是被写成示例名单
    expect(globalThis.localStorage.getItem('roster')).toBeNull();
  });

  it('v1 名单的工号被转成字符串并写入 roster', () => {
    globalThis.localStorage.setItem(
      'list',
      JSON.stringify([
        { key: 1001, name: '张三' },
        { key: 1002, name: '李四' },
      ]),
    );

    const report = migrateSchema();

    expect(report.migrated).toBe(true);
    const roster = readRoster();
    expect(roster.map((p) => p.key)).toEqual(['1001', '1002']);
    // 数字工号来自旧版数据，应当给出前导零已丢失的告警
    expect(report.warnings.join('')).toContain('前导零');
  });

  it('工号前导零以字符串形式保留，不被转成数字', () => {
    // v1 的 key 是 number，前导零在写入旧数据时就已丢失；
    // 这里确认迁移后的 key 类型是 string，不会再发生二次损失
    globalThis.localStorage.setItem(
      'list',
      JSON.stringify([{ key: 1001, name: '张三' }]),
    );
    migrateSchema();

    const [person] = readRoster();
    expect(typeof person.key).toBe('string');
  });

  it('迁移去重时保留首条记录', () => {
    globalThis.localStorage.setItem(
      'list',
      JSON.stringify([
        { key: 2001, name: '先来的' },
        { key: 2001, name: '后来的' },
      ]),
    );

    migrateSchema();

    const roster = readRoster();
    expect(roster).toHaveLength(1);
    expect(roster[0].name).toBe('先来的');
  });
});
