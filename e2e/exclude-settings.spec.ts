import { test, expect } from '@playwright/test';
import {
  resetApp, openConfigDialog, closeConfigDialog,
  getGlobalExcludeState, setGlobalExclude, getCategoryCard,
  setExcludeModeCustom,
  performDraw, openResultDialog, injectResults, getStorageData,
} from './helpers';

test.describe('排除设置', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('全局排除开关默认开启', async ({ page }) => {
    await openConfigDialog(page);
    expect(await getGlobalExcludeState(page)).toBe(true);
  });

  test('关闭全局排除开关并持久化', async ({ page }) => {
    await openConfigDialog(page);
    await setGlobalExclude(page, false);
    await closeConfigDialog(page);
    expect(await getStorageData(page, 'excludeWinners')).toBe(false);
  });

  test('奖项排除模式默认为"跟随全局"', async ({ page }) => {
    await openConfigDialog(page);
    const card = getCategoryCard(page, '一等奖');
    const selectText = await card.locator('.exclude-mode-select').textContent();
    expect(selectText).toContain('跟随全局');
  });

  test('切换奖项排除模式为"自定义"后显示额外选项', async ({ page }) => {
    await openConfigDialog(page);
    await setExcludeModeCustom(page, '一等奖');
    const card = getCategoryCard(page, '一等奖');
    await expect(card.locator('.custom-exclude-options .el-checkbox')).toBeVisible();
    await expect(card.locator('.custom-exclude-options .el-button').filter({ hasText: '排除指定人员' })).toBeVisible();
  });

  test('自定义模式下取消排除已中奖并持久化', async ({ page }) => {
    await openConfigDialog(page);
    await setExcludeModeCustom(page, '一等奖');
    const card = getCategoryCard(page, '一等奖');
    await card.locator('.custom-exclude-options .el-checkbox').click();
    await page.waitForTimeout(200);
    await closeConfigDialog(page);
    const config = await getStorageData(page, 'config') as Record<string, any>;
    expect(config.firstPrize.excludeMode).toBe('custom');
    expect(config.firstPrize.excludeWinners).toBe(false);
  });

  test('全局排除开启时已中奖人员不再中奖', async ({ page }) => {
    await injectResults(page, {
      firstPrize: [], secondPrize: [],
      thirdPrize: [1004, 1005, 1006, 1007, 1008],
      luckyFirst: [], luckySecond: [],
    });
    await openConfigDialog(page);
    await setGlobalExclude(page, true);
    await closeConfigDialog(page);
    await performDraw(page, '二等奖');
    await page.locator('#resbox').click();
    await page.waitForTimeout(200);
    await openResultDialog(page);
    const row = page.locator('.c-Result .listrow').filter({ hasText: '二等奖' });
    const cards = row.locator('.card');
    const count = await cards.count();
    const excluded = ['赵六', '钱七', '孙八', '周九', '吴十'];
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent() ?? '';
      for (const name of excluded) {
        expect(text).not.toContain(name);
      }
    }
  });
});
