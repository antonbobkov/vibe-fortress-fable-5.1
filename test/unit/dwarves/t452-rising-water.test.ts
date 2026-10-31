/**
 * T-452: a dwarf leaves a tile as water rises toward a depth that would drown it
 * (`10-dwarves.md` § Behavior selection; `04-fluids.md` § Creatures and items in fluid).
 */

import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { FLUID_DEEP_LEVEL, FLUID_WADE_LEVEL } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { water } from '@systems/dwarves/activities';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;
const X = 30;
const Y = 30;
/** Ticks at each level of the rising water: time to walk a wading tile. */
const TICKS_PER_LEVEL = 40;

/** The water on the 3 × 3 around (X, Y) rises a level at a time to `top`, holding against the sim's spreading. */
function rise(w: TestWorld, top = 7, watch?: () => void): void {
  for (let level = 1; level <= top; level += 1) {
    for (let t = 0; t < TICKS_PER_LEVEL; t += 1) {
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const at = w.index(X + dx, Y + dy, Z);
        if (w.map.fluidLevelAt(at) !== level) w.setFluid(at, level);
      }
      w.step(1);
      watch?.();
    }
  }
}

function submersions(w: TestWorld, id: EntityId): number {
  return w.events('CreatureSubmerged').filter((e) => e['id'] === id).length;
}

function tileOf(w: TestWorld, id: EntityId): TileIndex {
  const p = w.game.world.entities.get(id, C.Position)!;
  return w.index(p.x, p.y, p.z);
}

function expectWalkedOut(w: TestWorld, id: EntityId): void {
  expect(w.game.world.entities.alive(id), 'alive').toBe(true);
  expect(submersions(w, id), 'never under water').toBe(0);
  expect(w.map.fluidLevelAt(tileOf(w, id)), 'out of the water').toBeLessThan(FLUID_WADE_LEVEL);
}

