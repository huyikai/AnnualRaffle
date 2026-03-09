import { test, expect } from '@playwright/test';
import { resetApp, openConfigDialog, closeConfigDialog, getCategoryCard, getStorageData } from './helpers';

test.describe('配置界面 UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('配置弹窗包含所有默认奖项', async ({ page }) => {
    await openConfigDialog(page);
    for (const name of ['一等奖', '二等奖', '三等奖', '幸运奖第一轮', '幸运奖第二轮']) {
      await expect(getCategoryCard(page, name)).toBeVisible();
    }
  });

  test('修改奖项数量', async ({ page }) => {
    await openConfigDialog(page);
    const input = getCategoryCard(page, '二等奖').locator('input[type="number"]');
    await input.clear();
    await input.fill('5');
    await page.waitForTimeout(200);
    await closeConfigDialog(page);
    const config = await getStorageData(page, 'config') as Record<string, any>;
    expect(config.secondPrize.count).toBe(5);
  });

  test('增加自定义奖项', async ({ page }) => {
    await openConfigDialog(page);
    await page.locator('.action-buttons .el-button').filter({ hasText: '增加奖项' }).click();
    await page.locator('.dialog-showAddLottery').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.dialog-showAddLottery .el-input input').fill('特别奖');
    await page.waitForTimeout(200);
    await page.locator('.dialog-showAddLottery .el-button--primary').filter({ hasText: '增加奖项' }).click();
    await page.waitForTimeout(300);
    await expect(getCategoryCard(page, '特别奖')).toBeVisible();
  });

  test('排除模式下拉菜单正常弹出', async ({ page }) => {
    await openConfigDialog(page);
    await getCategoryCard(page, '一等奖').locator('.exclude-mode-select').click();
    await page.waitForTimeout(300);
    const popper = page.locator('.exclude-mode-popper[aria-hidden="false"]');
    await expect(popper.first()).toBeVisible();
    const items = popper.first().locator('.el-select-dropdown__item');
    expect(await items.count()).toBe(2);
  });

  test('音频设置区域存在', async ({ page }) => {
    await openConfigDialog(page);
    await expect(page.locator('.audio-settings-card')).toBeVisible();
  });
});
