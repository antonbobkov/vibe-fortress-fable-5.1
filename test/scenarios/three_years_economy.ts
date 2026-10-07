/** Player economy for T-M8-06. All changes go through commands and ordinary jobs. */
import { C, ItemFlag } from '@core/components';
import { CAVERN_1_Z_MIN, CAVERN_1_Z_MAX, DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { THREAT_RADIUS } from '@systems/dwarves/constants';
import type { DwarvesReader } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { TerrainReader } from '@systems/terrain/reader';
import type { TradeReader } from '@systems/trade/reader';
import { merchantPrice, requiredValue } from '@systems/trade/valuation';
import { HALL_Z, type FortressState } from './three_years_fortress';
import type { TestWorld } from './test-world';
import { threeYearsMeasurements } from './three_years_measurements';

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

function order(w: TestWorld, workshopId: number, recipeId: string, threshold: number, materialFilter?: string, priority = ROUTINE): void {
  const result = w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId,
    order: { recipeId, mode: 'maintain', threshold, priority, ...(materialFilter ? { materialFilter } : {}) } });
  if (!result.ok) throw new Error(`economy order ${recipeId}: ${result.reason}`);
}

function fortressDwarves(w: TestWorld): number[] {
  const ent = w.game.world.entities;
  return w.readers.of<DwarvesReader>('10').adults().filter((id) => ent.get(id, C.Creature)?.faction === 'fortress');
}

/** Keep a dwarf on the given labors only, as a player does in the labor manager. */
function dedicate(w: TestWorld, dwarfId: number, keep: readonly string[]): void {
  const jobs = w.readers.of<JobsReader>('11');
  for (const row of w.game.registry.table<{ id: string }>('labors').rows.slice(1)) {
    const on = keep.includes(row.id);
    if (jobs.laborEnabled(dwarfId, row.id) !== on) w.game.world.applyCommand({ type: 'SetLabor', dwarfId, labor: row.id, on });
  }
}

/** F-17h: true while the squad's metal chain still owes the three soldiers their kit. */
export function armingSquad(state: FortressState): boolean {
  return state.economy.phases.has('arming');
}

interface MineBand { readonly x: number; readonly y: number; readonly zMin: number; readonly zMax: number; readonly deep: boolean }

/** The upper-rock mine, above the cavern bands, off its own shaft south of the entrance. */
export function upperBand(w: TestWorld, state: FortressState): MineBand {
  return { x: state.cx + 6, y: Math.min(w.map.h - 3, state.cy + 15), zMin: UPPER_MINE_BOTTOM, zMax: HALL_Z, deep: false };
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
    const result = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority, tiles });
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
    if (fresh.length) w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority, tiles: fresh });
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

export function placeEconomyBuilding(w: TestWorld, state: FortressState, type: string, dx: number, dy: number, priority = BUILD): void {
  if (state.placedIds[type]) {
    const built = w.readers.of<BuildingsReader>('14').get(state.placedIds[type]!);
    if (built?.state === 'built' && state.economy.phases.has(`traffic:${type}`)) {
      w.game.world.applyCommand({ type: 'SetTraffic', tiles: [0, 2, 6, 8].map((i) => built.footprint[i]!), mode: 'normal' });
      state.economy.phases.delete(`traffic:${type}`);
    }
    return;
  }
  const buildings = w.readers.of<BuildingsReader>('14');
  const candidates: number[] = [];
  for (let y = Math.max(2, state.cy + dy - 12); y <= Math.min(w.map.h - 4, state.cy + dy + 12); y += 1) {
    for (let x = Math.max(2, state.cx + dx - 12); x <= Math.min(w.map.w - 4, state.cx + dx + 12); x += 1) candidates.push(w.index(x, y, 32));
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
  const origin = candidates.find((t) => {
    const ghost = buildings.ghost(type, t, 0);
    return ghost.reason === null && ghost.tiles.every((tile) => buildings.zoneAt(tile) === 0 && !nearDepot(tile) && !crowdsDepot(tile) && !keptClear(w, state, tile) &&
      !w.game.world.entities.with(C.Creature).some((id) => {
        const p = w.game.world.entities.get(id, C.Position);
        return p && w.index(p.x, p.y, p.z) === tile;
      }));
  });
  if (origin === undefined) return;
  const result = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin, orientation: 0, materialChoice: 0, priority });
  if (result.ok) {
    state.placedIds[type] = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding;
    const b = buildings.get(state.placedIds[type]!)!;
    if (type === 'trade_depot') {
      // Guards and pack animals stand outside the footprint: clear their standing ring too.
      const trees = new Set<number>();
      for (const tile of b.footprint) for (let dy = -DEPOT_CLEARANCE; dy <= DEPOT_CLEARANCE; dy++) for (let dx = -DEPOT_CLEARANCE; dx <= DEPOT_CLEARANCE; dx++) {
        const t = w.map.offset(tile, dx, dy, 0);
        if (t >= 0 && w.map.kindAt(t) === TileKind.Tree) trees.add(t);
      }
      if (trees.size) w.game.world.applyCommand({ type: 'Designate', kind: 'chop', tiles: [...trees], priority: ROUTINE });
    }
    if (b.footprint.length === 9 && type !== 'trade_depot') {
      w.game.world.applyCommand({ type: 'SetTraffic', tiles: [0, 2, 6, 8].map((i) => b.footprint[i]!), mode: 'forbidden' });
      state.economy.phases.add(`traffic:${type}`);
    }
  }
}

