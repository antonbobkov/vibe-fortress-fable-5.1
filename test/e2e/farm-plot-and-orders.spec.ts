/** T-M4-17: a cave farm and a still's maintain order through the browser UI. */
import { expect, test, type Page } from '@playwright/test';
import { generateWorld, moveCursorTo, screenOf, textOf, type Hook } from './helpers';

interface FarmHook extends Hook {
  step(n: number): void;
  dwarves(): { id: number; x: number; y: number; z: number }[];
  readers: {
    ui: { camX: number; camY: number; z: number };
    calendar: { tick: number };
    map: { w: number; h: number; d: number; kindAt(i: number): number; index(x: number, y: number, z: number): number };
    of(id: string): unknown;
  };
  host: {
    world: {
      onEvents(fn: (events: readonly { type: string }[]) => void): void;
      applyCommand(cmd: Record<string, unknown>): { ok: boolean; reason?: string };
      scheduler: { byId(id: string): { lastPlacedBuilding: number; completeNow(id: number, material: number, linked: number): void } };
      services: { terrain: { setKind(i: number, kind: number, material: number): void; setFlag(i: number, flag: number, on: boolean): void } };
    };
    headless: { registry: { table(name: string): { index(id: string): number } } };
  };
}

interface Point { x: number; y: number; z: number }
const PLOT_W = 8;
const PLOT_H = 5;

async function warmHillyRegion(page: Page): Promise<number> {
  return page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FarmHook & { readers: FarmHook['readers'] & { world: { size(): number; regions(): { id: number; biome: string; elevation: number }[] } } } }).__deepholm;
    const world = h.readers.world;
    const size = world.size();
    const regions = world.regions();
    let best = -1;
    let bestDiff = -1;
    for (const r of regions) {
      if (r.biome !== 'savanna' && r.biome !== 'tropical_forest') continue;
      const x = r.id % size; const y = Math.floor(r.id / size);
      if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) continue;
      let diff = 0;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const n = regions[(y + dy) * size + x + dx];
        if (n !== undefined && n.biome !== 'ocean') diff = Math.max(diff, Math.abs(n.elevation - r.elevation));
      }
      if (diff > bestDiff) { best = r.id; bestDiff = diff; }
    }
    return best;
  });
}

async function face(page: Page): Promise<Point | null> {
  return page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FarmHook }).__deepholm;
    const m = h.readers.map;
    const d = h.dwarves()[0];
    if (d === undefined) return null;
    const path = h.readers.of('pathing') as { labelOf(i: number, cls: string): number };
    const materials = h.readers.of('05') as { temperatureAt(i: number): number };
    const home = path.labelOf(m.index(d.x, d.y, d.z), 'walker');
    let best: Point | null = null;
    let distance = Infinity;
    for (let z = Math.max(0, d.z - 10); z <= d.z; z += 1) {
      for (let y = 12; y < m.h - 14; y += 1) for (let x = 20; x < m.w - 12; x += 1) {
        if (x < 6 || z + 1 >= m.d || materials.temperatureAt(m.index(x - 4, y, z)) < 7) continue;
        let roof = true;
        for (let dy = 0; dy < 5 && roof; dy += 1) for (let dx = -4; dx < 4 && roof; dx += 1) {
          if (m.kindAt(m.index(x + dx, y + dy, z + 1)) === 0) roof = false;
        }
        if (!roof) continue;
        let solid = true;
        for (let dy = 0; dy < 3 && solid; dy += 1) for (let dx = 0; dx < 4 && solid; dx += 1) {
          const k = m.kindAt(m.index(x + dx, y + dy, z));
          if (k !== 1 && k !== 11) solid = false;
        }
        if (!solid) continue;
        let edge = 0;
        for (let dy = 0; dy < 3; dy += 1) for (const xx of [x - 1, x + 4]) {
          const i = m.index(xx, y + dy, z);
          if (m.kindAt(i) === 2 && path.labelOf(i, 'walker') === home) edge += 1;
        }
        if (edge < 3) continue;
        const dist = Math.abs(x - d.x) + Math.abs(y - d.y) + 4 * Math.abs(z - d.z);
        if (dist < distance) { distance = dist; best = { x, y, z }; }
      }
    }
    return best;
  });
}

