/**
 * Shared fortress setup and management logic for the three-years scenarios and performance tests.
 *
 * Used by:
 * - test/scenarios/three_years.scenario.ts
 * - test/perf/three_years_seeds.test.ts
 * - test/perf/mood_breakdown.test.ts
 *
 * Ensures all three test harnesses run the exact same fortress layout, designations, work orders,
 * and labor priorities, guaranteeing deterministic parity and consistent measurements.
 */

import { HeadlessGame, regionSpec, FLAT_TEST_SURFACE_Z, type HeadlessEmbark } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { Map3D } from '@core/map3d';
import { generateLocal } from '@systems/terrain/generate';
import { LOCAL_MAP_Z, TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import { C } from '@core/components';
import type { Registry } from '@core/registry';
import { EmbarkSession } from '@systems/embark';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import type { ItemsReader } from '@systems/items';
import type { TerrainReader } from '@systems/terrain/reader';
import { TestWorld } from './test-world';
import { armingSquad, BUILD, checkEconomy, KIT_FIRST, placeEconomyBuilding, ROUTINE, SQUAD_KIT, SQUAD_SIZE, type EconomyState } from './three_years_economy';
import { attachThreeYearsMeasurements, observeImmigration, stepThreeYears, type ThreeYearsMeasurements } from './three_years_measurements';

export const Z = FLAT_TEST_SURFACE_Z;
// Six levels below the surface puts rooms below Serene Vale's deeper soil.
export const HALL_Z = 26;

/** F-17g: the labors given one step: the food chain, and hauling (whose jobs default to 6). */
const STEP_LABORS: readonly string[] = ['farming', 'brewing', 'cooking', 'hauling'];

/** D-225: ordinary wealth-2 generation, compact dimensions for the long-running tests. */
export function threeYearsWorld(seed: string, peril = 0): TestWorld {
  const registry = contentRegistry();
  const spec = regionSpec(seed, { peril, wealth: 2, biome: 'temperate_forest', geology: 'mixed', traits: peril === 0 ? ['serene_vale'] : [],
    river: { class: 'brook', inflow: ['w'], outflow: 's' } }, registry);
  const map = new Map3D(48, 48, LOCAL_MAP_Z);
  const local = generateLocal(spec, map, registry);
  let instrument: ThreeYearsMeasurements | null = null;
  const systems = HeadlessGame.standardSystems(spec, local.layerStack, local).map((s) =>
    s.id === '21' ? observeImmigration(s, () => instrument) : s);
  const w = new TestWorld({ seed, registry, map, spec,
    systems,
    embark: threeYearsEmbark(registry, seed, peril) });
  instrument = attachThreeYearsMeasurements(w);
  return w;
}

/**
 * Real embark path for the three-year fortress, through EmbarkSession and the Balanced preset.
 * F-17i: the seventh founder's ten skill points buy the metal crafts the fortress actually uses
 * instead of medicine, crossbow and hunting; no attribute, supply or seed is rerolled.
 * At perils 2 and 4 the peril budget bonus covers e_anvil (270 marks); peril 0 buys its anvil
 * from the first Mountainhome caravan, so the peaceful baseline remains comparable.
 */
export function threeYearsEmbark(registry: Registry, seed: string, peril: number): HeadlessEmbark {
  const session = new EmbarkSession(registry, seed, peril);
  const rPreset = session.apply({ type: 'ApplyPreset', preset: 'balanced' });
  if (!rPreset.ok) throw new Error(`threeYearsEmbark ApplyPreset failed: ${rPreset.reason}`);
  // Keep the mason's five masonry points and put his five secondary points into stone crafts.
  // The second miner similarly keeps mining and learns the gem work the deeper mine supplies.
  for (const [dwarf, primary, craft] of [[3, 'masonry', 'crafting'], [1, 'mining', 'gem_cutting']] as const) {
    for (const skill of Object.keys(session.party[dwarf]!.skills)) session.apply({ type: 'SetSkill', dwarf, skill, level: 0 });
    for (const skill of [primary, craft]) {
      const result = session.apply({ type: 'SetSkill', dwarf, skill, level: 5 });
      if (!result.ok) throw new Error(`threeYearsEmbark SetSkill ${skill}: ${result.reason}`);
    }
  }
  const smith = 6;
  for (const skill of Object.keys(session.party[smith]!.skills)) session.apply({ type: 'SetSkill', dwarf: smith, skill, level: 0 });
  for (const [skill, level] of [['armorsmithing', 3], ['weaponsmithing', 3], ['metalcrafting', 4]] as const) {
    const rSkill = session.apply({ type: 'SetSkill', dwarf: smith, skill, level });
    if (!rSkill.ok) throw new Error(`threeYearsEmbark SetSkill ${skill} failed: ${rSkill.reason}`);
  }
  if (peril >= 2) {
    if (session.budget() < session.total() + 270) {
      // At peril 2, budget is 1700 (+200 peril bonus over 1500 base). Balanced preset is 1480 (+220 unspent).
      // e_anvil costs 270 marks, requiring 50 marks. A player drops starter furniture
      // (1 table = 10, 2 chairs = 16, 2 beds = 24; total 50 marks saved)
      // which the carpenter and mason craft on site, balancing the budget to exactly 1700/1700.
      session.apply({ type: 'SetSupply', entry: 'e_table', count: 0 });
      session.apply({ type: 'SetSupply', entry: 'e_chair', count: 0 });
      session.apply({ type: 'SetSupply', entry: 'e_bed', count: 1 });
    }
    const rSupply = session.apply({ type: 'SetSupply', entry: 'e_anvil', count: 1 });
    if (!rSupply.ok) throw new Error(`threeYearsEmbark SetSupply e_anvil failed: ${rSupply.reason}`);
  }
  const rConfirm = session.apply({ type: 'ConfirmEmbark' });
  if (!rConfirm.ok) throw new Error(`threeYearsEmbark ConfirmEmbark failed: ${rConfirm.reason}`);
  return { session };
}

export interface BedroomPlan {
  readonly id: number;
  readonly isThane?: boolean;
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
  readonly doorX: number;
  readonly doorY: number;
  readonly bedX: number;
  readonly bedY: number;
  readonly tableX?: number;
  readonly tableY?: number;
  readonly chairX?: number;
  readonly chairY?: number;
  readonly statueX?: number;
  readonly statueY?: number;
  readonly chestX?: number;
  readonly chestY?: number;
  tiles: number[];
  designated: boolean;
  setup: boolean;
  setupDay?: number;
}

export interface FortressState {
  readonly economy: EconomyState;
  readonly cx: number;
  readonly cy: number;
  readonly placedIds: Record<string, number>;
  readonly orderedWorkshops: Set<string>;
  readonly bedroomPlans: BedroomPlan[];
  readonly hearthHallTiles: number[];
  readonly diningHallTiles: number[];
  readonly pantryTiles: number[];
  readonly caveTiles1: number[];
  readonly caveTiles2: number[];
  hearthHallSetup: boolean;
  diningHallSetup: boolean;
  caveFarmId1: number;
  caveFarmId2: number;
  hearthBuildingId: number;
  gateDoorId: number;
  gateDoorPlaced: boolean;
  gateDoorId2: number;
  gateDoorPlaced2: boolean;
  squadId: number;
  forgePlaced: boolean;
  /** Trees around the settlement, felled in batches as the log stock runs down. */
  readonly timberTiles: number[];
  forgeBuiltDay?: number;
}


export function buildBedroomPlans(cx: number, cy: number, mapW: number, mapH: number): BedroomPlan[] {
  const plans: BedroomPlan[] = [];

  // Room 0: Thane's 4x4 suite on South corridor (West side)
  plans.push({
    id: 0,
    isThane: true,
    x1: cx + 1, x2: cx + 4, y1: cy + 10, y2: cy + 13,
    doorX: cx + 5, doorY: cy + 11,
    bedX: cx + 2, bedY: cy + 11,
    tableX: cx + 3, tableY: cy + 12,
    chairX: cx + 3, chairY: cy + 11,
    statueX: cx + 2, statueY: cy + 12,
    chestX: cx + 2, chestY: cy + 10,
    tiles: [], designated: false, setup: false,
  });

  // Room 1: East side opposite Thane's suite (4x4)
  plans.push({
    id: 1,
    x1: cx + 8, x2: cx + 11, y1: cy + 10, y2: cy + 13,
    doorX: cx + 7, doorY: cy + 11,
    bedX: cx + 10, bedY: cy + 11,
    tableX: cx + 9, tableY: cy + 12,
    chairX: cx + 9, chairY: cy + 11,
    tiles: [], designated: false, setup: false,
  });

  // Rooms 2-17: South corridor pairs (3x3 each) going south from y = cy + 15
  let nextId = 2;
  for (let k = 0; k < 8; k += 1) {
    const yBase = cy + 15 + k * 4;
    plans.push(
      { id: nextId++, x1: cx + 2, x2: cx + 4, y1: yBase, y2: yBase + 2, doorX: cx + 5, doorY: yBase + 1, bedX: cx + 2, bedY: yBase + 1, tiles: [], designated: false, setup: false },
      { id: nextId++, x1: cx + 8, x2: cx + 10, y1: yBase, y2: yBase + 2, doorX: cx + 7, doorY: yBase + 1, bedX: cx + 10, bedY: yBase + 1, tiles: [], designated: false, setup: false },
    );
  }

  // Rooms 18-19: West corridor pairs (3x3 each) for population expansion in Y2/Y3
  plans.push(
    { id: 18, x1: cx - 4, x2: cx - 2, y1: cy + 7, y2: cy + 9, doorX: cx - 3, doorY: cy + 6, bedX: cx - 4, bedY: cy + 8, tiles: [], designated: false, setup: false },
    { id: 19, x1: cx - 8, x2: cx - 6, y1: cy + 7, y2: cy + 9, doorX: cx - 7, doorY: cy + 6, bedX: cx - 8, bedY: cy + 8, tiles: [], designated: false, setup: false },
  );

  // Filter out any out-of-bounds coordinates
  return plans.filter((p) => p.x1 >= 1 && p.x2 < mapW - 1 && p.y1 >= 1 && p.y2 < mapH - 1 && p.doorX >= 1 && p.doorX < mapW - 1 && p.doorY >= 1 && p.doorY < mapH - 1);
}

export function setupThreeYearsFortress(w: TestWorld): FortressState {
  const arrival = w.game.arrival;
  if (!arrival) throw new Error('three_years: no arrival');
  let { x: cx, y: cy } = arrival.wagon;
  const map = w.map;
  // Choose a gate site without shrubs/saplings, which a player cannot chop as mature trees.
  const sites: { x: number; y: number; distance: number }[] = [];
  for (let y = 8; y <= 13; y += 1) for (let x = 28; x <= 35; x += 1) {
    let usable = true;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const kind = map.kindAt(w.index(x + dx, y + dy, Z));
      if (kind !== TileKind.Floor && kind !== TileKind.Tree) usable = false;
    }
    // Both tiles outside the future doors must also be clearable before enclosing the stair.
    for (const dy of [-2, 2]) {
      const kind = map.kindAt(w.index(x, y + dy, Z));
      if (kind !== TileKind.Floor && kind !== TileKind.Tree) usable = false;
    }
    if (usable) sites.push({ x, y, distance: Math.abs(x - cx - 6) + Math.abs(y - cy - 6) });
  }
  sites.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  if (!sites[0]) throw new Error('three_years: no usable gate site');
  cx = sites[0].x - 6;
  cy = sites[0].y - 6;

  // F-17g/F-17i: the founders keep their professions, as a player sets them in the labor manager,
  // instead of every job being made urgent: the two miners mine, the woodcutter
  // fells and saws, the farmer farms and brews, the cook cooks, brews and helps build. The mason
  // and the seventh founder keep the general labors (building, hauling, the remaining crafts).
  const professions: Record<number, readonly string[]> = {
    0: ['mining'], 1: ['mining', 'masonry'], 2: ['woodcutting', 'carpentry'],
    3: ['masonry', 'smelting', 'construction'],
    4: ['farming', 'brewing'], 5: ['cooking', 'brewing', 'construction'],
  };
  for (const [index, id] of arrival.dwarves.entries()) {
    for (const row of w.game.registry.table<{ id: string; defaultOn: boolean }>('labors').rows.slice(1)) {
      const on = professions[index]?.includes(row.id) ?? (row.defaultOn && !['mining', 'woodcutting'].includes(row.id));
      w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: row.id, on });
    }
  }

  // Chop real generated trees near the settlement; the generated brook supplies fallback water.
  const treeTiles: number[] = [];
  for (let y = cy; y <= cy + 29; y += 1) {
    for (let x = cx - 22; x <= cx + 15; x += 1) {
      if (x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1) {
        const t = w.index(x, y, Z);
        if (map.kindAt(t) === TileKind.Tree) treeTiles.push(t);
      }
    }
  }
  const roadTrees: number[] = [];
  for (let y = 0; y <= cy + 3; y += 1) for (let x = 0; x < map.w; x += 1) {
    const t = w.index(x, y, Z);
    if (map.kindAt(t) === TileKind.Tree) roadTrees.push(t);
  }

  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

  // 2. Stockpiles
  // 2a. General surface stockpile (8x6)
  const spTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 9; y += 1) {
    for (let x = cx - 5; x <= cx + 2; x += 1) {
      if (x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1) {
        const t = w.index(x, y, Z);
        if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('stockpile', t)) spTiles.push(t);
      }
    }
  }
  const rSp = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'stockpile', tiles: spTiles });
  if (!rSp.ok) throw new Error(`Stockpile CreateZone failed: ${rSp.reason}`);
  const spId = bSystem.lastCreatedZone;
  w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: spId, filter: 'everything' });

  // 2b. Surface dedicated drink stockpile directly south of the still (3x2: x = cx..cx + 2, y = cy + 13..cy + 14)
  const drinkSpSurfaceTiles: number[] = [];
  for (let y = cy + 13; y <= cy + 14; y += 1) {
    for (let x = cx; x <= cx + 2; x += 1) {
      const t = w.index(x, y, Z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('stockpile', t)) drinkSpSurfaceTiles.push(t);
    }
  }
  const rDrinkSp = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'stockpile', tiles: drinkSpSurfaceTiles });
  if (rDrinkSp.ok) {
    const dSpId = bSystem.lastCreatedZone;
    w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: dSpId, filter: 'drink' });
    w.game.world.applyCommand({ type: 'SetStockpilePriority', zoneId: dSpId, priority: ROUTINE });
  }

  // 3. F-17g: labors keep the default priority. Routine work is not urgent, so a dwarf eats,
  // drinks, sits and talks at the want threshold instead of deferring to the critical one. Two real
  // bottlenecks get one step: the food chain (planting, harvesting, brewing, cooking), and hauling,
  // whose stockpile jobs otherwise sit one step behind every other job and are never done.
  for (const row of w.game.registry.table<{ id: string }>('labors').rows.slice(1)) {
    w.game.world.applyCommand({ type: 'SetLaborPriority', labor: row.id, priority: STEP_LABORS.includes(row.id) ? ROUTINE - 1 : ROUTINE });
  }

  // 4. Stairwell to rock layer (z = HALL_Z). The gate site is cleared first by sequence, not by
  // urgency: its trees are the only ones designated until they are down.
  const gateTrees = treeTiles.filter((t) => Math.abs(map.xOf(t) - cx - 6) <= 2 && Math.abs(map.yOf(t) - cy - 6) <= 2);
  if (gateTrees.length) {
    w.game.world.applyCommand({ type: 'Designate', kind: 'chop', priority: ROUTINE, tiles: gateTrees });
    const end = w.tick + 6 * TICKS_PER_DAY;
    while (w.tick < end && !gateTrees.every((t) => map.kindAt(t) === TileKind.Floor)) stepThreeYears(w, 1);
  }
  const rStairs = w.game.world.applyCommand({ type: 'DesignateStairwell', x: cx + 6, y: cy + 6, zTop: 32, zBottom: HALL_Z, priority: ROUTINE });
  if (!rStairs.ok) throw new Error(`DesignateStairwell failed: ${rStairs.reason}`);
  // The caravan road is cleared outright; the rest of the wood is felled in batches as the
  // log stock runs down (checkEconomy), so the haulers are not buried under a clear-cut forest.
  const road = roadTrees.filter((t) => map.kindAt(t) === TileKind.Tree);
  if (road.length) w.game.world.applyCommand({ type: 'Designate', kind: 'chop', priority: ROUTINE, tiles: road });

  // 5. Cave farm at z = 31
  const caveTiles1: number[] = [];
  const caveTiles2: number[] = [];
  for (let y = cy + 4; y <= cy + 7; y += 1) {
    // Twenty tiles for the twenty dimcap seeds, twelve for the ten cavewheat seeds: every cave
    // seed in the wagon is in the ground (07: one harvest returns one seed, so seeds cap the farm).
    for (let x = cx + 7; x <= cx + 11; x += 1) {
      if (x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1) caveTiles1.push(w.index(x, y, Z - 1));
    }
    for (let x = cx + 12; x <= cx + 14; x += 1) {
      if (x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1) caveTiles2.push(w.index(x, y, Z - 1));
    }
  }
  const rCaveDig = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: ROUTINE, tiles: [...caveTiles1, ...caveTiles2] });
  if (!rCaveDig.ok) throw new Error(`Designate cave farm dig failed: ${rCaveDig.reason}`);

  // 6. Underground designations at z = HALL_Z
  // Corridors
  const corridorTiles: number[] = [];
  // Central cross
  corridorTiles.push(w.index(cx + 5, cy + 6, HALL_Z)); // to dining hall
  corridorTiles.push(w.index(cx + 7, cy + 6, HALL_Z)); // to hearth hall
  // South corridor (y = cy + 7 .. cy + 45)
  for (let y = cy + 7; y <= Math.min(map.h - 3, cy + 45); y += 1) corridorTiles.push(w.index(cx + 6, y, HALL_Z));
  // North corridor (y = cy - 15 .. cy + 5)
  for (let y = Math.max(1, cy - 15); y <= cy + 5; y += 1) corridorTiles.push(w.index(cx + 6, y, HALL_Z));
  // West corridor (x = cx - 13 .. cx + 4, y = cy + 6)
  for (let x = Math.max(1, cx - 13); x <= cx + 4; x += 1) corridorTiles.push(w.index(x, cy + 6, HALL_Z));

  // Hearth Hall (6x5): x: cx + 8..cx + 13, y: cy + 4..cy + 8
  const hearthHallTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 8; y += 1) {
    for (let x = cx + 8; x <= cx + 13; x += 1) hearthHallTiles.push(w.index(x, y, HALL_Z));
  }

  // Dining Hall (5x5): x: cx..cx + 4, y: cy + 4..cy + 8
  const diningHallTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 8; y += 1) {
    for (let x = cx; x <= cx + 4; x += 1) diningHallTiles.push(w.index(x, y, HALL_Z));
  }

  // Underground drink stockpile annex (3x2) beside dining hall
  const drinkSpUndergroundTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 5; y += 1) {
    for (let x = cx - 3; x <= cx - 1; x += 1) {
      if (x >= 1 && y >= 1) drinkSpUndergroundTiles.push(w.index(x, y, HALL_Z));
    }
  }

  const pantryTiles: number[] = [];
  for (let y = cy + 3; y <= cy + 5; y += 1) for (let x = cx - 8; x <= cx - 4; x += 1) pantryTiles.push(w.index(x, y, HALL_Z));
  const hallDigTiles: number[] = [...corridorTiles, ...hearthHallTiles, ...diningHallTiles, ...drinkSpUndergroundTiles, ...pantryTiles];
  // F-17h: with the anvil in the wagon the trunk corridor to the mine shaft goes a step ahead of
  // the halls, so ore for the squad's kit is reached first.
  const arming = w.readers.of<ItemsReader>('13').count('anvil') > 0;
  const trunk = corridorTiles.filter((t) => map.xOf(t) === cx + 6 && map.yOf(t) >= cy + 7 && map.yOf(t) <= Math.min(map.h - 3, cy + 15));
  if (arming) {
    const rTrunk = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: KIT_FIRST, tiles: trunk });
    if (!rTrunk.ok) throw new Error(`Designate trunk dig failed: ${rTrunk.reason}`);
  }
  const rDigHalls = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: ROUTINE, tiles: arming ? hallDigTiles.filter((t) => !trunk.includes(t)) : hallDigTiles });
  if (!rDigHalls.ok) throw new Error(`Designate hall dig failed: ${rDigHalls.reason}`);

  // Bedroom plans
  const bedroomPlans = buildBedroomPlans(cx, cy, map.w, map.h);

  // Fill in tile indices for all bedroom plans
  for (const bp of bedroomPlans) {
    bp.tiles = [];
    for (let y = bp.y1; y <= bp.y2; y += 1) {
      for (let x = bp.x1; x <= bp.x2; x += 1) {
        bp.tiles.push(w.index(x, y, HALL_Z));
      }
    }
  }

  // Dig for the actual embark party, with one spare room; expand when immigrants arrive.
  const initialDigTiles: number[] = [];
  for (let i = 0; i < arrival.dwarves.length + 1 && i < bedroomPlans.length; i += 1) {
    const bp = bedroomPlans[i]!;
    bp.designated = true;
    initialDigTiles.push(w.index(bp.doorX, bp.doorY, HALL_Z));
    initialDigTiles.push(...bp.tiles);
  }
  const rDigBedrooms = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: ROUTINE, tiles: initialDigTiles });
  if (!rDigBedrooms.ok) throw new Error(`Designate bedroom dig failed: ${rDigBedrooms.reason}`);

  // 7. Surface workshops
  const placedIds: Record<string, number> = {};

  // 8. Surface meeting spot in the alley between the still and the kitchen, where the workers
  // are: a dwarf who wants company finds it beside the benches instead of waiting in a far field.
  const meetTiles: number[] = [];
  for (let y = cy + 10; y <= cy + 13; y += 1) {
    const t = w.index(cx + 3, y, Z);
    if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('meeting_area', t)) meetTiles.push(t);
  }
  w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'meeting_area', tiles: meetTiles });

  // 9. Surface barley and turnip farm
  stepThreeYears(w, 5);
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

  // 10. Surface pasture
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

  // 11. Gather zone on the shrubs of the woods around the settlement: ripe brambles and
  // nutbushes are food. Only the shrub tiles themselves are zoned, so no building site is taken.
  const gatherTiles: number[] = [];
  for (let y = Math.max(1, cy - 6); y <= Math.min(map.h - 2, cy + 26); y += 1) {
    for (let x = Math.max(1, cx - 16); x <= Math.min(map.w - 2, cx + 18); x += 1) {
      const t = w.index(x, y, Z);
      if (map.kindAt(t) === TileKind.Shrub && buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('gather', t)) gatherTiles.push(t);
    }
  }
  if (gatherTiles.length) w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'gather', tiles: gatherTiles });

  return {
    economy: { lastDay: -1, phases: new Set(), traded: new Set(), mined: new Set(), workings: new Set(), specialists: {} },
    cx,
    cy,
    placedIds,
    orderedWorkshops: new Set<string>(),
    bedroomPlans,
    hearthHallTiles,
    diningHallTiles,
    pantryTiles,
    caveTiles1,
    caveTiles2,
    hearthHallSetup: false,
    diningHallSetup: false,
    caveFarmId1: 0,
    caveFarmId2: 0,
    hearthBuildingId: 0,
    gateDoorId: 0,
    gateDoorPlaced: false,
    gateDoorId2: 0,
    gateDoorPlaced2: false,
    squadId: 0,
    forgePlaced: false,
    timberTiles: treeTiles.filter((t) => !roadTrees.includes(t)),
  };
}


