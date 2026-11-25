/**
 * E2E `embark-site-goods` (T-550): on the world map, an alpine site's region panel says what the
 * site has and what it lacks, after the Wildlife row, the lacks in the alert colour
 * (`02-systems/02-embark-and-loadout.md` § What a site has and lacks;
 * `ui-screens/menus-and-world.md` § World map). The lacks line is the list the merchants charge
 * the scarcity price for.
 */

import { test, expect } from '@playwright/test';
import { generateWorld, moveCursorTo, screenOf, textOf, type Hook } from './helpers';

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

test('embark-site-goods', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await generateWorld(page, 'e2e-alpine');

  // The first alpine region with no river, lake or volcano glass.
  const target = await page.evaluate(() => {
    const world = (window as unknown as { __deepholm: MapHook }).__deepholm.readers.world;
    if (world === null) throw new Error('no world');
    const r = world.regions().find((x) => x.biome === 'alpine' && x.river === null && !x.lake && !x.traits.includes('glasslands'));
    if (r === undefined) throw new Error('no alpine region');
    return r.id;
  });

  await moveCursorTo(page, target);
  await expect.poll(() => textOf(page)).toContain('Alpine');

  // The two rows follow Wildlife; on a short window the panel scrolls to them.
  if (!(await textOf(page)).includes('This site lacks:')) await page.keyboard.press('PageDown');
  const text = await textOf(page);
  expect(text).toContain('This site has: stone, lichen,');
  expect(text).toContain('This site lacks: wood, soil, clay,');
  const rows = text.split('\n');
  const wildlife = rows.findIndex((line) => line.includes('Wildlife'));
  const has = rows.findIndex((line) => line.includes('This site has:'));
  const lacks = rows.findIndex((line) => line.includes('This site lacks:'));
  if (wildlife >= 0) expect(wildlife).toBeLessThan(has);
  expect(has).toBeLessThan(lacks);

  // The lacks line is drawn in the alert colour, the has line in the text colour.
  const colours = await page.evaluate(() => {
    const hook = (window as unknown as { __deepholm: Hook }).__deepholm;
    const cells = hook.cells();
    const lines = hook.text();
    const at = (needle: string): number | undefined => {
      const row = lines.findIndex((line) => line.includes(needle));
      const col = (lines[row] ?? '').indexOf(needle);
      return cells.fg[row * cells.cols + col];
    };
    return { has: at('This site has:'), lacks: at('This site lacks:'), alert: at('No surface soil') };
  });
  expect(colours.lacks).not.toBe(colours.has);
  if (colours.alert !== undefined) expect(colours.lacks).toBe(colours.alert);

  expect(await screenOf(page)).toBe('world_map');
  expect(errors).toEqual([]);
});
