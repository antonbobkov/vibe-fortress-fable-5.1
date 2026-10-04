/**
 * E2E `boot` (M0) of `05-plan/01-testing-strategy.md` § E2E harness and `M0-skeleton.md` T-M0-13:
 * "page loads, canvas present, `cells()` non-empty, pressing `>` changes `readers.ui.z`,
 * screenshot saved".
 *
 * The test drives the real keyboard; it reads state only through `window.__deepholm`.
 */

import { expect, type Page } from '@playwright/test';

interface HookView {
  cols: number;
  rows: number;
  nonBlank: number;
  z: number;
}

declare global {
  interface Window {
    __deepholm?: {
      readers: { ui: { z: number } };
      cells(): { cols: number; rows: number; glyph: number[] };
      screenshotName(name: string): string;
    };
  }
}

async function view(page: import('@playwright/test').Page): Promise<HookView> {
  return page.evaluate(() => {
    const hook = window.__deepholm;
    if (hook === undefined) throw new Error('no window.__deepholm');
    const cells = hook.cells();
    return {
      cols: cells.cols,
      rows: cells.rows,
      nonBlank: cells.glyph.filter((g) => g !== 0 && g !== 32).length,
      z: hook.readers.ui.z,
    };
  });
}

export async function bootSmoke(page: Page, name: string): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/?start=flat-test');
  const canvas = page.locator('canvas#screen');
  await expect(canvas).toBeVisible();
  await page.waitForFunction(() => window.__deepholm !== undefined);

  const before = await view(page);
  expect(before.cols).toBeGreaterThan(0);
  expect(before.rows).toBeGreaterThan(0);
  expect(before.nonBlank).toBeGreaterThan(0);

  await canvas.click();
  await page.keyboard.press('>');
  await expect.poll(async () => (await view(page)).z).toBe(before.z + 1);

  const path = await page.evaluate((name) => window.__deepholm?.screenshotName(name) ?? '', name);
  expect(path).toBe(`reports/screenshots/${name}.png`);
  await page.screenshot({ path });
  expect(errors).toEqual([]);
}
