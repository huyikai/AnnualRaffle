import { test, expect } from '@playwright/test';
import { waitForAppReady, resetApp, performDraw, openResultDialog, getResultCount } from './helpers';

test.describe('基础抽奖功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('页面正确加载，核心元素存在', async ({ page }) => {
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('#tool')).toBeVisible();
    await expect(page.locator('button.con')).toBeVisible();
    await expect(page.locator('button.res')).toBeVisible();
    await expect(page.locator('#tool .el-button').filter({ hasText: '开始抽奖' })).toBeVisible();
  });

  test('选择奖项并进行抽奖显示结果', async ({ page }) => {
    await performDraw(page, '一等奖');
    await expect(page.locator('#resbox')).toBeVisible();
    const items = page.locator('#resbox .itemres');
    expect(await items.count()).toBe(1);
  });

  test('抽奖结果弹窗显示正确', async ({ page }) => {
    await performDraw(page, '一等奖');
    await page.locator('#resbox').click();
    await page.waitForTimeout(200);
    await openResultDialog(page);
    expect(await getResultCount(page, '一等奖')).toBe(1);
  });
});