export function checkFortressWorkOrders(w: TestWorld, state: FortressState): void {
  checkEconomy(w, state);
  const buildings = w.readers.of<BuildingsReader>('14');
  const ordered = state.orderedWorkshops;
  const placedIds = state.placedIds;

  if (!ordered.has('carpenter') && buildings.get(placedIds['carpenter']!)?.state === 'built') {
    ordered.add('carpenter');
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: placedIds['carpenter'],
      order: { recipeId: 'make_barrel', mode: 'maintain', threshold: 20, priority: ROUTINE },
    });
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: placedIds['carpenter'],
      order: { recipeId: 'make_bed', mode: 'maintain', threshold: 8, priority: ROUTINE },
    });
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: placedIds['carpenter'],
      order: { recipeId: 'make_table_wood', mode: 'maintain', threshold: 6, priority: ROUTINE },
    });
  }
  if (!ordered.has('mason') && buildings.get(placedIds['mason']!)?.state === 'built') {
    ordered.add('mason');
    // Stone blocks maintain 30: vital for hearth, constructions, and workshop building.
    // F-17h: while the squad waits for its kit the forge's blocks go a step ahead.
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: placedIds['mason'],
      order: { recipeId: 'make_stone_block', mode: 'maintain', threshold: 30, priority: armingSquad(state) ? KIT_FIRST : ROUTINE },
    });
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: placedIds['mason'],
      order: { recipeId: 'make_door_stone', mode: 'maintain', threshold: 4, priority: ROUTINE },
    });
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: placedIds['mason'],
      order: { recipeId: 'make_table_stone', mode: 'maintain', threshold: 6, priority: ROUTINE },
    });
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: placedIds['mason'],
      order: { recipeId: 'make_chair_stone', mode: 'maintain', threshold: 14, priority: ROUTINE },
    });
  }
  if (!ordered.has('craftdwarf') && buildings.get(placedIds['craftdwarf']!)?.state === 'built') {
    ordered.add('craftdwarf');
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: placedIds['craftdwarf'],
      order: { recipeId: 'craft_stone', mode: 'maintain', threshold: 60, priority: ROUTINE },
    });
  }
  if (!ordered.has('still') && buildings.get(placedIds['still']!)?.state === 'built') {
    ordered.add('still');
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: placedIds['still'],
      // Drink has first call on the plants: the one order a step ahead of the kitchen's.
      order: { recipeId: 'brew', mode: 'maintain', threshold: 80, priority: ROUTINE },
    });
  }
  if (!ordered.has('kitchen') && buildings.get(placedIds['kitchen']!)?.state === 'built') {
    ordered.add('kitchen');
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: placedIds['kitchen'],
      order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 20, priority: ROUTINE },
    });
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: placedIds['kitchen'],
      order: { recipeId: 'cook_fine_meal', mode: 'maintain', threshold: 10, priority: ROUTINE },
    });
  }

  // Forge: built as soon as balance.md year-one table allows (day 30–56, as soon as day 30 is reached and anvil available)
  // F-17h: from day 1 when the anvil came in the wagon and the squad waits for its kit.
  if (!state.forgePlaced && (w.tick >= 30 * TICKS_PER_DAY || armingSquad(state))) {
    const hasAnvil = w.readers.of<ItemsReader>('13').count('anvil') > 0;
    if (hasAnvil) {
      placeEconomyBuilding(w, state, 'forge', 12, 10, armingSquad(state) ? KIT_FIRST : BUILD);
      const forgeId = placedIds['forge'];
      if (forgeId) {
        const forge = buildings.get(forgeId)!;
        state.forgePlaced = true;
        const corners = [0, 2, 6, 8].map((i) => forge.footprint[i]!);
        w.game.world.applyCommand({ type: 'SetTraffic', tiles: corners, mode: 'forbidden' });
      }
    }
  }

  if (!ordered.has('forge') && state.placedIds['forge'] !== undefined && buildings.get(state.placedIds['forge'])?.state === 'built') {
    ordered.add('forge');
    state.forgeBuiltDay = Math.floor(w.tick / TICKS_PER_DAY) + 1;
    const corners = [0, 2, 6, 8].map((i) => buildings.get(state.placedIds['forge']!)!.footprint[i]!);
    w.game.world.applyCommand({ type: 'SetTraffic', tiles: corners, mode: 'normal' });
    if (armingSquad(state)) {
      // F-17h: the three soldiers' mail, shields and swords are the forge's only orders, ahead of
      // all routine work, until every piece is forged. Tools and export goods follow (checkEconomy).
      for (const recipeId of SQUAD_KIT) {
        w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: state.placedIds['forge'],
          order: { recipeId, mode: 'maintain', threshold: SQUAD_SIZE, materialFilter: 'iron', priority: KIT_FIRST } });
      }
    } else {
      // Replace tools first, then equip the squad before producing export goods.
      w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: state.placedIds['forge'],
        order: { recipeId: 'forge_pick', mode: 'once', remaining: 2, materialFilter: 'iron', priority: ROUTINE } });
      for (const recipeId of SQUAD_KIT) {
        w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: state.placedIds['forge'],
          order: { recipeId, mode: 'maintain', threshold: SQUAD_SIZE, materialFilter: 'iron', priority: ROUTINE } });
      }
    }
  }
}

