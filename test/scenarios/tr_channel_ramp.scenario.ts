/**
 * `tr_channel_ramp` of `04-implementation/acceptance-tests.md` § 03 Terrain: "channel a floor tile
 * above a wall | tile `Open`, tile below `Ramp`; a dwarf can walk down and up".
 *
 * The channelled surface floor of `flat-test` stands on loam; the miner stands on it to work
 * (`jobs.md`: "at, then adjacent") and steps off as the floor goes.
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';
import { onlyMiner } from './m1-helpers';

const X = 44;
const Y = 14;
const Z = 32;

const scenario: Scenario = {
  id: 'tr_channel_ramp',
  milestone: 1,
  seed: 'tr-channel-ramp',
  world: 'flat-test',
  embark: 'default',
  setup: (w) => {
    onlyMiner(w);
    const r = w.game.world.applyCommand({ type: 'Designate', tiles: [w.index(X, Y, Z)], kind: 'channel' });
    if (!r.ok) throw new Error(`designate: ${r.reason}`);
  },
  run: (w) => {
    w.until((world) => world.map.kindAt(world.index(X, Y, Z)) === TileKind.Open, 2_000);
    w.step(2);
  },
  expect: (w) => {
    const top = w.index(X, Y, Z);
    const ramp = w.index(X, Y, Z - 1);
    expect(w.map.kindAt(top)).toBe(TileKind.Open);
    expect(w.map.kindAt(ramp)).toBe(TileKind.Ramp);
    // The miner stepped off the channelled tile and did not fall into it.
    expect(w.events('Fell')).toHaveLength(0);
    // Down the ramp from the surface and back up.
    const beside = w.index(X - 1, Y, Z);
    expect(w.findPath(beside, ramp)).not.toBeNull();
    expect(w.findPath(ramp, beside)).not.toBeNull();
    expect(w.reachable(beside, ramp)).toBe(true);
    // A dwarf walks it, down to the ramp and up again, through the movement helper alone (the
    // world is not stepped, so no brain sends it elsewhere).
    const d = w.game.arrival?.dwarves[1] as number;
    const walk = (to: number): void => {
      for (let k = 0; k < 600 && w.movement.tileOf(d) !== to; k += 1) {
        w.movement.walkTo(d, to, 'job', { tick: w.tick, emit: () => {} });
        w.game.pathing.pathfinder.tick();
      }
      expect(w.movement.tileOf(d)).toBe(to);
    };
    walk(ramp);
    walk(beside);
  },
};

export default scenario;
