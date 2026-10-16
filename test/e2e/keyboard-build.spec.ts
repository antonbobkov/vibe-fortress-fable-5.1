/**
 * E2E `keyboard-build` (T-271): with the real keyboard and no mouse, Build chooses first and places second. A category
 * key opens the list and places nothing, `Enter` picks the building, the arrows move the map cursor to a chosen tile,
 * and `Enter` places there: a carpenter's workshop, then a bed, each at the tile asked for.
 */

import { expect, test, type Page } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, screenOf, textOf, type Hook } from './helpers';

interface KeyboardHook extends Hook {
  step(n: number): void;
  readers: {
    ui: { camX: number; camY: number; z: number; panel: string | null; cursor: { x: number; y: number } | null };
    map: { w: number; h: number; index(x: number, y: number, z: number): number };
    buildings: {
      byType(type: string): number[];
      get(id: number): { origin: number; state: string } | undefined;
      ghost(type: string, origin: number, orientation: number): { reason: string | null };
    };
  };
}

/** A tile in view where the type's footprint centred on it is valid; for a 3x3 type the origin is one up and left. */
async function findSite(page: Page, type: string, size: number): Promise<{ x: number; y: number } | null> {
  return page.evaluate(({ type, size }) => {
    const hook = (window as unknown as { __deepholm: KeyboardHook }).__deepholm;
    const u = hook.readers.ui;
    const map = hook.readers.map;
    const half = Math.floor(size / 2);
    for (let y = u.camY + 8; y < u.camY + 30; y += 1) {
      for (let x = u.camX + 8; x < u.camX + 30; x += 1) {
        if (hook.readers.buildings.ghost(type, map.index(x - half, y - half, u.z), 0).reason === null) return { x, y };
      }
    }
    return null;
  }, { type, size });
}

const cursorOf = (page: Page): Promise<{ x: number; y: number } | null> =>
  page.evaluate(() => (window as unknown as { __deepholm: KeyboardHook }).__deepholm.readers.ui.cursor);

/** Move the map cursor to a tile with the arrows alone, ten at a time with Shift and then one. */
async function cursorTo(page: Page, x: number, y: number): Promise<void> {
  for (let guard = 0; guard < 80; guard += 1) {
    const c = await cursorOf(page);
    if (c === null) throw new Error('the cursor is not shown');
    const dx = x - c.x;
    const dy = y - c.y;
    if (dx === 0 && dy === 0) return;
    const horizontal = dx !== 0;
    const delta = horizontal ? dx : dy;
    const key = horizontal ? (delta > 0 ? 'ArrowRight' : 'ArrowLeft') : (delta > 0 ? 'ArrowDown' : 'ArrowUp');
    await page.keyboard.press(Math.abs(delta) >= 10 ? `Shift+${key}` : key);
  }
  throw new Error(`the cursor did not reach ${x},${y}`);
}

/** Highlight the building by name in the open list: Enter picks the row, and Backspace drops it again until the status row names it. */
async function pickRow(page: Page, name: string): Promise<void> {
  for (let k = 0; k < 30; k += 1) {
    await page.keyboard.press('Enter');
    if ((await textOf(page)).includes(`${name} · `)) return;
    await page.keyboard.press('Backspace');
    await page.keyboard.press('ArrowDown');
  }
  throw new Error(`${name} is not in the list`);
}

test('keyboard-build', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await generateWorld(page, 't271-keyboard-build');
  await findEmbarkableRegion(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await page.locator('canvas#screen').click();

  const workshopAt = await findSite(page, 'carpenter', 3);
  expect(workshopAt).not.toBeNull();
  const shop = workshopAt as { x: number; y: number };

  // The category key opens the list and arms nothing; Enter on the row arms the building.
  await page.keyboard.press('b');
  await page.keyboard.press('w');
  await expect.poll(() => textOf(page)).toContain('Enter pick');
  await pickRow(page, "Carpenter's workshop");
  await cursorTo(page, shop.x, shop.y);
  await expect.poll(() => textOf(page)).toContain("Carpenter's workshop · click to place");
  await page.keyboard.press('Enter');
  await page.evaluate(() => (window as unknown as { __deepholm: KeyboardHook }).__deepholm.step(2));
  const placed = await page.evaluate(({ x, y }) => {
    const hook = (window as unknown as { __deepholm: KeyboardHook }).__deepholm;
    const map = hook.readers.map;
    const ids = hook.readers.buildings.byType('carpenter');
    return ids.map((id) => hook.readers.buildings.get(id)?.origin).filter((origin) => origin === map.index(x - 1, y - 1, hook.readers.ui.z));
  }, shop);
  expect(placed, 'the workshop stands where the cursor was').toHaveLength(1);

  // A bed after it: Backspace back to the list, choose the furniture list, pick the bed, move, place.
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Shift+F');
  const bedAt = await findSite(page, 'bed', 1);
  expect(bedAt).not.toBeNull();
  const bed = bedAt as { x: number; y: number };
  await pickRow(page, 'Bed');
  await cursorTo(page, bed.x, bed.y);
  await page.keyboard.press('Enter');
  await page.evaluate(() => (window as unknown as { __deepholm: KeyboardHook }).__deepholm.step(2));
  const beds = await page.evaluate(({ x, y }) => {
    const hook = (window as unknown as { __deepholm: KeyboardHook }).__deepholm;
    const map = hook.readers.map;
    return hook.readers.buildings.byType('bed').map((id) => hook.readers.buildings.get(id)?.origin).filter((origin) => origin === map.index(x, y, hook.readers.ui.z));
  }, bed);
  expect(beds, 'the bed stands where the cursor was').toHaveLength(1);
  expect(errors).toEqual([]);
});
