/**
 * The command generator registry of `process/testing-strategy.md` § Property tests
 * ("determinism under commands ... the command generator producing only commands that exist so
 * far (none yet: the generator is a registry that later tasks extend)").
 *
 * A task that adds a command adds its generator here with the milestone it arrives in; the
 * property test picks the generators whose milestone is at most the current one.
 */

import fc from 'fast-check';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { FLAT_TEST_SURFACE_Z, type HeadlessGame } from '@app/headless';
import type { BuildingsReader } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import { STOCKPILE_PRESETS } from '@systems/items';
import { STANDING_ORDERS } from '@systems/jobs/constants';
import { REQUEST_MAX } from '@systems/trade/constants';
import { POPULATION_CAP_MAX, POPULATION_CAP_MIN } from '@systems/immigration/constants';
import { DESIGNATION_NAMES, TerrainFacts, precondition } from '@systems/terrain';
import type { TestWorld } from '../scenarios/test-world';

export interface CommandGenerator {
  /** The command type this generator produces, for the failure message. */
  readonly id: string;
  /** The milestone that introduces the command. */
  readonly milestone: number;
  /** An arbitrary over commands that are valid against the given world. */
  arbitrary(w: TestWorld): fc.Arbitrary<Command>;
}

/** The levels the M1 generators draw tiles from: two above the `flat-test` surface and two below. */
const Z_RANGE = { min: FLAT_TEST_SURFACE_Z - 2, max: FLAT_TEST_SURFACE_Z + 1 } as const;

/** One to four tiles inside the map's 2-tile rim, on the levels around the surface. */
function tiles(w: TestWorld, z: fc.Arbitrary<number> = fc.integer(Z_RANGE)): fc.Arbitrary<TileIndex[]> {
  const map = w.map;
  const tile = fc
    .tuple(fc.integer({ min: 2, max: map.w - 3 }), fc.integer({ min: 2, max: map.h - 3 }), z)
    .map(([x, y, zz]) => map.index(x, y, zz));
  return fc.uniqueArray(tile, { minLength: 1, maxLength: 4 }).map((list) => list.slice().sort((a, b) => a - b));
}

const priority = fc.integer({ min: PRIORITY_MIN, max: PRIORITY_MAX });

/** The terrain designations of 03 (`harvest` is 07's, M4). */
const TERRAIN_KINDS = Object.keys(DESIGNATION_NAMES).filter((k) => k !== 'harvest');

/**
 * `Designate` (03, M1): a kind, the tiles that pass its precondition or are undiscovered in the
 * world the stream starts from (D-052: the command is refused whole otherwise), a priority.
 */
function designate(w: TestWorld): fc.Arbitrary<Command> {
  const facts = new TerrainFacts(w.game.registry);
  return fc.tuple(fc.constantFrom(...TERRAIN_KINDS), tiles(w), priority).map(([kind, list, p]) => {
    const designation = DESIGNATION_NAMES[kind] as NonNullable<(typeof DESIGNATION_NAMES)[string]>;
    const valid = list.filter((i) => !w.map.hasFlag(i, TileFlag.Discovered) || precondition(w.map, i, designation, facts));
    const chosen = valid.length > 0 ? valid : [w.map.index(w.map.xOf(list[0] as number), w.map.yOf(list[0] as number), FLAT_TEST_SURFACE_Z - 1)];
    return { type: 'Designate', tiles: chosen, kind, priority: p } as Command;
  });
}

// ---------- M2: items and buildings (T-M2-13) ----------

/**
 * A reference to "the k-th living entity of a kind" (ascending id, k modulo the count), resolved
 * when the command is submitted: zones, stockpiles and buildings made by earlier commands of the
 * same stream have ids no generator can know in advance. Both runs of a property resolve against
 * identical worlds, so the resolved stream is the same in both.
 */
export interface EntityRef {
  readonly $nth: number;
  readonly of: 'zone' | 'stockpile' | 'building' | 'workshop' | 'item' | 'metal_item' | 'farm_plot' | 'pasture' | 'grazer' | 'slaughterable' | 'adult' | 'squad' | 'trap' | 'lever' | 'hospital' | 'depot';
}

