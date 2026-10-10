/**
 * E2E `panels-act` (T-155): browser assertions on effects for the panels and screens that are
 * only opened in existing tests.
 * - stocks: forbid an item type, mark one for dumping, mark a metal item for melting;
 * - jobs: cancel a job and change another's priority;
 * - orders: remove and reorder a work order, toggle one standing order;
 * - units: give a title, shift a dwarf's sleep hour;
 * - population: change the cap;
 * - mood, threats, log and look: assert matching reader lines;
 * - overlays: toggle each overlay and assert cell buffer changes;
 * - map: Ctrl+Z undoes designation batch; Delete on selection cancels planned building and removes zone;
 *   rectangle selection forbids items.
 */

import { test, expect } from '@playwright/test';
import { screenOf, textOf, type Hook } from './helpers';

const ItemFlag = {
  Forbidden: 1,
  Dump: 2,
  Melt: 4,
} as const;

interface ItemsReader {
  get(id: number): { type: number; flags: number; material: number; count: number } | undefined;
  stockedTypes(): number[];
  count(typeId: string | number): number;
  tileOf(id: number): number;
  def(type: number): { name: string } | undefined;
  categoryOf(type: number): string;
  inContainer(id: number): number[];
}

interface JobsReader {
  list(state?: string): { id: number; state: string; priority: number }[];
  get(id: number): { id: number; state: string; priority: number } | undefined;
  standingOrder(name: string): boolean;
}

interface WorkshopsReader {
  allOrders(): { workshopId: number; order: { recipe: string | number; mode: string; remaining: number; priority: number } }[];
  recipe(id: string | number): { id: string; name: string } | undefined;
}

interface DwarvesReader {
  list(): number[];
  holder(title: string): number;
}

interface ImmigrationReader {
  cap(): number;
}

interface MoraleReader {
  tier(id: number): number;
  hallSpiritTier(): number;
}

interface ThreatsReader {
  renown(): number;
}

interface TerrainReader {
  inspect(i: number): { material: string; kind: number; discovered: boolean };
}

interface BuildingsReader {
  get(id: number): { typeId: string; state: string } | undefined;
  at(tile: number): number;
  zone(id: number): { type: string; tiles: readonly number[] } | undefined;
  zonesOfType(type: string): number[];
}

interface PanelsActHook extends Hook {
  readers: {
    ui: { panel: string | null; camX: number; camY: number; z: number; overlays: string[]; cursor: { x: number; y: number } | null };
    map: { w: number; h: number; index(x: number, y: number, z: number): number; designationAt(i: number): number; buildingAt(i: number): number };
    calendar: { tick: number };
    items: ItemsReader;
    buildings: BuildingsReader;
    entities: { each(kind: string, fn: (id: number) => void): void };
    of<T>(id: string): T;
  };
  host: {
    world: {
      applyCommand(cmd: Record<string, unknown>): { ok: boolean; reason?: string };
      emit(event: Record<string, unknown>): void;
      entities: {
        componentTypes(): readonly { id: number; name: string }[];
        get<T>(id: number, type: { id: number; name: string }): T | undefined;
      };
    };
  };
  step(ticks: number): void;
}

