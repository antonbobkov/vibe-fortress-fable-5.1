/**
 * Shared steps of the M1 e2e tests: they drive the real keyboard and read state only through
 * `window.__deepholm` (`testing-strategy.md` § E2E harness).
 */

import { expect, type Page } from '@playwright/test';

export interface Hook {
  screen(): string;
  text(): string[];
  cells(): { cols: number; rows: number; glyph: number[]; fg: number[]; bg: number[] };
  cellCenter(col: number, row: number): { x: number; y: number };
  screenshotName(name: string): string;
}

export async function screenOf(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __deepholm: Hook }).__deepholm.screen());
}

export async function textOf(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __deepholm: Hook }).__deepholm.text().join('\n'));
}

/** Main menu → New world → the seed typed into the field → Generate → the world map. */
export async function generateWorld(page: Page, seed: string): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('main_menu');
  await page.locator('canvas#screen').click();
  await page.keyboard.press('n');
  await expect.poll(() => screenOf(page)).toBe('world_gen');
  for (let k = 0; k < 40; k += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type(seed);
  await page.keyboard.press('Enter');
  await page.keyboard.press('g');
  await expect.poll(() => textOf(page), { timeout: 30_000 }).toContain('Stage: names');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('world_map');
}

/** Walk the world-map cursor until the region panel shows a region that can be embarked on. */
export async function findEmbarkableRegion(page: Page): Promise<void> {
  if ((await textOf(page)).includes('Wealth')) return;
  for (let step = 0; step < 32; step += 1) {
    await page.keyboard.press('ArrowRight');
    if ((await textOf(page)).includes('Wealth')) return;
    await page.keyboard.press('ArrowDown');
    if ((await textOf(page)).includes('Wealth')) return;
  }
}

interface WorldHook {
  readers: { world: { size(): number; regions(): readonly { id: number; biome: string; elevation: number }[] } | null };
}

/** The embarkable region with the largest elevation step to a neighbour. */
export async function hilliestRegion(page: Page): Promise<number> {
  return page.evaluate(() => {
    const hook = (window as unknown as { __deepholm: WorldHook }).__deepholm;
    const world = hook.readers.world;
    if (world === null) throw new Error('no world');
    const size = world.size();
    const regions = world.regions();
    let best = -1;
    let bestDiff = -1;
    for (const r of regions) {
      if (r.biome === 'ocean' || r.biome === 'glacier') continue;
      const x = r.id % size;
      const y = Math.floor(r.id / size);
      if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) continue;
      let diff = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const n = regions[(y + dy) * size + x + dx];
          if (n !== undefined && n.biome !== 'ocean') diff = Math.max(diff, Math.abs(n.elevation - r.elevation));
        }
      }
      if (diff > bestDiff) {
        bestDiff = diff;
        best = r.id;
      }
    }
    return best;
  });
}

/** Move the world-map cursor (which starts at the map centre) onto a region. */
export async function moveCursorTo(page: Page, regionId: number): Promise<void> {
  const size = await page.evaluate(() => (window as unknown as { __deepholm: WorldHook }).__deepholm.readers.world?.size() ?? 0);
  const start = Math.floor(size / 2);
  const walk = async (delta: number, plus: string, minus: string): Promise<void> => {
    const keyName = delta > 0 ? plus : minus;
    let left = Math.abs(delta);
    while (left >= 8) {
      await page.keyboard.press(`Shift+${keyName}`);
      left -= 8;
    }
    for (; left > 0; left -= 1) await page.keyboard.press(keyName);
  };
  await walk((regionId % size) - start, 'ArrowRight', 'ArrowLeft');
  await walk(Math.floor(regionId / size) - start, 'ArrowDown', 'ArrowUp');
}

interface HookWithUi extends Hook {
  readers: {
    ui: { camX: number; camY: number; z: number; panel: string | null };
    [key: string]: unknown;
  };
}

/** The camera and z position of the fortress view. */
export async function ui(page: Page): Promise<{ camX: number; camY: number; z: number }> {
  return page.evaluate(() => {
    const u = (window as unknown as { __deepholm: HookWithUi }).__deepholm.readers.ui;
    return { camX: u.camX, camY: u.camY, z: u.z };
  });
}

/** The map cell of a tile on the current view, as canvas pixels. */
export async function tilePixel(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const u = await ui(page);
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas box');
  const c = await page.evaluate(
    ([cx, cy]) => (window as unknown as { __deepholm: Hook }).__deepholm.cellCenter(cx as number, cy as number),
    [x - u.camX, y - u.camY],
  );
  return { x: box.x + c.x, y: box.y + c.y };
}

/** Click the map cell of a tile on the current view. */
export async function clickTile(page: Page, x: number, y: number): Promise<void> {
  const pt = await tilePixel(page, x, y);
  await page.mouse.click(pt.x, pt.y);
}

/** Drag between two map cells on the current view. */
export async function dragTiles(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 4,
): Promise<void> {
  const a = await tilePixel(page, from.x, from.y);
  const b = await tilePixel(page, to.x, to.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
  await page.mouse.up();
}

/** The canvas pixel of a text row containing needle in the text reader, with horizontal character offset. */
export async function textCell(page: Page, needle: string, offset = 0): Promise<{ x: number; y: number }> {
  const cell = await page.evaluate((n) => {
    const rows = (window as unknown as { __deepholm: Hook }).__deepholm.text();
    const row = rows.findIndex((line) => line.includes(n));
    return { col: row < 0 ? -1 : rows[row]!.indexOf(n), row };
  }, needle);
  expect(cell.row).toBeGreaterThanOrEqual(0);
  const b = await page.locator('canvas#screen').boundingBox();
  if (b === null) throw new Error('no canvas');
  const p = await page.evaluate(
    ([col, row]) => (window as unknown as { __deepholm: Hook }).__deepholm.cellCenter(col as number, row as number),
    [cell.col + offset, cell.row],
  );
  return { x: b.x + p.x, y: b.y + p.y };
}

/** Click on text matching needle in the text reader. */
export async function clickText(page: Page, needle: string, offset = 1): Promise<void> {
  const cell = await page.evaluate((n) => {
    const rows = (window as unknown as { __deepholm: Hook }).__deepholm.text();
    const row = rows.findIndex((r) => r.includes(n));
    if (row < 0) throw new Error(`no ${n}`);
    return { col: rows[row]!.indexOf(n), row };
  }, needle);
  const b = await page.locator('canvas#screen').boundingBox();
  if (b === null) throw new Error('no canvas');
  const p = await page.evaluate(
    ([col, row]) => (window as unknown as { __deepholm: Hook }).__deepholm.cellCenter(col as number, row as number),
    [cell.col + offset, cell.row],
  );
  await page.mouse.click(b.x + p.x, b.y + p.y);
}

