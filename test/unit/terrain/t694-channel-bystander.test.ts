/**
 * T-694: a creature standing on a tile when a channel opens it steps off with the worker, to the
 * first passable 8-neighbour (`03-terrain-and-mining.md` § Digging as a job). In the three-year
 * sweep with the cistern under the hearth hall, dwarves idling in the hall stood on the well's tile
 * as it was channelled and were left in the air over the open column.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { TestWorld } from '../../scenarios/test-world';

describe('T-694 a channel opens under a bystander', () => {
  it('the bystander steps off to a passable neighbour as the floor opens, and nobody is left on the open tile', () => {
    const w = new TestWorld({ seed: 't694-bystander', world: 'flat-test', embark: 'default' });
    w.step(200);
    const ent = w.game.world.entities;
    const someone = ent.with(C.Labors, C.Position)[0]!;
    const p = ent.get(someone, C.Position)!;
    const tile = w.index(p.x + 3, p.y, p.z);
    expect(w.map.kindAt(tile)).toBe(TileKind.Floor);
    const bystander = w.spawnDwarf({ at: tile });
    w.setLabor(bystander, 'mining', false);
    w.submit({ type: 'Designate', kind: 'channel', tiles: [tile], priority: 1 });
    const movement = w.game.world.services.movement!;
    let opened = -1;
    for (let t = 0; t < 4000 && opened < 0; t += 1) {
      if (movement.tileOf(bystander) !== tile) movement.teleport(bystander, tile);
      w.step(1);
      if (w.map.kindAt(tile) === TileKind.Open) opened = w.tick;
    }
    expect(opened, 'the channel was dug').toBeGreaterThan(0);
    const at = movement.tileOf(bystander);
    expect(at, 'the bystander is off the open tile').not.toBe(tile);
    expect(w.map.zOf(at), 'stepped off on its own level').toBe(p.z);
    expect(Math.max(Math.abs(w.map.xOf(at) - w.map.xOf(tile)), Math.abs(w.map.yOf(at) - w.map.yOf(tile)))).toBe(1);
    expect(w.readers.pathing.passable(at, 'walker', { faction: 'fortress' })).toBe(true);
    for (const id of ent.with(C.Creature, C.Position)) expect(movement.tileOf(id), `creature ${id} on the open tile`).not.toBe(tile);
  });
});