function isRef(value: unknown): value is EntityRef {
  return typeof value === 'object' && value !== null && typeof (value as { $nth?: unknown }).$nth === 'number';
}

/** The ids a reference ranges over, ascending. */
function candidates(game: HeadlessGame, of: EntityRef['of']): EntityId[] {
  const e = game.world.entities;
  if (of === 'farm_plot' || of === 'pasture' || of === 'hospital') {
    const type = game.registry.table('zoneTypes').index(of);
    return e.with(C.Zone).filter((id) => e.get(id, C.Zone)?.type === type);
  }
  if (of === 'grazer' || of === 'slaughterable') {
    const species = game.registry.table<{ id: string; diet?: string }>('creatures');
    return e.with(C.Tame, C.Creature).filter((id) => {
      const tame = e.get(id, C.Tame);
      const creature = e.get(id, C.Creature);
      if (tame === undefined || creature === undefined) return false;
      return of === 'grazer'
        ? species.byIndex(creature.species)?.diet === 'grazer'
        : tame.assignedTo === 0 && tame.trained === 'none';
    });
  }
  if (of === 'adult') return game.world.readers.of<{ adults(): EntityId[] }>('10').adults();
  if (of === 'squad') return e.with(C.Squad);
  if (of === 'trap' || of === 'lever') {
    const rows = game.registry.table<{ id: string; tags: readonly string[] }>('buildings');
    return e.with(C.Building).filter((id) => {
      const row = rows.byIndex(e.get(id, C.Building)?.type ?? -1);
      return of === 'trap' ? row?.tags.some((tag) => tag.startsWith('trap:')) : row?.tags.includes('lever');
    });
  }
  if (of === 'metal_item') {
    const materials = game.registry.table<{ id: string; class: string }>('materials');
    return e.with(C.Item).filter((id) => materials.byIndex(e.get(id, C.Item)?.material ?? -1)?.class === 'metal');
  }
  if (of === 'depot') return game.world.readers.of<{ depots(): EntityId[] }>('14').depots();
  if (of === 'workshop') return e.with(C.Workshop);
  if (of === 'stockpile') return e.with(C.Stockpile);
  if (of === 'zone') return e.with(C.Zone);
  if (of === 'building') return e.with(C.Building);
  return e.with(C.Item);
}

/**
 * A command with every {@link EntityRef} replaced by an id of the world as it is now (0 when none
 * exists), including the refs inside arrays and inside the records of an array (`TradeOffer`'s
 * `give[].itemId`, T-M7-12).
 */
export function resolveCommand(game: HeadlessGame, command: Command): Command {
  const resolveValue = (value: unknown): unknown => {
    if (isRef(value)) {
      const ids = candidates(game, value.of);
      return ids.length === 0 ? 0 : (ids[value.$nth % ids.length] as EntityId);
    }
    if (Array.isArray(value)) return value.map(resolveValue);
    if (typeof value === 'object' && value !== null) {
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) out[key] = resolveValue(inner);
      return out;
    }
    return value;
  };
  let out: Command | null = null;
  for (const key of Object.keys(command)) {
    const value = command[key];
    const resolved = resolveValue(value);
    if (resolved === value) continue;
    out ??= { ...command };
    (out as Record<string, unknown>)[key] = resolved;
  }
  return out ?? command;
}

/** Submit a scheduled command, resolving its references first. */
export function submitScheduled(game: HeadlessGame, command: Command): void {
  game.world.submit(resolveCommand(game, command));
}

const ref = (of: EntityRef['of']): fc.Arbitrary<EntityRef> => fc.nat({ max: 1_000 }).map(($nth) => ({ $nth, of }));

/** The M2 generators place things on the surface, inside the rim, away from the map edge. */
const SURFACE = { x0: 12, y0: 12, x1: 84, y1: 84 } as const;

/**
 * `PlaceBuilding` with valid footprints only (`14` § Placement): every building type at a grid of
 * surface origins, in both orientations, kept when 14's ghost gives no reason against the world
 * the stream starts from (`readers.of('14').ghost`, D-073). A placement that a command earlier in
 * the stream has since made invalid is refused the same way in both runs.
 */
