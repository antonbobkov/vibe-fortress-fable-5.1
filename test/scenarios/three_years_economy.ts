/** Player economy for T-M8-06. All changes go through commands and ordinary jobs. */
import { C, ItemFlag, type WorkOrder } from '@core/components';
import { CAVERN_1_Z_MIN, CAVERN_1_Z_MAX, DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { THREAT_RADIUS } from '@systems/dwarves/constants';
import type { DwarvesReader } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { PlantsReader } from '@systems/plants';
import { ripensInTime } from '@systems/plants/growth';
import type { TerrainReader } from '@systems/terrain/reader';
import type { ThreatsReader } from '@systems/threats/reader';
import type { TradeReader } from '@systems/trade/reader';
import type { WorkshopsReader } from '@systems/workshops';
import { merchantPrice, requiredValue } from '@systems/trade/valuation';
import { designateDig, onWagonSide, opensToHillside, siteTiles, type FortressState } from './three_years_fortress';
import type { TestWorld } from './test-world';
import { command, isKeptOff } from './script-commands';
import { note, threeYearsMeasurements } from './three_years_measurements';
import { checkMakingDo, keepThanesShare, makingDoPurchases, makingDoWant } from './three_years_making_do';

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
  /** T-570: the workshops' and buildings' jobs found open at the daily look, by job id: the tick first found so (or last raised). */
  waiting?: Map<number, number>;
  /** Cave plots dug for bought cave seed, and whether each is zoned yet. */
  readonly cavePlans: { tiles: number[]; zoneId: number }[];
  /** The larder beside the pantry: its tiles, and its stockpile once dug. */
  larder?: { tiles: number[]; zoneId: number; drinkTiles: number[]; drinkZoneId: number };
  /**
   * T-580: where ambushes are possible, the workshop hall on the hall level: its tiles (with the
   * passage to the west corridor) and the origins of its workshop sites; and the workshops being
   * built there to replace a surface one, by key.
   */
  workHall?: { stair: number; tiles: number[]; slots: number[] };
  /** T-620: the furnaces' store in the workshop hall (its zone id). */
  fuelStore?: number;
  moving?: Record<string, { twin: number; type: string; orders: WorkOrder[]; worker: number; old?: number }>;
  /** T-588: what the fortress has set aside (forbidden) for the Thane's whim of the season, until just before it is judged. */
  thaneShare?: { whim: string; items: number[] };
  /** T-664: the dwarf a remnant keeps on the founding woodcutter's trade while he is gone (`keepWoodcutter`). */
  remnantFeller?: number;
  /** T-664: a famine the player answers (`keepFoodFirst`): its first day and the dwarves given farming for it. */
  famine?: { day: number; hands: number[] };
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
 * T-534: the wood furnace and the smelter are built one step ahead of the routine backlog. Priority
 * is strict and a job does not age (11 § Assignment): at BUILD the builder's nearer smoothing and
 * hauling, at the same priority, left `three-years-p0-3`'s smelter half built from day 63 to about
 * day 160, and its year 3 had too few iron bars for any steel. A player raises such a build.
 */
export const METAL_BUILD = 4;
/**
 * F-17h: the squad's metal chain is ordered ahead of all routine work until the kit is forged.
 * It stays above NEED_DEFER_PRIORITY: nobody skips a meal for it.
 */
export const KIT_FIRST = 3;
/**
 * T-570: the days a workshop's job or a building's job stands open before the player raises it one
 * step, and again after as many more, up to KIT_FIRST. Priority is strict and a job does not age (11
 * § Assignment: the player raises a job that waits), and the script keeps the food labors a step
 * ahead of all routine work with every immigrant on them, so in a growing fortress the routine jobs
 * waited for good. T-570's probe (`test/perf/t570_job_waits_probe.test.ts`): in `defence_year` the
 * carpenter's job stood open 44 days at a time, the craftdwarf's 28, the mason's 26, the halls'
 * chairs and tables 39, the weapon trap 38; in `three-years-p4-4` the carpenter's, the craftdwarf's
 * and the mason's for months. A workshop holds one job at a time and the halls a few pieces of
 * furniture, so raising them takes little from the food work.
 */
export const RAISE_AFTER_DAYS = 5;
/**
 * T-570: the job types the player raises when they wait: a workshop's job and a building's. T-664:
 * and a trap's rearming and cleaning (19), which the three-year fortress, with no traps, never has:
 * in `defence_year` the only civilian with mechanics was a bench specialist whose raised crafts came
 * first, and a weapon trap and the cage trap stood spent from day 75 to the end.
 */
const RAISED_JOB_TYPES: ReadonlySet<string> = new Set(['craft', 'build', 'rearm_trap', 'clean_trap']);

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
/** Steel is smelted from year 3 (F-17i), or where the squad is built toward the ambush bars from the day it forms. */
const STEEL_DAY = 224;

/**
 * T-603, T-616: where the squad is built toward the ambush bars, steel is smelted from the day the
 * squad forms, for its five steel kits (50 bars) ahead of the steel crafts: from day 168 the
 * smelter made 0 to 10 steel bars in T-606's sweep.
 */
function smeltsSteel(state: FortressState, day: number): boolean {
  return state.strong?.since !== undefined || day >= STEEL_DAY;
}
/**
 * T-620: the coal a player digs and smelts for the steel. Every peril-2 and peril-4 map of the sweep
 * has 200 to 550 tiles of bituminous coal and lignite in the sedimentary rock between the halls and
 * the soil (levels 26 to 30), which no mine of the script reached (2.8 tiles a fortress-timeline,
 * dug in passing, and none smelted); a coal smelt burns no fuel and gives two bars of coal (lignite
 * one). From the day the smelter makes steel, the miners drift to the nearest COAL_FACES faces off
 * the gate's stair above the halls (none that would open to the hillside), and as many again, once
 * a season at most, when the ore runs under COAL_ORE_LOW; the smelter keeps COAL_STOCK bars of coal,
 * after the steel and the iron, and (T-642) first only while the fuel under a roof is short.
 */
export const COAL_FACES = 20;
const COAL_ORE_LOW = 6;
export const COAL_STOCK = 30;
/** T-642: the charcoal and coal bars in stock under which the coal is smelted ahead of the iron. */
export const FUEL_SHORT = 20;
const COAL_ORES: readonly string[] = ['bituminous_coal', 'lignite'];

/**
 * T-642: the charcoal and coal bars free to take under a roof. Charcoal left on the surface counts
 * for nothing while the gate is locked: in `three-years-p4-6` at shift 50, 16 charcoal lay on the
 * surface stockpile from day 140 on while the smelter's alloy jobs below waited for fuel.
 */
function fuelIndoors(w: TestWorld): number {
  const ent = w.game.world.entities;
  const types = w.game.registry.table('items');
  const fuel = new Set([types.index('charcoal_bar'), types.index('coal_bar')]);
  let n = 0;
  for (const id of ent.with(C.Item)) {
    const it = ent.get(id, C.Item)!;
    if (!fuel.has(it.type) || (it.flags & (ItemFlag.Merchant | ItemFlag.Foreign | ItemFlag.Reserved | ItemFlag.Forbidden)) !== 0) continue;
    const p = ent.get(id, C.Position);
    if (p !== undefined && !w.map.hasFlag(w.index(p.x, p.y, p.z), TileFlag.Outdoor)) n += it.count;
  }
  return n;
}

/** T-620: the coal's mine and its smelt orders, once the smelter makes steel. */
export function keepCoal(w: TestWorld, state: FortressState, smelter: number, day: number): void {
  const { phases } = state.economy;
  const ent = w.game.world.entities;
  const recipes = w.game.registry.table('recipes');
  const orders = (): readonly { recipe: number }[] => ent.get(smelter, C.Workshop)?.orders ?? [];
  const items = w.readers.of<ItemsReader>('13');
  for (const ore of COAL_ORES) {
    const recipe = recipes.index(`smelt_${ore}`);
    if (orders().some((o) => o.recipe === recipe)) continue;
    order(w, smelter, `smelt_${ore}`, COAL_STOCK);
  }
  // T-642: the coal comes first while the fuel is short (the alloy and the iron smelts burn the fuel
  // a coal smelt makes without any, and an alloy job that finds no fuel within reach waits blocked,
  // holding the smelter), and after the alloy and the iron while it is not: the smelter works one job
  // at a time, and with 30 coal and 30 charcoal in stock its coal smelts held back the iron the
  // steel waited for.
  const coal = new Set(COAL_ORES.map((id) => recipes.index(`smelt_${id}`)));
  const alloy = recipes.index('alloy_steel');
  const short = fuelIndoors(w) < FUEL_SHORT;
  const rank = (recipe: number): number => (coal.has(recipe) ? (short ? 0 : 3) : recipe === alloy ? 1 : 2);
  const wanted = orders().map((o, i) => ({ recipe: o.recipe, i })).sort((a, b) => rank(a.recipe) - rank(b.recipe) || a.i - b.i).map((o) => o.recipe);
  for (let to = 0; to < wanted.length; to += 1) {
    const from = orders().findIndex((o, i) => i >= to && o.recipe === wanted[to]);
    if (from > to) command(w, { type: 'ReorderWorkOrder', workshopId: smelter, from, to });
  }
  const materials = w.game.registry.table<{ id: string }>('materials');
  const oreType = w.game.registry.table('items').index('ore');
  const ore = COAL_ORES.reduce((n, id) => n + items.countAvailable({ type: oreType, materialId: materials.index(id) }), 0);
  const season = `coal ${Math.floor(day / DRIFT_EVERY_DAYS)}`;
  if (phases.has('coal') && (ore >= COAL_ORE_LOW || phases.has(season))) return;
  phases.add('coal');
  phases.add(season);
  const band: MineBand = { x: state.cx + 6, y: state.cy + 6, zMin: state.hallZ + 1, zMax: state.z - 2, deep: false, walled: true };
  if (mine(w, state, band, (id) => COAL_ORES.includes(id), COAL_FACES) === 0) mine(w, state, upperBand(w, state), (id) => COAL_ORES.includes(id), COAL_FACES);
}

/**
 * T-642: the second smelter. With the coal smelted, the steel waited on the iron bars while iron
 * ore piled up unsmelted (31 of the 38 fortress-timelines under five iron bars on a weekly average
 * held ten ore or more, T-620's sweep): the smelter works one job at a time with its one worker,
 * and its job stood open while that worker slept, ate or drank. As a player who sees ore pile by a
 * busy smelter builds another, once the steel is owed and IRON_ORE_PILE iron ore stand free a
 * second smelter goes up (in the workshop hall where the fortress works below), worked by the
 * smith, whose forge waits on the steel, and keeps SECOND_SMELTER_STEEL steel bars, and the iron for
 * them. The burner was tried at it and left: its furnace then made
 * too little charcoal, and the steel waited on the fuel instead.
 */
export const IRON_ORE_PILE = 10;
/** T-642: the steel bars the second smelter keeps in stock, ahead of its iron. */
const SECOND_SMELTER_STEEL = 20;
const IRON_ORES: readonly string[] = ['hematite', 'limonite', 'magnetite'];

/** T-642: the free iron ore in stock. */
function ironOre(w: TestWorld): number {
  const materials = w.game.registry.table<{ id: string }>('materials');
  const oreType = w.game.registry.table('items').index('ore');
  const items = w.readers.of<ItemsReader>('13');
  return items.countAvailable({ type: oreType, materialIds: IRON_ORES.map((id) => materials.index(id)) });
}

export function keepSecondSmelter(w: TestWorld, state: FortressState): void {
  const strong = state.strong;
  const placed = state.placedIds['smelter_2'] !== undefined;
  if (!placed && (strong?.since === undefined || strong.steelOwed !== true || ironOre(w) < IRON_ORE_PILE)) return;
  // Only on a free site of the workshop hall: ambushes spring on whoever works on the surface. A
  // hall that is full is dug a row of sites longer.
  if (!placed) {
    const below = placeBelow(w, state, 'smelter', METAL_BUILD);
    if (below === 0) { growWorkHall(w, state); return; }
    state.placedIds['smelter_2'] = below;
    state.economy.phases.add('traffic:smelter_2');
  }
  placeEconomyBuilding(w, state, 'smelter', -20, 14, METAL_BUILD, 'smelter_2');
  const id = state.placedIds['smelter_2'];
  const buildings = w.readers.of<BuildingsReader>('14');
  if (id === undefined || buildings.get(id)?.state !== 'built' || state.orderedWorkshops.has('smelter_2')) return;
  state.orderedWorkshops.add('smelter_2');
  // The steel first, then the iron for it: the first smelter's alloy waited on its worker too.
  order(w, id, 'alloy_steel', SECOND_SMELTER_STEEL);
  for (const ore of IRON_ORES) order(w, id, `smelt_${ore}`, 40);
}

/**
 * T-642: one more workshop site, dug against the workshop hall's south lane (or its north lane where
 * the south does not fit), the column nearest the smelter first, once, at routine priority. In the
 * peril-4 fortresses the hall's twelve sites were taken by the workshops, the fuel store and the
 * second kitchen and still, and the second smelter went up on the surface, where ambushes sprang on
 * its worker and haulers. A row of four sites and a lane, dug ahead of routine work, was tried
 * first, and the sweep's peril-2 living fell with it (T-642's report). Only rock that is dry, no
 * construction and opens to no hillside is dug; a drift already there is kept.
 */
export function growWorkHall(w: TestWorld, state: FortressState): void {
  const hall = state.economy.workHall;
  if (hall === undefined || state.economy.phases.has('work hall grown') || hasFreeSite(w, state, 'smelter')) return;
  const map = w.map;
  const z = map.zOf(hall.slots[0]!);
  const xs = hall.tiles.map((t) => map.xOf(t)), ys = hall.tiles.map((t) => map.yOf(t));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const at = w.readers.of<BuildingsReader>('14').get(state.placedIds['smelter'] ?? 0)?.footprint[4] ?? hall.stair;
  const columns = Array.from({ length: Math.min(WORK_HALL_COLUMNS, Math.floor((x1 - x0 - 1) / 3)) }, (_, c) => x0 + 1 + 3 * c)
    .sort((a, b) => Math.abs(a + 1 - map.xOf(at)) - Math.abs(b + 1 - map.xOf(at)) || a - b);
  const sound = (t: number): boolean => map.fluidLevelAt(t) === 0 && !map.hasFlag(t, TileFlag.Constructed) && !opensToHillside(w, t) &&
    (map.kindAt(t) === TileKind.Wall || map.kindAt(t) === TileKind.Floor);
  for (const top of [y1 + 1, y0 - 3]) for (const left of columns) {
    if (top < 2 || top + 2 > map.h - 2) continue;
    const tiles: number[] = [];
    for (let y = top; y < top + 3; y += 1) for (let x = left; x < left + 3; x += 1) tiles.push(w.index(x, y, z));
    if (!tiles.every(sound)) continue;
    state.economy.phases.add('work hall grown');
    hall.slots.push(w.index(left, top, z));
    hall.tiles.push(...tiles);
    for (const t of tiles) state.economy.workings.add(t);
    designateDig(w, tiles.filter((t) => map.kindAt(t) === TileKind.Wall), ROUTINE);
    return;
  }
}

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
/** T-603: the strong squad's steel kit, bought from a caravan as it is forged. */
const STRONG_KIT_ITEMS: readonly string[] = ['short_sword', 'shield', 'helm', 'mail_shirt', 'greaves'];
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
/** T-572: the cloth and wool the beds leave for the hospital (17's `HOSPITAL_DEFAULT_SUPPLIES` cloth 10). */
export const BED_CLOTH_KEPT = 10;
const SURFACE_CROPS: readonly (readonly string[])[] = [['turnip', 'strawberry', 'barley', 'cabbage'], ['turnip', 'strawberry', 'barley', 'pumpkin'], ['turnip', 'cabbage', 'pumpkin']];
const CAVE_CROPS: readonly string[] = ['dimcap', 'pale_bell', 'sweetroot', 'cavewheat'];
/** Cave strips dug beside the first cave farm on its soil level for bought cave seed (x0, x1, y0, y1 from the centre). */
const CAVE_STRIPS: readonly (readonly [number, number, number, number])[] = [[7, 14, 8, 11], [7, 14, 0, 3], [7, 14, 12, 15], [15, 18, 0, 11]];
/** The stair to the cave farm, from the centre: an east farm begins at `cx + 7`, a west one ends at `cx + 5` (T-455). */
const CAVE_STAIR_X = 6;
/**
 * T-507: a west farm digs its first strip in year 2. Before its farm is zoned the wagon's cave seed
 * counts as spare, so every farm plans a strip on day 1; an east farm's is part of its first winter's
 * food (held back, the main run had no meal on day 224), but dug in a west farm's opening it left
 * `p2-4` extinct on day 65 in three of four sweeps. Until T-507 a west farm's strips were never dug.
 */
const WEST_CAVE_STRIPS_FROM_DAY = DAYS_PER_YEAR;
/** Free cave seed that justifies digging another cave strip. */
const CAVE_STRIP_SEED = 12;
const USEFUL_SEED: ReadonlySet<string> = new Set([...SURFACE_CROPS.flat(), ...CAVE_CROPS]);
/** The larder beside the pantry, on the hall level (x0, x1, y0, y1 from the centre): 72 tiles of food, then 12 of drink; every tile holds a barrel. */
const LARDER: readonly (readonly [number, number, number, number])[] = [[-12, -1, -3, 2], [-12, -9, 3, 5]];
/**
 * T-580: the workshop hall is dug this many days before ambushes are possible (18's schedule
 * preview), so its workshops stand when the first one may come.
 */
const WORK_HALL_LEAD_DAYS = 56;
/** T-580: the workshop hall's digging and its workshops go a step ahead of routine work. */
const WORK_HALL_PRIORITY = METAL_BUILD;
/** T-580: the workshop hall's sites (3 x 3 each), columns by rows. */
const WORK_HALL_COLUMNS = 4;
const WORK_HALL_ROWS = 3;
/** T-580: the workshop hall's stair goes down from the west corridor this many tiles west of the centre, or the corridor tile nearest it. */
const WORK_HALL_STAIR_X = -10;
/**
 * T-580: a workshop whose site is no farther than this from the gate stair (tiles, Chebyshev, from
 * the centre) stays on the surface: its workers are a step from the stair, and they are the eyes
 * that spot an ambush before it reaches the farther dwarves or walks in at the gate.
 */
const WORK_NEAR_GATE = 6;
/** The empty barrels the opening's two drink stockpiles want: a third of their twelve tiles. */
const DRINK_STOCKPILE_TILES = 4;
/** Easy meals in stock before the kitchen turns to lavish meals first. */
const EASY_MEALS_STOCKED = 20;

/** The squad's kit (F-17h): mail, a shield and a short sword for each of the three soldiers. */
export const SQUAD_SIZE = 3;
export const SQUAD_KIT = ['forge_mail_shirt', 'forge_shield', 'forge_short_sword'] as const;
export const SQUAD_KIT_ITEMS = ['mail_shirt', 'shield', 'short_sword'] as const;
/**
 * T-544: then greaves and a helm for each, ordered next after the kit, so the squad is armed in
 * metal and hunts wolves and bears (three_years_fortress.ts). Left to the standing armour orders of
 * 'iron goods', the squad on seed p2-5 had no helm or greaves in a year; with a helm ordered first
 * after the kit, the squad on seed p2-1 had a helm by day 191 and no greaves. Greaves first: a bite
 * lands on a leg three times as often as on the head (the body plan's hit weights).
 */
export const HUNT_KIT = ['forge_greaves', 'forge_helm'] as const;

/** F-17i: the craft each specialist is kept on, and the skill a player picks them by. */
const SPECIALISTS = [
  { role: 'forge', shops: ['forge'], labors: ['smithing', 'smelting'], skill: 'metalcrafting' },
  { role: 'craftdwarf', shops: ['craftdwarf'], labors: ['crafts'], skill: 'crafting' },
  { role: 'jeweler', shops: ['jeweler'], labors: ['gem_cutting', 'crafts'], skill: 'gem_cutting' },
] as const;
/** Two spare adults beyond the founders support the craft professions; waves can include children. */
const SPECIALIST_MIN_POPULATION = 9;
/**
 * T-524: a fortress the raids cut below its embark party gives its specialists the general labors
 * back. The floor lies below SPECIALIST_MIN_POPULATION, so a fortress hovering at nine keeps them.
 */
export const SPECIALIST_RELEASE_POPULATION = 7;

/** T-156: 11 changes the priority of a job only while it waits for a worker (open or claimed). */
function reprioritised(job: { state: string }): boolean {
  return job.state === 'open' || job.state === 'claimed';
}

function order(w: TestWorld, workshopId: number, recipeId: string, threshold: number, materialFilter?: string, priority = ROUTINE): void {
  const result = command(w, { type: 'AddWorkOrder', workshopId,
    order: { recipeId, mode: 'maintain', threshold, priority, ...(materialFilter ? { materialFilter } : {}) } });
  if (!result.ok) throw new Error(`economy order ${recipeId}: ${result.reason}`);
}

/** T-616: the material is a flux stone (`flux` tag, 05). */
function isFluxStone(w: TestWorld, material: number): boolean {
  return w.game.registry.table<{ id: string; tags?: readonly string[] }>('materials').byIndex(material)?.tags?.includes('flux') === true;
}

/** T-616: the stone crafts keep to one stone while this many of it are to hand. */
const STONE_KEPT_FOR_CRAFTS = 5;

/** T-616: the raw stone to hand by material, flux stones left out. */
function stoneToHand(w: TestWorld): Map<number, number> {
  const ent = w.game.world.entities;
  const rawStone = w.game.registry.table('items').index('raw_stone');
  const counts = new Map<number, number>();
  for (const id of ent.with(C.Item)) {
    const it = ent.get(id, C.Item)!;
    if (it.type !== rawStone || it.carriedBy || (it.flags & (ItemFlag.Merchant | ItemFlag.Foreign | ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.AtDepot)) !== 0) continue;
    if (!isFluxStone(w, it.material)) counts.set(it.material, (counts.get(it.material) ?? 0) + it.count);
  }
  return counts;
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
export function dedicate(w: TestWorld, state: FortressState, dwarfId: number, keep: readonly string[], haul = true): void {
  // The labor manager lists the living only.
  if (!w.game.world.entities.alive(dwarfId)) return;
  const jobs = w.readers.of<JobsReader>('11');
  for (const row of w.game.registry.table<{ id: string }>('labors').rows.slice(1)) {
    const on = keep.includes(row.id) || (haul && row.id === 'hauling') || (row.id === 'trading' && state.economy.broker?.id === dwarfId) ||
      // T-664: a dwarf given farming for a famine keeps it until the famine is over.
      (row.id === 'farming' && (state.economy.famine?.hands.includes(dwarfId) ?? false));
    if (jobs.laborEnabled(dwarfId, row.id) !== on) command(w, { type: 'SetLabor', dwarfId, labor: row.id, on });
  }
}

/**
 * T-653: the fortress's woodcutter and carpenter is the founder who came with the axe, and he
 * stands in the squad. While he lies in the hospital or once he is dead (or trains in the strong
 * squad, which keeps no axe), nobody fells a tree and the carpenter's jobs wait: a dwarf with the
 * labor but no axe leaves a chop to the one who carries it (11 § Assignment), and the others with
 * the labors take their other work first. In `three-years-p4-2` at shift 150 the chops stood open
 * from day 61 to the end, the wood furnace burnt the last logs on day 84, and the carpenter made no
 * bed after day 56: a fortress of 24 slept in seven. Given an axe and logs, the carpenter's chair
 * still stood open seventy days. So the player gives the founder's trade to another dwarf, who fells,
 * works the carpenter's bench and hauls, and has the forge make an axe when he has none to take.
 * T-656: and once the logs run short (under a quarter of TIMBER_RESERVE): the founder fells and works
 * the carpenter's bench alone, between his drill, his meals and his sleep. In `three-years-p4-5` at
 * shift 0 and `three-years-p4-4` at shift 150 the fortress had no log for weeks with 130 to 150 trees
 * standing, a few felled a month, so the carpenter made no barrel, the stills waited for one and the
 * fortress drank at the brook. The founder keeps his labors, so two dwarves fell.
 * T-661: a founder down or in a hospital bed puts his axe down after `JOB_HOLD_TICKS` (11 § Assignment),
 * and a dead one drops it, so the woodcutter takes that axe and the forge's is made only while no axe
 * is free: while the founder keeps his in the squad, or when both woodcutters need one. Back on his
 * feet, the founder fells with a free axe or leaves the chops to the one who has his.
 */
export function keepWoodcutter(w: TestWorld, state: FortressState): void {
  const ent = w.game.world.entities;
  const { specialists } = state.economy;
  if (specialists['woodcutter'] !== undefined && !ent.alive(specialists['woodcutter'])) delete specialists['woodcutter'];
  const founder = w.game.arrival?.dwarves[2];
  const short = w.readers.of<ItemsReader>('13').available('log') < TIMBER_RESERVE / 4;
  const able = founder !== undefined && ent.alive(founder) && ent.get(founder, C.Brain)?.behavior !== 'patient' &&
    !(state.strong?.trained ?? []).includes(founder) && !short;
  if (specialists['woodcutter'] === undefined && !able && fortressDwarves(w).length >= SPECIALIST_MIN_POPULATION) {
    const dwarves = w.readers.of<DwarvesReader>('10');
    const pick = specialistCandidates(w, state).sort((a, b) => dwarves.skill(b, 'woodcutting') - dwarves.skill(a, 'woodcutting') || a - b)[0];
    if (pick !== undefined) {
      specialists['woodcutter'] = pick;
      dedicate(w, state, pick, ['woodcutting', 'carpentry']);
    }
  }
  // T-664: a remnant under SPECIALIST_MIN_POPULATION whose founder is gone gives his trade to one of
  // its dwarves, as the founder's profession was given: woodcutting and carpentry, and farming for the
  // food, nothing else. The immigrants hold woodcutting among all their labors, but a chop is routine
  // work every other job of a small fortress comes before: in `three-years-p4-1` at shift 50 four
  // dwarves lived from day 143 to 201 with sixteen chops open, two of them with the labor and two axes
  // in stock, and no log after day 154; the carpenter made no bed, and the fortress that grew again to
  // nineteen ended year 3 with six bedrooms. Once the founder is back or the fortress has its
  // specialists again, the dwarf takes the general labors back.
  const { economy } = state;
  const gone = founder === undefined || !ent.alive(founder) || ent.get(founder, C.Brain)?.behavior === 'patient' || (state.strong?.trained ?? []).includes(founder);
  const trained = new Set(state.strong?.trained ?? []);
  const remnant = specialists['woodcutter'] === undefined && gone && fortressDwarves(w).length < SPECIALIST_MIN_POPULATION;
  const held = economy.remnantFeller;
  const fit = (id: number): boolean => ent.alive(id) && ent.get(id, C.Brain)?.behavior !== 'patient' && !trained.has(id);
  if (held !== undefined && (!remnant || !fit(held))) {
    delete economy.remnantFeller;
    if (ent.alive(held) && specialists['woodcutter'] !== held) {
      const general = w.game.registry.table<{ id: string; defaultOn: boolean }>('labors').rows.slice(1)
        .filter((r) => r.defaultOn && r.id !== 'mining').map((r) => r.id);
      dedicate(w, state, held, general);
    }
  }
  if (remnant && economy.remnantFeller === undefined) {
    const dwarves = w.readers.of<DwarvesReader>('10');
    const pick = specialistCandidates(w, state).filter(fit).sort((a, b) => dwarves.skill(b, 'woodcutting') - dwarves.skill(a, 'woodcutting') || a - b)[0];
    if (pick !== undefined) {
      economy.remnantFeller = pick;
      dedicate(w, state, pick, ['woodcutting', 'carpentry', 'farming'], false);
    }
  }
  const remnantFeller = economy.remnantFeller;
  const feller = specialists['woodcutter'] ?? remnantFeller;
  const forge = state.placedIds['forge'] ?? 0;
  if (feller === undefined || w.readers.of<BuildingsReader>('14').get(forge)?.state !== 'built') return;
  const items = w.readers.of<ItemsReader>('13');
  const axe = w.game.registry.table('items').index('axe');
  if (items.available('axe') > 0 || items.carriedItems(feller).some((id) => ent.get(id, C.Item)?.type === axe)) return;
  const recipe = w.game.registry.table('recipes').index('forge_battle_axe');
  const orders = (): readonly WorkOrder[] => ent.get(forge, C.Workshop)?.orders ?? [];
  if (orders().some((o) => o.recipe === recipe)) return;
  if (command(w, { type: 'AddWorkOrder', workshopId: forge, order: { recipeId: 'forge_battle_axe', mode: 'once', remaining: 1, materialFilter: 'iron', priority: ROUTINE } }).ok) {
    command(w, { type: 'ReorderWorkOrder', workshopId: forge, from: orders().length - 1, to: 0 });
  }
}

/** F-17h: true while the squad's metal chain still owes the three soldiers their kit. */
export function armingSquad(state: FortressState): boolean {
  return state.economy.phases.has('arming');
}

/** T-620: `walled`: no drift or face of the band may open to the hillside (`opensToHillside`), as off the gate's stair above the halls. */
interface MineBand { readonly x: number; readonly y: number; readonly zMin: number; readonly zMax: number; readonly deep: boolean; readonly walled?: boolean }

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
    if (band.walled && [...fresh, t].some((d) => opensToHillside(w, d))) continue;
    // T-663: no drift comes beside the cistern's water.
    if ([...fresh, t].some((d) => isKeptOff(w, d))) continue;
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
    // T-663: nor the deep shaft and its drift.
    let kept = fresh.some((t) => isKeptOff(w, t));
    for (let z = reach; z <= top && !kept; z += 1) kept = isKeptOff(w, w.index(c.x, c.y, z));
    if (kept) continue;
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
  if (deep !== undefined && near(deep.x, deep.y, SHAFT_CLEARANCE)) return true;
  // T-663: the cistern's feed opens the ground by the brook.
  return isKeptOff(w, tile);
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
  // T-580: once the workshop hall is dug, a workshop goes up below ground.
  if (type !== 'trade_depot' && Math.max(Math.abs(dx - 6), Math.abs(dy - 6)) > WORK_NEAR_GATE) {
    const below = placeBelow(w, state, type, priority);
    if (below !== 0) {
      state.placedIds[key] = below;
      state.economy.phases.add(`traffic:${key}`);
      return;
    }
  }
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

/**
 * T-580: the day ambushes are first possible, as the threats panel's schedule preview gives it
 * (18: its season and year), or null where they never come.
 */
export function ambushFromDay(w: TestWorld): number | null {
  const preview = w.readers.of<ThreatsReader>('18').schedulePreview()['ambush'];
  if (preview === undefined || preview === null) return null;
  const season = ['spring', 'summer', 'autumn', 'winter'].indexOf(preview.season);
  return (preview.year - 1) * DAYS_PER_YEAR + Math.max(0, season) * (DAYS_PER_YEAR / 4);
}

/**
 * T-580: the workshop hall, one level below the halls, where no room of the halls' plan lies: a
 * stair down from the west corridor (`WORK_HALL_STAIR_X`, or the nearest corridor tile that is no
 * bedroom's door), and around its foot `WORK_HALL_COLUMNS` by `WORK_HALL_ROWS` workshop sites
 * packed side by side, a lane along every side of each row, the stair's foot on the top lane.
 * Only rock that opens to no hillside is planned.
 */
function planWorkHall(w: TestWorld, state: FortressState): { stair: number; tiles: number[]; slots: number[] } | null {
  const { cx, cy, hallZ } = state;
  const z = hallZ - 1;
  const doors = new Set(state.bedroomPlans.map((bp) => w.index(bp.doorX, bp.doorY, hallZ)));
  const width = 3 * WORK_HALL_COLUMNS + 2, height = 4 * WORK_HALL_ROWS + 1;
  const sy = cy + 6;
  let sx = -1;
  for (let x = Math.max(2, cx - 13); x <= cx - 1; x += 1) {
    if (doors.has(w.index(x, sy, hallZ)) || x - 6 < 1 || x + width - 7 > w.map.w - 2 || sy + height - 1 > w.map.h - 2) continue;
    if (sx < 0 || Math.abs(x - cx - WORK_HALL_STAIR_X) < Math.abs(sx - cx - WORK_HALL_STAIR_X)) sx = x;
  }
  if (sx < 0) return null;
  const x0 = sx - 6, y0 = sy;
  const tiles: number[] = [];
  for (let y = y0; y < y0 + height; y += 1) for (let x = x0; x < x0 + width; x += 1) if (x !== sx || y !== sy) tiles.push(w.index(x, y, z));
  const slots: number[] = [];
  for (let r = 0; r < WORK_HALL_ROWS; r += 1) for (let c = 0; c < WORK_HALL_COLUMNS; c += 1) slots.push(w.index(x0 + 1 + 3 * c, y0 + 1 + 4 * r, z));
  // The sites nearest the stair first.
  const far = (t: number): number => Math.abs(w.map.xOf(t) + 1 - sx) + Math.abs(w.map.yOf(t) + 1 - sy);
  slots.sort((a, b) => far(a) - far(b) || a - b);
  return { stair: w.index(sx, sy, hallZ), tiles: tiles.filter((t) => !opensToHillside(w, t) && !isKeptOff(w, t)), slots };
}

/** T-580: whether the hall has a free, dug site for `type`. */
export function hasFreeSite(w: TestWorld, state: FortressState, type: string): boolean {
  return (state.economy.workHall?.slots ?? []).some((origin) => siteFree(w, type, origin));
}

function siteFree(w: TestWorld, type: string, origin: number): boolean {
  const buildings = w.readers.of<BuildingsReader>('14');
  const ghost = buildings.ghost(type, origin, 0);
  if (ghost.reason !== null || ghost.tiles.some((t) => w.map.kindAt(t) !== TileKind.Floor || buildings.zoneAt(t) !== 0 || w.map.designationAt(t) !== 0)) return false;
  return !w.game.world.entities.with(C.Creature).some((id) => {
    const p = w.game.world.entities.get(id, C.Position);
    return p !== undefined && ghost.tiles.includes(w.index(p.x, p.y, p.z));
  });
}

/** T-580: a free, dug workshop site of the hall that takes `type`; the new building's id, or 0. */
function placeBelow(w: TestWorld, state: FortressState, type: string, priority: number): number {
  const hall = state.economy.workHall;
  if (!hall) return 0;
  const buildings = w.readers.of<BuildingsReader>('14');
  for (const origin of hall.slots) {
    if (!siteFree(w, type, origin)) continue;
    if (!command(w, { type: 'PlaceBuilding', buildingType: type, origin, orientation: 0, materialChoice: 0, priority }).ok) continue;
    const id = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding;
    const b = buildings.get(id);
    // T-582: not while the hall is still being dug: a corner forbidden beside a tile just dug can
    // close it off (on `three-years-p4-1` at shift 50 the mason's corner shut a dug tile in, and the
    // dig beside it stood blocked as unreachable for two days, a T-176 fault).
    const dug = hall.tiles.every((t) => w.map.kindAt(t) !== TileKind.Wall);
    if (b && b.footprint.length === 9 && dug) command(w, { type: 'SetTraffic', tiles: [0, 2, 6, 8].map((i) => b.footprint[i]!), mode: 'forbidden' });
    return id;
  }
  return 0;
}

/**
 * T-580: a fortress where ambushes are possible works below ground once they are. An ambush
 * springs on the dwarves at work outdoors, and Gloam outrun a dwarf, so a player who reads the
 * schedule preview digs a workshop hall `WORK_HALL_LEAD_DAYS` before the first possible ambush,
 * builds each surface workshop farther than `WORK_NEAR_GATE` from the gate again there and takes the
 * surface one down once its twin stands, with its orders and its worker; and once ambushes are
 * possible the surface stockpile takes no food or drink, so the dwarves eat and drink below, and the
 * surface drink stockpile is removed. The workshops by the gate, the trade depot (for the caravans)
 * and the meeting area by the gate stay on the surface.
 */
/** T-580: what the surface stockpile keeps once the dwarves eat and drink below: everything but food and drink. */
const SURFACE_GOODS_BELOW: readonly string[] = ['seed', 'stone', 'ore', 'wood', 'bar', 'furniture', 'container', 'weapon', 'ammo', 'armor', 'clothing', 'tool', 'craft', 'textile', 'medical', 'farm', 'refuse'];

export function keepWorkBelow(w: TestWorld, state: FortressState, day: number): void {
  const from = ambushFromDay(w);
  if (from === null || day < from - WORK_HALL_LEAD_DAYS) return;
  const { economy } = state;
  const buildings = w.readers.of<BuildingsReader>('14');
  if (!economy.workHall) {
    const plan = planWorkHall(w, state);
    // The stair goes down from the dug corridor, so nothing is designated into unreached rock.
    if (plan === null || w.map.kindAt(plan.stair) !== TileKind.Floor) return;
    if (!command(w, { type: 'DesignateStairwell', x: w.map.xOf(plan.stair), y: w.map.yOf(plan.stair), zTop: state.hallZ, zBottom: state.hallZ - 1, priority: WORK_HALL_PRIORITY }, ['bad_designation']).ok) return;
    economy.workHall = plan;
    designateDig(w, plan.tiles, WORK_HALL_PRIORITY);
    for (const t of plan.tiles) economy.workings.add(t);
  }
  const moving = (economy.moving ??= {});
  const recipes = w.game.registry.table<{ id: string }>('recipes');
  const items = w.readers.of<ItemsReader>('13');
  const entities = w.game.world.entities;
  for (const [key, id] of Object.entries(state.placedIds)) {
    const b = buildings.get(id);
    const move = moving[key];
    if (move === undefined) {
      if (!b || b.state !== 'built' || b.typeId === 'trade_depot' || !w.map.hasFlag(b.footprint[0]!, TileFlag.Outdoor)) continue;
      const centre = b.footprint[Math.floor(b.footprint.length / 2)]!;
      if (Math.max(Math.abs(w.map.xOf(centre) - state.cx - 6), Math.abs(w.map.yOf(centre) - state.cy - 6)) <= WORK_NEAR_GATE) continue;
      const shop = entities.get(id, C.Workshop);
      const orders = (shop?.orders ?? []).map((o) => ({ ...o }));
      // The forge takes the fortress's anvil: with no spare one the surface forge is taken down
      // first, and its anvil goes into the new one.
      if (b.typeId === 'forge' && items.available('anvil') === 0) {
        if (!hasFreeSite(w, state, 'forge')) continue;
        command(w, { type: 'DeconstructBuilding', buildingId: id });
        moving[key] = { twin: 0, type: b.typeId, orders, worker: shop?.assignedWorker ?? 0 };
        continue;
      }
      const twin = placeBelow(w, state, b.typeId, WORK_HALL_PRIORITY);
      if (twin !== 0) moving[key] = { twin, type: b.typeId, orders: [], worker: 0, old: id };
      continue;
    }
    if (move.twin === 0) {
      if (b !== undefined) continue;
      move.twin = placeBelow(w, state, move.type, WORK_HALL_PRIORITY);
      if (move.twin !== 0) state.placedIds[key] = move.twin;
      continue;
    }
    const twin = buildings.get(move.twin);
    if (twin === undefined) {
      // The new site was lost: start again.
      if (move.old === undefined) move.twin = 0;
      else delete moving[key];
      continue;
    }
    if (twin.state !== 'built') continue;
    // The twin stands: it takes the surface workshop's orders, in their order, and its worker.
    const old = move.old === undefined ? undefined : entities.get(move.old, C.Workshop);
    const orders = old ? old.orders : move.orders;
    for (const o of orders) {
      const recipeId = recipes.byIndex(o.recipe)?.id;
      // T-582: a memorial slab's order for a dwarf since buried in a coffin names nobody it may.
      if (recipeId === undefined || (o.memorialDwarfId !== undefined && !buildings.memorialEligible(o.memorialDwarfId))) continue;
      command(w, { type: 'AddWorkOrder', workshopId: move.twin, order: { recipeId, mode: o.mode, ...(o.mode === 'once' ? { remaining: o.remaining } : { threshold: o.threshold }),
        priority: o.priority, ...(o.materialFilter === null ? {} : { materialFilter: o.materialFilter }), ...(o.targetType === undefined ? {} : { targetType: o.targetType }),
        ...(o.memorialDwarfId === undefined ? {} : { memorialDwarfId: o.memorialDwarfId }) } });
    }
    const worker = old ? old.assignedWorker : move.worker;
    if (worker !== 0) command(w, { type: 'SetWorkshopWorker', workshopId: move.twin, dwarfId: worker }, ['not_found', 'no_labor']);
    command(w, { type: 'SetTraffic', tiles: [0, 2, 6, 8].map((i) => twin.footprint[i]!), mode: 'normal' });
    if (move.old !== undefined && buildings.get(move.old)?.state === 'built') command(w, { type: 'DeconstructBuilding', buildingId: move.old });
    state.placedIds[key] = move.twin;
    economy.phases.delete(`traffic:${key}`);
    delete moving[key];
  }
  if (day < from || economy.phases.has('fed below')) return;
  economy.phases.add('fed below');
  const surface = (type: string, x: number, y: number): number => {
    const zid = buildings.zoneAt(w.index(state.cx + x, state.cy + y, state.z));
    return zid !== 0 && buildings.zone(zid)?.type === type ? zid : 0;
  };
  const store = surface('stockpile', -1, 6);
  if (store !== 0) command(w, { type: 'SetStockpileFilter', zoneId: store, filter: { preset: 'everything', categories: [...SURFACE_GOODS_BELOW] } });
  const drink = surface('stockpile', 1, 13);
  if (drink !== 0) command(w, { type: 'RemoveZone', zoneId: drink });
}

/**
 * T-620: the furnaces' store below. Once the fortress works below (`keepWorkBelow`) the wood furnace
 * and the smelter stand in the workshop hall while logs, ore and bars went to the surface stockpile,
 * so their workers fetched every log and bar from beyond the gate and back: in `three-years-p4-6` at
 * shift 50 the charcoal burner was at its job a third of the day and made 4 to 9 charcoal in ten
 * (100 ticks each), and none while an alert locked the gate. As a player keeps the fuel by the
 * furnace, up to FUEL_STORE_SLOTS free sites of the hall nearest the wood furnace become a stockpile
 * of wood, ore and bars (the coal and charcoal too), leaving FUEL_STORE_SPARE sites for workshops, and
 * the surface stockpile takes none of them: haulers bring each to the nearest stockpile that takes it.
 */
const FUEL_STORE_SLOTS = 3;
const FUEL_STORE_SPARE = 2;
const FUEL_STORE_GOODS: readonly string[] = ['wood', 'ore', 'bar'];

function keepFuelStore(w: TestWorld, state: FortressState): void {
  const { economy } = state;
  const hall = economy.workHall;
  if (hall === undefined || !economy.phases.has('fed below') || economy.phases.has('fuel store')) return;
  const buildings = w.readers.of<BuildingsReader>('14');
  const furnace = buildings.get(state.placedIds['wood_furnace'] ?? 0);
  if (furnace?.state !== 'built' || w.map.hasFlag(furnace.footprint[0]!, TileFlag.Outdoor)) return;
  const at = furnace.footprint[4]!;
  const free = hall.slots.filter((origin) => siteFree(w, 'wood_furnace', origin))
    .sort((a, b) => Math.abs(w.map.xOf(a) - w.map.xOf(at)) + Math.abs(w.map.yOf(a) - w.map.yOf(at)) - Math.abs(w.map.xOf(b) - w.map.xOf(at)) - Math.abs(w.map.yOf(b) - w.map.yOf(at)) || a - b);
  const take = free.slice(0, Math.min(FUEL_STORE_SLOTS, free.length - FUEL_STORE_SPARE));
  if (take.length === 0) return;
  const tiles = take.flatMap((origin) => buildings.ghost('wood_furnace', origin, 0).tiles).sort((a, b) => a - b);
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;
  if (!command(w, { type: 'CreateZone', zoneType: 'stockpile', tiles }, ['bad_zone_tiles']).ok) return;
  economy.phases.add('fuel store');
  const store = bSystem.lastCreatedZone;
  economy.fuelStore = store;
  command(w, { type: 'SetStockpileFilter', zoneId: store, filter: { categories: fuelStoreGoods(state) } });
  const surface = buildings.zoneAt(w.index(state.cx - 1, state.cy + 6, state.z));
  if (surface !== 0 && buildings.zone(surface)?.type === 'stockpile') {
    command(w, { type: 'SetStockpileFilter', zoneId: surface, filter: { preset: 'everything', categories: SURFACE_GOODS_BELOW.filter((c) => !FUEL_STORE_GOODS.includes(c)) } });
  }
}

/**
 * T-655: what the fuel store takes. Once the ore store stands by the smelter the fuel store takes
 * no more ore: with the ore it filled up (27 ore on its 27 tiles in `three-years-p4-6` at shift 50
 * from day 210), the logs found no stockpile below and lay where they were felled, and the burner
 * walked to the surface for each one, 17 to 22 steps from its furnace.
 */
function fuelStoreGoods(state: FortressState): string[] {
  return FUEL_STORE_GOODS.filter((c) => c !== 'ore' || !state.economy.phases.has('ore store'));
}

/**
 * T-642: the ore store by the smelter. Its worker fetched each ore from the drift where it was dug
 * (the fuel store is full of logs, and no other stockpile below takes ore): in
 * `three-years-p2-1` at shift 0 the worker was at its job a third of the day and made one smelt or
 * alloy in about 1000 ticks of it, of 150 at the smelter. Once the smelter makes steel and stands
 * below, up to ORE_STORE_TILES tiles of the workshop hall's lanes nearest it (no workshop site's,
 * so the sites stay free) are a stockpile of ore, and the haulers bring the ore down.
 */
export const ORE_STORE_TILES = 24;

export function keepOreStore(w: TestWorld, state: FortressState): void {
  const { economy } = state;
  const hall = economy.workHall;
  if (hall === undefined || economy.phases.has('ore store')) return;
  const buildings = w.readers.of<BuildingsReader>('14');
  const smelter = buildings.get(state.placedIds['smelter'] ?? 0);
  if (smelter?.state !== 'built' || w.map.hasFlag(smelter.footprint[0]!, TileFlag.Outdoor)) return;
  const at = smelter.footprint[4]!;
  const sites = new Set(hall.slots.flatMap((origin) => buildings.ghost('smelter', origin, 0).tiles));
  const far = (t: number): number => Math.abs(w.map.xOf(t) - w.map.xOf(at)) + Math.abs(w.map.yOf(t) - w.map.yOf(at));
  const lanes = hall.tiles.filter((t) => !sites.has(t) && w.map.zOf(t) === w.map.zOf(at) && w.map.kindAt(t) === TileKind.Floor && buildings.zoneAt(t) === 0 &&
    buildings.at(t) === 0 && w.map.designationAt(t) === 0).sort((a, b) => far(a) - far(b) || a - b).slice(0, ORE_STORE_TILES);
  if (lanes.length === 0) return;
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;
  if (!command(w, { type: 'CreateZone', zoneType: 'stockpile', tiles: lanes.sort((a, b) => a - b) }, ['bad_zone_tiles']).ok) return;
  economy.phases.add('ore store');
  command(w, { type: 'SetStockpileFilter', zoneId: bSystem.lastCreatedZone, filter: { categories: ['ore'] } });
  const fuel = economy.fuelStore;
  if (fuel !== undefined && buildings.zone(fuel)?.type === 'stockpile') command(w, { type: 'SetStockpileFilter', zoneId: fuel, filter: { categories: fuelStoreGoods(state) } });
}

/**
 * T-665: the flux store by the smelter. A steel job fetched its flux stone 6 to 18 steps from the
 * smelter (10 to 13 on most timelines; T-659's probes), from where it was mined, while the bar and the
 * fuel lay by the smelter. As a player keeps a few flux stones beside it, once the ore store stands
 * the next FLUX_STORE_TILES free tiles of the hall's lanes nearest the smelter are a stockpile of raw
 * stone with no material class and the tag `flux` (13 § Stockpiles): the haulers bring flux stone
 * alone, a stone each tile.
 */
export const FLUX_STORE_TILES = 6;

export function keepFluxStore(w: TestWorld, state: FortressState): void {
  const { economy } = state;
  const hall = economy.workHall;
  if (hall === undefined || !economy.phases.has('ore store') || economy.phases.has('flux store')) return;
  const buildings = w.readers.of<BuildingsReader>('14');
  const smelter = buildings.get(state.placedIds['smelter'] ?? 0);
  if (smelter?.state !== 'built' || w.map.hasFlag(smelter.footprint[0]!, TileFlag.Outdoor)) return;
  const at = smelter.footprint[4]!;
  const sites = new Set(hall.slots.flatMap((origin) => buildings.ghost('smelter', origin, 0).tiles));
  const far = (t: number): number => Math.abs(w.map.xOf(t) - w.map.xOf(at)) + Math.abs(w.map.yOf(t) - w.map.yOf(at));
  const lanes = hall.tiles.filter((t) => !sites.has(t) && w.map.zOf(t) === w.map.zOf(at) && w.map.kindAt(t) === TileKind.Floor && buildings.zoneAt(t) === 0 &&
    buildings.at(t) === 0 && w.map.designationAt(t) === 0).sort((a, b) => far(a) - far(b) || a - b).slice(0, FLUX_STORE_TILES);
  if (lanes.length === 0) return;
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;
  if (!command(w, { type: 'CreateZone', zoneType: 'stockpile', tiles: lanes.sort((a, b) => a - b) }, ['bad_zone_tiles']).ok) return;
  economy.phases.add('flux store');
  command(w, { type: 'SetStockpileFilter', zoneId: bSystem.lastCreatedZone, filter: { categories: ['stone/raw'], materialClasses: [], materialTags: ['flux'] } });
}

/**
 * T-668: flux mined as the steel wants it. The flux was opened 20 faces with the second mine, 30 at
 * the deep shaft's foot on day 224 and 30 with each new alloy order, but a dug stone tile drops a
 * stone three times in ten (03, `MINING_STONE_DROP_PERMILLE`), so 30 faces gave about nine flux stones
 * for a batch of 30 steel bars, and the next batch, with its faces, was ordered only when the last
 * was done: where the halls stand in no flux rock the smelter waited on flux with 20 to 40 iron bars
 * stacked (`three-years-p2-4` at shift 0 from day 238 to 336, T-664's sweep). While the smelter makes
 * steel, when fewer than FLUX_LOW flux stones are free and fewer than FLUX_PENDING flux faces stand
 * designated undug, FLUX_FACES more are designated, in the upper band or else below it.
 */
const FLUX_LOW = 4;
const FLUX_PENDING = 10;
const FLUX_FACES = 15;

function freeFlux(w: TestWorld): number {
  const rawStone = w.game.registry.table('items').index('raw_stone');
  const materials = w.game.registry.table<{ id: string; tags?: readonly string[] }>('materials');
  const flux: number[] = [];
  for (let m = 1; m <= materials.size; m += 1) if (materials.byIndex(m)?.tags?.includes('flux') === true) flux.push(m);
  return w.readers.of<ItemsReader>('13').countAvailable({ type: rawStone, materialIds: flux });
}

function keepFlux(w: TestWorld, state: FortressState, isFlux: (id: string) => boolean): void {
  if (freeFlux(w) >= FLUX_LOW) return;
  const materials = w.game.registry.table<{ id: string }>('materials');
  let pending = 0;
  for (const t of state.economy.mined) if (w.map.kindAt(t) === TileKind.Wall && isFlux(materials.byIndex(w.map.materialAt(t))?.id ?? '')) pending += 1;
  if (pending >= FLUX_PENDING) return;
  if (mine(w, state, upperBand(w, state), isFlux, FLUX_FACES) > 0) return;
  const deep = state.economy.deepShaft;
  if (deep !== undefined && state.economy.phases.has('deep stairs')) {
    mine(w, state, { x: deep.x, y: deep.y, zMin: deep.bottom, zMax: upperBand(w, state).zMin - 1, deep: true }, isFlux, FLUX_FACES);
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

/**
 * T-570: takes back at least `short` units of raw stone bound for the depot: the stones lying there
 * (`RemoveFromDepot`), then the hauls of stone still waiting for a hauler (`CancelJob`).
 */
export function takeBackStone(w: TestWorld, depot: number, short: number): void {
  const ent = w.game.world.entities;
  const jobs = w.readers.of<JobsReader>('11');
  const stone = w.game.registry.table('items').index('raw_stone');
  const isStone = (id: number): boolean => {
    const it = ent.get(id, C.Item);
    return it !== undefined && it.type === stone && (it.flags & (ItemFlag.Merchant | ItemFlag.Foreign)) === 0;
  };
  let back = 0;
  const lying: number[] = [];
  for (const id of w.readers.of<TradeReader>('20').depotItems()) {
    if (back >= short) break;
    if (!isStone(id) || (ent.get(id, C.Item)!.flags & ItemFlag.AtDepot) === 0) continue;
    lying.push(id);
    back += ent.get(id, C.Item)!.count;
  }
  if (lying.length > 0) command(w, { type: 'RemoveFromDepot', depotId: depot, itemIds: lying });
  for (const job of jobs.list()) {
    if (back >= short) break;
    if ((job.state !== 'open' && job.state !== 'blocked') || !job.key.startsWith('depot:') || !isStone(job.target.ref)) continue;
    back += ent.get(job.target.ref, C.Item)!.count;
    command(w, { type: 'CancelJob', jobId: job.id });
  }
}

/** T-632: units of the fortress's crafts lying at the depot, of one stone when `material` names one. */
function craftsAtDepot(w: TestWorld, material: number | string | null): number {
  const ent = w.game.world.entities;
  const types = w.game.registry.table<{ id: string; category: string }>('items');
  let units = 0;
  for (const id of w.readers.of<TradeReader>('20').depotItems()) {
    const it = ent.get(id, C.Item);
    if (it === undefined || (it.flags & (ItemFlag.AtDepot | ItemFlag.Merchant)) !== ItemFlag.AtDepot) continue;
    if (!types.byIndex(it.type)?.category.startsWith('craft/') || (typeof material === 'number' && it.material !== material)) continue;
    units += it.count;
  }
  return units;
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
  // T-570: between visits the player takes back from the depot the stone the mason's orders want:
  // goods at the depot are kept from every other job (20), and nothing else ever brought them back.
  // In `defence_year` 15 stones stood at the depot from day 77 to the end while the fortress's
  // available stone fell to none; in `three-years-p4-4` 42 of its 72 from day 126.
  if (active === null && items.available('raw_stone') < stoneReserve) takeBackStone(w, depot, stoneReserve - items.available('raw_stone'));
  let stoneSurplus = items.available('raw_stone') - stoneReserve;
  let logSurplus = items.available('log') - TIMBER_RESERVE;
  // Stone and logs go to the depot while the anvil is still to be paid for, and whenever a
  // visiting caravan would otherwise find too little to trade for.
  const thinCargo = (): boolean => (awaitingAnvil && committed < anvilCapital) || (active !== null && committed < VISIT_CARGO);
  const exports = ent.with(C.Item).filter((id) => {
    const it = ent.get(id, C.Item);
    if (!it || it.carriedBy || jobs.byKey(`depot:${id}`) ||
      (it.flags & (ItemFlag.Foreign | ItemFlag.Merchant | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Installed | ItemFlag.AtDepot | ItemFlag.Forbidden))) return false;
    const type = types.byIndex(it.type);
    if (type?.category.startsWith('craft/')) { committed += reader.valuation('mountainhome', id); return true; }
    if (type?.id === 'lavish_meal' && reader.activeCaravan() && mealSurplus >= it.count) { mealSurplus -= it.count; return true; }
    // T-616: the flux stone stays home while the squad's steel is owed.
    if (type?.id === 'raw_stone' && stoneSurplus >= it.count && thinCargo() && !(state.strong?.steelOwed === true && isFluxStone(w, it.material))) { stoneSurplus -= it.count; committed += reader.valuation('mountainhome', id); return true; }
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
  // T-588: from year 2, Making Do's tallow candles for the dining hall, and honey for the Thane's mead.
  const makingDoWants = makingDoPurchases(w, state);
  const priority = (id: number): number => {
    const it = ent.get(id, C.Item);
    const type = types.byIndex(it?.type ?? -1)?.id ?? '';
    if (type === 'anvil' && awaitingAnvil && id === anvil) return 0;
    if (type === 'log' && items.available('log') < 40) return 1;
    if (type === 'bar' || type === 'charcoal_bar') return 2;
    // T-603: steel bars and the steel kit for the squad that trains for the ambushes, and flux for the smelter's own steel.
    if (state.strong?.since !== undefined) {
      const material = w.game.registry.table<{ id: string; tags?: string[] }>('materials').byIndex(it?.material ?? -1);
      if (material?.id === 'steel' && (type === 'bar' || STRONG_KIT_ITEMS.includes(type))) return 1;
      if (type === 'raw_stone' && material?.tags?.includes('flux') === true) return 2;
    }
    // Armour and bandages for the squad that meets the boars, ahead of everything but the anvil.
    if (SQUAD_PURCHASES.includes(type)) return 1;
    // Seed of a crop the plots sow, and drink for the winter; hops, flax and sporecloth feed nobody.
    if (type === 'seed') return USEFUL_SEED.has(w.game.registry.table<{ id: string }>('materials').byIndex(it?.material ?? -1)?.id ?? '') ? 1 : 6;
    if (type === 'drink') return 2;
    if (type === 'plant_food') return 3;
    if (type === 'cloth' || type === 'thread') return 4;
    if (type === 'rough_gem') return 5;
    return makingDoWant(w, makingDoWants, id) ?? 6;
  };
  const onOffer = reader.merchantItems().filter((id) => ent.get(id, C.Item)?.containerId === depot && !ent.get(id, C.Item)?.occupantId);
  /** T-616: `:<metal>` for a good of a metal or a flux stone, for the journal. */
  const metalOf = (id: number): string => {
    const material = w.game.registry.table<{ id: string; class?: string; tags?: readonly string[] }>('materials').byIndex(ent.get(id, C.Item)?.material ?? -1);
    return material !== undefined && (material.class === 'metal' || material.tags?.includes('flux') === true) ? `:${material.id}` : '';
  };
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
  // T-588: a good the merchants ask nothing for (sand, clay, dung: 20 § Goods) is no trade of its own,
  // since an offer must give something; the wanted ones go along with an offer that buys anything else.
  const free = (id: number): boolean => reader.price(caravan.civ, id) <= 0;
  const wanted = goods.some((id) => priority(id) !== 6 && !free(id));
  let seedTaken = 0;
  for (const id of goods) {
    // A visit that carries nothing on the wish list still trades: the first affordable goods.
    if (free(id) || (wanted ? priority(id) === 6 : take.length > 0)) continue;
    const it = ent.get(id, C.Item)!;
    const unitPrice = reader.price(caravan.civ, id) / it.count;
    // Seed is bought for the strips still to be sown, not by the hundred.
    const isSeed = types.byIndex(it.type)?.id === 'seed';
    const wantedUnits = isSeed ? Math.max(0, SEED_PER_VISIT - seedTaken) : it.count;
    const count = Math.min(it.count, wantedUnits, Math.floor((Math.floor(spending) / (1 + reader.marginPercent(caravan.civ) / 100) - cost) / unitPrice));
    if (count > 0) { take.push({ itemId: id, count }); cost += unitPrice * count; if (isSeed) seedTaken += count; }
  }
  if (take.length > 0) for (const id of goods) if (free(id) && priority(id) !== 6) take.push({ itemId: id, count: ent.get(id, C.Item)!.count });
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
  // T-455: a good may be claimed for a haul or a guard between the script's look and its offer; it offers again next look.
  const result = command(w, { type: 'TradeOffer', give: selected, take }, ['not_at_depot']);
  note('three_years_trade', { day, civ: caravan.civ, ok: result.ok, reason: result.ok ? null : result.reason, budget: Math.floor(budget), cost: Math.floor(cost),
    take: take.map((t) => `${types.byIndex(ent.get(t.itemId, C.Item)?.type ?? -1)?.id ?? 'gone'}${metalOf(t.itemId)}x${t.count}`),
    // T-616: the steel the caravan brought, bars and kit pieces, whether bought or not.
    steelOnOffer: onOffer.filter((id) => metalOf(id) === ':steel').map((id) => `${types.byIndex(ent.get(id, C.Item)!.type)?.id}x${ent.get(id, C.Item)!.count}`) });
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
    const taken = new Set([...Object.entries(chosen).filter(([role]) => role !== spec.role).map(([, id]) => id), ...(state.strong?.trained ?? [])]);
    if (state.economy.brewer !== undefined) taken.add(state.economy.brewer);
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

/** T-664: the founder the fortress script makes its farmer (`three_years_fortress.ts`, the professions). */
export const FOUNDING_FARMER = 4;
/**
 * T-664: fewer units of food than this a dwarf, with a ripe crop left a day in the field, is a famine:
 * about nine days of eating (a dwarf eats a unit in about three days: 0.33 to 0.35 a dwarf-day in the
 * sweeps). At ten units a dwarf the famine held the farm a step ahead of all work for 25 days of every
 * peril-2 and peril-4 fortress's year, with a month of food in the stores, and the steel smelted fell
 * by a sixth.
 */
export const FAMINE_FOOD = 3;
/** T-664: the famine is over once the stores hold this many units a dwarf, or FAMINE_FOOD with no crop left waiting. */
export const FAMINE_OVER_FOOD = 6;
/** T-664: farming's labor priority in a famine: a step ahead of KIT_FIRST, where T-570 raises the work that waits. */
export const FAMINE_FARMING_PRIORITY = KIT_FIRST - 1;
/** T-664: farming's labor priority otherwise, the food chain's step (`three_years_fortress.ts`, STEP_LABORS). */
const FARMING_PRIORITY = ROUTINE - 1;

/** T-664: units of food the fortress owns, a visiting merchant's goods left out. */
export function foodInStock(w: TestWorld): number {
  const ent = w.game.world.entities;
  const types = w.game.registry.table<{ id: string; edible?: boolean }>('items');
  let units = 0;
  for (const id of ent.with(C.Item)) {
    const it = ent.get(id, C.Item)!;
    if (types.byIndex(it.type)?.edible === true && (it.flags & (ItemFlag.Merchant | ItemFlag.Foreign)) === 0) units += it.count;
  }
  return units;
}

/**
 * T-664: the player answers a famine. Under FAMINE_FOOD a dwarf, with a ripe crop left in the
 * field for a day (a harvest job open, or with no worker, a day after it was made) is a famine: every
 * adult but the metal chain's workers is given farming (a soldier at drill does no civilian work, but
 * farms once the squad stands down), and farming's labor priority goes a step ahead of
 * KIT_FIRST, so the harvest and the sowing come before everything but the care of patients. Until
 * then the script left the farm to the founding farmer and the immigrants, and a fortress that raids
 * had cut to a dozen lost them: in `three-years-p4-1` at shift 50 the farmer died in the hospital on
 * day 20 and no survivor held farming, so 37 ripe crops waited with no worker while three dwarves
 * starved; in `three-years-p4-3` at shift 100 the farmer was killed on day 100 and the only dwarves
 * with farming were soldiers at drill, which does no civilian work; in `three-years-p4-2` at shift
 * 100 the two civilians with farming worked the craft and build jobs that T-570 raises to KIT_FIRST
 * when they wait, a step ahead of the farm's, while thirty ripe crops stood in the field for eighty
 * days and the fortress starved to the last. The famine is over once the stores hold
 * FAMINE_OVER_FOOD a dwarf, or FAMINE_FOOD with no crop left waiting: farming goes back to the food
 * chain's step, and the dwarves given it for the famine lose it.
 */
export function keepFoodFirst(w: TestWorld, state: FortressState): void {
  const ent = w.game.world.entities;
  const jobs = w.readers.of<JobsReader>('11');
  const harvest = w.game.registry.table<{ id: string }>('jobTypes').index('harvest');
  const adults = fortressDwarves(w);
  // The children eat too.
  const mouths = ent.with(C.Labors).filter((id) => ent.alive(id) && ent.get(id, C.Creature)?.faction === 'fortress').length;
  const { economy } = state;
  const food = foodInStock(w);
  const waiting = jobs.list().some((j) => j.type === harvest && w.tick - j.createdTick >= TICKS_PER_DAY &&
    (j.state === 'open' || (j.state === 'blocked' && j.blockedReason === 'no_worker')));
  const day = Math.floor(w.tick / TICKS_PER_DAY) + 1;
  if (economy.famine === undefined) {
    if (adults.length === 0 || food >= FAMINE_FOOD * mouths || !waiting) return;
    economy.famine = { day, hands: [] };
    command(w, { type: 'SetLaborPriority', labor: 'farming', priority: FAMINE_FARMING_PRIORITY });
    note('three_years_famine', { day, phase: 'start', dwarves: mouths, food });
  } else if (adults.length === 0 || food >= FAMINE_OVER_FOOD * mouths || (!waiting && food >= FAMINE_FOOD * mouths)) {
    const { hands } = economy.famine;
    delete economy.famine;
    for (const id of hands) if (adults.includes(id) && jobs.laborEnabled(id, 'farming')) command(w, { type: 'SetLabor', dwarfId: id, labor: 'farming', on: false });
    command(w, { type: 'SetLaborPriority', labor: 'farming', priority: FARMING_PRIORITY });
    note('three_years_famine', { day, phase: 'end', dwarves: mouths, food, hands: hands.length });
    return;
  }
  const famine = economy.famine;
  // The metal chain's workers stay at their furnaces and forge: in the sweep that gave them farming
  // too, the steel smelted fell by a tenth. A fortress under SPECIALIST_RELEASE_POPULATION has
  // released them (`releaseSpecialists`), and they farm with the rest.
  const metal = new Set(['forge', 'fuel', 'charcoal'].map((role) => economy.specialists[role]).filter((id): id is number => id !== undefined));
  for (const id of adults) {
    if (metal.has(id) || jobs.laborEnabled(id, 'farming')) continue;
    command(w, { type: 'SetLabor', dwarfId: id, labor: 'farming', on: true });
    if (!famine.hands.includes(id)) famine.hands.push(id);
  }
}

/**
 * T-488: when the last dwarf with the mining labor dies, the player gives it to another, so the
 * halls, bedrooms and drifts still designated are dug. Only the founders' two miners and the
 * immigrants nobody dedicated mine; a raid that kills them all left a fortress of survivors with
 * hundreds of dig jobs nobody could take, and no hearth or dining hall (`three-years-p2-4`,
 * shift 50). A dwarf the specialists keep at a bench is the last choice but for the founding farmer
 * (T-664) and a soldier of the strong squad, then the most skilled miner, then the lowest id.
 */
export function keepAMiner(w: TestWorld, state: FortressState): void {
  const adults = fortressDwarves(w);
  const jobs = w.readers.of<JobsReader>('11');
  if (adults.length === 0 || adults.some((id) => jobs.laborEnabled(id, 'mining'))) return;
  const benched = new Set(Object.values(state.economy.specialists));
  // T-603: a soldier of the strong squad is the last choice of all: training keeps it from the mine.
  const trained = new Set(state.strong?.trained ?? []);
  const dwarves = w.readers.of<DwarvesReader>('10');
  // T-664: and the founding farmer is passed over before a bench: with the pick he would dig the
  // drifts, as urgent to him as his planting and nearer, as the defence script's farmer did (T-660).
  const farmer = w.game.arrival?.dwarves[FOUNDING_FARMER];
  const miner = adults.slice().sort((a, b) => Number(trained.has(a)) - Number(trained.has(b)) || Number(a === farmer) - Number(b === farmer) ||
    Number(benched.has(a)) - Number(benched.has(b)) || dwarves.skill(b, 'mining') - dwarves.skill(a, 'mining') || a - b)[0]!;
  command(w, { type: 'SetLabor', dwarfId: miner, labor: 'mining', on: true });
}

/**
 * T-664: when no dwarf outside the hospital holds the hauling labor, the player gives it to every
 * one of them. The founders' two miners do not haul, nor do the furnace workers, and a patient is fed
 * and watered by a hauling job (17: `feed_patient`, `water_patient`). In `three-years-p4-1` at
 * shift 50 the raids of the first week left the two miners on their feet and three dwarves in the
 * hospital, and the three starved in their beds on day 32 with seventy plants in the stores.
 */
export function keepAHauler(w: TestWorld): void {
  const ent = w.game.world.entities;
  const jobs = w.readers.of<JobsReader>('11');
  const able = fortressDwarves(w).filter((id) => ent.get(id, C.Brain)?.behavior !== 'patient');
  if (able.length === 0 || able.some((id) => jobs.laborEnabled(id, 'hauling'))) return;
  for (const id of able) command(w, { type: 'SetLabor', dwarfId: id, labor: 'hauling', on: true });
}

/**
 * T-567: the builder is the mason's workshop's worker, as the smith is the forge's. The mason's
 * orders (blocks, doors, tables and the chairs of the halls) are routine work, and 11 never ages a
 * job: once the founding mason had gone to the metal chain or the stone crafts, every immigrant with
 * the masonry labor had food work a step ahead, and the builder, the one dwarf kept on masonry, had
 * hundreds of smoothing jobs of the same priority nearer to hand. On seed p2-6 the workshop's job
 * stood open for a hundred and fifty days at a time and the dining hall ended the third year with
 * its chairs planned. Not while the squad's kit is owed: then the founding mason cuts its blocks.
 */
export function keepMasonAtWork(w: TestWorld, state: FortressState): void {
  const builder = state.economy.specialists['builder'];
  const shop = state.placedIds['mason'];
  if (builder === undefined || shop === undefined || armingSquad(state) || !w.game.world.entities.alive(builder)) return;
  if (w.readers.of<BuildingsReader>('14').get(shop)?.state !== 'built') return;
  if (w.game.world.entities.get(shop, C.Workshop)?.assignedWorker !== builder) command(w, { type: 'SetWorkshopWorker', workshopId: shop, dwarfId: builder });
}

/**
 * T-570: the player looks at the board once a day and raises a workshop's or a building's job that
 * has stood open (unclaimed and not blocked) for RAISE_AFTER_DAYS, one step, and again after as many
 * more days, while the step keeps it at KIT_FIRST or behind (with its labor's priority: the kitchen's
 * and the still's jobs are already a step ahead). A job that is claimed, blocked or gone is forgotten,
 * so its next job starts at its order's priority again.
 */
export function raiseWaitingWork(w: TestWorld, state: FortressState): void {
  const jobs = w.readers.of<JobsReader>('11');
  const types = w.game.registry.table<{ id: string; labor: string }>('jobTypes');
  const waiting = (state.economy.waiting ??= new Map<number, number>());
  const open = new Set<number>();
  for (const job of jobs.list('open')) {
    if (!RAISED_JOB_TYPES.has(jobs.typeOf(job.id) ?? '')) continue;
    open.add(job.id);
    const since = waiting.get(job.id);
    if (since === undefined) { waiting.set(job.id, w.tick); continue; }
    if (w.tick - since < RAISE_AFTER_DAYS * TICKS_PER_DAY) continue;
    waiting.set(job.id, w.tick);
    const labor = typeof job.data['labor'] === 'string' ? job.data['labor'] : types.byIndex(job.type)?.labor ?? '';
    const shift = labor === '' ? 0 : jobs.laborPriority(labor) - ROUTINE;
    if (job.priority - 1 + shift >= KIT_FIRST) command(w, { type: 'SetJobPriority', jobId: job.id, priority: job.priority - 1 });
  }
  for (const id of [...waiting.keys()]) if (!open.has(id)) waiting.delete(id);
}

/**
 * The immigrants free to become the builder or the fuel worker: no founder, specialist or broker,
 * and (T-524) not the brewer, whose dedication to the still the new one would override.
 */
export function specialistCandidates(w: TestWorld, state: FortressState): number[] {
  const founders = new Set(w.game.arrival?.dwarves ?? []);
  const taken = new Set(Object.values(state.economy.specialists));
  const watchmen = new Set((state.watch ?? []).map((wt) => wt.dwarfId));
  // T-603: nor a soldier or marksdwarf of the strong squad, whom training keeps from any craft.
  const trained = new Set(state.strong?.trained ?? []);
  return fortressDwarves(w).filter((id) => !founders.has(id) && !taken.has(id) && id !== state.economy.broker?.id && id !== state.economy.brewer && !watchmen.has(id) && !trained.has(id));
}

/**
 * T-524: below SPECIALIST_RELEASE_POPULATION adults the player gives every specialist the general
 * labors back: the builder, the fuel worker, the bench specialists, the metal worker and the
 * brewer. In `three-years-p2-4` at shift 50 raids cut the fortress to two by day 164, and the fuel
 * worker, kept on smelting alone with hauling off, stood idle for the last 180 days. The squad's
 * smith and smelter keep the metal chain while it still owes the squad its kit. Their workshops
 * are freed for anyone; the specialists are chosen again once the fortress regrows to
 * SPECIALIST_MIN_POPULATION.
 */
export function releaseSpecialists(w: TestWorld, state: FortressState): void {
  const adults = fortressDwarves(w);
  if (adults.length >= SPECIALIST_RELEASE_POPULATION) return;
  const { economy } = state;
  const arming = armingSquad(state);
  const released = new Set<number>();
  const fellers = new Set<number>();
  for (const [role, id] of Object.entries(economy.specialists)) {
    if (arming && (role === 'forge' || role === 'smelter')) continue;
    delete economy.specialists[role];
    released.add(id);
    // T-653: the woodcutter keeps his axe work beside the general labors.
    if (role === 'woodcutter') fellers.add(id);
  }
  if (economy.brewer !== undefined) released.add(economy.brewer);
  delete economy.brewer;
  const metalWorker = w.game.arrival?.dwarves[6];
  if (economy.phases.delete('metal staffed') && metalWorker !== undefined) released.add(metalWorker);
  const general = w.game.registry.table<{ id: string; defaultOn: boolean }>('labors').rows.slice(1)
    .filter((r) => r.defaultOn && !['mining', 'woodcutting'].includes(r.id)).map((r) => r.id);
  for (const id of released) {
    if (!adults.includes(id)) continue;
    dedicate(w, state, id, fellers.has(id) ? [...general, 'woodcutting'] : general);
    for (const shopId of Object.values(state.placedIds)) {
      if (w.game.world.entities.get(shopId, C.Workshop)?.assignedWorker === id) command(w, { type: 'SetWorkshopWorker', workshopId: shopId, dwarfId: 0 });
    }
  }
}

/**
 * T-656: the still's standing brew keeps `threshold` drink. It is found by its recipe and mode: the
 * Thane's batch of spirits goes ahead of it (`three_years_making_do.ts`), and the threshold written to
 * the first order went to that batch while the brew kept the stock of a smaller fortress.
 */
function keepBrewing(w: TestWorld, stillId: number, threshold: number): void {
  const brew = w.game.registry.table('recipes').index('brew');
  const orders = w.game.world.entities.get(stillId, C.Workshop)?.orders ?? [];
  const index = orders.findIndex((o) => o.recipe === brew && o.mode === 'maintain');
  if (index >= 0 && orders[index]!.threshold !== threshold) command(w, { type: 'EditWorkOrder', workshopId: stillId, index, patch: { threshold } });
}

/**
 * T-656: the days of drink under which a fortress is short of it. A raid's alert holds the fortress
 * inside for up to four days, and nobody brews while it shelters.
 */
export const DRINK_RESERVE_DAYS = 7;
/** T-656: the barrels the carpenter makes first, ahead of its furniture and beds, while the stills wait for one. */
export const BARRELS_AHEAD = 4;

/**
 * T-656: the stills wait for barrels while the drink runs out. A brew needs an empty barrel, and the
 * carpenter's barrels stood behind its chairs, tables and beds, with the logs a few at a time and the
 * wood furnace burning them to charcoal: at peril 4 the fortresses of `three-years-p4-4` and
 * `three-years-p4-5` had 200 to 1,000 plants and a still idle for want of a barrel, no drink for weeks,
 * and raids carrying off the barrels they had; the dwarves drank at the brook, where the ambushes
 * waited, and the critically thirsty came up the stair together as each alert ended. So while the
 * drink is under DRINK_RESERVE_DAYS for the dwarves and the stills have no free empty barrel, the
 * player has BARRELS_AHEAD barrels made first, and holds the wood furnace while they want the logs
 * (unless the squad's kit is being forged).
 */
function barrelsForDrink(w: TestWorld, state: FortressState, carpenter: number): void {
  const ent = w.game.world.entities;
  const items = w.readers.of<ItemsReader>('13');
  const buildings = w.readers.of<BuildingsReader>('14');
  const population = fortressDwarves(w).length;
  const stills = ['still', 'still2'].filter((k) => buildings.get(state.placedIds[k] ?? 0)?.state === 'built').length;
  const short = items.available('drink') < population * 0.77 * DRINK_RESERVE_DAYS &&
    items.countAvailable({ emptyContainer: 'barrel' }) < stills;
  const barrel = w.game.registry.table('recipes').index('make_barrel');
  const orders = (): readonly WorkOrder[] => ent.get(carpenter, C.Workshop)?.orders ?? [];
  let ahead = orders().findIndex((o) => o.recipe === barrel && o.mode === 'once');
  if (short && ahead < 0 && command(w, { type: 'AddWorkOrder', workshopId: carpenter, order: { recipeId: 'make_barrel', mode: 'once', remaining: BARRELS_AHEAD, priority: ROUTINE } }).ok) {
    command(w, { type: 'ReorderWorkOrder', workshopId: carpenter, from: orders().length - 1, to: 0 });
    ahead = 0;
  }
  const furnace = state.placedIds['wood_furnace'] ?? 0;
  const ws = ent.get(furnace, C.Workshop);
  if (ws === undefined) return;
  const hold = ahead >= 0 && !armingSquad(state) && items.available('log') < (orders()[ahead]?.remaining ?? 0) + 1;
  if (ws.suspended !== hold) command(w, { type: 'SuspendWorkshop', workshopId: furnace, on: hold });
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
    if (id) keepBrewing(w, id, drinkStock(population));
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
  // T-455: the cap is on the land, not the strips: on a slope a strip may hold few tiles or none.
  // T-667: the tries stop at twice the strips' cap only when they fail in a row: a try counts from the
  // last strip sown, so the tries the places off the map used up no longer stop a farm that still
  // finds ground (in `three-years-p2-4` at shift 0 the lifetime count reached 32 by day 228 with
  // fourteen strips sown, and a fortress of 68 ended year 3 with no plant or meal in stock).
  const stripTiles = plans.reduce((sum, p) => sum + p.tiles.length, 0);
  let misses = 0;
  for (let i = plans.length - 1; i >= 0 && plans[i]!.tiles.length === 0; i -= 1) misses += 1;
  if (stripTiles >= FARM_STRIP.max * FARM_STRIP.width * FARM_STRIP.rows || misses >= 2 * FARM_STRIP.max || tilled >= (fortressDwarves(w).length + NEXT_WAVE) * FARM_TILES_PER_DWARF) return;
  // T-455: the fortress's level, since a cave on a slope may lie more than one level below it.
  const z = state.z;
  // T-580: where ambushes are possible, a strip goes on the open ground nearest the gate. T-664: where
  // no such ground is left the strip goes to its place west of the first field, as before. Each day
  // the search found none it counted a try, and in `three-years-p2-4` at shift 0 the tries reached
  // the cap within a month with one strip sown: the farm stayed at four plots of 51 tiles while the
  // fortress grew from 11 dwarves to 58, and 22 starved.
  const near = state.economy.workHall !== undefined ? nearGateStrip(w, state) : [];
  if (near.length >= FARM_STRIP.width) {
    const plan = { tiles: near, zoneId: -1 };
    plans.push(plan);
    if (!command(w, { type: 'CreateZone', zoneType: 'farm_plot', tiles: near }).ok) { plan.tiles = []; return; }
    plan.zoneId = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastCreatedZone;
    const crops = plans.length % 2 === 1 ? ['turnip', 'turnip', 'turnip'] : ['barley', 'barley', 'turnip'];
    for (const [season, speciesId] of crops.entries()) command(w, { type: 'SetPlotCrop', zoneId: plan.zoneId, season, speciesId });
    return;
  }
  // Strips run west of the first field, then in a second row south of it.
  const column = (plans.length % FARM_STRIP.columns) + 1;
  const row = Math.floor(plans.length / FARM_STRIP.columns);
  const x0 = state.cx - 8 - column * FARM_STRIP.width;
  const y0 = state.cy + 16 + row * FARM_STRIP.rows;
  const tiles: number[] = [];
  for (let y = y0; y < y0 + FARM_STRIP.rows; y += 1) for (let x = x0; x < x0 + FARM_STRIP.width; x += 1) {
    if (x < 2 || y < 2 || x >= map.w - 2 || y >= map.h - 2) continue;
    const t = w.index(x, y, z);
    if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t) && buildings.cropLitAt(t) && !isKeptOff(w, t)) tiles.push(t);
  }
  // T-455: a slope may leave too little of the strip: as a player would, sow the same strip nearby.
  // When that level is full, the next surface level the dwarves can walk to. T-507: only sunlit
  // tiles; a strip with a dark tile (dug rock one level down) is not a surface plot and refuses its crops.
  for (const level of [z, z - 1, z + 1, z - 2, z + 2]) {
    if (tiles.length >= FARM_STRIP.width) break;
    tiles.splice(0, tiles.length, ...siteTiles(w, 'farm_plot', x0, y0, FARM_STRIP.width, FARM_STRIP.rows, level, { x: state.cx + 6, y: state.cy + 6 }, FARM_STRIP.width).filter((t) => buildings.cropLitAt(t) && !isKeptOff(w, t)));
  }
  // T-667: the places run in rows south of the first field and leave the map after a few rows: a
  // place with too little ground takes the nearest free sunlit soil on the wagon's side, as by the
  // gate (where the gate's strip was already sought, there is none).
  if (tiles.length < FARM_STRIP.width && state.economy.workHall === undefined) tiles.splice(0, tiles.length, ...nearGateStrip(w, state));
  const plan = { tiles, zoneId: -1 };
  plans.push(plan);
  if (tiles.length < FARM_STRIP.width || !command(w, { type: 'CreateZone', zoneType: 'farm_plot', tiles }).ok) { plan.tiles = []; return; }
  plan.zoneId = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastCreatedZone;
  const crops = plans.length % 2 === 1 ? ['turnip', 'turnip', 'turnip'] : ['barley', 'barley', 'turnip'];
  for (const [season, speciesId] of crops.entries()) command(w, { type: 'SetPlotCrop', zoneId: plan.zoneId, season, speciesId });
}

/**
 * T-580: the farm strip nearest the gate stair at the fortress's level: a `FARM_STRIP` rectangle
 * of free, sunlit soil wholly outside the gate's clearance and the depot's ring, its centre nearest
 * the stair (ties by tile index). Empty when the level has none.
 */
function nearGateStrip(w: TestWorld, state: FortressState): number[] {
  const map = w.map, z = state.z;
  const buildings = w.readers.of<BuildingsReader>('14');
  const gx = state.cx + 6, gy = state.cy + 6;
  const depot = buildings.get(state.placedIds['trade_depot'] ?? 0);
  const ok = new Map<number, boolean>();
  const good = (x: number, y: number): boolean => {
    const t = w.index(x, y, z);
    let v = ok.get(t);
    if (v === undefined) {
      v = Math.max(Math.abs(x - gx), Math.abs(y - gy)) > ENTRANCE_CLEARANCE + 1 && buildings.zoneAt(t) === 0 &&
        buildings.zoneTileQualifies('farm_plot', t) && buildings.cropLitAt(t) && onWagonSide(w, t) && !isKeptOff(w, t) &&
        !(depot?.footprint.some((d) => Math.max(Math.abs(map.xOf(d) - x), Math.abs(map.yOf(d) - y)) <= DEPOT_CLEARANCE + 1) ?? false);
      ok.set(t, v);
    }
    return v;
  };
  let best: number[] = [], bestDistance = Infinity;
  for (let y0 = 2; y0 + FARM_STRIP.rows <= map.h - 2; y0 += 1) for (let x0 = 2; x0 + FARM_STRIP.width <= map.w - 2; x0 += 1) {
    const distance = Math.max(Math.abs(x0 + (FARM_STRIP.width - 1) / 2 - gx), Math.abs(y0 + (FARM_STRIP.rows - 1) / 2 - gy));
    if (distance >= bestDistance) continue;
    const tiles: number[] = [];
    for (let y = y0; y < y0 + FARM_STRIP.rows && tiles.length >= (y - y0) * FARM_STRIP.width; y += 1) for (let x = x0; x < x0 + FARM_STRIP.width; x += 1) {
      if (!good(x, y)) break;
      tiles.push(w.index(x, y, z));
    }
    if (tiles.length === FARM_STRIP.width * FARM_STRIP.rows) { best = tiles; bestDistance = distance; }
  }
  return best;
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
  // T-512: in the season under way a player sows only what ripens before winter (`ripensInTime`, the
  // reckoning the plot panel's note reads, T-516); sown later, a
  // crop lies dormant until the frost kills it, and its seed with it. Nothing left: fallow.
  const calendar = w.readers.calendar;
  const ripens = (speciesId: string): boolean => {
    const row = plants.def(speciesId);
    return row !== undefined && ripensInTime(row, calendar.season, calendar.dayOfSeason);
  };
  for (const [season, all] of SURFACE_CROPS.entries()) {
    const list = season === calendar.season ? all.filter(ripens) : all;
    const left = new Map(supply);
    for (const zoneId of plots.filter((z) => plants.plotKind(z) === 'surface')) {
      const tiles = buildings.zone(zoneId)!.tiles.length;
      const current = name(plants.plotSettings(zoneId)[season]);
      if (list.length === 0) {
        if (current !== '') command(w, { type: 'SetPlotCrop', zoneId, season, speciesId: 0 });
        continue;
      }
      const chosen = pick(tiles, current, list, left);
      if (chosen === '' || !list.includes(chosen)) {
        if (current !== '' && !list.includes(current)) command(w, { type: 'SetPlotCrop', zoneId, season, speciesId: 0 });
        continue;
      }
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
  const terrain = w.readers.of<TerrainReader>('03');
  for (const plan of plans) {
    // A tile whose dig designation is gone without its being dug no longer holds the strip back.
    if (plan.zoneId !== -1 || !plan.tiles.every((t) => map.kindAt(t) === TileKind.Floor || !terrain.designationAt(t))) continue;
    const tiles = plan.tiles.filter((t) => map.kindAt(t) === TileKind.Floor && buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
    plan.zoneId = 0;
    if (tiles.length > 0 && command(w, { type: 'CreateZone', zoneType: 'farm_plot', tiles }).ok) plan.zoneId = bSystem.lastCreatedZone;
  }
  if (plans.some((p) => p.zoneId === -1) || plans.length >= CAVE_STRIPS.length) return;
  if (westCaveFarm(w, state) && w.tick < WEST_CAVE_STRIPS_FROM_DAY * TICKS_PER_DAY) return;
  // Cave seed in stock beyond what the cave plots' empty tiles will take.
  const stock = seedSupply(w, false);
  const plants = w.readers.of<PlantsReader>('07');
  const empty = plants.plots().filter((z) => plants.plotKind(z) === 'cave')
    .reduce((sum, z) => sum + (buildings.zone(z)?.tiles.filter((t) => plants.cropAt(t) === 0).length ?? 0), 0);
  const caveSeed = CAVE_CROPS.reduce((sum, sp) => sum + (stock.get(sp) ?? 0), 0);
  if (caveSeed - empty < CAVE_STRIP_SEED) return;
  const tiles = caveStripTiles(w, state, plans.length);
  plans.push({ tiles, zoneId: tiles.length === 0 ? 0 : -1 });
  if (tiles.length > 0) command(w, { type: 'Designate', kind: 'dig', priority: ROUTINE, tiles });
}

/** T-455: the cave farm lies west of the stair (the east side would open to the hillside). */
function westCaveFarm(w: TestWorld, state: FortressState): boolean {
  return w.map.xOf(state.caveTiles1[0]!) < state.cx + CAVE_STAIR_X;
}

/**
 * The rock of cave strip `n` (`CAVE_STRIPS`), on the cave farm's side of the stair: T-455 may put
 * the farm west of the stair, and the strips are then mirrored about it (T-507: east of the stair
 * they lay in solid rock that no miner could reach, and the bought cave seed was never sown). Only
 * tiles joined to the farm or an earlier strip are taken, so a strip can always be dug.
 */
export function caveStripTiles(w: TestWorld, state: FortressState, n: number): number[] {
  const map = w.map;
  const terrain = w.readers.of<TerrainReader>('03');
  const [ex0, ex1, y0, y1] = CAVE_STRIPS[n]!;
  const west = westCaveFarm(w, state);
  const [x0, x1] = west ? [2 * CAVE_STAIR_X - ex1, 2 * CAVE_STAIR_X - ex0] : [ex0, ex1];
  const z = map.zOf(state.caveTiles1[0]!);
  const open = new Set<number>();
  for (let y = state.cy + y0; y <= state.cy + y1; y += 1) for (let x = state.cx + x0; x <= state.cx + x1; x += 1) {
    if (x < 2 || y < 2 || x >= map.w - 2 || y >= map.h - 2) continue;
    const t = w.index(x, y, z);
    if (map.kindAt(t) === TileKind.Wall && map.fluidLevelAt(t) === 0 && !terrain.designationAt(t) && !opensToHillside(w, t)) open.add(t);
  }
  const farm = new Set([...state.caveTiles1, ...state.caveTiles2, ...state.economy.cavePlans.flatMap((p) => p.tiles)]);
  const joined = new Set<number>();
  const todo = [...open].filter((t) => map.neighbors8(t).some((b) => farm.has(b)));
  while (todo.length > 0) {
    const t = todo.pop()!;
    if (joined.has(t)) continue;
    joined.add(t);
    for (const b of map.neighbors8(t)) if (open.has(b) && !joined.has(b)) todo.push(b);
  }
  return [...open].filter((t) => joined.has(t));
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
    const pantry = state.pantryTiles.map((t) => buildings.zoneAt(t)).find((id) => id !== 0 && buildings.zone(id)?.type === 'stockpile') ?? 0;
    const tiles = pantry === 0 ? 0 : buildings.zone(pantry)?.tiles.length ?? 0;
    if (pantry !== 0 && command(w, { type: 'SetStockpileContainers', zoneId: pantry, wants: { barrel: tiles } }).ok) economy.phases.add('pantry barrels');
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
    const dig = tiles.filter((t) => w.map.kindAt(t) === TileKind.Wall && !opensToHillside(w, t));
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
  keepThanesShare(w, state);
  if (state.economy.lastDay === day) return;
  const first = state.economy.lastDay < 0;
  state.economy.lastDay = day;
  const { phases } = state.economy;
  const buildings = w.readers.of<BuildingsReader>('14');
  checkArming(w, state, first, day);
  releaseSpecialists(w, state);
  keepFoodFirst(w, state);
  // Give the growing settlement a builder rather than leaving every immigrant on food and
  // hauling: those higher-priority supply jobs otherwise consume all of the spare workforce.
  if (fortressDwarves(w).length >= SPECIALIST_MIN_POPULATION && state.economy.specialists['builder'] === undefined) {
    const available = specialistCandidates(w, state);
    const dwarves = w.readers.of<DwarvesReader>('10');
    available.sort((a, b) => dwarves.skill(b, 'masonry') - dwarves.skill(a, 'masonry') || a - b);
    const builder = available[0];
    if (builder !== undefined) {
      state.economy.specialists['builder'] = builder;
      dedicate(w, state, builder, ['masonry', 'construction', 'smelting']);
    }
  }
  keepMasonAtWork(w, state);
  raiseWaitingWork(w, state);
  // Masonry includes hundreds of room-finishing jobs. Keep a separate furnace worker on fuel,
  // iron and alloy rather than asking the builder to smelt after every nearby smoothing job.
  if (fortressDwarves(w).length >= SPECIALIST_MIN_POPULATION && !armingSquad(state)) {
    const { specialists } = state.economy;
    const ent = w.game.world.entities;
    const pick = (role: string): number | undefined => {
      // T-616: a furnace worker who died is replaced, as a player replaces one.
      if (specialists[role] !== undefined && !ent.alive(specialists[role]!)) delete specialists[role];
      if (specialists[role] === undefined) {
        const available = specialistCandidates(w, state);
        const dwarves = w.readers.of<DwarvesReader>('10');
        available.sort((a, b) => dwarves.skill(b, 'smelting') - dwarves.skill(a, 'smelting') || a - b);
        if (available[0] !== undefined) specialists[role] = available[0];
      }
      return specialists[role];
    };
    const fuel = pick('fuel');
    // T-616: while the squad's steel kits are owed, a second
    // worker burns the charcoal and the first smelts: five kits are 50 steel bars, which take some 150
    // charcoal (an alloy burns two, the ore's smelt and the forge's job one each), and one worker for
    // both furnaces made 120 to 290 charcoal and 26 to 100 smelts in three years (T-606's sweep).
    const steel = state.strong?.since !== undefined && state.strong.steelOwed === true;
    const burner = steel || specialists['charcoal'] !== undefined ? pick('charcoal') : undefined;
    for (const [type, worker] of [['wood_furnace', burner ?? fuel], ['smelter', fuel]] as const) {
      if (worker === undefined || !ent.alive(worker)) continue;
      // T-362: no hauling. The furnaces lie far from where its needs take it, and an assigned
      // worker's 500-point bonus (11 § Assignment) is fifty tiles: with hauling on it took the
      // haul jobs beside the halls and left the smelter's job open for weeks.
      dedicate(w, state, worker, ['smelting'], false);
      const id = state.placedIds[type];
      if (id && buildings.get(id)?.state === 'built' && ent.get(id, C.Workshop)?.assignedWorker !== worker) {
        command(w, { type: 'SetWorkshopWorker', workshopId: id, dwarfId: worker });
      }
    }
    // T-642: the smith works the second smelter beside the forge, which waits on the steel while the
    // kits are owed. A worker of its own took a hand from the fortress's other work, and with it the
    // sweep's living fell (reports/data/2026-11-19-t642-iron-for-steel.md).
    const smith = specialists['forge'];
    const second = state.placedIds['smelter_2'] ?? 0;
    if (smith !== undefined && ent.alive(smith) && buildings.get(second)?.state === 'built' && ent.get(second, C.Workshop)?.assignedWorker !== smith) {
      command(w, { type: 'SetWorkshopWorker', workshopId: second, dwarfId: smith }, ['not_found', 'no_labor']);
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
  keepWoodcutter(w, state);
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
    placeEconomyBuilding(w, state, 'wood_furnace', -12, 10, METAL_BUILD);
    placeEconomyBuilding(w, state, 'smelter', -16, 10, METAL_BUILD);
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
    keepBrewing(w, still, drinkStock(population));
  }
  const foodBarrels = checkLarder(w, state);
  const carpenter = state.placedIds['carpenter'];
  if (carpenter && state.orderedWorkshops.has('carpenter')) barrelsForDrink(w, state, carpenter);
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
    // Beds come before barrels until every dwarf and the hospital has one: in a bedroom, or once the
    // bedrooms are spent in a dormitory (T-571).
    const population = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
    const bedPlaces = state.bedroomPlans.filter((bp) => bp.designated).length + (state.dormitories ?? []).reduce((n, d) => n + d.tiles.length, 0) +
      (state.strong?.quarters?.tiles.length ?? 0);
    const beds = Math.min(bedPlaces, population + 1) - owned(w, 'bed');
    // T-572: a wooden bed takes a pallet's materials beside its log. The cloth is the hospital's: a
    // bleeding wound is bandaged with one (17 § Treatment), and the wagon brings five, so the beds are
    // stuffed with the barley's and the cavewheat's straw (make_bed_straw), and of cloth or wool
    // (make_bed) only from what the hospital's ten leave over. An order that cannot run while the other
    // can is swapped for the other, with what it had left to make.
    const BED_RECIPES = ['make_bed', 'make_bed_straw'] as const;
    const runnable = (id: string): boolean => w.readers.of<WorkshopsReader>('12').isRunnable(id, carpenter).runnable;
    const spareCloth = items.available('cloth') + items.available('wool_raw') >= BED_CLOTH_KEPT + 2;
    const allowed = (id: string): boolean => runnable(id) && (id !== 'make_bed' || spareCloth);
    const bedRecipe = allowed('make_bed') && !runnable('make_bed_straw') ? 'make_bed' : 'make_bed_straw';
    const bedOrder = orders().findIndex((o) => BED_RECIPES.some((id) => o.recipe === recipes.index(id)));
    const addBeds = (remaining: number): void => {
      const added = command(w, { type: 'AddWorkOrder', workshopId: carpenter, order: { recipeId: bedRecipe, mode: 'once', remaining, priority: ROUTINE } });
      const at = standing();
      if (added.ok && at >= 0) command(w, { type: 'ReorderWorkOrder', workshopId: carpenter, from: orders().length - 1, to: at });
    };
    if (beds > 0 && bedOrder < 0) {
      addBeds(beds);
    } else if (bedOrder >= 0) {
      const held = orders()[bedOrder]!;
      const heldId = held.recipe === recipes.index('make_bed') ? 'make_bed' : 'make_bed_straw';
      // Never while the carpenter is at a bed: a job holds its stuffing, so its own recipe reads as waiting.
      const current = w.game.world.entities.get(carpenter, C.Workshop)?.currentJobId ?? 0;
      const atBed = current !== 0 && BED_RECIPES.some((id) => w.readers.of<JobsReader>('11').get(current)?.data?.['recipe'] === id);
      if (heldId !== bedRecipe && !allowed(heldId) && !atBed) {
        command(w, { type: 'RemoveWorkOrder', workshopId: carpenter, index: bedOrder });
        addBeds(Math.max(held.remaining, beds));
      } else if (beds > held.remaining + 1) {
        command(w, { type: 'EditWorkOrder', workshopId: carpenter, index: bedOrder, patch: { remaining: beds } });
      }
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
  // T-683: not while the forge is being moved below (keepWorkBelow): the old one is taken down before the
  // new one is placed, and the new one takes the old one's orders once it stands.
  if (forge && state.orderedWorkshops.has('forge') && !arming && !phases.has('iron goods') && w.readers.of<BuildingsReader>('14').get(forge)?.state === 'built') {
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
  if (smeltsSteel(state, day) && smelter && state.orderedWorkshops.has('smelter')) {
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
    keepCoal(w, state, smelter, day);
    keepSecondSmelter(w, state);
    keepOreStore(w, state);
    keepFluxStore(w, state);
    keepFlux(w, state, isFlux);
  }
  // The steel chain's inputs, journalled weekly from the alloy order's day (observation only).
  if (day >= (state.strong?.since ?? 217) && day % 7 === 0 && smelter) {
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
      const key = t === 'bar' ? `bar:${m}` : t === 'raw_stone' && flux.has(m) ? 'flux' : t === 'charcoal_bar' || m.endsWith('coal') || m === 'lignite' ? `fuel:${t}` :
        t === 'ore' && ['hematite', 'limonite', 'magnetite'].includes(m) ? 'ore:iron' : t === 'log' ? 'log' : '';
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
    const crafts = Math.min(999, Math.max(day >= 112 ? 120 : 60, CRAFTS_PER_DWARF * fortressDwarves(w).length));
    // T-632: the crafts are made for the caravans, and every one goes to the depot (trade), where
    // the order's stock no longer sees it (13: goods at the depot are not available). As a player
    // keeps a number of crafts in all, the order keeps at home what the depot lacks of it.
    const ws = w.game.world.entities.get(craftdwarf, C.Workshop);
    const order = ws?.orders[0];
    const threshold = Math.max(1, crafts - craftsAtDepot(w, order?.materialFilter ?? null));
    // An edit cancels the job in hand (12), so the stock is changed between jobs, or when the
    // crafts at home already meet it and the job in hand would be the order's last.
    const met = w.readers.of<ItemsReader>('13').countAvailable({ tag: 'craft', ...(typeof order?.materialFilter === 'number' ? { materialId: order.materialFilter } : {}) }) >= threshold;
    if (order !== undefined && order.threshold !== threshold && (!ws?.currentJobId || met)) {
      command(w, { type: 'EditWorkOrder', workshopId: craftdwarf, index: 0, patch: { threshold } });
    }
    // T-616: while the squad's steel is owed the stone crafts are made of the commonest stone that is
    // no flux, and the flux goes to the smelter: the crafts took any stone, flux too.
    // The stone chosen is kept while a few of it are left, so the order is not edited every day.
    const held = w.game.world.entities.get(craftdwarf, C.Workshop)?.orders[0]?.materialFilter ?? null;
    const counts = state.strong?.steelOwed === true ? stoneToHand(w) : new Map<number, number>();
    const keep = typeof held === 'number' && (counts.get(held) ?? 0) >= STONE_KEPT_FOR_CRAFTS;
    const best = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
    const wanted = state.strong?.steelOwed !== true ? null : keep ? held : best;
    if (held !== wanted) command(w, { type: 'EditWorkOrder', workshopId: craftdwarf, index: 0,
      patch: { materialFilter: wanted === null ? null : w.game.registry.table<{ id: string }>('materials').byIndex(wanted)?.id ?? null } });
  }
  // Work follows the population: a new ore drift every season of years 2 and 3.
  if (day >= 112 + DRIFT_EVERY_DAYS && phases.has('shaft')) {
    const name = `drift ${Math.floor(day / DRIFT_EVERY_DAYS)}`;
    if (!phases.has(name)) { phases.add(name); mine(w, state, upper, isOre, 20); mine(w, state, upper, isGem, 5); }
  }
  checkBrewer(w, state);
  keepAMiner(w, state);
  keepAHauler(w);
  checkFarm(w, state);
  checkCaveStrips(w, state);
  checkCrops(w);
  checkKitchens(w, state);
  keepWorkBelow(w, state, day);
  keepFuelStore(w, state);
  checkMakingDo(w, state, day);
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
