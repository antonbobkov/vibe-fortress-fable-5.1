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
  const map = w.map;

  // 1. Water spring
  const granite = w.game.registry.table('materials').index('granite');
  const terrain = w.game.world.services.terrain;
  terrain.setKind(w.index(cx + 9, cy + 3, Z), TileKind.Wall, granite);
  terrain.setKind(w.index(cx + 7, cy + 3, Z), TileKind.Wall, granite);
  terrain.setKind(w.index(cx + 8, cy + 4, Z), TileKind.Wall, granite);
  terrain.setKind(w.index(cx + 8, cy + 2, Z), TileKind.Wall, granite);
  w.setFluid(w.index(cx + 8, cy + 3, Z), 7, 'water', true);

  // Pine grove on surface for woodcutting (balance.md wood chain)
  const pine = w.game.registry.table('materials').index('pine');
  const treeTiles: number[] = [];
  for (let y = cy + 22; y <= cy + 26; y += 1) {
    for (let x = cx - 18; x <= cx - 14; x += 1) {
      if (x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1) {
        const t = w.index(x, y, Z);
        terrain.setKind(t, TileKind.Tree, pine);
        treeTiles.push(t);
      }
    }
  }
  if (treeTiles.length > 0) {
    w.game.world.applyCommand({ type: 'Designate', kind: 'chop', priority: 4, tiles: treeTiles });
  }

  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

  // 2. Stockpile (8x6)
  const spTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 9; y += 1) {
    for (let x = cx - 5; x <= cx + 2; x += 1) {
      if (x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1) {
        const t = w.index(x, y, Z);
        if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('stockpile', t)) {
          spTiles.push(t);
        }
      }
    }
  }
  const rSp = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'stockpile', tiles: spTiles });
  if (!rSp.ok) throw new Error(`Stockpile CreateZone failed: ${rSp.reason}`);
  const spId = bSystem.lastCreatedZone;
  const rFilter = w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: spId, filter: 'everything' });
  if (!rFilter.ok) throw new Error(`SetStockpileFilter failed: ${rFilter.reason}`);

  // Labor priorities: survival (farming, cooking, brewing) always precedes construction/hauling
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'farming', priority: 1 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'cooking', priority: 1 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'brewing', priority: 2 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'carpentry', priority: 4 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'masonry', priority: 4 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'crafts', priority: 4 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'mining', priority: 5 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'hauling', priority: 6 });

  // 3. Stairwell to rock layer (z = 29) - priority 2 so miners dig stairs first!
  const rStairs = w.game.world.applyCommand({ type: 'DesignateStairwell', x: cx + 6, y: cy + 6, zTop: 32, zBottom: 29, priority: 2 });
  if (!rStairs.ok) throw new Error(`DesignateStairwell failed: ${rStairs.reason}`);

  // 4. Cave farm at z = 31 (designated at Day 0, priority 2 so food grows early!)
  const caveTiles1: number[] = [];
  const caveTiles2: number[] = [];
  for (let y = cy + 4; y <= cy + 7; y += 1) {
    for (let x = cx + 7; x <= cx + 10; x += 1) {
      if (x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1) caveTiles1.push(w.index(x, y, Z - 1));
    }
    for (let x = cx + 11; x <= cx + 14; x += 1) {
      if (x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1) caveTiles2.push(w.index(x, y, Z - 1));
    }
  }
  const rCaveDig = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 2, tiles: [...caveTiles1, ...caveTiles2] });
  if (!rCaveDig.ok) throw new Error(`Designate cave farm dig failed: ${rCaveDig.reason}`);
  let caveFarmId1 = 0;
  let caveFarmId2 = 0;

  // 5. Underground designations at z = 29 (balance.md layout)
  // Central corridors
  const corridorTiles: number[] = [];
  corridorTiles.push(w.index(cx + 5, cy + 6, 29));
  corridorTiles.push(w.index(cx + 7, cy + 6, 29));
  const southYMax = Math.min(map.h - 3, cy + 25);
  for (let y = cy + 7; y <= southYMax; y += 1) corridorTiles.push(w.index(cx + 6, y, 29));

  // Hearth Hall (5x5): x: cx + 8..cx + 12, y: cy + 4..cy + 8
  const hearthHallTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 8; y += 1) {
    for (let x = cx + 8; x <= cx + 12; x += 1) {
      hearthHallTiles.push(w.index(x, y, 29));
    }
  }

  // Dining Hall (5x5): x: cx..cx + 4, y: cy + 4..cy + 8
  const diningHallTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 8; y += 1) {
    for (let x = cx; x <= cx + 4; x += 1) {
      diningHallTiles.push(w.index(x, y, 29));
    }
  }

  // 8 Bedrooms (3x3 each) going south along corridor
  interface BedroomPlan {
    readonly x1: number;
    readonly x2: number;
    readonly y1: number;
    readonly y2: number;
    readonly doorX: number;
    readonly doorY: number;
    readonly bedX: number;
    readonly bedY: number;
    tiles: number[];
    setup: boolean;
  }
  const bedroomPlans: BedroomPlan[] = [
    // Pair 1
    { x1: cx + 2, x2: cx + 4, y1: cy + 10, y2: cy + 12, doorX: cx + 5, doorY: cy + 11, bedX: cx + 2, bedY: cy + 11, tiles: [], setup: false },
    { x1: cx + 8, x2: cx + 10, y1: cy + 10, y2: cy + 12, doorX: cx + 7, doorY: cy + 11, bedX: cx + 10, bedY: cy + 11, tiles: [], setup: false },
    // Pair 2
    { x1: cx + 2, x2: cx + 4, y1: cy + 14, y2: cy + 16, doorX: cx + 5, doorY: cy + 15, bedX: cx + 2, bedY: cy + 15, tiles: [], setup: false },
    { x1: cx + 8, x2: cx + 10, y1: cy + 14, y2: cy + 16, doorX: cx + 7, doorY: cy + 15, bedX: cx + 10, bedY: cy + 15, tiles: [], setup: false },
    // Pair 3
    { x1: cx + 2, x2: cx + 4, y1: cy + 18, y2: cy + 20, doorX: cx + 5, doorY: cy + 19, bedX: cx + 2, bedY: cy + 19, tiles: [], setup: false },
    { x1: cx + 8, x2: cx + 10, y1: cy + 18, y2: cy + 20, doorX: cx + 7, doorY: cy + 19, bedX: cx + 10, bedY: cy + 19, tiles: [], setup: false },
    // Pair 4
    { x1: cx + 2, x2: cx + 4, y1: cy + 22, y2: cy + 24, doorX: cx + 5, doorY: cy + 23, bedX: cx + 2, bedY: cy + 23, tiles: [], setup: false },
    { x1: cx + 8, x2: cx + 10, y1: cy + 22, y2: cy + 24, doorX: cx + 7, doorY: cy + 23, bedX: cx + 10, bedY: cy + 23, tiles: [], setup: false },
  ];

  const hallDigTiles: number[] = [...corridorTiles, ...hearthHallTiles, ...diningHallTiles];
  const rDigHalls = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 3, tiles: hallDigTiles });
  if (!rDigHalls.ok) throw new Error(`Designate hall dig failed: ${rDigHalls.reason}`);

  const bedroomDigTiles: number[] = [];
  for (const bp of bedroomPlans) {
    if (bp.doorX >= 1 && bp.doorX < map.w - 1 && bp.doorY >= 1 && bp.doorY < map.h - 1) {
      bedroomDigTiles.push(w.index(bp.doorX, bp.doorY, 29));
    }
    for (let y = bp.y1; y <= bp.y2; y += 1) {
      for (let x = bp.x1; x <= bp.x2; x += 1) {
        if (x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1) {
          const t = w.index(x, y, 29);
          bp.tiles.push(t);
          bedroomDigTiles.push(t);
        }
      }
    }
  }
  const rDigBedrooms = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 5, tiles: bedroomDigTiles });
  if (!rDigBedrooms.ok) throw new Error(`Designate bedroom dig failed: ${rDigBedrooms.reason}`);

  // 6. Surface workshops (carpenter, mason, still, kitchen, craftdwarf)
  const toPlace = [
    { type: 'carpenter', origin: w.index(cx - 8, cy + 10, Z) },
    { type: 'mason', origin: w.index(cx - 4, cy + 10, Z) },
    { type: 'still', origin: w.index(cx, cy + 10, Z) },
    { type: 'kitchen', origin: w.index(cx + 4, cy + 10, Z) },
    { type: 'craftdwarf', origin: w.index(cx + 8, cy + 10, Z) },
  ];
  const placedIds: Record<string, number> = {};
  for (const p of toPlace) {
    if (buildings.ghost(p.type, p.origin, 0).reason !== null) continue;
    const r = w.game.world.applyCommand({
      type: 'PlaceBuilding',
      buildingType: p.type,
      origin: p.origin,
      orientation: 0,
      materialChoice: 0,
    });
    if (r.ok) placedIds[p.type] = bSystem.lastPlacedBuilding;
  }

  // 7. Temporary surface meeting area
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

  // 8. Surface barley and turnip farm
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
    w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 2, speciesId: 'turnip' });
  }

  // 9. Surface pasture for grazers
  const pastureTiles: number[] = [];
  for (let y = cy + 16; y <= cy + 19; y += 1) {
    for (let x = cx + 2; x <= cx + 6; x += 1) {
      const t = w.index(x, y, Z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('pasture', t)) pastureTiles.push(t);
    }
  }
  const rPasture = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'pasture', tiles: pastureTiles });
  if (rPasture.ok) {
    const pastureId = bSystem.lastCreatedZone;
    for (const id of w.game.world.entities.with(C.Tame)) {
      w.game.world.applyCommand({ type: 'AssignPasture', animalId: id, zoneId: pastureId });
    }
  }

  // Work order setup helper
  const ordered = new Set<string>();
  const checkWorkOrders = (): void => {
    if (!ordered.has('carpenter') && buildings.get(placedIds['carpenter']!)?.state === 'built') {
      ordered.add('carpenter');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['carpenter'],
        order: { recipeId: 'make_barrel', mode: 'maintain', threshold: 15 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['carpenter'],
        order: { recipeId: 'make_bed', mode: 'maintain', threshold: 14 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['carpenter'],
        order: { recipeId: 'make_table_wood', mode: 'maintain', threshold: 4 },
      });
    }
    if (!ordered.has('mason') && buildings.get(placedIds['mason']!)?.state === 'built') {
      ordered.add('mason');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['mason'],
        order: { recipeId: 'make_stone_block', mode: 'maintain', threshold: 20 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['mason'],
        order: { recipeId: 'make_door_stone', mode: 'maintain', threshold: 14 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['mason'],
        order: { recipeId: 'make_table_stone', mode: 'maintain', threshold: 4 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['mason'],
        order: { recipeId: 'make_chair_stone', mode: 'maintain', threshold: 8 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['mason'],
        order: { recipeId: 'make_statue', mode: 'maintain', threshold: 4 },
      });
    }
    if (!ordered.has('craftdwarf') && buildings.get(placedIds['craftdwarf']!)?.state === 'built') {
      ordered.add('craftdwarf');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['craftdwarf'],
        order: { recipeId: 'craft_stone', mode: 'maintain', threshold: 20 },
      });
    }
    if (!ordered.has('still') && buildings.get(placedIds['still']!)?.state === 'built') {
      ordered.add('still');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['still'],
        order: { recipeId: 'brew', mode: 'maintain', threshold: 30 },
      });
    }
    if (!ordered.has('kitchen') && buildings.get(placedIds['kitchen']!)?.state === 'built') {
      ordered.add('kitchen');
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['kitchen'],
        order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 20 },
      });
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId: placedIds['kitchen'],
        order: { recipeId: 'cook_fine_meal', mode: 'maintain', threshold: 10 },
      });
    }
  };

  // Helper: smooth room floors and bordering stone walls
  const designateSmooth = (tiles: readonly number[]): void => {
    const smoothTiles: number[] = [...tiles];
    for (const t of tiles) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const n = w.map.offset(t, dx, dy, 0);
          if (n >= 0 && w.map.kindAt(n) === TileKind.Wall && !smoothTiles.includes(n)) {
            smoothTiles.push(n);
          }
        }
      }
    }
    w.game.world.applyCommand({ type: 'Designate', kind: 'smooth', priority: 6, tiles: smoothTiles });
  };

  let hearthHallSetup = false;
  let diningHallSetup = false;

  const checkUndergroundRooms = (): void => {
    // Hearth Hall setup
    if (!hearthHallSetup && hearthHallTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
      hearthHallSetup = true;
      const hearthOrigin = w.index(cx + 10, cy + 6, 29);
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'hearth', origin: hearthOrigin, orientation: 0, materialChoice: 0 });
      w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'hearth_hall', tiles: hearthHallTiles });
      w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'meeting_area', tiles: hearthHallTiles });
      designateSmooth(hearthHallTiles);
    }

    // Dining Hall setup - only place tables once kitchen is built (kitchen needs the embark table!)
    const kitchenBuilt = buildings.get(placedIds['kitchen']!)?.state === 'built';
    if (!diningHallSetup && kitchenBuilt && diningHallTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
      diningHallSetup = true;
      const t1 = w.index(cx + 2, cy + 5, 29);
      const c1 = w.index(cx + 1, cy + 5, 29);
      const c2 = w.index(cx + 3, cy + 5, 29);
      const t2 = w.index(cx + 2, cy + 7, 29);
      const c3 = w.index(cx + 1, cy + 7, 29);
      const c4 = w.index(cx + 3, cy + 7, 29);
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'table', origin: t1, orientation: 0, materialChoice: 0 });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c1, orientation: 0, materialChoice: 0 });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c2, orientation: 0, materialChoice: 0 });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'table', origin: t2, orientation: 0, materialChoice: 0 });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c3, orientation: 0, materialChoice: 0 });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c4, orientation: 0, materialChoice: 0 });
      w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'dining_hall', tiles: diningHallTiles });
      designateSmooth(diningHallTiles);
    }

    // Bedrooms setup
    for (const bp of bedroomPlans) {
      if (!bp.setup && bp.tiles.length > 0 && bp.tiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
        const doorOrigin = w.index(bp.doorX, bp.doorY, 29);
        if (w.map.kindAt(doorOrigin) !== TileKind.Floor) continue;
        bp.setup = true;
        // Do not place doors at bedroom entrances to prevent creature collision blocks
        const bedOrigin = w.index(bp.bedX, bp.bedY, 29);
        w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bedOrigin, orientation: 0, materialChoice: 0 });
        w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'bedroom', tiles: bp.tiles });
        designateSmooth(bp.tiles);
      }
    }
  };

  const checkCaveFarm = (): void => {
    const allFloors = [...caveTiles1, ...caveTiles2].every((t) => w.map.kindAt(t) === TileKind.Floor);
    if (!allFloors) return;
    if (caveFarmId1 === 0) {
      const plantable1 = caveTiles1.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
      if (plantable1.length > 0) {
        const c1 = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: plantable1 });
        if (c1.ok) {
          caveFarmId1 = bSystem.lastCreatedZone;
          for (const s of [0, 1, 2, 3]) {
            w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: caveFarmId1, season: s, speciesId: 'dimcap' });
          }
        }
      }
    }
    if (caveFarmId2 === 0) {
      const plantable2 = caveTiles2.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
      if (plantable2.length > 0) {
        const c2 = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: plantable2 });
        if (c2.ok) {
          caveFarmId2 = bSystem.lastCreatedZone;
          for (const s of [0, 1, 2, 3]) {
            w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: caveFarmId2, season: s, speciesId: 'sweetroot' });
          }
        }
      }
    }
  };

  // Advance bootstrap period (20 days)
  const totalTicksBootstrap = 20 * TICKS_PER_DAY;
  while (w.tick < totalTicksBootstrap) {
    w.step(Math.min(100, totalTicksBootstrap - w.tick));
    checkWorkOrders();
    checkUndergroundRooms();
    checkCaveFarm();
  }

  // Depot
  for (const at of [w.index(cx - 9, cy + 4, Z), w.index(cx - 9, cy + 8, Z), w.index(cx + 8, cy + 14, Z)]) {
    if (buildings.ghost('trade_depot', at, 0).reason !== null) continue;
    const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: at, orientation: 0, materialChoice: 0 });
    if (placed.ok) break;
  }
  w.game.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'anvil', priority: 1 }] });

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

    w.step(Math.min(300, totalTicks - w.tick));
    checkWorkOrders();
    checkUndergroundRooms();
    checkCaveFarm();

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
