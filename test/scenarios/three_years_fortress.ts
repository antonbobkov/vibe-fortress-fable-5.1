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
import type { TileIndex } from '@core/types';
import { EmbarkSession } from '@systems/embark';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import type { ItemsReader } from '@systems/items';
import type { TerrainReader } from '@systems/terrain/reader';
import type { AnimalsReader } from '@systems/animals';
import type { DwarvesReader } from '@systems/dwarves';
import { TestWorld } from './test-world';
import { command } from './script-commands';
import { armingSquad, assignBroker, BUILD, checkEconomy, KIT_FIRST, owned, placeEconomyBuilding, ROUTINE, SQUAD_KIT, SQUAD_SIZE, type EconomyState } from './three_years_economy';
import { attachThreeYearsMeasurements, note, observeImmigration, stepThreeYears, type ThreeYearsMeasurements } from './three_years_measurements';

export const Z = FLAT_TEST_SURFACE_Z;
// Six levels below the surface puts rooms below Serene Vale's deeper soil.
export const HALL_Z = 26;
/** T-448: the halls lie this many levels below the surface level of the gate's column. */
export const SURFACE_TO_HALL = Z - HALL_Z;
/** T-451: tiles around the gate's stair a moved zone keeps off: its walls, doors and the tiles outside them. */
const GATE_CLEARANCE = 2;
/** T-448: how far the script looks for another site for a zone whose designed one has no tile at the fortress's level. */
const SITE_SEARCH = 12;

/**
 * F-17g: the labors given one step: the food chain. Hauling keeps the default: everybody but the
 * miners hauls, so its jobs (which default to 6) are done between crafts and never ahead of one.
 */
const STEP_LABORS: readonly string[] = ['farming', 'brewing', 'cooking'];

/** Labors every dwarf but the two miners keeps on beside its craft. */
const EVERYBODY: readonly string[] = ['hauling', 'medicine'];

/** Ticks between two looks at the map for danger: a player who watches the screen. */
const WATCH_EVERY = 20;
/** A dangerous wild animal this near the gate or a dwarf is answered (tiles, Chebyshev). */
const WILD_NEAR = 14;
/** The alert stands down after this long with no danger near. */
const ALL_CLEAR_TICKS = 300;
/** T-387: a threat warning's lead (a day, 18 § Schedule) and the first raider's arrival after it. */
const WARNED_TICKS = TICKS_PER_DAY + 100;
/** T-387: the longest a hearth alert stands for wild animals that nobody hunts. */
const WILD_ALERT_TICKS = TICKS_PER_DAY / 2;
/** T-387: after such an alert is lifted, wild animals alone raise no alert for this long. */
const WILD_QUIET_TICKS = TICKS_PER_DAY;
/** The founders who stand in the squad: the woodcutter, the mason, the seventh, and the two miners. */
const MILITIA: readonly number[] = [2, 3, 6, 0, 1];
/** Barrels made before anything else at the carpenter's. */
const FIRST_BARRELS = 6;

/** D-225: ordinary wealth-2 generation, compact dimensions for the long-running tests. */
/**
 * T-448: the relief of the three-year regions, the median of temperate forest over twelve standard
 * worlds (reports/audits/2026-10-30-instrument-relief.md, reports/audits/2026-10-31-three-year-script-on-relief.md).
 */
export const THREE_YEARS_RELIEF = 1;

export function threeYearsWorld(seed: string, peril = 0, surfaceWildlife?: 'none', relief: 0 | 1 | 2 | 3 = THREE_YEARS_RELIEF): TestWorld {
  const registry = contentRegistry();
  const spec = regionSpec(seed, { peril, wealth: 2, biome: 'temperate_forest', geology: 'mixed', traits: peril === 0 ? ['serene_vale'] : [], relief,
    river: { class: 'brook', inflow: ['w'], outflow: 's' } }, registry);
  const map = new Map3D(48, 48, LOCAL_MAP_Z);
  const local = generateLocal(spec, map, registry);
  let instrument: ThreeYearsMeasurements | null = null;
  const systems = HeadlessGame.standardSystems(spec, local.layerStack, local).map((s) =>
    s.id === '21' ? observeImmigration(s, () => instrument) : s);
  const w = new TestWorld({ seed, registry, map, spec,
    systems,
    ...(surfaceWildlife === undefined ? {} : { surfaceWildlife }),
    embark: threeYearsEmbark(registry, seed, peril) });
  instrument = attachThreeYearsMeasurements(w, seed);
  return w;
}

/**
 * Real embark path for the three-year fortress, through EmbarkSession and the Balanced preset.
 * F-17i: the seventh founder's ten skill points buy the metal crafts the fortress actually uses
 * instead of medicine, crossbow and hunting; no attribute or seed is rerolled. Three iron spears
 * replace supplies the fortress never uses, for the wild animals of the map.
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
  // Boar country: three clubs lose to one boar and three iron spears do not, so the squad's
  // weapons come in the wagon. They are paid for with what this fortress never uses: the crossbow,
  // its bolts and quiver (the seventh founder is a smith, and a stray bolt hits a friend), the
  // strawberry and flax seed, the mechanism, the leather, the table and chairs the mason makes on
  // site, and the meat. Where the anvil comes too there is money for two spears, not three.
  const unused = ['e_crossbow', 'e_bolts_copper', 'e_quiver', 'e_seed_strawberry', 'e_seed_flax', 'e_leather', 'e_table', 'e_chair', 'e_meat'];
  // The mechanism stays where traps are built (perils 2 and 4, which buy one spear fewer).
  for (const entry of peril >= 2 ? unused : [...unused, 'e_mechanism']) {
    const rDrop = session.apply({ type: 'SetSupply', entry, count: 0 });
    if (!rDrop.ok) throw new Error(`threeYearsEmbark SetSupply ${entry} failed: ${rDrop.reason}`);
  }
  const rSpears = session.apply({ type: 'SetSupply', entry: 'e_spear_iron', count: peril >= 2 ? SQUAD_SIZE - 1 : SQUAD_SIZE });
  if (!rSpears.ok) throw new Error(`threeYearsEmbark SetSupply e_spear_iron failed: ${rSpears.reason}`);
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

/** The bedroom plan that becomes the hospital. */
const HOSPITAL_ROOM = 1;

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
  /** T-448: the surface level of the fortress (the wagon's) and the level of its halls below the gate. */
  readonly z: number;
  readonly hallZ: number;
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
  /** T-488: the halls' hearth, tables and chairs, where the script placed them, to place again when one is gone. */
  hallFurniture?: { readonly type: string; readonly origin: number; readonly priority: number }[];
  caveFarmId1: number;
  caveFarmId2: number;
  hearthBuildingId: number;
  gateDoorId: number;
  gateDoorPlaced: boolean;
  /** T-426: the tick a gate wall was first seen missing after the walls stood, or 0. */
  gateWallLostTick: number;
  gateDoorId2: number;
  gateDoorPlaced2: boolean;
  /**
   * T-518: the second line, the doors on the four ways out of the stair's foot on the hall level
   * (west, east, north, south; 0 until placed), and when the short way round them was last asked for.
   */
  innerDoorIds?: number[];
  innerRingAsked?: number;
  /** T-518: the last threat warning was of a siege (a party that may bring door-breakers). */
  siegeWarned?: boolean;
  squadId: number;
  /** The dangers the squad's current orders answer, and when a danger was last near. */
  answered: string;
  lastDangerTick: number;
  /** The alert was lifted because it had locked every dwarf outside the gate (T-363). */
  shutOut: boolean;
  /**
   * Where the anvil came in the wagon: the founders' bedrooms, the hospital and the corridor to
   * them, dug at the kit's priority before the squad's ore is opened (empty elsewhere).
   */
  readonly shelterTiles: number[];
  /** How many of the world's events the script has read, for the threat warnings. */
  eventsRead: number;
  /** A threat warning keeps the fortress on alert until this tick, or until its party comes. */
  warnedUntil: number;
  /** When the hearth alert was last raised. */
  alertSince: number;
  /** No alert is raised for wild animals alone before this tick. */
  wildQuietUntil: number;
  hospitalSetup: boolean;
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

/**
 * T-448: a tile a dig designation accepts (03's precondition: natural wall or boulder; an
 * undiscovered tile is accepted blind). On a map with relief a designed rectangle may cross the
 * surface or open ground; the script digs only what it can.
 */
function diggable(w: TestWorld, t: number): boolean {
  if (!w.map.hasFlag(t, TileFlag.Discovered)) return true;
  const k = w.map.kindAt(t);
  return (k === TileKind.Wall || k === TileKind.Boulder) && !w.map.hasFlag(t, TileFlag.Constructed);
}

/**
 * T-455: whether digging a tile would open the fortress to the hillside: an outdoor tile, dry, lies
 * beside it on its level. The gate seals the stair; a room that breaks out of the slope lets a raid
 * walk round it. On level ground nothing below the surface has an outdoor neighbour but the brook.
 */
export function opensToHillside(w: TestWorld, t: number): boolean {
  return w.map.neighbors8(t).some((n) => w.map.hasFlag(n, TileFlag.Outdoor) && w.map.kindAt(n) !== TileKind.Wall && w.map.fluidLevelAt(n) === 0);
}

/**
 * T-455: the cave farm: twenty tiles beside the stair and twelve beyond them, one level below the
 * surface, east of the stair. Where a slope would open that plot to the hillside, it takes the side
 * of the stair and the level, down to three below the surface, with the most soil that can be dug
 * shut and joined to the stair; only those tiles are planned, so the plot can be finished.
 */
