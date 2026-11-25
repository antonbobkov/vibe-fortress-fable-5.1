/**
 * T-712: a wild grazer that arrives on grass snow fell on while it walked there eats nothing there
 * (08 § Wild behavior, `graze`: snowed grass cannot be eaten) and looks again, as from a tile with no grass.
 */

import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SPEC, FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import { thinkWild } from '@systems/animals';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;

function newWorld(seed: string): TestWorld {
  return new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 64, 64), embark: 'none', spec: { ...FLAT_TEST_SPEC }, surfaceWildlife: 'none' });
}

function ctxOf(w: TestWorld): TickContext {
  return { tick: w.tick, emit: () => {}, world: w.game.world } as unknown as TickContext;
}

/** One think of a wild animal, its state written back as the system does. */
function think(w: TestWorld, id: EntityId): string {
  const wild = w.game.world.entities.get(id, C.Wild);
  if (wild === undefined) throw new Error('not a wild animal');
  const next = thinkWild(w.animals.brain, ctxOf(w), id, wild);
  w.game.world.entities.add(id, C.Wild, next);
  return next.state;
}

describe('T-712 a wild grazer does not eat grass snow fell on while it walked there', () => {
  it('walking to a grass tile that is snowed before it arrives, the deer leaves that grass and looks again', () => {
    const w = newWorld('t712-snow');
    w.game.world.calendar.isDaylight = true;
    const start = w.index(30, 30, Z);
    const target = w.index(32, 30, Z);
    const other = w.index(30, 34, Z);
    for (const tile of [target, other]) {
      w.map.setFlag(tile, TileFlag.Grass, true);
      w.map.setFlag(tile, TileFlag.Snow, false);
    }
    const deer = w.spawnCreature('deer', start, 'wild');
    const wild = w.game.world.entities.get(deer, C.Wild)!;
    w.game.world.entities.add(deer, C.Wild, { ...wild, state: 'idle', stateUntil: 0, hungry: false, lastThinkTick: 0 });
    // Idle with grass in reach: the deer sets off to graze the nearer tile.
    expect(think(w, deer)).toBe('graze');
    expect(w.animals.brain.movement?.walkTarget(deer)).toBe(target);
    // Snow falls on that tile while it walks; it arrives (the think on arrival).
    w.map.setFlag(target, TileFlag.Snow, true);
    w.movement.teleport(deer, target);
    expect(think(w, deer)).toBe('graze');
    // It claimed nothing and the grass under the snow is still there; it walks to the bare grass instead.
    expect(w.animals.grazedPending).not.toContain(target);
    expect(w.animals.brain.movement?.walkTarget(deer)).toBe(other);
    w.step(1);
    expect(w.map.hasFlag(target, TileFlag.Grass)).toBe(true);
    expect(w.events('GrassGrazed').filter((e) => e['tile'] === target)).toEqual([]);
  });

  it('with no snow the deer eats the grass it arrives on, as before', () => {
    const w = newWorld('t712-bare');
    w.game.world.calendar.isDaylight = true;
    const target = w.index(32, 30, Z);
    w.map.setFlag(target, TileFlag.Grass, true);
    w.map.setFlag(target, TileFlag.Snow, false);
    const deer = w.spawnCreature('deer', target, 'wild');
    const wild = w.game.world.entities.get(deer, C.Wild)!;
    w.game.world.entities.add(deer, C.Wild, { ...wild, state: 'graze', stateUntil: w.tick + 1000, hungry: false, lastThinkTick: 0 });
    expect(think(w, deer)).toBe('idle');
    expect(w.animals.grazedPending).toContain(target);
  });
});
