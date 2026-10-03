/**
 * Reusable instrument for T-M8-06: decomposes dwarf mood in the three_years simulation.
 *
 * Samples every living fortress dwarf daily across the 3-year run, measuring:
 * - mood, baseline, and the exact contribution of each active thought;
 * - need frequencies (% of dwarf-time at want level or worse);
 * - top positive and negative contributors;
 * - comparison between upgraded fortress and bare layout (2fcf0b6);
 * - confirmation across seeds.
 */

import { describe, it, expect } from 'vitest';
import { buildFlatTestMap, FLAT_TEST_SURFACE_Z, regionSpec } from '@app/headless';
import { DAYS_PER_YEAR, TICKS_PER_DAY, MOOD_BASELINE, MOOD_MIN } from '@core/constants';
import { TileKind } from '@core/map3d';
import { C } from '@core/components';
import { NEED_PRESSURE_CAP, MOOD_NEEDS_MET_FLOOR, POSITIVE_CAP, NEGATIVE_CAP, HEARTH_TIER_BONUS } from '@systems/morale/mood';
import { NEED_PRESSURE_THOUGHTS } from '@systems/morale/standing';
import type { MoraleReader } from '@systems/morale/reader';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import { WANT, type NeedName } from '@systems/dwarves/needs';
import { personalityBase } from '@systems/morale/thoughts';
import authoredThoughts from '@content/thoughts.json';
import { TestWorld } from '../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

export interface ThoughtRow {
  readonly id: string;
  readonly contentValue: string;
  readonly pctActive: number;
  readonly meanContribution: number;
  readonly meanValueWhenActive: number;
  readonly totalTicksActive: number;
}

export interface DayTraceEntry {
  readonly hour: number;
  readonly tick: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly mood: number;
  readonly needs: Record<string, number>;
  readonly thoughts: readonly { id: string; value: number }[];
  readonly activityNeed?: string;
  readonly activityPhase?: string;
}

export interface BuildingDiagnostics {
  readonly bedsTotal: number;
  readonly bedsBuilt: number;
  readonly bedsPlanned: number;
  readonly bedroomZones: number;
  readonly bedroomsOwned: number;
  readonly bedroomsRequirementsMet: number;
  readonly bedroomTiers: Record<number, number>;
  readonly tablesTotal: number;
  readonly tablesBuilt: number;
  readonly chairsTotal: number;
  readonly chairsBuilt: number;
  readonly hearthState: string;
  readonly hearthTier: number;
  readonly bedItemsInStock: number;
  readonly logItemsInStock: number;
  readonly barrelItemsInStock: number;
  readonly preparedMealsInStock: number;
  readonly rawPlantsInStock: number;
  readonly alcoholInStock: number;
}

export interface MoodDecompositionResult {
  readonly seed: string;
  readonly upgraded: boolean;
  readonly totalDwarfDays: number;
  readonly finalPop: number;
  readonly meanMood: number;
  readonly minMood: number;
  readonly maxMood: number;
  readonly moodBreakdown: Record<string, number>;
  readonly baseline: number;
  readonly meanHearthBonus: number;
  readonly meanPersonalityBase: number;
  readonly meanCapEffect: number;
  readonly meanFloorEffect: number;
  readonly thoughtRows: readonly ThoughtRow[];
  readonly needWants: Record<string, { pctAtWant: number; meanLevel: number }>;
  readonly eventCounts: { mealsEaten: number; drinksAlcohol: number; drinksWater: number };
  readonly dayTrace: readonly DayTraceEntry[];
  readonly buildingDiag?: BuildingDiagnostics | undefined;
}

export function runMoodDecomposition(seed: string, upgraded: boolean): MoodDecompositionResult {
  if (!upgraded) {
    return runBare2fcf0b6(seed);
  }
  return runUpgraded(seed);
}

function runBare2fcf0b6(seed: string): MoodDecompositionResult {
  const w = new TestWorld({
    seed,
    map: buildFlatTestMap(undefined, 48, 48),
    spec: regionSpec(seed, { peril: 0 }),
    embark: 'default',
  });

  const arrival = w.game.arrival;
  if (!arrival) throw new Error('three_years: no arrival');
  const { x: cx, y: cy } = arrival.wagon;
  const registry = w.game.registry;

  // 1. Water spring
  const granite = registry.table('materials').index('granite');
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

  // 3. Stairwell to rock layer
  const rStairs = w.game.world.applyCommand({ type: 'DesignateStairwell', x: cx + 6, y: cy + 6, zTop: 32, zBottom: 29 });
  if (!rStairs.ok) throw new Error(`DesignateStairwell failed: ${rStairs.reason}`);

  // 4. Dig 5x5 room at z = 29
  const roomTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 8; y += 1) {
    for (let x = cx + 7; x <= cx + 11; x += 1) {
      roomTiles.push(w.index(x, y, 29));
    }
  }
  const rDig = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 4, tiles: roomTiles });
  if (!rDig.ok) throw new Error(`Designate dig failed: ${rDig.reason}`);

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

  // Advance bootstrap period (20 days)
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

  // Trade depot
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

  return runSamplingLoop(w, seed, false, () => {
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
  });
}

