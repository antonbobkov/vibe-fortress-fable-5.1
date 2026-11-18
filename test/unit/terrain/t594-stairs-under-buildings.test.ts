/**
 * T-594: stairs are never cut under a building (03 § Tile transitions). A floor that holds a
 * building fails every stair precondition, the Stairs tool skips it with a counted reason, and a
 * building placed on a floor designated for stairs clears the designation with its job.
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

function setup(seed: string): { w: TestWorld; bed: number; system: BuildingsSystem; oak: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.digRoom(20, 20, Y, 5, 5);
  for (let z = Y - 1; z <= Y; z += 1) {
    for (let dy = -1; dy <= 5; dy += 1) for (let dx = -1; dx <= 5; dx += 1) w.discover(w.index(20 + dx, 20 + dy, z));
  }
  const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
  return { w, bed: w.index(22, 22, Y), system, oak: w.game.registry.table('materials').index('oak') };
}

describe('T-594 stairs cut into a floor that holds a building', () => {
  it('a floor under a built bed fails every stair precondition, and passes again without it', () => {
    const { w, bed, system, oak } = setup('t594-precondition');
    const facts = new TerrainFacts(w.game.registry);
    const kinds = [Designation.StairsUp, Designation.StairsDown, Designation.StairsUpDown];
    for (const k of kinds) expect(precondition(w.map, bed, k, facts)).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bed, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    // A planned building is already in the way.
    for (const k of kinds) expect(precondition(w.map, bed, k, facts)).toBe(false);
    system.completeNow(system.lastPlacedBuilding, oak, 0);
    for (const k of kinds) expect(precondition(w.map, bed, k, facts)).toBe(false);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [bed], kind: 'stairs_up', priority: 5 })).toEqual({ ok: false, reason: 'precondition_failed' });
    // Smoothing the floor under a bed is still allowed: the rule is about stairs.
    expect(precondition(w.map, bed, Designation.Smooth, facts)).toBe(true);
  });

  it('a Stairs box over a furnished room skips the bed\'s floor and says why', () => {
    const { w, bed, system, oak } = setup('t594-tool');
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bed, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    system.completeNow(system.lastPlacedBuilding, oak, 0);
    const facts = new TerrainFacts(w.game.registry);
    const tool = new DesignateTool();
    tool.choose('w');
    const plan = tool.plan({ map: w.readers.map, precondition: (i, k) => precondition(w.map, i, k, facts) }, { x: 21, y: 21, z: Y }, { x: 23, y: 23, z: Y - 1 });
    expect(plan.skipped).toEqual([{ reason: 'ui.status.skip.building', n: 1 }]);
    expect(strings.get('ui.status.skip.building')).toBe('under a building');
    const tiles = plan.commands.flatMap((c) => c['tiles'] as number[]);
    expect(tiles).not.toContain(bed);
    // Eight floors take down stairs and the nine tiles of rock below take up stairs.
    expect(plan.designated).toBe(17);
    for (const c of plan.commands) expect(w.game.world.applyCommand(c)).toEqual({ ok: true });
    expect(w.map.designationAt(bed)).toBe(Designation.None);
  });

  it('a constructed floor is skipped as a built floor', () => {
    const { w } = setup('t594-built-floor');
    const tile = w.index(21, 21, Y);
    // A constructed floor: the floor kind, the constructed flag and its construction on the tile.
    w.map.setFlag(tile, TileFlag.Constructed, true);
    w.map.setBuildingAt(tile, 9999);
    const facts = new TerrainFacts(w.game.registry);
    const tool = new DesignateTool();
    tool.choose('w');
    const plan = tool.plan({ map: w.readers.map, precondition: (i, k) => precondition(w.map, i, k, facts) }, { x: 21, y: 21, z: Y }, { x: 22, y: 21, z: Y });
    expect(plan.skipped).toEqual([{ reason: 'ui.status.skip.built_floor', n: 1 }]);
    expect(strings.get('ui.status.skip.built_floor')).toBe('built floor');
    w.map.setBuildingAt(tile, 0);
  });

  it('a building placed on a floor designated for stairs clears the designation and its job', () => {
    const { w, bed } = setup('t594-placed');
    const world = w.game.world;
    const other = w.index(21, 21, Y);
    expect(world.applyCommand({ type: 'Designate', tiles: [bed, other], kind: 'stairs_down', priority: 5 })).toEqual({ ok: true });
    w.step(2);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.byKey(jobKey(Designation.StairsDown, bed))).toBeDefined();
    expect(world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: bed, orientation: 0, materialChoice: 0 }).ok).toBe(true);
    w.step(2);
    expect(w.map.designationAt(bed)).toBe(Designation.None);
    expect(jobs.byKey(jobKey(Designation.StairsDown, bed))).toBeUndefined();
    expect(w.map.designationAt(other)).toBe(Designation.StairsDown);
  });
});
