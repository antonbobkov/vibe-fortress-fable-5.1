/**
 * E2E `generate-and-embark` (M1) of `05-plan/01-testing-strategy.md` § E2E harness.
 *
 * Part 1 (T-M1-12): "New world → generate with seed `e2e-1` → world map → cursor moves → region
 * panel text contains 'Wealth'".
 *
 * Part 2 (T-M1-13, T-M1-15): "Embark with the Balanced preset → fortress screen shows seven `☺`
 * cells near the arrival edge".
 */

import { test, expect, type Page } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, screenOf, textOf, type Hook } from './helpers';

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

  // Part 2 (T-M1-13): Embark with the Balanced preset → the fortress screen with the seven
  // dwarves near the arrival edge.
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await expect.poll(() => textOf(page)).toContain('Balanced');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('Spent 1,480');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 30_000 }).toBe('fortress');
  const placed = await page.evaluate(() => {
    const hook = (window as unknown as { __deepholm: Hook & { dwarves(): { x: number; y: number }[]; readers: { map: { w: number; h: number }; of(id: string): { spec(): { arrivalEdge: string } | null } } } }).__deepholm;
    const edge = hook.readers.of('03').spec()?.arrivalEdge ?? 'n';
    const map = hook.readers.map;
    const depth = hook.dwarves().map((d) => (edge === 'n' ? d.y : edge === 's' ? map.h - 1 - d.y : edge === 'w' ? d.x : map.w - 1 - d.x));
    return { count: depth.length, deepest: Math.max(...depth) };
  });
  expect(placed.count).toBe(7);
  // `02` § Arrival: the wagon site is searched up to ARRIVAL_SEARCH_DEPTH (20) tiles in from the edge.
  expect(placed.deepest).toBeLessThanOrEqual(20 + 2);
  // T-M1-15 (D-064): "fortress screen shows seven ☺ cells near the arrival edge". The screen opens
  // paused, centred on the wagon, with the party on seven tiles around it.
  const smileys = await page.evaluate(() => {
    const hook = (window as unknown as { __deepholm: Hook }).__deepholm;
    const cells = hook.cells();
    const mapRows = cells.rows - 5;
    let n = 0;
    for (let row = 0; row < mapRows; row += 1) for (let col = 0; col < cells.cols; col += 1) if (cells.glyph[row * cells.cols + col] === 1) n += 1;
    return n;
  });
  expect(smileys).toBe(7);
  // T-M2-08: the supplies are in the wagon; the Balanced preset brings two iron picks. (This
  // region's `old_battlefield` also scatters rusted arms, picks among them, so the count is of
  // the picks the embark brought: those in the wagon; D-076.)
  const picks = await page.evaluate(() => {
    type R = { count(id: string): number; inContainer(id: number): number[]; get(id: number): { type: number; quality: number } | undefined; categoryOf(t: number): string };
    const hook = (window as unknown as { __deepholm: { readers: { items: R; buildings: { wagon(): number } } } }).__deepholm;
    const items = hook.readers.items;
    const wagon = hook.readers.buildings.wagon();
    const inWagon = items.inContainer(wagon).filter((id) => items.categoryOf(items.get(id)?.type ?? 0) === 'tool/pick').length;
    return { inWagon, all: items.count('pick'), wagon };
  });
  expect(picks.wagon).toBeGreaterThan(0);
  expect(picks.inWagon).toBe(2);
  expect(picks.all).toBeGreaterThanOrEqual(2);

  const path = await page.evaluate(() => (window as unknown as { __deepholm: Hook }).__deepholm.screenshotName('generate-and-embark'));
  await page.screenshot({ path });
  expect(errors).toEqual([]);
});
