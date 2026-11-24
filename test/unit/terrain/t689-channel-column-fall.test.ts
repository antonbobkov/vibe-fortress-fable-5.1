/**
 * T-689: a channel column worked a level at a time, each level a ramp in rock that the one above
 * left (03 § Digging as a job: "With none, the movement helper makes it fall after the floor
 * opens"). The miner on such a ramp has no passable neighbour to step to, so it falls onto the
 * new ramp below; and anyone else standing on the tile when it opens falls with it.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { TestWorld } from '../../scenarios/test-world';
import { checkInvariants } from '../../scenarios/invariants';
import { onlyMiner } from '../../scenarios/m1-helpers';

const X = 44;
const Y = 14;

/** A shaft whose top level is channelled already: open at Z, a ramp at Z − 1 with rock all round it. */
function shaft(seed: string): { w: TestWorld; miner: EntityId; ramp: number; below: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'default', surfaceWildlife: 'none' });
  const miner = onlyMiner(w);
  const ramp = w.index(X, Y, Z - 1);
  w.carve(w.index(X, Y, Z), TileKind.Open);
  w.carve(ramp, TileKind.Ramp);
  for (const n of w.map.neighbors8(ramp)) expect(w.map.kindAt(n)).toBe(TileKind.Wall);
  expect(w.game.world.applyCommand({ type: 'Designate', tiles: [ramp], kind: 'channel', priority: 5 }).ok).toBe(true);
  return { w, miner, ramp, below: w.index(X, Y, Z - 2) };
}

const onImpassable = (w: TestWorld): string[] =>
  checkInvariants(w.game).filter((f) => f.inv === 'creature.on-impassable').flatMap((f) => f.samples);

describe('T-689 a channeller with nowhere to step', () => {
  it('falls onto the ramp its channel made, and is never left on the open tile', () => {
    const { w, miner, ramp, below } = shaft('t689-channeller');
    w.until((world) => world.map.kindAt(ramp) === TileKind.Open, 3_000);
    expect(w.map.kindAt(ramp)).toBe(TileKind.Open);
    expect(w.map.kindAt(below)).toBe(TileKind.Ramp);
    expect(w.movement.tileOf(miner)).toBe(below);
    expect(w.events('Fell').filter((e) => e['id'] === miner).map((e) => e['levels'])).toEqual([1]);
    expect(onImpassable(w)).toEqual([]);
    // It walks up out of the shaft from the ramp it landed on.
    w.step(5);
    expect(onImpassable(w)).toEqual([]);
  });

  it('takes down whoever else stands on the tile when it opens', () => {
    const { w, miner, ramp, below } = shaft('t689-bystander');
    const bystander = w.game.arrival?.dwarves[1] as EntityId;
    // Held on the ramp beside the miner until the floor goes.
    for (let k = 0; k < 3_000 && w.map.kindAt(ramp) !== TileKind.Open; k += 1) {
      if (w.movement.tileOf(bystander) !== ramp) w.movement.teleport(bystander, ramp);
      w.movement.clearPath(bystander);
      w.step(1);
    }
    expect(w.map.kindAt(ramp)).toBe(TileKind.Open);
    expect(w.movement.tileOf(miner)).toBe(below);
    expect(w.movement.tileOf(bystander)).toBe(below);
    expect(w.events('Fell').filter((e) => e['id'] === bystander).map((e) => e['levels'])).toEqual([1]);
    expect(onImpassable(w)).toEqual([]);
  });
});