function caveSite(w: TestWorld, cx: number, cy: number, z: number): { near: number[]; far: number[] } {
  const map = w.map;
  const inMap = (x: number, y: number): boolean => x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1;
  const plan = (side: 'east' | 'west', level: number): { near: number[]; far: number[]; door: number } => {
    const near: number[] = [];
    const far: number[] = [];
    // Twenty tiles for the twenty dimcap seeds, twelve for the ten cavewheat seeds: every cave
    // seed in the wagon is in the ground (07: one harvest returns one seed, so seeds cap the farm).
    const [nearX0, nearX1, farX0, farX1] = side === 'east' ? [cx + 7, cx + 11, cx + 12, cx + 14] : [cx + 1, cx + 5, cx - 2, cx];
    for (let y = cy + 4; y <= cy + 7; y += 1) {
      for (let x = nearX0; x <= nearX1; x += 1) if (inMap(x, y)) near.push(w.index(x, y, level));
      for (let x = farX0; x <= farX1; x += 1) if (inMap(x, y)) far.push(w.index(x, y, level));
    }
    return { near, far, door: w.index(side === 'east' ? cx + 7 : cx + 5, cy + 6, level) };
  };
  const first = plan('east', z - 1);
  if (![...first.near, ...first.far].some((t) => opensToHillside(w, t))) return first;
  const soil = w.game.registry.table<{ id: string; class: string }>('materials');
  let best = { near: [] as number[], far: [] as number[] };
  let bestScore = -1;
  for (const level of [z - 1, z - 2, z - 3]) for (const side of ['east', 'west'] as const) {
    const site = plan(side, level);
    const open = new Set([...site.near, ...site.far].filter((t) => map.kindAt(t) === TileKind.Wall && !opensToHillside(w, t)));
    const joined = new Set<number>();
    const todo = open.has(site.door) ? [site.door] : [];
    while (todo.length > 0) {
      const t = todo.pop()!;
      if (joined.has(t)) continue;
      joined.add(t);
      for (const n of map.neighbors8(t)) if (open.has(n) && !joined.has(n)) todo.push(n);
    }
    const score = [...joined].filter((t) => soil.byIndex(map.materialAt(t))?.class === 'soil').length;
    if (score > bestScore) {
      bestScore = score;
      best = { near: site.near.filter((t) => joined.has(t)), far: site.far.filter((t) => joined.has(t)) };
    }
  }
  return best.near.length > 0 ? best : first;
}

/** T-448: designate the diggable tiles of `tiles`; nothing when none is. */
function designateDig(w: TestWorld, tiles: readonly number[], priority: number): void {
  const ok = tiles.filter((t) => diggable(w, t) && !opensToHillside(w, t));
  if (ok.length > 0) command(w, { type: 'Designate', kind: 'dig', priority, tiles: ok });
}

/** T-451: whether the dwarves at the wagon can walk to a tile. */
export function onWagonSide(w: TestWorld, t: number): boolean {
  const wagon = w.game.arrival!.wagon;
  return w.readers.pathing.labelOf(t, 'walker') === w.readers.pathing.labelOf(w.index(wagon.x, wagon.y, wagon.z), 'walker');
}

/** T-451: whether the dwarves at the wagon can reach a tree, on a tile beside it. */
function treeInReach(w: TestWorld, t: number): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    for (const dz of [0, 1, -1]) {
      const at = w.map.offset(t, dx, dy, dz);
      if (at >= 0 && onWagonSide(w, at)) return true;
    }
  }
  return false;
}

/**
 * T-451: the tree on a column's surface: at the fortress's level as ever, and on any other surface
 * level the dwarves can reach. -1 when the column has none.
 */
function surfaceTree(w: TestWorld, x: number, y: number, z: number): number {
  const level = w.index(x, y, z);
  if (w.map.kindAt(level) === TileKind.Tree) return level;
  const top = w.map.columnSurfaceZ(x, y);
  if (top < 0 || top === z) return -1;
  const t = w.index(x, y, top);
  return w.map.kindAt(t) === TileKind.Tree && treeInReach(w, t) ? t : -1;
}

/**
 * T-448: the qualifying, unzoned tiles of a `width` × `height` rectangle at level `z`; when the one
 * at (`x`, `y`) has none (on relief it may lie on another level), the nearest rectangle of that
 * size within `SITE_SEARCH` tiles that has the most. T-451: only tiles the dwarves at the wagon can
 * walk to; a brook may cut a site in two.
 */
export function siteTiles(w: TestWorld, zoneType: string, x: number, y: number, width: number, height: number, z: number, gate: { x: number; y: number }, enough = 1): number[] {
  const buildings = w.readers.of<BuildingsReader>('14');
  const at = (x0: number, y0: number): number[] => {
    const out: number[] = [];
    for (let yy = y0; yy < y0 + height; yy += 1) for (let xx = x0; xx < x0 + width; xx += 1) {
      if (xx < 1 || yy < 1 || xx >= w.map.w - 1 || yy >= w.map.h - 1) continue;
      // The gate's walls and doors will stand here: a zone under them would strand what is hauled to it.
      if (Math.abs(xx - gate.x) <= GATE_CLEARANCE && Math.abs(yy - gate.y) <= GATE_CLEARANCE) continue;
      const t = w.index(xx, yy, z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies(zoneType, t) && onWagonSide(w, t)) out.push(t);
    }
    return out;
  };
  const here = at(x, y);
  if (here.length >= enough) return here;
  let best: number[] = [];
  let bestD = Number.MAX_SAFE_INTEGER;
  for (let dy = -SITE_SEARCH; dy <= SITE_SEARCH; dy += 1) for (let dx = -SITE_SEARCH; dx <= SITE_SEARCH; dx += 1) {
    const d = Math.abs(dx) + Math.abs(dy);
    const tiles = at(x + dx, y + dy);
    if (tiles.length > best.length || (tiles.length === best.length && tiles.length > 0 && d < bestD)) { best = tiles; bestD = d; }
  }
  return best;
}

