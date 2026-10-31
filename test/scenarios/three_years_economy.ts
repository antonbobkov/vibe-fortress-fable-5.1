/** Player economy for T-M8-06. All changes go through commands and ordinary jobs. */
import { C, ItemFlag } from '@core/components';
import { CAVERN_1_Z_MIN, CAVERN_1_Z_MAX, DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { THREAT_RADIUS } from '@systems/dwarves/constants';
import type { DwarvesReader } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { PlantsReader } from '@systems/plants';
import type { TerrainReader } from '@systems/terrain/reader';
import type { TradeReader } from '@systems/trade/reader';
import { merchantPrice, requiredValue } from '@systems/trade/valuation';
import { onWagonSide, type FortressState } from './three_years_fortress';
import type { TestWorld } from './test-world';
import { command } from './script-commands';
import { note, threeYearsMeasurements } from './three_years_measurements';

export interface EconomyState {
  lastDay: number;
  readonly phases: Set<string>;
  readonly traded: Set<string>;
  readonly mined: Set<number>;
  /** F-17i: tiles of the fortress's own mine drifts, known to be safe to dig beside. */
  readonly workings: Set<number>;
  /** F-17h/F-17i: dwarves kept on one craft (dwarf id by role). */
  readonly specialists: Record<string, number>;
  /** F-17i: the deep shaft's column and bottom level, once opened. */
  deepShaft?: { x: number; y: number; bottom: number };
  /** F-17h: the day the three soldiers' mail, shields and swords were all forged. */
  armedDay?: number;
  broker?: { id: number };
  /** The visit whose missing offer was last written to the journal. */
  lastTradeNote?: string;
  /** Cave plots added as the population grew, and whether each is zoned yet. */
  readonly farmPlans: { tiles: number[]; zoneId: number }[];
  /** The dwarf kept on the still. */
  brewer?: number;
  /** Cave plots dug for bought cave seed, and whether each is zoned yet. */
  readonly cavePlans: { tiles: number[]; zoneId: number }[];
  /** The larder beside the pantry: its tiles, and its stockpile once dug. */
  larder?: { tiles: number[]; zoneId: number; drinkTiles: number[]; drinkZoneId: number };
}

/**
 * F-17g: routine production, hauling, mining and smoothing run at the default priority, so a
 * want-level need interrupts them (`10` lets only a job of priority <= NEED_DEFER_PRIORITY defer one).
 */
export const ROUTINE = 5;
/**
 * Construction shares the default priority with its input producers.
 */
export const BUILD = 5;
/** One step ahead of routine work: a caravan's few days at the depot. */
const DEADLINE = 4;
/**
 * F-17h: the squad's metal chain is ordered ahead of all routine work until the kit is forged.
 * It stays above NEED_DEFER_PRIORITY: nobody skips a meal for it.
 */
export const KIT_FIRST = 3;

/** The founder who is Broker from the first day: the mason, who works beside the depot. */
const BROKER_FOUNDER = 3;

/** Tiles kept free around the trade depot: the caravan's standing ring and a lane past it. */
const DEPOT_CLEARANCE = 2;
/** F-17f: the stair, the six gate walls and two doors around it, and the tile outside each door. */
const ENTRANCE_CLEARANCE = 2;
/** F-17f: a mine shaft's column and the tiles around it. */
const SHAFT_CLEARANCE = 1;
/** The upper mine works the rock above cavern one. */
const UPPER_MINE_BOTTOM = 23;
/** F-17i: how deep the second shaft goes (cavern one is z 18-22, the rock under it 15-17). */
const DEEP_BOTTOM_YEAR_2 = 19;
const DEEP_BOTTOM_YEAR_3 = 15;
/** Steel bars ordered at a time in year 3 (F-17i: the order is renewed when it runs out). */
const STEEL_BATCH = 30;
/** Logs kept in stock, and the trees designated at a time to keep them. */
const TIMBER_RESERVE = 40;
const TIMBER_BATCH = 8;
/** Ore faces opened for the squad's kit: 21 bars less the five in the wagon, with a margin. */
const SQUAD_ORE_FACES = 20;

/**
 * Farm tiles kept for each dwarf. balance.md asks about one cave tile for its meals and two
 * thirds for its drink; a surface tile gives less (a longer crop, and nothing in winter).
 */
const FARM_TILES_PER_DWARF = 4;
/** The farm is sized for the dwarves here and the next wave of immigrants. */
const NEXT_WAVE = 8;
/** The first surface field, and a strip added for a growing population. */
const FIRST_FIELD_TILES = 16;
const FARM_STRIP = { width: 4, rows: 4, columns: 4, max: 16 };
/** Export goods a visit should find at the depot before stone and logs stop being added (marks). */
const VISIT_CARGO = 200;
/** Stone crafts kept in stock for each dwarf, and days between two new ore drifts in years 2 and 3. */
const CRAFTS_PER_DWARF = 6;
const DRIFT_EVERY_DAYS = 28;
/** What the squad wants from a caravan: body armour, a shield, a helm, and bandages for the hospital. */
const SQUAD_PURCHASES: readonly string[] = ['mail_shirt', 'shield', 'helm', 'bandage'];
const FIRST_IRON_CRAFTS = 10;
/** Seed bought from one caravan: enough for six new strips or three cave strips. */
const SEED_PER_VISIT = 96;
/** Dwarves one kitchen feeds and one still waters; another is built for each further group. */
const DWARVES_PER_KITCHEN = 16;
const DWARVES_PER_STILL = 28;
/** Days of meals the lavish order keeps in stock: a winter, when nothing grows on the surface, and a half season more. */
const MEAL_DAYS = 42;
/** Days of drink the stills keep in stock. */
const DRINK_DAYS = 21;
/** The largest quantity or `keep >=` stock a work order takes (12 § Work orders): 999. */
const ORDER_STOCK_MAX = 999;
/** The drink a brew order keeps in stock for a population, within what an order can hold. */
export function drinkStock(population: number): number {
  return Math.min(ORDER_STOCK_MAX, Math.max(80, Math.ceil(population * 0.77 * DRINK_DAYS)));
}
/** Days of meals kept back from a caravan: the winter and the season before it. */
const MEAL_RESERVE_DAYS = 56;
/**
 * The crops a surface strip may sow in spring, summer and autumn, food first (`plants.md`): a
 * player sows what the seed in stock allows. Cave plots sow one cave crop in every season.
 */
const SURFACE_CROPS: readonly (readonly string[])[] = [['turnip', 'strawberry', 'barley', 'cabbage'], ['turnip', 'strawberry', 'barley', 'pumpkin'], ['turnip', 'cabbage', 'pumpkin']];
const CAVE_CROPS: readonly string[] = ['dimcap', 'pale_bell', 'sweetroot', 'cavewheat'];
/** Cave strips dug beside the first cave farm on its soil level for bought cave seed (x0, x1, y0, y1 from the centre). */
const CAVE_STRIPS: readonly (readonly [number, number, number, number])[] = [[7, 14, 8, 11], [7, 14, 0, 3], [7, 14, 12, 15], [15, 18, 0, 11]];
/** Free cave seed that justifies digging another cave strip. */
const CAVE_STRIP_SEED = 12;
const USEFUL_SEED: ReadonlySet<string> = new Set([...SURFACE_CROPS.flat(), ...CAVE_CROPS]);
/** The larder beside the pantry, on the hall level (x0, x1, y0, y1 from the centre): 72 tiles of food, then 12 of drink; every tile holds a barrel. */
const LARDER: readonly (readonly [number, number, number, number])[] = [[-12, -1, -3, 2], [-12, -9, 3, 5]];
/** The empty barrels the opening's two drink stockpiles want: a third of their twelve tiles. */
const DRINK_STOCKPILE_TILES = 4;
/** Easy meals in stock before the kitchen turns to lavish meals first. */
const EASY_MEALS_STOCKED = 20;

/** The squad's kit (F-17h): mail, a shield and a short sword for each of the three soldiers. */
export const SQUAD_SIZE = 3;
export const SQUAD_KIT = ['forge_mail_shirt', 'forge_shield', 'forge_short_sword'] as const;
export const SQUAD_KIT_ITEMS = ['mail_shirt', 'shield', 'short_sword'] as const;

/** F-17i: the craft each specialist is kept on, and the skill a player picks them by. */
const SPECIALISTS = [
  { role: 'forge', shops: ['forge'], labors: ['smithing', 'smelting'], skill: 'metalcrafting' },
  { role: 'craftdwarf', shops: ['craftdwarf'], labors: ['crafts'], skill: 'crafting' },
  { role: 'jeweler', shops: ['jeweler'], labors: ['gem_cutting', 'crafts'], skill: 'gem_cutting' },
] as const;
/** Two spare adults beyond the founders support the craft professions; waves can include children. */
const SPECIALIST_MIN_POPULATION = 9;

/** T-156: 11 changes the priority of a job only while it waits for a worker (open or claimed). */
function reprioritised(job: { state: string }): boolean {
  return job.state === 'open' || job.state === 'claimed';
}

function order(w: TestWorld, workshopId: number, recipeId: string, threshold: number, materialFilter?: string, priority = ROUTINE): void {
  const result = command(w, { type: 'AddWorkOrder', workshopId,
    order: { recipeId, mode: 'maintain', threshold, priority, ...(materialFilter ? { materialFilter } : {}) } });
  if (!result.ok) throw new Error(`economy order ${recipeId}: ${result.reason}`);
}

/** Units of an item type the fortress owns: a visiting merchant's goods are not stock. */
export function owned(w: TestWorld, typeId: string): number {
  const ent = w.game.world.entities;
  const type = w.game.registry.table('items').index(typeId);
  let units = 0;
  for (const id of ent.with(C.Item)) {
    const it = ent.get(id, C.Item)!;
    if (it.type === type && (it.flags & (ItemFlag.Merchant | ItemFlag.Foreign)) === 0) units += it.count;
  }
  return units;
}

function fortressDwarves(w: TestWorld): number[] {
  const ent = w.game.world.entities;
  return w.readers.of<DwarvesReader>('10').adults().filter((id) => ent.get(id, C.Creature)?.faction === 'fortress');
}

/**
 * Keep a dwarf on the given labors only, as a player does in the labor manager. Hauling stays on
 * for everybody but the miners, and the broker keeps trading whatever else it does.
 */
function dedicate(w: TestWorld, state: FortressState, dwarfId: number, keep: readonly string[], haul = true): void {
  // The labor manager lists the living only.
  if (!w.game.world.entities.alive(dwarfId)) return;
  const jobs = w.readers.of<JobsReader>('11');
  for (const row of w.game.registry.table<{ id: string }>('labors').rows.slice(1)) {
    const on = keep.includes(row.id) || (haul && row.id === 'hauling') || (row.id === 'trading' && state.economy.broker?.id === dwarfId);
    if (jobs.laborEnabled(dwarfId, row.id) !== on) command(w, { type: 'SetLabor', dwarfId, labor: row.id, on });
  }
}

/** F-17h: true while the squad's metal chain still owes the three soldiers their kit. */
export function armingSquad(state: FortressState): boolean {
  return state.economy.phases.has('arming');
}

interface MineBand { readonly x: number; readonly y: number; readonly zMin: number; readonly zMax: number; readonly deep: boolean }

/** The upper-rock mine, above the cavern bands, off its own shaft south of the entrance. */
export function upperBand(w: TestWorld, state: FortressState): MineBand {
  return { x: state.cx + 6, y: Math.min(w.map.h - 3, state.cy + 15), zMin: UPPER_MINE_BOTTOM, zMax: state.hallZ, deep: false };
}

/** Every tile of the 3x3x3 block around `t` is dry rock or the fortress's own workings. */
function sealed(w: TestWorld, state: FortressState, t: number): boolean {
  const map = w.map;
  const shaft = state.economy.deepShaft;
  const radius = map.zOf(t) >= CAVERN_1_Z_MIN && map.zOf(t) <= CAVERN_1_Z_MAX ? THREAT_RADIUS : 1;
  for (let dz = -1; dz <= 1; dz += 1) for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
    const n = map.offset(t, dx, dy, dz);
    if (n < 0 || map.fluidLevelAt(n) !== 0) return false;
    if (map.kindAt(n) === TileKind.Wall) continue;
    const ownShaft = shaft !== undefined && map.xOf(n) === shaft.x && map.yOf(n) === shaft.y && map.zOf(n) >= shaft.bottom;
    const own = state.economy.workings.has(n) || ownShaft || map.zOf(n) >= UPPER_MINE_BOTTOM;
    if (!own || !map.hasFlag(n, TileFlag.Discovered)) return false;
  }
  return true;
}

