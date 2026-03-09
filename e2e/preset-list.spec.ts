import { test, expect } from '@playwright/test';
import { resetApp, openConfigDialog, closeConfigDialog, getCategoryCard, getStorageData } from './helpers';

test.describe('预设名单功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('预设名单默认未启用', async ({ page }) => {
    await openConfigDialog(page);
    const card = getCategoryCard(page, '一等奖');
    const cls = await card.locator('.preset-item .el-switch').getAttribute('class') ?? '';
    expect(cls).not.toContain('is-checked');
  });

  test('开启预设名单后显示选择按钮', async ({ page }) => {
    await openConfigDialog(page);
    const card = getCategoryCard(page, '一等奖');
    await card.locator('.preset-item .el-switch').click();
    await page.waitForTimeout(200);
    await expect(card.locator('.preset-item .el-button').filter({ hasText: '选择预设名单' })).toBeVisible();
  });

  test('关闭预设名单后隐藏选择按钮', async ({ page }) => {
    await openConfigDialog(page);
    const card = getCategoryCard(page, '一等奖');
    await card.locator('.preset-item .el-switch').click();
    await page.waitForTimeout(200);
    await card.locator('.preset-item .el-switch').click();
    await page.waitForTimeout(200);
    const cls = await card.locator('.preset-item .el-switch').getAttribute('class') ?? '';
    expect(cls).not.toContain('is-checked');
  });
});
