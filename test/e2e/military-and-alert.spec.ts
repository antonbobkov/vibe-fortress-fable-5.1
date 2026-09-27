/** T-M6-16: real keyboard and map click military controls, with a hearth retreat fixture. */
import { expect, test } from '@playwright/test';
import { findEmbarkableRegion, generateWorld, screenOf, textOf, type Hook } from './helpers';

interface MilitaryHook extends Hook {
  readers: { ui: { camX: number; camY: number; z: number; panel: string | null }; map: { w: number; h: number; index(x: number, y: number, z: number): number }; buildings: { mechanismState(id: number): string }; of<T>(id: string): T };
  host: { world: { applyCommand(cmd: Record<string, unknown>): { ok: boolean; reason?: string }; scheduler: { byId(id: string): { lastPlacedBuilding: number; completeNow(id: number, material: number, linked: number): void } }; services: { terrain: { setKind(i: number, kind: number, material: number): void; setFlag(i: number, flag: number, on: boolean): void }; movement: { teleport(id: number, tile: number): boolean } }; entities: { get(id: number, component: number): { behavior?: string; targetTile?: number } | undefined } }; headless: { registry: { table(name: string): { index(id: string): number } } } };
  dwarves(): { id: number; x: number; y: number; z: number }[];
  step(n: number): void;
}

test('military-and-alert', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await generateWorld(page, 'm6-military-e2e');
  await findEmbarkableRegion(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await page.locator('canvas#screen').click();

  const fixture = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: MilitaryHook }).__deepholm;
    const z = h.readers.ui.z;
    const map = h.readers.map;
    const world = h.host.world;
    const granite = h.host.headless.registry.table('materials').index('granite');
    for (let y = 37; y < 48; y += 1) for (let x = 37; x <= 43; x += 1) world.services.terrain.setKind(map.index(x, y, z), 2, granite);
    for (let x = 0; x < map.w; x += 1) if (x !== 40) world.services.terrain.setKind(map.index(x, 40, z), 1, granite);
    for (let y = 41; y < 48; y += 1) for (let x = 37; x <= 43; x += 1) world.services.terrain.setFlag(map.index(x, y, z), 4, false);
    const build = (type: string, x: number, y: number, material: string): number => {
      const result = world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin: map.index(x, y, z), orientation: 0, materialChoice: material });
      if (!result.ok) throw new Error(`${type}: ${result.reason}`);
      const system = world.scheduler.byId('14');
      const id = system.lastPlacedBuilding;
      system.completeNow(id, h.host.headless.registry.table('materials').index(material), 0);
      return id;
    };
    const door = build('door', 40, 40, 'oak');
    const mode = world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' });
    if (!mode.ok) throw new Error(`door mode: ${mode.reason}`);
    build('hearth', 40, 44, 'granite');
    const civilian = h.dwarves()[1];
    if (!civilian || !world.services.movement.teleport(civilian.id, map.index(40, 39, z))) throw new Error('civilian setup failed');
    return { door, civilian: civilian.id, z };
  });

  await page.keyboard.press('m');
  await expect.poll(() => textOf(page)).toContain('Military');
  await page.keyboard.press('+');
  await page.evaluate(() => (window as unknown as { __deepholm: MilitaryHook }).__deepholm.step(1));
  const squadId = await page.evaluate(() => {
    const squads = (window as unknown as { __deepholm: MilitaryHook }).__deepholm.readers.of<{ squads(): { id: number }[] }>('16').squads();
    return squads[0]?.id ?? 0;
  });
  expect(squadId).toBeGreaterThan(0);
  await page.keyboard.press('a');
  await page.keyboard.press('Enter');
  await page.evaluate(() => (window as unknown as { __deepholm: MilitaryHook }).__deepholm.step(1));
  expect(await page.evaluate((id) => (window as unknown as { __deepholm: MilitaryHook }).__deepholm.readers.of<{ squad(id: number): { members: number[] } }>('16').squad(id)?.members.length, squadId)).toBe(1);
  await page.keyboard.press('s');
  const clickAt = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: MilitaryHook }).__deepholm;
    return h.cellCenter(12, 10);
  });
  const box = await page.locator('canvas#screen').boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.click(box.x + clickAt.x, box.y + clickAt.y);
  await page.evaluate(() => (window as unknown as { __deepholm: MilitaryHook }).__deepholm.step(1));
  const station = await page.evaluate((id) => (window as unknown as { __deepholm: MilitaryHook }).__deepholm.readers.of<{ squad(id: number): { station: number | null } }>('16').squad(id)?.station, squadId);
  expect(station).not.toBeNull();

  await page.keyboard.press('3');
  await page.evaluate(() => (window as unknown as { __deepholm: MilitaryHook }).__deepholm.step(450));
  const state = await page.evaluate(({ door, civilian }) => ({
    alert: (window as unknown as { __deepholm: MilitaryHook }).__deepholm.readers.of<{ alert(): string }>('16').alert(),
    door: (window as unknown as { __deepholm: MilitaryHook }).__deepholm.readers.buildings.mechanismState(door),
    dwarf: (window as unknown as { __deepholm: MilitaryHook }).__deepholm.dwarves().find((d) => d.id === civilian),
  }), fixture);
  expect(state.alert).toBe('hearth');
  expect(state.door).toBe('locked');
  expect(state.dwarf?.y).toBeGreaterThanOrEqual(41);
  const path = await page.evaluate(() => (window as unknown as { __deepholm: MilitaryHook }).__deepholm.screenshotName('military-and-alert'));
  await page.screenshot({ path });
  expect(errors).toEqual([]);
});
