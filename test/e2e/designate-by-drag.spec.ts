/**
 * E2E `designate-by-drag` (M1) of `05-plan/01-testing-strategy.md` § E2E harness and
 * `M1-ground.md` T-M1-14: "press `d`, `d`, drag a 4×3 rectangle on the rock face, wait 3,000 ticks
 * at 4×, assert ≥ 10 `Floor` tiles via readers, screenshot".
 *
 * The world is generated and embarked through the real screens; the test uses the world reader
 * to pick the region with the most relief (so the map has a rock face) and the local map's readers
 * to find a 4×3 face of wall beside ground the dwarves can reach; everything else is keys and the
 * mouse.
 */

import { test, expect, type Page } from '@playwright/test';
import { generateWorld, hilliestRegion, moveCursorTo, screenOf, textOf, type Hook } from './helpers';

const TILE_FLOOR = 2;
const TILE_WALL = 1;
const TILE_BOULDER = 11;

interface FullHook extends Hook {
  dwarves(): { x: number; y: number; z: number }[];
  readers: {
    ui: { camX: number; camY: number; z: number };
    calendar: { tick: number };
    world: { size(): number; regions(): readonly { id: number; biome: string; elevation: number }[] } | null;
    map: { w: number; h: number; d: number; kindAt(i: number): number; index(x: number, y: number, z: number): number };
    of(id: 'pathing'): { labelOf(i: number, cls: string): number };
  };
}

/**
 * A 4×3 rectangle of wall (or boulder) on one level whose near side borders open ground the party
 * can walk to: the rock face. Nearest to the first dwarf first.
 */
async function findFace(page: Page): Promise<{ x: number; y: number; z: number; w: number; h: number } | null> {
  return page.evaluate(
    ({ FLOOR, WALL, BOULDER }) => {
      const hook = (window as unknown as { __deepholm: FullHook }).__deepholm;
      const map = hook.readers.map;
      const dwarf = hook.dwarves()[0];
      if (dwarf === undefined) return null;
      const home = hook.readers.of('pathing').labelOf(map.index(dwarf.x, dwarf.y, dwarf.z), 'walker');
      const solid = (x: number, y: number, z: number): boolean => {
        if (x < 1 || y < 1 || x >= map.w - 1 || y >= map.h - 1) return false;
        const k = map.kindAt(map.index(x, y, z));
        return k === WALL || k === BOULDER;
      };
      const standable = (x: number, y: number, z: number): boolean => {
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
        const i = map.index(x, y, z);
        return map.kindAt(i) === FLOOR && hook.readers.of('pathing').labelOf(i, 'walker') === home;
      };
      let best: { x: number; y: number; z: number; w: number; h: number } | null = null;
      let bestD = Infinity;
      for (let z = Math.max(0, dwarf.z - 6); z <= Math.min(map.d - 1, dwarf.z + 6); z += 1) {
        for (let y = 1; y < map.h - 4; y += 1) {
          for (let x = 1; x < map.w - 5; x += 1) {
            let ok = true;
            for (let dy = 0; dy < 3 && ok; dy += 1) for (let dx = 0; dx < 4 && ok; dx += 1) ok = solid(x + dx, y + dy, z);
            if (!ok) continue;
            // Every row reachable from the side: open ground along the west or east edge of the rectangle.
            let rows = 0;
            for (let dy = 0; dy < 3; dy += 1) if (standable(x - 1, y + dy, z) || standable(x + 4, y + dy, z)) rows += 1;
            let cols = 0;
            for (let dx = 0; dx < 4; dx += 1) if (standable(x + dx, y - 1, z) || standable(x + dx, y + 3, z)) cols += 1;
            if (rows < 3 && cols < 4) continue;
            const d = Math.abs(x - dwarf.x) + Math.abs(y - dwarf.y) + 4 * Math.abs(z - dwarf.z);
            if (d < bestD) {
              bestD = d;
              best = { x, y, z, w: 4, h: 3 };
            }
          }
        }
      }
      return best;
    },
    { FLOOR: TILE_FLOOR, WALL: TILE_WALL, BOULDER: TILE_BOULDER },
  );
}

