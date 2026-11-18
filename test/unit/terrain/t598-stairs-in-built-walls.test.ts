/**
 * T-598: a constructed wall is never carved (03 § Tile transitions). Stairs and ramps refuse it as
 * dig does, the tools skip it as a "built wall", and a channel above it leaves it standing; only
 * `remove` takes it down, returning its blocks.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { Designation, TileFlag, TileKind } from '@core/map3d';
import type { BuildingsSystem } from '@systems/buildings';
import { precondition, TerrainFacts, transition } from '@systems/terrain';
import { DesignateTool } from '@ui/panels/designate';
import { strings } from '../ui/ui-fixture';
import { TestWorld } from '../../scenarios/test-world';

const Y = Z - 3;

function setup(seed: string): { w: TestWorld; wall: number; facts: TerrainFacts } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.digRoom(20, 20, Y, 5, 5);
  for (let z = Y - 1; z <= Y + 1; z += 1) {
    for (let dy = -1; dy <= 5; dy += 1) for (let dx = -1; dx <= 5; dx += 1) w.discover(w.index(20 + dx, 20 + dy, z));
  }
  const wall = w.index(21, 21, Y);
  expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'wall', origin: wall, orientation: 0, materialChoice: 'granite' }).ok).toBe(true);
  const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
  system.completeNow(system.lastPlacedBuilding, w.game.registry.table('materials').index('granite'), 0);
  expect(w.map.kindAt(wall)).toBe(TileKind.Wall);
  expect(w.map.hasFlag(wall, TileFlag.Constructed)).toBe(true);
  return { w, wall, facts: new TerrainFacts(w.game.registry) };
}

const rolls = { stoneDrops: () => true, logs: () => 1, gather: () => null, logMaterial: () => 'oak' };

describe('T-598 stairs carved into a constructed wall', () => {
  it('a built wall fails up, up/down stairs and ramp as it fails dig; a natural wall passes', () => {
    const { w, wall, facts } = setup('t598-precondition');
    const rock = w.index(19, 21, Y);
    for (const k of [Designation.StairsUp, Designation.StairsUpDown, Designation.Dig]) {
      expect(precondition(w.map, wall, k, facts)).toBe(false);
      expect(precondition(w.map, rock, k, facts)).toBe(true);
    }
    expect(precondition(w.map, wall, Designation.Ramp, facts)).toBe(false);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [wall], kind: 'stairs_updown', priority: 5 })).toEqual({ ok: false, reason: 'precondition_failed' });
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [wall], kind: 'stairs_up', priority: 5 })).toEqual({ ok: false, reason: 'precondition_failed' });
    // `remove` is how it comes down.
    expect(precondition(w.map, wall, Designation.Remove, facts)).toBe(true);
  });

  it('the Stairs, Dig and Ramp tools skip a built wall and say so', () => {
    const { w, wall, facts } = setup('t598-tool');
    const ctx = { map: w.readers.map, precondition: (i: number, k: Designation) => precondition(w.map, i, k, facts) };
    const stairs = new DesignateTool();
    stairs.choose('w');
    const plan = stairs.plan(ctx, { x: 21, y: 21, z: Y }, { x: 21, y: 21, z: Y });
    expect(plan.skipped).toEqual([{ reason: 'ui.status.skip.built_wall', n: 1 }]);
    expect(plan.commands.flatMap((c) => c['tiles'] as number[])).not.toContain(wall);
    expect(strings.get('ui.status.skip.built_wall')).toBe('built wall');
    for (const key of ['d', 'r']) {
      const tool = new DesignateTool();
      tool.choose(key);
      expect(tool.plan(ctx, { x: 21, y: 21, z: Y }, { x: 21, y: 21, z: Y }).skipped).toEqual([{ reason: 'ui.status.skip.built_wall', n: 1 }]);
    }
  });

  it('a channel above a built wall leaves it standing; above natural rock it carves a ramp', () => {
    const { w, wall, facts } = setup('t598-channel');
    const above = w.map.above(wall);
    w.carve(above, TileKind.Floor);
    const built = transition(w.map, above, Designation.Channel, facts, rolls);
    expect(built.changes.map((c) => c.tile)).toEqual([above]);
    expect(built.drops).toEqual([]);
    const floor = w.index(23, 23, Y);
    const natural = transition(w.map, floor, Designation.Channel, facts, rolls);
    expect(natural.changes.map((c) => c.tile)).toEqual([floor, w.map.below(floor)]);
  });
});