/**
 * Dig to the nearest deposits of a band: an L-shaped drift from the band's shaft on the deposit's
 * own level. In the deep band (the cavern levels and the rock under them) a careful miner drifts
 * only through solid, dry rock, so a drift that would open a cavern or a lake is not dug.
 */
function mine(w: TestWorld, state: FortressState, band: MineBand, wanted: (id: string, cls: string) => boolean, limit: number, priority = ROUTINE): number {
  const { economy } = state;
  const map = w.map;
  const materials = w.game.registry.table<{ id: string; class: string }>('materials');
  const candidates: number[] = [];
  for (let z = band.zMin; z <= band.zMax; z += 1) {
    for (let y = 2; y < map.h - 2; y += 1) {
      for (let x = 2; x < map.w - 2; x += 1) {
        const t = w.index(x, y, z);
        const mat = materials.byIndex(map.materialAt(t));
        if (map.kindAt(t) === TileKind.Wall && mat && wanted(mat.id, mat.class) && !economy.mined.has(t)) candidates.push(t);
      }
    }
  }
  // Generation's own tile data chooses the nearest accessible deposit, never a reseeded map.
  candidates.sort((a, b) => {
    const distance = (t: number): number => Math.abs(map.xOf(t) - band.x) + Math.abs(map.yOf(t) - band.y) + (band.zMax - map.zOf(t)) * 4;
    return distance(a) - distance(b) || a - b;
  });
  const dig = new Set<number>();
  let taken = 0;
  for (const t of candidates) {
    if (taken >= limit) break;
    const x = map.xOf(t), y = map.yOf(t), z = map.zOf(t);
    // Reuse the nearest open, connected drift instead of digging every route again from the
    // shaft. The hall corridors are already workings on the upper floor.
    const fromLabel = w.readers.pathing.labelOf(w.index(band.x, band.y, z), 'walker');
    let startX = band.x, startY = band.y, distance = Math.abs(x - startX) + Math.abs(y - startY);
    if (fromLabel !== 0) for (let yy = 2; yy < map.h - 2; yy += 1) for (let xx = 2; xx < map.w - 2; xx += 1) {
      const open = w.index(xx, yy, z);
      const d = Math.abs(x - xx) + Math.abs(y - yy);
      if (d >= distance || !map.hasFlag(open, TileFlag.Discovered) ||
          ![TileKind.Floor, TileKind.StairsUp, TileKind.StairsDown, TileKind.StairsUpDown].includes(map.kindAt(open)) ||
          (band.deep && !economy.workings.has(open) && !(xx === band.x && yy === band.y)) ||
          w.readers.pathing.labelOf(open, 'walker') !== fromLabel) continue;
      startX = xx; startY = yy; distance = d;
    }
    const horizontal: number[] = [], vertical: number[] = [];
    for (let xx = Math.min(startX, x); xx <= Math.max(startX, x); xx += 1) {
      horizontal.push(w.index(xx, startY, z)); vertical.push(w.index(xx, y, z));
    }
    for (let yy = Math.min(startY, y); yy <= Math.max(startY, y); yy += 1) {
      horizontal.push(w.index(x, yy, z)); vertical.push(w.index(startX, yy, z));
    }
    const newRock = (path: number[]): number => path.filter(d => map.kindAt(d) === TileKind.Wall && !dig.has(d) && !economy.workings.has(d)).length;
    const drift = newRock(horizontal) <= newRock(vertical) ? horizontal : vertical;
    const fresh = drift.filter((d) => map.kindAt(d) === TileKind.Wall && !(map.xOf(d) === band.x && map.yOf(d) === band.y));
    if (band.deep && !fresh.every((d) => dig.has(d) || sealed(w, state, d))) continue;
    for (const d of fresh) { dig.add(d); economy.workings.add(d); }
    economy.mined.add(t);
    taken += 1;
  }
  const tiles = [...dig].filter((t) => map.fluidLevelAt(t) === 0 && !map.hasFlag(t, TileFlag.Constructed));
  if (tiles.length) {
    const result = command(w, { type: 'Designate', kind: 'dig', priority, tiles });
    if (!result.ok) throw new Error(`economy mine: ${result.reason}`);
  }
  return taken;
}

/**
 * F-17i: a second shaft from the upper mine's lowest level down through solid rock, as deep as
 * `bottom` if the rock allows. The column nearest the upper shaft whose every level is solid, dry
 * rock is chosen; a miner who met a cavern would stop and pick another spot.
 */
function openDeepShaft(w: TestWorld, state: FortressState, bottom: number, priority: number): MineBand | null {
  const map = w.map;
  const upper = upperBand(w, state);
  const top = upper.zMin;
  /** The deepest level the column at (x, y) reaches below `start` through solid dry rock. */
  const depthAt = (x: number, y: number, start: number): number => {
    const solid = (level: number): boolean => {
      const radius = level >= CAVERN_1_Z_MIN && level <= CAVERN_1_Z_MAX ? THREAT_RADIUS : 1;
      for (let dz = -1; dz <= 0; dz += 1) for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
        const t = map.offset(w.index(x, y, level), dx, dy, dz);
        if (t < 0 || map.fluidLevelAt(t) !== 0 || map.kindAt(t) !== TileKind.Wall) return false;
      }
      return true;
    };
    let z = start;
    while (z - 1 >= bottom && solid(z - 1)) z -= 1;
    return z;
  };
  const columns: { x: number; y: number; d: number; reach: number }[] = [];
  for (let y = 3; y < map.h - 3; y += 1) for (let x = 3; x < map.w - 3; x += 1) {
    const d = Math.abs(x - upper.x) + Math.abs(y - upper.y);
    // The shaft head itself is dug on the upper mine's lowest level, through solid rock.
    const head = w.index(x, y, top);
    if (d < 3 || d > map.w + map.h || map.kindAt(head) !== TileKind.Wall || map.fluidLevelAt(head) !== 0) continue;
    columns.push({ x, y, d, reach: depthAt(x, y, top) });
  }
  // The nearest column that goes all the way down; failing that, the deepest one the rock allows.
  const deepest = Math.max(bottom, Math.min(top, ...columns.map((c) => c.reach)));
  if (deepest >= top) return null;
  columns.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  for (const c of columns) {
    const reach = Math.max(bottom, c.reach);
    if (reach > deepest) continue;
    const drift: number[] = [];
    for (let xx = Math.min(upper.x, c.x); xx <= Math.max(upper.x, c.x); xx += 1) drift.push(w.index(xx, upper.y, top));
    for (let yy = Math.min(upper.y, c.y); yy <= Math.max(upper.y, c.y); yy += 1) drift.push(w.index(c.x, yy, top));
    const fresh = drift.filter((t) => map.kindAt(t) === TileKind.Wall && !(map.xOf(t) === upper.x && map.yOf(t) === upper.y));
    if (!fresh.every((t) => map.fluidLevelAt(t) === 0)) continue;
    // Down stairs are worked on the tile itself: excavate their head before carving the shaft.
    if (fresh.length) command(w, { type: 'Designate', kind: 'dig', priority, tiles: fresh });
    for (const t of fresh) state.economy.workings.add(t);
    state.economy.deepShaft = { x: c.x, y: c.y, bottom: reach };
    return { x: c.x, y: c.y, zMin: reach, zMax: top - 1, deep: true };
  }
  return null;
}

/** F-17f: tiles no workshop footprint (and so none of its temporary forbidden corners) may touch. */
export function keptClear(w: TestWorld, state: FortressState, tile: number): boolean {
  const x = w.map.xOf(tile), y = w.map.yOf(tile);
  const near = (cx: number, cy: number, r: number): boolean => Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= r;
  // The entrance stair, its gate walls and doors, and the tile outside each door.
  if (near(state.cx + 6, state.cy + 6, ENTRANCE_CLEARANCE)) return true;
  // The mine shaft's column and the tiles around it.
  if (near(state.cx + 6, Math.min(w.map.h - 3, state.cy + 15), SHAFT_CLEARANCE)) return true;
  const deep = state.economy.deepShaft;
  return deep !== undefined && near(deep.x, deep.y, SHAFT_CLEARANCE);
}