export function setupThreeYearsFortress(w: TestWorld): FortressState {
  const arrival = w.game.arrival;
  if (!arrival) throw new Error('three_years: no arrival');
  let { x: cx, y: cy } = arrival.wagon;
  // T-448: the fortress's levels come from the map: the surface is the wagon's level, and the
  // gate site is chosen among tiles of that level, so the hall lies SURFACE_TO_HALL below its column.
  const z = arrival.wagon.z;
  const hallZ = z - SURFACE_TO_HALL;
  const map = w.map;
  // Choose a gate site clear of shrubs and saplings, as a player picks open ground first.
  const sites: { x: number; y: number; distance: number }[] = [];
  for (let y = 8; y <= 13; y += 1) for (let x = 28; x <= 35; x += 1) {
    let usable = true;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const kind = map.kindAt(w.index(x + dx, y + dy, z));
      if (kind !== TileKind.Floor && kind !== TileKind.Tree) usable = false;
    }
    // Both tiles outside the future doors must also be clearable before enclosing the stair.
    for (const dy of [-2, 2]) {
      const kind = map.kindAt(w.index(x, y + dy, z));
      if (kind !== TileKind.Floor && kind !== TileKind.Tree) usable = false;
    }
    if (usable) sites.push({ x, y, distance: Math.abs(x - cx - 6) + Math.abs(y - cy - 6) });
  }
  // T-448: on a map with relief the window may hold no site at the wagon's level; then any on the map.
  if (sites.length === 0) {
    for (let y = 3; y <= map.h - 4; y += 1) for (let x = 2; x <= map.w - 3; x += 1) {
      let usable = true;
      for (let dy = -1; dy <= 1 && usable; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const kind = map.kindAt(w.index(x + dx, y + dy, z));
        if (kind !== TileKind.Floor && kind !== TileKind.Tree) usable = false;
      }
      for (const dy of [-2, 2]) {
        const kind = map.kindAt(w.index(x, y + dy, z));
        if (kind !== TileKind.Floor && kind !== TileKind.Tree) usable = false;
      }
      if (usable) sites.push({ x, y, distance: Math.abs(x - cx - 6) + Math.abs(y - cy - 6) });
    }
  }
  sites.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  if (!sites[0]) throw new Error('three_years: no usable gate site');
  cx = sites[0].x - 6;
  cy = sites[0].y - 6;

  // F-17g/F-17i: the founders keep their professions, as a player sets them in the labor manager,
  // instead of every job being made urgent: the two miners mine, the woodcutter
  // fells and saws, the farmer farms and brews, the cook cooks, brews and helps build. The mason
  // and the seventh founder keep the general labors (building, hauling, the remaining crafts).
  // Everybody but the two miners also hauls and tends the wounded, as the labor defaults have it.
  const professions: Record<number, readonly string[]> = {
    0: ['mining'], 1: ['mining', 'masonry'], 2: ['woodcutting', 'carpentry', ...EVERYBODY],
    3: ['masonry', 'smelting', 'construction', 'trading', ...EVERYBODY],
    4: ['farming', 'brewing', ...EVERYBODY], 5: ['cooking', 'brewing', 'construction', ...EVERYBODY],
  };
  for (const [index, id] of arrival.dwarves.entries()) {
    for (const row of w.game.registry.table<{ id: string; defaultOn: boolean }>('labors').rows.slice(1)) {
      const on = professions[index]?.includes(row.id) ?? (row.defaultOn && !['mining', 'woodcutting'].includes(row.id));
      command(w, { type: 'SetLabor', dwarfId: id, labor: row.id, on });
    }
  }

  // Chop real generated trees near the settlement; the generated brook supplies fallback water.
  const treeTiles: number[] = [];
  for (let y = cy; y <= cy + 29; y += 1) {
    for (let x = cx - 22; x <= cx + 15; x += 1) {
      if (x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1) {
        const t = surfaceTree(w, x, y, z);
        if (t >= 0) treeTiles.push(t);
      }
    }
  }
  const roadTrees: number[] = [];
  for (let y = 0; y <= cy + 3; y += 1) for (let x = 0; x < map.w; x += 1) {
    const t = surfaceTree(w, x, y, z);
    if (t >= 0) roadTrees.push(t);
  }

  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

  // 2. Stockpiles
  // 2a. General surface stockpile (8x6)
  const spTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 9; y += 1) {
    for (let x = cx - 5; x <= cx + 2; x += 1) {
      if (x >= 1 && x < map.w - 1 && y >= 1 && y < map.h - 1) {
        const t = w.index(x, y, z);
        if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('stockpile', t)) spTiles.push(t);
      }
    }
  }
  if (spTiles.length === 0) spTiles.push(...siteTiles(w, 'stockpile', cx - 5, cy + 4, 8, 6, z, { x: cx + 6, y: cy + 6 }));
  const rSp = command(w, { type: 'CreateZone', zoneType: 'stockpile', tiles: spTiles });
  if (!rSp.ok) throw new Error(`Stockpile CreateZone failed: ${rSp.reason}`);
  const spId = bSystem.lastCreatedZone;
  command(w, { type: 'SetStockpileFilter', zoneId: spId, filter: 'everything' });

  // 2b. Surface dedicated drink stockpile directly south of the still (3x2: x = cx..cx + 2, y = cy + 13..cy + 14)
  const drinkSpSurfaceTiles: number[] = [];
  for (let y = cy + 13; y <= cy + 14; y += 1) {
    for (let x = cx; x <= cx + 2; x += 1) {
      const t = w.index(x, y, z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('stockpile', t)) drinkSpSurfaceTiles.push(t);
    }
  }
  if (drinkSpSurfaceTiles.length === 0) drinkSpSurfaceTiles.push(...siteTiles(w, 'stockpile', cx, cy + 13, 3, 2, z, { x: cx + 6, y: cy + 6 }));
  const rDrinkSp = drinkSpSurfaceTiles.length > 0 ? command(w, { type: 'CreateZone', zoneType: 'stockpile', tiles: drinkSpSurfaceTiles }) : { ok: false };
  if (rDrinkSp.ok) {
    const dSpId = bSystem.lastCreatedZone;
    command(w, { type: 'SetStockpileFilter', zoneId: dSpId, filter: 'drink' });
    command(w, { type: 'SetStockpilePriority', zoneId: dSpId, priority: ROUTINE });
    // Loose drink keeps on a stockpile only in a barrel there (13 § Stockpiles), and 10 drinks
    // stocked barrels before the brook and the brook before brew left at the still. A third of the
    // tiles hold empty barrels; the rest stay free for the full barrels the still makes.
    command(w, { type: 'SetStockpileContainers', zoneId: dSpId, wants: { barrel: Math.ceil(drinkSpSurfaceTiles.length / 3) } });
  }

  // 3. F-17g: labors keep the default priority. Routine work is not urgent, so a dwarf eats,
  // drinks, sits and talks at the want threshold instead of deferring to the critical one. One real
  // bottleneck gets one step: the food chain (planting, harvesting, brewing, cooking).
  for (const row of w.game.registry.table<{ id: string }>('labors').rows.slice(1)) {
    command(w, { type: 'SetLaborPriority', labor: row.id, priority: STEP_LABORS.includes(row.id) ? ROUTINE - 1 : ROUTINE });
  }

  // 4. Stairwell to rock layer (z = hallZ). The gate site is cleared first by sequence, not by
  // urgency: its trees are the only ones designated until they are down.
  const gateTrees = treeTiles.filter((t) => Math.abs(map.xOf(t) - cx - 6) <= 2 && Math.abs(map.yOf(t) - cy - 6) <= 2);
  if (gateTrees.length) {
    command(w, { type: 'Designate', kind: 'chop', priority: ROUTINE, tiles: gateTrees });
    const end = w.tick + 6 * TICKS_PER_DAY;
    while (w.tick < end && !gateTrees.every((t) => map.kindAt(t) === TileKind.Floor)) stepThreeYears(w, 1);
  }
  const rStairs = command(w, { type: 'DesignateStairwell', x: cx + 6, y: cy + 6, zTop: z, zBottom: hallZ, priority: ROUTINE });
  if (!rStairs.ok) throw new Error(`DesignateStairwell failed: ${rStairs.reason}`);
  // The caravan road is cleared outright; the rest of the wood is felled in batches as the
  // log stock runs down (checkEconomy), so the haulers are not buried under a clear-cut forest.
  const road = roadTrees.filter((t) => map.kindAt(t) === TileKind.Tree);
  if (road.length) command(w, { type: 'Designate', kind: 'chop', priority: ROUTINE, tiles: road });

  // 5. Cave farm at z = 31
  const { near: caveTiles1, far: caveTiles2 } = caveSite(w, cx, cy, z);
  designateDig(w, [...caveTiles1, ...caveTiles2], ROUTINE);

  // 6. Underground designations at z = hallZ
  // Corridors
  const corridorTiles: number[] = [];
  // Central cross
  corridorTiles.push(w.index(cx + 5, cy + 6, hallZ)); // to dining hall
  corridorTiles.push(w.index(cx + 7, cy + 6, hallZ)); // to hearth hall
  // South corridor (y = cy + 7 .. cy + 45)
  for (let y = cy + 7; y <= Math.min(map.h - 3, cy + 45); y += 1) corridorTiles.push(w.index(cx + 6, y, hallZ));
  // North corridor (y = cy - 15 .. cy + 5)
  for (let y = Math.max(1, cy - 15); y <= cy + 5; y += 1) corridorTiles.push(w.index(cx + 6, y, hallZ));
  // West corridor (x = cx - 13 .. cx + 4, y = cy + 6)
  for (let x = Math.max(1, cx - 13); x <= cx + 4; x += 1) corridorTiles.push(w.index(x, cy + 6, hallZ));

  // Hearth Hall (6x5): x: cx + 8..cx + 13, y: cy + 4..cy + 8
  const hearthHallTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 8; y += 1) {
    for (let x = cx + 8; x <= cx + 13; x += 1) hearthHallTiles.push(w.index(x, y, hallZ));
  }

  // Dining Hall (5x5): x: cx..cx + 4, y: cy + 4..cy + 8
  const diningHallTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 8; y += 1) {
    for (let x = cx; x <= cx + 4; x += 1) diningHallTiles.push(w.index(x, y, hallZ));
  }

  // Underground drink stockpile annex (3x2) beside dining hall
  const drinkSpUndergroundTiles: number[] = [];
  for (let y = cy + 4; y <= cy + 5; y += 1) {
    for (let x = cx - 3; x <= cx - 1; x += 1) {
      if (x >= 1 && y >= 1) drinkSpUndergroundTiles.push(w.index(x, y, hallZ));
    }
  }

  const pantryTiles: number[] = [];
  for (let y = cy + 3; y <= cy + 5; y += 1) for (let x = cx - 8; x <= cx - 4; x += 1) pantryTiles.push(w.index(x, y, hallZ));
  const hallDigTiles: number[] = [...corridorTiles, ...hearthHallTiles, ...diningHallTiles, ...drinkSpUndergroundTiles, ...pantryTiles];
  // F-17h: with the anvil in the wagon the trunk corridor to the mine shaft goes a step ahead of
  // the halls, so ore for the squad's kit is reached first.
  const arming = w.readers.of<ItemsReader>('13').count('anvil') > 0;
  const trunk = corridorTiles.filter((t) => map.xOf(t) === cx + 6 && map.yOf(t) >= cy + 7 && map.yOf(t) <= Math.min(map.h - 3, cy + 15));
  if (arming) {
    designateDig(w, trunk, KIT_FIRST);
  }
  // Bedroom plans
  const bedroomPlans = buildBedroomPlans(cx, cy, map.w, map.h);
  const initialRooms = bedroomPlans.slice(0, arrival.dwarves.length + 2);
  // T-387: where the anvil came in the wagon the site is dangerous, and the founders' bedrooms,
  // the hospital and the corridor that reaches them are dug with the trunk, at the kit's
  // priority, before the squad's ore is opened (checkEconomy): the dwarves sleep, and the
  // wounded lie, below ground from the first weeks instead of on the surface.
  const shelterTiles: number[] = [];
  if (arming) {
    const lastDoorY = Math.max(...initialRooms.map((bp) => bp.doorY));
    const corridor = corridorTiles.filter((t) => map.xOf(t) === cx + 6 && map.yOf(t) > cy + 15 && map.yOf(t) <= lastDoorY);
    shelterTiles.push(...corridor);
    for (const bp of initialRooms) {
      shelterTiles.push(w.index(bp.doorX, bp.doorY, hallZ));
      for (let y = bp.y1; y <= bp.y2; y += 1) for (let x = bp.x1; x <= bp.x2; x += 1) shelterTiles.push(w.index(x, y, hallZ));
    }
    designateDig(w, shelterTiles, KIT_FIRST);
  }
  const ahead = new Set([...(arming ? trunk : []), ...shelterTiles]);
  designateDig(w, hallDigTiles.filter((t) => !ahead.has(t)), ROUTINE);

  // Fill in tile indices for all bedroom plans
  for (const bp of bedroomPlans) {
    bp.tiles = [];
    for (let y = bp.y1; y <= bp.y2; y += 1) {
      for (let x = bp.x1; x <= bp.x2; x += 1) {
        bp.tiles.push(w.index(x, y, hallZ));
      }
    }
  }

  // Dig for the actual embark party, with the hospital and one spare room; expand when immigrants arrive.
  const initialDigTiles: number[] = [];
  for (let i = 0; i < arrival.dwarves.length + 2 && i < bedroomPlans.length; i += 1) {
    const bp = bedroomPlans[i]!;
    bp.designated = true;
    initialDigTiles.push(w.index(bp.doorX, bp.doorY, hallZ));
    initialDigTiles.push(...bp.tiles);
  }
  designateDig(w, initialDigTiles.filter((t) => !ahead.has(t)), ROUTINE);

  // 7. Surface workshops
  const placedIds: Record<string, number> = {};

  // 8. Surface meeting spot in the alley between the still and the kitchen, where the workers
  // are: a dwarf who wants company finds it beside the benches instead of waiting in a far field.
  const meetTiles: number[] = [];
  for (let y = cy + 10; y <= cy + 13; y += 1) {
    const t = w.index(cx + 3, y, z);
    if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('meeting_area', t)) meetTiles.push(t);
  }
  if (meetTiles.length > 0) command(w, { type: 'CreateZone', zoneType: 'meeting_area', tiles: meetTiles });

  // 9. Surface barley and turnip farm
  stepThreeYears(w, 5);
  const farmTiles: number[] = [];
  for (let y = cy + 16; y <= cy + 19; y += 1) {
    for (let x = cx - 8; x <= cx - 5; x += 1) {
      const t = w.index(x, y, z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t)) farmTiles.push(t);
    }
  }
  if (farmTiles.length === 0) farmTiles.push(...siteTiles(w, 'farm_plot', cx - 8, cy + 16, 4, 4, z, { x: cx + 6, y: cy + 6 }));
  const rFarm = farmTiles.length > 0 ? command(w, { type: 'CreateZone', zoneType: 'farm_plot', tiles: farmTiles }) : { ok: false };
  if (rFarm.ok) {
    const farmId = bSystem.lastCreatedZone;
    command(w, { type: 'SetPlotCrop', zoneId: farmId, season: 0, speciesId: 'barley' });
    command(w, { type: 'SetPlotCrop', zoneId: farmId, season: 1, speciesId: 'barley' });
    command(w, { type: 'SetPlotCrop', zoneId: farmId, season: 2, speciesId: 'turnip' });
  }

  // 10. Surface pasture
  const pastureTiles: number[] = [];
  for (let y = cy + 16; y <= cy + 19; y += 1) {
    for (let x = cx + 2; x <= cx + 6; x += 1) {
      const t = w.index(x, y, z);
      if (buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('pasture', t)) pastureTiles.push(t);
    }
  }
  if (pastureTiles.length === 0) pastureTiles.push(...siteTiles(w, 'pasture', cx + 2, cy + 16, 5, 4, z, { x: cx + 6, y: cy + 6 }));
  const rPasture = pastureTiles.length > 0 ? command(w, { type: 'CreateZone', zoneType: 'pasture', tiles: pastureTiles }) : { ok: false };
  if (rPasture.ok) {
    const pastureId = bSystem.lastCreatedZone;
    // Only a tame grazer goes to pasture (08 § Pastures): the dogs and cats stay at home.
    const animals = w.readers.of<AnimalsReader>('08');
    for (const id of animals.tameList()) {
      if (animals.def(w.game.world.entities.get(id, C.Creature)?.species ?? -1)?.diet !== 'grazer') continue;
      command(w, { type: 'AssignPasture', animalId: id, zoneId: pastureId });
    }
  }

  // 11. Gather zone on the shrubs of the woods around the settlement: ripe brambles and
  // nutbushes are food. Only the shrub tiles themselves are zoned, so no building site is taken.
  const gatherTiles: number[] = [];
  for (let y = Math.max(1, cy - 6); y <= Math.min(map.h - 2, cy + 26); y += 1) {
    for (let x = Math.max(1, cx - 16); x <= Math.min(map.w - 2, cx + 18); x += 1) {
      const t = w.index(x, y, z);
      if (map.kindAt(t) === TileKind.Shrub && buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('gather', t)) gatherTiles.push(t);
    }
  }
  if (gatherTiles.length) command(w, { type: 'CreateZone', zoneType: 'gather', tiles: gatherTiles });

  return {
    economy: { lastDay: -1, phases: new Set(), traded: new Set(), mined: new Set(), workings: new Set(), specialists: {}, farmPlans: [], cavePlans: [] },
    cx,
    cy,
    z,
    hallZ,
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
    gateWallLostTick: 0,
    gateDoorId2: 0,
    gateDoorPlaced2: false,
    innerDoorIds: [0, 0, 0, 0],
    innerRingAsked: -1,
    siegeWarned: false,
    squadId: 0,
    answered: '',
    lastDangerTick: -1,
    shutOut: false,
    shelterTiles,
    eventsRead: 0,
    warnedUntil: -1,
    alertSince: -1,
    wildQuietUntil: -1,
    hospitalSetup: false,
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
    // The still cannot brew without empty barrels and the wagon's drink lasts two weeks, so the
    // first few barrels are made at once; then the hospital's chest and a wooden buckler for
    // each of the militia. Beds come before the standing barrel order (checkEconomy).
    for (const [recipeId, remaining] of [['make_barrel', FIRST_BARRELS], ['make_chest_wood', 1], ['make_buckler_wood', MILITIA.length]] as const) {
      command(w, { type: 'AddWorkOrder', workshopId: placedIds['carpenter'],
        order: { recipeId, mode: 'once', remaining, priority: ROUTINE } });
    }
    command(w, {
      type: 'AddWorkOrder',
      workshopId: placedIds['carpenter'],
      order: { recipeId: 'make_barrel', mode: 'maintain', threshold: 20, priority: ROUTINE },
    });
    command(w, {
      type: 'AddWorkOrder',
      workshopId: placedIds['carpenter'],
      order: { recipeId: 'make_table_wood', mode: 'maintain', threshold: 6, priority: ROUTINE },
    });
  }
  if (!ordered.has('mason') && buildings.get(placedIds['mason']!)?.state === 'built') {
    ordered.add('mason');
    // Stone blocks maintain 30: vital for hearth, constructions, and workshop building.
    // F-17h: while the squad waits for its kit the forge's blocks go a step ahead.
    command(w, {
      type: 'AddWorkOrder',
      workshopId: placedIds['mason'],
      order: { recipeId: 'make_stone_block', mode: 'maintain', threshold: 30, priority: armingSquad(state) ? KIT_FIRST : ROUTINE },
    });
    command(w, {
      type: 'AddWorkOrder',
      workshopId: placedIds['mason'],
      order: { recipeId: 'make_door_stone', mode: 'maintain', threshold: 4, priority: ROUTINE },
    });
    command(w, {
      type: 'AddWorkOrder',
      workshopId: placedIds['mason'],
      order: { recipeId: 'make_table_stone', mode: 'maintain', threshold: 6, priority: ROUTINE },
    });
    command(w, {
      type: 'AddWorkOrder',
      workshopId: placedIds['mason'],
      order: { recipeId: 'make_chair_stone', mode: 'maintain', threshold: 14, priority: ROUTINE },
    });
  }
  if (!ordered.has('craftdwarf') && buildings.get(placedIds['craftdwarf']!)?.state === 'built') {
    ordered.add('craftdwarf');
    command(w, {
      type: 'AddWorkOrder',
      workshopId: placedIds['craftdwarf'],
      order: { recipeId: 'craft_stone', mode: 'maintain', threshold: 60, priority: ROUTINE },
    });
  }
  if (!ordered.has('still') && buildings.get(placedIds['still']!)?.state === 'built') {
    ordered.add('still');
    command(w, {
      type: 'AddWorkOrder',
      workshopId: placedIds['still'],
      // Drink has first call on the plants: the one order a step ahead of the kitchen's.
      order: { recipeId: 'brew', mode: 'maintain', threshold: 80, priority: ROUTINE - 1 },
    });
  }
  if (!ordered.has('kitchen') && buildings.get(placedIds['kitchen']!)?.state === 'built') {
    ordered.add('kitchen');
    command(w, {
      type: 'AddWorkOrder',
      workshopId: placedIds['kitchen'],
      order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 20, priority: ROUTINE },
    });
    command(w, {
      type: 'AddWorkOrder',
      workshopId: placedIds['kitchen'],
      order: { recipeId: 'cook_fine_meal', mode: 'maintain', threshold: 10, priority: ROUTINE },
    });
  }

  // Forge: built as soon as balance.md year-one table allows (day 30–56, as soon as day 30 is reached and anvil available)
  // F-17h: from day 1 when the anvil came in the wagon and the squad waits for its kit.
  if (!state.forgePlaced && (w.tick >= 30 * TICKS_PER_DAY || armingSquad(state))) {
    const hasAnvil = owned(w, 'anvil') > 0;
    if (hasAnvil) {
      placeEconomyBuilding(w, state, 'forge', 12, 10, armingSquad(state) ? KIT_FIRST : BUILD);
      const forgeId = placedIds['forge'];
      if (forgeId) {
        const forge = buildings.get(forgeId)!;
        state.forgePlaced = true;
        const corners = [0, 2, 6, 8].map((i) => forge.footprint[i]!);
        command(w, { type: 'SetTraffic', tiles: corners, mode: 'forbidden' });
      }
    }
  }

  if (!ordered.has('forge') && state.placedIds['forge'] !== undefined && buildings.get(state.placedIds['forge'])?.state === 'built') {
    ordered.add('forge');
    state.forgeBuiltDay = Math.floor(w.tick / TICKS_PER_DAY) + 1;
    const corners = [0, 2, 6, 8].map((i) => buildings.get(state.placedIds['forge']!)!.footprint[i]!);
    command(w, { type: 'SetTraffic', tiles: corners, mode: 'normal' });
    if (armingSquad(state)) {
      // F-17h: the three soldiers' mail, shields and swords are the forge's only orders, ahead of
      // all routine work, until every piece is forged. Tools and export goods follow (checkEconomy).
      for (const recipeId of SQUAD_KIT) {
        command(w, { type: 'AddWorkOrder', workshopId: state.placedIds['forge'],
          order: { recipeId, mode: 'maintain', threshold: SQUAD_SIZE, materialFilter: 'iron', priority: KIT_FIRST } });
      }
    } else {
      // Replace tools first, then equip the squad before producing export goods.
      command(w, { type: 'AddWorkOrder', workshopId: state.placedIds['forge'],
        order: { recipeId: 'forge_pick', mode: 'once', remaining: 2, materialFilter: 'iron', priority: ROUTINE } });
      for (const recipeId of SQUAD_KIT) {
        command(w, { type: 'AddWorkOrder', workshopId: state.placedIds['forge'],
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
    command(w, { type: 'Designate', kind: 'smooth', priority, tiles: smoothTiles });
  }
}

/**
 * T-488: a hearth, table or chair of the halls that is gone (a miserable dwarf breaks the nearest
 * poor chair or table, 15 � Sulks) is placed again where it stood, as a player replaces it; the
 * builders bring a new one from stock. In `three-years-p2-7` (master 37da07a4) sulks of year 3
 * broke the dining hall's table and all four chairs and the 68-dwarf fortress ended without one.
 */
export function keepHallFurniture(w: TestWorld, state: FortressState): void {
  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;
  for (const { type, origin, priority } of state.hallFurniture ?? []) {
    if (buildings.at(origin) !== 0 || buildings.ghost(type, origin, 0).reason !== null) continue;
    if (!command(w, { type: 'PlaceBuilding', buildingType: type, origin, orientation: 0, materialChoice: 0, priority }).ok) continue;
    if (type === 'hearth') state.hearthBuildingId = bSystem.lastPlacedBuilding;
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
    const doorOrigin = w.index(cx + 7, cy + 6, state.hallZ);
    if (w.map.kindAt(doorOrigin) === TileKind.Floor) {
      state.hearthHallSetup = true;
      // Hearth in center
      const hearthOrigin = w.index(cx + 10, cy + 6, state.hallZ);
      const rHearth = command(w, { type: 'PlaceBuilding', buildingType: 'hearth', origin: hearthOrigin, orientation: 0, materialChoice: 0, priority: BUILD - 1 });
      if (rHearth.ok) state.hearthBuildingId = bSystem.lastPlacedBuilding;
      (state.hallFurniture ??= []).push({ type: 'hearth', origin: hearthOrigin, priority: BUILD - 1 });

      // Chairs for hearth-side sitting (all passable)
      const c1 = w.index(cx + 9, cy + 6, state.hallZ);
      const c2 = w.index(cx + 11, cy + 6, state.hallZ);
      const c3 = w.index(cx + 10, cy + 5, state.hallZ);
      const c4 = w.index(cx + 10, cy + 7, state.hallZ);
      command(w, { type: 'PlaceBuilding', buildingType: 'chair', origin: c1, orientation: 0, materialChoice: 0, priority: BUILD });
      command(w, { type: 'PlaceBuilding', buildingType: 'chair', origin: c2, orientation: 0, materialChoice: 0, priority: BUILD });
      command(w, { type: 'PlaceBuilding', buildingType: 'chair', origin: c3, orientation: 0, materialChoice: 0, priority: BUILD });
      command(w, { type: 'PlaceBuilding', buildingType: 'chair', origin: c4, orientation: 0, materialChoice: 0, priority: BUILD });
      for (const origin of [c1, c2, c3, c4]) state.hallFurniture.push({ type: 'chair', origin, priority: BUILD });

      // Create zones
      command(w, { type: 'CreateZone', zoneType: 'hearth_hall', tiles: state.hearthHallTiles });
      command(w, { type: 'CreateZone', zoneType: 'meeting_area', tiles: state.hearthHallTiles });

      // Smooth floors and bordering walls at the default priority (exclude hearth origin)
      smooth(state.hearthHallTiles.filter((t) => t !== hearthOrigin));
    }
  }

  // 2. Dining Hall setup
  const kitchenBuilt = buildings.get(state.placedIds['kitchen']!)?.state === 'built';
  if (!state.diningHallSetup && kitchenBuilt && state.diningHallTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
    const doorOrigin = w.index(cx + 5, cy + 6, state.hallZ);
    if (w.map.kindAt(doorOrigin) === TileKind.Floor) {
      state.diningHallSetup = true;
      // Tables and chairs
      const t1 = w.index(cx + 2, cy + 5, state.hallZ);
      const c1 = w.index(cx + 1, cy + 5, state.hallZ);
      const c2 = w.index(cx + 3, cy + 5, state.hallZ);
      const t2 = w.index(cx + 2, cy + 7, state.hallZ);
      const c3 = w.index(cx + 1, cy + 7, state.hallZ);
      const c4 = w.index(cx + 3, cy + 7, state.hallZ);
      command(w, { type: 'PlaceBuilding', buildingType: 'table', origin: t1, orientation: 0, materialChoice: 0, priority: BUILD });
      command(w, { type: 'PlaceBuilding', buildingType: 'chair', origin: c1, orientation: 0, materialChoice: 0, priority: BUILD });
      command(w, { type: 'PlaceBuilding', buildingType: 'chair', origin: c2, orientation: 0, materialChoice: 0, priority: BUILD });
      command(w, { type: 'PlaceBuilding', buildingType: 'table', origin: t2, orientation: 0, materialChoice: 0, priority: BUILD });
      command(w, { type: 'PlaceBuilding', buildingType: 'chair', origin: c3, orientation: 0, materialChoice: 0, priority: BUILD });
      command(w, { type: 'PlaceBuilding', buildingType: 'chair', origin: c4, orientation: 0, materialChoice: 0, priority: BUILD });
      for (const [type, origin] of [['table', t1], ['chair', c1], ['chair', c2], ['table', t2], ['chair', c3], ['chair', c4]] as const) {
        (state.hallFurniture ??= []).push({ type, origin, priority: BUILD });
      }

      // Create dining_hall zone
      command(w, { type: 'CreateZone', zoneType: 'dining_hall', tiles: state.diningHallTiles });

      // Create underground drink stockpile beside dining hall (cx - 3..cx - 1, cy + 4..cy + 5)
      const ugDrinkTiles: number[] = [];
      for (let y = cy + 4; y <= cy + 5; y += 1) {
        for (let x = cx - 3; x <= cx - 1; x += 1) {
          const t = w.index(x, y, state.hallZ);
          if (w.map.kindAt(t) === TileKind.Floor && buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('stockpile', t)) {
            ugDrinkTiles.push(t);
          }
        }
      }
      if (ugDrinkTiles.length > 0) {
        const rD = command(w, { type: 'CreateZone', zoneType: 'stockpile', tiles: ugDrinkTiles });
        if (rD.ok) {
          const zid = bSystem.lastCreatedZone;
          command(w, { type: 'SetStockpileFilter', zoneId: zid, filter: 'drink' });
          command(w, { type: 'SetStockpilePriority', zoneId: zid, priority: ROUTINE });
          command(w, { type: 'SetStockpileContainers', zoneId: zid, wants: { barrel: Math.ceil(ugDrinkTiles.length / 3) } });
        }
      }

      smooth(state.diningHallTiles);
    }
  }

  keepHallFurniture(w, state);

  if (!state.economy.phases.has('pantry') && state.pantryTiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
    // Whatever the fortress has zoned there meanwhile keeps its tiles: the pantry takes the rest.
    const free = state.pantryTiles.filter((t) => buildings.zoneAt(t) === 0);
    const result = command(w, { type: 'CreateZone', zoneType: 'stockpile', tiles: free });
    if (result.ok) {
      const id = bSystem.lastCreatedZone;
      command(w, { type: 'SetStockpileFilter', zoneId: id, filter: 'food' });
      command(w, { type: 'SetStockpilePriority', zoneId: id, priority: ROUTINE });
      state.economy.phases.add('pantry');
    }
  }

  // 3. Bedrooms setup
  for (const bp of state.bedroomPlans) {
    if (bp.designated && !bp.setup && bp.tiles.length > 0 && bp.tiles.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
      const doorOrigin = w.index(bp.doorX, bp.doorY, state.hallZ);
      if (w.map.kindAt(doorOrigin) !== TileKind.Floor) continue;
      bp.setup = true;
      bp.setupDay = Math.floor(w.tick / TICKS_PER_DAY);

      // Bed
      const bedOrigin = w.index(bp.bedX, bp.bedY, state.hallZ);
      command(w, { type: 'PlaceBuilding', buildingType: 'bed', origin: bedOrigin, orientation: 0, materialChoice: 0, priority: BUILD });

      // Thane's suite fine furniture (table, chair)
      if (bp.isThane) {
        if (bp.tableX !== undefined && bp.tableY !== undefined) {
          command(w, { type: 'PlaceBuilding', buildingType: 'table', origin: w.index(bp.tableX, bp.tableY, state.hallZ), orientation: 0, materialChoice: 0, priority: BUILD });
        }
        if (bp.chairX !== undefined && bp.chairY !== undefined) {
          command(w, { type: 'PlaceBuilding', buildingType: 'chair', origin: w.index(bp.chairX, bp.chairY, state.hallZ), orientation: 0, materialChoice: 0, priority: BUILD });
        }
      }

      // Do not place doors at bedroom entrances to prevent creature collision blocks
      // Smooth room floors and walls at the default priority (score >= 60 guarantees tier >= 2 Decent)

      // Zone: the room across the corridor from the Thane's suite is the hospital, with its chest.
      if (bp.id === HOSPITAL_ROOM) {
        command(w, { type: 'PlaceBuilding', buildingType: 'chest', origin: w.index(bp.bedX, bp.bedY + 1, state.hallZ), orientation: 0, materialChoice: 0, priority: BUILD });
        state.hospitalSetup = command(w, { type: 'CreateZone', zoneType: 'hospital', tiles: bp.tiles }).ok;
      } else command(w, { type: 'CreateZone', zoneType: 'bedroom', tiles: bp.tiles });

      // Smooth room floors and walls at the default priority
      smooth(bp.tiles);
    }
  }

  if (foundationReady && !state.economy.phases.has('room finishing')) {
    state.economy.phases.add('room finishing');
    smooth(state.hearthHallTiles.filter(t => t !== w.index(cx + 10, cy + 6, state.hallZ)));
    smooth(state.diningHallTiles);
    for (const bp of state.bedroomPlans) if (bp.setup) smooth(bp.tiles);
  }

  // 4. Dynamic bedroom expansion: keep bedrooms ahead of living population
  const livingPop = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
  const designatedCount = state.bedroomPlans.filter((bp) => bp.designated).length;
  if (livingPop + 2 > designatedCount) {
    const nextToDesignate = state.bedroomPlans.filter((bp) => !bp.designated).slice(0, livingPop + 2 - designatedCount);
    if (nextToDesignate.length > 0) {
      const digTiles: number[] = [];
      for (const bp of nextToDesignate) {
        bp.designated = true;
        digTiles.push(w.index(bp.doorX, bp.doorY, state.hallZ));
        digTiles.push(...bp.tiles);
      }
      // T-156: only rock is designated. A tile of the plan already open (a mine drift or a corridor
      // through it) fails 03's dig precondition, and with it the whole designation.
      const rock = digTiles.filter((t) => w.map.kindAt(t) === TileKind.Wall && !opensToHillside(w, t));
      if (rock.length > 0) command(w, { type: 'Designate', kind: 'dig', priority: ROUTINE, tiles: rock });
    }
  }
}

export function checkFortressCaveFarm(w: TestWorld, state: FortressState): void {
  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

  if (state.caveFarmId1 === 0 && state.caveTiles1.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
    const plantable1 = state.caveTiles1.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
    if (plantable1.length > 0) {
      const c1 = command(w, { type: 'CreateZone', zoneType: 'farm_plot', tiles: plantable1 });
      if (c1.ok) {
        state.caveFarmId1 = bSystem.lastCreatedZone;
        for (const s of [0, 1, 2, 3]) {
          command(w, { type: 'SetPlotCrop', zoneId: state.caveFarmId1, season: s, speciesId: 'dimcap' });
        }
      }
    }
  }
  if (state.caveFarmId2 === 0 && state.caveTiles2.every((t) => w.map.kindAt(t) === TileKind.Floor)) {
    const plantable2 = state.caveTiles2.filter((t) => buildings.zoneAt(t) === 0 && buildings.zoneTileQualifies('farm_plot', t));
    if (plantable2.length > 0) {
      const c2 = command(w, { type: 'CreateZone', zoneType: 'farm_plot', tiles: plantable2 });
      if (c2.ok) {
        state.caveFarmId2 = bSystem.lastCreatedZone;
        for (const s of [0, 1, 2, 3]) {
          command(w, { type: 'SetPlotCrop', zoneId: state.caveFarmId2, season: s, speciesId: 'cavewheat' });
        }
      }
    }
  }
}

/** The six gate walls around the entrance stair. */
export function gateWallTiles(w: TestWorld, state: Pick<FortressState, 'cx' | 'cy'> & { z?: number }): TileIndex[] {
  const { cx, cy } = state;
  const z = state.z ?? Z;
  return [
    w.index(cx + 5, cy + 5, z), w.index(cx + 7, cy + 5, z),
    w.index(cx + 5, cy + 6, z), w.index(cx + 7, cy + 6, z),
    w.index(cx + 5, cy + 7, z), w.index(cx + 7, cy + 7, z),
  ];
}

/** T-426: how long a burnt gate wall may stand missing before the T-156 witness counts it (five days). */
export const GATE_WALL_REBUILD_TICKS = 5 * TICKS_PER_DAY;

/**
 * Place the gate walls, and place again any that is gone (T-426: a wooden wall burns in a
 * wildfire, 05 § Fire, and a player puts it back). A wall goes where 14's ghost accepts one now
 * (a dwarf or a fallen log on the tile waits for the next look; a sapling or shrub the builder clears), as a player places
 * it; the command is sent only for a tile with no building, so standing walls change nothing.
 */
export function keepGateWalls(w: TestWorld, state: Pick<FortressState, 'cx' | 'cy' | 'economy' | 'gateWallLostTick'> & { z?: number }): void {
  const buildings = w.readers.of<BuildingsReader>('14');
  const walls = gateWallTiles(w, state);
  const isWall = (t: TileIndex): boolean => buildings.get(buildings.at(t))?.typeId === 'wall';
  if (state.economy.phases.has('gate walls')) {
    if (walls.every((t) => isWall(t) && buildings.get(buildings.at(t))?.state === 'built')) state.gateWallLostTick = 0;
    else if (state.gateWallLostTick === 0 && walls.some((t) => buildings.at(t) === 0)) state.gateWallLostTick = w.tick;
  }
  for (const origin of walls) {
    if (!buildings.at(origin) && buildings.ghost('wall', origin, 0).reason === null) {
      command(w, { type: 'PlaceBuilding', buildingType: 'wall', origin, orientation: 0, materialChoice: 0, priority: BUILD });
    }
  }
  if (walls.every(isWall)) state.economy.phases.add('gate walls');
}

/**
 * T-451, T-458: a tree grown on a gate door's tile since the site was cleared is felled first (a
 * sapling or shrub the door's builder clears itself); whether the door can go on row `y` now.
 */
function gateDoorSite(w: TestWorld, state: FortressState, y: number): number {
  const { cx } = state;
  const here = w.index(cx + 6, y, state.z);
  if (w.map.kindAt(here) !== TileKind.Tree) return y;
  command(w, { type: 'Designate', kind: 'chop', priority: ROUTINE, tiles: [here] });
  return -1;
}

/**
 * T-518: the four ways out of the stair's foot on the hall level, west (the dining hall), east (the
 * hearth hall), north and south (the corridors). A door on each makes the foot a vestibule: the
 * second line behind the gate.
 */
export function innerDoorTiles(w: TestWorld, state: Pick<FortressState, 'cx' | 'cy' | 'hallZ'>): TileIndex[] {
  const sx = state.cx + 6, sy = state.cy + 6, z = state.hallZ;
  return [w.index(sx - 1, sy, z), w.index(sx + 1, sy, z), w.index(sx, sy - 1, z), w.index(sx, sy + 1, z)];
}

/**
 * T-518: the short way round the vestibule, two tiles north and two south of the stair's foot, from
 * the dining hall's corner through the corridor to the hearth hall's: with the vestibule's doors
 * locked the halls behind them are still one place, with their food, drink and beds.
 */
export function innerRingTiles(w: TestWorld, state: Pick<FortressState, 'cx' | 'cy' | 'hallZ'>): TileIndex[] {
  const sx = state.cx + 6, sy = state.cy + 6, z = state.hallZ;
  return [w.index(sx - 1, sy - 2, z), w.index(sx + 1, sy - 2, z), w.index(sx - 1, sy + 2, z), w.index(sx + 1, sy + 2, z)];
}

/** T-518: a tile of the halls behind the second line, where the squad waits below: the south corridor beyond the vestibule. */
function behindTheLine(w: TestWorld, state: Pick<FortressState, 'cx' | 'cy' | 'hallZ'>): TileIndex {
  return w.index(state.cx + 6, state.cy + 8, state.hallZ);
}

/** T-518: every door of the second line stands built. */
export function innerLineBuilt(w: TestWorld, state: FortressState): boolean {
  const buildings = w.readers.of<BuildingsReader>('14');
  const ids = state.innerDoorIds ?? [];
  return ids.length === 4 && ids.every((id) => id !== 0 && buildings.get(id)?.state === 'built');
}

/**
 * T-518: a player who has seen a siege's trollkin break a door builds a second line: once the gate
 * stands and the four ways out of the stair's foot are dug, the short way round it is dug, and then
 * a door goes on each way out, locked on the alert like the gate's. A broken gate door then leaves a
 * siege in the gatehouse; a door that is broken or gone is placed again, as the gate's are. The line
 * is built ahead of routine work, and the doors it lacks are made first at the mason's: the mason
 * takes its orders in list order, and the routine blocks ahead of the stock doors would leave the
 * line half built for months.
 */
function keepInnerLine(w: TestWorld, state: FortressState): void {
  if (!state.gateDoorPlaced || !state.gateDoorPlaced2) return;
  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;
  const map = w.map;
  const sx = state.cx + 6, sy = state.cy + 6, z = state.hallZ;
  const dug = (t: TileIndex): boolean => map.kindAt(t) === TileKind.Floor;
  const doors = innerDoorTiles(w, state);
  const joins = [[sx - 2, sy - 2], [sx, sy - 2], [sx + 2, sy - 2], [sx - 2, sy + 2], [sx, sy + 2], [sx + 2, sy + 2]].map(([x, y]) => w.index(x!, y!, z));
  const ids = state.innerDoorIds ?? (state.innerDoorIds = [0, 0, 0, 0]);
  if (ids.every((id) => id === 0) && ![...doors, ...joins].every(dug)) return;
  const ring = innerRingTiles(w, state);
  if (!ring.every(dug)) {
    // Asked for again after a day, should a designation have been lost.
    if (w.tick - (state.innerRingAsked ?? -1) < TICKS_PER_DAY && (state.innerRingAsked ?? -1) >= 0) return;
    state.innerRingAsked = w.tick;
    designateDig(w, ring, ROUTINE);
    return;
  }
  for (const [k, origin] of doors.entries()) {
    const id = ids[k] ?? 0;
    const b = id === 0 ? undefined : buildings.get(id);
    if (b === undefined) {
      ids[k] = 0;
      if (buildings.at(origin) === 0 && buildings.ghost('door', origin, 0).reason === null &&
        command(w, { type: 'PlaceBuilding', buildingType: 'door', origin, orientation: 0, materialChoice: 0, priority: KIT_FIRST }).ok) {
        ids[k] = bSystem.lastPlacedBuilding;
      }
    } else if (b.state === 'built' && b.mode !== 'lock_on_alert') {
      command(w, { type: 'SetDoorMode', buildingId: id, mode: 'lock_on_alert' });
    }
  }
  const waiting = [...ids, state.gateDoorId, state.gateDoorId2].filter((id) => id !== 0 && buildings.get(id)?.state === 'planned').length;
  const short = waiting - w.readers.of<ItemsReader>('13').available('door');
  const mason = state.placedIds['mason'] ?? 0;
  const orders = (): readonly { recipe: number }[] => w.game.world.entities.get(mason, C.Workshop)?.orders ?? [];
  const doorRecipe = w.game.registry.table('recipes').index('make_door_stone');
  if (short > 0 && mason !== 0 && buildings.get(mason)?.state === 'built' && !orders().some((o, i) => o.recipe === doorRecipe && i === 0) &&
    command(w, { type: 'AddWorkOrder', workshopId: mason, order: { recipeId: 'make_door_stone', mode: 'once', remaining: short, priority: KIT_FIRST } }).ok) {
    command(w, { type: 'ReorderWorkOrder', workshopId: mason, from: orders().length - 1, to: 0 });
  }
}

export function checkFortressDefense(w: TestWorld, state: FortressState): void {
  const { cx, cy } = state;
  const buildings = w.readers.of<BuildingsReader>('14');
  const bSystem = w.game.world.scheduler.byId('14') as BuildingsSystem;

  // T-518: a gate door a siege's trollkin broke is placed again, as a player rebuilds it.
  if (state.gateDoorPlaced && state.gateDoorId !== 0 && buildings.get(state.gateDoorId) === undefined) state.gateDoorPlaced = false;
  if (state.gateDoorPlaced2 && state.gateDoorId2 !== 0 && buildings.get(state.gateDoorId2) === undefined) state.gateDoorPlaced2 = false;

  // Open the underground route before enclosing its only surface entrance. Otherwise a
  // civilian can occupy the still-undug stair tile and prevent the miners reaching it.
  if (state.economy.phases.has('gate walls') || (
      w.map.kindAt(w.index(cx + 6, cy + 6, state.z)) === TileKind.StairsDown &&
      w.map.kindAt(w.index(cx + 6, cy + 6, state.hallZ)) === TileKind.StairsUp)) keepGateWalls(w, state);

  // 1. Place South door once supporting walls are built
  if (!state.gateDoorPlaced) {
    const w1 = buildings.at(w.index(cx + 5, cy + 7, state.z));
    const w2 = buildings.at(w.index(cx + 7, cy + 7, state.z));
    if (buildings.get(w1)?.state === 'built' && buildings.get(w2)?.state === 'built') {
      const doorRow = gateDoorSite(w, state, cy + 7);
      const doorTile = w.index(cx + 6, doorRow, state.z);
      const rDoor = doorRow < 0 ? { ok: false } : command(w, {
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
    const w1 = buildings.at(w.index(cx + 5, cy + 5, state.z));
    const w2 = buildings.at(w.index(cx + 7, cy + 5, state.z));
    if (buildings.get(w1)?.state === 'built' && buildings.get(w2)?.state === 'built') {
      const doorRow2 = gateDoorSite(w, state, cy + 5);
      const doorTile2 = w.index(cx + 6, doorRow2, state.z);
      const rDoor2 = doorRow2 < 0 ? { ok: false } : command(w, {
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
      command(w, { type: 'SetDoorMode', buildingId: state.gateDoorId, mode: wantDoorMode });
    }
  }
  if (state.gateDoorPlaced2 && state.gateDoorId2 !== 0) {
    const b2 = buildings.get(state.gateDoorId2);
    if (b2?.state === 'built' && b2.mode !== wantDoorMode) {
      command(w, { type: 'SetDoorMode', buildingId: state.gateDoorId2, mode: wantDoorMode });
    }
  }
  keepInnerLine(w, state);

  // 3. The squad stands from the first day, with the spears from the wagon and the woodcutter's axe.
  const ent = w.game.world.entities;
  const combat = w.readers.of<CombatReader>('16');
  const adults = w.readers.of<DwarvesReader>('10').adults().filter((id) => ent.get(id, C.Creature)?.faction === 'fortress');
  const founders = w.game.arrival?.dwarves ?? [];
  if (state.squadId === 0 && adults.length >= SQUAD_SIZE) {
    const rSquad = command(w, { type: 'CreateSquad', name: 'Gate Guard' });
    if (rSquad.ok) {
      state.squadId = combat.squads()[0]!.id;
      command(w, { type: 'SetSquadMode', squadId: state.squadId, mode: 'off' });
      command(w, { type: 'SetSquadEquipment', squadId: state.squadId, equipment: { weaponClass: 'any', armor: 'any' } });
      assignBroker(w, state);
    }
  }
  const squad = combat.squads().find((sq) => sq.id === state.squadId);
  const arming0 = armingSquad(state);
  if (squad) {
    // Everybody with a weapon stands: the mason, the seventh founder and the woodcutter take the
    // spears, and the miners fight with their picks. The farmer and the cook stay civilians and
    // tend the wounded; immigrants replace the fallen. Where the anvil came in the wagon the
    // mason and the smith are at the forge, and the last three adults stand.
    const size = arming0 ? SQUAD_SIZE : MILITIA.length;
    const living = squad.members.filter((id) => adults.includes(id));
    // T-387: the fallen are replaced once the alert is down. A civilian put into the squad in the
    // middle of a fight walks out to it, unarmed and unarmoured, and is one more death.
    if (living.length < size && w.game.world.fortress.alert === 'calm') {
      const arming = armingSquad(state);
      const kept = new Set<number>([founders[4]!, founders[5]!, ...Object.values(state.economy.specialists), state.economy.brewer ?? 0]);
      const order = arming ? [...adults].reverse() : [...MILITIA.map((i) => founders[i]!), ...adults.filter((id) => !founders.includes(id))];
      const recruits = order.filter((id, i) => adults.includes(id) && !living.includes(id) && order.indexOf(id) === i && (arming || !kept.has(id)));
      const members = [...living, ...recruits].slice(0, size);
      if (members.length !== squad.members.length || members.some((id) => !squad.members.includes(id))) {
        command(w, { type: 'SetSquadMembers', squadId: state.squadId, members });
      }
    }
  }

  // 4. Danger: a raid, a spotted thief, or a dangerous wild animal near the gate or a dwarf.
  // Each raises the hearth alert (civilians go in, the gate locks) and sends the squad.
  const gatehouseStairsTile = w.index(cx + 6, cy + 6, state.z);
  const hostilePurposes = new Set(['thief', 'bandits', 'ambush', 'raid', 'siege', 'restless']);
  const intruders: number[] = [];
  let raid = false;
  let siege = false;
  for (const pId of ent.with(C.Party)) {
    const p = ent.get(pId, C.Party);
    if (!p || !hostilePurposes.has(p.purpose) || p.state === 'gone' || p.state === 'retreat') continue;
    // A thief is a threat from the moment it is spotted; until then the player does not see it.
    if (p.purpose === 'thief') intruders.push(...p.members.filter((m) => ent.alive(m) && ent.get(m, C.Hostile)?.stealthed !== true));
    else raid = true;
    if (p.purpose === 'siege') siege = true;
  }
  // T-387: a threat warning (18) is answered as a player answers its announcement, which pauses
  // the game: the fortress shelters and the squad takes its post until the party comes, instead
  // of the raiders finding the dwarves at work on the surface.
  const seen = w.allEvents();
  for (let i = state.eventsRead ?? seen.length; i < seen.length; i += 1) {
    if (seen[i]!.type === 'ThreatWarning') {
      state.warnedUntil = w.tick + WARNED_TICKS;
      state.siegeWarned = seen[i]!['kind'] === 'siege';
    }
  }
  state.eventsRead = seen.length;
  if (raid) state.warnedUntil = -1;
  else if (w.tick < (state.warnedUntil ?? -1)) {
    raid = true;
    siege = state.siegeWarned === true;
  }
  // T-387: once the alert for wild animals alone has been lifted (below), the fortress works for
  // a while before it shelters from them again.
  const wild = !raid && intruders.length === 0 && w.tick < (state.wildQuietUntil ?? -1) ? [] : dangerousWildlife(w, state, adults);
  // T-461: a cavern monster or a Hollow-born that can walk to a dwarf: the breach, the attack and the
  // death are all announced, and the alert and the squad are how a player answers them.
  const indoors = hostilesIndoors(w, adults);
  const targets = [...indoors, ...intruders, ...wild];
  const danger = raid || targets.length > 0;
  if (danger) state.lastDangerTick = w.tick;
  const curAlert = w.game.world.fortress.alert;
  // A gate locked on everybody shelters nobody (T-363): with every dwarf shut outside it, the
  // alert only keeps the fortress from its halls, stores and beds. The player lifts it, and
  // raises it again for a danger only once a dwarf has gone below ground.
  const positions = ent.with(C.Labors).filter((id) => ent.alive(id) && ent.get(id, C.Creature)?.faction === 'fortress')
    .map((id) => ent.get(id, C.Position)).filter((p) => p !== undefined);
  const hallLabel = w.readers.pathing.labelOf(w.index(cx + 6, cy + 6, state.hallZ), 'walker');
  // T-518: once the second line stands, the stair's foot is its vestibule: a dwarf there, in the
  // shaft or in the cave farm is shut out of the halls as surely as one outside the gate.
  const line = innerLineBuilt(w, state);
  const insideLabel = line ? w.readers.pathing.labelOf(behindTheLine(w, state), 'walker') : hallLabel;
  if (curAlert === 'hearth' && state.gateDoorPlaced && insideLabel !== 0 && positions.length > 0 &&
      !positions.some((p) => w.readers.pathing.labelOf(w.index(p.x, p.y, p.z), 'walker') === insideLabel)) {
    state.shutOut = true;
    command(w, { type: 'SetAlert', level: 'calm' });
    note('three_years_alert', { tick: w.tick, day: Math.floor(w.tick / TICKS_PER_DAY) + 1, calm: true, shutOut: true });
    state.answered = '';
    if (state.squadId !== 0) command(w, { type: 'SquadOrder', squadId: state.squadId, order: { kind: 'cancel' } });
    return;
  }
  if (state.shutOut && positions.some((p) => p.z < state.z && (!line || p.z <= state.hallZ))) state.shutOut = false;
  // T-387: an alert kept up by wild animals alone, which a squad without its weapons does not
  // hunt, only keeps the fortress from the brook and its surface work. On seed p2-3 one boar by
  // the gate held it for 27 days and all fourteen dwarves died of thirst inside. The player lifts
  // it after half a day and does not shelter from the animals again for a day.
  if (curAlert === 'hearth' && !raid && intruders.length === 0 && indoors.length === 0 && targets.length > 0 && !squadArmed(w, state) &&
      w.tick - (state.alertSince ?? w.tick) >= WILD_ALERT_TICKS) {
    state.wildQuietUntil = w.tick + WILD_QUIET_TICKS;
    command(w, { type: 'SetAlert', level: 'calm' });
    note('three_years_alert', { tick: w.tick, day: Math.floor(w.tick / TICKS_PER_DAY) + 1, calm: true, wildQuiet: true });
    state.answered = '';
    if (state.squadId !== 0) command(w, { type: 'SquadOrder', squadId: state.squadId, order: { kind: 'cancel' } });
    return;
  }
  if (danger && !state.shutOut) {
    if (curAlert !== 'hearth') {
      state.alertSince = w.tick;
      command(w, { type: 'SetAlert', level: 'hearth' });
      note('three_years_alert', { tick: w.tick, day: Math.floor(w.tick / TICKS_PER_DAY) + 1, raid, targets: targets.map((id) => speciesName(w, id)) });
    }
    const answer = `${raid ? 'raid' : ''}${siege ? ' siege' : ''}:${squadArmed(w, state)}:${targets.join(',')}`;
    if (state.squadId !== 0 && state.answered !== answer) {
      state.answered = answer;
      command(w, { type: 'SquadOrder', squadId: state.squadId, order: { kind: 'cancel' } });
      // A raid is met at the gate. A thief or a beast is hunted down, the nearest first, by a
      // squad whose every member holds a weapon; an unarmed squad waits below with everybody else.
      // A hostile indoors is hunted first and by any squad: below is where it is.
      // T-518: below is behind the second line once it stands, and a siege, whose trollkin break
      // doors, is waited for there: a squad in the gatehouse, locked between the gate and the
      // vestibule, has no drink and no way back, and a siege outnumbers it at a broken gate.
      const hunted = raid ? indoors : squadArmed(w, state) ? targets : indoors;
      for (const targetId of hunted) command(w, { type: 'SquadOrder', squadId: state.squadId, order: { kind: 'kill', targetId } });
      const below = line ? behindTheLine(w, state) : w.index(cx + 6, cy + 6, state.hallZ);
      const outdoors = (raid && !(siege && line)) || hunted.length > indoors.length;
      const post = outdoors || !w.readers.pathing.passable(below, 'walker') ? gatehouseStairsTile : below;
      command(w, { type: 'SquadOrder', squadId: state.squadId, order: { kind: 'station', tile: post } });
    }
  } else if (curAlert === 'hearth' && w.tick - state.lastDangerTick >= ALL_CLEAR_TICKS) {
    command(w, { type: 'SetAlert', level: 'calm' });
    note('three_years_alert', { tick: w.tick, day: Math.floor(w.tick / TICKS_PER_DAY) + 1, calm: true });
    state.answered = '';
    if (state.squadId !== 0) command(w, { type: 'SquadOrder', squadId: state.squadId, order: { kind: 'cancel' } });
  }
}

/** At least three of the squad hold a weapon (a spear, a sword, an axe or a pick). */
function squadArmed(w: TestWorld, state: FortressState): boolean {
  const combat = w.readers.of<CombatReader>('16');
  const members = combat.squads().find((sq) => sq.id === state.squadId)?.members ?? [];
  return members.length >= SQUAD_SIZE && members.filter((id) => combat.weaponOf(id) !== 0).length >= SQUAD_SIZE;
}

function speciesName(w: TestWorld, id: number): string {
  return w.game.registry.table<{ id: string }>('creatures').byIndex(w.game.world.entities.get(id, C.Creature)?.species ?? -1)?.id ?? 'unknown';
}

/**
 * The wild animals a player answers: every living aggressive or territorial one that can walk to
 * the gate and is within WILD_NEAR of it, and every aggressive one within WILD_NEAR of a dwarf on
 * the surface, the nearest to the gate first.
 * T-529: a territorial animal (a boar, a badger) is answered only at the gate. It attacks only a
 * dwarf who walks into its ground, lets a fleeing one go, and keeps that ground away from the
 * fortress (08 § Wild behavior), so a dwarf near it is not hunted. Sent after every one near a
 * dwarf on the surface, the squad went 15 to 40 tiles out behind a gate the hearth alert had
 * locked, met the boars one soldier at a time, unarmoured, and no medic could reach the wounded:
 * on seed `three-years` at relief 1 it lost 6 to 14 dwarves in 400 days at each of six shifts.
 */
export function dangerousWildlife(w: TestWorld, state: FortressState, dwarves: readonly number[]): number[] {
  const ent = w.game.world.entities;
  const animals = w.readers.of<AnimalsReader>('08');
  const wild = animals.wildList();
  if (wild.length === 0) return [];
  const gate = { x: state.cx + 6, y: state.cy + 6, z: state.z };
  // Dwarves below ground are behind the gate already: only those on the surface count.
  const places = [gate, ...dwarves.map((id) => ent.get(id, C.Position)).filter((p) => p !== undefined && p.z >= state.z)];
  const gateLabel = w.readers.pathing.labelOf(w.index(gate.x, gate.y + 2, state.z), 'walker');
  const found: { id: number; d: number }[] = [];
  for (const id of wild) {
    const temper = animals.def(ent.get(id, C.Creature)?.species ?? -1)?.temper;
    const p = ent.get(id, C.Position);
    if (!p || (temper !== 'aggressive' && temper !== 'territorial')) continue;
    if (w.readers.pathing.labelOf(w.index(p.x, p.y, p.z), 'walker') !== gateLabel) continue;
    const near = temper === 'territorial' ? [gate] : places;
    if (!near.some((q) => q !== undefined && Math.abs(q.z - p.z) <= 2 && Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) <= WILD_NEAR)) continue;
    found.push({ id, d: Math.max(Math.abs(gate.x - p.x), Math.abs(gate.y - p.y)) });
  }
  return found.sort((a, b) => a.d - b.d || a.id - b.id).map((f) => f.id);
}

/**
 * T-461: the hostiles of no party a player answers: each one awake and in sight that can walk to a
 * dwarf within WILD_NEAR of it, the nearest first. Monsters in a cavern the fortress has no way into
 * do not count.
 */
function hostilesIndoors(w: TestWorld, dwarves: readonly number[]): number[] {
  const ent = w.game.world.entities;
  const label = (p: { x: number; y: number; z: number }): number => w.readers.pathing.labelOf(w.index(p.x, p.y, p.z), 'walker');
  const places = dwarves.map((id) => ent.get(id, C.Position)).filter((p) => p !== undefined);
  const found: { id: number; d: number }[] = [];
  for (const id of ent.with(C.Hostile)) {
    const h = ent.get(id, C.Hostile);
    const p = ent.get(id, C.Position);
    if (!h || !p || h.partyId !== 0 || h.behaviorState === 'asleep' || h.stealthed === true) continue;
    const own = label(p);
    let d = Infinity;
    for (const q of places) {
      if (Math.abs(q.z - p.z) > 2 || label(q) !== own) continue;
      d = Math.min(d, Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)));
    }
    if (d <= WILD_NEAR) found.push({ id, d });
  }
  return found.sort((a, b) => a.d - b.d || a.id - b.id).map((f) => f.id);
}

/**
 * Advance the fortress while watching for danger: the defence is looked at every WATCH_EVERY
 * ticks, the rest of the management at the caller's own pace.
 */
export function playThreeYears(w: TestWorld, state: FortressState, ticks: number, watch?: () => void): void {
  const end = w.tick + ticks;
  while (w.tick < end) {
    stepThreeYears(w, Math.min(WATCH_EVERY, end - w.tick));
    watch?.();
    checkFortressDefense(w, state);
  }
}

/**
 * T-488: the fewest dwarves, at the end of a run, of a fortress asked for its halls and bedrooms:
 * the embark party's size. Raids that cut a fortress below it can leave the rooms half dug (in
 * `three-years-p2-4` at shift 50 the halls were still being dug when the miners died) or their
 * furniture broken by miserable survivors; a handful of dwarves is not asked to finish or keep them.
 */
export const ROOMS_WITNESS_POPULATION = 7;

/**
 * T-156: what the script exists to exercise, each of which must have happened by the end of a
 * run. Returns the witnesses that are missing. The gate and the squad hold at every peril; the
 * halls and bedrooms in a fortress of at least ROOMS_WITNESS_POPULATION dwarves (T-488); at perils
 * 2 and 4 a living fortress has also raised the hearth alert and lowered it, and traded.
 */
export function fortressWitnesses(w: TestWorld, state: FortressState, peril: number): string[] {
  const buildings = w.readers.of<BuildingsReader>('14');
  const { cx, cy } = state;
  const missing: string[] = [];
  const built = (id: number): boolean => buildings.get(id)?.state === 'built';
  const walls = [[cx + 5, cy + 5], [cx + 7, cy + 5], [cx + 5, cy + 6], [cx + 7, cy + 6], [cx + 5, cy + 7], [cx + 7, cy + 7]]
    .map(([x, y]) => buildings.at(w.index(x!, y!, state.z)));
  // T-426: a wall that burnt within GATE_WALL_REBUILD_TICKS of the end may still be going up.
  const rebuilding = state.gateWallLostTick !== 0 && w.tick - state.gateWallLostTick < GATE_WALL_REBUILD_TICKS;
  if (!rebuilding && !walls.every((id) => id !== 0 && buildings.get(id)?.typeId === 'wall' && built(id))) missing.push('gate walls built');
  if (!built(state.gateDoorId) || !built(state.gateDoorId2)) missing.push('gate doors built');
  const rooms = (type: string): number => buildings.zonesOfType(type).filter((id) => buildings.roomScore(id)?.requirementsMet === true).length;
  const ent = w.game.world.entities;
  const living = w.readers.of<DwarvesReader>('10').adults().filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;
  if (living >= ROOMS_WITNESS_POPULATION) {
    if (rooms('hearth_hall') < 1) missing.push('a hearth hall');
    if (rooms('dining_hall') < 1) missing.push('a dining hall');
    if (rooms('bedroom') < 7) missing.push(`seven bedrooms (${rooms('bedroom')})`);
  }
  if (!w.readers.of<CombatReader>('16').squads().some((sq) => sq.id === state.squadId)) missing.push('the squad');
  if (peril >= 2) {
    const alerts = w.events('AlertChanged');
    if (!alerts.some((e) => e['to'] === 'hearth') || !alerts.some((e) => e['from'] === 'hearth' && e['to'] === 'calm')) missing.push('the hearth alert raised and lowered');
    if (w.events('TradeCompleted').length === 0) missing.push('a completed trade');
  }
  return missing;
}
