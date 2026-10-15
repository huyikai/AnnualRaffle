import { test, expect } from '@playwright/test';
import {
  resetApp,
  openConfigDialog,
  closeConfigDialog,
  getCategoryCard,
  getStorageData,
} from './helpers';

test.describe('配置界面 UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('配置弹窗包含所有默认奖项', async ({ page }) => {
    await openConfigDialog(page);
    for (const name of [
      '一等奖',
      '二等奖',
      '三等奖',
      '幸运奖第一轮',
      '幸运奖第二轮',
    ]) {
      await expect(getCategoryCard(page, name)).toBeVisible();
    }
  });

  test('修改奖项数量', async ({ page }) => {
    await openConfigDialog(page);
    const input = getCategoryCard(page, '二等奖').locator(
      'input[type="number"]',
    );
    await input.clear();
    await input.fill('5');
    await page.waitForTimeout(200);
    await closeConfigDialog(page);
    const config = (await getStorageData(page, 'config')) as Record<
      string,
      any
    >;
    expect(config.secondPrize.count).toBe(5);
  });

  test('增加自定义奖项', async ({ page }) => {
    await openConfigDialog(page);
    await page
      .locator('.action-buttons .el-button')
      .filter({ hasText: '增加奖项' })
      .click();
    await page
      .locator('.dialog-showEditPrize')
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.dialog-showEditPrize .el-input input').fill('特别奖');
    await page.waitForTimeout(200);
    await page.locator('.dialog-showEditPrize .el-button--primary').click();
    await page.waitForTimeout(300);
    await expect(getCategoryCard(page, '特别奖')).toBeVisible();
  });

  test('重命名奖项后卡片标题同步更新', async ({ page }) => {
    await openConfigDialog(page);
    const card = getCategoryCard(page, '幸运奖第一轮');
    await card.locator('.prize-action').filter({ hasText: '改名' }).click();
    await page
      .locator('.dialog-showEditPrize')
      .waitFor({ state: 'visible', timeout: 5000 });
    await page
      .locator('.dialog-showEditPrize .el-input input')
      .fill('游戏环节奖');
    await page.locator('.dialog-showEditPrize .el-button--primary').click();
    await page.waitForTimeout(300);
    await expect(getCategoryCard(page, '游戏环节奖')).toBeVisible();
    await expect(getCategoryCard(page, '幸运奖第一轮')).toHaveCount(0);
  });

  test('删除奖项后卡片消失并出现恢复入口', async ({ page }) => {
    await openConfigDialog(page);
    const card = getCategoryCard(page, '三等奖');
    await card.locator('.prize-action').filter({ hasText: '删除' }).click();
    const confirm = page.locator('.prize-delete-confirm');
    await confirm.waitFor({ state: 'visible', timeout: 5000 });
    await confirm.locator('.el-button--primary').click();
    await page.waitForTimeout(400);
    await expect(getCategoryCard(page, '三等奖')).toHaveCount(0);
    // 内置奖项被删除后提供一键恢复
    await expect(
      page
        .locator('.action-buttons .el-button')
        .filter({ hasText: '恢复内置奖项' }),
    ).toBeVisible();
  });

  test('排除模式下拉菜单正常弹出', async ({ page }) => {
    await openConfigDialog(page);
    await getCategoryCard(page, '一等奖')
      .locator('.exclude-mode-select')
      .click();
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