/** Place a workshop near (dx, dy) of the fortress centre. `key` names a second or third workshop of one type. */
export function placeEconomyBuilding(w: TestWorld, state: FortressState, type: string, dx: number, dy: number, priority = BUILD, key = type): void {
  if (state.placedIds[key]) {
    const built = w.readers.of<BuildingsReader>('14').get(state.placedIds[key]!);
    if (built?.state === 'built' && state.economy.phases.has(`traffic:${key}`)) {
      command(w, { type: 'SetTraffic', tiles: [0, 2, 6, 8].map((i) => built.footprint[i]!), mode: 'normal' });
      state.economy.phases.delete(`traffic:${key}`);
    }
    return;
  }
  const buildings = w.readers.of<BuildingsReader>('14');
  const candidates: number[] = [];
  for (let y = Math.max(2, state.cy + dy - 12); y <= Math.min(w.map.h - 4, state.cy + dy + 12); y += 1) {
    for (let x = Math.max(2, state.cx + dx - 12); x <= Math.min(w.map.w - 4, state.cx + dx + 12); x += 1) candidates.push(w.index(x, y, state.z));
  }
  candidates.sort((a, b) => {
    const distance = (t: number): number => Math.abs(w.map.xOf(t) - state.cx - dx) + Math.abs(w.map.yOf(t) - state.cy - dy);
    return distance(a) - distance(b) || a - b;
  });
  // A caravan's guards and pack animals stand on the ring around the depot (20 § Arrival); a
  // workshop finished there walls one of them in and the caravan never leaves. Keep the ring and
  // a walking lane beyond it clear of every other building.
  const depot = type === 'trade_depot' ? undefined : buildings.get(state.placedIds['trade_depot'] ?? 0);
  const nearDepot = (tile: number): boolean => depot !== undefined && depot.footprint.some((d) =>
    Math.max(Math.abs(w.map.xOf(d) - w.map.xOf(tile)), Math.abs(w.map.yOf(d) - w.map.yOf(tile))) <= DEPOT_CLEARANCE);
  // The depot is placed after the first workshops: its ring must not take in one of them either.
  const others = type === 'trade_depot' ? Object.values(state.placedIds).flatMap((id) => buildings.get(id)?.footprint ?? []) : [];
  const crowdsDepot = (tile: number): boolean => others.some((o) =>
    Math.max(Math.abs(w.map.xOf(o) - w.map.xOf(tile)), Math.abs(w.map.yOf(o) - w.map.yOf(tile))) <= DEPOT_CLEARANCE);
  const fits = (t: number): boolean => {
    const ghost = buildings.ghost(type, t, 0);
    return ghost.reason === null && ghost.tiles.every((tile) => buildings.zoneAt(tile) === 0 && !nearDepot(tile) && !crowdsDepot(tile) && !keptClear(w, state, tile) &&
      !w.game.world.entities.with(C.Creature).some((id) => {
        const p = w.game.world.entities.get(id, C.Position);
        return p && w.index(p.x, p.y, p.z) === tile;
      }));
  };
  let origin = candidates.find(fits);
  // T-451: a small plateau has no room at the fortress's level; the next surface level the dwarves
  // can walk to takes the workshop. On level ground no column's surface lies on another level.
  if (origin === undefined) {
    const elsewhere: number[] = [];
    for (let y = 2; y <= w.map.h - 4; y += 1) for (let x = 2; x <= w.map.w - 4; x += 1) {
      const top = w.map.columnSurfaceZ(x, y);
      if (top !== state.z && onWagonSide(w, w.index(x, y, top))) elsewhere.push(w.index(x, y, top));
    }
    elsewhere.sort((a, b) => {
      const distance = (t: number): number => Math.abs(w.map.xOf(t) - state.cx - dx) + Math.abs(w.map.yOf(t) - state.cy - dy) + 4 * Math.abs(w.map.zOf(t) - state.z);
      return distance(a) - distance(b) || a - b;
    });
    origin = elsewhere.find(fits);
  }
  if (origin === undefined) return;
  const result = command(w, { type: 'PlaceBuilding', buildingType: type, origin, orientation: 0, materialChoice: 0, priority });
  if (result.ok) {
    state.placedIds[key] = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding;
    const b = buildings.get(state.placedIds[key]!)!;
    if (type === 'trade_depot') {
      // Guards and pack animals stand outside the footprint: clear their standing ring too.
      const trees = new Set<number>();
      for (const tile of b.footprint) for (let dy = -DEPOT_CLEARANCE; dy <= DEPOT_CLEARANCE; dy++) for (let dx = -DEPOT_CLEARANCE; dx <= DEPOT_CLEARANCE; dx++) {
        const t = w.map.offset(tile, dx, dy, 0);
        if (t >= 0 && w.map.kindAt(t) === TileKind.Tree) trees.add(t);
      }
      if (trees.size) command(w, { type: 'Designate', kind: 'chop', tiles: [...trees], priority: ROUTINE });
    }
    if (b.footprint.length === 9 && type !== 'trade_depot') {
      // T-451: with its corners forbidden a site is entered by its four sides; where trees close
      // them all, the builder and anything lying on the site are shut out, so the ring is felled.
      const edge = [1, 3, 5, 7].map((i) => b.footprint[i]!);
      const outward = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;
      const open = edge.some((tile, k) => {
        const out = w.map.offset(tile, outward[k]![0], outward[k]![1], 0);
        return out >= 0 && w.readers.pathing.passable(out, 'walker');
      });
      if (!open) {
        const ring = new Set<number>();
        for (const tile of b.footprint) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          const t = w.map.offset(tile, dx, dy, 0);
          if (t >= 0 && w.map.kindAt(t) === TileKind.Tree) ring.add(t);
        }
        if (ring.size) command(w, { type: 'Designate', kind: 'chop', tiles: [...ring], priority: ROUTINE });
      }
      command(w, { type: 'SetTraffic', tiles: [0, 2, 6, 8].map((i) => b.footprint[i]!), mode: 'forbidden' });
      state.economy.phases.add(`traffic:${key}`);
    }
  }
}

/** A founder holds the Broker title from the first day; the next adult takes it if the holder dies. */
export function assignBroker(w: TestWorld, state: FortressState): void {
  const adults = fortressDwarves(w);
  if (state.economy.broker && adults.includes(state.economy.broker.id)) return;
  const founders = w.game.arrival?.dwarves ?? [];
  const miners = new Set(founders.slice(0, 2));
  const trader = [founders[BROKER_FOUNDER], ...adults].find((id) => id !== undefined && adults.includes(id) && !miners.has(id));
  if (trader === undefined) return;
  const result = command(w, { type: 'AssignTitle', title: 'broker', dwarfId: trader });
  if (!result.ok) return;
  state.economy.broker = { id: trader };
  if (!w.readers.of<JobsReader>('11').laborEnabled(trader, 'trading')) command(w, { type: 'SetLabor', dwarfId: trader, labor: 'trading', on: true });
}

