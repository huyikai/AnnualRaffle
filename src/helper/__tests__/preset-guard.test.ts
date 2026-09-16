import { describe, it, expect } from 'vitest';
import {
  getEffectiveExcludeSettings,
  getPresetDisabledReasons,
  getPresetIssues,
  canUserParticipate,
} from '../../config/lottery';
import type { LotteryConfigType, ResultType } from '../../config/lottery';

// ========== 测试数据 ==========

function makeUsers(count: number, startKey = 1) {
  return Array.from({ length: count }, (_, i) => ({
    key: startKey + i,
    name: `用户${startKey + i}`,
  }));
}

const defaultUsers = makeUsers(10);

const defaultConfig: LotteryConfigType = {
  firstPrize: { count: 1 },
  secondPrize: { count: 2 },
  thirdPrize: { count: 3 },
};

const defaultResult: ResultType = {
  firstPrize: [],
  secondPrize: [],
  thirdPrize: [],
};

function makeReasons(overrides: Partial<Parameters<typeof getPresetDisabledReasons>[0]> = {}) {
  return getPresetDisabledReasons({
    config: defaultConfig,
    categoryKey: 'firstPrize',
    globalExcludeWinners: true,
    result: defaultResult,
    excludedUsers: [],
    list: defaultUsers,
    ...overrides,
  });
}

// ========== getEffectiveExcludeSettings ==========

describe('getEffectiveExcludeSettings', () => {
  it('无自定义配置时跟随全局开关', () => {
    const settings = getEffectiveExcludeSettings(defaultConfig, 'firstPrize', false);
    expect(settings).toEqual({ excludeWinners: false, excludedPersons: [] });
  });

  it('奖项级自定义优先于全局', () => {
    const config: LotteryConfigType = {
      ...defaultConfig,
      firstPrize: { count: 1, excludeMode: 'custom', excludeWinners: false, excludedPersons: '7,8' },
    };
    const settings = getEffectiveExcludeSettings(config, 'firstPrize', true);
    expect(settings).toEqual({ excludeWinners: false, excludedPersons: [7, 8] });
  });
});

// ========== getPresetDisabledReasons ==========

describe('getPresetDisabledReasons', () => {
  it('全局排除名单中的人员被禁选且原因正确（用户反馈场景：张三）', () => {
    const zhangsan = { key: 1001, name: '张三' };
    const reasons = makeReasons({
      excludedUsers: [zhangsan],
      list: [...defaultUsers, zhangsan],
    });
    expect(reasons[1001]).toBe('已列入全局排除名单，无法中奖');
  });

  it('已中过本奖项的人员被禁选', () => {
    const reasons = makeReasons({
      result: { ...defaultResult, firstPrize: [3] },
    });
    expect(reasons[3]).toBe('已中过本奖项，不能重复中奖');
  });

  it('生效排除已中奖时，其他奖项中奖者被禁选', () => {
    const reasons = makeReasons({
      globalExcludeWinners: true,
      result: { ...defaultResult, secondPrize: [5] },
    });
    expect(reasons[5]).toBe('已中奖，按当前设置不再参与抽奖');
  });

  it('自定义模式关闭排除已中奖时，其他奖项中奖者可选', () => {
    const config: LotteryConfigType = {
      ...defaultConfig,
      firstPrize: { count: 1, excludeMode: 'custom', excludeWinners: false },
    };
    const reasons = makeReasons({
      config,
      result: { ...defaultResult, secondPrize: [5] },
    });
    expect(reasons[5]).toBeUndefined();
  });

  it('奖项级排除指定人员被禁选', () => {
    const config: LotteryConfigType = {
      ...defaultConfig,
      firstPrize: { count: 1, excludeMode: 'custom', excludedPersons: '9' },
    };
    const reasons = makeReasons({ config });
    expect(reasons[9]).toBe('已被设置为该奖项的排除人员');
  });

  it('预设中已不在参与名单的 ID 判为脏数据', () => {
    const reasons = makeReasons({ presetIds: [1, 9999] });
    expect(reasons[9999]).toBe('不在参与名单中');
    expect(reasons[1]).toBeUndefined();
  });

  it('同一人多重身份时优先展示更根本的原因（全局排除 > 已中奖）', () => {
    const reasons = makeReasons({
      excludedUsers: [{ key: 2, name: '李四' }],
      result: { ...defaultResult, firstPrize: [2] },
    });
    expect(reasons[2]).toBe('已列入全局排除名单，无法中奖');
  });

  it('无任何排除时返回空对象（全部可选）', () => {
    const reasons = makeReasons();
    expect(reasons).toEqual({});
  });
});