export function designateSmoothTiles(w: TestWorld, tiles: readonly number[], priority: number = ROUTINE): void {
  const terrain = w.readers.of<TerrainReader>('03');
  const candidateTiles = new Set<number>(tiles);
  for (const t of tiles) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const n = w.map.offset(t, dx, dy, 0);
        if (n >= 0 && w.map.kindAt(n) === TileKind.Wall) {
          candidateTiles.add(n);
        }
      }
    }
  }
  const smoothTiles: number[] = [];
  const mats = w.game.registry.table<{ id: string; class: string }>('materials');
  for (const t of candidateTiles) {
    const k = w.map.kindAt(t);
    if ((k === TileKind.Wall || k === TileKind.Floor) &&
        !w.map.hasFlag(t, TileFlag.Constructed) &&
        !w.map.hasFlag(t, TileFlag.Smoothed) && terrain.designationAt(t) === null) {
      const m = w.map.materialAt(t);
      if (mats.byIndex(m)?.class === 'stone') {
        smoothTiles.push(t);
      }
    }
  }
  if (smoothTiles.length > 0) {
    w.game.world.applyCommand({ type: 'Designate', kind: 'smooth', priority, tiles: smoothTiles });
  }
}

export function checkFortressRooms(w: TestWorld, state: FortressState): void {
  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;
  const { cx, cy } = state;

  // Finish the shelter and its supply workshops before assigning cosmetic stone work.
  const foundationReady = buildings.get(state.hearthBuildingId)?.state === 'built' &&
    ['still', 'kitchen', 'wood_furnace', 'smelter'].every(type => buildings.get(state.placedIds[type] ?? 0)?.state === 'built');
  const smooth = (tiles: readonly number[]): void => { if (foundationReady) designateSmoothTiles(w, tiles, ROUTINE); };

  // 1. Hearth Hall setup: reaches Tier 2 Decent (score >= 60)
  if (!state.hearthHallSetup && state.hearthHallTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
    const doorOrigin = w.index(cx + 7, cy + 6, HALL_Z);
    if (w.map.kindAt(doorOrigin) === TileKind.Floor) {
      state.hearthHallSetup = true;
      // Hearth in center
      const hearthOrigin = w.index(cx + 10, cy + 6, HALL_Z);
      const rHearth = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'hearth', origin: hearthOrigin, orientation: 0, materialChoice: 0, priority: BUILD - 1 });
      if (rHearth.ok) state.hearthBuildingId = bSystem.lastPlacedBuilding;

      // Chairs for hearth-side sitting (all passable)
      const c1 = w.index(cx + 9, cy + 6, HALL_Z);
      const c2 = w.index(cx + 11, cy + 6, HALL_Z);
      const c3 = w.index(cx + 10, cy + 5, HALL_Z);
      const c4 = w.index(cx + 10, cy + 7, HALL_Z);
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c1, orientation: 0, materialChoice: 0, priority: BUILD });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c2, orientation: 0, materialChoice: 0, priority: BUILD });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c3, orientation: 0, materialChoice: 0, priority: BUILD });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c4, orientation: 0, materialChoice: 0, priority: BUILD });

      // Create zones
      w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'hearth_hall', tiles: state.hearthHallTiles });
      w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'meeting_area', tiles: state.hearthHallTiles });

      // Smooth floors and bordering walls at the default priority (exclude hearth origin)
      smooth(state.hearthHallTiles.filter((t) => t !== hearthOrigin));
    }
  }

  // 2. Dining Hall setup
  const kitchenBuilt = buildings.get(state.placedIds['kitchen']!)?.state === 'built';
  if (!state.diningHallSetup && kitchenBuilt && state.diningHallTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
    const doorOrigin = w.index(cx + 5, cy + 6, HALL_Z);
    if (w.map.kindAt(doorOrigin) === TileKind.Floor) {
      state.diningHallSetup = true;
      // Tables and chairs
      const t1 = w.index(cx + 2, cy + 5, HALL_Z);
      const c1 = w.index(cx + 1, cy + 5, HALL_Z);
      const c2 = w.index(cx + 3, cy + 5, HALL_Z);
      const t2 = w.index(cx + 2, cy + 7, HALL_Z);
      const c3 = w.index(cx + 1, cy + 7, HALL_Z);
      const c4 = w.index(cx + 3, cy + 7, HALL_Z);
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'table', origin: t1, orientation: 0, materialChoice: 0, priority: BUILD });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c1, orientation: 0, materialChoice: 0, priority: BUILD });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c2, orientation: 0, materialChoice: 0, priority: BUILD });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'table', origin: t2, orientation: 0, materialChoice: 0, priority: BUILD });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c3, orientation: 0, materialChoice: 0, priority: BUILD });
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: c4, orientation: 0, materialChoice: 0, priority: BUILD });

      // Create dining_hall zone
      w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'dining_hall', tiles: state.diningHallTiles });

      // Create underground drink stockpile beside dining hall (cx - 3..cx - 1, cy + 4..cy + 5)
      const ugDrinkTiles: number[] = [];
      for (let y = cy + 4; y <= cy + 5; y += 1) {
        for (let x = cx - 3; x <= cx - 1; x += 1) {
          const t = w.index(x, y, HALL_Z);
          if (w.map.kindAt(t) === TileKind.Floor && buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('stockpile', t)) {
            ugDrinkTiles.push(t);
          }
        }
      }
      if (ugDrinkTiles.length > 0) {
        const rD = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'stockpile', tiles: ugDrinkTiles });
        if (rD.ok) {
          const zid = bSystem.lastCreatedZone;
          w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: zid, filter: 'drink' });
          w.game.world.applyCommand({ type: 'SetStockpilePriority', zoneId: zid, priority: ROUTINE });
        }
      }

      smooth(state.diningHallTiles);
    }
  }

  if (!state.economy.phases.has('pantry') && state.pantryTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
    const result = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'stockpile', tiles: state.pantryTiles });
    if (result.ok) {
      const id = bSystem.lastCreatedZone;
      w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: id, filter: 'food' });
      w.game.world.applyCommand({ type: 'SetStockpilePriority', zoneId: id, priority: ROUTINE });
      state.economy.phases.add('pantry');
    }
  }

  // 3. Bedrooms setup
  for (const bp of state.bedroomPlans) {
    if (bp.designated && !bp.setup && bp.tiles.length > 0 && bp.tiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
      const doorOrigin = w.index(bp.doorX, bp.doorY, HALL_Z);
      if (w.map.kindAt(doorOrigin) !== TileKind.Floor) continue;
      bp.setup = true;
      bp.setupDay = Math.floor(w.tick / TICKS_PER_DAY);

      // Bed
      const bedOrigin = w.index(bp.bedX, bp.bedY, HALL_Z);
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bedOrigin, orientation: 0, materialChoice: 0, priority: BUILD });

      // Thane's suite fine furniture (table, chair)
      if (bp.isThane) {
        if (bp.tableX !== undefined && bp.tableY !== undefined) {
          w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'table', origin: w.index(bp.tableX, bp.tableY, HALL_Z), orientation: 0, materialChoice: 0, priority: BUILD });
        }
        if (bp.chairX !== undefined && bp.chairY !== undefined) {
          w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: w.index(bp.chairX, bp.chairY, HALL_Z), orientation: 0, materialChoice: 0, priority: BUILD });
        }
      }

      // Do not place doors at bedroom entrances to prevent creature collision blocks
      // Smooth room floors and walls at the default priority (score >= 60 guarantees tier >= 2 Decent)

      // Zone
      w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'bedroom', tiles: bp.tiles });

      // Smooth room floors and walls at the default priority
      smooth(bp.tiles);
    }
  }

  if (foundationReady && !state.economy.phases.has('room finishing')) {
    state.economy.phases.add('room finishing');
    smooth(state.hearthHallTiles.filter(t => t !== w.index(cx + 10, cy + 6, HALL_Z)));
    smooth(state.diningHallTiles);
    for (const bp of state.bedroomPlans) if (bp.setup) smooth(bp.tiles);
  }

  // 4. Dynamic bedroom expansion: keep bedrooms ahead of living population
  const livingPop = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
  const designatedCount = state.bedroomPlans.filter((bp) => bp.designated).length;
  if (livingPop + 1 > designatedCount) {
    const nextToDesignate = state.bedroomPlans.filter((bp) => !bp.designated).slice(0, livingPop + 1 - designatedCount);
    if (nextToDesignate.length > 0) {
      const digTiles: number[] = [];
      for (const bp of nextToDesignate) {
        bp.designated = true;
        digTiles.push(w.index(bp.doorX, bp.doorY, HALL_Z));
        digTiles.push(...bp.tiles);
      }
      w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: ROUTINE, tiles: digTiles });
    }
  }
}

