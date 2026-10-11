/** U-07 M7/M9/§4.4: configure stockpiles and room ownership through the real keyboard and mouse. */
import { test, expect } from '@playwright/test';
import { screenOf, textOf, clickText, clickTile, type Hook } from './helpers';

interface ZoneHook extends Hook {
  step(n: number): void;
  dwarves(): { id: number }[];
  host: { world: {
    applyCommand(cmd: Record<string, unknown>): { ok: boolean; reason?: string };
    scheduler: { byId(id: string): unknown };
  } };
  readers: {
    ui: { camX: number; camY: number; z: number; panel: string | null };
    calendar: { tick: number };
    map: { index(x: number, y: number, z: number): number };
    buildings: {
      ghost(type: string, origin: number, orientation: number): { reason: string | null };
      zoneAt(tile: number): number;
      roomDiagnostics(id: number): { openBorder: number[]; missing: string[] };
      ownerOf(id: number): number;
    };
    items: { stockpile(id: number): { containersWanted: { barrel: number; bag: number; bin: number }; priority: number; filter: { categories: string[]; minQuality: number; maxQuality: number; materialClasses: string[] | 'any' } } };
  };
}

test('U-07 M7/M9 stockpile editor and room panel', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?start=flat-test&embark=default');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await page.locator('canvas#screen').click();
  await page.keyboard.press('Escape');
  const site = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: ZoneHook }).__deepholm;
    const { map, ui, buildings } = h.readers;
    let patch: [number, number] | null = null;
    for (let y = ui.camY + 4; y < ui.camY + 25 && patch === null; y += 1) for (let x = ui.camX + 4; x < ui.camX + 25 && patch === null; x += 1) {
      let ok = true;
      for (let dx = 0; dx < 12 && ok; dx += 1) ok = buildings.ghost('lever', map.index(x + dx, y, ui.z), 0).reason === null;
      if (ok) patch = [x, y];
    }
    if (patch === null) throw new Error('no zone sites');
    const [x, y] = patch;
    const apply = (cmd: Record<string, unknown>): void => {
      const result = h.host.world.applyCommand(cmd);
      if (!result.ok) throw new Error(`${cmd['type']}: ${result.reason}`);
    };
    for (const [type, dx] of [['stockpile', 0], ['bedroom', 5], ['bedroom', 10]] as const) {
      apply({ type: 'CreateZone', zoneType: type, tiles: [map.index(x + dx, y, ui.z), map.index(x + dx + 1, y, ui.z)] });
    }
    apply({ type: 'PlaceBuilding', buildingType: 'bed', origin: map.index(x + 5, y, ui.z), orientation: 0, materialChoice: 0 });
    const system = h.host.world.scheduler.byId('14') as { lastPlacedBuilding: number; completeNow(id: number, material: number, linked: number): void };
    system.completeNow(system.lastPlacedBuilding, 1, 0);
    h.step(1);
    const pile = buildings.zoneAt(map.index(x, y, ui.z));
    return { x, y, pile, priority: h.readers.items.stockpile(pile).priority, room: buildings.zoneAt(map.index(x + 5, y, ui.z)), missing: buildings.zoneAt(map.index(x + 10, y, ui.z)), dwarf: h.dwarves()[0]!.id, tick: h.readers.calendar.tick };
  });
  await page.keyboard.press('z');
  await clickTile(page, site.x, site.y);
  await expect.poll(() => textOf(page)).toContain('[S-p] Preset');
  await page.keyboard.press('Shift+P');
  await page.keyboard.press('w');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('Preset [Wood');
  await page.keyboard.press('g');
  await page.keyboard.press('Space');
  await page.keyboard.press('q');
  for (let n = 0; n < 6; n += 1) {
    await page.keyboard.press(n === 5 ? 'ArrowLeft' : 'ArrowRight');
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('v');
  await page.keyboard.press('Space');
  await clickText(page, 'Metal');
  await page.keyboard.press('Escape');
  const settings = await page.evaluate((id) => (window as unknown as { __deepholm: ZoneHook }).__deepholm.readers.items.stockpile(id), site.pile);
  expect(settings.containersWanted).toEqual({ barrel: 1, bag: 1, bin: 1 });
  expect(settings.priority).toBe(site.priority + 1);
  expect(settings.filter.categories).toEqual(['food', 'wood']);
  expect(settings.filter.minQuality).toBe(1);
  expect(settings.filter.maxQuality).toBe(4);
  expect(settings.filter.materialClasses).toEqual(['metal']);

  await clickTile(page, site.x + 6, site.y);
  const open = await page.evaluate((id) => (window as unknown as { __deepholm: ZoneHook }).__deepholm.readers.buildings.roomDiagnostics(id).openBorder.length, site.room);
  await expect.poll(() => textOf(page)).toContain(`Not enclosed: ${open} open border`);
  await page.keyboard.press('Shift+O');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await page.evaluate((id) => (window as unknown as { __deepholm: ZoneHook }).__deepholm.readers.buildings.ownerOf(id), site.room)).toBe(site.dwarf);
  await clickText(page, '[S-o] owner');
  await clickText(page, 'Nobody');
  expect(await page.evaluate((id) => (window as unknown as { __deepholm: ZoneHook }).__deepholm.readers.buildings.ownerOf(id), site.room)).toBe(0);
  await clickTile(page, site.x + 10, site.y);
  await expect.poll(() => textOf(page)).toContain('Needs a bed');
  await page.keyboard.press('Shift+O');
  await expect.poll(() => textOf(page)).toContain('needs a built bed before');
  expect(await page.evaluate(() => (window as unknown as { __deepholm: ZoneHook }).__deepholm.readers.calendar.tick)).toBe(site.tick);
  const path = await page.evaluate(() => (window as unknown as { __deepholm: ZoneHook }).__deepholm.screenshotName('zones-editor'));
  await page.screenshot({ path });
  expect(errors).toEqual([]);
});
