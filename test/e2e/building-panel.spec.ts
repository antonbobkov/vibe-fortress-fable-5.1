/**
 * E2E `building-panel` (U-05; UI audit M4): with the real mouse and keyboard, a click on a door
 * opens its panel and sets it to lock on alert, and a lever is linked to a drawbridge by picking
 * the bridge on the map.
 *
 * The door, the lever and the bridge are set up finished (a `PlaceBuilding` applied and completed
 * at once, as the scenario tests' `build()` does); everything after that is the player's input.
 */

import { expect, test, type Page } from '@playwright/test';
import { screenOf, textOf, type Hook } from './helpers';

interface BuildingsSystemLike {
  lastPlacedBuilding: number;
  completeNow(id: number, material: number, linked?: number): void;
}

interface U05Hook extends Hook {
  step(n: number): void;
  host: {
    world: {
      applyCommand(command: Record<string, unknown>): { ok: boolean; reason?: string };
      scheduler: { byId(id: string): unknown };
      services: { terrain: { setKind(tile: number, kind: number, material: number): void } };
    };
  };
  readers: {
    ui: { camX: number; camY: number; z: number; panel: string | null };
    map: { w: number; h: number; index(x: number, y: number, z: number): number };
    buildings: {
      get(id: number): { origin: number; state: string; mode: string; linkedIds: number[] } | undefined;
      ghost(type: string, origin: number, orientation: number): { reason: string | null };
    };
    of<T>(id: string): T;
  };
}

interface Site { door: number; lever: number; bridge: number; doorAt: [number, number]; leverAt: [number, number]; bridgeAt: [number, number] }

/** A finished door in a doorway, a lever and a 1×1 drawbridge, in view. */
async function buildSite(page: Page): Promise<Site> {
  return page.evaluate(() => {
    const hook = (window as unknown as { __deepholm: U05Hook }).__deepholm;
    const u = hook.readers.ui;
    const map = hook.readers.map;
    const world = hook.host.world;
    const system = world.scheduler.byId('14') as BuildingsSystemLike;
    const WALL = 1;
    const free = (x: number, y: number): boolean => hook.readers.buildings.ghost('lever', map.index(x, y, u.z), 0).reason === null;
    // A clear 7×3 patch of floor in view.
    let site: [number, number] | null = null;
    for (let y = u.camY + 4; y < u.camY + 30 && site === null; y += 1) {
      for (let x = u.camX + 4; x < u.camX + 30 && site === null; x += 1) {
        let ok = true;
        for (let dy = -1; dy <= 1 && ok; dy += 1) for (let dx = 0; dx < 7 && ok; dx += 1) ok = free(x + dx, y + dy);
        if (ok) site = [x, y];
      }
    }
    if (site === null) throw new Error('no clear floor in view');
    const [x, y] = site;
    const build = (type: string, bx: number, by: number): number => {
      const r = world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin: map.index(bx, by, u.z), orientation: 0, materialChoice: 0 });
      if (!r.ok) throw new Error(`${type}: ${r.reason ?? ''}`);
      const id = system.lastPlacedBuilding;
      system.completeNow(id, 1, 0);
      return id;
    };
    world.services.terrain.setKind(map.index(x, y - 1, u.z), WALL, 1);
    world.services.terrain.setKind(map.index(x, y + 1, u.z), WALL, 1);
    const door = build('door', x, y);
    const lever = build('lever', x + 3, y);
    const bridge = build('drawbridge', x + 6, y);
    hook.step(1);
    return { door, lever, bridge, doorAt: [x, y] as [number, number], leverAt: [x + 3, y] as [number, number], bridgeAt: [x + 6, y] as [number, number] };
  });
}

async function clickTile(page: Page, at: readonly [number, number]): Promise<void> {
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas box');
  const c = await page.evaluate(([tx, ty]) => {
    const hook = (window as unknown as { __deepholm: U05Hook }).__deepholm;
    const u = hook.readers.ui;
    return hook.cellCenter((tx as number) - u.camX, (ty as number) - u.camY);
  }, [at[0], at[1]]);
  await page.mouse.click(box.x + c.x, box.y + c.y);
}

/** Click the screen text `needle` (a panel line). */
async function clickText(page: Page, needle: string): Promise<void> {
  const box = await page.locator('canvas#screen').boundingBox();
  if (box === null) throw new Error('no canvas box');
  const c = await page.evaluate((text) => {
    const hook = (window as unknown as { __deepholm: U05Hook }).__deepholm;
    const rows = hook.text();
    const row = rows.findIndex((line) => line.includes(text));
    if (row < 0) throw new Error(`no "${text}" on screen`);
    return hook.cellCenter((rows[row] as string).indexOf(text) + 1, row);
  }, needle);
  await page.mouse.click(box.x + c.x, box.y + c.y);
}

test('building-panel', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?start=flat-test');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await page.locator('canvas#screen').click();
  await page.keyboard.press('Escape');

  const site = await buildSite(page);

  // A click on the door opens its panel; a click on "Lock on alert" sets the mode.
  await clickTile(page, site.doorAt);
  await expect.poll(() => textOf(page)).toContain('Door #1');
  expect(await textOf(page)).toContain('Lock on alert');
  await clickText(page, 'Lock on alert');
  await expect.poll(() => textOf(page)).toContain('Door #1: Lock on alert.');
  await page.evaluate(() => (window as unknown as { __deepholm: U05Hook }).__deepholm.step(1));
  const mode = await page.evaluate((id) => (window as unknown as { __deepholm: U05Hook }).__deepholm.readers.buildings.get(id)?.mode, site.door);
  expect(mode).toBe('lock_on_alert');

  // The lever: `i`, then the bridge picked on the map.
  await clickTile(page, site.leverAt);
  await expect.poll(() => textOf(page)).toContain('Lever #1');
  await page.keyboard.press('i');
  await expect.poll(() => textOf(page)).toContain('Link Lever #1 to:');
  await clickTile(page, site.bridgeAt);
  await expect.poll(() => textOf(page)).toContain('Drawbridge #1');
  await page.evaluate(() => (window as unknown as { __deepholm: U05Hook }).__deepholm.step(1));
  const linking = await page.evaluate(([lever, bridge]) => {
    const hook = (window as unknown as { __deepholm: U05Hook }).__deepholm;
    const jobs = hook.readers.of<{ list(): { key: string }[] }>('11');
    return jobs.list().some((job) => job.key.startsWith(`link_mechanism:${lever}:${bridge}:`));
  }, [site.lever, site.bridge]);
  expect(linking).toBe(true);
  // The panel is back on the lever, with the link on its way.
  await expect.poll(() => textOf(page)).toContain('Linked to (0)');
  expect(await textOf(page)).toContain('Drawbridge #1:');
  expect(errors).toEqual([]);
});
