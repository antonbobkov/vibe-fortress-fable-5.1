/**
 * T-441: with real clicks and the z-level keys, designate a ten-level stair shaft and a three-level
 * room beside its foot, and the dwarves dig both (24 § Input model).
 */
import { test, expect, type Page } from '@playwright/test';
import { screenOf, textOf, tilePixel } from './helpers';

const STAIRS_UP = 4;
const STAIRS_DOWN = 5;
const STAIRS_UPDOWN = 6;
const FLOOR = 2;
const SURFACE = 32;

interface DigHook {
  dwarves(): { x: number; y: number; z: number }[];
  step(ticks: number): void;
  readers: {
    ui: { z: number };
    map: { kindAt(i: number): number; index(x: number, y: number, z: number): number; designationAt(i: number): number };
    of(id: '14'): { at(i: number): number };
  };
}

async function z(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __deepholm: DigHook }).__deepholm.readers.ui.z);
}

async function toLevel(page: Page, level: number): Promise<void> {
  for (let guard = 0; guard < 40 && (await z(page)) !== level; guard += 1) await page.keyboard.press((await z(page)) > level ? '<' : '>');
  expect(await z(page)).toBe(level);
}

async function clickTile(page: Page, x: number, y: number): Promise<void> {
  const pt = await tilePixel(page, x, y);
  await page.mouse.click(pt.x, pt.y);
}

test('T-441 two-click-3d-designation: a ten-level shaft and a three-level room by clicks, dug', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?start=flat-test&embark=default');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('fortress');
  await page.locator('canvas#screen').click();
  await page.keyboard.press('Escape');

  // The stairwell tool on a free surface tile near the map cursor (the centre of the view), with no building on it.
  await page.keyboard.press('d');
  await expect.poll(() => textOf(page)).toContain('Click 2 corners');
  const shaft = await page.evaluate((Z) => {
    const h = (window as unknown as { __deepholm: DigHook & { readers: { ui: { cursor: { x: number; y: number } | null } } } }).__deepholm;
    const c = h.readers.ui.cursor;
    if (c === null) return null;
    for (let dx = 0; dx < 12; dx += 1) {
      const i = h.readers.map.index(c.x - dx, c.y, Z);
      if (h.readers.map.kindAt(i) === 2 && h.readers.of('14').at(i) === 0) return { x: c.x - dx, y: c.y };
    }
    return null;
  }, SURFACE);
  expect(shaft).not.toBeNull();
  const s = shaft as { x: number; y: number };

  // A click on top, nine levels down, a click on the same tile.
  await page.keyboard.press('w');
  await clickTile(page, s.x, s.y);
  await expect.poll(() => textOf(page)).toContain(`Stairwell from z ${SURFACE}`);
  await toLevel(page, SURFACE - 9);
  await expect.poll(() => textOf(page)).toContain('1x1x10 levels');
  await clickTile(page, s.x, s.y);

  // Dig: a 3×3 room east of the shaft's three lowest levels, by a click on each corner.
  await page.keyboard.press('Shift+D');
  await toLevel(page, SURFACE - 7);
  await clickTile(page, s.x + 1, s.y - 1);
  await toLevel(page, SURFACE - 9);
  const corner = await tilePixel(page, s.x + 3, s.y + 1);
  await page.mouse.move(corner.x, corner.y);
  await expect.poll(() => textOf(page)).toContain('Dig 3x3x3 levels (27 tiles)');
  await clickTile(page, s.x + 3, s.y + 1);

  const designated = await page.evaluate(({ x, y, Z }) => {
    const m = (window as unknown as { __deepholm: DigHook }).__deepholm.readers.map;
    let n = 0;
    for (let z = Z - 9; z <= Z; z += 1) if (m.designationAt(m.index(x, y, z)) !== 0) n += 1;
    for (let z = Z - 9; z <= Z - 7; z += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dx = 1; dx <= 3; dx += 1) if (m.designationAt(m.index(x + dx, y + dy, z)) !== 0) n += 1;
    return n;
  }, { x: s.x, y: s.y, Z: SURFACE });
  expect(designated).toBe(10 + 27);

  // Let the dwarves work until the shaft and the room are dug.
  const dug = async (): Promise<{ shaft: number; room: number }> => page.evaluate(({ x, y, Z, UP, DOWN, UPDOWN, FLOORK }) => {
    const m = (window as unknown as { __deepholm: DigHook }).__deepholm.readers.map;
    let shaftDone = 0;
    for (let z = Z - 9; z <= Z; z += 1) {
      const want = z === Z ? DOWN : z === Z - 9 ? UP : UPDOWN;
      if (m.kindAt(m.index(x, y, z)) === want) shaftDone += 1;
    }
    let room = 0;
    for (let z = Z - 9; z <= Z - 7; z += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dx = 1; dx <= 3; dx += 1) if (m.kindAt(m.index(x + dx, y + dy, z)) === FLOORK) room += 1;
    return { shaft: shaftDone, room };
  }, { x: s.x, y: s.y, Z: SURFACE, UP: STAIRS_UP, DOWN: STAIRS_DOWN, UPDOWN: STAIRS_UPDOWN, FLOORK: FLOOR });
  let state = await dug();
  for (let round = 0; round < 60 && (state.shaft < 10 || state.room < 27); round += 1) {
    await page.evaluate(() => (window as unknown as { __deepholm: DigHook }).__deepholm.step(1000));
    state = await dug();
  }
  expect(state).toEqual({ shaft: 10, room: 27 });
  expect(errors).toEqual([]);
});
