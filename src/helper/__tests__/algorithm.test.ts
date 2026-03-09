import { describe, it, expect } from 'vitest';
import { annualRaffleHandler, canUserParticipate } from '../algorithm';
import type { LotteryConfig } from '../algorithm';

// ========== 测试数据 ==========

function makeUsers(count: number, startKey = 1) {
  return Array.from({ length: count }, (_, i) => ({
    key: startKey + i,
    name: `用户${startKey + i}`,
  }));
}

const defaultUsers = makeUsers(20);

function makeStore(overrides: {
  result?: Record<string, number[]>;
  list?: Array<{ key: number; name: string; allowedPrizes?: string[] }>;
  config?: Record<string, { count: number; preset?: string }>;
} = {}) {
  return {
    result: overrides.result ?? { firstPrize: [], secondPrize: [], thirdPrize: [] },
    list: overrides.list ?? defaultUsers,
    config: overrides.config ?? {
      firstPrize: { count: 1 },
      secondPrize: { count: 2 },
      thirdPrize: { count: 3 },
    },
  };
}

// ========== canUserParticipate ==========

describe('canUserParticipate', () => {
  it('没有 allowedPrizes 时可以参加所有奖项', () => {
    expect(canUserParticipate({ key: 1, name: 'A' }, 'firstPrize')).toBe(true);
  });

  it('allowedPrizes 为空数组时可以参加所有奖项', () => {
    expect(canUserParticipate({ key: 1, name: 'A', allowedPrizes: [] }, 'firstPrize')).toBe(true);
  });

  it('奖项在 allowedPrizes 中时可以参加', () => {
    expect(canUserParticipate({ key: 1, name: 'A', allowedPrizes: ['firstPrize'] }, 'firstPrize')).toBe(true);
  });

  it('奖项不在 allowedPrizes 中时不可参加', () => {
    expect(canUserParticipate({ key: 1, name: 'A', allowedPrizes: ['luckyFirst'] }, 'firstPrize')).toBe(false);
  });
});

// ========== 基础功能 ==========

describe('基础功能', () => {
  it('从用户池中抽取指定人数', () => {
    const result = annualRaffleHandler({ num: 3 }, makeStore());
    expect(result).toHaveLength(3);
    result.forEach(key => {
      expect(defaultUsers.some(u => u.key === key)).toBe(true);
    });
  });

  it('抽取结果不包含重复用户', () => {
    const result = annualRaffleHandler({ num: 10 }, makeStore());
    expect(new Set(result).size).toBe(10);
  });

  it('抽取人数超过可用人数时抛出错误', () => {
    const store = makeStore({ list: makeUsers(3) });
    expect(() => annualRaffleHandler({ num: 5 }, store)).toThrow('可抽奖人数不足');
  });
});

// ========== 全局排除已中奖 ==========

describe('全局排除已中奖', () => {
  it('excludeWinners=true 时排除其他奖项已中奖者', () => {
    const store = makeStore({
      result: { firstPrize: [1, 2, 3], secondPrize: [], thirdPrize: [] },
    });
    for (let i = 0; i < 20; i++) {
      const result = annualRaffleHandler(
        { num: 5, category: 'secondPrize', excludeWinners: true },
        store
      );
      expect(result).not.toContain(1);
      expect(result).not.toContain(2);
      expect(result).not.toContain(3);
    }
  });

  it('excludeWinners=false 时其他奖项中奖者可参加', () => {
    const winners = [1, 2, 3, 4, 5];
    const store = makeStore({
      list: makeUsers(6),
      result: { firstPrize: winners, secondPrize: [], thirdPrize: [] },
    });
    // 6 人中 5 人已中一等奖，如果排除则只剩 1 人，抽 3 人必报错
    // 不排除时应该可以抽 3 人
    const result = annualRaffleHandler(
      { num: 3, category: 'secondPrize', excludeWinners: false },
      store
    );
    expect(result).toHaveLength(3);
  });

  it('excludeWinners=false 时同奖项已中奖者仍然被排除（防重复）', () => {
    const store = makeStore({
      result: { firstPrize: [], secondPrize: [1, 2], thirdPrize: [] },
    });
    for (let i = 0; i < 20; i++) {
      const result = annualRaffleHandler(
        { num: 3, category: 'secondPrize', excludeWinners: false },
        store
      );
      expect(result).not.toContain(1);
      expect(result).not.toContain(2);
    }
  });
});

// ========== 排除指定人员 ==========

describe('排除指定人员', () => {
  it('excludedPersons 中的人员被排除', () => {
    const store = makeStore();
    for (let i = 0; i < 20; i++) {
      const result = annualRaffleHandler(
        { num: 5, excludeWinners: false, excludedPersons: [1, 2, 3] },
        store
      );
      expect(result).not.toContain(1);
      expect(result).not.toContain(2);
      expect(result).not.toContain(3);
    }
  });

  it('excludedPersons 为空时不影响结果', () => {
    const store = makeStore();
    const result = annualRaffleHandler(
      { num: 5, excludedPersons: [] },
      store
    );
    expect(result).toHaveLength(5);
  });
});

// ========== 双重排除叠加 ==========

