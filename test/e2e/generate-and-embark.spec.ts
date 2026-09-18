/**
 * E2E `generate-and-embark` (M1) of `05-plan/01-testing-strategy.md` § E2E harness.
 *
 * Part 1 (T-M1-12): "New world → generate with seed `e2e-1` → world map → cursor moves → region
 * panel text contains 'Wealth'".
 */

import { test, expect, type Page } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, textOf, type Hook } from './helpers';

/** The map cell drawn inverted: the world-map cursor (every other map cell has a black bg). */
async function cursorCell(page: Page): Promise<number> {
  return page.evaluate(() => {
    const cells = (window as unknown as { __deepholm: Hook }).__deepholm.cells();
    for (let row = 0; row < cells.rows; row += 1) {
      for (let col = 0; col < cells.cols - 40; col += 1) {
        const i = row * cells.cols + col;
        if ((cells.bg[i] as number) !== 0 && (cells.glyph[i] as number) !== 0) return i;
      }
    }
    return -1;
  });
}

test('generate-and-embark', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await generateWorld(page, 'e2e-1');

  // Part 1: the cursor moves, and the region panel states the region.
  const before = await cursorCell(page);
  expect(before).toBeGreaterThanOrEqual(0);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => cursorCell(page)).toBe(before + 1);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => cursorCell(page)).toBe(before);
  await findEmbarkableRegion(page);
  await expect.poll(() => textOf(page)).toContain('Wealth');

  const path = await page.evaluate(() => (window as unknown as { __deepholm: Hook }).__deepholm.screenshotName('generate-and-embark'));
  await page.screenshot({ path });
  expect(errors).toEqual([]);
});
