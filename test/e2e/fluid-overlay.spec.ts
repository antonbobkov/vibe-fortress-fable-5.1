/**
 * E2E `fluid-overlay` (M3) of `process/testing-strategy.md` § E2E harness and
 * `M3-water-fire-sky.md` T-M3-08: "press `f`, toggle fluid levels, `cells()` shows digits over the
 * river".
 *
 * The world is generated and embarked through the real screens. A channel of water beside the
 * wagon stands in for the river: 04 is poured through the host (setup only, like `submit`), and
 * everything after that is the real keyboard and the real cell buffer.
 */

import { test, expect, type Page } from '@playwright/test';
import { generateWorld, hilliestRegion, moveCursorTo, screenOf, textOf, type Hook } from './helpers';

interface FluidHook extends Hook {
  host: {
    headless: {
      map: { w: number; h: number; index(x: number, y: number, z: number): number; kindAt(i: number): number };
      world: { scheduler: { byId(id: string): { sim: { pour(i: number, level: number, magma?: boolean, source?: boolean): void } } | undefined } };
    };
  };
  readers: { ui: { camX: number; camY: number; z: number } };
  dwarves(): { id: number; x: number; y: number; z: number }[];
  step(ticks: number): void;
  screenshotName(name: string): string;
}

const TILE_FLOOR = 2;

/** Pour levels 1 … 7 into seven floor tiles in a row beside the first dwarf; returns them. */
async function pourChannel(page: Page): Promise<{ x: number; y: number; z: number }[]> {
  return page.evaluate((FLOOR) => {
    const hook = (window as unknown as { __deepholm: FluidHook }).__deepholm;
    const headless = hook.host.headless;
    const map = headless.map;
    const sim = headless.world.scheduler.byId('04')?.sim;
    if (sim === undefined) throw new Error('no fluids system');
    const dwarf = hook.dwarves()[0];
    if (dwarf === undefined) throw new Error('no dwarf');
    for (let dy = -6; dy <= 6; dy += 1) {
      for (let x0 = Math.max(1, dwarf.x - 8); x0 <= Math.min(map.w - 8, dwarf.x + 8); x0 += 1) {
        const y = dwarf.y + dy;
        if (y < 1 || y >= map.h - 1) continue;
        let ok = true;
        for (let k = 0; k < 7 && ok; k += 1) ok = map.kindAt(map.index(x0 + k, y, dwarf.z)) === FLOOR;
        if (!ok) continue;
        const tiles: { x: number; y: number; z: number }[] = [];
        for (let k = 0; k < 7; k += 1) {
          sim.pour(map.index(x0 + k, y, dwarf.z), k + 1, false, false);
          tiles.push({ x: x0 + k, y, z: dwarf.z });
        }
        return tiles;
      }
    }
    throw new Error('no seven floor tiles in a row beside the dwarf');
  }, TILE_FLOOR);
}

test('fluid-overlay', async ({ page }) => {
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

  const tiles = await pourChannel(page);
  // `Home` centres on the wagon, beside which the channel lies. The game is paused, so the
  // levels stand still while the overlay is switched on.
  await page.keyboard.press('Home');

  const digitsAt = async (): Promise<string> => {
    return page.evaluate((water) => {
      const hook = (window as unknown as { __deepholm: FluidHook }).__deepholm;
      const cells = hook.cells();
      const ui = hook.readers.ui;
      let out = '';
      for (const t of water as { x: number; y: number; z: number }[]) {
        const col = t.x - ui.camX;
        const row = t.y - ui.camY;
        if (col < 0 || row < 0 || col >= cells.cols || row >= cells.rows) return 'offscreen';
        out += String.fromCharCode(cells.glyph[row * cells.cols + col] ?? 0);
      }
      return out;
    }, tiles);
  };

  // Before the overlay the channel shows the water glyphs, not digits.
  expect(await digitsAt()).not.toBe('1234567');

  // `f` opens the overlays panel; the fluid levels row is the fourth; `Enter` toggles it.
  await page.keyboard.press('f');
  await expect.poll(() => textOf(page)).toContain('fluid levels');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('[■] fluid levels');

  await expect.poll(digitsAt).toBe('1234567');

  const name = await page.evaluate(() => (window as unknown as { __deepholm: FluidHook }).__deepholm.screenshotName('fluid-overlay'));
  await page.locator('canvas#screen').screenshot({ path: name });
  expect(errors).toEqual([]);
});
