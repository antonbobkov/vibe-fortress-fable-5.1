/**
 * E2E `quick-save-load` (M2) of `process/testing-strategy.md` § E2E harness and `M2-things.md`
 * T-M2-11: "F5 then F9 restores the hash (through the hook)". Also the Load screen's export and
 * import: the exported `.deepholm` file, picked through the real file chooser, is stored as a new
 * manual save that loads to the same hash.
 *
 * The test drives the real keyboard; it reads state only through `window.__deepholm`.
 */

import { test, expect, type Page } from '@playwright/test';
import { focusMenu } from './helpers';

/** Run `body` against `window.__deepholm` (bound as `h`) in the page. */
async function call<T>(page: Page, body: string): Promise<T> {
  return page.evaluate(`(async () => { const h = window.__deepholm; ${body} })()`) as Promise<T>;
}

test('quick-save-load', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?start=flat-test');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await page.locator('canvas#screen').click();

  await call(page, 'h.step(40);');
  const saved = await call<string>(page, 'return h.hash();');
  expect(saved.length).toBe(16);

  await page.keyboard.press('F5');
  await expect.poll(() => call<string | null>(page, 'await h.settled(); return h.lastSaveId();')).toMatch(/^manual-\d+$/);
  await call(page, 'h.step(60);');
  expect(await call<string>(page, 'return h.hash();')).not.toBe(saved);

  await page.keyboard.press('F9');
  await expect.poll(() => call<string>(page, 'return h.screen();')).toBe('confirm');
  await page.keyboard.press('y');
  await expect.poll(() => call<string>(page, 'return h.hash();')).toBe(saved);
  expect(await call<string>(page, 'return h.screen();')).toBe('fortress');
  await page.screenshot({ path: await call<string>(page, "return h.screenshotName('quick-save-load');") });

  // Export from the Load screen, then import the file through the file chooser and load it.
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => call<string>(page, 'return h.screen();')).toBe('main_menu');
  await focusMenu(page);
  await page.keyboard.press('l');
  await expect.poll(() => call<string>(page, 'return h.screen();')).toBe('load');
  const download = page.waitForEvent('download');
  await page.keyboard.press('e');
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.deepholm$/);
  const path = await file.path();
  // `i` opens the import picker (the file input of `platform/files.ts`). After a download,
  // Chromium's download bubble can keep the page from receiving the next real key when another
  // test ran first in the same browser, so this one key goes through the hook's `key`, which is
  // the same `handleKey` path.
  const chooser = page.waitForEvent('filechooser');
  await call(page, "h.key('i');");
  await (await chooser).setFiles(path);
  await expect.poll(() => call<number>(page, 'return h.text().filter((l) => l.includes("manual-") || l.includes(" · ")).length;')).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await expect.poll(() => call<string>(page, 'return h.screen();')).toBe('fortress');
  await expect.poll(() => call<string>(page, 'return h.hash();')).toBe(saved);
  expect(errors).toEqual([]);
});
