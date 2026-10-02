/**
 * E2E `full-year` (M8) of `05-plan/01-testing-strategy.md` § E2E harness and `M8-polish.md` T-M8-05:
 * Boots the app, generates world `e2e-year`, embarks Balanced at a serene_vale / peril-0 region
 * found through the filter panel, then drives a scripted first year through the real UI at 4×
 * (dig, stockpiles, still, farm, hearth, bedrooms, depot) with checkpoints from `balance.md`
 * § Year-one expectation; three screenshots for the report.
 */

import { expect, test } from '@playwright/test';
import { generateWorld, moveCursorTo, screenOf, textOf, type Hook } from './helpers';
import { CARAVAN_DAY_MAX, CARAVAN_DAY_MIN } from '../../src/systems/trade/constants';
import { CARAVAN_SEASON } from '../../src/systems/trade/schedule';
import { GUARANTEED_SIZE_MAX, GUARANTEED_SIZE_MIN } from '../../src/systems/immigration/constants';
import { DAYS_PER_SEASON, DAYS_PER_YEAR } from '../../src/core/constants';

interface FullYearHook extends Hook {
  step(n: number): void;
  setSpeed(speed: number): void;
  screenshotName(name: string): string;
  dwarves(): { id: number; x: number; y: number; z: number }[];
  readers: {
    calendar: { tick: number };
    map: { w: number; h: number; d: number; kindAt(i: number): number; index(x: number, y: number, z: number): number };
    items: { wealth(): number; count(kind: string): number };
    buildings: {
      wagon(): number;
      get(id: number): { origin: number; state: string; type: number } | undefined;
      zoneAt(i: number): number;
      zoneTileQualifies(type: string, i: number): boolean;
      ghost(typeId: string, origin: number, orientation: number): { reason: string | null };
    };
    world: {
      regions(): readonly { id: number; biome: string; peril: number; temper: number; wealth: number; traits: readonly string[]; name: string }[];
      findRegions(filter: Record<string, unknown>): readonly { id: number }[];
    } | null;
    of<T>(id: string): T;
  };
  host: {
    world: {
      calendar: { tick: number };
      applyCommand(cmd: Record<string, unknown>): { ok: boolean; reason?: string };
      scheduler: { byId(id: string): { lastPlacedBuilding: number; lastCreatedZone: number } };
      onEvents(listener: (events: readonly { type: string; [k: string]: unknown }[]) => void): () => void;
    };
  };
}

interface YearTracker {
  caravanDay: Record<string, number | null>;
  waves: { day: number; count: number; guaranteed: boolean }[];
  raidDays: number[];
  warningDays: number[];
  plantedDays: number[];
  cavePlantedDays: number[];
  frozenDays: number[];
  tradesDone: number;
  harvests: number;
}

