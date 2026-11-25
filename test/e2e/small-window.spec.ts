/**
 * T-758: a window under 960 × 540 keeps the whole 80 × 45 grid (23 § Canvas and cells): the
 * backing store is the grid and the element is shrunk to fit, so the status bar, the key bar and
 * the hover line are drawn, and a click on `[?] help` opens Help.
 */

import { expect, test } from '@playwright/test';
import { clickText, screenOf, textOf } from './helpers';

interface SmallHook {
  readers: { ui: { panel: string | null } };
  screenshotName(name: string): string;
}

test.use({ viewport: { width: 960, height: 480 } });

test('small-window', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?start=flat-test&embark=default');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('fortress');

  const canvas = page.locator('canvas#screen');
  const size = await canvas.evaluate((el) => ({ w: (el as HTMLCanvasElement).width, h: (el as HTMLCanvasElement).height }));
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  if (dpr === 1) expect(size).toEqual({ w: 960, h: 540 });
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no canvas box');
  expect(box.x + box.width).toBeLessThanOrEqual(960);
  expect(box.y + box.height).toBeLessThanOrEqual(480);
  expect(await textOf(page)).toContain('[?] help');

  const path = await page.evaluate(() => (window as unknown as { __deepholm: SmallHook }).__deepholm.screenshotName('small-window'));
  await page.screenshot({ path });

  await clickText(page, '[?] help');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __deepholm: SmallHook }).__deepholm.readers.ui.panel)).toBe('help');
  expect(errors).toEqual([]);
});
