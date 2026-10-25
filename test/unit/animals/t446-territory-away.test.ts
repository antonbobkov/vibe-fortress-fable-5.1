/**
 * T-446: a territorial surface animal keeps no home chunk within TERRITORY_AVOID_RADIUS of the
 * fortress (08 § Wild behavior), and moves its home when the fortress grows into its ground.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { TickContext } from '@core/system';
import { chunkCentre, thinkWild } from '@systems/animals';
import { TERRITORY_AVOID_RADIUS } from '@systems/animals/constants';
import { TestWorld } from '../../scenarios/test-world';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function think(w: TestWorld, id: number): string {
  const e = w.game.world.entities;
  const ctx = { tick: w.tick, world: w.game.world, emit: () => {} } as unknown as TickContext;
  const next = thinkWild(w.animals.brain, ctx, id, e.get(id, C.Wild)!);
  e.add(id, C.Wild, next);
  return next.state;
}

/** Horizontal Chebyshev distance from a chunk's centre to a tile. */
function distance(w: TestWorld, chunk: number, x: number, y: number): number {
  const c = chunkCentre(w.map, chunk);
  return Math.max(Math.abs(w.map.xOf(c) - x), Math.abs(w.map.yOf(c) - y));
}

describe('T-446 territorial animals keep their ground away from the fortress', () => {
  it('a boar spawned beside a building takes a home outside TERRITORY_AVOID_RADIUS', () => {
    const w = world('t446-spawned');
    w.build('chest', w.index(20, 20, Z), 'oak');
    const boar = w.spawnCreature('boar', w.index(22, 22, Z), 'wild');
    const e = w.game.world.entities;
    expect(distance(w, e.get(boar, C.Wild)!.homeChunk, 20, 20), 'spawned with a home by the chest').toBeLessThanOrEqual(TERRITORY_AVOID_RADIUS);
    expect(think(w, boar)).toBe('wander');
    expect(distance(w, e.get(boar, C.Wild)!.homeChunk, 20, 20), 'its new home').toBeGreaterThan(TERRITORY_AVOID_RADIUS);
  });

  it('a building placed in its ground makes it move its home', () => {
    const w = world('t446-moved');
    const boar = w.spawnCreature('boar', w.index(40, 40, Z), 'wild');
    const e = w.game.world.entities;
    const home = e.get(boar, C.Wild)!.homeChunk;
    expect(think(w, boar)).not.toBe('leave');
    expect(e.get(boar, C.Wild)!.homeChunk, 'no fortress: the home stays').toBe(home);
    const centre = chunkCentre(w.map, home);
    w.build('chest', w.index(w.map.xOf(centre), w.map.yOf(centre), Z), 'oak');
    w.step(1);
    e.add(boar, C.Wild, { ...e.get(boar, C.Wild)!, state: 'idle' });
    think(w, boar);
    const moved = e.get(boar, C.Wild)!.homeChunk;
    expect(moved).not.toBe(home);
    expect(distance(w, moved, w.map.xOf(centre), w.map.yOf(centre))).toBeGreaterThan(TERRITORY_AVOID_RADIUS);
  });

  it('a deer, which is not territorial, keeps its home by the fortress', () => {
    const w = world('t446-deer');
    w.build('chest', w.index(20, 20, Z), 'oak');
    const deer = w.spawnCreature('deer', w.index(22, 22, Z), 'wild');
    const e = w.game.world.entities;
    const home = e.get(deer, C.Wild)!.homeChunk;
    think(w, deer);
    expect(e.get(deer, C.Wild)!.homeChunk).toBe(home);
  });
});
