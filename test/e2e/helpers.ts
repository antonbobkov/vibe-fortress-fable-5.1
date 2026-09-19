/**
 * Shared steps of the M1 e2e tests: they drive the real keyboard and read state only through
 * `window.__deepholm` (`01-testing-strategy.md` § E2E harness).
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