describe('双重排除叠加', () => {
  it('excludeWinners=true + excludedPersons 同时生效', () => {
    const store = makeStore({
      result: { firstPrize: [1, 2], secondPrize: [], thirdPrize: [] },
    });
    for (let i = 0; i < 20; i++) {
      const result = annualRaffleHandler(
        { num: 5, category: 'secondPrize', excludeWinners: true, excludedPersons: [3, 4] },
        store
      );
      // 1,2 被排除（已中奖），3,4 被排除（指定人员）
      expect(result).not.toContain(1);
      expect(result).not.toContain(2);
      expect(result).not.toContain(3);
      expect(result).not.toContain(4);
    }
  });

  it('excludeWinners=false + excludedPersons 只排除指定人员', () => {
    const winners = [1, 2, 3, 4, 5, 6, 7];
    const store = makeStore({
      list: makeUsers(10),
      result: { firstPrize: winners, secondPrize: [], thirdPrize: [] },
    });
    for (let i = 0; i < 20; i++) {
      const result = annualRaffleHandler(
        { num: 2, category: 'secondPrize', excludeWinners: false, excludedPersons: [8] },
        store
      );
      // 8 被排除（指定人员），但 1-7 可以参加（不排除已中奖）
      expect(result).not.toContain(8);
      expect(result).toHaveLength(2);
    }
  });
});

// ========== 全局排除名单（excludedUsers 参数） ==========

describe('全局排除名单（excludedUsers）', () => {
  it('excludedUsers 中的人员始终被排除', () => {
    const globalExcluded = [{ key: 1, name: '排除1' }, { key: 2, name: '排除2' }];
    const store = makeStore();
    for (let i = 0; i < 20; i++) {
      const result = annualRaffleHandler({ num: 5 }, store, globalExcluded);
      expect(result).not.toContain(1);
      expect(result).not.toContain(2);
    }
  });

  it('excludeWinners=false 时 excludedUsers 仍然生效', () => {
    const globalExcluded = [{ key: 1, name: '排除1' }];
    const store = makeStore();
    for (let i = 0; i < 20; i++) {
      const result = annualRaffleHandler(
        { num: 5, excludeWinners: false },
        store,
        globalExcluded
      );
      expect(result).not.toContain(1);
    }
  });
});

// ========== 预设名单 + 排除 ==========

describe('预设名单 + 排除', () => {
  it('预设名单中被排除的人会被跳过', () => {
    const store = makeStore({
      result: { firstPrize: [1], secondPrize: [], thirdPrize: [] },
      config: {
        firstPrize: { count: 1 },
        secondPrize: { count: 2, preset: '1,2,3' },
        thirdPrize: { count: 3 },
      },
    });
    // 用户 1 已中一等奖，预设名单是 1,2,3，排除已中奖后有效预设为 2,3
    const result = annualRaffleHandler(
      { num: 2, category: 'secondPrize', excludeWinners: true },
      store
    );
    expect(result).not.toContain(1);
    expect(result).toContain(2);
    expect(result).toContain(3);
  });

  it('预设名单不足时自动补抽，补抽遵循排除规则', () => {
    const store = makeStore({
      result: { firstPrize: [1, 2], secondPrize: [], thirdPrize: [] },
      config: {
        firstPrize: { count: 1 },
        secondPrize: { count: 3, preset: '3' },
        thirdPrize: { count: 3 },
      },
    });
    // 预设只有 3，需要抽 3 人，预设提供 1 人，补抽 2 人
    const result = annualRaffleHandler(
      { num: 3, category: 'secondPrize', excludeWinners: true },
      store
    );
    expect(result).toHaveLength(3);
    expect(result).toContain(3);
    expect(result).not.toContain(1);
    expect(result).not.toContain(2);
  });

  it('预设名单全被排除时走纯随机逻辑', () => {
    const store = makeStore({
      result: { firstPrize: [1, 2, 3], secondPrize: [], thirdPrize: [] },
      config: {
        firstPrize: { count: 1 },
        secondPrize: { count: 2, preset: '1,2,3' },
        thirdPrize: { count: 3 },
      },
    });
    // 预设 1,2,3 全被排除，走纯随机
    const result = annualRaffleHandler(
      { num: 2, category: 'secondPrize', excludeWinners: true },
      store
    );
    expect(result).toHaveLength(2);
    expect(result).not.toContain(1);
    expect(result).not.toContain(2);
    expect(result).not.toContain(3);
  });
});

// ========== 用户奖项限制 + 排除 ==========

describe('用户奖项限制 + 排除', () => {
  it('allowedPrizes 限制与排除设置正确叠加', () => {
    const users = [
      { key: 1, name: 'A' },
      { key: 2, name: 'B', allowedPrizes: ['luckyFirst'] },
      { key: 3, name: 'C' },
      { key: 4, name: 'D', allowedPrizes: ['luckyFirst'] },
      { key: 5, name: 'E' },
    ];
    const store = makeStore({
      list: users,
      result: { firstPrize: [1], secondPrize: [], thirdPrize: [] },
    });
    // firstPrize: 用户2、4 被奖项限制排除，用户1 被已中奖排除，只剩 3 和 5
    for (let i = 0; i < 20; i++) {
      const result = annualRaffleHandler(
        { num: 2, category: 'firstPrize', excludeWinners: true },
        store
      );
      expect(result).toHaveLength(2);
      expect(result).toContain(3);
      expect(result).toContain(5);
    }
  });

  it('排除 + 奖项限制导致可用人数不足时报错', () => {
    const users = [
      { key: 1, name: 'A', allowedPrizes: ['luckyFirst'] },
      { key: 2, name: 'B', allowedPrizes: ['luckyFirst'] },
      { key: 3, name: 'C' },
    ];
    const store = makeStore({
      list: users,
      result: { firstPrize: [3], secondPrize: [], thirdPrize: [] },
    });
    // firstPrize: 1,2 被奖项限制排除，3 被已中奖排除 → 0 人可用
    expect(() =>
      annualRaffleHandler(
        { num: 1, category: 'firstPrize', excludeWinners: true },
        store
      )
    ).toThrow('可抽奖人数不足');
  });
});