export function trade(w: TestWorld, state: FortressState): void {
  const reader = w.readers.of<TradeReader>('20');
  const buildings = w.readers.of<BuildingsReader>('14');
  const depot = buildings.depots()[0];
  if (!depot) return;
  const ent = w.game.world.entities;
  const types = w.game.registry.table<{ id: string; category: string; mult: number }>('items');
  const items = w.readers.of<ItemsReader>('13');
  const active = reader.activeCaravan();
  const awaitingAnvil = owned(w, 'anvil') === 0 && buildings.get(state.placedIds['forge'] ?? 0)?.state !== 'built';
  const iron = w.game.registry.table<{ id: string; value: number }>('materials');
  const anvilValue = iron.byIndex(iron.index('iron'))!.value * types.byIndex(types.index('anvil'))!.mult / 1000;
  const anvilCapital = requiredValue(merchantPrice(anvilValue), reader.marginPercent('mountainhome'));
  // Count committed cargo too: do not bury the exports in hundreds of one-log hauling jobs.
  let committed = reader.depotItems().reduce((sum, id) => sum + reader.valuation('mountainhome', id), 0);
  for (const job of w.readers.of<JobsReader>('11').list()) if (job.key.startsWith('depot:')) {
    committed += reader.valuation('mountainhome', job.target.ref);
  }

  const jobs = w.readers.of<JobsReader>('11');
  if (state.economy.broker && !fortressDwarves(w).includes(state.economy.broker.id)) {
    delete state.economy.broker;
  }
  assignBroker(w, state);
  if (jobs.laborPriority('trading') !== (active ? DEADLINE : ROUTINE)) command(w, { type: 'SetLaborPriority', labor: 'trading', priority: active ? DEADLINE : ROUTINE });
  // Export crafts and surplus prepared meals, as balance.md's caravan arithmetic describes.
  const population = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;
  let mealSurplus = items.available('easy_meal') + items.available('fine_meal') + items.available('lavish_meal') - Math.ceil(population * 0.48 * MEAL_RESERVE_DAYS);
  // Reserve stones for the unfilled masonry orders, accounting for furniture already made.
  // A full stock of blocks/furniture does not still need another forty input stones.
  const stoneReserve = Math.ceil(Math.max(0, 30 - items.count('stone_block')) / 2) +
    Math.max(0, 14 - items.count('chair')) + Math.max(0, 6 - items.count('table')) + Math.max(0, 4 - items.count('door'));
  let stoneSurplus = items.available('raw_stone') - stoneReserve;
  let logSurplus = items.available('log') - TIMBER_RESERVE;
  // Stone and logs go to the depot while the anvil is still to be paid for, and whenever a
  // visiting caravan would otherwise find too little to trade for.
  const thinCargo = (): boolean => (awaitingAnvil && committed < anvilCapital) || (active !== null && committed < VISIT_CARGO);
  const exports = ent.with(C.Item).filter((id) => {
    const it = ent.get(id, C.Item);
    if (!it || it.carriedBy || jobs.byKey(`depot:${id}`) ||
      (it.flags & (ItemFlag.Foreign | ItemFlag.Merchant | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Installed | ItemFlag.AtDepot))) return false;
    const type = types.byIndex(it.type);
    if (type?.category.startsWith('craft/')) { committed += reader.valuation('mountainhome', id); return true; }
    if (type?.id === 'lavish_meal' && reader.activeCaravan() && mealSurplus >= it.count) { mealSurplus -= it.count; return true; }
    if (type?.id === 'raw_stone' && stoneSurplus >= it.count && thinCargo()) { stoneSurplus -= it.count; committed += reader.valuation('mountainhome', id); return true; }
    if (type?.id === 'log' && logSurplus >= it.count && thinCargo()) { logSurplus -= it.count; committed += reader.valuation('mountainhome', id); return true; }
    return false;
  }).sort((a, b) => Number(types.byIndex(ent.get(a, C.Item)!.type)?.id === 'raw_stone') - Number(types.byIndex(ent.get(b, C.Item)!.type)?.id === 'raw_stone') || a - b).slice(0, 20);
  if (exports.length) {
    const result = command(w, { type: 'MoveToDepot', depotId: depot, itemIds: exports });
    if (result.ok) for (const id of exports) {
      const job = jobs.byKey(`depot:${id}`);
      // F-17g: export hauling is routine; a visiting caravan's deadline warrants one step.
      if (job && reprioritised(job)) command(w, { type: 'SetJobPriority', jobId: job.id, priority: reader.activeCaravan() ? DEADLINE : ROUTINE });
    }
  }
  const caravan = reader.activeCaravan();
  // Exports queued between visits need the same deadline step as newly queued exports.
  for (const job of jobs.list('open')) if (job.key.startsWith('depot:') && job.priority !== (caravan ? DEADLINE : ROUTINE)) {
    command(w, { type: 'SetJobPriority', jobId: job.id, priority: caravan ? DEADLINE : ROUTINE });
  }
  if (!caravan || caravan.state !== 'atDepot') return;
  const day = Math.floor(w.tick / TICKS_PER_DAY);
  // One trade for each visit: the key is the visit, counted from the arrivals seen so far.
  const key = `${threeYearsMeasurements(w).caravans.filter((c) => c.state === 'CaravanArrived').length}:${caravan.civ}`;
  if (state.economy.traded.has(key)) return;
  if (!reader.sessionOpen()) {
    command(w, { type: 'TradeOpen', depotId: depot });
    const job = w.readers.of<JobsReader>('11').byKey(`trade:${depot}`);
    if (job && reprioritised(job)) command(w, { type: 'SetJobPriority', jobId: job.id, priority: DEADLINE });
    return;
  }
  const give = reader.depotItems().filter((id) => {
    const type = types.byIndex(ent.get(id, C.Item)?.type ?? -1);
    return (type?.category.startsWith('craft/') || type?.id === 'lavish_meal' || type?.id === 'raw_stone' || type?.id === 'log') && reader.valuation(caravan.civ, id) > 0;
  });
  const budget = give.reduce((s, id) => s + reader.valuation(caravan.civ, id), 0);
  if (budget === 0) return;
  const priority = (id: number): number => {
    const it = ent.get(id, C.Item);
    const type = types.byIndex(it?.type ?? -1)?.id ?? '';
    if (type === 'anvil' && awaitingAnvil && id === anvil) return 0;
    if (type === 'log' && items.available('log') < 40) return 1;
    if (type === 'bar' || type === 'charcoal_bar') return 2;
    // Armour and bandages for the squad that meets the boars, ahead of everything but the anvil.
    if (SQUAD_PURCHASES.includes(type)) return 1;
    // Seed of a crop the plots sow, and drink for the winter; hops, flax and sporecloth feed nobody.
    if (type === 'seed') return USEFUL_SEED.has(w.game.registry.table<{ id: string }>('materials').byIndex(it?.material ?? -1)?.id ?? '') ? 1 : 6;
    if (type === 'drink') return 2;
    if (type === 'plant_food') return 3;
    if (type === 'cloth' || type === 'thread') return 4;
    if (type === 'rough_gem') return 5;
    return 6;
  };
  const onOffer = reader.merchantItems().filter((id) => ent.get(id, C.Item)?.containerId === depot && !ent.get(id, C.Item)?.occupantId);
  // One anvil is enough: the first on offer.
  const anvil = onOffer.find((id) => types.byIndex(ent.get(id, C.Item)!.type)?.id === 'anvil') ?? 0;
  const goods = [...onOffer]
    .sort((a, b) => priority(a) - priority(b) || a - b);
  // Retain capital for the requested anvil instead of spending it on bars before a forge exists.
  const cheapest = Math.min(...goods.filter(id => priority(id) !== 6).map(id =>
    requiredValue(reader.price(caravan.civ, id) / ent.get(id, C.Item)!.count, reader.marginPercent(caravan.civ))));
  const capital = awaitingAnvil && !goods.some(id => types.byIndex(ent.get(id, C.Item)!.type)?.id === 'anvil' &&
      requiredValue(reader.price(caravan.civ, id), reader.marginPercent(caravan.civ)) <= budget)
    ? Math.min(Math.max(0, budget - cheapest), anvilCapital) : 0;
  const spending = Math.max(0, budget - capital);
  const take: { itemId: number; count: number }[] = [];
  let cost = 0;
  const wanted = goods.some((id) => priority(id) !== 6);
  let seedTaken = 0;
  for (const id of goods) {
    // A visit that carries nothing on the wish list still trades: the first affordable goods.
    if (wanted ? priority(id) === 6 : take.length > 0) continue;
    const it = ent.get(id, C.Item)!;
    const unitPrice = reader.price(caravan.civ, id) / it.count;
    // Seed is bought for the strips still to be sown, not by the hundred.
    const isSeed = types.byIndex(it.type)?.id === 'seed';
    const wantedUnits = isSeed ? Math.max(0, SEED_PER_VISIT - seedTaken) : it.count;
    const count = Math.min(it.count, wantedUnits, Math.floor((Math.floor(spending) / (1 + reader.marginPercent(caravan.civ) / 100) - cost) / unitPrice));
    if (count > 0) { take.push({ itemId: id, count }); cost += unitPrice * count; if (isSeed) seedTaken += count; }
  }
  if (!take.length || requiredValue(cost, reader.marginPercent(caravan.civ)) > budget) {
    if (state.economy.lastTradeNote !== key) {
      state.economy.lastTradeNote = key;
      note('three_years_trade', { day, civ: caravan.civ, offer: 'none', budget: Math.floor(budget), goods: goods.length, wanted });
    }
    return;
  }
  // Offer just enough crafts, keeping surplus exports for the next caravan.
  let offered = 0;
  const selected: { itemId: number; count: number }[] = [];
  for (const id of give) {
    const it = ent.get(id, C.Item)!;
    const value = reader.valuation(caravan.civ, id) / it.count;
    const count = Math.min(it.count, Math.ceil((requiredValue(cost, reader.marginPercent(caravan.civ)) - offered) / value));
    if (count > 0) { selected.push({ itemId: id, count }); offered += count * value; }
    if (offered >= requiredValue(cost, reader.marginPercent(caravan.civ))) break;
  }
  const foreign = new Set(w.game.world.entities.with(C.Item).filter((id) => (w.game.world.entities.get(id, C.Item)!.flags & ItemFlag.Merchant) !== 0));
  const result = command(w, { type: 'TradeOffer', give: selected, take });
  note('three_years_trade', { day, civ: caravan.civ, ok: result.ok, reason: result.ok ? null : result.reason, budget: Math.floor(budget), cost: Math.floor(cost),
    take: take.map((t) => `${types.byIndex(ent.get(t.itemId, C.Item)?.type ?? -1)?.id ?? 'gone'}x${t.count}`) });
  const acquired = w.game.world.entities.with(C.Item).filter((id) => (foreign.has(id) && (ent.get(id, C.Item)!.flags & ItemFlag.Merchant) === 0) ||
    (!foreign.has(id) && !give.includes(id) && ent.get(id, C.Item)?.containerId === depot));
  if (result.ok && acquired.length > 0) {
    const purchasesNow = reader.depotItems().filter((id) => !give.includes(id) && ((foreign.has(id) && (ent.get(id, C.Item)!.flags & ItemFlag.Merchant) === 0) || !foreign.has(id)));
    for (const id of purchasesNow) threeYearsMeasurements(w).purchases.add(id);
    state.economy.traded.add(key);
    command(w, { type: 'TradeCancel' });
    const purchases = reader.depotItems().filter((id) => !types.byIndex(ent.get(id, C.Item)?.type ?? -1)?.category.startsWith('craft/'));
    if (purchases.length) command(w, { type: 'RemoveFromDepot', depotId: depot, itemIds: purchases });
  }
}

/** F-17h: the squad's metal chain, staffed from day 1 and released once the kit is forged. */
function checkArming(w: TestWorld, state: FortressState, first: boolean, day: number): void {
  const { phases, specialists } = state.economy;
  const items = w.readers.of<ItemsReader>('13');
  const buildings = w.readers.of<BuildingsReader>('14');
  const founders = w.game.arrival?.dwarves ?? [];
  // With an anvil in the wagon (perils 2 and 4) two founders leave general work for the metal
  // chain: the mason cuts its blocks and runs the furnace and smelter, the smith takes the forge.
  if (first && items.count('anvil') > 0 && founders.length >= 7) {
    phases.add('arming');
    specialists['forge'] = founders[6]!;
    specialists['smelter'] = founders[3]!;
    dedicate(w, state, founders[6]!, ['smithing', 'smelting', 'masonry', 'construction']);
    dedicate(w, state, founders[3]!, ['masonry', 'smelting', 'construction']);
  }
  if (!armingSquad(state)) return;
  const built = (type: string): boolean => buildings.get(state.placedIds[type] ?? 0)?.state === 'built';
  const smith = specialists['forge'];
  // Once his forge stands the smith does nothing but metal.
  if (smith !== undefined && built('forge') && !phases.has('smith at forge')) {
    phases.add('smith at forge');
    dedicate(w, state, smith, ['smithing', 'smelting']);
    if (w.game.world.entities.alive(smith)) command(w, { type: 'SetWorkshopWorker', workshopId: state.placedIds['forge'], dwarfId: smith });
  }
  if (!SQUAD_KIT_ITEMS.every((item) => items.count(item) >= SQUAD_SIZE)) return;
  // The kit is forged: the general economy takes the chain and its second worker back.
  phases.delete('arming');
  phases.add('armed');
  state.economy.armedDay = day;
  const hand = specialists['smelter'];
  if (hand !== undefined) {
    dedicate(w, state, hand, w.game.registry.table<{ id: string; defaultOn: boolean }>('labors').rows.slice(1)
      .filter((r) => r.defaultOn && !['mining', 'woodcutting'].includes(r.id)).map((r) => r.id));
    delete specialists['smelter'];
  }
  for (const type of ['wood_furnace', 'smelter', 'forge', 'mason']) {
    const id = state.placedIds[type];
    const ws = id ? w.game.world.entities.get(id, C.Workshop) : undefined;
    for (const [index, o] of (ws?.orders ?? []).entries()) {
      if (o.priority !== ROUTINE) command(w, { type: 'EditWorkOrder', workshopId: id, index, patch: { priority: ROUTINE } });
    }
  }
}

