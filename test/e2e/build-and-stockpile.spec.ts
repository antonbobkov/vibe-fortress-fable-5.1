/**
 * E2E `build-and-stockpile` (M2) of `archive/build-plan/M2-things.md` T-M2-09: "place a wood stockpile by
 * drag, place a carpenter's workshop ghost (rejected on rock face: reason shown), place a wall from
 * logs, wait, assert `BuildingCompleted`".
 *
 * The world is generated and embarked through the real screens on the hilliest region (so the
 * surface has rock faces); everything is keys and the mouse, and state is read through the hook.
 */

import { test, expect, type Page } from '@playwright/test';
import { generateWorld, hilliestRegion, moveCursorTo, screenOf, textOf, type Hook } from './helpers';

const TILE_FLOOR = 2;
const TILE_WALL = 1;

interface BuildHook extends Hook {
  step(n: number): void;
  readers: {
    ui: { camX: number; camY: number; z: number; panel: string | null };
    calendar: { tick: number };
    map: { w: number; h: number; kindAt(i: number): number; index(x: number, y: number, z: number): number };
    buildings: { wagon(): number; get(id: number): { origin: number; state: string; typeId: string } | undefined; byType(t: string): number[]; zoneAt(i: number): number };
    items: { stockpile(id: number): { filter: { categories: string[] } } | undefined };
    of(id: '03'): { inspect(i: number): { discovered: boolean } };
  };
}

async function ui(page: Page): Promise<{ camX: number; camY: number; z: number }> {
  return page.evaluate(() => {
    const u = (window as unknown as { __deepholm: BuildHook }).__deepholm.readers.ui;
    return { camX: u.camX, camY: u.camY, z: u.z };
  });
}

/** The map cell of a tile on the current view, as canvas pixels. */
async function tilePixel(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const u = await ui(page);
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas box');
  const c = await page.evaluate(([cx, cy]) => (window as unknown as { __deepholm: BuildHook }).__deepholm.cellCenter(cx as number, cy as number), [x - u.camX, y - u.camY]);
  return { x: box.x + c.x, y: box.y + c.y };
}

