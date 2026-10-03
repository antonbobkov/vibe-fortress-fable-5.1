/**
 * Reusable instrument for T-M8-06: decomposes dwarf mood in the three_years simulation.
 *
 * Samples every living fortress dwarf daily across the 3-year run, measuring:
 * - mood, baseline, and the exact contribution of each active thought;
 * - need frequencies (% of dwarf-time at want level or worse);
 * - top positive and negative contributors;
 * - comparison between upgraded fortress and bare layout (2fcf0b6);
 * - confirmation across seeds;
 * - bedroom dig jobs status at days 30, 100, 365, 1095;
 * - miners daily activity histogram and cancellation counts;
 * - water drink breakdown into categories (i)-(v);
 * - full 24-hour trace of Day 100.
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
import type { JobsReader } from '@systems/jobs';
import type { ItemsReader } from '@systems/items';
import { WANT, type NeedName } from '@systems/dwarves/needs';
import { personalityBase } from '@systems/morale/thoughts';
import authoredThoughts from '@content/thoughts.json';
import { TestWorld } from '../scenarios/test-world';
import {
  setupThreeYearsFortress,
  checkFortressWorkOrders,
  checkFortressRooms,
  checkFortressCaveFarm,
  checkFortressDefense,
  type BedroomPlan,
} from '../scenarios/three_years_fortress';

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
  readonly behavior?: string | undefined;
  readonly activity?: string | undefined;
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

export interface BedroomDigSnapshot {
  readonly day: number;
  readonly totalTiles: number;
  readonly floorsDug: number;
  readonly wallsRemaining: number;
  readonly doorsDug: number;
  readonly jobsOpen: number;
  readonly jobsClaimed: number;
  readonly jobsBlockedUnreachable: number;
  readonly jobsBlockedOther: number;
  readonly jobsNotExist: number;
}

export interface BedroomRoomStatus {
  readonly roomIndex: number;
  readonly doorDug: boolean;
  readonly floorsDug: number;
  readonly wallsRemaining: number;
  readonly doorReachableFromCorridor: boolean;
  readonly anyWallReachable: boolean;
  readonly setupDay?: number | undefined;
}

export interface MinerActivityStats {
  readonly minerIds: readonly number[];
  readonly activityHistogram: Record<string, number>;
  readonly digCancelledCount: number;
  readonly digAbandonedCount: number;
}

export interface DrinkDiagnosticResult {
  readonly totalWaterDrinks: number;
  readonly totalAlcoholDrinks: number;
  readonly alcoholBrewed: number;
  readonly split: {
    readonly noAlcohol: number;
    readonly notInBarrel: number;
    readonly barrelNotInStockpile: number;
    readonly allReserved: number;
    readonly availableInStockpiledBarrel: number;
    readonly unreachableFromDwarf?: number | undefined;
  };
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
  readonly bedroomDigSnapshots?: readonly BedroomDigSnapshot[] | undefined;
  readonly bedroomRoomStatus?: readonly BedroomRoomStatus[] | undefined;
  readonly minerActivityDiag?: MinerActivityStats | undefined;
  readonly drinkDiag?: DrinkDiagnosticResult | undefined;
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
  w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 5, tiles: roomTiles });

  // 5. Still and carpenter
  const toPlace = [
    { type: 'still', origin: w.index(cx - 3, cy + 9, Z) },
    { type: 'carpenter', origin: w.index(cx + 1, cy + 9, Z) },
  ];
  const placedIds: Record<string, number> = {};
  for (const p of toPlace) {
    if (buildings.ghost(p.type, p.origin, 0).reason !== null) continue;
    const r = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: p.type, origin: p.origin, orientation: 0, materialChoice: 0 });
    if (r.ok) placedIds[p.type] = bSystem.lastPlacedBuilding;
  }

  // 6. Surface farm plot (5x3)
  w.step(5);
  const farmTiles: number[] = [];
  for (let y = cy + 14; y <= cy + 16; y += 1) {
    for (let x = cx - 2; x <= cx + 2; x += 1) {
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

  // 7. Surface meeting area
  const meetTiles: number[] = [];
  for (let y = cy + 10; y <= cy + 12; y += 1) {
    for (let x = cx - 2; x <= cx + 2; x += 1) {
      const t = w.index(x, y, Z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('meeting_area', t)) meetTiles.push(t);
    }
  }
  w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'meeting_area', tiles: meetTiles });

  // 8. Work orders at day 5
  w.step(5 * TICKS_PER_DAY - w.tick);
  if (placedIds['still']) {
    w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['still'], order: { recipeId: 'brew', mode: 'maintain', threshold: 10 } });
  }
  if (placedIds['carpenter']) {
    w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: placedIds['carpenter'], order: { recipeId: 'make_barrel', mode: 'maintain', threshold: 4 } });
  }

  // 9. Day 20: cave farm
  w.step(20 * TICKS_PER_DAY - w.tick);
  const caveTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 7; y += 1) {
    for (let x = cx + 13; x <= cx + 16; x += 1) {
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

  const state = setupThreeYearsFortress(w);
  const cx = state.cx;
  const cy = state.cy;
  const buildings = w.readers.of<BuildingsReader>('14');

  // Advance bootstrap period (20 days)
  const totalTicksBootstrap = 20 * TICKS_PER_DAY;
  while (w.tick < totalTicksBootstrap) {
    w.step(Math.min(100, totalTicksBootstrap - w.tick));
    checkFortressWorkOrders(w, state);
    checkFortressRooms(w, state);
    checkFortressCaveFarm(w, state);
    checkFortressDefense(w, state);
  }

  // Trade depot
  for (const at of [w.index(cx - 9, cy + 4, Z), w.index(cx - 9, cy + 8, Z), w.index(cx + 8, cy + 14, Z)]) {
    if (buildings.ghost('trade_depot', at, 0).reason !== null) continue;
    const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: at, orientation: 0, materialChoice: 0 });
    if (placed.ok) break;
  }
  w.game.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'anvil', priority: 1 }] });

  const allBedroomTiles: number[] = [];
  for (const bp of state.bedroomPlans) {
    allBedroomTiles.push(w.index(bp.doorX, bp.doorY, 29));
    allBedroomTiles.push(...bp.tiles);
  }

  return runSamplingLoop(
    w,
    seed,
    true,
    () => {
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    },
    state.bedroomPlans,
    allBedroomTiles,
    cx,
    cy,
  );
}

function runSamplingLoop(
  w: TestWorld,
  seed: string,
  upgraded: boolean,
  onStep: () => void,
  bedroomPlans?: BedroomPlan[],
  bedroomDigTiles?: readonly number[],
  cx: number = 0,
  cy: number = 0,
): MoodDecompositionResult {
  const registry = w.game.registry;
  const buildings = w.readers.of<BuildingsReader>('14');
  const morale = w.readers.of<MoraleReader>('15');
  const dwarves = w.readers.of<DwarvesReader>('10');
  const items = w.readers.of<ItemsReader>('13');
  const jobs = w.readers.of<JobsReader>('11');
  const itemTable = registry.table('items');
  const matTable = registry.table('materials');

  let mealsEaten = 0;
  let drinksAlcohol = 0;
  let drinksWater = 0;
  let alcoholBrewed = 0;
  let digCancelledCount = 0;
  const digAbandonedCount = 0;

  const drinkSplit = {
    noAlcohol: 0,
    notInBarrel: 0,
    barrelNotInStockpile: 0,
    allReserved: 0,
    availableInStockpiledBarrel: 0,
    unreachableFromDwarf: 0,
  };

  w.game.world.onEvents((events) => {
    for (const e of events) {
      if (e.type === 'MealEaten') {
        mealsEaten += 1;
      } else if (e.type === 'DrankAlcohol') {
        drinksAlcohol += 1;
      } else if (e.type === 'DrankWater') {
        drinksWater += 1;
        if (upgraded) {
          const dwarfId = e['id'] as number;
          const dwarfPos = w.game.world.entities.get(dwarfId, C.Position);
          const dwarfTile = dwarfPos ? w.map.index(dwarfPos.x, dwarfPos.y, dwarfPos.z) : -1;

          let totalAlcoholUnits = 0;
          let alcoholInBarrelUnits = 0;
          let alcoholInStockpiledBarrelUnits = 0;
          let alcoholInStockpiledBarrelUnreservedUnits = 0;

          for (const iid of w.game.world.entities.with(C.Item)) {
            const it = w.game.world.entities.get(iid, C.Item);
            if (!it) continue;
            const def = itemTable.byIndex(it.type) as { id: string; category: string } | undefined;
            if (!def || !def.category.startsWith('drink')) continue;
            const mat = matTable.byIndex(it.material)?.id ?? '';
            if (!/ale|beer|wine|bellwine/.test(mat)) continue;

            const count = it.count ?? 1;
            totalAlcoholUnits += count;

            const containerId = items.containerOf(iid);
            let inBarrel = false;
            if (containerId !== 0) {
              const cIt = w.game.world.entities.get(containerId, C.Item);
              if (cIt) {
                const cDef = itemTable.byIndex(cIt.type) as { id: string } | undefined;
                if (cDef?.id === 'barrel') inBarrel = true;
              }
            }

            if (inBarrel) {
              alcoholInBarrelUnits += count;
              const bTile = items.tileOf(containerId);
              const sp = bTile >= 0 ? items.stockpileAt(bTile) : 0;
              if (sp !== 0) {
                alcoholInStockpiledBarrelUnits += count;
                if (!it.reservedBy || it.reservedBy === 0) {
                  alcoholInStockpiledBarrelUnreservedUnits += count;
                }
              }
            }
          }

          if (totalAlcoholUnits === 0) {
            drinkSplit.noAlcohol += 1;
          } else if (alcoholInBarrelUnits === 0) {
            drinkSplit.notInBarrel += 1;
          } else if (alcoholInStockpiledBarrelUnits === 0) {
            drinkSplit.barrelNotInStockpile += 1;
          } else if (alcoholInStockpiledBarrelUnreservedUnits === 0) {
            drinkSplit.allReserved += 1;
          } else {
            drinkSplit.availableInStockpiledBarrel += 1;
            if (dwarfTile >= 0) {
              const findable = items.findItem({ drinkable: true }, dwarfTile, 'walker', { reservable: true, stockpiledContainerClass: 'barrel' });
              if (findable === 0) {
                drinkSplit.unreachableFromDwarf += 1;
              }
            }
          }
        }
      } else if (e.type === 'ItemCreated') {
        const itemType = (e['itemType'] as string | undefined) ?? (typeof e['type'] === 'number' ? itemTable.byIndex(e['type'])?.id : undefined);
        if (itemType === 'drink') {
          alcoholBrewed += ((e['count'] as number | undefined) ?? 1);
        }
      } else if (e.type === 'JobCancelled') {
        if (e['jobType'] === 'dig') digCancelledCount += 1;
      }
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

  const bedroomDigSnapshots: BedroomDigSnapshot[] = [];
  const targetDigDays = new Set([30, 100, 112, 224, 336]);
  const minerActivityHist: Record<string, number> = {};

  const sampleBedroomDigJobs = (day: number): void => {
    if (!bedroomDigTiles || bedroomDigTiles.length === 0) return;
    let floorsDug = 0;
    let wallsRemaining = 0;
    let doorsDug = 0;
    let jobsOpen = 0;
    let jobsClaimed = 0;
    let jobsBlockedUnreachable = 0;
    let jobsBlockedOther = 0;
    let jobsNotExist = 0;

    for (const t of bedroomDigTiles) {
      const k = w.map.kindAt(t);
      if (k === TileKind.Floor) floorsDug += 1;
      else wallsRemaining += 1;

      const j = jobs.byKey(`dig:${t}`);
      if (!j) {
        jobsNotExist += 1;
      } else if (j.state === 'open') {
        jobsOpen += 1;
      } else if (['claimed', 'fetching', 'travelling', 'working', 'completing'].includes(j.state)) {
        jobsClaimed += 1;
      } else if (j.state === 'blocked') {
        const r = jobs.blockedReason(j.id);
        if (r === 'unreachable') jobsBlockedUnreachable += 1;
        else jobsBlockedOther += 1;
      }
    }
    if (bedroomPlans) {
      for (const bp of bedroomPlans) {
        const doorTile = w.index(bp.doorX, bp.doorY, 29);
        if (w.map.kindAt(doorTile) === TileKind.Floor) doorsDug += 1;
      }
    }
    bedroomDigSnapshots.push({
      day,
      totalTiles: bedroomDigTiles.length,
      floorsDug,
      wallsRemaining,
      doorsDug,
      jobsOpen,
      jobsClaimed,
      jobsBlockedUnreachable,
      jobsBlockedOther,
      jobsNotExist,
    });
  };

  const sampleMiners = (): void => {
    if (!upgraded) return;
    const miners = jobs.workersWithLabor('mining');
    for (const m of miners) {
      const j = jobs.forWorker(m);
      if (j) {
        const typeName = jobs.typeOf(j.id) ?? String(j.type);
        const typeRow = registry.table('jobTypes').byIndex(j.type) as { labor?: string } | undefined;
        const laborName = (typeof j.data['labor'] === 'string' ? j.data['labor'] : typeRow?.labor) ?? 'mining';
        const laborPri = jobs.laborPriority(laborName);
        const effPri = j.priority + (laborPri - 5);
        const k = `job:${typeName}(${laborName}):eff${effPri}:pri${j.priority}`;
        minerActivityHist[k] = (minerActivityHist[k] ?? 0) + 1;
      } else {
        const brain = w.game.world.entities.get(m, C.Brain);
        const b = brain?.behavior ?? 'unknown';
        const a = brain?.activity ?? '';
        const k = `behavior:${b}${a ? ':' + a : ''}`;
        minerActivityHist[k] = (minerActivityHist[k] ?? 0) + 1;
      }
    }
  };

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
        const brain = w.game.world.entities.get(traceTargetDwarf, C.Brain);
        dayTrace.push({
          hour,
          tick: w.tick,
          x: pos?.x ?? 0,
          y: pos?.y ?? 0,
          z: pos?.z ?? 0,
          mood: Math.round(md * 10) / 10,
          needs: nds ? { hunger: Math.round(nds.hunger), thirst: Math.round(nds.thirst), rest: Math.round(nds.rest), social: Math.round(nds.social), comfort: Math.round(nds.comfort), purpose: Math.round(nds.purpose), joy: Math.round(nds.joy) } : {},
          thoughts: ths,
          behavior: brain?.behavior,
          activity: brain?.activity,
        });
      }
    }

    const currentDay = Math.floor(w.tick / TICKS_PER_DAY);
    if (currentDay > lastSampleDay) {
      sampleDwarves();
      sampleMiners();
      if (targetDigDays.has(currentDay)) {
        sampleBedroomDigJobs(currentDay);
      }
      lastSampleDay = currentDay;
    }
  }

  // Sample day 1095 final state if not yet sampled
  if (upgraded && bedroomDigSnapshots.length > 0 && bedroomDigSnapshots[bedroomDigSnapshots.length - 1]?.day !== 1095) {
    sampleBedroomDigJobs(1095);
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
  let bedroomRoomStatus: BedroomRoomStatus[] | undefined;
  let minerActivityDiag: MinerActivityStats | undefined;
  let drinkDiag: DrinkDiagnosticResult | undefined;

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

    if (bedroomPlans) {
      bedroomRoomStatus = bedroomPlans.map((bp, idx) => {
        const doorTile = w.index(bp.doorX, bp.doorY, 29);
        const doorDug = w.map.kindAt(doorTile) === TileKind.Floor;
        const floorsDug = bp.tiles.filter((t) => w.map.kindAt(t) === TileKind.Floor).length;
        const wallsRemaining = bp.tiles.length - floorsDug;
        const corridorTile = w.index(cx + 6, cy + 6, 29);
        const doorReachableFromCorridor = w.readers.pathing.reachable(corridorTile, doorTile, 'walker');
        const anyWallReachable = bp.tiles.some((t) => {
          if (w.map.kindAt(t) !== TileKind.Wall) return false;
          // check if any neighbor is reachable floor
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              if (dx === 0 && dy === 0) continue;
              const n = w.map.offset(t, dx, dy, 0);
              if (n >= 0 && w.map.kindAt(n) === TileKind.Floor && w.readers.pathing.reachable(corridorTile, n, 'walker')) {
                return true;
              }
            }
          }
          return false;
        });
        return {
          roomIndex: idx,
          doorDug,
          floorsDug,
          wallsRemaining,
          doorReachableFromCorridor,
          anyWallReachable,
          setupDay: bp.setupDay,
        };
      });
    }

    const minerIds = jobs.workersWithLabor('mining');
    minerActivityDiag = {
      minerIds,
      activityHistogram: minerActivityHist,
      digCancelledCount,
      digAbandonedCount,
    };

    drinkDiag = {
      totalWaterDrinks: drinksWater,
      totalAlcoholDrinks: drinksAlcohol,
      alcoholBrewed,
      split: drinkSplit,
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
    bedroomDigSnapshots,
    bedroomRoomStatus,
    minerActivityDiag,
    drinkDiag,
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

    if (res.bedroomDigSnapshots) {
      console.log('--- BEDROOM DIG SNAPSHOTS (Days 30, 100, 112 [Y1], 224 [Y2], 336 [Y3/End]) ---');
      console.log('Day | Total | Floors Dug | Walls Rem | Doors Dug | Open | Claimed | Blocked (Unreach) | Blocked (Other) | Not Exist');
      for (const s of res.bedroomDigSnapshots) {
        console.log(`  Day ${String(s.day).padEnd(4)} | ${String(s.totalTiles).padEnd(5)} | ${String(s.floorsDug).padEnd(10)} | ${String(s.wallsRemaining).padEnd(9)} | ${String(s.doorsDug).padEnd(9)} | ${String(s.jobsOpen).padEnd(4)} | ${String(s.jobsClaimed).padEnd(7)} | ${String(s.jobsBlockedUnreachable).padEnd(17)} | ${String(s.jobsBlockedOther).padEnd(15)} | ${String(s.jobsNotExist).padEnd(9)}`);
      }
    }

    if (res.bedroomRoomStatus) {
      console.log('--- BEDROOM ROOM STATUS (Day 336 / End) ---');
      for (const r of res.bedroomRoomStatus) {
        console.log(`  Room ${r.roomIndex}: doorDug=${r.doorDug}, floorsDug=${r.floorsDug}/9, wallsRemaining=${r.wallsRemaining}, setupDay=${r.setupDay ?? 'none'}, doorReachable=${r.doorReachableFromCorridor}, anyWallReachable=${r.anyWallReachable}`);
      }
    }

    if (res.minerActivityDiag) {
      console.log('--- MINER ACTIVITY DIAGNOSTICS ---');
      console.log(`Miners (ids): ${res.minerActivityDiag.minerIds.join(', ')}`);
      console.log(`Dig Cancellations: ${res.minerActivityDiag.digCancelledCount}, Abandonments: ${res.minerActivityDiag.digAbandonedCount}`);
      console.log('Miners Activity Histogram (daily samples across 3 years):');
      for (const [k, count] of Object.entries(res.minerActivityDiag.activityHistogram).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${k.padEnd(40)}: ${count}`);
      }
    }

    if (res.drinkDiag) {
      console.log('--- DRINK DECISION DIAGNOSTICS ---');
      console.log(`Total Water Drinks: ${res.drinkDiag.totalWaterDrinks}, Total Alcohol Drinks: ${res.drinkDiag.totalAlcoholDrinks}`);
      console.log(`Alcohol Brewed Total: ${res.drinkDiag.alcoholBrewed}`);
      const s = res.drinkDiag.split;
      const totalW = res.drinkDiag.totalWaterDrinks || 1;
      console.log(`(i)   No alcohol in world (stock-out):             ${s.noAlcohol} (${((s.noAlcohol / totalW) * 100).toFixed(1)}%)`);
      console.log(`(ii)  Alcohol exists, but not in barrels:          ${s.notInBarrel} (${((s.notInBarrel / totalW) * 100).toFixed(1)}%)`);
      console.log(`(iii) In barrels, but not in stockpile:            ${s.barrelNotInStockpile} (${((s.barrelNotInStockpile / totalW) * 100).toFixed(1)}%)`);
      console.log(`(iv)  In stockpiled barrels, but all reserved:     ${s.allReserved} (${((s.allReserved / totalW) * 100).toFixed(1)}%)`);
      console.log(`(v)   Available in stockpiled barrel (BUG check):  ${s.availableInStockpiledBarrel} (${((s.availableInStockpiledBarrel / totalW) * 100).toFixed(1)}%)`);
      if (s.unreachableFromDwarf !== undefined) {
        console.log(`      -> of which unreachable from dwarf:          ${s.unreachableFromDwarf}`);
      }
    }

    console.log('--- FULL DAY 100 TRACE (Dwarf 0, Hours 0..23) ---');
    for (const t of res.dayTrace) {
      console.log(`  h${String(t.hour).padEnd(2)} (${t.x},${t.y},z${t.z}) mood=${t.mood} behavior=${t.behavior ?? 'none'} act=${t.activity ?? 'none'} needs=${JSON.stringify(t.needs)} thoughts=${t.thoughts.map((x) => `${x.id}(${x.value})`).join(', ')}`);
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
