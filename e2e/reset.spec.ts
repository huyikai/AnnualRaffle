import { test, expect } from '@playwright/test';
import {
  resetApp,
  openResultDialog,
  getResultCount,
  openConfigDialog,
  closeConfigDialog,
  setGlobalExclude,
  getGlobalExcludeState,
  getStorageData,
  injectResults,
  setRoster,
} from './helpers';

test.describe('重置功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('点击重置按钮弹出确认框', async ({ page }) => {
    await page.locator('a.btn-reset').click();
    const msgBox = page.locator('.el-message-box');
    await expect(msgBox).toBeVisible();
    await expect(msgBox).toContainText('将重置抽奖结果');
    await page
      .locator('.el-message-box__btns .el-button')
      .filter({ hasText: '取消' })
      .click();
    await page.waitForTimeout(300);
  });

  test('确认重置后抽奖结果清空', async ({ page }) => {
    await injectResults(page, {
      firstPrize: ['1004'],
      secondPrize: ['1005', '1006'],
      thirdPrize: [],
      luckyFirst: [],
      luckySecond: [],
    });
    await page.locator('a.btn-reset').click();
    await page.waitForTimeout(500);
    await page
      .locator('.el-message-box__btns .el-button--primary')
      .click({ noWaitAfter: true });
    await page.waitForTimeout(3000);
    const result = (await getStorageData(page, 'result')) as Record<
      string,
      string[]
    > | null;
    if (result === null) {
      // reset 后 localStorage 中 result 被清除
      expect(result).toBeNull();
    } else {
      expect(result.firstPrize?.length ?? 0).toBe(0);
      expect(result.secondPrize?.length ?? 0).toBe(0);
    }
  });

  test('取消重置不影响数据', async ({ page }) => {
    await injectResults(page, {
      firstPrize: ['1004'],
      secondPrize: [],
      thirdPrize: [],
      luckyFirst: [],
      luckySecond: [],
    });
    await page.locator('a.btn-reset').click();
    await page
      .locator('.el-message-box__btns .el-button')
      .filter({ hasText: '取消' })
      .click();
    await page.waitForTimeout(300);
    const result = (await getStorageData(page, 'result')) as Record<
      string,
      string[]
    >;
    expect(result.firstPrize).toContain('1004');
  });

  // ========== 更多重置（选项框） ==========
  //
  // 这个选项框从项目第一个提交起就没有任何入口能打开，
  // 四个重置选项里只有「抽奖结果」真的生效。这里补上入口与覆盖。

  test('「更多重置」能打开选项框', async ({ page }) => {
    await page.locator('a.btn-reset-more').click();
    const dialog = page.locator('.c-removeoptions');
    await expect(dialog).toBeVisible();
    for (const label of [
      '重置全部数据',
      '重置抽奖配置',
      '重置名单',
      '重置抽奖结果',
    ]) {
      await expect(dialog).toContainText(label);
    }
  });

  test('选项框选「重置名单」后名单被清空', async ({ page }) => {
    await setRoster(page, [
      { key: '1001', name: '张三' },
      { key: '1002', name: '李四' },
    ]);
    await page.locator('a.btn-reset-more').click();
    await page
      .locator('.c-removeoptions .el-radio')
      .filter({ hasText: '重置名单' })
      .click();
    await page.locator('.c-removeoptions .el-button--primary').click();
    await page.waitForTimeout(300);
    await page
      .locator('.el-message-box__btns .el-button--primary')
      .click({ noWaitAfter: true });
    await page.waitForTimeout(500);

    expect(await getStorageData(page, 'roster')).toBeNull();
  });

  test('确认框会说明重置的是什么', async ({ page }) => {
    await page.locator('a.btn-reset-more').click();
    await page
      .locator('.c-removeoptions .el-radio')
      .filter({ hasText: '重置全部数据' })
      .click();
    await page.locator('.c-removeoptions .el-button--primary').click();
    const msgBox = page.locator('.el-message-box');
    await expect(msgBox).toContainText('全部数据');
    // 破坏性操作要点明不可撤销
    await expect(msgBox).toContainText('无法撤销');
    await page
      .locator('.el-message-box__btns .el-button')
      .filter({ hasText: '取消' })
      .click();
  });

  test('「重置结果」不受选项框上一次选择的影响', async ({ page }) => {
    await injectResults(page, {
      firstPrize: ['1004'],
      secondPrize: [],
      thirdPrize: [],
      luckyFirst: [],
      luckySecond: [],
    });
    await setRoster(page, [
      { key: '1001', name: '张三' },
      { key: '1002', name: '李四' },
    ]);

    // 先在选项框里选「重置名单」，但取消确认
    await page.locator('a.btn-reset-more').click();
    await page
      .locator('.c-removeoptions .el-radio')
      .filter({ hasText: '重置名单' })
      .click();
    await page.locator('.c-removeoptions .el-button--primary').click();
    await page.waitForTimeout(300);
    await page
      .locator('.el-message-box__btns .el-button')
      .filter({ hasText: '取消' })
      .click();
    await page.waitForTimeout(300);

    // 再点「重置结果」——应当只清抽奖结果，名单保持不变
    await page.locator('a.btn-reset').click();
    const msgBox = page.locator('.el-message-box');
    await expect(msgBox).toContainText('抽奖结果');
    await page
      .locator('.el-message-box__btns .el-button--primary')
      .click({ noWaitAfter: true });
    await page.waitForTimeout(500);

    const roster = (await getStorageData(page, 'roster')) as Array<{
      key: string;
    }>;
    expect(roster.map((p) => p.key)).toEqual(['1001', '1002']);
  });

  test('「重置全部」后刷新不会重新灌入示例数据', async ({ page }) => {
    await setRoster(page, [{ key: '1001', name: '张三' }]);
    await page.locator('a.btn-reset-more').click();
    await page
      .locator('.c-removeoptions .el-radio')
      .filter({ hasText: '重置全部数据' })
      .click();
    await page.locator('.c-removeoptions .el-button--primary').click();
    await page.waitForTimeout(300);
    await page
      .locator('.el-message-box__btns .el-button--primary')
      .click({ noWaitAfter: true });
    await page.waitForTimeout(500);

    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1000);

    // 回归点：clearData() 抹掉 schemaVersion 后，迁移会当成首次安装
    // 重新写回 152 条示例数据，「重置全部」等于白做。
    expect(await getStorageData(page, 'roster')).toBeNull();
    expect(await getStorageData(page, 'schemaVersion')).toBe(2);
  });
});