function runUpgraded(seed: string): MoodDecompositionResult {
  const w = new TestWorld({
    seed,
    map: buildFlatTestMap(undefined, 48, 48),
    spec: regionSpec(seed, { peril: 0 }),
    embark: 'default',
  });

  const arrival = w.game.arrival;
  if (!arrival) throw new Error('no arrival');
  const { x: cx, y: cy } = arrival.wagon;
  const map = w.map;
  const registry = w.game.registry;

  // 1. Water spring
  const granite = registry.table('materials').index('granite');
  const terrain = w.game.world.services.terrain;
  terrain.setKind(w.index(cx + 9, cy + 3, Z), TileKind.Wall, granite);
  terrain.setKind(w.index(cx + 7, cy + 3, Z), TileKind.Wall, granite);
  terrain.setKind(w.index(cx + 8, cy + 4, Z), TileKind.Wall, granite);
  terrain.setKind(w.index(cx + 8, cy + 2, Z), TileKind.Wall, granite);
  w.setFluid(w.index(cx + 8, cy + 3, Z), 7, 'water', true);

  // Pine grove
  const pine = registry.table('materials').index('pine');
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

  // Stockpile (8x6)
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
  w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: spId, filter: 'everything' });

  // Labor priorities
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'farming', priority: 1 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'cooking', priority: 1 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'brewing', priority: 2 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'carpentry', priority: 4 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'masonry', priority: 4 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'crafts', priority: 4 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'mining', priority: 5 });
  w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'hauling', priority: 6 });

  interface BedroomPlan {
    readonly x1: number; readonly x2: number; readonly y1: number; readonly y2: number;
    readonly doorX: number; readonly doorY: number; readonly bedX: number; readonly bedY: number;
    tiles: number[]; setup: boolean;
  }
  const bedroomPlans: BedroomPlan[] = [
    { x1: cx + 2, x2: cx + 4, y1: cy + 10, y2: cy + 12, doorX: cx + 5, doorY: cy + 11, bedX: cx + 2, bedY: cy + 11, tiles: [], setup: false },
    { x1: cx + 8, x2: cx + 10, y1: cy + 10, y2: cy + 12, doorX: cx + 7, doorY: cy + 11, bedX: cx + 10, bedY: cy + 11, tiles: [], setup: false },
    { x1: cx + 2, x2: cx + 4, y1: cy + 14, y2: cy + 16, doorX: cx + 5, doorY: cy + 15, bedX: cx + 2, bedY: cy + 15, tiles: [], setup: false },
    { x1: cx + 8, x2: cx + 10, y1: cy + 14, y2: cy + 16, doorX: cx + 7, doorY: cy + 15, bedX: cx + 10, bedY: cy + 15, tiles: [], setup: false },
    { x1: cx + 2, x2: cx + 4, y1: cy + 18, y2: cy + 20, doorX: cx + 5, doorY: cy + 19, bedX: cx + 2, bedY: cy + 19, tiles: [], setup: false },
    { x1: cx + 8, x2: cx + 10, y1: cy + 18, y2: cy + 20, doorX: cx + 7, doorY: cy + 19, bedX: cx + 10, bedY: cy + 19, tiles: [], setup: false },
    { x1: cx + 2, x2: cx + 4, y1: cy + 22, y2: cy + 24, doorX: cx + 5, doorY: cy + 23, bedX: cx + 2, bedY: cy + 23, tiles: [], setup: false },
    { x1: cx + 8, x2: cx + 10, y1: cy + 22, y2: cy + 24, doorX: cx + 7, doorY: cy + 23, bedX: cx + 10, bedY: cy + 23, tiles: [], setup: false },
  ];

  const corridorTiles: number[] = [];
  corridorTiles.push(w.index(cx + 5, cy + 6, 29));
  corridorTiles.push(w.index(cx + 7, cy + 6, 29));
  const southYMax = Math.min(map.h - 3, cy + 25);
  for (let y = cy + 7; y <= southYMax; y += 1) corridorTiles.push(w.index(cx + 6, y, 29));

  const hearthHallTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 8; y += 1) {
    for (let x = cx + 8; x <= cx + 12; x += 1) hearthHallTiles.push(w.index(x, y, 29));
  }

  const diningHallTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 8; y += 1) {
    for (let x = cx; x <= cx + 4; x += 1) diningHallTiles.push(w.index(x, y, 29));
  }

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

  let caveFarmId1 = 0;
  let caveFarmId2 = 0;

  // Dig stairwell (priority 2)
  w.game.world.applyCommand({ type: 'DesignateStairwell', x: cx + 6, y: cy + 6, zTop: 32, zBottom: 29, priority: 2 });
  // Cave farm at z = 31 (priority 2)
  w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 2, tiles: [...caveTiles1, ...caveTiles2] });
  // Underground designations at z = 29
  w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 3, tiles: [...corridorTiles, ...hearthHallTiles, ...diningHallTiles] });
  const bedroomDigTiles: number[] = [];
  for (const bp of bedroomPlans) {
    if (bp.doorX >= 1 && bp.doorX < map.w - 1 && bp.doorY >= 1 && bp.doorY < map.h - 1) bedroomDigTiles.push(w.index(bp.doorX, bp.doorY, 29));
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
  w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 5, tiles: bedroomDigTiles });

  // Workshops
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
    const r = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: p.type, origin: p.origin, orientation: 0, materialChoice: 0 });
    if (r.ok) placedIds[p.type] = bSystem.lastPlacedBuilding;
  }

  // Temporary surface meeting area
  const meetTiles: number[] = [];
  for (let y = cy + 16; y <= cy + 18; y += 1) {
    for (let x = cx - 3; x <= cx + 1; x += 1) {
      const t = w.index(x, y, Z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('meeting_area', t)) meetTiles.push(t);
    }
  }
  w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'meeting_area', tiles: meetTiles });

  // Surface farm
  w.step(5);
  const farmTiles: number[] = [];
  for (let y = cy + 16; y <= cy + 19; y += 1) {
    for (let x = cx - 8; x <= cx - 5; x += 1) {
      const t = w.index(x, y, Z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t)) farmTiles.push(t);
    }
  }
  const rFarm = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: farmTiles });
  if (rFarm.ok) {
    const farmId = bSystem.lastCreatedZone;
    w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 0, speciesId: 'barley' });
    w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 1, speciesId: 'barley' });
    w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: farmId, season: 2, speciesId: 'turnip' });
  }

  // Surface pasture
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

  // Work orders
  const ordered = new Set<string>();
  const checkWorkOrders = (): void => {
    if (!ordered.has('carpenter') && buildings.get(placedIds['carpenter']!)?.state === 'built') {
      ordered.add('carpenter');
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['carpenter'], order: { recipeId: 'make_barrel', mode: 'maintain', threshold: 15 } });
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['carpenter'], order: { recipeId: 'make_bed', mode: 'maintain', threshold: 14 } });
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['carpenter'], order: { recipeId: 'make_table_wood', mode: 'maintain', threshold: 4 } });
    }
    if (!ordered.has('mason') && buildings.get(placedIds['mason']!)?.state === 'built') {
      ordered.add('mason');
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['mason'], order: { recipeId: 'make_stone_block', mode: 'maintain', threshold: 20 } });
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['mason'], order: { recipeId: 'make_door_stone', mode: 'maintain', threshold: 14 } });
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['mason'], order: { recipeId: 'make_table_stone', mode: 'maintain', threshold: 4 } });
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['mason'], order: { recipeId: 'make_chair_stone', mode: 'maintain', threshold: 8 } });
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['mason'], order: { recipeId: 'make_statue', mode: 'maintain', threshold: 4 } });
    }
    if (!ordered.has('craftdwarf') && buildings.get(placedIds['craftdwarf']!)?.state === 'built') {
      ordered.add('craftdwarf');
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['craftdwarf'], order: { recipeId: 'craft_stone', mode: 'maintain', threshold: 20 } });
    }
    if (!ordered.has('still') && buildings.get(placedIds['still']!)?.state === 'built') {
      ordered.add('still');
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['still'], order: { recipeId: 'brew', mode: 'maintain', threshold: 30 } });
    }
    if (!ordered.has('kitchen') && buildings.get(placedIds['kitchen']!)?.state === 'built') {
      ordered.add('kitchen');
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['kitchen'], order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 20 } });
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['kitchen'], order: { recipeId: 'cook_fine_meal', mode: 'maintain', threshold: 10 } });
    }
  };

  const designateSmooth = (tiles: readonly number[]): void => {
    const smoothTiles: number[] = [...tiles];
    for (const t of tiles) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const n = w.map.offset(t, dx, dy, 0);
          if (n >= 0 && w.map.kindAt(n) === TileKind.Wall && !smoothTiles.includes(n)) smoothTiles.push(n);
        }
      }
    }
    w.game.world.applyCommand({ type: 'Designate', kind: 'smooth', priority: 6, tiles: smoothTiles });
  };

  let hearthHallSetup = false;
  let diningHallSetup = false;

  const checkUndergroundRooms = (): void => {
    if (!hearthHallSetup && hearthHallTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
      hearthHallSetup = true;
      const hearthOrigin = w.index(cx + 10, cy + 6, 29);
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'hearth', origin: hearthOrigin, orientation: 0, materialChoice: 0 });
      w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'hearth_hall', tiles: hearthHallTiles });
      w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'meeting_area', tiles: hearthHallTiles });
      designateSmooth(hearthHallTiles);
    }
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
    for (const bp of bedroomPlans) {
      if (!bp.setup && bp.tiles.length > 0 && bp.tiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
        const doorOrigin = w.index(bp.doorX, bp.doorY, 29);
        if (w.map.kindAt(doorOrigin) !== TileKind.Floor) continue;
        bp.setup = true;
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
          for (const s of [0, 1, 2, 3]) w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: caveFarmId1, season: s, speciesId: 'dimcap' });
        }
      }
    }
    if (caveFarmId2 === 0) {
      const plantable2 = caveTiles2.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
      if (plantable2.length > 0) {
        const c2 = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: plantable2 });
        if (c2.ok) {
          caveFarmId2 = bSystem.lastCreatedZone;
          for (const s of [0, 1, 2, 3]) w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: caveFarmId2, season: s, speciesId: 'sweetroot' });
        }
      }
    }
  };

  // Bootstrap 20 days
  const totalTicksBootstrap = 20 * TICKS_PER_DAY;
  while (w.tick < totalTicksBootstrap) {
    w.step(Math.min(100, totalTicksBootstrap - w.tick));
    checkWorkOrders();
    checkUndergroundRooms();
    checkCaveFarm();
  }

  // Trade depot
  for (const at of [w.index(cx - 9, cy + 4, Z), w.index(cx - 9, cy + 8, Z), w.index(cx + 8, cy + 14, Z)]) {
    if (buildings.ghost('trade_depot', at, 0).reason !== null) continue;
    const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: at, orientation: 0, materialChoice: 0 });
    if (placed.ok) break;
  }
  w.game.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'anvil', priority: 1 }] });

  return runSamplingLoop(w, seed, true, () => {
    checkWorkOrders();
    checkUndergroundRooms();
    checkCaveFarm();
  });
}

