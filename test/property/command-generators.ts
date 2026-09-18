/**
 * The command generator registry of `05-plan/01-testing-strategy.md` § Property tests
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
import type { TileIndex } from '@core/types';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
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

/** The generators of the milestones built so far. T-M2-13 adds the items and buildings ones. */
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