test('U-02 M1/S2 build-and-stockpile', async ({ page }) => {
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
  const initialTick = await page.evaluate(() => (window as unknown as { __deepholm: BuildHook }).__deepholm.readers.calendar.tick);

  // The view: centred on the wagon at the surface. Pick, in view: a 3×3 patch of free floor for the
  // stockpile, a free floor tile for the wall, and a discovered wall tile of the rock with its
  // whole 3×3 neighbourhood discovered (the carpenter's ghost over it).
  const sites = await page.evaluate(
    ({ FLOOR, WALL }) => {
      const hook = (window as unknown as { __deepholm: BuildHook }).__deepholm;
      const u = hook.readers.ui;
      const map = hook.readers.map;
      const b = hook.readers.buildings;
      const terrain = hook.readers.of('03');
      const wagon = b.get(b.wagon());
      if (wagon === undefined) throw new Error('no wagon');
      const wx = wagon.origin % map.w;
      const wy = Math.floor(wagon.origin / map.w) % map.h;
      const z = u.z;
      const free = (x: number, y: number): boolean =>
        x >= u.camX + 1 && y >= u.camY + 1 && x < u.camX + 40 && y < u.camY + 40 && map.kindAt(map.index(x, y, z)) === FLOOR && b.zoneAt(map.index(x, y, z)) === 0 && !(x >= wx - 1 && x <= wx + 3 && y >= wy - 1 && y <= wy + 3);
      let pile: { x: number; y: number } | null = null;
      let wall: { x: number; y: number } | null = null;
      let rock: { x: number; y: number } | null = null;
      for (let r = 2; r < 30 && (pile === null || wall === null); r += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            const x = wx + 1 + dx;
            const y = wy + 1 + dy;
            if (pile === null) {
              let ok = true;
              for (let a = 0; a < 3 && ok; a += 1) for (let c = 0; c < 3 && ok; c += 1) ok = free(x + c, y + a);
              if (ok) pile = { x, y };
            } else if (wall === null && free(x, y) && (x < pile.x - 1 || x > pile.x + 3 || y < pile.y - 1 || y > pile.y + 3)) {
              wall = { x, y };
            }
          }
        }
      }
      for (let y = u.camY + 2; y < u.camY + 38 && rock === null; y += 1) {
        for (let x = u.camX + 2; x < u.camX + 40 && rock === null; x += 1) {
          if (map.kindAt(map.index(x, y, z)) !== WALL) continue;
          let ok = true;
          for (let a = -1; a <= 1 && ok; a += 1) for (let c = -1; c <= 1 && ok; c += 1) ok = terrain.inspect(map.index(x + c, y + a, z)).discovered;
          if (ok) rock = { x, y };
        }
      }
      return { pile, wall, rock, z };
    },
    { FLOOR: TILE_FLOOR, WALL: TILE_WALL },
  );
  expect(sites.pile).not.toBeNull();
  expect(sites.wall).not.toBeNull();
  expect(sites.rock).not.toBeNull();
  const pile = sites.pile as { x: number; y: number };
  const wallAt = sites.wall as { x: number; y: number };

  // 1. A wood stockpile by drag: z, Shift+s (U-03: `s` opens Stocks), drag 3×3, then the preset row clicked to Wood.
  await page.keyboard.press('z');
  await page.keyboard.press('Shift+S');
  const a = await tilePixel(page, pile.x, pile.y);
  const b = await tilePixel(page, pile.x + 2, pile.y + 2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await expect.poll(() => textOf(page)).toContain('Stockpile 3x3 (9 tiles, 9 qualify)');
  await page.mouse.up();
  // U-02 M1/S2: zone creation is observable before any tick runs.
  const pausedZone = await page.evaluate(([x, y, z]) => {
    const h = (window as unknown as { __deepholm: BuildHook }).__deepholm;
    return { tick: h.readers.calendar.tick, id: h.readers.buildings.zoneAt(h.readers.map.index(x as number, y as number, z as number)) };
  }, [pile.x, pile.y, sites.z]);
  expect(pausedZone.tick).toBe(initialTick);
  expect(pausedZone.id).not.toBe(0);
  await page.evaluate(() => (window as unknown as { __deepholm: BuildHook }).__deepholm.step(1));
  await page.keyboard.press('Escape');
  await page.mouse.click(a.x, a.y);
  await expect.poll(() => textOf(page)).toContain('Selected: Stockpile #1 (9 t)');
  const presetCell = await page.evaluate(() => {
    const hook = (window as unknown as { __deepholm: BuildHook }).__deepholm;
    const rows = hook.text();
    const row = rows.findIndex((r) => r.includes('Preset ['));
    return { row, col: rows[row]?.indexOf('Preset [') ?? -1 };
  });
  expect(presetCell.row).toBeGreaterThan(0);
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas box');
  const presetPx = await page.evaluate(([c, r]) => (window as unknown as { __deepholm: BuildHook }).__deepholm.cellCenter(c as number, r as number), [presetCell.col + 2, presetCell.row]);
  for (const name of ['Food', 'Drink', 'Seeds', 'Stone', 'Ore and bars', 'Wood']) {
    await page.mouse.click(box.x + presetPx.x, box.y + presetPx.y);
    await page.evaluate(() => (window as unknown as { __deepholm: BuildHook }).__deepholm.step(1));
    await expect.poll(() => textOf(page)).toContain(`Preset [${name}`);
  }
  const categories = await page.evaluate(
    ([x, y, z]) => {
      const hook = (window as unknown as { __deepholm: BuildHook }).__deepholm;
      const map = hook.readers.map;
      const id = hook.readers.buildings.zoneAt(map.index(x as number, y as number, z as number));
      return hook.readers.items.stockpile(id)?.filter.categories ?? [];
    },
    [pile.x, pile.y, sites.z],
  );
  expect(categories).toEqual(['wood']);

  // 2. The carpenter's workshop ghost on the rock face: refused, the reason in the status bar.
  await page.keyboard.press('Escape');
  await page.keyboard.press('b');
  await page.keyboard.press('w');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => textOf(page)).toContain("Carpenter's workshop");
  const rock = sites.rock as { x: number; y: number };
  const r = await tilePixel(page, rock.x, rock.y);
  await page.mouse.move(r.x, r.y);
  await expect.poll(() => textOf(page)).toContain("Carpenter's workshop · blocked: needs a floor");
  const p = await tilePixel(page, wallAt.x, wallAt.y);
  await page.mouse.move(p.x, p.y);
  await expect.poll(() => textOf(page)).toContain("Carpenter's workshop · click to place");

  // 3. A wall from logs: constructions, down to Wall, the material cycled to pine logs, a click.
  await page.keyboard.press('Escape');
  // U-03 (D-U2): `c` opens Civilizations; the constructions category is `[S-c]`.
  await page.keyboard.press('Shift+C');
  for (let k = 0; k < 7; k += 1) await page.keyboard.press('ArrowDown');
  await expect.poll(() => textOf(page)).toContain('Wall · click to place');
  for (let k = 0; k < 6; k += 1) {
    if ((await textOf(page)).includes('Material: [x] pine')) break;
    await page.keyboard.press('x');
  }
  await expect.poll(() => textOf(page)).toContain('Material: [x] pine');
  const beforePlacement = await page.evaluate(() => (window as unknown as { __deepholm: BuildHook }).__deepholm.readers.calendar.tick);
  await page.mouse.click(p.x, p.y);
  // U-02 M1/S2: the planned wall appears with no simulation time elapsed.
  const pausedBuilding = await page.evaluate(([x, y, z]) => {
    const h = (window as unknown as { __deepholm: BuildHook }).__deepholm;
    const origin = h.readers.map.index(x as number, y as number, z as number);
    return { tick: h.readers.calendar.tick, state: h.readers.buildings.byType('wall')
      .map((id) => h.readers.buildings.get(id)).find((w) => w?.origin === origin)?.state };
  }, [wallAt.x, wallAt.y, sites.z]);
  expect(pausedBuilding).toEqual({ tick: beforePlacement, state: 'planned' });
  await page.keyboard.press('Escape');

  // Wait at 4× until the wall stands.
  await page.keyboard.press('Space');
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  const built = async (): Promise<boolean> =>
    page.evaluate(
      ([x, y, z, WALL]) => {
        const hook = (window as unknown as { __deepholm: BuildHook }).__deepholm;
        const map = hook.readers.map;
        const walls = hook.readers.buildings.byType('wall').map((id) => hook.readers.buildings.get(id));
        return walls.some((w) => w?.state === 'built') && map.kindAt(map.index(x as number, y as number, z as number)) === WALL;
      },
      [wallAt.x, wallAt.y, sites.z, TILE_WALL],
    );
  await expect.poll(built, { timeout: 180_000, intervals: [1000] }).toBe(true);

  const path = await page.evaluate(() => (window as unknown as { __deepholm: BuildHook }).__deepholm.screenshotName('build-and-stockpile'));
  await page.screenshot({ path });
  expect(errors).toEqual([]);
});
