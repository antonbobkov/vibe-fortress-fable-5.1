/**
 * T-427: an animal that leaves keeps the edge tile it chose while it walks there (08 § Wild
 * behavior, `leave`). Picked again from each tile, the nearest straight-line edge changed with the
 * animal's row, and on a map whose way to the edge winds, a deer in three-years-p0-2 walked to and
 * fro between two edge tiles for weeks.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { TestWorld } from '../../scenarios/test-world';

describe('T-427 a leaving animal keeps its edge tile', () => {
  it('walks around a wall to the edge tile it chose and despawns there', () => {
    const w = new TestWorld({ seed: 't427-leave', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    // The way west along row 20 is walled: the deer must step to another row to get round.
    for (let x = 1; x <= 3; x += 1) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, 1);
    w.step(1);
    const deer = w.spawnCreature('deer', w.index(5, 20, Z), 'wild');
    const e = w.game.world.entities;
    e.add(deer, C.Wild, { ...e.get(deer, C.Wild)!, state: 'leave', lastThinkTick: -100 });
    const targets = new Set<number>();
    for (let t = 0; t < 600 && e.alive(deer); t += 1) {
      w.step(1);
      const target = w.game.movement.walkTarget(deer);
      if (target >= 0) targets.add(target);
    }
    expect(e.alive(deer), 'the deer left the map').toBe(false);
    expect([...targets].map((t) => `${w.map.xOf(t)},${w.map.yOf(t)}`), 'one edge tile for the whole walk').toEqual(['0,20']);
  });

  it('leaves by an edge tile it can reach when the nearest one is cut off', () => {
    const w = new TestWorld({ seed: 't427-leave-reach', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    // A wall from the north edge to the south edge cuts the west edge off.
    for (let y = 0; y < w.map.h; y += 1) w.game.world.services.terrain.setKind(w.index(2, y, Z), TileKind.Wall, 1);
    w.step(1);
    const deer = w.spawnCreature('deer', w.index(5, 20, Z), 'wild');
    const e = w.game.world.entities;
    e.add(deer, C.Wild, { ...e.get(deer, C.Wild)!, state: 'leave', lastThinkTick: -100 });
    for (let t = 0; t < 1500 && e.alive(deer); t += 1) w.step(1);
    expect(e.alive(deer), 'the deer left the map').toBe(false);
  });
});
