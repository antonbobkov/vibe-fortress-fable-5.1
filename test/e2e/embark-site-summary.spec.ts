/**
 * E2E `embark-site-summary` (T-440): on the world map, an alpine site of bare rock says what it
 * lacks before the player embarks: no surface soil, no trees, no surface water, each in the alert
 * colour with its workaround, above the site summary (`ui-screens/menus-and-world.md` § World
 * map). The screenshot is `reports/screenshots/embark-alpine-site.png`.
 */

import { test, expect } from '@playwright/test';
import { generateWorld, screenOf, textOf, type Hook } from './helpers';

interface RegionLike {
  id: number;
  biome: string;
  river: unknown;
  lake: boolean;
  traits: readonly string[];
}

interface MapHook extends Hook {
  readers: { world: { size(): number; regions(): readonly RegionLike[] } | null };
}

test('embark-site-summary', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await generateWorld(page, 'e2e-alpine');

  // The first alpine region with no river, lake or volcano glass: bare rock, nothing to drink.
  const target = await page.evaluate(() => {
    const world = (window as unknown as { __deepholm: MapHook }).__deepholm.readers.world;
    if (world === null) throw new Error('no world');
    const size = world.size();
    const r = world.regions().find((x) => x.biome === 'alpine' && x.river === null && !x.lake && !x.traits.includes('glasslands'));
    if (r === undefined) throw new Error('no alpine region');
    return { x: r.id % size, y: Math.floor(r.id / size), mid: Math.floor(size / 2) };
  });

  // The cursor starts at the centre; walk it there, eight at a time with Shift.
  const walk = async (delta: number, plus: string, minus: string): Promise<void> => {
    const key = delta > 0 ? plus : minus;
    let left = Math.abs(delta);
    while (left >= 8) {
      await page.keyboard.press(`Shift+${key}`);
      left -= 8;
    }
    for (; left > 0; left -= 1) await page.keyboard.press(key);
  };
  await walk(target.x - target.mid, 'ArrowRight', 'ArrowLeft');
  await walk(target.y - target.mid, 'ArrowDown', 'ArrowUp');

  await expect.poll(() => textOf(page)).toContain('Alpine');
  const text = await textOf(page);
  expect(text).toContain('No surface soil: no farms or grass');
  expect(text).toContain('No trees: wood only from the');
  expect(text).toContain('No water on the surface: drink');
  expect(text).toContain('Soil     none: bare rock');
  expect(text).toContain('Trees    none');
  expect(text).toContain('Water    none on the surface');
  expect(text).toContain('[Enter] Embark here');

  // The warnings are drawn in the alert colour.
  const alerted = await page.evaluate(() => {
    const hook = (window as unknown as { __deepholm: Hook }).__deepholm;
    const cells = hook.cells();
    const rows = hook.text();
    const row = rows.findIndex((line) => line.includes('No surface soil'));
    const col = (rows[row] ?? '').indexOf('No surface soil');
    const plain = rows.findIndex((line) => line.includes('Soil     none'));
    const plainCol = (rows[plain] ?? '').indexOf('Soil     none');
    return { alert: cells.fg[row * cells.cols + col], text: cells.fg[plain * cells.cols + plainCol] };
  });
  expect(alerted.alert).not.toBe(alerted.text);

  const path = await page.evaluate(() => (window as unknown as { __deepholm: Hook }).__deepholm.screenshotName('embark-alpine-site'));
  expect(path).toBe('reports/screenshots/embark-alpine-site.png');
  await page.screenshot({ path });

  expect(await screenOf(page)).toBe('world_map');
  expect(errors).toEqual([]);
});