// ========== getPresetIssues ==========

describe('getPresetIssues', () => {
  const listWithZhangsan = [...defaultUsers, { key: 1001, name: '张三' }];

  function makeIssues(
    preset: string,
    overrides: Partial<Parameters<typeof getPresetIssues>[0]> = {}
  ) {
    return getPresetIssues({
      config: { ...defaultConfig, firstPrize: { count: 1, preset } },
      categoryKey: 'firstPrize',
      globalExcludeWinners: true,
      result: defaultResult,
      excludedUsers: [],
      list: defaultUsers,
      ...overrides,
    });
  }

  it('无预设名单时返回空数组', () => {
    expect(getPresetIssues({
      config: defaultConfig,
      categoryKey: 'firstPrize',
      globalExcludeWinners: true,
      result: defaultResult,
      excludedUsers: [],
      list: defaultUsers,
    })).toEqual([]);
  });

  it('全局排除名单中的成员返回失效原因（用户反馈场景：张三）', () => {
    const issues = makeIssues('1001', {
      excludedUsers: [{ key: 1001, name: '张三' }],
      list: listWithZhangsan,
    });
    expect(issues).toEqual([
      { key: 1001, reason: '已列入全局排除名单，无法中奖' },
    ]);
  });

  it('预设 ID 去重后检查，重复 ID 只报告一次', () => {
    const issues = makeIssues('1001,1001', {
      excludedUsers: [{ key: 1001, name: '张三' }],
      list: listWithZhangsan,
    });
    expect(issues).toHaveLength(1);
  });

  it('已中奖成员按生效排除设置判别', () => {
    const result = { ...defaultResult, secondPrize: [5] };
    // 全局排除开启 → 失效
    expect(makeIssues('5', { result })).toEqual([
      { key: 5, reason: '已中奖，按当前设置不再参与抽奖' },
    ]);
    // 自定义模式关闭排除已中奖 → 有效
    const config: LotteryConfigType = {
      ...defaultConfig,
      firstPrize: { count: 1, preset: '5', excludeMode: 'custom', excludeWinners: false },
    };
    expect(makeIssues('5', { config, result })).toEqual([]);
  });

  it('allowedPrizes 限制的成员判为「不符合该奖项的参与限制」', () => {
    const issues = makeIssues('2', {
      list: [{ key: 2, name: 'B', allowedPrizes: ['luckyFirst'] }],
    });
    expect(issues).toEqual([
      { key: 2, reason: '不符合该奖项的参与限制' },
    ]);
  });

  it('全部成员有效时返回空数组', () => {
    expect(makeIssues('1,2,3')).toEqual([]);
  });
});

// ========== canUserParticipate（从 algorithm.ts 迁入后的兼容性） ==========

describe('canUserParticipate', () => {
  it('迁移后行为不变：无限制可参加', () => {
    expect(canUserParticipate({ key: 1, name: 'A' }, 'firstPrize')).toBe(true);
  });

  it('迁移后行为不变：奖项限制生效', () => {
    expect(
      canUserParticipate({ key: 1, name: 'A', allowedPrizes: ['luckyFirst'] }, 'firstPrize')
    ).toBe(false);
  });
});
