import { test, expect } from '@playwright/test';
import {
  waitForAppReady, resetApp, openConfigDialog, closeConfigDialog,
  setGlobalExclude, getGlobalExcludeState, getCategoryCard,
  setExcludeModeCustom,
  performDraw, openResultDialog, getResultCount, getStorageData,
} from './helpers';

test.describe('数据持久化', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('抽奖结果刷新后保留', async ({ page }) => {
    await performDraw(page, '一等奖');
    await page.locator('#resbox').click();
    await page.waitForTimeout(200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await openResultDialog(page);
    expect(await getResultCount(page, '一等奖')).toBe(1);
  });

  test('全局排除设置刷新后保留', async ({ page }) => {
    await openConfigDialog(page);
    await setGlobalExclude(page, false);
    await closeConfigDialog(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    expect(await getStorageData(page, 'excludeWinners')).toBe(false);
    await openConfigDialog(page);
    expect(await getGlobalExcludeState(page)).toBe(false);
  });

  test('奖项数量配置刷新后保留', async ({ page }) => {
    await openConfigDialog(page);
    const input = getCategoryCard(page, '一等奖').locator('input[type="number"]');
    await input.clear();
    await input.fill('3');
    await page.waitForTimeout(200);
    await closeConfigDialog(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const config = await getStorageData(page, 'config') as Record<string, any>;
    expect(config.firstPrize.count).toBe(3);
  });

  test('奖项排除模式配置刷新后保留', async ({ page }) => {
    await openConfigDialog(page);
    await setExcludeModeCustom(page, '二等奖');
    await closeConfigDialog(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const config = await getStorageData(page, 'config') as Record<string, any>;
    expect(config.secondPrize.excludeMode).toBe('custom');
  });
});
