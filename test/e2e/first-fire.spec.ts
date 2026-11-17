/**
 * E2E `first-fire` (T-559): the first fire set on purpose asks first. With the real keyboard and
 * mouse, the designate panel's `[S-b] Set a fire` tool and a drag over a strip of grass open the
 * confirmation `c_first_ignite` (24 § Confirmations, default No): No drops the designation, Yes
 * sends `ConfirmIgnite` and then the designation, and a later fire needs no confirmation.
 *
 * The grass is laid through the hook (the flat-test surface has none); everything after that is the
 * player's input.
 */

import { expect, test, type Page } from '@playwright/test';
import { dragTiles, screenOf, textOf, type Hook } from './helpers';

const GRASS = 1 << 6;
const IGNITE = 14;

interface FireHook extends Hook {
  host: { world: { services: { terrain: { setFlag(i: number, flag: number, value: boolean): void } } } };
  readers: {
    ui: { camX: number; camY: number; z: number };
    map: { index(x: number, y: number, z: number): number; designationAt(i: number): number };
    fortress: { state: { igniteConfirmed?: boolean } };
  };
}

/** Two strips of two grass tiles in view, one row apart. */
async function layGrass(page: Page): Promise<{ first: [number, number]; second: [number, number] }> {
  return page.evaluate((grass) => {
    const hook = (window as unknown as { __deepholm: FireHook }).__deepholm;
    const u = hook.readers.ui;
    const map = hook.readers.map;
    const x = u.camX + 12;
    const y = u.camY + 12;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 3], [1, 3]] as const) hook.host.world.services.terrain.setFlag(map.index(x + dx, y + dy, u.z), grass, true);
    return { first: [x, y] as [number, number], second: [x, y + 3] as [number, number] };
  }, GRASS);
}

async function designations(page: Page, at: readonly [number, number]): Promise<number[]> {
  return page.evaluate(([x, y]) => {
    const hook = (window as unknown as { __deepholm: FireHook }).__deepholm;
    const map = hook.readers.map;
    const z = hook.readers.ui.z;
    return [map.designationAt(map.index(x as number, y as number, z)), map.designationAt(map.index((x as number) + 1, y as number, z))];
  }, [at[0], at[1]]);
}

async function confirmed(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { __deepholm: FireHook }).__deepholm.readers.fortress.state.igniteConfirmed === true);
}

test('first-fire', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?start=flat-test');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await page.locator('canvas#screen').click();
  await page.keyboard.press('Escape');
  const grass = await layGrass(page);

  // `d` opens Designate; `Shift+B` chooses Set a fire.
  await page.keyboard.press('d');
  await expect.poll(() => textOf(page)).toContain('Set a fire');
  await page.keyboard.press('Shift+B');
  await expect.poll(() => textOf(page)).toContain('Set a fire · priority');

  // The first fire asks; No drops it.
  await dragTiles(page, { x: grass.first[0], y: grass.first[1] }, { x: grass.first[0] + 1, y: grass.first[1] });
  await expect.poll(() => textOf(page)).toContain('Set a fire on purpose?');
  await page.keyboard.press('n');
  await expect.poll(() => textOf(page)).not.toContain('Set a fire on purpose?');
  expect(await designations(page, grass.first)).toEqual([0, 0]);
  expect(await confirmed(page)).toBe(false);

  // Asked again, Yes: the fortress confirms and the strip is designated.
  await dragTiles(page, { x: grass.first[0], y: grass.first[1] }, { x: grass.first[0] + 1, y: grass.first[1] });
  await expect.poll(() => textOf(page)).toContain('Set a fire on purpose?');
  await page.keyboard.press('y');
  await expect.poll(() => designations(page, grass.first)).toEqual([IGNITE, IGNITE]);
  expect(await confirmed(page)).toBe(true);

  // A later fire needs no confirmation.
  await dragTiles(page, { x: grass.second[0], y: grass.second[1] }, { x: grass.second[0] + 1, y: grass.second[1] });
  await expect.poll(() => designations(page, grass.second)).toEqual([IGNITE, IGNITE]);
  expect(await textOf(page)).not.toContain('Set a fire on purpose?');
  expect(errors).toEqual([]);
});