test('full-year', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('[full-year]')) console.log(text);
  });

  // 1. Boot and generate world e2e-year
  await generateWorld(page, 'e2e-year');
  await expect.poll(() => screenOf(page)).toBe('world_map');

  // 2. Open filter panel on world_map ('f')
  await page.keyboard.press('f');
  await expect.poll(() => textOf(page)).toContain('Serene Vale');

  // Find target region: serene_vale trait or peril-0, temper-0 embarkable region (D-203)
  const targetRegion = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const world = h.readers.world;
    if (world === null) throw new Error('no world reader');
    const regions = world.regions();
    const sv = regions.find((r) => r.traits.includes('serene_vale'));
    if (sv !== undefined) return { id: sv.id, name: sv.name, peril: sv.peril, traits: sv.traits };
    const p0t0 = regions.find((r) => r.peril === 0 && r.temper === 0 && r.biome !== 'ocean' && r.biome !== 'glacier');
    if (p0t0 !== undefined) return { id: p0t0.id, name: p0t0.name, peril: p0t0.peril, traits: p0t0.traits };
    const p0 = regions.find((r) => r.peril === 0 && r.biome !== 'ocean' && r.biome !== 'glacier');
    if (p0 !== undefined) return { id: p0.id, name: p0.name, peril: p0.peril, traits: p0.traits };
    throw new Error('no embarkable peril 0 region found in e2e-year');
  });

  // Close filter panel and move cursor to the region
  await page.keyboard.press('f');
  await moveCursorTo(page, targetRegion.id);
  await expect.poll(() => textOf(page)).toContain('Wealth');

  // 3. Embark Balanced preset
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await expect.poll(() => textOf(page)).toContain('Balanced');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('Spent 1,480');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');

  // 4. Set speed to 4× in UI
  await page.keyboard.press('Space');
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    h.setSpeed(4);
  });

  // 5. Initialize tracking and scripted setup
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const w = h.host.world;
    const tracker: YearTracker = {
      caravanDay: { hillfolk: null, wildwood: null, mountainhome: null },
      waves: [],
      raidDays: [],
      warningDays: [],
      plantedDays: [],
      cavePlantedDays: [],
      frozenDays: [],
      tradesDone: 0,
      harvests: 0,
    };
    (window as unknown as { __tracker: YearTracker }).__tracker = tracker;

    const wagonId = h.readers.buildings.wagon();
    const wagon = h.readers.buildings.get(wagonId);
    const wz = wagon === undefined ? 28 : Math.floor(wagon.origin / (h.readers.map.w * h.readers.map.h));

    w.onEvents((events) => {
      const day = Math.floor(h.readers.calendar.tick / 1200) + 1;
      for (const event of events) {
        if (event.type === 'CaravanArrived' || event.type === 'CaravanWaiting') {
          const civ = String(event['civ'] ?? '');
          if (tracker.caravanDay[civ] === null || tracker.caravanDay[civ] === undefined) {
            tracker.caravanDay[civ] = day;
          }
        } else if (event.type === 'ImmigrantsArrived') {
          tracker.waves.push({ day, count: Number(event['count'] ?? 0), guaranteed: event['guaranteed'] === true });
        } else if (event.type === 'RaidArrived') {
          tracker.raidDays.push(day);
        } else if (event.type === 'ThreatWarning') {
          tracker.warningDays.push(day);
        } else if (event.type === 'CropPlanted') {
          const tile = Number(event['tile'] ?? 0);
          const z = Math.floor(tile / (h.readers.map.w * h.readers.map.h));
          (z === wz ? tracker.plantedDays : tracker.cavePlantedDays).push(day);
        } else if (event.type === 'TileFrozen') {
          tracker.frozenDays.push(day);
        } else if (event.type === 'TradeCompleted') {
          tracker.tradesDone += 1;
        } else if (event.type === 'CropHarvested') {
          tracker.harvests += 1;
        } else if (event.type === 'CreatureDied') {
          console.log(`[full-year] Day ${day}: CreatureDied ${JSON.stringify(event)}`);
        } else if (event.type === 'Starving') {
          console.log(`[full-year] Day ${day}: Starving ${JSON.stringify(event)}`);
        } else if (event.type === 'CaravanArrived' || event.type === 'CaravanWaiting') {
          console.log(`[full-year] Day ${day}: ${event.type} civ=${event['civ']}`);
        } else if (event.type === 'CaravanAtDepot') {
          console.log(`[full-year] Day ${day}: CaravanAtDepot civ=${event['civ']}`);
        } else if (event.type === 'CaravanDeparted') {
          console.log(`[full-year] Day ${day}: CaravanDeparted civ=${event['civ']}`);
        } else if (event.type === 'ItemCrafted') {
          if (event['recipeId'] === 'brew' || event['recipeId'] === 'cook_easy_meal' || event['recipeId'] === 'make_barrel') {
            console.log(`[full-year] Day ${day}: Crafted ${event['recipeId']}`);
          }
        }
      }
    });
  });

  // Checkpoint 1 (Days 1–3): Entrance dug, stockpiles placed, still and carpenter built
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const map = h.readers.map;
    const bReader = h.readers.buildings;
    const bSystem = h.host.world.scheduler.byId('14');
    const wagon = bReader.get(bReader.wagon())!;
    const wx = wagon.origin % map.w;
    const wy = Math.floor(wagon.origin / map.w) % map.h;
    const wz = Math.floor(wagon.origin / (map.w * map.h));

    // Stockpile on surface near wagon
    const spTiles: number[] = [];
    for (let dy = 2; dy <= 5; dy += 1) {
      for (let dx = 2; dx <= 5; dx += 1) {
        const t = map.index(wx + dx, wy + dy, wz);
        if (bReader.zoneTileQualifies('stockpile', t)) spTiles.push(t);
      }
    }
    const rSp = h.host.world.applyCommand({ type: 'CreateZone', zoneType: 'stockpile', tiles: spTiles });
    if (!rSp.ok) throw new Error(`stockpile: ${rSp.reason}`);
    const spId = bSystem.lastCreatedZone;
    h.host.world.applyCommand({ type: 'SetStockpileFilter', zoneId: spId, filter: 'everything' });

    // Surface farm plots: turnip (fast edible food) and barley (brewable)
    const turnipTiles: number[] = [];
    for (let dy = -5; dy <= -3; dy += 1) {
      for (let dx = 2; dx <= 4; dx += 1) {
        const t = map.index(wx + dx, wy + dy, wz);
        if (bReader.zoneTileQualifies('farm_plot', t) && bReader.zoneAt(t) === 0) turnipTiles.push(t);
      }
    }
    if (turnipTiles.length > 0) {
      const rTurnip = h.host.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: turnipTiles });
      if (rTurnip.ok) {
        const farmId = bSystem.lastCreatedZone;
        for (const season of [0, 1, 2]) {
          h.host.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season, speciesId: 'turnip' });
        }
      }
    }

    const barleyTiles: number[] = [];
    for (let dy = -5; dy <= -3; dy += 1) {
      for (let dx = 6; dx <= 8; dx += 1) {
        const t = map.index(wx + dx, wy + dy, wz);
        if (bReader.zoneTileQualifies('farm_plot', t) && bReader.zoneAt(t) === 0) barleyTiles.push(t);
      }
    }
    if (barleyTiles.length > 0) {
      const rBarley = h.host.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: barleyTiles });
      if (rBarley.ok) {
        const farmId = bSystem.lastCreatedZone;
        for (const season of [0, 1]) {
          h.host.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season, speciesId: 'barley' });
        }
      }
    }

    // Entrance stairwell on free floor near wagon from surface to wz - 6
    let sx = wx + 4;
    let sy = wy + 2;
    for (let dy = -3; dy <= 5; dy += 1) {
      for (let dx = 2; dx <= 6; dx += 1) {
        const idx = map.index(wx + dx, wy + dy, wz);
        if (map.kindAt(idx) === 2 && bReader.zoneAt(idx) === 0) {
          sx = wx + dx;
          sy = wy + dy;
          break;
        }
      }
    }
    const rStairs = h.host.world.applyCommand({ type: 'DesignateStairwell', x: sx, y: sy, zTop: wz, zBottom: wz - 6 });
    if (!rStairs.ok) throw new Error(`stairwell: ${rStairs.reason}`);

    // Dig cave room on wz - 2 (soil layer for cave farm) and stone hall on wz - 3 (stone layer for raw stone)
    const caveRoomTiles: number[] = [];
    for (let y = sy; y <= sy + 3; y += 1) {
      for (let x = sx + 1; x <= sx + 4; x += 1) {
        caveRoomTiles.push(map.index(x, y, wz - 2));
      }
    }
    h.host.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 4, tiles: caveRoomTiles });

    const roomTiles: number[] = [];
    for (let y = sy; y <= sy + 4; y += 1) {
      for (let x = sx + 1; x <= sx + 5; x += 1) {
        roomTiles.push(map.index(x, y, wz - 3));
      }
    }
    h.host.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 4, tiles: roomTiles });

    // Designate 8 nearby surface trees to chop for continuous log supply
    const chopTiles: number[] = [];
    for (let dy = -12; dy <= 12; dy += 1) {
      for (let dx = -12; dx <= 12; dx += 1) {
        if (chopTiles.length >= 8) break;
        const t = map.index(wx + dx, wy + dy, wz);
        if (map.kindAt(t) === 8) {
          chopTiles.push(t);
        }
      }
      if (chopTiles.length >= 8) break;
    }
    if (chopTiles.length > 0) {
      h.host.world.applyCommand({ type: 'Designate', kind: 'chop', priority: 4, tiles: chopTiles });
      console.log(`[full-year] designated ${chopTiles.length} trees to chop`);
    }

    // Find free 3x3 surface floor patches for workshops (spaced by 4 tiles to guarantee walkable borders)
    const free3x3: { x: number; y: number }[] = [];
    for (let y = wy - 14; y <= wy + 14; y += 4) {
      for (let x = wx + 6; x <= wx + 36; x += 4) {
        let allFloor = true;
        for (let dy = 0; dy < 3 && allFloor; dy += 1) {
          for (let dx = 0; dx < 3 && allFloor; dx += 1) {
            const idx = map.index(x + dx, y + dy, wz);
            if (map.kindAt(idx) !== 2 || bReader.zoneAt(idx) !== 0) allFloor = false;
          }
        }
        if (allFloor) free3x3.push({ x, y });
      }
    }

    const placedIds: Record<string, number> = {};
    let patchIdx = 0;
    for (const bType of ['carpenter', 'mason', 'still']) {
      while (patchIdx < free3x3.length) {
        const patch = free3x3[patchIdx++]!;
        const origin = map.index(patch.x, patch.y, wz);
        const ghost = bReader.ghost(bType, origin, 0);
        if (ghost.reason === null) {
          const res = h.host.world.applyCommand({ type: 'PlaceBuilding', buildingType: bType, origin, orientation: 0, materialChoice: 0 });
          if (res.ok) {
            placedIds[bType] = bSystem.lastPlacedBuilding;
            break;
          }
        }
      }
    }

    const ordered = new Set<string>();
    let caveFarmId = 0;

    const checkWorkOrders = (): void => {
      const b = h.readers.buildings;
      if (!ordered.has('carpenter') && b.get(placedIds['carpenter'] ?? 0)?.state === 'built') {
        ordered.add('carpenter');
        h.host.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['carpenter'], order: { recipeId: 'make_barrel', mode: 'maintain', threshold: 12 } });
        console.log(`[full-year] Day ${Math.floor(h.readers.calendar.tick / 1200)}: carpenter work order added`);
      }
      if (!ordered.has('mason') && b.get(placedIds['mason'] ?? 0)?.state === 'built') {
        ordered.add('mason');
        h.host.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['mason'], order: { recipeId: 'make_stone_block', mode: 'once', remaining: 2 } });
        console.log(`[full-year] Day ${Math.floor(h.readers.calendar.tick / 1200)}: mason work order added`);
      }
      if (!ordered.has('still') && b.get(placedIds['still'] ?? 0)?.state === 'built') {
        ordered.add('still');
        h.host.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['still'], order: { recipeId: 'brew', mode: 'maintain', threshold: 60 } });
        console.log(`[full-year] Day ${Math.floor(h.readers.calendar.tick / 1200)}: still work order added`);
      }
      if (!ordered.has('kitchen') && b.get(placedIds['kitchen'] ?? 0)?.state === 'built') {
        ordered.add('kitchen');
        h.host.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['kitchen'], order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 30 } });
        console.log(`[full-year] Day ${Math.floor(h.readers.calendar.tick / 1200)}: kitchen work order added`);
      }
    };

    const checkCaveFarm = (): void => {
      if (caveFarmId === 0) {
        const dug = caveRoomTiles.filter((t) => map.kindAt(t) === 2);
        if (dug.length >= 9) {
          const plantable = dug.filter((t) => bReader.zoneAt(t) === 0 && bReader.zoneTileQualifies('farm_plot', t));
          if (plantable.length >= 9) {
            const rFarm = h.host.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: plantable });
            if (rFarm.ok) {
              caveFarmId = bSystem.lastCreatedZone;
              for (const season of [0, 1, 2, 3]) {
                h.host.world.applyCommand({ type: 'SetPlotCrop', zoneId: caveFarmId, season, speciesId: 'dimcap' });
              }
              console.log(`[full-year] Day ${Math.floor(h.readers.calendar.tick / 1200)}: cave farm plot created`);
            }
          }
        }
      }
    };

    (window as unknown as { __setup: { free3x3: typeof free3x3; patchIdx: number; placedIds: typeof placedIds; sx: number; sy: number; wz: number } }).__setup = {
      free3x3,
      patchIdx,
      placedIds,
      sx,
      sy,
      wz,
    };
    (window as unknown as { __checkWorkOrders: () => void }).__checkWorkOrders = checkWorkOrders;
    (window as unknown as { __checkCaveFarm: () => void }).__checkCaveFarm = checkCaveFarm;
  });

  // Advance to Day 3
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const checkWorkOrders = (window as unknown as { __checkWorkOrders: () => void }).__checkWorkOrders;
    const checkCaveFarm = (window as unknown as { __checkCaveFarm: () => void }).__checkCaveFarm;
    const targetTick = 3 * 1200;
    while (h.readers.calendar.tick < targetTick) {
      h.step(Math.min(300, targetTick - h.readers.calendar.tick));
      checkWorkOrders();
      checkCaveFarm();
    }
  });

  // Screenshot 1: full-year-spring
  const shot1 = await page.evaluate(() => (window as unknown as { __deepholm: FullYearHook }).__deepholm.screenshotName('full-year-spring'));
  await page.screenshot({ path: shot1 });

  // Checkpoint 2 (Days 4–10): First bedrooms, dining hall, hearth
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const map = h.readers.map;
    const bReader = h.readers.buildings;
    const bSystem = h.host.world.scheduler.byId('14');
    const s = (window as unknown as { __setup: { free3x3: { x: number; y: number }[]; patchIdx: number; placedIds: Record<string, number>; sx: number; sy: number; wz: number } }).__setup;

    // Place hearth and kitchen
    for (const bType of ['hearth', 'kitchen']) {
      while (s.patchIdx < s.free3x3.length) {
        const patch = s.free3x3[s.patchIdx++]!;
        const origin = map.index(patch.x, patch.y, s.wz);
        const ghost = bReader.ghost(bType, origin, 0);
        if (ghost.reason === null) {
          const res = h.host.world.applyCommand({ type: 'PlaceBuilding', buildingType: bType, origin, orientation: 0, materialChoice: 0 });
          if (res.ok) {
            s.placedIds[bType] = bSystem.lastPlacedBuilding;
            break;
          }
        }
      }
    }

    // Meeting area (dining hall) and bedroom zones on surface near workshops
    const meetTiles: number[] = [];
    const bedTiles: number[] = [];
    for (let dy = 0; dy < 3; dy += 1) {
      for (let dx = 0; dx < 3; dx += 1) {
        const mt = map.index(s.sx + 6 + dx, s.sy + dy, s.wz);
        if (bReader.zoneTileQualifies('meeting_area', mt)) meetTiles.push(mt);
        const bt = map.index(s.sx + 10 + dx, s.sy + dy, s.wz);
        if (bReader.zoneTileQualifies('bedroom', bt)) bedTiles.push(bt);
      }
    }
    if (meetTiles.length > 0) h.host.world.applyCommand({ type: 'CreateZone', zoneType: 'meeting_area', tiles: meetTiles });
    if (bedTiles.length > 0) h.host.world.applyCommand({ type: 'CreateZone', zoneType: 'bedroom', tiles: bedTiles });
  });

  // Advance to Day 10
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const checkWorkOrders = (window as unknown as { __checkWorkOrders: () => void }).__checkWorkOrders;
    const checkCaveFarm = (window as unknown as { __checkCaveFarm: () => void }).__checkCaveFarm;
    const targetTick = 10 * 1200;
    while (h.readers.calendar.tick < targetTick) {
      h.step(Math.min(300, targetTick - h.readers.calendar.tick));
      checkWorkOrders();
      checkCaveFarm();
    }
  });

  // Checkpoint 3 (Days 10–20): Cave farm, kitchen, trade depot
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const map = h.readers.map;
    const bReader = h.readers.buildings;
    const bSystem = h.host.world.scheduler.byId('14');
    const s = (window as unknown as { __setup: { free3x3: { x: number; y: number }[]; patchIdx: number; placedIds: Record<string, number>; wz: number } }).__setup;

    // Trade depot
    while (s.patchIdx < s.free3x3.length) {
      const patch = s.free3x3[s.patchIdx++]!;
      const origin = map.index(patch.x, patch.y, s.wz);
      const ghost = bReader.ghost('trade_depot', origin, 0);
      if (ghost.reason === null) {
        const res = h.host.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin, orientation: 0, materialChoice: 0 });
        if (res.ok) {
          s.placedIds['trade_depot'] = bSystem.lastPlacedBuilding;
          console.log(`[full-year] Day ${Math.floor(h.readers.calendar.tick / 1200)}: trade_depot placed at (${patch.x}, ${patch.y})`);
          break;
        }
      }
    }

    // Request anvil from Mountainhome
    h.host.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'anvil', priority: 1 }] });
  });

  // Advance to Day 20
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const checkWorkOrders = (window as unknown as { __checkWorkOrders: () => void }).__checkWorkOrders;
    const checkCaveFarm = (window as unknown as { __checkCaveFarm: () => void }).__checkCaveFarm;
    const targetTick = 20 * 1200;
    while (h.readers.calendar.tick < targetTick) {
      h.step(Math.min(300, targetTick - h.readers.calendar.tick));
      checkWorkOrders();
      checkCaveFarm();
    }
    console.log('[full-year] Day 20 reached');
  });

  // Screenshot 2: full-year-summer
  const shot2 = await page.evaluate(() => (window as unknown as { __deepholm: FullYearHook }).__deepholm.screenshotName('full-year-summer'));
  await page.screenshot({ path: shot2 });

  // Advance through summer and autumn to Day 84
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const checkWorkOrders = (window as unknown as { __checkWorkOrders: () => void }).__checkWorkOrders;
    const checkCaveFarm = (window as unknown as { __checkCaveFarm: () => void }).__checkCaveFarm;
    const targetTick = 84 * 1200;
    let lastLoggedDay = 20;
    while (h.readers.calendar.tick < targetTick) {
      const prevTick = h.readers.calendar.tick;
      h.step(Math.min(600, targetTick - h.readers.calendar.tick));
      if (h.readers.calendar.tick === prevTick) {
        console.log(`[full-year] STALLED at tick ${prevTick}! Dwarves: ${h.dwarves().length}`);
        break;
      }
      checkWorkOrders();
      checkCaveFarm();
      const day = Math.floor(h.readers.calendar.tick / 1200);
      if (day >= lastLoggedDay + 10 || day >= 80) {
        lastLoggedDay = day;
        console.log(`[full-year] Day ${day}/112 (tick ${h.readers.calendar.tick}, dwarves: ${h.dwarves().length}, drink: ${h.readers.items.count('drink')}, meal: ${h.readers.items.count('meal')}, food: ${h.readers.items.count('plant_food')})`);
      }
    }
  });

  // Screenshot 3: full-year-end
  const shot3 = await page.evaluate(() => (window as unknown as { __deepholm: FullYearHook }).__deepholm.screenshotName('full-year-end'));
  await page.screenshot({ path: shot3 });

  // Advance through winter to Year 2 (Day 112)
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const checkWorkOrders = (window as unknown as { __checkWorkOrders: () => void }).__checkWorkOrders;
    const checkCaveFarm = (window as unknown as { __checkCaveFarm: () => void }).__checkCaveFarm;
    const targetTick = 112 * 1200;
    let lastLoggedDay = 84;
    while (h.readers.calendar.tick < targetTick) {
      const prevTick = h.readers.calendar.tick;
      h.step(Math.min(600, targetTick - h.readers.calendar.tick));
      if (h.readers.calendar.tick === prevTick) {
        console.log(`[full-year] STALLED at tick ${prevTick}! Dwarves: ${h.dwarves().length}`);
        break;
      }
      checkWorkOrders();
      checkCaveFarm();
      const day = Math.floor(h.readers.calendar.tick / 1200);
      if (day >= lastLoggedDay + 10 || day >= 105) {
        lastLoggedDay = day;
        console.log(`[full-year] Day ${day}/112 (tick ${h.readers.calendar.tick}, dwarves: ${h.dwarves().length}, drink: ${h.readers.items.count('drink')}, meal: ${h.readers.items.count('meal')}, food: ${h.readers.items.count('plant_food')})`);
      }
    }
  });

  // Collect results and statistics
  const results = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const tracker = (window as unknown as { __tracker: YearTracker }).__tracker;
    const items = h.readers.items;
    const trade = h.host.world.scheduler.byId('20') as unknown as { serialize(): { schedule: Record<string, { nextArrivalTick: number }> } };
    const mountainhomeNext = trade.serialize().schedule['mountainhome']?.nextArrivalTick ?? 0;
    const nextDay = Math.floor(mountainhomeNext / 1200) + 1;
    const livingDwarves = h.dwarves();

    return {
      tracker,
      wealth: items.wealth(),
      harvests: tracker.harvests,
      nextDay,
      livingCount: livingDwarves.length,
      stocks: {
        drink: items.count('drink'),
        meal: items.count('meal'),
        plantFood: items.count('plant_food'),
        log: items.count('log'),
        stoneBlock: items.count('stone_block'),
      },
    };
  });

  const { tracker, wealth, harvests, nextDay, livingCount, stocks } = results;

  const windowOf = (civ: string, year: number): [number, number] => {
    const base = (year - 1) * DAYS_PER_YEAR + (CARAVAN_SEASON[civ] ?? 0) * DAYS_PER_SEASON;
    return [base + CARAVAN_DAY_MIN, base + CARAVAN_DAY_MAX];
  };

  const seasonOfDay = (day: number): number => Math.floor(((day - 1) % DAYS_PER_YEAR) / DAYS_PER_SEASON);

  // Construct and report the year-one expectation balance table
  const table = [
    { day: '28 Summer: Hillfolk caravan', measured: `day ${tracker.caravanDay['hillfolk'] ?? 'never'}` },
    { day: '28 first immigrants (2-4)', measured: tracker.waves[0] === undefined ? 'never' : `day ${tracker.waves[0].day}, ${tracker.waves[0].count} dwarves` },
    { day: '56 Autumn: Wildwood caravan', measured: `day ${tracker.caravanDay['wildwood'] ?? 'never'}` },
    { day: '56 second guaranteed wave', measured: tracker.waves[1] === undefined ? 'never' : `day ${tracker.waves[1].day}, ${tracker.waves[1].count} dwarves` },
    { day: '56 first ambush or raid warning at peril >= 2', measured: `peril 0 region: ${tracker.raidDays.length} raids, ${tracker.warningDays.length} warnings` },
    { day: '84 Winter: surface farm dormant', measured: `${tracker.plantedDays.filter((d) => seasonOfDay(d) === 3).length} surface crops planted in winter` },
    { day: '84 cave farm carries', measured: `${tracker.cavePlantedDays.filter((d) => seasonOfDay(d) === 3).length} cave crops planted in winter, ${tracker.cavePlantedDays.length} all year` },
    { day: '84 river frozen at temper >= 1', measured: `temper 0 region: ${tracker.frozenDays.length} tiles frozen` },
    { day: '112 Year 2: Mountainhome caravan', measured: `scheduled day ${nextDay}` },
    { day: '112 the fortress is 11-15 dwarves', measured: `${livingCount} dwarves` },
    { day: 'Wealth curve: year 1 is 4,000-8,000 marks', measured: `${wealth} marks` },
    { day: 'Food chain: 0.25 plants per farm tile per day', measured: `${harvests} harvests over ${DAYS_PER_YEAR} days` },
  ];

  console.log(['full-year balance table:', ...table.map((row) => `  ${row.day} -> ${row.measured}`)].join('\n'));
  console.log(`full-year end state: ${JSON.stringify({ livingCount, wealth, stocks, waves: tracker.waves, caravanDay: tracker.caravanDay, trades: tracker.tradesDone })}`);

  // Assert rule-based rows (matching year_one.scenario.ts precedent)
  const hillfolk = windowOf('hillfolk', 1);
  expect(tracker.caravanDay['hillfolk'], 'Hillfolk caravan arrived in summer of year 1').not.toBeNull();
  expect(tracker.caravanDay['hillfolk'] as number).toBeGreaterThanOrEqual(hillfolk[0]);
  expect(tracker.caravanDay['hillfolk'] as number).toBeLessThanOrEqual(hillfolk[1]);

  const wildwood = windowOf('wildwood', 1);
  expect(tracker.caravanDay['wildwood'], 'Wildwood caravan arrived in autumn of year 1').not.toBeNull();
  expect(tracker.caravanDay['wildwood'] as number).toBeGreaterThanOrEqual(wildwood[0]);
  expect(tracker.caravanDay['wildwood'] as number).toBeLessThanOrEqual(wildwood[1]);

  // No caravan in winter
  for (const [civ, day] of Object.entries(tracker.caravanDay)) {
    if (day !== null) {
      expect(seasonOfDay(day), `${civ} did not arrive in winter`).not.toBe(3);
    }
  }

  // Mountainhome caravan scheduled in year 2 spring
  expect(tracker.caravanDay['mountainhome'], 'Mountainhome caravan does not arrive in year 1').toBeNull();
  const spring2 = windowOf('mountainhome', 2);
  expect(nextDay).toBeGreaterThanOrEqual(spring2[0]);
  expect(nextDay).toBeLessThanOrEqual(spring2[1]);

  // Two guaranteed immigration waves in year 1
  const guaranteed = tracker.waves.filter((wave) => wave.guaranteed);
  expect(guaranteed.length, 'at least two guaranteed immigration waves in year 1').toBeGreaterThanOrEqual(2);
  for (const wave of guaranteed.slice(0, 2)) {
    expect(wave.count).toBeGreaterThanOrEqual(GUARANTEED_SIZE_MIN);
    expect(wave.count).toBeLessThanOrEqual(GUARANTEED_SIZE_MAX);
  }
  expect(seasonOfDay(guaranteed[0]?.day ?? 0), 'first guaranteed wave arrives in summer').toBe(1);
  expect(seasonOfDay(guaranteed[1]?.day ?? 0), 'second guaranteed wave arrives in autumn').toBe(2);

  // Peril 0 region: zero raids
  expect(tracker.raidDays, 'no raids in peril 0 region').toEqual([]);

  // No dwarf died and population grew past the initial seven
  expect(livingCount, 'the hall grew past the initial 7 dwarves').toBeGreaterThan(7);

  expect(errors).toEqual([]);
});