describe('T-452 a dwarf leaves rising water', () => {
  it('an idle dwarf walks out before the water can drown it', () => {
    const w = new TestWorld({ seed: 't452-idle', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const id = w.spawnDwarf({ at: w.index(X, Y, Z) });
    rise(w);
    expectWalkedOut(w, id);
  });

  it('a sleeping dwarf wakes and walks out', () => {
    const w = new TestWorld({ seed: 't452-sleep', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const id = w.spawnDwarf({ at: w.index(X, Y, Z) });
    w.setNeed(id, 'rest', 100);
    let slept = false;
    for (let t = 0; t < 200 && !slept; t += 1) {
      w.step(1);
      slept = w.game.world.entities.get(id, C.Brain)?.activity === 'sleep' && tileOf(w, id) === w.index(X, Y, Z);
    }
    expect(slept, 'asleep on the spot').toBe(true);
    w.setNeed(id, 'rest', 100);
    rise(w);
    expectWalkedOut(w, id);
  });

  it('two dwarves talking walk out', () => {
    const w = new TestWorld({ seed: 't452-talk', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const a = w.spawnDwarf({ at: w.index(X, Y, Z) });
    const b = w.spawnDwarf({ at: w.index(X + 1, Y, Z) });
    for (const id of [a, b]) {
      w.setNeed(id, 'social', 100);
      w.setNeed(id, 'rest', 0);
    }
    let talking = false;
    for (let t = 0; t < 300 && !talking; t += 1) {
      w.step(1);
      talking = [a, b].every((id) => w.game.world.entities.get(id, C.Brain)?.activity === 'social') && w.dwarves.activities.plans.get(a)?.phase === 'use';
    }
    expect(talking, 'in a talk').toBe(true);
    rise(w, 7);
    for (const id of [a, b]) expectWalkedOut(w, id);
  });

  it('with a job, it leaves and the job goes back on the board', () => {
    const w = new TestWorld({ seed: 't452-job', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const id = w.spawnDwarf({ at: w.index(X, Y, Z) });
    // Rock to mine beside it, a long job.
    const rock = w.index(X + 1, Y, Z);
    w.carve(rock, TileKind.Wall);
    w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [rock], priority: 1 });
    rise(w);
    expectWalkedOut(w, id);
  });

  it('a dwarf already on a deep tile leaves it for the nearest tile that is not', () => {
    const w = new TestWorld({ seed: 't452-deep', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const here = w.index(X, Y, Z);
    const id = w.spawnDwarf({ at: here });
    w.step(1);
    w.setFluid(here, FLUID_DEEP_LEVEL);
    for (let t = 0; t < 60; t += 1) {
      w.setFluid(here, tileOf(w, id) === here ? FLUID_DEEP_LEVEL : 0);
      w.step(1);
    }
    expect(tileOf(w, id)).not.toBe(here);
    expect(w.game.world.entities.alive(id)).toBe(true);
  });

  it('it walks through wading water on its way without stopping for it', () => {
    const w = new TestWorld({ seed: 't452-wade', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const id = w.spawnDwarf({ at: w.index(X - 4, Y, Z) });
    w.step(1);
    // A strip of wading water across the way to an order to walk.
    for (let y = Y - 10; y <= Y + 10; y += 1) w.setFluid(w.index(X, y, Z), FLUID_WADE_LEVEL);
    const movement = w.game.world.services.movement!;
    const goal = w.index(X + 4, Y, Z);
    let fled = false;
    for (let t = 0; t < 400 && tileOf(w, id) !== goal; t += 1) {
      for (let y = Y - 10; y <= Y + 10; y += 1) w.setFluid(w.index(X, y, Z), FLUID_WADE_LEVEL);
      movement.walkTo(id, goal, 'need', { tick: w.tick, emit: () => {} });
      w.step(1);
      if (w.game.world.entities.get(id, C.Brain)?.activity === 'Leaving the water') fled = true;
    }
    expect(fled).toBe(false);
  });

  it('a dwarf whose refuge floods goes on to a dry tile, as a real flood reaches it', () => {
    const w = new TestWorld({ seed: 't452-flood', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const id = w.spawnDwarf({ at: w.index(X, Y, Z) });
    w.step(1);
    // A source beside it pours without end over open floor.
    w.setFluid(w.index(X - 2, Y, Z), 7, 'water', true);
    w.step(1_500);
    expect(w.game.world.entities.alive(id), 'alive').toBe(true);
    expect(w.map.fluidLevelAt(tileOf(w, id)), 'out of the water').toBeLessThan(FLUID_DEEP_LEVEL);
  });

  it('with nowhere to go it stays, and nothing breaks', () => {
    const w = new TestWorld({ seed: 't452-sealed', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const here = w.index(X, Y, Z);
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (dx !== 0 || dy !== 0) w.carve(w.index(X + dx, Y + dy, Z), TileKind.Wall);
    const id = w.spawnDwarf({ at: here });
    w.step(1);
    for (let t = 0; t < 30; t += 1) {
      w.setFluid(here, FLUID_WADE_LEVEL);
      w.step(1);
    }
    expect(tileOf(w, id)).toBe(here);
  });

  it('the drink search does not choose a stand tile in water a dwarf would flee', () => {
    const w = new TestWorld({ seed: 't452-stand', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    // A pool, with the near side of its bank at wading depth and the far side dry.
    for (let y = Y - 2; y <= Y + 2; y += 1) {
      w.setFluid(w.index(X, y, Z), 7);
      w.setFluid(w.index(X - 1, y, Z), FLUID_WADE_LEVEL);
    }
    w.step(1);
    const ctx = { world: w.game.world, readers: w.readers, registry: w.game.registry, tick: w.tick } as unknown as TickContext;
    const stand = water(ctx, w.index(X - 3, Y, Z), () => true);
    expect(stand).toBeGreaterThanOrEqual(0);
    expect(w.map.fluidLevelAt(stand)).toBeLessThan(FLUID_WADE_LEVEL);
  });
});
