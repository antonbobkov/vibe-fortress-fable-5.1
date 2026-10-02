/**
 * 20-seed sweep across three regions (peril 0, 2, 4) for T-M8-06 (DECISIONS D-204).
 *
 * Runs the full 3-year fortress simulation across 20 seeds:
 * - 7 seeds at Peril 0 (serene_vale peaceful baseline)
 * - 7 seeds at Peril 2 (moderate danger: ambushes in Y1, raids in Y2-Y3)
 * - 6 seeds at Peril 4 (high danger: early thieves/raids, sieges in Y2)
 *
 * Placed in the performance tier (test:perf) as year_one_seeds is, keeping the standard
 * scenario suite runtime reasonable while verifying balance and deterministic guarantees.
 */

import { describe, it, expect } from 'vitest';
import { buildFlatTestMap, FLAT_TEST_SURFACE_Z, regionSpec } from '@app/headless';
import { DAYS_PER_YEAR, TICKS_PER_DAY, POPULATION_CAP_DEFAULT, MOOD_MIN } from '@core/constants';
import { TileKind } from '@core/map3d';
import { C } from '@core/components';
import { NEED_PRESSURE_CAP, MOOD_NEEDS_MET_FLOOR } from '@systems/morale/mood';
import { WAVE_MAX } from '@systems/immigration/constants';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';
import { deathCounts } from '../scenarios/death-counts';

const Z = FLAT_TEST_SURFACE_Z;

export interface SeedConfig {
  readonly seed: string;
  readonly peril: number;
}

export const THREE_YEARS_20_SEEDS: readonly SeedConfig[] = [
  // 7 seeds at Peril 0
  { seed: 'three-years-p0-1', peril: 0 },
  { seed: 'three-years-p0-2', peril: 0 },
  { seed: 'three-years-p0-3', peril: 0 },
  { seed: 'three-years-p0-4', peril: 0 },
  { seed: 'three-years-p0-5', peril: 0 },
  { seed: 'three-years-p0-6', peril: 0 },
  { seed: 'three-years-p0-7', peril: 0 },
  // 7 seeds at Peril 2
  { seed: 'three-years-p2-1', peril: 2 },
  { seed: 'three-years-p2-2', peril: 2 },
  { seed: 'three-years-p2-3', peril: 2 },
  { seed: 'three-years-p2-4', peril: 2 },
  { seed: 'three-years-p2-5', peril: 2 },
  { seed: 'three-years-p2-6', peril: 2 },
  { seed: 'three-years-p2-7', peril: 2 },
  // 6 seeds at Peril 4
  { seed: 'three-years-p4-1', peril: 4 },
  { seed: 'three-years-p4-2', peril: 4 },
  { seed: 'three-years-p4-3', peril: 4 },
  { seed: 'three-years-p4-4', peril: 4 },
  { seed: 'three-years-p4-5', peril: 4 },
  { seed: 'three-years-p4-6', peril: 4 },
] as const;

export interface ThreeYearsSeedResult {
  readonly seed: string;
  readonly peril: number;
  readonly y1Pop: number;
  readonly y2Pop: number;
  readonly y3Pop: number;
  readonly y1Wealth: number;
  readonly y2Wealth: number;
  readonly y3Wealth: number;
  readonly dwarfDeaths: number;
  readonly tameDeaths: number;
  readonly wavesCount: number;
  readonly totalImmigrants: number;
  readonly raidsCount: number;
  readonly mealsEaten: number;
  readonly drinksDrunk: number;
  readonly extinctDay: number | null;
  readonly avgMood: string;
  readonly minMood: number;
  readonly maxMood: number;
}

