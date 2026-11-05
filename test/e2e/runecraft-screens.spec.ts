/**
 * T-477: the runecraft screens (`25-runecraft.md` § Player-facing behavior), through the real
 * keyboard and mouse: the sanctum panel in the zones panel, a staff's look line, the squad's
 * draught checklist, and a warded creature's glyph on its dimmed `ward_cyan` ground.
 */
import { expect, test, type Page } from '@playwright/test';
import { clickTile, screenOf, textOf, type Hook } from './helpers';

interface ComponentType { id: number; name: string }

interface RuneHook extends Hook {
  step(n: number): void;
  dwarves(): { id: number; x: number; y: number; z: number }[];
  host: {
    world: {
      applyCommand(cmd: Record<string, unknown>): { ok: boolean; reason?: string };
      scheduler: { byId(id: string): { lastPlacedBuilding: number; completeNow(id: number, material: number, linked: number): void } };
      services: {
        spawn: { item(type: number, material: number, at: number, count: number, quality: number): number };
        movement: { teleport(id: number, tile: number): boolean };
      };
      entities: {
        componentTypes(): readonly ComponentType[];
        get<T>(id: number, type: ComponentType): T | undefined;
        add<T>(id: number, type: ComponentType, value: T): void;
      };
    };
    headless: { registry: { table(name: string): { index(id: string): number } } };
  };
  readers: {
    ui: { camX: number; camY: number; z: number; panel: string | null };
    calendar: { tick: number };
    map: { index(x: number, y: number, z: number): number };
    buildings: { ghost(type: string, origin: number, orientation: number): { reason: string | null }; zoneAt(tile: number): number };
    of<T>(id: string): T;
  };
}

