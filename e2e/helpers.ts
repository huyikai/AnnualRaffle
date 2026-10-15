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
  await page
    .locator('.c-LotteryConfig')
    .waitFor({ state: 'visible', timeout: 5000 });
}

export async function closeConfigDialog(page: Page) {
  await page.locator('.action-buttons .el-button--primary').click();
  await page
    .locator('.c-LotteryConfig')
    .waitFor({ state: 'hidden', timeout: 5000 });
}

export async function openResultDialog(page: Page) {
  await page.locator('button.res').click();
  await page.locator('.c-Result').waitFor({ state: 'visible', timeout: 5000 });
}

export async function selectCategory(page: Page, categoryLabel: string) {
  await page.locator('#tool .custom-select').click();
  await page.waitForTimeout(300);
  await page
    .locator('.el-select-dropdown__item')
    .filter({ hasText: categoryLabel })
    .click();
  await page.waitForTimeout(200);
}

export async function performDraw(page: Page, categoryLabel: string) {
  await selectCategory(page, categoryLabel);
  await page
    .locator('#tool .el-button')
    .filter({ hasText: '开始抽奖' })
    .click();
  await page.waitForTimeout(1200);
  await page.locator('#tool .el-button').filter({ hasText: '停止' }).click();
  await page.waitForTimeout(300);
}

export async function getResultCount(
  page: Page,
  prizeName: string,
): Promise<number> {
  const row = page.locator('.c-Result .listrow').filter({ hasText: prizeName });
  return await row.locator('.card').count();
}

export async function getGlobalExcludeState(page: Page): Promise<boolean> {
  const cls =
    (await page
      .locator('.lottery-settings-card .el-switch')
      .getAttribute('class')) ?? '';
  return cls.includes('is-checked');
}

export async function setGlobalExclude(page: Page, enabled: boolean) {
  if ((await getGlobalExcludeState(page)) !== enabled) {
    await page.locator('.lottery-settings-card .el-switch').click();
    await page.waitForTimeout(200);
  }
}

export async function injectResults(
  page: Page,
  results: Record<string, string[]>,
) {
  await page.evaluate(
    (r) => localStorage.setItem('result', JSON.stringify(r)),
    results,
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}

export async function getStorageData(page: Page, key: string) {
  return page.evaluate((k) => {
    const v = localStorage.getItem(k);
    if (v === null) return null;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }, key);
}

/**
 * 写入一份确定的名册并刷新。
 *
 * clear() 之后 schemaVersion 也被清掉，迁移会灌入 152 条示例数据；
 * 人员管理的用例需要可预期的初始状态，所以这里显式指定名单并标记 schema 已迁移。
 */
export async function setRoster(
  page: Page,
  people: Array<{
    key: string;
    name: string;
    enabled?: boolean;
    allowedPrizes?: string[];
  }>,
) {
  await page.evaluate(
    ({ roster }) => {
      localStorage.setItem('schemaVersion', '2');
      localStorage.setItem(
        'roster',
        JSON.stringify(
          roster.map((p) => ({
            key: p.key,
            name: p.name,
            enabled: p.enabled ?? true,
            allowedPrizes: p.allowedPrizes ?? [],
          })),
        ),
      );
    },
    { roster: people },
  );
  await page.reload({ waitUntil: 'load' });
  await waitForAppReady(page);
}

/** 清空名册并标记 schema 已迁移（避免示例数据灌入） */
export async function setEmptyRoster(page: Page) {
  await setRoster(page, []);
}

/** 前往人员管理页 */
export async function gotoPeople(page: Page) {
  await page.goto('/#/people', { waitUntil: 'load' });
  await page.waitForSelector('.people-page', { timeout: 10000 });
}

/**
 * 写入中奖结果并重新加载。
 *
 * 必须 reload：store 的加载只发生在应用外壳挂载时，
 * 而 hash 路由切换（#/ → #/people）不会让外壳重新挂载——
 * 改完 localStorage 直接 goto 是读不到新数据的。
 */
export async function setResult(page: Page, result: Record<string, string[]>) {
  await page.evaluate(
    (r) => localStorage.setItem('result', JSON.stringify(r)),
    result,
  );
  await page.reload({ waitUntil: 'load' });
  await waitForAppReady(page);
}

/** 读取统计条文本，如「共 3 人·参与 2 人·排除 1 人」 */
export async function getRosterStats(page: Page) {
  const text = (await page.locator('.people-stats').innerText()).replace(
    /\s+/g,
    '',
  );
  const grab = (label: string) => {
    const match = new RegExp(`${label}(\\d+)`).exec(text);
    return match ? Number(match[1]) : -1;
  };
  return { total: grab('共'), active: grab('参与'), excluded: grab('排除') };
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
  const visiblePopper = page
    .locator('.exclude-mode-popper[aria-hidden="false"]')
    .first();
  await visiblePopper
    .locator('.el-select-dropdown__item')
    .filter({ hasText: '自定义' })
    .click();
  await page.waitForTimeout(200);
}