async function view(page: Page): Promise<{ camX: number; camY: number; z: number }> {
  return page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.readers.ui);
}
async function pixel(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const u = await view(page);
  const b = await page.locator('canvas#screen').boundingBox();
  if (b === null) throw new Error('no canvas');
  const p = await page.evaluate(([col, row]) => (window as unknown as { __deepholm: FarmHook }).__deepholm.cellCenter(col as number, row as number), [x - u.camX, y - u.camY]);
  return { x: b.x + p.x, y: b.y + p.y };
}
async function textCell(page: Page, needle: string, offset = 0): Promise<{ x: number; y: number }> {
  const cell = await page.evaluate((n) => {
    const rows = (window as unknown as { __deepholm: FarmHook }).__deepholm.text();
    const row = rows.findIndex((line) => line.includes(n));
    return { col: row < 0 ? -1 : rows[row]!.indexOf(n), row };
  }, needle);
  expect(cell.row).toBeGreaterThanOrEqual(0);
  const b = await page.locator('canvas#screen').boundingBox();
  if (b === null) throw new Error('no canvas');
  const p = await page.evaluate(([col, row]) => (window as unknown as { __deepholm: FarmHook }).__deepholm.cellCenter(col as number, row as number), [cell.col + offset, cell.row]);
  return { x: b.x + p.x, y: b.y + p.y };
}