function trade(w: TestWorld, state: FortressState): void {
  const reader = w.readers.of<TradeReader>('20');
  const buildings = w.readers.of<BuildingsReader>('14');
  const depot = buildings.depots()[0];
  if (!depot) return;
  const ent = w.game.world.entities;
  const types = w.game.registry.table<{ id: string; category: string; mult: number }>('items');
  const items = w.readers.of<ItemsReader>('13');
  const active = reader.activeCaravan();
  const awaitingAnvil = items.count('anvil') === 0 && buildings.get(state.placedIds['forge'] ?? 0)?.state !== 'built';
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
  if (!state.economy.broker) {
    const founders = new Set(w.game.arrival?.dwarves ?? []);
    const specialists = new Set(Object.values(state.economy.specialists));
    const trader = fortressDwarves(w).find(id => !founders.has(id) && !specialists.has(id));
    if (trader !== undefined) {
      state.economy.broker = { id: trader };
      w.game.world.applyCommand({ type: 'AssignTitle', title: 'broker', dwarfId: trader });
    }
  }
  // Prepare exports between visits. During a visit, open the session before taking more haul jobs.
  if (state.economy.broker) dedicate(w, state.economy.broker.id,
    active && !reader.sessionOpen() ? ['trading'] : ['hauling', 'trading']);
  if (jobs.laborPriority('trading') !== (active ? DEADLINE : ROUTINE)) w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'trading', priority: active ? DEADLINE : ROUTINE });
  // Export crafts and surplus prepared meals, as balance.md's caravan arithmetic describes.
  const population = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;
  let mealSurplus = items.available('easy_meal') + items.available('fine_meal') + items.available('lavish_meal') - Math.ceil(population * 0.48 * 14);
  // Reserve stones for the unfilled masonry orders, accounting for furniture already made.
  // A full stock of blocks/furniture does not still need another forty input stones.
  const stoneReserve = Math.ceil(Math.max(0, 30 - items.count('stone_block')) / 2) +
    Math.max(0, 14 - items.count('chair')) + Math.max(0, 6 - items.count('table')) + Math.max(0, 4 - items.count('door'));
  let stoneSurplus = items.available('raw_stone') - stoneReserve;
  let logSurplus = items.available('log') - TIMBER_RESERVE;
  const exports = ent.with(C.Item).filter((id) => {
    const it = ent.get(id, C.Item);
    if (!it || it.carriedBy || jobs.byKey(`depot:${id}`) ||
      (it.flags & (ItemFlag.Foreign | ItemFlag.Merchant | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Installed | ItemFlag.AtDepot))) return false;
    const type = types.byIndex(it.type);
    if (type?.category.startsWith('craft/')) { committed += reader.valuation('mountainhome', id); return true; }
    if (type?.id === 'lavish_meal' && reader.activeCaravan() && mealSurplus >= it.count) { mealSurplus -= it.count; return true; }
    if (type?.id === 'raw_stone' && stoneSurplus >= it.count && awaitingAnvil && committed < anvilCapital) { stoneSurplus -= it.count; committed += reader.valuation('mountainhome', id); return true; }
    if (type?.id === 'log' && logSurplus >= it.count && awaitingAnvil && committed < anvilCapital) { logSurplus -= it.count; committed += reader.valuation('mountainhome', id); return true; }
    return false;
  }).sort((a, b) => Number(types.byIndex(ent.get(a, C.Item)!.type)?.id === 'raw_stone') - Number(types.byIndex(ent.get(b, C.Item)!.type)?.id === 'raw_stone') || a - b).slice(0, 20);
  if (exports.length) {
    const result = w.game.world.applyCommand({ type: 'MoveToDepot', depotId: depot, itemIds: exports });
    if (result.ok) for (const id of exports) {
      const job = jobs.byKey(`depot:${id}`);
      // F-17g: export hauling is routine; a visiting caravan's deadline warrants one step.
      if (job) w.game.world.applyCommand({ type: 'SetJobPriority', jobId: job.id, priority: reader.activeCaravan() ? DEADLINE : ROUTINE });
    }
  }
  const caravan = reader.activeCaravan();
  // Exports queued between visits need the same deadline step as newly queued exports.
  for (const job of jobs.list('open')) if (job.key.startsWith('depot:') && job.priority !== (caravan ? DEADLINE : ROUTINE)) {
    w.game.world.applyCommand({ type: 'SetJobPriority', jobId: job.id, priority: caravan ? DEADLINE : ROUTINE });
  }
  if (!caravan || caravan.state !== 'atDepot') return;
  const day = Math.floor(w.tick / TICKS_PER_DAY);
  const key = `${Math.floor(day / DAYS_PER_YEAR)}:${caravan.civ}`;
  if (state.economy.traded.has(key)) return;
  if (!reader.sessionOpen()) {
    w.game.world.applyCommand({ type: 'TradeOpen', depotId: depot });
    const job = w.readers.of<JobsReader>('11').byKey(`trade:${depot}`);
    if (job) w.game.world.applyCommand({ type: 'SetJobPriority', jobId: job.id, priority: DEADLINE });
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
    if (type === 'anvil' && items.count('anvil') === 0) return 0;
    if (type === 'log' && items.available('log') < 40) return 1;
    if (type === 'bar' || type === 'charcoal_bar') return 2;
    if (type === 'plant_food' || type === 'seed') return 3;
    if (type === 'cloth' || type === 'thread') return 4;
    if (type === 'rough_gem') return 5;
    return 6;
  };
  const goods = reader.merchantItems().filter((id) => ent.get(id, C.Item)?.containerId === depot && !ent.get(id, C.Item)?.occupantId)
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
  for (const id of goods) {
    if (priority(id) === 6) continue;
    const it = ent.get(id, C.Item)!;
    const unitPrice = reader.price(caravan.civ, id) / it.count;
    const count = Math.min(it.count, Math.floor((spending / (1 + reader.marginPercent(caravan.civ) / 100) - cost) / unitPrice));
    if (count > 0) { take.push({ itemId: id, count }); cost += unitPrice * count; }
  }
  if (!take.length || requiredValue(cost, reader.marginPercent(caravan.civ)) > budget) return;
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
  const result = w.game.world.applyCommand({ type: 'TradeOffer', give: selected, take });
  const acquired = w.game.world.entities.with(C.Item).filter((id) => (foreign.has(id) && (ent.get(id, C.Item)!.flags & ItemFlag.Merchant) === 0) ||
    (!foreign.has(id) && !give.includes(id) && ent.get(id, C.Item)?.containerId === depot));
  if (result.ok && acquired.length > 0) {
    const purchasesNow = reader.depotItems().filter((id) => !give.includes(id) && ((foreign.has(id) && (ent.get(id, C.Item)!.flags & ItemFlag.Merchant) === 0) || !foreign.has(id)));
    for (const id of purchasesNow) threeYearsMeasurements(w).purchases.add(id);
    state.economy.traded.add(key);
    w.game.world.applyCommand({ type: 'TradeCancel' });
    const purchases = reader.depotItems().filter((id) => !types.byIndex(ent.get(id, C.Item)?.type ?? -1)?.category.startsWith('craft/'));
    if (purchases.length) w.game.world.applyCommand({ type: 'RemoveFromDepot', depotId: depot, itemIds: purchases });
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
    dedicate(w, founders[6]!, ['smithing', 'smelting', 'masonry', 'construction']);
    dedicate(w, founders[3]!, ['masonry', 'smelting', 'construction']);
  }
  if (!armingSquad(state)) return;
  const built = (type: string): boolean => buildings.get(state.placedIds[type] ?? 0)?.state === 'built';
  const smith = specialists['forge'];
  // Once his forge stands the smith does nothing but metal.
  if (smith !== undefined && built('forge') && !phases.has('smith at forge')) {
    phases.add('smith at forge');
    dedicate(w, smith, ['smithing', 'smelting']);
    w.game.world.applyCommand({ type: 'SetWorkshopWorker', workshopId: state.placedIds['forge'], dwarfId: smith });
  }
  if (!SQUAD_KIT_ITEMS.every((item) => items.count(item) >= SQUAD_SIZE)) return;
  // The kit is forged: the general economy takes the chain and its second worker back.
  phases.delete('arming');
  phases.add('armed');
  state.economy.armedDay = day;
  const hand = specialists['smelter'];
  if (hand !== undefined) {
    dedicate(w, hand, w.game.registry.table<{ id: string; defaultOn: boolean }>('labors').rows.slice(1)
      .filter((r) => r.defaultOn && !['mining', 'woodcutting'].includes(r.id)).map((r) => r.id));
    delete specialists['smelter'];
  }
  for (const type of ['wood_furnace', 'smelter', 'forge', 'mason']) {
    const id = state.placedIds[type];
    const ws = id ? w.game.world.entities.get(id, C.Workshop) : undefined;
    for (const [index, o] of (ws?.orders ?? []).entries()) {
      if (o.priority !== ROUTINE) w.game.world.applyCommand({ type: 'EditWorkOrder', workshopId: id, index, patch: { priority: ROUTINE } });
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
    dedicate(w, current, spec.labors);
    for (const shopId of shopIds) {
      if (w.game.world.entities.get(shopId, C.Workshop)?.assignedWorker !== current) w.game.world.applyCommand({ type: 'SetWorkshopWorker', workshopId: shopId, dwarfId: current });
    }
  }
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
      dedicate(w, builder, ['masonry', 'construction', 'smelting']);
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
      dedicate(w, fuel, ['smelting']);
      for (const type of ['wood_furnace', 'smelter']) {
        const id = state.placedIds[type];
        if (id && buildings.get(id)?.state === 'built' && w.game.world.entities.get(id, C.Workshop)?.assignedWorker !== fuel) {
          w.game.world.applyCommand({ type: 'SetWorkshopWorker', workshopId: id, dwarfId: fuel });
        }
      }
    }
  }
  // Timber in small batches: the eight nearest trees whenever the log stock runs low.
  const items = w.readers.of<ItemsReader>('13');
  const terrain = w.readers.of<TerrainReader>('03');
  // Help build the initial stone rooms, then keep both miners on the supplied mine.
  if (!phases.has('miners released') && buildings.get(state.hearthBuildingId)?.state === 'built' && items.count('chair') >= 6) {
    for (const id of (w.game.arrival?.dwarves ?? []).slice(0, 2)) dedicate(w, id, ['mining']);
    phases.add('miners released');
  }
  const standing = state.timberTiles.filter((t) => w.map.kindAt(t) === TileKind.Tree);
  if (items.available('log') < TIMBER_RESERVE && standing.filter((t) => terrain.designationAt(t)).length < TIMBER_BATCH / 2) {
    const near = (t: number): number => Math.abs(w.map.xOf(t) - state.cx) + Math.abs(w.map.yOf(t) - state.cy - 10);
    const batch = standing.filter((t) => !terrain.designationAt(t)).sort((a, b) => near(a) - near(b) || a - b).slice(0, TIMBER_BATCH);
    if (batch.length) w.game.world.applyCommand({ type: 'Designate', kind: 'chop', priority: ROUTINE, tiles: batch });
  }
  const arming = armingSquad(state);
  const metalWorker = w.game.arrival?.dwarves[6];
  if (!arming && items.count('anvil') > 0 && fortressDwarves(w).length >= SPECIALIST_MIN_POPULATION && metalWorker !== undefined && !phases.has('metal staffed') &&
      ['still', 'kitchen'].every(type => buildings.get(state.placedIds[type] ?? 0)?.state === 'built')) {
    // The peaceful metal worker keeps the food/hauling support until the anvil is available.
    dedicate(w, metalWorker, ['smithing', 'smelting', 'masonry', 'carpentry', 'construction']);
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
    dedicate(w, stoneCrafter, ['crafts']);
    w.game.world.applyCommand({ type: 'SetWorkshopWorker', workshopId: stoneShop, dwarfId: stoneCrafter });
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
      w.game.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'anvil', material: 'iron', priority: 3 }, { itemType: 'log', priority: 2 }, { itemType: 'bar', material: 'iron', priority: 1 }] });
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
    if (w.map.kindAt(w.index(upper.x, upper.y, HALL_Z)) !== TileKind.Floor) return false;
    const result = w.game.world.applyCommand({ type: 'DesignateStairwell', x: upper.x, y: upper.y, zTop: HALL_Z, zBottom: upper.zMin, priority });
    if (result.ok) phases.add('shaft');
    return result.ok;
  };
  // F-17h: the ore for the squad's missing bars is opened as soon as the trunk corridor reaches
  // the shaft, a step ahead of the halls.
  if (arming && !phases.has('squad ore') && shaft(KIT_FIRST)) {
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
    if (start === 224) mine(w, state, upper, isFlux, 20);
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
      const stairs = w.game.world.applyCommand({ type: 'DesignateStairwell', x: deepShaft.x, y: deepShaft.y,
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
    const threshold = Math.max(80, Math.ceil(population * 0.77 * 14));
    const ws = w.game.world.entities.get(still, C.Workshop);
    if (ws?.orders[0]?.threshold !== threshold) w.game.world.applyCommand({ type: 'EditWorkOrder', workshopId: still, index: 0, patch: { threshold } });
  }
  const carpenter = state.placedIds['carpenter'];
  if (carpenter && state.orderedWorkshops.has('carpenter')) {
    const threshold = day >= 224 ? 100 : day >= 112 ? 50 : 20;
    const ws = w.game.world.entities.get(carpenter, C.Workshop);
    if (ws?.orders[0]?.threshold !== threshold) w.game.world.applyCommand({ type: 'EditWorkOrder', workshopId: carpenter, index: 0, patch: { threshold } });
  }
  const kitchen = state.placedIds['kitchen'];
  if (day >= 56 && kitchen && state.orderedWorkshops.has('kitchen') && !phases.has('lavish')) {
    phases.add('lavish');
    order(w, kitchen, 'cook_lavish_meal', 120);
  }
  // The general metal economy takes the forge once the squad has its kit.
  const forge = state.placedIds['forge'];
  if (forge && state.orderedWorkshops.has('forge') && !arming && !phases.has('iron goods')) {
    phases.add('iron goods');
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
      const result = w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
        order: { recipeId: 'alloy_steel', mode: 'once', remaining: STEEL_BATCH, priority: ROUTINE } });
      if (!result.ok) throw new Error(`economy steel: ${result.reason}`);
      if (phases.has('steel')) mine(w, state, upper, isFlux, STEEL_BATCH);
      phases.add('steel');
    }
  }
  // F-17i: export crafts keep running: the standing stone-craft order grows with the workforce.
  const craftdwarf = state.placedIds['craftdwarf'];
  if (day >= 112 && craftdwarf && state.orderedWorkshops.has('craftdwarf') && !phases.has('export crafts')) {
    phases.add('export crafts');
    w.game.world.applyCommand({ type: 'EditWorkOrder', workshopId: craftdwarf, index: 0, patch: { threshold: 120 } });
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
    if (engrave.length) w.game.world.applyCommand({ type: 'Designate', kind: 'engrave', tiles: engrave, priority: ROUTINE });
  }
}