/** F-17i: keep the best available specialist on each craft, using the labor manager. */
function checkSpecialists(w: TestWorld, state: FortressState): void {
  if (armingSquad(state)) return;
  const buildings = w.readers.of<BuildingsReader>('14');
  const dwarves = w.readers.of<DwarvesReader>('10');
  const adults = fortressDwarves(w);
  const chosen = state.economy.specialists;
  for (const [role, id] of Object.entries(chosen)) if (!adults.includes(id)) delete chosen[role];
  if (adults.length < SPECIALIST_MIN_POPULATION) return;
  // The founders' survival professions stay as they are: miners, woodcutter, mason, farmer, cook.
  const essential = new Set((w.game.arrival?.dwarves ?? []).filter((_, i) => [0, 2, 4, 5].includes(i)));
  for (const spec of SPECIALISTS) {
    const shopIds = spec.shops.map((s) => state.placedIds[s]).filter((id): id is number => id !== undefined && buildings.get(id)?.state === 'built');
    if (shopIds.length === 0) continue;
    if (spec.role === 'craftdwarf' && chosen[spec.role] === undefined && !state.economy.phases.has('stone craft staffed')) continue;
    // The gem-skilled miner opens the deposits before leaving mining for a supplied bench.
    if (spec.role === 'jeweler' && chosen[spec.role] === undefined && w.readers.of<ItemsReader>('13').count('rough_gem') === 0) continue;
    const taken = new Set(Object.entries(chosen).filter(([role]) => role !== spec.role).map(([, id]) => id));
    let current = chosen[spec.role];
    if (current === undefined) {
      const free = adults.filter((id) => !essential.has(id) && !taken.has(id));
      free.sort((a, b) => dwarves.skill(b, spec.skill) - dwarves.skill(a, spec.skill) || a - b);
      current = free[0];
      if (current === undefined) continue;
      chosen[spec.role] = current;
    }
    dedicate(w, state, current, spec.labors);
    for (const shopId of shopIds) {
      if (w.game.world.entities.get(shopId, C.Workshop)?.assignedWorker !== current) command(w, { type: 'SetWorkshopWorker', workshopId: shopId, dwarfId: current });
    }
  }
}

/** One dwarf keeps brewing as its only craft, so drink never waits behind the farm or the kitchen. */
function checkBrewer(w: TestWorld, state: FortressState): void {
  const adults = fortressDwarves(w);
  const { economy } = state;
  if (economy.brewer !== undefined && adults.includes(economy.brewer)) return;
  delete economy.brewer;
  if (adults.length < SPECIALIST_MIN_POPULATION) return;
  const founders = new Set(w.game.arrival?.dwarves ?? []);
  const taken = new Set([...Object.values(economy.specialists), economy.broker?.id ?? 0]);
  const dwarves = w.readers.of<DwarvesReader>('10');
  const free = adults.filter((id) => !founders.has(id) && !taken.has(id) && !w.game.world.entities.has(id, C.Soldier));
  free.sort((a, b) => dwarves.skill(b, 'brewing') - dwarves.skill(a, 'brewing') || a - b);
  if (free[0] === undefined) return;
  economy.brewer = free[0];
  dedicate(w, state, free[0], ['brewing']);
}

/** Kitchens and stills follow the dwarf count, and the lavish order follows it too. */
function checkKitchens(w: TestWorld, state: FortressState): void {
  const { phases } = state.economy;
  if (!phases.has('lavish')) return;
  const buildings = w.readers.of<BuildingsReader>('14');
  const ent = w.game.world.entities;
  const population = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;
  const recipes = w.game.registry.table('recipes');
  const lavish = Math.min(999, Math.max(120, Math.ceil(population * 0.48 * MEAL_DAYS)));
  for (let n = 1; n <= 3; n += 1) {
    const key = n === 1 ? 'kitchen' : `kitchen${n}`;
    if (n > 1 && population > (n - 1) * DWARVES_PER_KITCHEN) placeEconomyBuilding(w, state, 'kitchen', 4 * n, 14, BUILD, key);
    const id = state.placedIds[key];
    if (!id || buildings.get(id)?.state !== 'built') continue;
    if (n > 1 && !state.orderedWorkshops.has(key)) {
      state.orderedWorkshops.add(key);
      order(w, id, 'cook_lavish_meal', lavish);
      order(w, id, 'cook_easy_meal', EASY_MEALS_STOCKED);
    }
    const orders = ent.get(id, C.Workshop)?.orders ?? [];
    const at = orders.findIndex((o) => o.recipe === recipes.index('cook_lavish_meal'));
    if (at >= 0 && orders[at]!.threshold !== lavish) command(w, { type: 'EditWorkOrder', workshopId: id, index: at, patch: { threshold: lavish } });
  }
  if (population > DWARVES_PER_STILL) {
    placeEconomyBuilding(w, state, 'still', -4, 14, BUILD, 'still2');
    const id = state.placedIds['still2'];
    if (id && buildings.get(id)?.state === 'built' && !state.orderedWorkshops.has('still2')) {
      state.orderedWorkshops.add('still2');
      order(w, id, 'brew', drinkStock(population), undefined, ROUTINE - 1);
    }
    const orders = id ? w.game.world.entities.get(id, C.Workshop)?.orders ?? [] : [];
    const drink = drinkStock(population);
    if (orders[0] !== undefined && orders[0].threshold !== drink) command(w, { type: 'EditWorkOrder', workshopId: id, index: 0, patch: { threshold: drink } });
  }
}

/**
 * The farm follows the dwarf count. Caravans sell only surface seed (barley, turnip and the
 * like) and a harvest returns the one seed it was sown from, so the cave plots stay the size of
 * the wagon's cave seed and the growth is surface strips beside the first field, sown with
 * bought seed: turnip in three seasons, or barley with turnip in autumn.
 */
function checkFarm(w: TestWorld, state: FortressState): void {
  const map = w.map;
  const buildings = w.readers.of<BuildingsReader>('14');
  const plans = state.economy.farmPlans;
  const tilled = state.caveTiles1.length + state.caveTiles2.length + FIRST_FIELD_TILES + plans.reduce((sum, p) => sum + p.tiles.length, 0);
  if (plans.length >= FARM_STRIP.max || tilled >= (fortressDwarves(w).length + NEXT_WAVE) * FARM_TILES_PER_DWARF) return;
  const z = map.zOf(state.caveTiles1[0]!) + 1;
  // Strips run west of the first field, then in a second row south of it.
  const column = (plans.length % FARM_STRIP.columns) + 1;
  const row = Math.floor(plans.length / FARM_STRIP.columns);
  const x0 = state.cx - 8 - column * FARM_STRIP.width;
  const y0 = state.cy + 16 + row * FARM_STRIP.rows;
  const tiles: number[] = [];
  for (let y = y0; y < y0 + FARM_STRIP.rows; y += 1) for (let x = x0; x < x0 + FARM_STRIP.width; x += 1) {
    if (x < 2 || y < 2 || x >= map.w - 2 || y >= map.h - 2) continue;
    const t = w.index(x, y, z);
    if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t)) tiles.push(t);
  }
  const plan = { tiles, zoneId: -1 };
  plans.push(plan);
  if (tiles.length < FARM_STRIP.width || !command(w, { type: 'CreateZone', zoneType: 'farm_plot', tiles }).ok) { plan.tiles = []; return; }
  plan.zoneId = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastCreatedZone;
  const crops = plans.length % 2 === 1 ? ['turnip', 'turnip', 'turnip'] : ['barley', 'barley', 'turnip'];
  for (const [season, speciesId] of crops.entries()) command(w, { type: 'SetPlotCrop', zoneId: plan.zoneId, season, speciesId });
}

/** Seed of each crop species the fortress owns, plus its crops in the ground (each harvest returns its seed). */
function seedSupply(w: TestWorld, sown = true): Map<string, number> {
  const ent = w.game.world.entities;
  const seed = w.game.registry.table('items').index('seed');
  const materials = w.game.registry.table<{ id: string }>('materials');
  const supply = new Map<string, number>();
  for (const id of ent.with(C.Item)) {
    const it = ent.get(id, C.Item)!;
    if (it.type !== seed || (it.flags & (ItemFlag.Merchant | ItemFlag.Foreign)) !== 0) continue;
    const species = materials.byIndex(it.material)?.id ?? '';
    supply.set(species, (supply.get(species) ?? 0) + it.count);
  }
  const plants = w.readers.of<PlantsReader>('07');
  if (sown) for (const crop of plants.crops()) {
    const species = plants.cropInfo(crop)?.species ?? '';
    supply.set(species, (supply.get(species) ?? 0) + 1);
  }
  return supply;
}

/**
 * The crops follow the seed. Each plot sows, season by season, the first crop of its list whose
 * seed (in stock or in the ground) covers half the plot after the plots before it have taken
 * theirs, and failing that the crop with the most seed left: a player reads the seed counts of the
 * plot panel. Cave plots keep one cave crop all year.
 */