function runSamplingLoop(w: TestWorld, seed: string, upgraded: boolean, onStep: () => void): MoodDecompositionResult {
  const registry = w.game.registry;
  const buildings = w.readers.of<BuildingsReader>('14');
  const morale = w.readers.of<MoraleReader>('15');
  const dwarves = w.readers.of<DwarvesReader>('10');

  let mealsEaten = 0;
  let drinksAlcohol = 0;
  let drinksWater = 0;
  w.game.world.onEvents((events) => {
    for (const e of events) {
      if (e.type === 'MealEaten') mealsEaten += 1;
      else if (e.type === 'DrankAlcohol') drinksAlcohol += 1;
      else if (e.type === 'DrankWater') drinksWater += 1;
    }
  });

  let totalDwarfDays = 0;
  let sumMood = 0;
  let minMood = 100;
  let maxMood = 0;
  const moodBreakdown: Record<string, number> = { Fine: 0, Content: 0, Happy: 0, Unhappy: 0, Miserable: 0, Ecstatic: 0 };

  let sumHearthBonus = 0;
  let sumPersonalityBase = 0;
  let sumCapEffect = 0;
  let sumFloorEffect = 0;

  const thoughtActiveCount = new Map<string, number>();
  const thoughtSumContrib = new Map<string, number>();
  const thoughtSumValue = new Map<string, number>();

  const needWantCount = new Map<string, number>();
  const needSumLevel = new Map<string, number>();
  const needNames: readonly NeedName[] = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'];
  for (const n of needNames) {
    needWantCount.set(n, 0);
    needSumLevel.set(n, 0);
  }

  const TRACE_DWARF_INDEX = 0;
  let traceTargetDwarf = 0;
  const TRACE_START_TICK = 100 * TICKS_PER_DAY;
  const TRACE_END_TICK = 101 * TICKS_PER_DAY;
  const dayTrace: DayTraceEntry[] = [];

  const totalTicks = 3 * DAYS_PER_YEAR * TICKS_PER_DAY;
  let lastSampleDay = Math.floor(w.tick / TICKS_PER_DAY);

  const sampleDwarves = (): void => {
    const living = dwarves.list();
    const hearthTier = buildings.hearthHallTier();
    const hearthBonus = hearthTier * HEARTH_TIER_BONUS;

    for (const id of living) {
      totalDwarfDays += 1;
      const moodVal = morale.mood(id);
      sumMood += moodVal;
      if (moodVal < minMood) minMood = moodVal;
      if (moodVal > maxMood) maxMood = moodVal;

      if (moodVal < 20) moodBreakdown['Miserable'] = (moodBreakdown['Miserable'] ?? 0) + 1;
      else if (moodVal < 40) moodBreakdown['Unhappy'] = (moodBreakdown['Unhappy'] ?? 0) + 1;
      else if (moodVal < 60) moodBreakdown['Fine'] = (moodBreakdown['Fine'] ?? 0) + 1;
      else if (moodVal < 75) moodBreakdown['Content'] = (moodBreakdown['Content'] ?? 0) + 1;
      else if (moodVal < 90) moodBreakdown['Happy'] = (moodBreakdown['Happy'] ?? 0) + 1;
      else moodBreakdown['Ecstatic'] = (moodBreakdown['Ecstatic'] ?? 0) + 1;

      sumHearthBonus += hearthBonus;

      const traits = w.game.world.entities.get(id, C.Personality)?.traits ?? [];
      const pBase = personalityBase(registry, traits);
      sumPersonalityBase += pBase;

      const needs = w.game.world.entities.get(id, C.Needs);
      if (needs) {
        for (const n of needNames) {
          const val = needs[n];
          needSumLevel.set(n, (needSumLevel.get(n) ?? 0) + val);
          if (val >= WANT[n]) {
            needWantCount.set(n, (needWantCount.get(n) ?? 0) + 1);
          }
        }
      }

      const thList = morale.thoughts(id);
      let rawPos = 0;
      let rawNeg = 0;
      let rawNeedPressure = 0;

      for (const th of thList) {
        const tid = th.id;
        const val = th.value;
        thoughtActiveCount.set(tid, (thoughtActiveCount.get(tid) ?? 0) + 1);
        thoughtSumValue.set(tid, (thoughtSumValue.get(tid) ?? 0) + val);

        let contrib = 0;
        if (val > 0) {
          rawPos += val;
          contrib = val;
        } else if (val < 0) {
          rawNeg += -val;
          const isNeedPressure = NEED_PRESSURE_THOUGHTS.has(tid);
          if (isNeedPressure) {
            rawNeedPressure += -val;
            contrib = 2 * val;
          } else {
            contrib = val;
          }
        }
        thoughtSumContrib.set(tid, (thoughtSumContrib.get(tid) ?? 0) + contrib);
      }

      const cappedPos = Math.min(POSITIVE_CAP, rawPos);
      const cappedNeg = Math.min(NEGATIVE_CAP, rawNeg);
      const cappedNP = Math.floor(Math.min(NEED_PRESSURE_CAP, rawNeedPressure));

      const raw = MOOD_BASELINE + cappedPos - cappedNeg - cappedNP + hearthBonus + pBase;
      const floor = MOOD_NEEDS_MET_FLOOR - cappedNP;
      const clamped = Math.max(MOOD_MIN, Math.min(100, Math.max(raw, floor)));

      const uncappedRaw = MOOD_BASELINE + rawPos - rawNeg - rawNeedPressure + hearthBonus + pBase;
      const capEffect = raw - uncappedRaw;
      sumCapEffect += capEffect;

      const floorEffect = clamped - raw;
      sumFloorEffect += floorEffect;
    }
  };

  while (w.tick < totalTicks) {
    const isTraceWindow = w.tick >= TRACE_START_TICK && w.tick < TRACE_END_TICK;
    const stepSize = isTraceWindow ? 50 : (upgraded ? 300 : 600);
    w.step(Math.min(stepSize, totalTicks - w.tick));
    onStep();

    if (isTraceWindow) {
      if (traceTargetDwarf === 0) {
        traceTargetDwarf = dwarves.list()[TRACE_DWARF_INDEX] ?? 0;
      }
      if (traceTargetDwarf !== 0 && w.tick % 50 === 0) {
        const hour = Math.floor((w.tick % TICKS_PER_DAY) / 50);
        const pos = w.game.world.entities.get(traceTargetDwarf, C.Position);
        const md = morale.mood(traceTargetDwarf);
        const nds = w.game.world.entities.get(traceTargetDwarf, C.Needs);
        const ths = morale.thoughts(traceTargetDwarf).map((t) => ({ id: t.id, value: Math.round(t.value * 10) / 10 }));
        dayTrace.push({
          hour,
          tick: w.tick,
          x: pos?.x ?? 0,
          y: pos?.y ?? 0,
          z: pos?.z ?? 0,
          mood: Math.round(md * 10) / 10,
          needs: nds ? { hunger: Math.round(nds.hunger), thirst: Math.round(nds.thirst), rest: Math.round(nds.rest), social: Math.round(nds.social), comfort: Math.round(nds.comfort), purpose: Math.round(nds.purpose), joy: Math.round(nds.joy) } : {},
          thoughts: ths,
        });
      }
    }

    const currentDay = Math.floor(w.tick / TICKS_PER_DAY);
    if (currentDay > lastSampleDay) {
      sampleDwarves();
      lastSampleDay = currentDay;
    }
  }

  const authoredMap = new Map<string, string>();
  for (const def of (authoredThoughts as readonly { id: string; value: number | { formula: string } }[])) {
    if (typeof def.value === 'number') authoredMap.set(def.id, String(def.value));
    else if (typeof def.value === 'object' && 'formula' in def.value) authoredMap.set(def.id, def.value.formula);
  }

  const allThoughtIds = Array.from(thoughtActiveCount.keys()).sort();
  const thoughtRows: ThoughtRow[] = allThoughtIds.map((id) => {
    const activeDays = thoughtActiveCount.get(id) ?? 0;
    const sumContrib = thoughtSumContrib.get(id) ?? 0;
    const sumVal = thoughtSumValue.get(id) ?? 0;
    return {
      id,
      contentValue: authoredMap.get(id) ?? 'formula',
      pctActive: totalDwarfDays > 0 ? (activeDays / totalDwarfDays) * 100 : 0,
      meanContribution: totalDwarfDays > 0 ? sumContrib / totalDwarfDays : 0,
      meanValueWhenActive: activeDays > 0 ? sumVal / activeDays : 0,
      totalTicksActive: activeDays * TICKS_PER_DAY,
    };
  }).sort((a, b) => Math.abs(b.meanContribution) - Math.abs(a.meanContribution));

  const needWants: Record<string, { pctAtWant: number; meanLevel: number }> = {};
  for (const n of needNames) {
    const wants = needWantCount.get(n) ?? 0;
    const sumL = needSumLevel.get(n) ?? 0;
    needWants[n] = {
      pctAtWant: totalDwarfDays > 0 ? (wants / totalDwarfDays) * 100 : 0,
      meanLevel: totalDwarfDays > 0 ? sumL / totalDwarfDays : 0,
    };
  }

  const finalPop = dwarves.list().length;

  // Diagnostics for buildings and items
  let buildingDiag: BuildingDiagnostics | undefined;
  if (upgraded) {
    const beds = buildings.byType('bed');
    let bedsBuilt = 0;
    let bedsPlanned = 0;
    for (const bid of beds) {
      const b = buildings.get(bid);
      if (b?.state === 'built') bedsBuilt += 1;
      else bedsPlanned += 1;
    }
    const bedroomZones = buildings.zonesOfType('bedroom');
    let bedroomsOwned = 0;
    let bedroomsReqMet = 0;
    const bedroomTiers: Record<number, number> = {};
    for (const zid of bedroomZones) {
      const r = buildings.room(zid);
      if (r?.ownerId && r.ownerId !== 0) bedroomsOwned += 1;
      if (r?.requirementsMet) bedroomsReqMet += 1;
      const t = r?.tier ?? 0;
      bedroomTiers[t] = (bedroomTiers[t] ?? 0) + 1;
    }
    const tables = buildings.byType('table');
    const chairs = buildings.byType('chair');
    const hearthId = buildings.byType('hearth')[0] ?? 0;
    const hearth = buildings.get(hearthId);

    // Item counts
    const ent = w.game.world.entities;
    let bedItemsInStock = 0;
    let logItemsInStock = 0;
    let barrelItemsInStock = 0;
    let preparedMealsInStock = 0;
    let rawPlantsInStock = 0;
    let alcoholInStock = 0;

    const itemTable = registry.table('items');
    for (const iid of ent.with(C.Item)) {
      const it = ent.get(iid, C.Item);
      if (!it) continue;
      const def = itemTable.byIndex(it.type) as { id: string; category: string } | undefined;
      if (!def) continue;
      if (def.id === 'bed') bedItemsInStock += 1;
      if (def.id === 'log') logItemsInStock += 1;
      if (def.id === 'barrel') barrelItemsInStock += 1;
      if (def.category.startsWith('food/meal')) preparedMealsInStock += 1;
      if (def.category.startsWith('food/crop')) rawPlantsInStock += 1;
      if (def.category.startsWith('drink')) alcoholInStock += 1;
    }

    buildingDiag = {
      bedsTotal: beds.length,
      bedsBuilt,
      bedsPlanned,
      bedroomZones: bedroomZones.length,
      bedroomsOwned,
      bedroomsRequirementsMet: bedroomsReqMet,
      bedroomTiers,
      tablesTotal: tables.length,
      tablesBuilt: tables.filter((id) => buildings.get(id)?.state === 'built').length,
      chairsTotal: chairs.length,
      chairsBuilt: chairs.filter((id) => buildings.get(id)?.state === 'built').length,
      hearthState: hearth?.state ?? 'none',
      hearthTier: buildings.hearthHallTier(),
      bedItemsInStock,
      logItemsInStock,
      barrelItemsInStock,
      preparedMealsInStock,
      rawPlantsInStock,
      alcoholInStock,
    };
  }

  return {
    seed,
    upgraded,
    totalDwarfDays,
    finalPop,
    meanMood: totalDwarfDays > 0 ? sumMood / totalDwarfDays : 55,
    minMood,
    maxMood,
    moodBreakdown,
    baseline: MOOD_BASELINE,
    meanHearthBonus: totalDwarfDays > 0 ? sumHearthBonus / totalDwarfDays : 0,
    meanPersonalityBase: totalDwarfDays > 0 ? sumPersonalityBase / totalDwarfDays : 0,
    meanCapEffect: totalDwarfDays > 0 ? sumCapEffect / totalDwarfDays : 0,
    meanFloorEffect: totalDwarfDays > 0 ? sumFloorEffect / totalDwarfDays : 0,
    thoughtRows,
    needWants,
    eventCounts: { mealsEaten, drinksAlcohol, drinksWater },
    dayTrace,
    buildingDiag,
  };
}