function placeBuilding(w: TestWorld): fc.Arbitrary<Command> {
  const buildings = w.readers.of<BuildingsReader>('14');
  const types = w.game.registry.table('buildings').ids();
  const valid: { buildingType: string; origin: TileIndex; orientation: number }[] = [];
  for (const buildingType of types) {
    for (let y = SURFACE.y0; y < SURFACE.y1; y += 9) {
      for (let x = SURFACE.x0 + (y % 5); x < SURFACE.x1; x += 9) {
        for (const z of [FLAT_TEST_SURFACE_Z, FLAT_TEST_SURFACE_Z + 1]) {
          for (const orientation of [0, 1]) {
            const origin = w.map.index(x, y, z);
            if (buildings.ghost(buildingType, origin, orientation).reason === null) valid.push({ buildingType, origin, orientation });
          }
        }
      }
    }
  }
  if (valid.length === 0) throw new Error('placeBuilding: no valid placement on the flat-test surface');
  return fc
    .tuple(fc.constantFrom(...valid), fc.constantFrom(0, 0, 'granite', 'pine'))
    .map(([p, materialChoice]) => ({ type: 'PlaceBuilding', ...p, materialChoice }) as Command);
}

/**
 * `CreateZone`: a zone type and a rectangle of surface tiles, kept to the tiles that qualify for
 * the type (`readers.of('14').zoneTileQualifies`); zones do not overlap in the world the stream
 * starts from, and one that overlaps a zone an earlier command made is refused in both runs.
 */
function createZone(w: TestWorld): fc.Arbitrary<Command> {
  const buildings = w.readers.of<BuildingsReader>('14');
  const zoneTypes = w.game.registry.table('zoneTypes').ids();
  const existing = new Set<TileIndex>();
  for (const id of w.readers.entities.with(C.Zone)) for (const t of w.game.world.entities.get(id, C.Zone)?.tiles ?? []) existing.add(t);
  return fc
    .tuple(
      fc.constantFrom(...zoneTypes),
      fc.integer({ min: SURFACE.x0, max: SURFACE.x1 - 6 }),
      fc.integer({ min: SURFACE.y0, max: SURFACE.y1 - 6 }),
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 1, max: 5 }),
    )
    .map(([zoneType, x, y, width, height]) => {
      const list: TileIndex[] = [];
      for (let dy = 0; dy < height; dy += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          const i = w.map.index(x + dx, y + dy, FLAT_TEST_SURFACE_Z);
          if (!existing.has(i) && buildings.zoneTileQualifies(zoneType, i)) list.push(i);
        }
      }
      if (list.length === 0) list.push(w.map.index(x, y, FLAT_TEST_SURFACE_Z));
      return { type: 'CreateZone', zoneType, tiles: list } as Command;
    });
}

/** The M2 generators (T-M2-13). */
const M2_GENERATORS: readonly CommandGenerator[] = [
  { id: 'PlaceBuilding', milestone: 2, arbitrary: placeBuilding },
  { id: 'CreateZone', milestone: 2, arbitrary: createZone },
  {
    id: 'SetStockpileFilter',
    milestone: 2,
    arbitrary: () =>
      fc
        .tuple(ref('stockpile'), fc.constantFrom(...Object.keys(STOCKPILE_PRESETS)))
        .map(([zoneId, filter]) => ({ type: 'SetStockpileFilter', zoneId, filter }) as unknown as Command),
  },
  {
    id: 'ForbidItem',
    milestone: 2,
    arbitrary: () => fc.tuple(ref('item'), fc.boolean()).map(([itemId, on]) => ({ type: 'ForbidItem', itemId, on }) as unknown as Command),
  },
  {
    id: 'CancelBuilding',
    milestone: 2,
    arbitrary: () => ref('building').map((buildingId) => ({ type: 'CancelBuilding', buildingId }) as unknown as Command),
  },
  {
    id: 'RemoveZone',
    milestone: 2,
    arbitrary: () => ref('zone').map((zoneId) => ({ type: 'RemoveZone', zoneId }) as unknown as Command),
  },
];

/** Real targets for M4 generators. These are ordinary flat-test commands and spawns, shared by
 * the probe, both deterministic runs, and the round-trip world. */