function checkCrops(w: TestWorld): void {
  const plants = w.readers.of<PlantsReader>('07');
  const buildings = w.readers.of<BuildingsReader>('14');
  const supply = seedSupply(w);
  const plots = plants.plots().filter((z) => buildings.zone(z) !== undefined).sort((a, b) => a - b);
  const pick = (tiles: number, current: string, list: readonly string[], left: Map<string, number>): string => {
    if (current !== '' && list.includes(current) && (left.get(current) ?? 0) * 2 >= tiles) return current;
    const enough = list.find((sp) => (left.get(sp) ?? 0) * 2 >= tiles);
    if (enough !== undefined) return enough;
    const most = [...list].sort((a, b) => (left.get(b) ?? 0) - (left.get(a) ?? 0))[0]!;
    return (left.get(most) ?? 0) > 0 ? most : current;
  };
  const name = (index: number | undefined): string => (index ? plants.def(index)?.id ?? '' : '');
  const caveLeft = new Map(supply);
  for (const zoneId of plots.filter((z) => plants.plotKind(z) === 'cave')) {
    const tiles = buildings.zone(zoneId)!.tiles.length;
    const settings = plants.plotSettings(zoneId);
    const chosen = pick(tiles, name(settings[0]), CAVE_CROPS, caveLeft);
    if (chosen === '') continue;
    caveLeft.set(chosen, (caveLeft.get(chosen) ?? 0) - tiles);
    for (const season of [0, 1, 2, 3]) if (name(settings[season]) !== chosen) command(w, { type: 'SetPlotCrop', zoneId, season, speciesId: chosen });
  }
  for (const [season, list] of SURFACE_CROPS.entries()) {
    const left = new Map(supply);
    for (const zoneId of plots.filter((z) => plants.plotKind(z) === 'surface')) {
      const tiles = buildings.zone(zoneId)!.tiles.length;
      const current = name(plants.plotSettings(zoneId)[season]);
      const chosen = pick(tiles, current, list, left);
      if (chosen === '') continue;
      left.set(chosen, (left.get(chosen) ?? 0) - tiles);
      if (chosen !== current) command(w, { type: 'SetPlotCrop', zoneId, season, speciesId: chosen });
    }
  }
}

/** Cave seed beyond the cave plots' tiles is sown in a new cave strip, dug beside the first on its soil level. */
function checkCaveStrips(w: TestWorld, state: FortressState): void {
  const map = w.map;
  const plans = state.economy.cavePlans;
  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;
  for (const plan of plans) {
    if (plan.zoneId !== -1 || !plan.tiles.every((t) => map.kindAt(t) === TileKind.Floor)) continue;
    const tiles = plan.tiles.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
    plan.zoneId = 0;
    if (tiles.length > 0 && command(w, { type: 'CreateZone', zoneType: 'farm_plot', tiles }).ok) plan.zoneId = bSystem.lastCreatedZone;
  }
  if (plans.some((p) => p.zoneId === -1) || plans.length >= CAVE_STRIPS.length) return;
  // Cave seed in stock beyond what the cave plots' empty tiles will take.
  const stock = seedSupply(w, false);
  const plants = w.readers.of<PlantsReader>('07');
  const empty = plants.plots().filter((z) => plants.plotKind(z) === 'cave')
    .reduce((sum, z) => sum + (buildings.zone(z)?.tiles.filter((t) => plants.cropAt(t) === 0).length ?? 0), 0);
  const caveSeed = CAVE_CROPS.reduce((sum, sp) => sum + (stock.get(sp) ?? 0), 0);
  if (caveSeed - empty < CAVE_STRIP_SEED) return;
  const [x0, x1, y0, y1] = CAVE_STRIPS[plans.length]!;
  const z = map.zOf(state.caveTiles1[0]!);
  const terrain = w.readers.of<TerrainReader>('03');
  const tiles: number[] = [];
  for (let y = state.cy + y0; y <= state.cy + y1; y += 1) for (let x = state.cx + x0; x <= state.cx + x1; x += 1) {
    if (x < 2 || y < 2 || x >= map.w - 2 || y >= map.h - 2) continue;
    const t = w.index(x, y, z);
    if (map.kindAt(t) === TileKind.Wall && map.fluidLevelAt(t) === 0 && !terrain.designationAt(t)) tiles.push(t);
  }
  plans.push({ tiles, zoneId: tiles.length === 0 ? 0 : -1 });
  if (tiles.length > 0) command(w, { type: 'Designate', kind: 'dig', priority: ROUTINE, tiles });
}

/**
 * Meals and plants keep in barrels in a food stockpile (13 § Rot), and a stockpile takes them only
 * into a barrel (13 § Stockpiles): the pantry and a larder beside it want one barrel a tile.
 * Returns the barrels they want.
 */
function checkLarder(w: TestWorld, state: FortressState): number {
  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;
  const { economy } = state;
  if (!economy.phases.has('pantry')) return 0;
  if (!economy.phases.has('pantry barrels')) {
    const pantry = buildings.zoneAt(state.pantryTiles[0]!);
    if (pantry !== 0 && command(w, { type: 'SetStockpileContainers', zoneId: pantry, wants: { barrel: state.pantryTiles.length } }).ok) economy.phases.add('pantry barrels');
  }
  // The larder is dug once the first season's halls are done.
  if (economy.larder === undefined && w.tick >= 28 * TICKS_PER_DAY) {
    const tiles: number[] = [];
    for (const [x0, x1, y0, y1] of LARDER) for (let y = state.cy + y0; y <= state.cy + y1; y += 1) for (let x = state.cx + x0; x <= state.cx + x1; x += 1) {
      if (x >= 2 && y >= 2 && x < w.map.w - 2 && y < w.map.h - 2) tiles.push(w.index(x, y, state.hallZ));
    }
    // The part beside the west corridor keeps drink, so that the cellar holds more than a week.
    const drinkTiles = tiles.filter((t) => w.map.yOf(t) > state.cy + 2);
    economy.larder = { tiles: tiles.filter((t) => !drinkTiles.includes(t)), zoneId: -1, drinkTiles, drinkZoneId: -1 };
    const dig = tiles.filter((t) => w.map.kindAt(t) === TileKind.Wall);
    if (dig.length) command(w, { type: 'Designate', kind: 'dig', priority: ROUTINE, tiles: dig });
  }
  const larder = economy.larder;
  if (larder === undefined) return state.pantryTiles.length + DRINK_STOCKPILE_TILES;
  const stock = (part: number[], filter: string): number => {
    const tiles = part.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('stockpile', t));
    if (tiles.length === 0 || !command(w, { type: 'CreateZone', zoneType: 'stockpile', tiles }).ok) return 0;
    const zoneId = bSystem.lastCreatedZone;
    command(w, { type: 'SetStockpileFilter', zoneId, filter });
    command(w, { type: 'SetStockpilePriority', zoneId, priority: ROUTINE });
    // A drink stockpile keeps two thirds of its tiles free for the full barrels the stills make.
    command(w, { type: 'SetStockpileContainers', zoneId, wants: { barrel: filter === 'drink' ? Math.ceil(tiles.length / 3) : tiles.length } });
    return zoneId;
  };
  if (larder.zoneId === -1 && [...larder.tiles, ...larder.drinkTiles].every((t) => w.map.kindAt(t) !== TileKind.Wall)) {
    larder.zoneId = stock(larder.tiles, 'food');
    larder.drinkZoneId = stock(larder.drinkTiles, 'drink');
  }
  const size = (zoneId: number): number => (zoneId > 0 ? buildings.zone(zoneId)?.tiles.length ?? 0 : 0);
  return state.pantryTiles.length + DRINK_STOCKPILE_TILES + size(larder.zoneId) + Math.ceil(size(larder.drinkZoneId) / 3);
}

