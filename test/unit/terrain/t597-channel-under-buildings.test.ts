/**
 * T-597: nothing is cut under a building (03 § Tile transitions). A tile that holds a building
 * fails `channel`, the wall under a floor that holds one fails `ramp`, the tools skip them with a
 * counted reason, and a building placed over either designation clears it with its job.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { Designation, TileFlag } from '@core/map3d';
import type { BuildingsSystem } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import { jobKey, precondition, TerrainFacts } from '@systems/terrain';
import { DesignateTool } from '@ui/panels/designate';
import { strings } from '../ui/ui-fixture';
import { TestWorld } from '../../scenarios/test-world';

const Y = Z - 3;

function setup(seed: string): { w: TestWorld; bed: number; under: number; system: BuildingsSystem; oak: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.digRoom(20, 20, Y, 5, 5);
  for (let z = Y - 1; z <= Y; z += 1) {
    for (let dy = -1; dy <= 5; dy += 1) for (let dx = -1; dx <= 5; dx += 1) w.discover(w.index(20 + dx, 20 + dy, z));
  }
  const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
  return { w, bed: w.index(22, 22, Y), under: w.index(22, 22, Y - 1), system, oak: w.game.registry.table('materials').index('oak') };
}

describe('T-597 a channel or a ramp under a building', () => {
  it('a floor under a bed fails channel, and the wall beneath it fails ramp, planned or built', () => {
    const { w, bed, under, system, oak } = setup('t597-precondition');
    const facts = new TerrainFacts(w.game.registry);
    expect(precondition(w.map, bed, Designation.Channel, facts)).toBe(true);
    expect(precondition(w.map, under, Designation.Ramp, facts)).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bed, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    expect(precondition(w.map, bed, Designation.Channel, facts)).toBe(false);
    expect(precondition(w.map, under, Designation.Ramp, facts)).toBe(false);
    system.completeNow(system.lastPlacedBuilding, oak, 0);
    expect(precondition(w.map, bed, Designation.Channel, facts)).toBe(false);
    expect(precondition(w.map, under, Designation.Ramp, facts)).toBe(false);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [bed], kind: 'channel', priority: 5 })).toEqual({ ok: false, reason: 'precondition_failed' });
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [under], kind: 'ramp', priority: 5 })).toEqual({ ok: false, reason: 'precondition_failed' });
    // The floor beside the bed, and the wall under it, still take them.
    expect(precondition(w.map, w.index(21, 22, Y), Designation.Channel, facts)).toBe(true);
    expect(precondition(w.map, w.index(21, 22, Y - 1), Designation.Ramp, facts)).toBe(true);
  });

  it('a Channel box over a furnished room skips the bed\'s floor, and a Ramp box the wall under it, and say why', () => {
    const { w, bed, under, system, oak } = setup('t597-tool');
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bed, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    system.completeNow(system.lastPlacedBuilding, oak, 0);
    const facts = new TerrainFacts(w.game.registry);
    const ctx = { map: w.readers.map, precondition: (i: number, k: Designation) => precondition(w.map, i, k, facts) };
    const channel = new DesignateTool();
    channel.choose('c');
    const plan = channel.plan(ctx, { x: 21, y: 21, z: Y }, { x: 23, y: 23, z: Y });
    expect(plan.skipped).toEqual([{ reason: 'ui.status.skip.building', n: 1 }]);
    expect(strings.get('ui.status.skip.building')).toBe('under a building');
    expect(plan.designated).toBe(8);
    expect(plan.commands.flatMap((c) => c['tiles'] as number[])).not.toContain(bed);
    for (const c of plan.commands) expect(w.game.world.applyCommand(c)).toEqual({ ok: true });
    const ramp = new DesignateTool();
    ramp.choose('r');
    expect(ramp.kind).toBe('ramp');
    const below = ramp.plan(ctx, { x: 21, y: 21, z: Y - 1 }, { x: 23, y: 23, z: Y - 1 });
    expect(below.skipped).toEqual([{ reason: 'ui.status.skip.building', n: 1 }]);
    expect(below.commands.flatMap((c) => c['tiles'] as number[])).not.toContain(under);
  });

  it('a constructed floor is skipped by a Channel box as a built floor', () => {
    const { w } = setup('t597-built-floor');
    const tile = w.index(21, 21, Y);
    w.map.setFlag(tile, TileFlag.Constructed, true);
    w.map.setBuildingAt(tile, 9999);
    const facts = new TerrainFacts(w.game.registry);
    const tool = new DesignateTool();
    tool.choose('c');
    const plan = tool.plan({ map: w.readers.map, precondition: (i, k) => precondition(w.map, i, k, facts) }, { x: 21, y: 21, z: Y }, { x: 22, y: 21, z: Y });
    expect(plan.skipped).toEqual([{ reason: 'ui.status.skip.built_floor', n: 1 }]);
    w.map.setBuildingAt(tile, 0);
  });

  it('a building placed over a channel or a ramp designation clears it and its job', () => {
    const { w, bed } = setup('t597-placed');
    const world = w.game.world;
    const other = w.index(21, 21, Y);
    expect(world.applyCommand({ type: 'Designate', tiles: [bed, other], kind: 'channel', priority: 5 })).toEqual({ ok: true });
    w.step(2);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.byKey(jobKey(Designation.Channel, bed))).toBeDefined();
    expect(world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bed, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    w.step(2);
    expect(w.map.designationAt(bed)).toBe(Designation.None);
    expect(jobs.byKey(jobKey(Designation.Channel, bed))).toBeUndefined();
    expect(w.map.designationAt(other)).toBe(Designation.Channel);

    const chair = w.index(23, 23, Y);
    const wall = w.index(23, 23, Y - 1);
    expect(world.applyCommand({ type: 'Designate', tiles: [wall], kind: 'ramp', priority: 5 })).toEqual({ ok: true });
    w.step(2);
    expect(world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: chair, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    w.step(2);
    expect(w.map.designationAt(wall)).toBe(Designation.None);
    expect(jobs.byKey(jobKey(Designation.Ramp, wall))).toBeUndefined();
  });
});