export function checkFortressCaveFarm(w: TestWorld, state: FortressState): void {
  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

  if (state.caveFarmId1 === 0 && state.caveTiles1.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
    const plantable1 = state.caveTiles1.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
    if (plantable1.length > 0) {
      const c1 = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: plantable1 });
      if (c1.ok) {
        state.caveFarmId1 = bSystem.lastCreatedZone;
        for (const s of [0, 1, 2, 3]) {
          w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: state.caveFarmId1, season: s, speciesId: 'dimcap' });
        }
      }
    }
  }
  if (state.caveFarmId2 === 0 && state.caveTiles2.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
    const plantable2 = state.caveTiles2.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
    if (plantable2.length > 0) {
      const c2 = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: plantable2 });
      if (c2.ok) {
        state.caveFarmId2 = bSystem.lastCreatedZone;
        for (const s of [0, 1, 2, 3]) {
          w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: state.caveFarmId2, season: s, speciesId: 'cavewheat' });
        }
      }
    }
  }
}

export function checkFortressDefense(w: TestWorld, state: FortressState): void {
  const { cx, cy } = state;
  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

  // Open the underground route before enclosing its only surface entrance. Otherwise a
  // civilian can occupy the still-undug stair tile and prevent the miners reaching it.
  if (!state.economy.phases.has('gate walls') &&
      w.map.kindAt(w.index(cx + 6, cy + 6, Z)) === TileKind.StairsDown &&
      w.map.kindAt(w.index(cx + 6, cy + 6, HALL_Z)) === TileKind.StairsUp) {
    const walls = [
      w.index(cx + 5, cy + 5, Z), w.index(cx + 7, cy + 5, Z),
      w.index(cx + 5, cy + 6, Z), w.index(cx + 7, cy + 6, Z),
      w.index(cx + 5, cy + 7, Z), w.index(cx + 7, cy + 7, Z),
    ];
    for (const origin of walls) {
      if (!buildings.at(origin)) w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'wall', origin, orientation: 0, materialChoice: 0, priority: BUILD });
    }
    if (walls.every((t) => buildings.get(buildings.at(t))?.typeId === 'wall')) state.economy.phases.add('gate walls');
  }

  // 1. Place South door once supporting walls are built
  if (!state.gateDoorPlaced) {
    const w1 = buildings.at(w.index(cx + 5, cy + 7, Z));
    const w2 = buildings.at(w.index(cx + 7, cy + 7, Z));
    if (buildings.get(w1)?.state === 'built' && buildings.get(w2)?.state === 'built') {
      const doorTile = w.index(cx + 6, cy + 7, Z);
      const rDoor = w.game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: 'door',
        origin: doorTile,
        orientation: 0,
        materialChoice: 0,
        priority: BUILD,
      });
      if (rDoor.ok) {
        state.gateDoorPlaced = true;
        state.gateDoorId = bSystem.lastPlacedBuilding;
      }
    }
  }

  // 1b. Place North door once supporting walls are built
  if (!state.gateDoorPlaced2) {
    const w1 = buildings.at(w.index(cx + 5, cy + 5, Z));
    const w2 = buildings.at(w.index(cx + 7, cy + 5, Z));
    if (buildings.get(w1)?.state === 'built' && buildings.get(w2)?.state === 'built') {
      const doorTile2 = w.index(cx + 6, cy + 5, Z);
      const rDoor2 = w.game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: 'door',
        origin: doorTile2,
        orientation: 0,
        materialChoice: 0,
        priority: BUILD,
      });
      if (rDoor2.ok) {
        state.gateDoorPlaced2 = true;
        state.gateDoorId2 = bSystem.lastPlacedBuilding;
      }
    }
  }

  // 2. Set door modes: lock_on_alert (19 § The airlock, ordinary player setting)
  const wantDoorMode = 'lock_on_alert';
  if (state.gateDoorPlaced && state.gateDoorId !== 0) {
    const b = buildings.get(state.gateDoorId);
    if (b?.state === 'built' && b.mode !== wantDoorMode) {
      w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: state.gateDoorId, mode: wantDoorMode });
    }
  }
  if (state.gateDoorPlaced2 && state.gateDoorId2 !== 0) {
    const b2 = buildings.get(state.gateDoorId2);
    if (b2?.state === 'built' && b2.mode !== wantDoorMode) {
      w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: state.gateDoorId2, mode: wantDoorMode });
    }
  }

  // 3. Form squad of 3 once 3 adult dwarves exist
  if (state.squadId === 0 && w.tick >= 10 * TICKS_PER_DAY) {
    const combat = w.readers.of<CombatReader>('16');
    const adultDwarves = w.game.world.entities.with(C.Labors).filter((id) => {
      const c = w.game.world.entities.get(id, C.Creature);
      return c?.faction === 'fortress';
    });
    if (adultDwarves.length >= 3) {
      const rSquad = w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' });
      if (rSquad.ok) {
        state.squadId = combat.squads()[0]!.id;
        // Keep the two embark miners and the woodcutter on their tools.
        const members = adultDwarves.slice(-3);
        w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: state.squadId, members });
        w.game.world.applyCommand({ type: 'SetSquadMode', squadId: state.squadId, mode: 'off' });
      }
    }
  }

  // 4. Alert and squad orders on raid arrival / departure
  const hostilePurposes = new Set(['bandits', 'ambush', 'raid', 'siege', 'restless']);
  let hasActiveRaid = false;
  for (const pId of w.game.world.entities.with(C.Party)) {
    const p = w.game.world.entities.get(pId, C.Party);
    if (p && hostilePurposes.has(p.purpose) && p.state !== 'gone' && p.state !== 'retreat') {
      hasActiveRaid = true;
      break;
    }
  }

  const curAlert = w.game.world.fortress.alert;
  const gatehouseStairsTile = w.index(cx + 6, cy + 6, Z);

  if (hasActiveRaid && curAlert !== 'hearth') {
    w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' });
    if (state.squadId !== 0) {
      w.game.world.applyCommand({ type: 'SquadOrder', squadId: state.squadId, order: { kind: 'station', tile: gatehouseStairsTile } });
    }
  } else if (!hasActiveRaid && curAlert === 'hearth') {
    w.game.world.applyCommand({ type: 'SetAlert', level: 'calm' });
    if (state.squadId !== 0) {
      w.game.world.applyCommand({ type: 'SquadOrder', squadId: state.squadId, order: { kind: 'cancel' } });
    }
  }
}