async function ui(page: Page): Promise<{ camX: number; camY: number; z: number }> {
  return page.evaluate(() => {
    const u = (window as unknown as { __deepholm: FullHook }).__deepholm.readers.ui;
    return { camX: u.camX, camY: u.camY, z: u.z };
  });
}

test('designate-by-drag', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await generateWorld(page, 'e2e-1');
  await moveCursorTo(page, await hilliestRegion(page));
  await expect.poll(() => textOf(page)).toContain('Wealth');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');

  const face = await findFace(page);
  expect(face).not.toBeNull();
  const rect = face as { x: number; y: number; z: number; w: number; h: number };

  // Bring the face into view: z with `<`/`>`, the camera with the arrows (Shift: ten).
  for (let guard = 0; guard < 80; guard += 1) {
    const u = await ui(page);
    if (u.z === rect.z) break;
    await page.keyboard.press(u.z > rect.z ? '<' : '>');
  }
  const cols = 80 - 36;
  const rows = 50 - 5;
  for (let guard = 0; guard < 200; guard += 1) {
    const u = await ui(page);
    const col = rect.x - u.camX;
    const row = rect.y - u.camY;
    if (col >= 2 && col + rect.w < cols - 2 && row >= 2 && row + rect.h < rows - 2) break;
    const dx = col < 2 ? -1 : col + rect.w >= cols - 2 ? 1 : 0;
    const dy = row < 2 ? -1 : row + rect.h >= rows - 2 ? 1 : 0;
    if (dx !== 0) await page.keyboard.press(dx < 0 ? 'ArrowLeft' : 'ArrowRight');
    if (dy !== 0) await page.keyboard.press(dy < 0 ? 'ArrowUp' : 'ArrowDown');
    const after = await ui(page);
    if (after.camX === u.camX && after.camY === u.camY) break;
  }

  // Press d: the designate panel, with the dig tool chosen (U-03, D-241: `d` again would close it).
  await page.keyboard.press('d');
  await expect.poll(() => textOf(page)).toContain('Dig · priority 5');

  // Drag the rectangle with the real mouse.
  const u = await ui(page);
  const canvas = page.locator('canvas#screen');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no canvas box');
  const at = async (x: number, y: number): Promise<{ x: number; y: number }> =>
    page.evaluate(([c, r]) => (window as unknown as { __deepholm: FullHook }).__deepholm.cellCenter(c as number, r as number), [x - u.camX, y - u.camY]);
  const a = await at(rect.x, rect.y);
  const b = await at(rect.x + rect.w - 1, rect.y + rect.h - 1);
  await page.mouse.move(box.x + a.x, box.y + a.y);
  await page.mouse.down();
  await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 4 });
  await expect.poll(() => textOf(page)).toContain('Dig 4x3 (12 tiles), priority 5');
  await page.mouse.up();

  // 4×: Space starts at 1×, `+` twice steps to 4×.
  const start = await page.evaluate(() => (window as unknown as { __deepholm: FullHook }).__deepholm.readers.calendar.tick);
  await page.keyboard.press('Space');
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __deepholm: FullHook }).__deepholm.readers.calendar.tick), {
      timeout: 180_000,
      intervals: [1000],
    })
    .toBeGreaterThanOrEqual(start + 3000);

  const floors = await page.evaluate((r) => {
    const map = (window as unknown as { __deepholm: FullHook }).__deepholm.readers.map;
    let n = 0;
    for (let dy = 0; dy < r.h; dy += 1) for (let dx = 0; dx < r.w; dx += 1) if (map.kindAt(map.index(r.x + dx, r.y + dy, r.z)) === 2) n += 1;
    return n;
  }, rect);
  expect(floors).toBeGreaterThanOrEqual(10);

  const path = await page.evaluate(() => (window as unknown as { __deepholm: FullHook }).__deepholm.screenshotName('designate-by-drag'));
  await page.screenshot({ path });
  expect(errors).toEqual([]);
});