export function checkEconomy(w: TestWorld, state: FortressState): void {
  const day = Math.floor(w.tick / TICKS_PER_DAY);
  if (state.economy.lastDay === day) return;
  const first = state.economy.lastDay < 0;
  state.economy.lastDay = day;
  const { phases } = state.economy;
  const buildings = w.readers.of<BuildingsReader>('14');
  checkArming(w, state, first, day);
  // Give the growing settlement a builder rather than leaving every immigrant on food and
  // hauling: those higher-priority supply jobs otherwise consume all of the spare workforce.
  if (fortressDwarves(w).length >= SPECIALIST_MIN_POPULATION && state.economy.specialists['builder'] === undefined) {
    const founders = new Set(w.game.arrival?.dwarves ?? []);
    const taken = new Set(Object.values(state.economy.specialists));
    const available = fortressDwarves(w).filter(id => !founders.has(id) && !taken.has(id) && id !== state.economy.broker?.id);
    const dwarves = w.readers.of<DwarvesReader>('10');
    available.sort((a, b) => dwarves.skill(b, 'masonry') - dwarves.skill(a, 'masonry') || a - b);
    const builder = available[0];
    if (builder !== undefined) {
      state.economy.specialists['builder'] = builder;
      dedicate(w, state, builder, ['masonry', 'construction', 'smelting']);
    }
  }
  // Masonry includes hundreds of room-finishing jobs. Keep a separate furnace worker on fuel,
  // iron and alloy rather than asking the builder to smelt after every nearby smoothing job.
  if (fortressDwarves(w).length >= SPECIALIST_MIN_POPULATION && !armingSquad(state)) {
    const founders = new Set(w.game.arrival?.dwarves ?? []);
    const taken = new Set(Object.values(state.economy.specialists));
    let fuel = state.economy.specialists['fuel'];
    if (fuel === undefined) {
      const available = fortressDwarves(w).filter(id => !founders.has(id) && !taken.has(id) && id !== state.economy.broker?.id);
      const dwarves = w.readers.of<DwarvesReader>('10');
      available.sort((a, b) => dwarves.skill(b, 'smelting') - dwarves.skill(a, 'smelting') || a - b);
      fuel = available[0];
      if (fuel !== undefined) state.economy.specialists['fuel'] = fuel;
    }
    if (fuel !== undefined) {
      // T-362: no hauling. The furnaces lie far from where its needs take it, and an assigned
      // worker's 500-point bonus (11 § Assignment) is fifty tiles: with hauling on it took the
      // haul jobs beside the halls and left the smelter's job open for weeks.
      dedicate(w, state, fuel, ['smelting'], false);
      for (const type of ['wood_furnace', 'smelter']) {
        const id = state.placedIds[type];
        if (id && buildings.get(id)?.state === 'built' && w.game.world.entities.alive(fuel) && w.game.world.entities.get(id, C.Workshop)?.assignedWorker !== fuel) {
          command(w, { type: 'SetWorkshopWorker', workshopId: id, dwarfId: fuel });
        }
      }
    }
  }
  // Timber in small batches: the eight nearest trees whenever the log stock runs low.
  const items = w.readers.of<ItemsReader>('13');
  const terrain = w.readers.of<TerrainReader>('03');
  // Help build the initial stone rooms, then keep both miners on the supplied mine.
  if (!phases.has('miners released') && buildings.get(state.hearthBuildingId)?.state === 'built' && items.count('chair') >= 6) {
    for (const id of (w.game.arrival?.dwarves ?? []).slice(0, 2)) dedicate(w, state, id, ['mining'], false);
    phases.add('miners released');
  }
  const standing = state.timberTiles.filter((t) => w.map.kindAt(t) === TileKind.Tree);
  if (items.available('log') < TIMBER_RESERVE && standing.filter((t) => terrain.designationAt(t)).length < TIMBER_BATCH / 2) {
    const near = (t: number): number => Math.abs(w.map.xOf(t) - state.cx) + Math.abs(w.map.yOf(t) - state.cy - 10);
    const batch = standing.filter((t) => !terrain.designationAt(t)).sort((a, b) => near(a) - near(b) || a - b).slice(0, TIMBER_BATCH);
    if (batch.length) command(w, { type: 'Designate', kind: 'chop', priority: ROUTINE, tiles: batch });
  }
  const arming = armingSquad(state);
  const metalWorker = w.game.arrival?.dwarves[6];
  if (!arming && items.count('anvil') > 0 && fortressDwarves(w).length >= SPECIALIST_MIN_POPULATION && metalWorker !== undefined && !phases.has('metal staffed') &&
      ['still', 'kitchen'].every(type => buildings.get(state.placedIds[type] ?? 0)?.state === 'built')) {
    // The peaceful metal worker keeps the food/hauling support until the anvil is available.
    dedicate(w, state, metalWorker, ['smithing', 'smelting', 'masonry', 'carpentry', 'construction']);
    phases.add('metal staffed');
  }
  // Once immigrants provide spare hands, the mason starts stone exports after the
  // foundation workshops and hall chairs are supplied. Dangerous sites keep him on the squad chain until its kit is done.
  const stoneShop = state.placedIds['craftdwarf'];
  const stoneCrafter = w.game.arrival?.dwarves[3];
  if (!arming && fortressDwarves(w).length >= SPECIALIST_MIN_POPULATION && stoneCrafter !== undefined && buildings.get(stoneShop ?? 0)?.state === 'built' &&
      ['wood_furnace', 'smelter'].every(type => buildings.get(state.placedIds[type] ?? 0)?.state === 'built') &&
      buildings.get(state.hearthBuildingId)?.state === 'built' && items.count('chair') >= 6 &&
      state.economy.specialists['craftdwarf'] === undefined) {
    state.economy.specialists['craftdwarf'] = stoneCrafter;
    phases.add('stone craft staffed');
    dedicate(w, state, stoneCrafter, ['crafts']);
    if (w.game.world.entities.alive(stoneCrafter)) command(w, { type: 'SetWorkshopWorker', workshopId: stoneShop, dwarfId: stoneCrafter });
  }
  // F-17h: the mason's blocks, the furnace, the smelter and the forge come before all routine work.
  const metal = arming || phases.has('armed') || day >= 30;
  // The food shops go up with them: the embark drink lasts two weeks.
  if (arming) {
    for (const [type, dx] of [['carpenter', -8], ['still', 0], ['mason', -4], ['kitchen', 4], ['wood_furnace', -12], ['smelter', -16]] as const) placeEconomyBuilding(w, state, type, dx, 10, KIT_FIRST);
  }
  for (const [type, dx] of [['carpenter', -8], ['mason', -4], ['still', 0], ['kitchen', 4], ['craftdwarf', 8]] as const) placeEconomyBuilding(w, state, type, dx, 10);
  if (day >= 5) {
    placeEconomyBuilding(w, state, 'trade_depot', -9, 4);
    if (!phases.has('requests')) {
      phases.add('requests');
      // The farm grows only by bought seed (07: a harvest returns the one seed it was sown from):
      // cave seed from the Mountainhome for plots that bear in winter, surface seed of food crops.
      command(w, { type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'anvil', material: 'iron', priority: 3 },
        { itemType: 'seed', material: 'dimcap', priority: 3 }, { itemType: 'seed', material: 'pale_bell', priority: 2 }, { itemType: 'seed', material: 'sweetroot', priority: 2 },
        { itemType: 'mail_shirt', priority: 2 }, { itemType: 'bar', material: 'iron', priority: 1 }] });
      command(w, { type: 'SetRequests', civ: 'hillfolk', entries: [{ itemType: 'seed', material: 'turnip', priority: 3 },
        { itemType: 'seed', material: 'cabbage', priority: 2 }, { itemType: 'seed', material: 'barley', priority: 2 }, { itemType: 'bandage', priority: 2 }] });
      command(w, { type: 'SetRequests', civ: 'wildwood', entries: [{ itemType: 'seed', material: 'strawberry', priority: 3 },
        { itemType: 'seed', material: 'barley', priority: 2 }, { itemType: 'seed', material: 'pumpkin', priority: 2 }] });
    }
    trade(w, state);
  }
  if (metal) {
    placeEconomyBuilding(w, state, 'wood_furnace', -12, 10);
    placeEconomyBuilding(w, state, 'smelter', -16, 10);
    if (day >= 30) placeEconomyBuilding(w, state, 'jeweler', -20, 10);
    for (const type of ['wood_furnace', 'smelter', 'jeweler']) {
      const id = state.placedIds[type];
      if (!id || buildings.get(id)?.state !== 'built' || state.orderedWorkshops.has(type)) continue;
      state.orderedWorkshops.add(type);
      if (type === 'wood_furnace') order(w, id, 'make_charcoal', 40, undefined, arming ? KIT_FIRST : ROUTINE);
      if (type === 'jeweler') order(w, id, 'cut_gem', 30);
      if (type === 'smelter') for (const ore of ['hematite', 'limonite', 'magnetite']) order(w, id, `smelt_${ore}`, 40, undefined, arming ? KIT_FIRST : ROUTINE);
    }
  }

  const isOre = (id: string): boolean => ['hematite', 'limonite', 'magnetite'].includes(id);
  const isGem = (_id: string, cls: string): boolean => cls === 'gem';
  const isFlux = (id: string): boolean => ['limestone', 'marble', 'dolomite', 'chalk'].includes(id);
  const upper = upperBand(w, state);
  const shaft = (priority: number): boolean => {
    if (phases.has('shaft')) return true;
    // The shaft starts from the dug trunk corridor, so nothing is designated into unreached rock.
    if (w.map.kindAt(w.index(upper.x, upper.y, state.hallZ)) !== TileKind.Floor) return false;
    const result = command(w, { type: 'DesignateStairwell', x: upper.x, y: upper.y, zTop: state.hallZ, zBottom: upper.zMin, priority });
    if (result.ok) phases.add('shaft');
    return result.ok;
  };
  // F-17h: the ore for the squad's missing bars is opened as soon as the trunk corridor reaches
  // the shaft, a step ahead of the halls; T-387: and the shelter is dug (setupThreeYearsFortress).
  const shelterDug = (state.shelterTiles ?? []).every((t) => terrain.designationAt(t) === null);
  if (arming && !phases.has('squad ore') && shelterDug && shaft(KIT_FIRST)) {
    phases.add('squad ore');
    // Where the upper rock holds no iron the miners go straight down for it.
    if (mine(w, state, upper, isOre, SQUAD_ORE_FACES, KIT_FIRST) === 0) phases.add('squad ore deep');
  }
  for (const [start, name, count] of [[30, 'first mine', 30], [112, 'second mine', 60], [224, 'third mine', 60]] as const) {
    if (day < start || phases.has(name) || !shaft(ROUTINE)) continue;
    phases.add(name);
    mine(w, state, upper, isOre, count);
    // The jeweler's small supply is opened along with the bulk ore.
    mine(w, state, upper, isGem, 15);
    // Flux for the steel of year 3 is opened with the second mine, so a stock stands when the
    // alloy order comes (the craftdwarf's stone crafts take raw flux stone too).
    if (start >= 112) mine(w, state, upper, isFlux, 20);
  }
  // F-17i: years 2 and 3 open a deeper gem and ore band, through solid rock only. The deep shaft
  // starts from the upper mine's lowest level once the upper shaft has reached it.
  if ((day >= DAYS_PER_YEAR || phases.has('squad ore deep')) && !phases.has('deep shaft') && phases.has('shaft') && w.map.kindAt(w.index(upper.x, upper.y, upper.zMin)) !== TileKind.Wall) {
    phases.add('deep shaft');
    openDeepShaft(w, state, DEEP_BOTTOM_YEAR_3, arming ? KIT_FIRST : ROUTINE);
  }
  // Deep drifts are designated level by level as the shaft is actually dug, so each drift starts
  // from an open stair the miners can stand on: the cavern levels in year 2, the rock under them
  // in year 3.
  const deepShaft = state.economy.deepShaft;
  if (deepShaft) {
    if (!phases.has('deep stairs') && w.map.kindAt(w.index(deepShaft.x, deepShaft.y, upper.zMin)) === TileKind.Floor) {
      const stairs = command(w, { type: 'DesignateStairwell', x: deepShaft.x, y: deepShaft.y,
        zTop: upper.zMin, zBottom: deepShaft.bottom, priority: arming ? KIT_FIRST : ROUTINE });
      if (stairs.ok) phases.add('deep stairs');
    }
    for (let z = upper.zMin - 1; z >= deepShaft.bottom; z -= 1) {
      const name = `deep level ${z}`;
      if (z < DEEP_BOTTOM_YEAR_2 && day < 2 * DAYS_PER_YEAR && !arming) continue;
      if (phases.has(name) || w.map.kindAt(w.index(deepShaft.x, deepShaft.y, z)) === TileKind.Wall) continue;
      phases.add(name);
      const level: MineBand = { x: deepShaft.x, y: deepShaft.y, zMin: z, zMax: z, deep: true };
      mine(w, state, level, isOre, 12, arming ? KIT_FIRST : ROUTINE);
      mine(w, state, level, isGem, 12);
    }
    if (day >= 224 && phases.has('deep stairs') && !phases.has('deep flux')) {
      phases.add('deep flux');
      mine(w, state, { x: deepShaft.x, y: deepShaft.y, zMin: deepShaft.bottom, zMax: upper.zMin - 1, deep: true }, isFlux, STEEL_BATCH);
    }
  }

  const still = state.placedIds['still'];
  if (still && state.orderedWorkshops.has('still')) {
    const population = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
    const threshold = drinkStock(population);
    const ws = w.game.world.entities.get(still, C.Workshop);
    if (ws?.orders[0]?.threshold !== threshold) command(w, { type: 'EditWorkOrder', workshopId: still, index: 0, patch: { threshold } });
  }
  const foodBarrels = checkLarder(w, state);
  const carpenter = state.placedIds['carpenter'];
  if (carpenter && state.orderedWorkshops.has('carpenter')) {
    const recipes = w.game.registry.table('recipes');
    const orders = (): readonly { recipe: number; mode: string; threshold: number; remaining: number }[] => w.game.world.entities.get(carpenter, C.Workshop)?.orders ?? [];
    const standing = (): number => orders().findIndex((o) => o.recipe === recipes.index('make_barrel') && o.mode === 'maintain');
    const barrels = standing();
    // From the second season, barrels for every larder tile and three weeks of drink, and a few
    // spare for the still; the first season's carpenter has the beds and the squad's gear to make.
    const population0 = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
    // The brew stays in its barrel at the still (T-361), so the barrels that hold drink are made
    // on top of those the stockpiles want, or the drink stockpiles are left with none.
    const threshold = day < 2 * 28 ? 20 : Math.min(200, Math.max(20, foodBarrels + Math.ceil(Math.max(items.count('drink'), population0 * 0.77 * DRINK_DAYS) / 20) + 10));
    if (barrels >= 0 && orders()[barrels]!.threshold !== threshold) command(w, { type: 'EditWorkOrder', workshopId: carpenter, index: barrels, patch: { threshold } });
    // Beds come before barrels until every dwarf and the hospital has one.
    const population = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
    const beds = Math.min(state.bedroomPlans.filter((bp) => bp.designated).length, population + 1) - owned(w, 'bed');
    const bedOrder = orders().findIndex((o) => o.recipe === recipes.index('make_bed'));
    if (beds > 0 && bedOrder < 0) {
      const added = command(w, { type: 'AddWorkOrder', workshopId: carpenter, order: { recipeId: 'make_bed', mode: 'once', remaining: beds, priority: ROUTINE } });
      const at = standing();
      if (added.ok && at >= 0) command(w, { type: 'ReorderWorkOrder', workshopId: carpenter, from: orders().length - 1, to: at });
    } else if (bedOrder >= 0 && beds > orders()[bedOrder]!.remaining + 1) {
      command(w, { type: 'EditWorkOrder', workshopId: carpenter, index: bedOrder, patch: { remaining: beds } });
    }
  }
  const kitchen = state.placedIds['kitchen'];
  if (kitchen && state.orderedWorkshops.has('kitchen') && !phases.has('lavish') && items.count('easy_meal') >= EASY_MEALS_STOCKED) {
    phases.add('lavish');
    order(w, kitchen, 'cook_lavish_meal', 120);
    const last = (w.game.world.entities.get(kitchen, C.Workshop)?.orders.length ?? 1) - 1;
    command(w, { type: 'ReorderWorkOrder', workshopId: kitchen, from: last, to: 0 });
  }
  // The general metal economy takes the forge once the squad has its kit.
  const forge = state.placedIds['forge'];
  if (forge && state.orderedWorkshops.has('forge') && !arming && !phases.has('iron goods')) {
    phases.add('iron goods');
    // A first few iron crafts for the caravans come before the standing armour orders, which
    // never fill: a piece a soldier wears is no longer stock.
    const first = command(w, { type: 'AddWorkOrder', workshopId: forge,
      order: { recipeId: 'forge_crafts', mode: 'once', remaining: FIRST_IRON_CRAFTS, materialFilter: 'iron', priority: ROUTINE } });
    if (!first.ok) throw new Error(`economy iron crafts: ${first.reason}`);
    command(w, { type: 'ReorderWorkOrder', workshopId: forge, from: (w.game.world.entities.get(forge, C.Workshop)?.orders.length ?? 1) - 1, to: 0 });
    order(w, forge, 'forge_pick', 2, 'iron');
    order(w, forge, 'forge_battle_axe', 3, 'iron');
    for (const recipe of ['forge_helm', 'forge_greaves', 'forge_gauntlets', 'forge_metal_boots']) order(w, forge, recipe, 3, 'iron');
    // Missing steel inputs keep this standing order idle until year 3; no live job is canceled.
    order(w, forge, 'forge_crafts', 60, 'steel');
    order(w, forge, 'forge_crafts', 60, 'iron');
  }
  // F-17i: the alloy order is kept running through year 3, with flux mined for each new batch.
  const smelter = state.placedIds['smelter'];
  if (day >= 224 && smelter && state.orderedWorkshops.has('smelter')) {
    const alloy = w.game.registry.table('recipes').index('alloy_steel');
    const ws = w.game.world.entities.get(smelter, C.Workshop);
    if (ws && !ws.orders.some((o) => o.recipe === alloy)) {
      const result = command(w, { type: 'AddWorkOrder', workshopId: smelter,
        order: { recipeId: 'alloy_steel', mode: 'once', remaining: STEEL_BATCH, priority: ROUTINE } });
      if (!result.ok) throw new Error(`economy steel: ${result.reason}`);
      // The smelter takes its first runnable order (12 § Operation), and the iron orders below
      // 40 bars are always runnable: the steel goes first, and runs whenever flux is in stock.
      // A reorder cancels no job: an iron job already open finishes before the first steel job.
      const last = (w.game.world.entities.get(smelter, C.Workshop)?.orders.length ?? 1) - 1;
      if (last > 0) command(w, { type: 'ReorderWorkOrder', workshopId: smelter, from: last, to: 0 });
      if (phases.has('steel')) mine(w, state, upper, isFlux, STEEL_BATCH);
      phases.add('steel');
    }
  }
  // The steel chain's inputs, journalled weekly from the alloy order's day (observation only).
  if (day >= 217 && day % 7 === 0 && smelter) {
    const ent = w.game.world.entities;
    const mats = w.game.registry.table<{ id: string }>('materials');
    const types = w.game.registry.table<{ id: string }>('items');
    const flux = new Set(['limestone', 'marble', 'dolomite', 'chalk']);
    const stock: Record<string, number> = {};
    for (const id of ent.with(C.Item)) {
      const it = ent.get(id, C.Item)!;
      if ((it.flags & (ItemFlag.Merchant | ItemFlag.Foreign)) !== 0) continue;
      const t = types.byIndex(it.type)?.id ?? '';
      const m = mats.byIndex(it.material)?.id ?? '';
      const key = t === 'bar' ? `bar:${m}` : t === 'raw_stone' && flux.has(m) ? 'flux' : t === 'charcoal_bar' || m.endsWith('coal') || m === 'lignite' ? `fuel:${t}` : '';
      if (!key) continue;
      const free = (it.flags & (ItemFlag.Reserved | ItemFlag.Forbidden)) === 0;
      stock[key] = (stock[key] ?? 0) + it.count;
      if (free) stock[`${key}:free`] = (stock[`${key}:free`] ?? 0) + it.count;
    }
    const ws = ent.get(smelter, C.Workshop);
    const recipes = w.game.registry.table<{ id: string }>('recipes');
    const job = ws?.currentJobId ? w.readers.of<JobsReader>('11').get(ws.currentJobId) : undefined;
    const worker = ws?.assignedWorker ?? 0;
    note('three_years_steel', { day, stock, orders: (ws?.orders ?? []).map((o) => `${recipes.byIndex(o.recipe)?.id}:${o.mode}:${o.mode === 'maintain' ? o.threshold : o.remaining}`),
      job: job ? `${String(job.data['recipe'] ?? job.key)}:${job.state}${job.blockedReason ? `:${job.blockedReason}` : ''}` : null, blocked: ws?.lastBlockedReason ?? null,
      worker, workerDoing: worker ? ent.get(worker, C.Brain)?.activity ?? '' : '', fluxDesignated: [...state.economy.mined].filter((t) => flux.has(mats.byIndex(w.map.materialAt(t))?.id ?? '')).length });
  }
  // F-17i: export crafts keep running: the standing stone-craft order grows with the workforce.
  const craftdwarf = state.placedIds['craftdwarf'];
  if (craftdwarf && state.orderedWorkshops.has('craftdwarf')) {
    const threshold = Math.min(999, Math.max(day >= 112 ? 120 : 60, CRAFTS_PER_DWARF * fortressDwarves(w).length));
    if (w.game.world.entities.get(craftdwarf, C.Workshop)?.orders[0]?.threshold !== threshold) {
      command(w, { type: 'EditWorkOrder', workshopId: craftdwarf, index: 0, patch: { threshold } });
    }
  }
  // Work follows the population: a new ore drift every season of years 2 and 3.
  if (day >= 112 + DRIFT_EVERY_DAYS && phases.has('shaft')) {
    const name = `drift ${Math.floor(day / DRIFT_EVERY_DAYS)}`;
    if (!phases.has(name)) { phases.add(name); mine(w, state, upper, isOre, 20); mine(w, state, upper, isGem, 5); }
  }
  checkBrewer(w, state);
  checkFarm(w, state);
  checkCaveStrips(w, state);
  checkCrops(w);
  checkKitchens(w, state);
  // Nobody hunts: an immigrant hunter arrives with a crossbow, and a bolt that misses its quarry
  // hits whoever stands behind it (16 § Ranged).
  for (const id of fortressDwarves(w)) {
    if (w.readers.of<JobsReader>('11').laborEnabled(id, 'hunting')) command(w, { type: 'SetLabor', dwarfId: id, labor: 'hunting', on: false });
  }
  checkSpecialists(w, state);
  threeYearsMeasurements(w).fixture = { armedDay: state.economy.armedDay ?? null,
    specialists: { ...state.economy.specialists }, deepShaft: state.economy.deepShaft ? { ...state.economy.deepShaft } : null };

  if (day >= 224) {
    const tiles = [...state.hearthHallTiles, ...state.diningHallTiles];
    const borders = new Set(tiles);
    for (const t of tiles) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const n = w.map.offset(t, dx, dy, 0);
      if (n >= 0 && w.map.kindAt(n) === TileKind.Wall) borders.add(n);
    }
    const engrave = [...borders].filter((t) => w.map.hasFlag(t, TileFlag.Smoothed) && !w.map.hasFlag(t, TileFlag.Engraved) && !terrain.designationAt(t));
    if (engrave.length) command(w, { type: 'Designate', kind: 'engrave', tiles: engrave, priority: ROUTINE });
  }
}