test('panels-act', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/?start=flat-test&embark=default');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('fortress');

  const panel = async () =>
    page.evaluate(() => (window as unknown as { __deepholm: PanelsActHook }).__deepholm.readers.ui.panel);

  if ((await panel()) !== null) {
    await page.keyboard.press('Escape');
    await expect.poll(panel).toBeNull();
  }

  // --- STATE SETUP VIA HOOK ---
  const setupInfo = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
    const map = h.readers.map;

    // 1. Two channel designations on the surface (z = 32) so jobs panel has at least 2 jobs
    const channelTiles = [map.index(45, 45, 32), map.index(46, 45, 32)];
    h.host.world.applyCommand({
      type: 'Designate',
      kind: 'channel',
      priority: 5,
      tiles: channelTiles,
    });

    // 2. Two global work orders (workshopId: 0)
    const o1 = h.host.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: 0,
      order: { recipeId: 'make_bed', mode: 'once', remaining: 3, threshold: 0, priority: 5, materialFilter: null },
    });
    if (!o1.ok) throw new Error(`AddWorkOrder 1 failed: ${o1.reason}`);
    const o2 = h.host.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: 0,
      order: { recipeId: 'make_chair_wood', mode: 'once', remaining: 2, threshold: 0, priority: 5, materialFilter: null },
    });
    if (!o2.ok) throw new Error(`AddWorkOrder 2 failed: ${o2.reason}`);

    // 3. One planned building (bed at camX + 15, camY + 15, z) and one zone (pasture at camX + 16, camY + 15, z) for map Delete test
    const camX = h.readers.ui.camX;
    const camY = h.readers.ui.camY;
    const z = h.readers.ui.z;
    const plannedBedOrigin = map.index(camX + 15, camY + 15, z);
    const placeRes = h.host.world.applyCommand({
      type: 'PlaceBuilding',
      buildingType: 'bed',
      origin: plannedBedOrigin,
      orientation: 0,
      priority: 5,
    });
    if (!placeRes.ok) throw new Error(`PlaceBuilding failed: ${placeRes.reason}`);

    const zoneTiles = [map.index(camX + 16, camY + 15, z)];
    const zoneRes = h.host.world.applyCommand({
      type: 'CreateZone',
      zoneType: 'pasture',
      tiles: zoneTiles,
    });
    if (!zoneRes.ok) throw new Error(`CreateZone failed: ${zoneRes.reason}`);

    const zoneId = h.readers.buildings.zonesOfType('pasture')[0]!;

    // 4. Alert announcement event for log panel test
    h.host.world.emit({ type: 'CavernBreached', cavernIndex: 1 });

    // Step 1 tick to let producers and events process
    h.step(1);

    const jobs = h.readers.of<JobsReader>('11').list();
    const dwarf0: number = h.readers.of<DwarvesReader>('10').list()[0]!;

    // Find iron bar item id and cloth item id
    const itemsReader = h.readers.items;
    let ironBarId = 0;
    let clothId = 0;
    h.readers.entities.each('item', (id) => {
      const it = itemsReader.get(id);
      if (it !== undefined) {
        const cat = itemsReader.categoryOf(it.type);
        if (cat === 'bar/metal' && ironBarId === 0) ironBarId = id;
        if (cat === 'textile/cloth' && clothId === 0) clothId = id;
      }
    });

    const clothItem = itemsReader.get(clothId)!;
    const groundItemTile = map.index(camX + 20, camY + 20, z);
    const groundItemId = (
      h.host.world as unknown as {
        services: { spawn: { item(t: number, m: number, at: number, count?: number): number } };
      }
    ).services.spawn.item(clothItem.type, clothItem.material, groundItemTile, 1);

    return {
      channelTiles,
      plannedBedOrigin,
      zoneTiles,
      zoneId,
      jobCount: jobs.length,
      dwarf0,
      ironBarId,
      groundItemId,
    };
  });

  expect(setupInfo.jobCount).toBeGreaterThanOrEqual(2);
  expect(setupInfo.ironBarId).toBeGreaterThan(0);
  expect(setupInfo.groundItemId).toBeGreaterThan(0);

  // ==========================================
  // 1. STOCKS PANEL ('s')
  // ==========================================
  await page.keyboard.press('s');
  await expect.poll(panel).toBe('stocks');

  // Find 'bar' category in tree
  const lines = (await textOf(page)).split('\n');
  const foodLine = lines.findIndex((l) => l.includes('food'));
  const barLine = lines.findIndex((l) => l.includes('bar'));
  expect(foodLine).toBeGreaterThanOrEqual(0);
  expect(barLine).toBeGreaterThan(foodLine);
  for (let k = 0; k < barLine - foodLine; k += 1) {
    await page.keyboard.press('ArrowDown');
  }

  // Expand 'bar' category -> reveals 'metal'
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('metal');

  // Move down to 'metal' subcategory
  await page.keyboard.press('ArrowDown');

  // Expand 'metal' -> reveals 'bar' type row
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await textOf(page)).includes('▾ metal') || (await textOf(page)).includes('▼ metal')).toBe(true);

  // Move down to 'bar' type row
  await page.keyboard.press('ArrowDown');

  // 1a. Forbid item type (Shift+F)
  await page.keyboard.press('Shift+F');
  await expect.poll(async () => {
    const flags = await page.evaluate((id) => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      return h.readers.items.get(id)?.flags ?? 0;
    }, setupInfo.ironBarId);
    return (flags & ItemFlag.Forbidden) !== 0;
  }).toBe(true);

  // Expand 'bar' type to reveal individual iron bar stack
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('iron x');

  // Move down onto the iron bar stack
  await page.keyboard.press('ArrowDown');

  // 1b. Mark for dumping (Shift+D) -> opens confirm dialog
  await page.keyboard.press('Shift+D');
  await expect.poll(() => screenOf(page)).toBe('confirm');
  expect(await textOf(page)).toContain('dumping');
  await page.keyboard.press('y');
  await expect.poll(() => screenOf(page)).toBe('fortress');

  await expect.poll(async () => {
    const flags = await page.evaluate((id) => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      return h.readers.items.get(id)?.flags ?? 0;
    }, setupInfo.ironBarId);
    return (flags & ItemFlag.Dump) !== 0;
  }).toBe(true);

  // 1c. Mark metal item for melting (Shift+M) -> opens confirm dialog
  await page.keyboard.press('Shift+M');
  await expect.poll(() => screenOf(page)).toBe('confirm');
  expect(await textOf(page)).toContain('melting');
  await page.keyboard.press('y');
  await expect.poll(() => screenOf(page)).toBe('fortress');

  await expect.poll(async () => {
    const flags = await page.evaluate((id) => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      return h.readers.items.get(id)?.flags ?? 0;
    }, setupInfo.ironBarId);
    return (flags & ItemFlag.Melt) !== 0;
  }).toBe(true);

  // Close stocks panel
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  // ==========================================
  // 2. JOBS PANEL ('j')
  // ==========================================
  await page.keyboard.press('j');
  await expect.poll(panel).toBe('jobs');

  const initialJob0 = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
    const j = h.readers.of<JobsReader>('11').list()[0]!;
    return { id: j.id, priority: j.priority };
  });

  // Change first job's priority (Shift+P)
  await page.keyboard.press('Shift+P');
  await expect.poll(async () => {
    return page.evaluate((id) => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      return h.readers.of<JobsReader>('11').get(id)?.priority;
    }, initialJob0.id);
  }).toBe((initialJob0.priority % 9) + 1);

  const secondJobId = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
    const jobs = h.readers.of<JobsReader>('11').list()
      .filter((j) => j.state !== 'done' && j.state !== 'cancelled')
      .sort((a, b) => a.priority - b.priority || a.id - b.id);
    return jobs[1]?.id;
  });
  expect(secondJobId).toBeDefined();

  // Select second job with ArrowDown
  await page.keyboard.press('ArrowDown');

  // Cancel second job (x)
  await page.keyboard.press('x');
  await expect.poll(async () => {
    return page.evaluate((id) => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      const job = h.readers.of<JobsReader>('11').get(id);
      return job === undefined || job.state === 'cancelled';
    }, secondJobId!);
  }).toBe(true);

  // Close jobs panel
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  // ==========================================
  // 3. ORDERS PANEL ('o')
  // ==========================================
  await page.keyboard.press('o');
  await expect.poll(panel).toBe('orders');

  // Reorder work order: Shift+ArrowDown moves order 0 down
  await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(async () => {
    return page.evaluate(() => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      const r = h.readers.of<WorkshopsReader>('12');
      const orders = r.allOrders();
      return orders.map((o) => r.recipe(o.order.recipe)?.id);
    });
  }).toEqual(['make_chair_wood', 'make_bed']);

  // Remove selected order (x) -> confirm dialog
  await page.keyboard.press('x');
  await expect.poll(() => screenOf(page)).toBe('confirm');
  expect(await textOf(page)).toContain('Remove the order');
  await page.keyboard.press('y');
  await expect.poll(() => screenOf(page)).toBe('fortress');

  await expect.poll(async () => {
    return page.evaluate(() => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      return h.readers.of<WorkshopsReader>('12').allOrders().length;
    });
  }).toBe(1);

  // Toggle standing order via mouse click on its line
  const standingInitial = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
    return h.readers.of<JobsReader>('11').standingOrder('autoHarvest');
  });

  const canvasBox = await page.locator('canvas#screen').boundingBox();
  if (canvasBox === null) throw new Error('no canvas box');

  // Find row containing Harvest in text
  const screenLines = (await textOf(page)).split('\n');
  const standingRow = screenLines.findIndex((line) => line.includes('Harvest'));
  expect(standingRow).toBeGreaterThanOrEqual(0);

  const colOffset = screenLines[standingRow]!.indexOf('Harvest') + 1;
  const clickPt = await page.evaluate(
    ([c, r]) => (window as unknown as { __deepholm: PanelsActHook }).__deepholm.cellCenter(c as number, r as number),
    [colOffset, standingRow],
  );

  await page.mouse.click(canvasBox.x + clickPt.x, canvasBox.y + clickPt.y);

  await expect.poll(async () => {
    return page.evaluate(() => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      return h.readers.of<JobsReader>('11').standingOrder('autoHarvest');
    });
  }).toBe(!standingInitial);

  // Close orders panel
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  // ==========================================
  // 4. UNITS PANEL ('u')
  // ==========================================
  await page.keyboard.press('u');
  await expect.poll(panel).toBe('units');

  // Give a title (Shift+T) -> title picker -> ArrowDown to Warden -> Enter
  await page.keyboard.press('Shift+T');
  await expect.poll(() => textOf(page)).toContain('Title for');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect.poll(async () => {
    return page.evaluate((dwarfId) => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      return h.readers.of<DwarvesReader>('10').holder('warden') === dwarfId;
    }, setupInfo.dwarf0);
  }).toBe(true);

  // Shift dwarf sleep hour with ']' and '['
  const getSleepHour = async (): Promise<number> =>
    page.evaluate((dwarfId) => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      const sched = h.host.world.entities.componentTypes().find((t) => t.name === 'Schedule')!;
      return h.host.world.entities.get<{ sleepStartHour: number }>(dwarfId, sched)?.sleepStartHour ?? 0;
    }, setupInfo.dwarf0);

  const initialSleep = await getSleepHour();
  await page.keyboard.press(']');
  await expect.poll(getSleepHour).toBe((initialSleep + 1) % 24);

  await page.keyboard.press('[');
  await expect.poll(getSleepHour).toBe(initialSleep);

  // Close units panel
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  // ==========================================
  // 5. POPULATION PANEL ('p')
  // ==========================================
  await page.keyboard.press('p');
  await expect.poll(panel).toBe('population');

  const getPopCap = async (): Promise<number> =>
    page.evaluate(() => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      return h.readers.of<ImmigrationReader>('21').cap();
    });

  const initialCap = await getPopCap();
  await page.keyboard.press('+');
  await expect.poll(getPopCap).toBe(initialCap + 1);

  await page.keyboard.press('-');
  await expect.poll(getPopCap).toBe(initialCap);

  // Close population panel
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  // ==========================================
  // 6. MOOD, THREATS, LOG, LOOK PANELS
  // ==========================================
  // 6a. Mood ('e'): shows dwarf mood tier
  await page.keyboard.press('e');
  await expect.poll(panel).toBe('mood');
  const moodTierName = await page.evaluate((dwarfId: number) => {
    const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
    const tier = h.readers.of<MoraleReader>('15').tier(dwarfId);
    return ['Miserable', 'Unhappy', 'Fine', 'Content', 'Ecstatic'][tier] ?? 'Fine';
  }, setupInfo.dwarf0 as number);
  expect(await textOf(page)).toContain(moodTierName);
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  // 6b. Threats ('t'): shows renown
  await page.keyboard.press('t');
  await expect.poll(panel).toBe('threats');
  const renown = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
    return h.readers.of<ThreatsReader>('18').renown().toFixed(1);
  });
  expect(await textOf(page)).toContain(`Renown ${renown}`);
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  // 6c. Log ('a'): logged announcement after filter change
  await page.keyboard.press('a');
  await expect.poll(panel).toBe('log');
  expect(await textOf(page)).toContain('A cavern has been breached.');
  // Switch to Alerts filter (2)
  await page.keyboard.press('2');
  expect(await textOf(page)).toContain('A cavern has been breached.');
  // Switch to Combat filter (3)
  await page.keyboard.press('3');
  expect(await textOf(page)).toContain('Nothing has happened yet.');
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  // 6d. Look ('k'): material of tile under cursor
  await page.keyboard.press('k');
  await expect.poll(panel).toBe('look');
  const tileMaterial = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
    const map = h.readers.map;
    const centerTile = map.index(40, 40, h.readers.ui.z);
    return h.readers.of<TerrainReader>('03').inspect(centerTile).material;
  });
  expect((await textOf(page)).toLowerCase()).toContain(tileMaterial.toLowerCase());
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  // ==========================================
  // 7. OVERLAYS ('f')
  // ==========================================
  await page.keyboard.press('f');
  await expect.poll(panel).toBe('overlays');

  // Toggle each overlay in the 11-row list and assert cell buffer changes
  for (let i = 0; i < 11; i += 1) {
    const beforeCells = await page.evaluate(() => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      return h.cells().glyph.slice();
    });

    await page.keyboard.press('Enter');

    await expect.poll(async () => {
      return page.evaluate((before) => {
        const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
        const current = h.cells().glyph;
        return current.some((g, idx) => g !== before[idx]);
      }, beforeCells);
    }).toBe(true);

    if (i < 10) await page.keyboard.press('ArrowDown');
  }

  // Close overlays panel
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  // ==========================================
  // 8. MAP ACTIONS
  // ==========================================
  // 8a. Ctrl+Z undoes designation batch
  await page.keyboard.press('d');
  await expect.poll(panel).toBe('designate');
  // Choose channel tool with Shift+C for surface floor tiles
  await page.keyboard.press('Shift+C');
  await expect.poll(() => textOf(page)).toContain('Channel · priority 5');

  const uiState8 = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
    return { camX: h.readers.ui.camX, camY: h.readers.ui.camY, z: h.readers.ui.z };
  });

  // Drag designate rectangle at screen col 10, row 10 to col 11, row 10
  const desTileA = { x: uiState8.camX + 10, y: uiState8.camY + 10, z: uiState8.z };
  const desPtA = await page.evaluate(
    ([c, r]) => (window as unknown as { __deepholm: PanelsActHook }).__deepholm.cellCenter(c as number, r as number),
    [10, 10],
  );
  const desPtB = await page.evaluate(
    ([c, r]) => (window as unknown as { __deepholm: PanelsActHook }).__deepholm.cellCenter(c as number, r as number),
    [11, 10],
  );
  await page.mouse.move(canvasBox.x + desPtA.x, canvasBox.y + desPtA.y);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + desPtB.x, canvasBox.y + desPtB.y, { steps: 4 });
  await page.mouse.up();

  // Confirm designation exists on desTileA
  await expect.poll(async () => {
    return page.evaluate((tile) => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      const map = h.readers.map;
      return map.designationAt(map.index(tile.x, tile.y, tile.z)) !== 0;
    }, desTileA);
  }).toBe(true);

  // Exit designate tool before pressing Ctrl+Z
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect.poll(panel).toBeNull();

  // Press Ctrl+Z to undo last designation batch
  await page.keyboard.press('Control+z');
  await expect.poll(async () => {
    return page.evaluate((tile) => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      const map = h.readers.map;
      return map.designationAt(map.index(tile.x, tile.y, tile.z)) === 0;
    }, desTileA);
  }).toBe(true);

  // 8b. Delete on selection cancels planned building and removes zone
  // Planned building at col 15, row 15 and pasture zone at col 16, row 15
  const selA = await page.evaluate(
    ([c, r]) => (window as unknown as { __deepholm: PanelsActHook }).__deepholm.cellCenter(c as number, r as number),
    [15, 15],
  );
  const selB = await page.evaluate(
    ([c, r]) => (window as unknown as { __deepholm: PanelsActHook }).__deepholm.cellCenter(c as number, r as number),
    [16, 15],
  );

  // Drag selection rectangle over 15, 15 to 16, 15
  await page.mouse.move(canvasBox.x + selA.x, canvasBox.y + selA.y);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + selB.x, canvasBox.y + selB.y, { steps: 4 });
  await page.mouse.up();

  // Press Delete -> zone removal asks confirmation dialog (c_remove_zone)
  await page.keyboard.press('Delete');
  await expect.poll(() => screenOf(page)).toBe('confirm');
  expect(await textOf(page)).toContain('Remove');
  await page.keyboard.press('y');
  await expect.poll(() => screenOf(page)).toBe('fortress');

  // Verify planned building is cancelled and zone is removed
  await expect.poll(async () => {
    return page.evaluate((info) => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      const map = h.readers.map;
      const bedAtTile = map.buildingAt(info.plannedBedOrigin);
      const zoneAtTile = h.readers.buildings.zone(info.zoneId);
      return bedAtTile === 0 && zoneAtTile === undefined;
    }, setupInfo);
  }).toBe(true);

  // 8c. Rectangle selection forbids items
  // Drag selection rectangle over col 20, row 20 to col 21, row 20 covering groundItemId
  const itemSelA = await page.evaluate(
    ([c, r]) => (window as unknown as { __deepholm: PanelsActHook }).__deepholm.cellCenter(c as number, r as number),
    [20, 20],
  );
  const itemSelB = await page.evaluate(
    ([c, r]) => (window as unknown as { __deepholm: PanelsActHook }).__deepholm.cellCenter(c as number, r as number),
    [21, 20],
  );

  await page.mouse.move(canvasBox.x + itemSelA.x, canvasBox.y + itemSelA.y);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + itemSelB.x, canvasBox.y + itemSelB.y, { steps: 4 });
  await page.mouse.up();

  // Press Shift+F to forbid items in the selection (selection forbid uses Shift+F)
  await page.keyboard.press('Shift+F');

  await expect.poll(async () => {
    const flags = await page.evaluate((itemId) => {
      const h = (window as unknown as { __deepholm: PanelsActHook }).__deepholm;
      return h.readers.items.get(itemId)?.flags ?? 0;
    }, setupInfo.groundItemId);
    return (flags & ItemFlag.Forbidden) !== 0;
  }).toBe(true);

  // ==========================================
  // 9. SCREENSHOT & FINISH
  // ==========================================
  const path = await page.evaluate(
    () => (window as unknown as { __deepholm: PanelsActHook }).__deepholm.screenshotName('panels-act'),
  );
  await page.screenshot({ path });

  expect(errors).toEqual([]);
});
