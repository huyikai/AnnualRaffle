import { test, expect } from '@playwright/test';
import {
  resetApp, performDraw, openResultDialog, getResultCount,
  injectResults, getStorageData,
} from './helpers';

test.describe('结果管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('未抽奖的奖项显示暂未抽奖', async ({ page }) => {
    await openResultDialog(page);
    const rows = page.locator('.c-Result .listrow');
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    const emptyRows = page.locator('.c-Result .listrow').filter({ hasText: '暂未抽奖' });
    expect(await emptyRows.count()).toBeGreaterThan(0);
  });

  test('抽奖后结果正确显示', async ({ page }) => {
    await performDraw(page, '一等奖');
    await page.locator('#resbox').click();
    await page.waitForTimeout(200);
    await openResultDialog(page);
    expect(await getResultCount(page, '一等奖')).toBe(1);
  });

  test('删除中奖结果', async ({ page }) => {
    await injectResults(page, {
      firstPrize: [1004], secondPrize: [], thirdPrize: [],
      luckyFirst: [], luckySecond: [],
    });
    await openResultDialog(page);
    const row = page.locator('.c-Result .listrow').filter({ hasText: '一等奖' });
    await row.locator('.card').first().click();
    await page.locator('.el-message-box__btns .el-button--primary').click();
    await page.waitForTimeout(500);
    const result = await getStorageData(page, 'result') as Record<string, number[]>;
    expect(result.firstPrize).not.toContain(1004);
  });
});
