import { test, expect } from '@playwright/test';
import { resetApp, setEmptyRoster, gotoPeople } from './helpers';

/**
 * 网页版的文件选择路径。
 *
 * 这条链路过去完全没有覆盖：e2e 里没有一处 setInputFiles，导入用例走的都是
 * 「批量粘贴」或直接写 localStorage。但 utils/pickFile.ts 是导入 CSV、导入照片、
 * 恢复备份三处共用的原语，值得单独钉住两件事——
 *   1. 选到文件时能正常解析
 *   2. 无论选到还是取消，隐藏 input 都不会留在 document.body 里
 *
 * input 是运行时 createElement 出来的，没法用 setInputFiles 直接定位，
 * 这里用 Playwright 的 filechooser 事件拦截原生选择框。
 */

const SAMPLE_CSV = '工号,姓名\n10001,张三\n10002,李四';

/** 统计残留的隐藏 file input 数量 */
function strayInputs(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => document.querySelectorAll('input[type="file"]').length,
  );
}

async function openImportDialog(page: import('@playwright/test').Page) {
  await setEmptyRoster(page);
  await gotoPeople(page);
  await page.locator('.people-header-right .el-button--primary').click();
  await page
    .locator('.c-ImportDialog')
    .waitFor({ state: 'visible', timeout: 5000 });
}

test.describe('文件选择', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await resetApp(page);
  });

  test('选择 CSV 文件后能解析出预检表', async ({ page }) => {
    await openImportDialog(page);

    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('.dropzone').click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: '名单.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(SAMPLE_CSV, 'utf-8'),
    });

    await expect(page.locator('.import-meta')).toContainText('共 2 行');
  });

  test('选完文件后不残留隐藏 input', async ({ page }) => {
    await openImportDialog(page);

    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('.dropzone').click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: '名单.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(SAMPLE_CSV, 'utf-8'),
    });
    await expect(page.locator('.import-meta')).toContainText('共 2 行');

    expect(await strayInputs(page)).toBe(0);
  });

  test('取消选择后不残留隐藏 input，界面也不卡在加载态', async ({ page }) => {
    await openImportDialog(page);

    // 打开原生选择框后不提供文件，等价于用户点了取消。
    // 焦点类取消信号在无头浏览器里不可靠，这里直接派发 cancel 事件，
    // 验证的是「取消也要走清理」这条不变式。
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('.dropzone').click();
    await chooserPromise;

    await page.evaluate(() => {
      document
        .querySelectorAll('input[type="file"]')
        .forEach((el) => el.dispatchEvent(new Event('cancel')));
    });

    await expect.poll(() => strayInputs(page), { timeout: 3000 }).toBe(0);
    // 取消不应该改变任何数据，预检区仍是初始的待选择状态
    await expect(page.locator('.import-meta')).toHaveCount(0);
  });

  test('反复打开并取消不会累积隐藏 input', async ({ page }) => {
    await openImportDialog(page);

    for (let i = 0; i < 3; i++) {
      const chooserPromise = page.waitForEvent('filechooser');
      await page.locator('.dropzone').click();
      await chooserPromise;
      await page.evaluate(() => {
        document
          .querySelectorAll('input[type="file"]')
          .forEach((el) => el.dispatchEvent(new Event('cancel')));
      });
      await page.waitForTimeout(100);
    }

    expect(await strayInputs(page)).toBe(0);
  });
});