export function runThreeYearsSeed(seed: string, peril: number): ThreeYearsSeedResult {
  const w = new TestWorld({
    seed,
    map: buildFlatTestMap(undefined, 48, 48),
    spec: regionSpec(seed, { peril }),
    embark: 'default',
  });

  const arrival = w.game.arrival;
  if (!arrival) throw new Error('no arrival');
  const { x: cx, y: cy } = arrival.wagon;

  // 1. Water spring
  const granite = w.game.registry.table('materials').index('granite');
  const terrain = w.game.world.services.terrain;
  terrain.setKind(w.index(cx + 9, cy + 3, Z), TileKind.Wall, granite);
  terrain.setKind(w.index(cx + 7, cy + 3, Z), TileKind.Wall, granite);
  terrain.setKind(w.index(cx + 8, cy + 4, Z), TileKind.Wall, granite);
  terrain.setKind(w.index(cx + 8, cy + 2, Z), TileKind.Wall, granite);
  w.setFluid(w.index(cx + 8, cy + 3, Z), 7, 'water', true);

  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

  // 2. Stockpile (6x4)
  const spTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 7; y += 1) {
    for (let x = cx - 3; x <= cx + 2; x += 1) {
      const t = w.index(x, y, Z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('stockpile', t)) {
        spTiles.push(t);
      }
    }
  }
  const rSp = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'stockpile', tiles: spTiles });
  if (!rSp.ok) throw new Error(`Stockpile CreateZone failed: ${rSp.reason}`);
  const spId = bSystem.lastCreatedZone;
  w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: spId, filter: 'everything' });

  // 3. Stairs
  w.game.world.applyCommand({ type: 'DesignateStairwell', x: cx + 6, y: cy + 6, zTop: 32, zBottom: 29 });

  // 4. Dig 5x5 room
  const roomTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 8; y += 1) {
    for (let x = cx + 7; x <= cx + 11; x += 1) {
      roomTiles.push(w.index(x, y, 29));
    }
  }
  w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 4, tiles: roomTiles });

  // 5. Workshops
  const toPlace = [
    { type: 'carpenter', origin: w.index(cx - 8, cy + 10, Z) },
    { type: 'mason', origin: w.index(cx - 4, cy + 10, Z) },
    { type: 'still', origin: w.index(cx, cy + 10, Z) },
    { type: 'kitchen', origin: w.index(cx + 4, cy + 10, Z) },
    { type: 'hearth', origin: w.index(cx - 1, cy + 15, Z) },
  ];
  const placedIds: Record<string, number> = {};
  for (const p of toPlace) {
    if (buildings.ghost(p.type, p.origin, 0).reason === null) {
      const r = w.game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: p.type,
        origin: p.origin,
        orientation: 0,
        materialChoice: 0,
      });
      if (r.ok) placedIds[p.type] = bSystem.lastPlacedBuilding;
    }
  }

  // 6. Meeting area
  const meetTiles: number[] = [];
  for (let y = cy + 16; y <= cy + 18; y += 1) {
    for (let x = cx - 3; x <= cx + 1; x += 1) {
      const t = w.index(x, y, Z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('meeting_area', t)) {
        meetTiles.push(t);
      }
    }
  }
  w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'meeting_area', tiles: meetTiles });

  // 7. Surface farm
  w.step(5);
  const farmTiles: number[] = [];
  for (let y = cy + 16; y <= cy + 19; y += 1) {
    for (let x = cx - 8; x <= cx - 5; x += 1) {
      const t = w.index(x, y, Z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t)) {
        farmTiles.push(t);
      }
    }
  }
  const rFarm = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: farmTiles });
  if (rFarm.ok) {
    const farmId = bSystem.lastCreatedZone;
    w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 0, speciesId: 'barley' });
    w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 1, speciesId: 'barley' });
  }

  // Bootstrap work orders (20 days)
  const ordered = new Set<string>();
  const totalTicksBootstrap = 20 * TICKS_PER_DAY;
  while (w.tick < totalTicksBootstrap) {
    w.step(Math.min(100, totalTicksBootstrap - w.tick));
    if (!ordered.has('mason') && buildings.get(placedIds['mason']!)?.state === 'built') {
      ordered.add('mason');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['mason'],
        order: { recipeId: 'make_stone_block', mode: 'once', remaining: 2 },
      });
    }
    if (!ordered.has('still') && buildings.get(placedIds['still']!)?.state === 'built') {
      ordered.add('still');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['still'],
        order: { recipeId: 'brew', mode: 'maintain', threshold: 20 },
      });
    }
    if (!ordered.has('kitchen') && buildings.get(placedIds['kitchen']!)?.state === 'built') {
      ordered.add('kitchen');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['kitchen'],
        order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 10 },
      });
    }
  }

  // Depot
  for (const at of [w.index(cx - 9, cy + 4, Z), w.index(cx - 9, cy + 8, Z), w.index(cx + 8, cy + 14, Z)]) {
    if (buildings.ghost('trade_depot', at, 0).reason !== null) continue;
    const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: at, orientation: 0, materialChoice: 0 });
    if (placed.ok) break;
  }
  w.game.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'anvil', priority: 1 }] });

  // Cave farm
  const caveTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 7; y += 1) {
    for (let x = cx + 7; x <= cx + 10; x += 1) {
      caveTiles.push(w.index(x, y, Z - 1));
    }
  }
  w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 4, tiles: caveTiles });
  let caveFarmId = 0;

  // Tracking
  const waves: { day: number; count: number; guaranteed: boolean }[] = [];
  const raids: { day: number; kind: string; size: number }[] = [];
  let mealsEaten = 0;
  let drinksDrunk = 0;

  const unsub = w.game.world.onEvents((events) => {
    const day = Math.floor(w.tick / TICKS_PER_DAY) + 1;
    for (const e of events) {
      if (e.type === 'ImmigrantsArrived') {
        waves.push({ day, count: Number(e['count'] ?? 0), guaranteed: e['guaranteed'] === true });
      } else if (e.type === 'RaidArrived') {
        raids.push({ day, kind: String(e['threatKind'] ?? 'raid'), size: Number(e['size'] ?? 0) });
      } else if (e.type === 'MealEaten') {
        mealsEaten += 1;
      } else if (e.type === 'DrankAlcohol' || e.type === 'DrankWater') {
        drinksDrunk += 1;
      }
    }
  });

  const totalTicks = 3 * DAYS_PER_YEAR * TICKS_PER_DAY;
  const year1Tick = DAYS_PER_YEAR * TICKS_PER_DAY;
  const year2Tick = 2 * DAYS_PER_YEAR * TICKS_PER_DAY;

  let y1Wealth = 0;
  let y2Wealth = 0;
  let y3Wealth = 0;
  let y1Pop = 0;
  let y2Pop = 0;
  let y3Pop = 0;
  let extinctDay: number | null = null;

  const items = w.readers.of<ItemsReader>('13');

  while (w.tick < totalTicks) {
    const living = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress');
    if (w.tick > totalTicksBootstrap && living.length === 0) {
      extinctDay = Math.floor(w.tick / TICKS_PER_DAY) + 1;
      break;
    }

    w.step(Math.min(600, totalTicks - w.tick));

    if (caveFarmId === 0 && caveTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
      const plantable = caveTiles.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
      if (plantable.length > 0) {
        const created = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: plantable });
        if (created.ok) {
          caveFarmId = bSystem.lastCreatedZone;
          for (const season of [0, 1, 2, 3]) {
            w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: caveFarmId, season, speciesId: 'dimcap' });
          }
        }
      } else {
        caveFarmId = -1;
      }
    }

    if (w.tick === year1Tick) {
      y1Wealth = items.wealth();
      y1Pop = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
    } else if (w.tick === year2Tick) {
      y2Wealth = items.wealth();
      y2Pop = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
    }
  }

  unsub();

  y3Wealth = items.wealth();
  const survivingDwarves = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress');
  y3Pop = survivingDwarves.length;

  const moods: number[] = [];
  let minMood = 100;
  let maxMood = 0;
  let sumMood = 0;

  for (const id of survivingDwarves) {
    const m = w.game.world.entities.get(id, C.Mood);
    if (!m) continue;
    const val = m.value;
    moods.push(val);
    if (val < minMood) minMood = val;
    if (val > maxMood) maxMood = val;
    sumMood += val;

    // Assert deterministic mood floor and thought caps for surviving dwarves
    expect(val).toBeGreaterThanOrEqual(MOOD_MIN);
    const needPressure = Math.min(
      NEED_PRESSURE_CAP,
      m.thoughts.reduce((sum, t) => sum + (t.baseValue < 0 ? Math.max(0, -t.baseValue) : 0), 0),
    );
    expect(val).toBeGreaterThanOrEqual(MOOD_NEEDS_MET_FLOOR - needPressure);
  }

  const deaths = deathCounts(w);
  const avgMood = moods.length > 0 ? (sumMood / moods.length).toFixed(1) : 'extinct';

  // Assert deterministic guarantees
  if (peril === 0) {
    expect(deaths.dwarf, `${seed} (peril 0) has 0 dwarf deaths`).toBe(0);
    expect(y3Pop, `${seed} (peril 0) grew past embark size`).toBeGreaterThan(7);
  }
  expect(y3Pop, `${seed} population within POPULATION_CAP_DEFAULT`).toBeLessThanOrEqual(POPULATION_CAP_DEFAULT);
  for (const wave of waves) {
    expect(wave.count, `${seed} wave size within WAVE_MAX`).toBeLessThanOrEqual(WAVE_MAX);
  }

  return {
    seed,
    peril,
    y1Pop,
    y2Pop,
    y3Pop,
    y1Wealth,
    y2Wealth,
    y3Wealth,
    dwarfDeaths: deaths.dwarf,
    tameDeaths: deaths.tame,
    wavesCount: waves.length,
    totalImmigrants: waves.reduce((sum, w) => sum + w.count, 0),
    raidsCount: raids.length,
    mealsEaten,
    drinksDrunk,
    extinctDay,
    avgMood,
    minMood: moods.length > 0 ? minMood : 0,
    maxMood: moods.length > 0 ? maxMood : 0,
  };
}

describe('T-M8-06 perf: three_years_seeds', () => {
  it.each(THREE_YEARS_20_SEEDS)('runs $seed (peril $peril) across 3 years', ({ seed, peril }) => {
    const res = runThreeYearsSeed(seed, peril);
    const line = `[three_years_seeds] ${res.seed} (peril ${res.peril}): pop=${res.y3Pop} (Y1:${res.y1Pop}, Y2:${res.y2Pop}), wealth=${res.y3Wealth} (Y1:${res.y1Wealth}, Y2:${res.y2Wealth}), deaths(dwarf=${res.dwarfDeaths}, tame=${res.tameDeaths}), waves=${res.wavesCount} (+${res.totalImmigrants} dw), raids=${res.raidsCount}, meals=${res.mealsEaten}, drinks=${res.drinksDrunk}, moodAvg=${res.avgMood}, extinct=${res.extinctDay ?? 'none'}`;
    console.log(line);
  });
});
