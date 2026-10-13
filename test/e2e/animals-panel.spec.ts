/**
 * E2E `animals-panel` (T-155): open the animals panel, mark and unmark a tame animal
 * for slaughter, assign to a pasture, set a breeding cap, toggle a huntable species on the wild tab;
 * assert through the animals and foraging readers.
 */

import { test, expect } from '@playwright/test';
import { screenOf, textOf, type Hook } from './helpers';

interface AnimalsHook extends Hook {
  readers: {
    ui: { panel: string | null };
    map: { w: number; h: number; index(x: number, y: number, z: number): number };
    of<T>(id: string): T;
  };
  host: {
    world: {
      applyCommand(cmd: Record<string, unknown>): { ok: boolean; reason?: string };
      services: {
        spawn: {
          creature(species: number, at: number, faction: string): number;
        };
      };
      entities: {
        componentTypes(): readonly { id: number; name: string }[];
        get<T>(id: number, type: { id: number; name: string }): T | undefined;
        add<T>(id: number, type: { id: number; name: string }, value: T): void;
      };
    };
    headless: {
      registry: {
        table(name: string): { index(id: string): number };
      };
    };
  };
}

interface AnimalsReader {
  tameList(): number[];
  wildList(): number[];
  pastureOf(id: number): number;
  breedingCap(species: number | string): number;
}

interface ForagingReader {
  isHuntable(species: string | number): boolean;
}

test('animals-panel', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/?start=flat-test&embark=default');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('fortress');

  // Setup state through hook: a pasture zone, a tame cow (grazer), and a wild deer.
  const { pastureId, wildSpecies, cowId, cowSpecies } = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: AnimalsHook }).__deepholm;
    const map = h.readers.map;

    // Create a pasture zone on the flat-test surface (z = 32).
    const tiles = [map.index(40, 40, 32), map.index(41, 40, 32)];
    const result = h.host.world.applyCommand({
      type: 'CreateZone',
      zoneType: 'pasture',
      tiles,
    });
    if (!result.ok) throw new Error(`CreateZone failed: ${result.reason}`);

    const buildingsReader = h.readers.of<{ zonesOfType(type: string): number[] }>('14');
    const pasture = buildingsReader.zonesOfType('pasture')[0];
    if (pasture === undefined) throw new Error('No pasture zone found after creation');

    // Spawn a tame cow (grazer) on the surface for pasture assignment.
    const cow = h.host.headless.registry.table('creatures').index('cow');
    const cId = h.host.world.services.spawn.creature(cow, map.index(40, 40, 32), 'fortress');
    const tameType = h.host.world.entities.componentTypes().find((t) => t.name === 'Tame')!;
    h.host.world.entities.add(cId, tameType, {
      pastureId: 0,
      condition: 100,
      trained: 'none',
      assignedTo: 0,
      pregnantUntil: 0,
      lastProductTick: {},
      juvenileUntil: 0,
      slaughter: false,
      petOf: 0,
      noBreed: false,
    });

    // Spawn a wild deer on the map.
    const deer = h.host.headless.registry.table('creatures').index('deer');
    h.host.world.services.spawn.creature(deer, map.index(35, 35, 32), 'wild');

    return {
      pastureId: pasture,
      wildSpecies: deer,
      cowId: cId,
      cowSpecies: cow,
    };
  });

  expect(cowId).toBeGreaterThan(0);

  // Close any panel opened by init click.
  const panel = async () =>
    page.evaluate(() => (window as unknown as { __deepholm: AnimalsHook }).__deepholm.readers.ui.panel);
  if ((await panel()) !== null) {
    await page.keyboard.press('Escape');
    await expect.poll(panel).toBeNull();
  }

  // Open the Animals panel with 'n'.
  await page.keyboard.press('n');
  await expect.poll(panel).toBe('animals');
  expect(await textOf(page)).toContain('[1] Tame');

  // Move selection down to the cow in the tame list.
  const cowIndex = await page.evaluate((id) => {
    const h = (window as unknown as { __deepholm: AnimalsHook }).__deepholm;
    return h.readers.of<AnimalsReader>('08').tameList().indexOf(id);
  }, cowId);
  for (let i = 0; i < cowIndex; i += 1) {
    await page.keyboard.press('ArrowDown');
  }

  const getCowSlaughter = async (): Promise<boolean> =>
    page.evaluate((id) => {
      const h = (window as unknown as { __deepholm: AnimalsHook }).__deepholm;
      const tameType = h.host.world.entities.componentTypes().find((t) => t.name === 'Tame')!;
      return h.host.world.entities.get<{ slaughter: boolean }>(id, tameType)?.slaughter ?? false;
    }, cowId);

  // 1. Mark for slaughter (Shift+S). Confirmation dialog is opened.
  await page.keyboard.press('Shift+S');
  await expect.poll(() => screenOf(page)).toBe('confirm');
  expect(await textOf(page)).toContain('Slaughter');

  // Confirm slaughter with 'y'.
  await page.keyboard.press('y');
  await expect.poll(() => screenOf(page)).toBe('fortress');
  expect(await getCowSlaughter()).toBe(true);

  // 2. Unmark for slaughter (Shift+S). Takes off mark without confirmation.
  await page.keyboard.press('Shift+S');
  await expect.poll(getCowSlaughter).toBe(false);

  // 3. Assign to pasture (Shift+P).
  const getAnimalPasture = async (): Promise<number> =>
    page.evaluate((id) => {
      const h = (window as unknown as { __deepholm: AnimalsHook }).__deepholm;
      return h.readers.of<AnimalsReader>('08').pastureOf(id);
    }, cowId);

  expect(await getAnimalPasture()).toBe(0);
  await page.keyboard.press('Shift+P');
  await expect.poll(getAnimalPasture).toBe(pastureId);

  // 4. Set breeding cap (Shift+C).
  const getBreedingCap = async (): Promise<number> =>
    page.evaluate((sp) => {
      const h = (window as unknown as { __deepholm: AnimalsHook }).__deepholm;
      return h.readers.of<AnimalsReader>('08').breedingCap(sp);
    }, cowSpecies);

  const initialCap = await getBreedingCap();
  // T-249: cap is an editor; opening it leaves the setting unchanged.
  await page.keyboard.press('Shift+C');
  expect(await getBreedingCap()).toBe(initialCap);
  await expect.poll(() => textOf(page)).toContain('[Enter] Set');
  await page.keyboard.press('=');
  expect(await getBreedingCap()).toBe(initialCap);
  await page.keyboard.press('Enter');
  await expect.poll(getBreedingCap).toBe(Math.min(initialCap + 1, 100));

  // 5. Toggle huntable on wild tab.
  // Switch to tab 2 (Wild).
  await page.keyboard.press('2');
  await expect.poll(() => textOf(page)).toContain('[h] hunt toggle');

  const getIsHuntable = async (): Promise<boolean> =>
    page.evaluate((sp) => {
      const h = (window as unknown as { __deepholm: AnimalsHook }).__deepholm;
      return h.readers.of<ForagingReader>('09').isHuntable(sp);
    }, wildSpecies);

  const initialHunt = await getIsHuntable();
  await page.keyboard.press('h');
  await expect.poll(getIsHuntable).toBe(!initialHunt);

  // Screenshot.
  const path = await page.evaluate(
    () => (window as unknown as { __deepholm: AnimalsHook }).__deepholm.screenshotName('animals-panel'),
  );
  await page.screenshot({ path });

  // Close panel with Escape.
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  expect(errors).toEqual([]);
});