test('farm-plot-and-orders', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await generateWorld(page, 'e2e-1');
  await moveCursorTo(page, await warmHillyRegion(page));
  await expect.poll(() => textOf(page)).toContain('Wealth');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await page.keyboard.press('Enter');
  await page.keyboard.press('2');
  const seeds = await textCell(page, 'Seeds');
  await page.mouse.click(seeds.x, seeds.y);
  const dimcapSeeds = await textCell(page, '10 dimcap seeds');
  await page.mouse.click(dimcapSeeds.x, dimcapSeeds.y);
  await page.keyboard.press('='); await page.keyboard.press('=');
  await expect.poll(() => textOf(page)).toMatch(/10 dimcap seeds[^\n]*\[-\]\s+4 \[\+\]/);
  const barleySeeds = await textCell(page, '10 barley seeds');
  await page.mouse.click(barleySeeds.x, barleySeeds.y);
  await page.keyboard.press('-');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FarmHook & { cropHarvested?: boolean } }).__deepholm;
    h.cropHarvested = false;
    h.host.world.onEvents((events) => {
      if (events.some((event) => event.type === 'CropHarvested')) h.cropHarvested = true;
    });
  });

  const at = await face(page);
  expect(at).not.toBeNull();
  const f = { ...(at as Point), x: (at as Point).x - 4 };
  // Generated rock faces can be stone. For this e2e setup, make the wall tiles a soil seam;
  // the UI still designates, digs, validates the resulting plot and grows the actual crops.
  await page.evaluate((r) => {
    const h = (window as unknown as { __deepholm: FarmHook }).__deepholm;
    const loam = h.host.headless.registry.table('materials').index('loam');
    for (let dy = 0; dy < 5; dy += 1) for (let dx = 0; dx < 8; dx += 1) {
      const i = h.readers.map.index(r.x + dx, r.y + dy, r.z);
      h.host.world.services.terrain.setKind(i, 1, loam);
      h.host.world.services.terrain.setFlag(i, 1 << 9, false);
      h.host.world.services.terrain.setFlag(i, 1 << 10, false);
    }
  }, f);
  for (let i = 0; i < 80 && (await view(page)).z !== f.z; i += 1) await page.keyboard.press((await view(page)).z > f.z ? '<' : '>');
  await page.keyboard.press('d'); await page.keyboard.press('d');
  // The designation sidebar narrows the map. Pan again with its actual viewport active.
  const viewport = await page.evaluate(() => { const h = (window as unknown as { __deepholm: FarmHook }).__deepholm; const c = h.cells(); return { cols: c.cols - 36, rows: c.rows - 5 }; });
  for (let i = 0; i < 200; i += 1) {
    const u = await view(page);
    const c = f.x - u.camX; const r = f.y - u.camY;
    if (c >= 2 && c + PLOT_W < viewport.cols - 2 && r >= 2 && r + PLOT_H < viewport.rows - 2) break;
    if (c < 2 || c + PLOT_W >= viewport.cols - 2) await page.keyboard.press(c < 2 ? 'ArrowLeft' : 'ArrowRight');
    if (r < 2 || r + PLOT_H >= viewport.rows - 2) await page.keyboard.press(r < 2 ? 'ArrowUp' : 'ArrowDown');
  }
  const a = await pixel(page, f.x, f.y);
  const b = await pixel(page, f.x + PLOT_W - 1, f.y + PLOT_H - 1);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
  await page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.step(1));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  // The headless hook advances the same simulation ticks as the 4× frame loop while keeping the browser test bounded.
  await page.keyboard.press('Space'); await page.keyboard.press('+'); await page.keyboard.press('+');
  // The first exposed four tiles can be farmed while the remaining rock is dug.
  // Waiting for the entire 8x5 room first leaves the fortress without a drink supply.
  let farmStrip = 0;
  while (farmStrip < 4) {
    farmStrip = await page.evaluate((r) => {
      const h = (window as unknown as { __deepholm: FarmHook }).__deepholm;
      h.step(250);
      let n = 0;
      for (let dx = 5; dx < 8; dx += 1) if (h.readers.map.kindAt(h.readers.map.index(r.x + dx, r.y, r.z)) === 2) n += 1;
      if (h.readers.map.kindAt(h.readers.map.index(r.x + 7, r.y + 1, r.z)) === 2) n += 1;
      return n;
    }, f);
    const tick = await page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.readers.calendar.tick);
    expect(tick).toBeLessThan(60_000);
  }
  await page.keyboard.press('Space');
  await page.keyboard.press('z'); await page.keyboard.press('f');
  const za = await pixel(page, f.x + PLOT_W - 3, f.y);
  const zb = await pixel(page, f.x + PLOT_W - 1, f.y);
  await page.mouse.move(za.x, za.y); await page.mouse.down(); await page.mouse.move(zb.x, zb.y, { steps: 4 }); await page.mouse.up();
  await page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.step(1));
  await page.keyboard.press('Escape');
  const selected = await pixel(page, f.x + PLOT_W - 3, f.y);
  await page.mouse.click(selected.x, selected.y);
  await expect.poll(() => textOf(page)).toContain('Selected: Farm plot');
  for (const season of ['Spring', 'Summer', 'Autumn', 'Winter']) {
    const row = await textCell(page, season, 9);
    await page.mouse.click(row.x, row.y);
    const dimcap = await textCell(page, 'dimcap');
    await page.mouse.click(dimcap.x, dimcap.y);
  }
  await page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.step(1));
  // The fourth early floor is diagonal to the first strip, so it needs its own plot.
  await page.keyboard.press('Escape');
  await page.keyboard.press('z'); await page.keyboard.press('f');
  const fourth = await pixel(page, f.x + PLOT_W - 1, f.y + 1);
  await page.mouse.move(fourth.x, fourth.y); await page.mouse.down(); await page.mouse.up();
  await page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.step(1));
  await page.keyboard.press('Escape');
  await page.mouse.click(fourth.x, fourth.y);
  await expect.poll(() => textOf(page)).toContain('Selected: Farm plot');
  for (const season of ['Spring', 'Summer', 'Autumn', 'Winter']) {
    const row = await textCell(page, season, 9);
    await page.mouse.click(row.x, row.y);
    const dimcap = await textCell(page, 'dimcap');
    await page.mouse.click(dimcap.x, dimcap.y);
  }
  await page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.step(1));

  // A completed still is setup; the UI under test creates and edits the live order.
  const still = await page.evaluate((farm) => {
    const h = (window as unknown as { __deepholm: FarmHook }).__deepholm;
    const m = h.readers.map;
    const b = h.readers.of('14') as { ghost(type: string, origin: number, orientation: number): { reason: string | null } };
    for (let radius = 2; radius < 24; radius += 1) for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
      const x = farm.x + dx; const y = farm.y + dy;
      if (x < 2 || y < 2 || x + 3 >= m.w || y + 3 >= m.h) continue;
      if (x <= farm.x + 8 && x + 3 >= farm.x && y <= farm.y + 5 && y + 3 >= farm.y) continue;
      const origin = m.index(x, y, farm.z);
      if (b.ghost('still', origin, 0).reason !== null) continue;
      const result = h.host.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'still', origin, orientation: 0, materialChoice: 0 });
      if (!result.ok) continue;
      const buildings = h.host.world.scheduler.byId('14');
      buildings.completeNow(buildings.lastPlacedBuilding, h.host.headless.registry.table('materials').index('pine'), 0);
      h.step(1);
      return buildings.lastPlacedBuilding;
    }
    return 0;
  }, f);
  expect(still).toBeGreaterThan(0);
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FarmHook }).__deepholm;
    const dwarves = h.dwarves();
    if (dwarves.length < 4) throw new Error('too few dwarves to staff the farm and still');
    const commands = [
      ...dwarves.slice(1).map(({ id }) => ({ type: 'SetLabor', dwarfId: id, labor: 'brewing', on: true })),
      ...dwarves.slice(1, 3).map(({ id }) => ({ type: 'SetLabor', dwarfId: id, labor: 'farming', on: true })),
      { type: 'SetLaborPriority', labor: 'brewing', priority: 1 },
    ];
    for (const cmd of commands) {
      const result = h.host.world.applyCommand(cmd);
      if (!result.ok) throw new Error(`${cmd.type}: ${result.reason}`);
    }
  }, still);
  await page.keyboard.press('Escape');
  await page.keyboard.press('o');
  await page.keyboard.press('+');
  await expect.poll(() => textOf(page)).toContain('New global order');
  const recipe = await textCell(page, 'Brew drink');
  await page.mouse.click(recipe.x, recipe.y);
  await page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.step(1));
  await page.keyboard.press('m');
  await page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.step(1));
  await expect.poll(() => textOf(page)).toContain('keep');
  await page.keyboard.press('f');
  await expect.poll(() => textOf(page)).toContain('Material filter');
  const dimcap = await textCell(page, 'dimcap');
  await page.mouse.click(dimcap.x, dimcap.y);
  await page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.step(1));
  await expect.poll(() => textOf(page)).toContain('Material: dimcap');

  // The default maintain threshold is 20. Poll the harvest, drink stock and completed excavation.
  await page.keyboard.press('Space');
  let result = { drinks: 0, cropHarvested: false, floors: 0, tick: 0 };
  while (result.drinks < 20 || !result.cropHarvested || result.floors < PLOT_W * PLOT_H) {
    result = await page.evaluate((r) => {
      const h = (window as unknown as { __deepholm: FarmHook & { cropHarvested: boolean } }).__deepholm;
      h.step(250);
      const items = h.readers.of('13') as { count(type: string): number };
      let floors = 0;
      for (let dy = 0; dy < 5; dy += 1) for (let dx = 0; dx < 8; dx += 1) {
        if (h.readers.map.kindAt(h.readers.map.index(r.x + dx, r.y + dy, r.z)) === 2) floors += 1;
      }
      return { drinks: items.count('drink'), cropHarvested: h.cropHarvested, floors, tick: h.readers.calendar.tick };
    }, f);
    expect(result.tick).toBeLessThan(100_000);
  }
  expect(result.drinks).toBeGreaterThanOrEqual(20);
  expect(result.cropHarvested).toBe(true);
  expect(result.floors).toBe(PLOT_W * PLOT_H);
  // A mason and raw stone are setup; create its block order through the global Orders panel.
  const mason = await page.evaluate((farm) => {
    const h = (window as unknown as { __deepholm: FarmHook }).__deepholm;
    const m = h.readers.map;
    const b = h.readers.of('14') as { ghost(type: string, origin: number, orientation: number): { reason: string | null } };
    for (let radius = 2; radius < 24; radius += 1) for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
      const x = farm.x + dx; const y = farm.y + dy;
      if (x < 2 || y < 2 || x + 3 >= m.w || y + 3 >= m.h) continue;
      if (x <= farm.x + 8 && x + 3 >= farm.x && y <= farm.y + 5 && y + 3 >= farm.y) continue;
      if (b.ghost('mason', m.index(x, y, farm.z), 0).reason !== null) continue;
      const origin = m.index(x, y, farm.z);
      const placed = h.host.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'mason', origin, orientation: 0, materialChoice: 0 });
      if (!placed.ok) continue;
      const buildings = h.host.world.scheduler.byId('14');
      buildings.completeNow(buildings.lastPlacedBuilding, h.host.headless.registry.table('materials').index('granite'), 0);
      const itemSystem = h.host.world.scheduler.byId('13') as unknown as { core: { create(type: number, material: number, at: number, count: number): number } };
      itemSystem.core.create(h.host.headless.registry.table('items').index('raw_stone'), h.host.headless.registry.table('materials').index('granite'), origin, 4);
      h.step(1);
      return buildings.lastPlacedBuilding;
    }
    return 0;
  }, f);
  expect(mason).toBeGreaterThan(0);
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FarmHook }).__deepholm;
    for (const { id } of h.dwarves().slice(1)) {
      const result = h.host.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: 'masonry', on: true });
      if (!result.ok) throw new Error(`masonry: ${result.reason}`);
    }
  });
  await page.keyboard.press('+');
  await expect.poll(() => textOf(page)).toContain('New global order');
  for (let i = 0; i < 200 && !(await textOf(page)).includes('Blocks (mason)'); i += 1) await page.keyboard.press('ArrowDown');
  const blocks = await textCell(page, 'Blocks (mason)');
  await page.mouse.click(blocks.x, blocks.y);
  await page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.step(1));
  await expect.poll(() => textOf(page)).toContain('Global Blocks');
  let blockCount = 0;
  for (let i = 0; i < 60 && blockCount === 0; i += 1) {
    blockCount = await page.evaluate(() => {
      const h = (window as unknown as { __deepholm: FarmHook }).__deepholm;
      h.step(500);
      return (h.readers.of('13') as { count(type: string): number }).count('stone_block');
    });
  }
  expect(blockCount).toBeGreaterThan(0);

  const path = await page.evaluate(() => (window as unknown as { __deepholm: FarmHook }).__deepholm.screenshotName('farm-plot-and-orders'));
  await page.screenshot({ path });
  expect(errors).toEqual([]);
});
