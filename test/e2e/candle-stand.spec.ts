/**
 * E2E `candle-stand` (T-563): a candle stand built and fed with candles lights its 3×3. With the real
 * mouse and keyboard, a click on the stand opens its panel, which shows its candles and the burning
 * one's days, and the overlays panel's `light` row tints the lit tiles.
 *
 * The stand is set up finished and its candles put in it (as the haulers would), through the hook;
 * everything after that is the player's input.
 */

import { expect, test, type Page } from '@playwright/test';
import { screenOf, textOf, type Hook } from './helpers';

interface ComponentType { id: number; name: string }

interface CandleHook extends Hook {
  step(n: number): void;
  host: {
    world: {
      applyCommand(command: Record<string, unknown>): { ok: boolean; reason?: string };
      scheduler: { byId(id: string): unknown };
      registry: { table(name: string): { index(id: string): number } };
      services: {
        spawn: { item(type: number, material: number, at: number, count: number): number };
        items: { install(id: number): void } | null;
      };
      entities: {
        componentTypes(): readonly ComponentType[];
        get<T>(id: number, type: ComponentType): T | undefined;
        add<T>(id: number, type: ComponentType, value: T): void;
      };
    };
  };
  readers: {
    ui: { camX: number; camY: number; z: number };
    map: { index(x: number, y: number, z: number): number };
    buildings: { ghost(type: string, origin: number, orientation: number): { reason: string | null } };
    of<T>(id: string): T;
  };
}

interface StandReader {
  standCandles(id: number): { candles: number; burning: string; daysLeft: number } | undefined;
  comfortLightAt(i: number): boolean;
}

/** A finished candle stand on clear floor in view, holding five tallow candles. */
async function buildStand(page: Page): Promise<{ id: number; at: [number, number] }> {
  return page.evaluate(() => {
    const hook = (window as unknown as { __deepholm: CandleHook }).__deepholm;
    const u = hook.readers.ui;
    const map = hook.readers.map;
    const world = hook.host.world;
    const free = (x: number, y: number): boolean => hook.readers.buildings.ghost('candle_stand', map.index(x, y, u.z), 0).reason === null;
    let site: [number, number] | null = null;
    for (let y = u.camY + 6; y < u.camY + 30 && site === null; y += 1) {
      for (let x = u.camX + 6; x < u.camX + 30 && site === null; x += 1) {
        let ok = true;
        for (let dy = -2; dy <= 2 && ok; dy += 1) for (let dx = -2; dx <= 2 && ok; dx += 1) ok = free(x + dx, y + dy);
        if (ok) site = [x, y];
      }
    }
    if (site === null) throw new Error('no clear floor in view');
    const [x, y] = site;
    const at = map.index(x, y, u.z);
    const r = world.applyCommand({ type: 'PlaceBuilding', buildingType: 'candle_stand', origin: at, orientation: 0, materialChoice: 'granite' });
    if (!r.ok) throw new Error(`candle_stand: ${r.reason ?? ''}`);
    const system = world.scheduler.byId('14') as { lastPlacedBuilding: number; completeNow(id: number, material: number, linked?: number): void };
    const id = system.lastPlacedBuilding;
    system.completeNow(id, world.registry.table('materials').index('granite'), 0);
    const candle = world.services.spawn.item(world.registry.table('items').index('candle'), world.registry.table('materials').index('tallow'), at, 5);
    world.services.items?.install(candle);
    const building = world.entities.componentTypes().find((t) => t.name === 'Building');
    if (building === undefined) throw new Error('no Building component');
    world.entities.add(id, building, { ...(world.entities.get<Record<string, unknown>>(id, building) ?? {}), held: [candle] });
    hook.step(1);
    return { id, at: [x, y] as [number, number] };
  });
}

async function clickTile(page: Page, at: readonly [number, number]): Promise<void> {
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas box');
  const c = await page.evaluate(([tx, ty]) => {
    const hook = (window as unknown as { __deepholm: CandleHook }).__deepholm;
    const u = hook.readers.ui;
    return hook.cellCenter((tx as number) - u.camX, (ty as number) - u.camY);
  }, [at[0], at[1]]);
  await page.mouse.click(box.x + c.x, box.y + c.y);
}

/** The background colour of the cell that draws a tile. */
async function bgAt(page: Page, at: readonly [number, number]): Promise<number> {
  return page.evaluate(([tx, ty]) => {
    const hook = (window as unknown as { __deepholm: CandleHook }).__deepholm;
    const u = hook.readers.ui;
    const cells = hook.cells();
    return cells.bg[((ty as number) - u.camY) * cells.cols + ((tx as number) - u.camX)] ?? -1;
  }, [at[0], at[1]]);
}

test('candle-stand', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?start=flat-test');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await page.locator('canvas#screen').click();
  await page.keyboard.press('Escape');

  const stand = await buildStand(page);
  const lit = await page.evaluate(([id, x, y]) => {
    const hook = (window as unknown as { __deepholm: CandleHook }).__deepholm;
    const b = hook.readers.of<StandReader>('14');
    const u = hook.readers.ui;
    const map = hook.readers.map;
    return { view: b.standCandles(id as number), near: b.comfortLightAt(map.index((x as number) + 1, (y as number) + 1, u.z)),
      far: b.comfortLightAt(map.index((x as number) + 2, y as number, u.z)) };
  }, [stand.id, stand.at[0], stand.at[1]]);
  expect(lit.view).toEqual({ candles: 5, burning: 'tallow', daysLeft: 7 });
  expect(lit.near).toBe(true);
  expect(lit.far).toBe(false);

  // A click on the stand opens its panel: its candles and the burning one's days.
  await clickTile(page, stand.at);
  await expect.poll(() => textOf(page)).toContain('Candles: 5 of 5');
  expect(await textOf(page)).toContain('Burning: tallow, 7 days left');
  await page.keyboard.press('Escape');

  // `f` opens the overlays panel; the `light` row is the ninth; `Enter` turns it on.
  const beside: [number, number] = [stand.at[0] + 1, stand.at[1]];
  const out: [number, number] = [stand.at[0] + 2, stand.at[1]];
  const before = { beside: await bgAt(page, beside), out: await bgAt(page, out) };
  await page.keyboard.press('f');
  await expect.poll(() => textOf(page)).toContain('light');
  for (let k = 0; k < 8; k += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('[■] light');
  await expect.poll(() => bgAt(page, beside)).not.toBe(before.beside);
  expect(await bgAt(page, out)).toBe(before.out);
  expect(errors).toEqual([]);
});
