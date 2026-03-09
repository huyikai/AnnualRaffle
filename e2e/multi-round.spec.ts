import { test, expect } from '@playwright/test';
import {
  resetApp, performDraw, openConfigDialog, closeConfigDialog,
  setGlobalExclude, getStorageData,
} from './helpers';

test.describe('多轮抽奖', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('单次抽奖结果内部不重复', async ({ page }) => {
    await performDraw(page, '三等奖');
    const result = await getStorageData(page, 'result') as Record<string, number[]>;
    const winners = result.thirdPrize ?? [];
    expect(winners.length).toBe(5);
    expect(new Set(winners).size).toBe(winners.length);
  });

  test('跨奖项抽奖（全局排除开启）人员不重复', async ({ page }) => {
    await openConfigDialog(page);
    await setGlobalExclude(page, true);
    await closeConfigDialog(page);
    await performDraw(page, '一等奖');
    await page.locator('#resbox').click();
    await page.waitForTimeout(300);
    await performDraw(page, '二等奖');
    await page.locator('#resbox').click();
    await page.waitForTimeout(200);
    const result = await getStorageData(page, 'result') as Record<string, number[]>;
    const first = new Set(result.firstPrize ?? []);
    for (const w of result.secondPrize ?? []) {
      expect(first.has(w)).toBe(false);
    }
  });

  test('跨奖项抽奖（全局排除关闭）不报错', async ({ page }) => {
    await openConfigDialog(page);
    await setGlobalExclude(page, false);
    await closeConfigDialog(page);
    await performDraw(page, '一等奖');
    await page.locator('#resbox').click();
    await page.waitForTimeout(300);
    await performDraw(page, '幸运奖第一轮');
    await page.locator('#resbox').click();
    await page.waitForTimeout(200);
    const result = await getStorageData(page, 'result') as Record<string, number[]>;
    expect((result.firstPrize ?? []).length).toBe(1);
    expect((result.luckyFirst ?? []).length).toBeGreaterThan(0);
  });
});