/** Escape until no panel is open, one key at a time: one Escape too many opens the game menu. */
async function closePanel(page: Page): Promise<void> {
  const panel = (): Promise<string | null> => page.evaluate(() => (window as unknown as { __deepholm: RuneHook }).__deepholm.readers.ui.panel);
  for (let k = 0; k < 4 && (await panel()) !== null; k += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  expect(await panel()).toBeNull();
  expect(await screenOf(page)).toBe('fortress');
}

/** `ward_cyan` (`glyphs-and-colors.md` § Palette), as the cell buffer holds a colour. */
const WARD_CYAN = 0x1a4448;

test('T-477 runecraft screens', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?start=flat-test&embark=default');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await page.locator('canvas#screen').click();
  await page.keyboard.press('Escape');

  // A 3 × 3 sanctum around a built rune circle, glowcap in stock, a staff of embers on the ground
  // and one dwarf as the apprentice; a second dwarf stands two tiles east of the staff.
  const site = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: RuneHook }).__deepholm;
    const { map, ui, buildings } = h.readers;
    const world = h.host.world;
    const reg = h.host.headless.registry;
    let patch: [number, number] | null = null;
    for (let y = ui.camY + 5; y < ui.camY + 22 && patch === null; y += 1) for (let x = ui.camX + 5; x < ui.camX + 22 && patch === null; x += 1) {
      let ok = true;
      for (let dy = 0; dy < 3 && ok; dy += 1) for (let dx = 0; dx < 8 && ok; dx += 1) {
        const t = map.index(x + dx, y + dy, ui.z);
        ok = buildings.ghost('lever', t, 0).reason === null && buildings.zoneAt(t) === 0;
      }
      if (ok) patch = [x, y];
    }
    if (patch === null) throw new Error('no sanctum site');
    const [x, y] = patch;
    const apply = (cmd: Record<string, unknown>): void => {
      const r = world.applyCommand(cmd);
      if (!r.ok) throw new Error(`${String(cmd['type'])}: ${r.reason}`);
    };
    const tiles: number[] = [];
    for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) tiles.push(map.index(x + dx, y + dy, ui.z));
    apply({ type: 'CreateZone', zoneType: 'sanctum', tiles });
    apply({ type: 'PlaceBuilding', buildingType: 'rune_circle', origin: map.index(x + 1, y + 1, ui.z), orientation: 0, materialChoice: 'granite' });
    const system = world.scheduler.byId('14');
    system.completeNow(system.lastPlacedBuilding, reg.table('materials').index('granite'), 0);
    world.services.spawn.item(reg.table('items').index('glowcap'), reg.table('materials').index('glowcap'), map.index(x + 4, y, ui.z), 4, 1);
    const staffTile = map.index(x + 5, y + 1, ui.z);
    const staff = world.services.spawn.item(reg.table('items').index('staff'), reg.table('materials').index('iron'), staffTile, 1, 1);
    const Item = world.entities.componentTypes().find((t) => t.name === 'Item')!;
    world.entities.add(staff, Item, { ...world.entities.get<Record<string, unknown>>(staff, Item)!, stone: reg.table('materials').index('garnet') });
    const [apprentice, warded] = h.dwarves();
    if (apprentice === undefined || warded === undefined) throw new Error('two dwarves wanted');
    apply({ type: 'SetSanctumApprentices', zoneId: buildings.zoneAt(tiles[0]!), dwarfIds: [apprentice.id] });
    h.step(1);
    return { x, y, z: ui.z, apprentice: apprentice.id, warded: warded.id };
  });

  // The sanctum panel: the zones panel, a click on the sanctum.
  await page.keyboard.press('z');
  await clickTile(page, site.x, site.y);
  // The apprentice's first session has already counted one glowcap off the stock.
  await expect.poll(() => textOf(page)).toMatch(/Glowcap in stock: [34]/);
  let text = await textOf(page);
  expect(text).toContain('Sanctum #');
  expect(text).toContain('Mishaps, new apprentice:');
  expect(text).toMatch(/Runecraft \d+, run/);
  await closePanel(page);

  // The staff's look line: a click on its tile.
  await clickTile(page, site.x + 5, site.y + 1);
  await expect.poll(() => textOf(page)).toContain('Here:');
  await expect.poll(() => textOf(page)).toContain('iron staff of embers');
  text = await textOf(page);
  // The line wraps under the item in the panel's width, and is read to its end.
  expect(text).toMatch(/Emberbolt: \d+ ember, range\s/);
  expect(text).toContain('12. Needs a runecaster.');
  await closePanel(page);

  // The squad's draughts: a squad, a member, the checklist, and the first draught added with Enter.
  await page.keyboard.press('m');
  await expect.poll(() => textOf(page)).toContain('Military');
  await page.keyboard.press('+');
  await page.evaluate(() => (window as unknown as { __deepholm: RuneHook }).__deepholm.step(1));
  await page.keyboard.press('Shift+A');
  await page.keyboard.press('Enter');
  await page.evaluate(() => (window as unknown as { __deepholm: RuneHook }).__deepholm.step(1));
  await expect.poll(() => textOf(page)).toContain('[S-d] draughts: none');
  await page.keyboard.press('Shift+D');
  // Every draught a soldier drinks, and under the list the selected one's trigger in words.
  await expect.poll(() => textOf(page)).toContain('draught of stoutness');
  expect(await textOf(page)).toContain('Drunk when hit while below');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => textOf(page)).toContain('Drunk when a raid or an ambush');
  await page.keyboard.press('Enter');
  await page.evaluate(() => (window as unknown as { __deepholm: RuneHook }).__deepholm.step(1));
  const draughts = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: RuneHook }).__deepholm;
    const squads = h.readers.of<{ squads(): { id: number; equipment: { draughts?: string[] } }[] }>('16').squads();
    return squads[0]?.equipment.draughts ?? [];
  });
  expect(draughts).toEqual(['stout_draught']);
  // Enter closes the checklist; the squad's line names the draught, wrapped in the panel's width.
  await expect.poll(() => textOf(page)).toContain('[S-d] draughts:');
  const squadLines = (await textOf(page)).split('\n');
  const at = squadLines.findIndex((l) => l.includes('[S-d] draughts:'));
  expect(`${squadLines[at] ?? ''} ${squadLines[at + 1] ?? ''}`).toMatch(/draughts: draught of\W+(\S*\W+)*stoutness/);
  await closePanel(page);

  // A warded creature's glyph: its cell's ground turns `ward_cyan` while the ward lasts.
  const cell = async (): Promise<number> => page.evaluate((id) => {
    const h = (window as unknown as { __deepholm: RuneHook }).__deepholm;
    const d = h.dwarves().find((v) => v.id === id)!;
    const c = h.cells();
    return c.bg[(d.y - h.readers.ui.camY) * c.cols + (d.x - h.readers.ui.camX)] ?? -1;
  }, site.warded);
  await page.evaluate(({ id, x, y, z }) => {
    const h = (window as unknown as { __deepholm: RuneHook }).__deepholm;
    h.host.world.services.movement.teleport(id, h.readers.map.index(x + 7, y + 2, z));
    h.step(1);
  }, { id: site.warded, x: site.x, y: site.y, z: site.z });
  await expect.poll(cell).not.toBe(-1);
  expect(await cell()).not.toBe(WARD_CYAN);
  await page.evaluate((id) => {
    const h = (window as unknown as { __deepholm: RuneHook }).__deepholm;
    const Spellbound = h.host.world.entities.componentTypes().find((t) => t.name === 'Spellbound')!;
    h.host.world.entities.add(id, Spellbound, { effects: [{ kind: 'ward', value: 7, until: h.readers.calendar.tick + 2000, sourceId: id }] });
    h.step(1);
  }, site.warded);
  await expect.poll(cell).toBe(WARD_CYAN);

  const path = await page.evaluate(() => (window as unknown as { __deepholm: RuneHook }).__deepholm.screenshotName('runecraft-screens'));
  await page.screenshot({ path });
  expect(errors).toEqual([]);
});
