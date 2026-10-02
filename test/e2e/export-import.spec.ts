/**
 * E2E `export-import` of `M8-polish.md` T-M8-03:
 * "export downloads a file and import restores it (Playwright download and file chooser)."
 */

import { test, expect, type Page } from '@playwright/test';

async function call<T>(page: Page, body: string): Promise<T> {
  return page.evaluate(`(async () => { const h = window.__deepholm; ${body} })()`) as Promise<T>;
}

test('export-import', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?start=flat-test');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await page.locator('canvas#screen').click();

  await call(page, 'h.step(50);');
  const savedHash = await call<string>(page, 'return h.hash();');
  expect(savedHash.length).toBe(16);

  // Quick save to ensure a manual save exists to export
  await page.keyboard.press('F5');
  await expect.poll(() => call<string | null>(page, 'await h.settled(); return h.lastSaveId();')).toMatch(/^manual-\d+$/);

  // Go to main menu and open Load screen
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => call<string>(page, 'return h.screen();')).toBe('main_menu');
  await page.locator('canvas#screen').click();
  await page.keyboard.press('l');
  await expect.poll(() => call<string>(page, 'return h.screen();')).toBe('load');

  // Export the selected save
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('e');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^[a-z0-9-]+-y\d+-\d+\.deepholm$/);
  const path = await download.path();

  // Import the file back via file chooser
  const chooserPromise = page.waitForEvent('filechooser');
  await call(page, "h.key('i');");
  const chooser = await chooserPromise;
  await chooser.setFiles(path);

  // Wait for the imported save to appear in listing
  await expect.poll(() => call<number>(page, 'return h.text().filter((l) => l.includes("manual-") || l.includes(" · ")).length;')).toBeGreaterThan(0);
  await page.waitForTimeout(300);

  // Load the newly imported save
  await page.keyboard.press('Enter');
  await expect.poll(() => call<string>(page, 'return h.screen();')).toBe('fortress');
  await expect.poll(() => call<string>(page, 'return h.hash();')).toBe(savedHash);
  expect(errors).toEqual([]);
});
