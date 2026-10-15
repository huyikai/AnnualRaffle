import { test, expect } from '@playwright/test';
import {
  resetApp,
  setRoster,
  setEmptyRoster,
  gotoPeople,
  getRosterStats,
  getStorageData,
  setResult,
} from './helpers';

const SAMPLE = [
  { key: '10001', name: '张三' },
  { key: '10002', name: '李四' },
  { key: 'E00123', name: '王五' },
  { key: '0012345', name: '赵六' },
];

test.describe('人员管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('空名单时展示引导而不是空白表格', async ({ page }) => {
    await setEmptyRoster(page);
    await gotoPeople(page);
    await expect(page.locator('.empty-slot')).toBeVisible();
    await expect(page.locator('.empty-slot')).toContainText('还没有人员名单');
    await expect(page.locator('.empty-slot .el-button--primary')).toContainText(
      '导入名单',
    );
  });

  test('名单正确渲染，保留前导零与字母工号', async ({ page }) => {
    await setRoster(page, SAMPLE);
    await gotoPeople(page);
    const rows = page.locator('.el-table__body tr');
    await expect(rows).toHaveCount(4);
    // 这两个是最容易被静默破坏的格式
    await expect(page.locator('.el-table__body')).toContainText('0012345');
    await expect(page.locator('.el-table__body')).toContainText('E00123');
  });

  test('统计区分参与与排除', async ({ page }) => {
    await setRoster(page, [
      { key: '10001', name: '张三', enabled: true },
      { key: '10002', name: '李四', enabled: true },
      { key: '10003', name: '王五', enabled: false },
    ]);
    await gotoPeople(page);
    const stats = await getRosterStats(page);
    expect(stats.total).toBe(3);
    expect(stats.active).toBe(2);
    expect(stats.excluded).toBe(1);
  });

  test('搜索按工号或姓名实时过滤', async ({ page }) => {
    await setRoster(page, SAMPLE);
    await gotoPeople(page);

    await page.locator('.people-search input').fill('李');
    await expect(page.locator('.el-table__body tr')).toHaveCount(1);
    await expect(page.locator('.el-table__body')).toContainText('李四');

    await page.locator('.people-search input').fill('E00123');
    await expect(page.locator('.el-table__body tr')).toHaveCount(1);
    await expect(page.locator('.el-table__body')).toContainText('王五');

    await page.locator('.people-search input').fill('不存在的名字');
    await expect(page.locator('.el-table__body tr')).toHaveCount(0);
  });

  test('切换参与开关并刷新后保持', async ({ page }) => {
    await setRoster(page, SAMPLE);
    await gotoPeople(page);

    await page
      .locator('.el-table__body tr')
      .first()
      .locator('.el-switch')
      .click();
    await page.waitForTimeout(300);
    expect((await getRosterStats(page)).active).toBe(3);

    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.people-page');
    expect((await getRosterStats(page)).active).toBe(3);
  });

  test('新增人员后写入名册', async ({ page }) => {
    await setRoster(page, SAMPLE);
    await gotoPeople(page);

    await page
      .locator('.people-header-right .el-button')
      .filter({ hasText: '新增人员' })
      .click();
    await page.locator('.el-dialog__body input').first().fill('20001');
    await page.locator('.el-dialog__body input').nth(1).fill('新同事');
    await page.locator('.el-dialog__footer .el-button--primary').click();
    await page.waitForTimeout(300);

    expect((await getRosterStats(page)).total).toBe(5);
    await expect(page.locator('.el-table__body')).toContainText('新同事');
  });

  test('拒绝重复工号并给出提示', async ({ page }) => {
    await setRoster(page, SAMPLE);
    await gotoPeople(page);

    await page
      .locator('.people-header-right .el-button')
      .filter({ hasText: '新增人员' })
      .click();
    await page.locator('.el-dialog__body input').first().fill('10001');
    await page.locator('.el-dialog__body input').nth(1).fill('冒名者');
    await page.locator('.el-dialog__footer .el-button--primary').click();
    await page.waitForTimeout(300);

    await expect(page.locator('.field-error')).toContainText('该工号已存在');
    expect((await getRosterStats(page)).total).toBe(4);
  });

  test('编辑姓名后列表与存储同步', async ({ page }) => {
    await setRoster(page, SAMPLE);
    await gotoPeople(page);

    await page
      .locator('.el-table__body tr')
      .first()
      .locator('button')
      .filter({ hasText: '编辑' })
      .click();
    await page.locator('.el-dialog__body input').nth(1).fill('张三改');
    await page.locator('.el-dialog__footer .el-button--primary').click();
    await page.waitForTimeout(300);

    await expect(page.locator('.el-table__body')).toContainText('张三改');
    const roster = (await getStorageData(page, 'roster')) as Array<{
      key: string;
      name: string;
    }>;
    expect(roster.find((p) => p.key === '10001')?.name).toBe('张三改');
  });

  test('删除人员需确认，确认后从存储移除', async ({ page }) => {
    await setRoster(page, SAMPLE);
    await gotoPeople(page);

    await page
      .locator('.el-table__body tr')
      .first()
      .locator('button')
      .filter({ hasText: '删除' })
      .click();
    await page.locator('.el-message-box__btns .el-button--primary').click();
    await page.waitForTimeout(300);

    expect((await getRosterStats(page)).total).toBe(3);
    const roster = (await getStorageData(page, 'roster')) as Array<{
      key: string;
    }>;
    expect(roster.map((p) => p.key)).not.toContain('10001');
  });

  test('删除时提示该人员已中奖', async ({ page }) => {
    await setRoster(page, SAMPLE);
    // 必须在 reload 之前写入：hash 切换不会让外壳重新挂载
    await setResult(page, { firstPrize: ['10001'] });
    await gotoPeople(page);

    await page
      .locator('.el-table__body tr')
      .first()
      .locator('button')
      .filter({ hasText: '删除' })
      .click();
    const box = page.locator('.el-message-box');
    await expect(box).toContainText('已中 1 次奖');
    await box.locator('.el-button--primary').click();
    await page.waitForTimeout(300);

    // 中奖记录必须保留
    const result = (await getStorageData(page, 'result')) as Record<
      string,
      string[]
    >;
    expect(result.firstPrize).toEqual(['10001']);
  });

  test('批量停用与批量删除', async ({ page }) => {
    await setRoster(page, SAMPLE);
    await gotoPeople(page);

    // 勾选前两行
    const checkboxes = page.locator('.el-table__body .el-checkbox');
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();
    await page.waitForTimeout(200);
    await expect(page.locator('.batch-count')).toContainText('已选 2 人');

    await page
      .locator('.people-batch .el-button')
      .filter({ hasText: '批量停用' })
      .click();
    await page.waitForTimeout(300);
    expect((await getRosterStats(page)).active).toBe(2);

    await page.locator('.el-table__body .el-checkbox').nth(0).click();
    await page.locator('.el-table__body .el-checkbox').nth(1).click();
    await page.waitForTimeout(200);
    await page
      .locator('.people-batch .el-button')
      .filter({ hasText: '批量删除' })
      .click();
    await page.locator('.el-message-box__btns .el-button--primary').click();
    await page.waitForTimeout(300);

    expect((await getRosterStats(page)).total).toBe(2);
  });
});
