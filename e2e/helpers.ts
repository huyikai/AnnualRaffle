import { type Page, expect } from '@playwright/test';

export async function waitForAppReady(page: Page) {
  await page.waitForSelector('#root', { timeout: 30000 });
  await page.waitForSelector('#tool', { timeout: 30000 });
}

export async function resetApp(page: Page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await waitForAppReady(page);
}

export async function openConfigDialog(page: Page) {
  await page.locator('button.con').click();
  await page.locator('.c-LotteryConfig').waitFor({ state: 'visible', timeout: 5000 });
}

export async function closeConfigDialog(page: Page) {
  await page.locator('.action-buttons .el-button--primary').click();
  await page.locator('.c-LotteryConfig').waitFor({ state: 'hidden', timeout: 5000 });
}

export async function openResultDialog(page: Page) {
  await page.locator('button.res').click();
  await page.locator('.c-Result').waitFor({ state: 'visible', timeout: 5000 });
}

export async function selectCategory(page: Page, categoryLabel: string) {
  await page.locator('#tool .custom-select').click();
  await page.waitForTimeout(300);
  await page.locator('.el-select-dropdown__item').filter({ hasText: categoryLabel }).click();
  await page.waitForTimeout(200);
}

export async function performDraw(page: Page, categoryLabel: string) {
  await selectCategory(page, categoryLabel);
  await page.locator('#tool .el-button').filter({ hasText: '开始抽奖' }).click();
  await page.waitForTimeout(1200);
  await page.locator('#tool .el-button').filter({ hasText: '停止' }).click();
  await page.waitForTimeout(300);
}

export async function getResultCount(page: Page, prizeName: string): Promise<number> {
  const row = page.locator('.c-Result .listrow').filter({ hasText: prizeName });
  return await row.locator('.card').count();
}

export async function getGlobalExcludeState(page: Page): Promise<boolean> {
  const cls = await page.locator('.lottery-settings-card .el-switch').getAttribute('class') ?? '';
  return cls.includes('is-checked');
}

export async function setGlobalExclude(page: Page, enabled: boolean) {
  if ((await getGlobalExcludeState(page)) !== enabled) {
    await page.locator('.lottery-settings-card .el-switch').click();
    await page.waitForTimeout(200);
  }
}

export async function injectResults(page: Page, results: Record<string, number[]>) {
  await page.evaluate((r) => localStorage.setItem('result', JSON.stringify(r)), results);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}

export async function getStorageData(page: Page, key: string) {
  return page.evaluate((k) => {
    const v = localStorage.getItem(k);
    if (v === null) return null;
    try { return JSON.parse(v); } catch { return v; }
  }, key);
}

export function getCategoryCard(page: Page, categoryName: string) {
  return page.locator('.category-card').filter({ hasText: categoryName });
}

/**
 * 在指定奖项卡片中，将排除模式切换为"自定义"
 */
export async function setExcludeModeCustom(page: Page, categoryName: string) {
  const card = getCategoryCard(page, categoryName);
  await card.locator('.exclude-mode-select').click();
  await page.waitForTimeout(300);
  const visiblePopper = page.locator('.exclude-mode-popper[aria-hidden="false"]').first();
  await visiblePopper.locator('.el-select-dropdown__item').filter({ hasText: '自定义' }).click();
  await page.waitForTimeout(200);
}