export function prepareM4GeneratorWorld(w: TestWorld): void {
  const z = FLAT_TEST_SURFACE_Z;
  w.zone('farm_plot', [w.index(20, 70, z), w.index(21, 70, z)]);
  const grass = [w.index(24, 70, z), w.index(25, 70, z)];
  for (const tile of grass) w.map.setFlag(tile, TileFlag.Grass, true);
  w.zone('pasture', grass);
  w.spawnTame('cow', w.index(24, 71, z));
}

/** A persistent global order, workshop and meltable item give M5 commands valid initial targets. */
export function prepareM5GeneratorWorld(w: TestWorld): void {
  w.build('carpenter', w.index(15, 15, FLAT_TEST_SURFACE_Z));
  w.spawnItem('axe', 'iron', w.index(18, 17, FLAT_TEST_SURFACE_Z));
  w.step(1);
  const result = w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: 0,
    order: { recipeId: 'forge_battle_axe', mode: 'maintain', remaining: 1, threshold: 99, priority: 5 } });
  if (!result.ok) throw new Error(`M5 property setup: ${result.reason}`);
}

/** T-M6-18: stable real targets for squad, trap, lever and hospital command streams. */
export function prepareM6GeneratorWorld(w: TestWorld): void {
  const z = FLAT_TEST_SURFACE_Z;
  w.build('stone_fall_trap', w.index(65, 65, z), 'granite');
  w.build('lever', w.index(67, 65, z), 'granite');
  w.zone('hospital', [w.index(70, 70, z)]);
  const created = w.game.world.applyCommand({ type: 'CreateSquad', name: 'Property Guard' });
  if (!created.ok) throw new Error(`M6 property setup: ${created.reason}`);
  w.step(1);
}

/** T-M7-12: a built trade depot, so the trade generators have a target to name. */
export function prepareM7GeneratorWorld(w: TestWorld): void {
  w.build('trade_depot', w.index(60, 60, FLAT_TEST_SURFACE_Z), 'granite');
  w.step(1);
}

/** T-M4-19: each command names a valid M4 target and an authored option. */
const M4_GENERATORS: readonly CommandGenerator[] = [
  {
    id: 'SetPlotCrop', milestone: 4,
    arbitrary: (w) => {
      const plants = w.game.registry.table<{ id: string; kind: string; light: string }>('plants');
      const crops = plants.ids().filter((id) => plants.byId(id)?.kind === 'crop' && plants.byId(id)?.light === 'sun');
      return fc.tuple(ref('farm_plot'), fc.integer({ min: 0, max: 3 }), fc.oneof(fc.constant(0), fc.constantFrom(...crops)))
        .map(([zoneId, season, speciesId]) => ({ type: 'SetPlotCrop', zoneId, season, speciesId }) as unknown as Command);
    },
  },
  {
    id: 'AddWorkOrder', milestone: 4,
    arbitrary: (w) => {
      const recipes = w.game.registry.table<{ id: string; workshop: string }>('recipes');
      const ids = recipes.ids();
      return fc.tuple(fc.constantFrom(...ids), fc.integer({ min: 1, max: 9 }), fc.boolean())
        .map(([recipeId, count, maintain]) => ({ type: 'AddWorkOrder', workshopId: 0,
          order: maintain ? { recipeId, mode: 'maintain', remaining: 1, threshold: count } : { recipeId, mode: 'once', count } }) as Command);
    },
  },
  {
    id: 'AssignPasture', milestone: 4,
    arbitrary: () => fc.tuple(ref('grazer'), ref('pasture'))
      .map(([animalId, zoneId]) => ({ type: 'AssignPasture', animalId, zoneId }) as unknown as Command),
  },
  {
    id: 'MarkSlaughter', milestone: 4,
    arbitrary: () => ref('slaughterable').map((animalId) => ({ type: 'MarkSlaughter', animalId }) as unknown as Command),
  },
  {
    id: 'AssignTitle', milestone: 4,
    arbitrary: () => fc.tuple(ref('adult'), fc.constantFrom('thane', 'warden', 'broker', 'chief_medic'))
      .map(([dwarfId, title]) => ({ type: 'AssignTitle', dwarfId, title }) as unknown as Command),
  },
  {
    id: 'SetStandingOrder', milestone: 4,
    arbitrary: () => fc.tuple(fc.constantFrom(...STANDING_ORDERS), fc.boolean())
      .map(([name, on]) => ({ type: 'SetStandingOrder', name, on }) as Command),
  },
];

