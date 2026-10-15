import { test, expect } from '@playwright/test';
import { resetApp, setRoster, setEmptyRoster, gotoPeople } from './helpers';

/** 打开导入对话框并切到批量粘贴页 */
async function openPasteImport(page: import('@playwright/test').Page) {
  await page.locator('.people-header-right .el-button--primary').click();
  await page
    .locator('.c-ImportDialog')
    .waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#tab-paste').click();
  await page.waitForTimeout(200);
}

/** 粘贴文本并解析 */
async function pasteAndParse(
  page: import('@playwright/test').Page,
  text: string,
) {
  await page.locator('.paste-area textarea').fill(text);
  await page.locator('.paste-actions .el-button--primary').click();
  await page.waitForTimeout(300);
}

test.describe('批量导入', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('空状态引导直接能打开导入', async ({ page }) => {
    await setEmptyRoster(page);
    await gotoPeople(page);
    await page.locator('.empty-slot .el-button--primary').click();
    await page
      .locator('.c-ImportDialog')
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  test('正常名单解析后可导入', async ({ page }) => {
    await setEmptyRoster(page);
    await gotoPeople(page);
    await openPasteImport(page);
    await pasteAndParse(page, '工号,姓名\n10001,张三\n10002,李四');

    await expect(page.locator('.import-meta')).toContainText('共 2 行');
    await expect(page.locator('.import-meta')).toContainText('可导入 2');

    await page
      .locator('.c-ImportDialog .el-dialog__footer .el-button--primary')
      .click();
    await page.waitForTimeout(300);

    await expect(page.locator('.result-panel')).toContainText('新增 2 人');
    await page
      .locator('.c-ImportDialog .el-dialog__footer .el-button--primary')
      .click();
    await page.waitForTimeout(300);

    const roster = (await page.evaluate(() =>
      JSON.parse(localStorage.getItem('roster') ?? '[]'),
    )) as Array<{ key: string; name: string }>;
    expect(roster.map((p) => p.key).sort()).toEqual(['10001', '10002']);
  });

  test('表头被跳过，行号从 2 开始', async ({ page }) => {
    await setEmptyRoster(page);
    await gotoPeople(page);
    await openPasteImport(page);
    await pasteAndParse(page, '工号,姓名\n10001,张三');

    const firstRowNumber = await page
      .locator('.preview-table .el-table__body tr')
      .first()
      .locator('td')
      .first()
      .innerText();
    expect(firstRowNumber.trim()).toBe('2');
  });

  test('三类异常各自被拦下且原因可读', async ({ page }) => {
    await setEmptyRoster(page);
    await gotoPeople(page);
    await openPasteImport(page);
    await pasteAndParse(
      page,
      [
        '工号,姓名',
        '10001,张三',
        '10002,',
        '10001,重复工号',
        '2.20003E+15,科学计数法',
      ].join('\n'),
    );

    await expect(page.locator('.import-meta')).toContainText('共 4 行');
    await expect(page.locator('.import-meta')).toContainText('可导入 1');
    await expect(page.locator('.import-meta')).toContainText('异常 3');

    const table = page.locator('.preview-table');
    await expect(table).toContainText('姓名为空');
    await expect(table).toContainText('重复');
    await expect(table).toContainText('科学计数法');
    await expect(table).toContainText('原始数据在导出时已损坏');
  });

  test('归一化后的工号在预检表里与原值并列展示', async ({ page }) => {
    await setEmptyRoster(page);
    await gotoPeople(page);
    await openPasteImport(page);
    // 全角数字 + 首尾空格 + 前导零
    await pasteAndParse(page, '工号,姓名\n　２２０００３０ ,张三');

    const row = page.locator('.preview-table .el-table__body tr').first();
    await expect(row).toContainText('２２０００３０');
    await expect(row.locator('.normalized')).toHaveText('2200030');
    await expect(page.locator('.import-meta')).toContainText('归一化修正');
  });

  test('与现有名单冲突时可选策略，默认跳过', async ({ page }) => {
    await setRoster(page, [{ key: '10001', name: '张三原名' }]);
    await gotoPeople(page);
    await openPasteImport(page);
    await pasteAndParse(page, '工号,姓名\n10001,张三新名\n10002,李四');

    await expect(page.locator('.import-meta')).toContainText('与现有冲突 1');
    await expect(page.locator('.preview-table')).toContainText(
      '工号已存在于当前名单',
    );

    // 默认跳过
    await page
      .locator('.c-ImportDialog .el-dialog__footer .el-button--primary')
      .click();
    await page.waitForTimeout(300);
    await expect(page.locator('.result-panel')).toContainText('跳过 1 人');

    await page
      .locator('.c-ImportDialog .el-dialog__footer .el-button--primary')
      .click();
    await page.waitForTimeout(300);

    const roster = (await page.evaluate(() =>
      JSON.parse(localStorage.getItem('roster') ?? '[]'),
    )) as Array<{ key: string; name: string }>;
    expect(roster.find((p) => p.key === '10001')?.name).toBe('张三原名');
  });

  test('覆盖策略会更新姓名', async ({ page }) => {
    await setRoster(page, [{ key: '10001', name: '张三原名', enabled: false }]);
    await gotoPeople(page);
    await openPasteImport(page);
    await pasteAndParse(page, '工号,姓名\n10001,张三新名');

    await page
      .locator('.strategy-row .el-radio-button')
      .filter({ hasText: '覆盖' })
      .click();
    await page.waitForTimeout(200);
    await page
      .locator('.c-ImportDialog .el-dialog__footer .el-button--primary')
      .click();
    await page.waitForTimeout(300);
    await expect(page.locator('.result-panel')).toContainText('覆盖 1 人');

    await page
      .locator('.c-ImportDialog .el-dialog__footer .el-button--primary')
      .click();
    await page.waitForTimeout(300);

    const roster = (await page.evaluate(() =>
      JSON.parse(localStorage.getItem('roster') ?? '[]'),
    )) as Array<{ key: string; name: string; enabled: boolean }>;
    expect(roster[0].name).toBe('张三新名');
    // 导入只带工号+姓名，不应静默沿用旧的排除状态
    expect(roster[0].enabled).toBe(true);
  });

  test('Excel 制表符粘贴同样可用', async ({ page }) => {
    await setEmptyRoster(page);
    await gotoPeople(page);
    await openPasteImport(page);
    await pasteAndParse(page, '工号\t姓名\n10001\t张三\n10002\t李四');

    await expect(page.locator('.import-meta')).toContainText('制表符');
    await expect(page.locator('.import-meta')).toContainText('可导入 2');
  });

  test('只有一列时阻断而不是给出 0 行表格', async ({ page }) => {
    await setEmptyRoster(page);
    await gotoPeople(page);
    await openPasteImport(page);
    await pasteAndParse(page, '10001\n10002');

    await expect(page.locator('.el-alert')).toContainText(
      '未识别到工号与姓名两列',
    );
    // 阻断状态下导入按钮不可用
    await expect(
      page.locator('.c-ImportDialog .el-dialog__footer .el-button--primary'),
    ).toBeDisabled();
  });

  test('导入已有工号时说明列区分「新增」与「冲突」', async ({ page }) => {
    await setRoster(page, [{ key: '10001', name: '张三原名' }]);
    await gotoPeople(page);
    await openPasteImport(page);
    await pasteAndParse(page, '工号,姓名\n10001,张三新名\n10002,李四');

    const rows = page.locator('.preview-table .el-table__body tr');
    await expect(rows.nth(0)).toContainText('工号已存在于当前名单');
    await expect(rows.nth(1)).toContainText('新增');
  });
});