describe('T-M8-06 mood breakdown instrument (perf tier)', () => {
  it('measures decomposition on upgraded main seed', () => {
    const res = runMoodDecomposition('three-years', true);

    console.log(`=== UPGRADED MAIN SEED (${res.seed}) ===`);
    console.log(`Dwarf-days: ${res.totalDwarfDays}, Final Pop: ${res.finalPop}`);
    console.log(`Mean mood: ${res.meanMood.toFixed(2)} (min: ${res.minMood.toFixed(1)}, max: ${res.maxMood.toFixed(1)})`);
    console.log(`Mood breakdown: Fine: ${res.moodBreakdown['Fine']}, Content: ${res.moodBreakdown['Content']}, Unhappy: ${res.moodBreakdown['Unhappy']}, Miserable: ${res.moodBreakdown['Miserable']}`);
    console.log(`Baseline: ${res.baseline.toFixed(2)}`);
    console.log(`Mean Hearth bonus: ${res.meanHearthBonus.toFixed(2)}`);
    console.log(`Mean Personality base: ${res.meanPersonalityBase.toFixed(2)}`);
    console.log(`Mean Cap effect: ${res.meanCapEffect.toFixed(2)}`);
    console.log(`Mean Floor effect: ${res.meanFloorEffect.toFixed(2)}`);
    console.log('--- THOUGHT DECOMPOSITION TABLE ---');
    console.log('Thought ID | Content Value | % Dwarf-time Active | Mean Contribution | Mean Val When Active');
    for (const row of res.thoughtRows) {
      console.log(`  ${row.id.padEnd(28)} | ${row.contentValue.padEnd(12)} | ${row.pctActive.toFixed(1).padStart(5)}% | ${row.meanContribution.toFixed(2).padStart(6)} | ${row.meanValueWhenActive.toFixed(2).padStart(6)}`);
    }
    console.log('--- NEED WANT FREQUENCIES ---');
    for (const [k, v] of Object.entries(res.needWants)) {
      console.log(`  ${k.padEnd(12)}: at want level ${v.pctAtWant.toFixed(1)}% of time (mean level ${v.meanLevel.toFixed(1)})`);
    }
    console.log(`Events: meals=${res.eventCounts.mealsEaten}, ale=${res.eventCounts.drinksAlcohol}, water=${res.eventCounts.drinksWater}`);

    if (res.buildingDiag) {
      console.log('--- BUILDING & ITEM DIAGNOSTICS ---');
      console.log(`Beds: total=${res.buildingDiag.bedsTotal}, built=${res.buildingDiag.bedsBuilt}, planned=${res.buildingDiag.bedsPlanned}`);
      console.log(`Bedrooms: zones=${res.buildingDiag.bedroomZones}, owned=${res.buildingDiag.bedroomsOwned}, reqMet=${res.buildingDiag.bedroomsRequirementsMet}, tiers=${JSON.stringify(res.buildingDiag.bedroomTiers)}`);
      console.log(`Tables: total=${res.buildingDiag.tablesTotal}, built=${res.buildingDiag.tablesBuilt}`);
      console.log(`Chairs: total=${res.buildingDiag.chairsTotal}, built=${res.buildingDiag.chairsBuilt}`);
      console.log(`Hearth: state=${res.buildingDiag.hearthState}, hallTier=${res.buildingDiag.hearthTier}`);
      console.log(`Stock: beds=${res.buildingDiag.bedItemsInStock}, logs=${res.buildingDiag.logItemsInStock}, barrels=${res.buildingDiag.barrelItemsInStock}, meals=${res.buildingDiag.preparedMealsInStock}, rawPlants=${res.buildingDiag.rawPlantsInStock}, alcohol=${res.buildingDiag.alcoholInStock}`);
    }

    console.log('--- TRACE SAMPLE (Day 100, Dwarf 0) ---');
    for (const t of res.dayTrace.slice(0, 10)) {
      console.log(`  h${t.hour} (${t.x},${t.y},z${t.z}) mood=${t.mood} needs=${JSON.stringify(t.needs)} thoughts=${t.thoughts.map((x) => `${x.id}(${x.value})`).join(', ')}`);
    }

    const sumThoughts = res.thoughtRows.reduce((s, r) => s + r.meanContribution, 0);
    const sumAll = res.baseline + res.meanHearthBonus + res.meanPersonalityBase + sumThoughts + res.meanCapEffect + res.meanFloorEffect;
    console.log(`Sanity check sum: ${sumAll.toFixed(2)} vs measured: ${res.meanMood.toFixed(2)}`);
    expect(Math.abs(sumAll - res.meanMood)).toBeLessThan(0.25);
  }, 300_000);

  it('measures decomposition on bare layout (2fcf0b6)', () => {
    const res = runMoodDecomposition('three-years', false);

    console.log(`=== BARE LAYOUT (2fcf0b6) (${res.seed}) ===`);
    console.log(`Dwarf-days: ${res.totalDwarfDays}, Final Pop: ${res.finalPop}`);
    console.log(`Mean mood: ${res.meanMood.toFixed(2)} (min: ${res.minMood.toFixed(1)}, max: ${res.maxMood.toFixed(1)})`);
    console.log(`Mood breakdown: Fine: ${res.moodBreakdown['Fine']}, Content: ${res.moodBreakdown['Content']}, Unhappy: ${res.moodBreakdown['Unhappy']}, Miserable: ${res.moodBreakdown['Miserable']}`);
    console.log(`Baseline: ${res.baseline.toFixed(2)}`);
    console.log(`Mean Hearth bonus: ${res.meanHearthBonus.toFixed(2)}`);
    console.log(`Mean Personality base: ${res.meanPersonalityBase.toFixed(2)}`);
    console.log(`Mean Cap effect: ${res.meanCapEffect.toFixed(2)}`);
    console.log(`Mean Floor effect: ${res.meanFloorEffect.toFixed(2)}`);
    console.log('--- THOUGHT DECOMPOSITION TABLE ---');
    console.log('Thought ID | Content Value | % Dwarf-time Active | Mean Contribution | Mean Val When Active');
    for (const row of res.thoughtRows) {
      console.log(`  ${row.id.padEnd(28)} | ${row.contentValue.padEnd(12)} | ${row.pctActive.toFixed(1).padStart(5)}% | ${row.meanContribution.toFixed(2).padStart(6)} | ${row.meanValueWhenActive.toFixed(2).padStart(6)}`);
    }
    console.log('--- NEED WANT FREQUENCIES ---');
    for (const [k, v] of Object.entries(res.needWants)) {
      console.log(`  ${k.padEnd(12)}: at want level ${v.pctAtWant.toFixed(1)}% of time (mean level ${v.meanLevel.toFixed(1)})`);
    }
    console.log(`Events: meals=${res.eventCounts.mealsEaten}, ale=${res.eventCounts.drinksAlcohol}, water=${res.eventCounts.drinksWater}`);

    const sumThoughts = res.thoughtRows.reduce((s, r) => s + r.meanContribution, 0);
    const sumAll = res.baseline + res.meanHearthBonus + res.meanPersonalityBase + sumThoughts + res.meanCapEffect + res.meanFloorEffect;
    console.log(`Sanity check sum: ${sumAll.toFixed(2)} vs measured: ${res.meanMood.toFixed(2)}`);
    expect(Math.abs(sumAll - res.meanMood)).toBeLessThan(0.25);
  }, 300_000);

  it('confirms decomposition on sweep seeds', () => {
    for (const seed of ['three-years-p0-1', 'three-years-p0-2']) {
      const res = runMoodDecomposition(seed, true);
      console.log(`=== SEED ${seed} ===`);
      console.log(`Mean mood: ${res.meanMood.toFixed(2)} (min: ${res.minMood.toFixed(1)}, max: ${res.maxMood.toFixed(1)})`);
      console.log(`Mood breakdown: Fine: ${res.moodBreakdown['Fine']}, Content: ${res.moodBreakdown['Content']}, Unhappy: ${res.moodBreakdown['Unhappy']}, Miserable: ${res.moodBreakdown['Miserable']}`);
      const sumThoughts = res.thoughtRows.reduce((s, r) => s + r.meanContribution, 0);
      const sumAll = res.baseline + res.meanHearthBonus + res.meanPersonalityBase + sumThoughts + res.meanCapEffect + res.meanFloorEffect;
      expect(Math.abs(sumAll - res.meanMood)).toBeLessThan(0.25);
    }
  }, 600_000);
});