/** T-M5-09: the M5 command families that mutate workshop and item state. */
const M5_GENERATORS: readonly CommandGenerator[] = [
  { id: 'MeltItem', milestone: 5, arbitrary: () => fc.tuple(ref('metal_item'), fc.boolean())
    .map(([itemId, on]) => ({ type: 'MeltItem', itemId, on }) as unknown as Command) },
  { id: 'EditWorkOrder', milestone: 5, arbitrary: () => fc.integer({ min: 1, max: 9 })
    .map((priority) => ({ type: 'EditWorkOrder', workshopId: 0, index: 0, patch: { priority } }) as Command) },
  { id: 'SetWorkshopWorker', milestone: 5, arbitrary: (w) => {
    const jobs = w.readers.of<JobsReader>('11');
    const candidates = [0, ...w.readers.entities.with(C.Labors).filter((id) => jobs.laborEnabled(id, 'carpentry'))];
    return fc.tuple(ref('workshop'), fc.constantFrom(...candidates))
      .map(([workshopId, dwarfId]) => ({ type: 'SetWorkshopWorker', workshopId, dwarfId }) as unknown as Command);
  } },
  { id: 'SuspendWorkshop', milestone: 5, arbitrary: () => fc.tuple(ref('workshop'), fc.boolean())
    .map(([workshopId, on]) => ({ type: 'SuspendWorkshop', workshopId, on }) as unknown as Command) },
];

/** T-M6-18: commands from all five new M6 families. */
const M6_GENERATORS: readonly CommandGenerator[] = [
  { id: 'CreateSquad', milestone: 6, arbitrary: () => fc.nat({ max: 999 })
    .map((n) => ({ type: 'CreateSquad', name: `Guard ${n}` }) as Command) },
  { id: 'SetSquadMode', milestone: 6, arbitrary: () => fc.tuple(ref('squad'), fc.constantFrom('off', 'train', 'active'))
    .map(([squadId, mode]) => ({ type: 'SetSquadMode', squadId, mode }) as unknown as Command) },
  { id: 'SetAlert', milestone: 6, arbitrary: () => fc.constantFrom('calm', 'watchful', 'hearth')
    .map((level) => ({ type: 'SetAlert', level }) as Command) },
  { id: 'SetTrapMode', milestone: 6, arbitrary: () => fc.tuple(ref('trap'), fc.constantFrom('enemies', 'all'))
    .map(([trapId, mode]) => ({ type: 'SetTrapMode', trapId, mode }) as unknown as Command) },
  { id: 'PullLever', milestone: 6, arbitrary: () => ref('lever')
    .map((leverId) => ({ type: 'PullLever', leverId }) as unknown as Command) },
  { id: 'SetHospitalSupplies', milestone: 6, arbitrary: () => fc.tuple(ref('hospital'), fc.integer({ min: 1, max: 20 }))
    .map(([zoneId, count]) => ({ type: 'SetHospitalSupplies', zoneId, wants: { cloth: count, thread: count } }) as unknown as Command) },
];

/**
 * T-M7-12: the M7 command families. 20's five trade commands, 20's `SetRequests` and 21's
 * `SetPopulationCap`. Settings and keybindings are app-level, not commands, so they have no
 * generator (`24` § State: "settings and keymap in the settings store").
 */
