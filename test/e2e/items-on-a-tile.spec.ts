/**
 * T-442: dig rock until a stone drops, then look at its tile with the mouse and with the look key:
 * the look panel's Tile tab and the status row's hover summary both name the stone
 * (24 § Inspection).
 */
import { test, expect, type Page } from '@playwright/test';
import { generateWorld, hilliestRegion, moveCursorTo, screenOf, textOf, tilePixel, ui } from './helpers';

const TILE_FLOOR = 2;
const TILE_WALL = 1;

interface StoneHook {
  dwarves(): { x: number; y: number; z: number }[];
  submit(command: unknown): void;
  step(ticks: number): void;
  readers: {
    map: { w: number; h: number; d: number; kindAt(i: number): number; index(x: number, y: number, z: number): number };
    items: { at(i: number): number[]; get(id: number): { type: number } | undefined; def(type: number): { id: string } | undefined };
    of(id: 'pathing'): { labelOf(i: number, cls: string): number };
  };
}

/** Up to 16 wall tiles beside ground the first dwarf can walk to, on its level or near it. */
async function faceTiles(page: Page): Promise<{ x: number; y: number; z: number }[]> {
  return page.evaluate(({ FLOOR, WALL }) => {
    const hook = (window as unknown as { __deepholm: StoneHook }).__deepholm;
    const map = hook.readers.map;
    const dwarf = hook.dwarves()[0];
    if (dwarf === undefined) return [];
    const pathing = hook.readers.of('pathing');
    const home = pathing.labelOf(map.index(dwarf.x, dwarf.y, dwarf.z), 'walker');
    const out: { x: number; y: number; z: number; d: number }[] = [];
    for (let z = Math.max(0, dwarf.z - 4); z <= Math.min(map.d - 1, dwarf.z + 4); z += 1) {
      for (let y = 2; y < map.h - 2; y += 1) {
        for (let x = 2; x < map.w - 2; x += 1) {
          if (map.kindAt(map.index(x, y, z)) !== WALL) continue;
          const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
            const i = map.index(x + (dx as number), y + (dy as number), z);
            return map.kindAt(i) === FLOOR && pathing.labelOf(i, 'walker') === home;
          });
          if (beside) out.push({ x, y, z, d: Math.abs(x - dwarf.x) + Math.abs(y - dwarf.y) + 4 * Math.abs(z - dwarf.z) });
        }
      }
    }
    return out.sort((a, b) => a.d - b.d).slice(0, 16).map(({ x, y, z }) => ({ x, y, z }));
  }, { FLOOR: TILE_FLOOR, WALL: TILE_WALL });
}

/** A dug tile that holds a stone, or null. */
async function stoneTile(page: Page, tiles: readonly { x: number; y: number; z: number }[]): Promise<{ x: number; y: number; z: number } | null> {
  return page.evaluate(({ list, FLOOR }) => {
    const hook = (window as unknown as { __deepholm: StoneHook }).__deepholm;
    const { map, items } = hook.readers;
    return list.find((t) => {
      const i = map.index(t.x, t.y, t.z);
      return map.kindAt(i) === FLOOR && items.at(i).some((id) => items.def(items.get(id)?.type ?? -1)?.id === 'raw_stone');
    }) ?? null;
  }, { list: tiles, FLOOR: TILE_FLOOR });
}

/** Bring a tile into the map view: its level with `<` `>`, the camera with the arrows. */
async function showTile(page: Page, t: { x: number; y: number; z: number }): Promise<void> {
  for (let guard = 0; guard < 80; guard += 1) {
    const u = await ui(page);
    if (u.z === t.z) break;
    await page.keyboard.press(u.z > t.z ? '<' : '>');
  }
  for (let guard = 0; guard < 200; guard += 1) {
    const u = await ui(page);
    const col = t.x - u.camX;
    const row = t.y - u.camY;
    if (col >= 3 && col < 40 && row >= 3 && row < 40) break;
    if (col < 3 || col >= 40) await page.keyboard.press(col < 3 ? 'ArrowLeft' : 'ArrowRight');
    if (row < 3 || row >= 40) await page.keyboard.press(row < 3 ? 'ArrowUp' : 'ArrowDown');
    const after = await ui(page);
    if (after.camX === u.camX && after.camY === u.camY) break;
  }
}

test('T-442 items-on-a-tile: a dug-out stone is seen where it lies', async ({ page }) => {
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

  const tiles = await faceTiles(page);
  expect(tiles.length).toBeGreaterThan(8);
  await page.evaluate((list) => {
    const hook = (window as unknown as { __deepholm: StoneHook }).__deepholm;
    const map = hook.readers.map;
    hook.submit({ type: 'Designate', tiles: list.map((t) => map.index(t.x, t.y, t.z)), kind: 'dig' });
  }, tiles);
  let stone: { x: number; y: number; z: number } | null = null;
  for (let round = 0; round < 12 && stone === null; round += 1) {
    await page.evaluate(() => (window as unknown as { __deepholm: StoneHook }).__deepholm.step(500));
    stone = await stoneTile(page, tiles);
  }
  expect(stone).not.toBeNull();
  const at = stone as { x: number; y: number; z: number };

  // The mouse over the tile: the hover summary names the stone after the floor.
  await showTile(page, at);
  const pt = await tilePixel(page, at.x, at.y);
  await page.mouse.move(pt.x, pt.y);
  await expect.poll(() => textOf(page)).toMatch(/floor · 1 \S+ stone/);

  // The look key looks at the mouse: the Tile tab lists the stone.
  await page.keyboard.press('k');
  await expect.poll(() => textOf(page)).toContain('Here:');
  expect(await textOf(page)).toMatch(/1 \S+ stone · \d+ ☼/);
  await page.keyboard.press('k');

  // A click on the tile opens the same panel on the Tile tab.
  await page.mouse.click(pt.x, pt.y);
  await expect.poll(() => textOf(page)).toContain('Here:');
  expect(await textOf(page)).toMatch(/1 \S+ stone · \d+ ☼/);
  expect(errors).toEqual([]);
});
