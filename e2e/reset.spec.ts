import { test, expect } from '@playwright/test';
import {
  resetApp, openResultDialog, getResultCount,
  openConfigDialog, closeConfigDialog,
  setGlobalExclude, getGlobalExcludeState,
  getStorageData, injectResults,
} from './helpers';

test.describe('重置功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('点击重置按钮弹出确认框', async ({ page }) => {
    await page.locator('a.btn-reset').click();
    const msgBox = page.locator('.el-message-box');
    await expect(msgBox).toBeVisible();
    await expect(msgBox).toContainText('此操作将重置所选数据');
    await page.locator('.el-message-box__btns .el-button').filter({ hasText: '取消' }).click();
    await page.waitForTimeout(300);
  });

  test('确认重置后抽奖结果清空', async ({ page }) => {
    await injectResults(page, {
      firstPrize: [1004], secondPrize: [1005, 1006], thirdPrize: [],
      luckyFirst: [], luckySecond: [],
    });
    await page.locator('a.btn-reset').click();
    await page.waitForTimeout(500);
    await page.locator('.el-message-box__btns .el-button--primary').click({ noWaitAfter: true });
    await page.waitForTimeout(3000);
    const result = await getStorageData(page, 'result') as Record<string, number[]> | null;
    if (result === null) {
      // reset 后 localStorage 中 result 被清除
      expect(result).toBeNull();
    } else {
      expect(result.firstPrize?.length ?? 0).toBe(0);
      expect(result.secondPrize?.length ?? 0).toBe(0);
    }
  });

  test('取消重置不影响数据', async ({ page }) => {
    await injectResults(page, {
      firstPrize: [1004], secondPrize: [], thirdPrize: [],
      luckyFirst: [], luckySecond: [],
    });
    await page.locator('a.btn-reset').click();
    await page.locator('.el-message-box__btns .el-button').filter({ hasText: '取消' }).click();
    await page.waitForTimeout(300);
    const result = await getStorageData(page, 'result') as Record<string, number[]>;
    expect(result.firstPrize).toContain(1004);
  });
});