const M7_GENERATORS: readonly CommandGenerator[] = [
  { id: 'MoveToDepot', milestone: 7, arbitrary: () => fc.uniqueArray(ref('item'), { minLength: 1, maxLength: 3 })
    .map((itemIds) => ({ type: 'MoveToDepot', itemIds }) as unknown as Command) },
  { id: 'RemoveFromDepot', milestone: 7, arbitrary: () => fc.uniqueArray(ref('item'), { minLength: 1, maxLength: 3 })
    .map((itemIds) => ({ type: 'RemoveFromDepot', itemIds }) as unknown as Command) },
  { id: 'TradeOpen', milestone: 7, arbitrary: () => ref('depot')
    .map((depotId) => ({ type: 'TradeOpen', depotId }) as unknown as Command) },
  { id: 'TradeOffer', milestone: 7, arbitrary: () => fc.tuple(
      fc.array(fc.record({ itemId: ref('item'), count: fc.nat({ max: 3 }) }), { maxLength: 2 }),
      fc.array(fc.record({ itemId: ref('item'), count: fc.nat({ max: 3 }) }), { maxLength: 2 }),
    ).map(([give, take]) => ({ type: 'TradeOffer', give, take }) as unknown as Command) },
  { id: 'TradeCancel', milestone: 7, arbitrary: () => fc.constant({ type: 'TradeCancel' } as Command) },
  { id: 'SetRequests', milestone: 7, arbitrary: (w) => {
    const types = w.game.registry.table('items').ids();
    return fc.tuple(
      fc.constantFrom('hillfolk', 'wildwood', 'mountainhome'),
      fc.uniqueArray(fc.tuple(fc.constantFrom(...types), fc.constantFrom(1, 2, 3)), { maxLength: REQUEST_MAX, selector: ([itemType]) => itemType }),
    ).map(([civ, entries]) => ({ type: 'SetRequests', civ,
      entries: entries.map(([itemType, priority]) => ({ itemType, priority })) }) as unknown as Command);
  } },
  { id: 'SetPopulationCap', milestone: 7, arbitrary: () => fc.integer({ min: POPULATION_CAP_MIN - 5, max: POPULATION_CAP_MAX + 5 })
    .map((n) => ({ type: 'SetPopulationCap', n }) as Command) },
];

/** The generators of the milestones built so far: M1's terrain and labor ones, M2's items and buildings ones. */
export const COMMAND_GENERATORS: readonly CommandGenerator[] = Object.freeze([
  { id: 'Designate', milestone: 1, arbitrary: designate },
  {
    id: 'UndoDesignation',
    milestone: 1,
    arbitrary: (w: TestWorld) => tiles(w).map((list) => ({ type: 'UndoDesignation', tiles: list }) as Command),
  },
  {
    id: 'SetTraffic',
    milestone: 1,
    arbitrary: (w: TestWorld) =>
      fc
        .tuple(tiles(w, fc.constant(FLAT_TEST_SURFACE_Z)), fc.constantFrom('normal', 'restricted', 'forbidden'))
        .map(([list, mode]) => ({ type: 'SetTraffic', tiles: list, mode }) as Command),
  },
  {
    id: 'SetLabor',
    milestone: 1,
    arbitrary: (w: TestWorld) => {
      const dwarves = w.readers.entities.with(C.Labors);
      const labors = w.game.registry.table('labors').ids();
      if (dwarves.length === 0) return fc.constant({ type: 'SetLabor', dwarfId: 0, labor: labors[0], on: true } as Command);
      return fc
        .tuple(fc.constantFrom(...dwarves), fc.constantFrom(...labors), fc.boolean())
        .map(([dwarfId, labor, on]) => ({ type: 'SetLabor', dwarfId, labor, on }) as Command);
    },
  },
  ...M2_GENERATORS,
  ...M4_GENERATORS,
  ...M5_GENERATORS,
  ...M6_GENERATORS,
  ...M7_GENERATORS,
]);

export function generatorsFor(milestone: number): readonly CommandGenerator[] {
  return COMMAND_GENERATORS.filter((g) => g.milestone <= milestone);
}

export interface ScheduledCommand {
  readonly tick: number;
  readonly command: Command;
}

/**
 * A stream of commands over `ticks` ticks, drawn from the generators available at `milestone`.
 * With no generators the stream is always empty, which is the M0 case.
 */
export function commandStream(
  w: TestWorld,
  milestone: number,
  ticks: number,
): fc.Arbitrary<ScheduledCommand[]> {
  const generators = generatorsFor(milestone);
  if (generators.length === 0) return fc.constant<ScheduledCommand[]>([]);
  const one = fc.oneof(...generators.map((g) => g.arbitrary(w)));
  return fc
    .array(fc.record({ tick: fc.integer({ min: 0, max: Math.max(0, ticks - 1) }), command: one }), {
      maxLength: 200,
    })
    .map((list) => list.slice().sort((a, b) => a.tick - b.tick));
}
