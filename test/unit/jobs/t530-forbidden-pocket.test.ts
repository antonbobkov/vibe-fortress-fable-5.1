/**
 * T-530: a stand tile reached only through forbidden tiles is no stand tile. The connectivity labels
 * know the terrain only (22), so they join a worker to a small pocket that forbidden tiles close (a
 * workshop site whose forbidden corners and the walls beside it shut its footprint in, a room behind a
 * forbidden doorway). A build job there was claimed, its input fetched and carried, and the delivery
 * walk failed, again after every FAILED_WALK_RETRY_TICKS (the sweep's three-year seeds: 16 such walks
 * over 64 runs, one masonry site whose four corners the script forbids, between walls).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { JobBoard } from '@systems/jobs';
import { checkInvariants, sampleInvariants } from '../../scenarios/invariants';
import { TestWorld } from '../../scenarios/test-world';

describe('T-530 a pocket that forbidden tiles close', () => {
  it('leaves a build job in a room behind a forbidden doorway unclaimed, and builds it once the doorway is open', () => {
    const w = new TestWorld({ seed: 't530-forbidden-room', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const granite = w.game.registry.table('materials').index('granite');
    // A 5 × 5 room inside walls from (37, 20) to (43, 26); its one doorway at (40, 20).
    for (let x = 37; x <= 43; x += 1) {
      for (let y = 20; y <= 26; y += 1) {
        const edge = x === 37 || x === 43 || y === 20 || y === 26;
        if (edge && !(x === 40 && y === 20)) world.services.terrain.setKind(w.index(x, y, Z), TileKind.Wall, granite);
      }
    }
    const doorway = w.index(40, 20, Z);
    expect(world.applyCommand({ type: 'SetTraffic', tiles: [doorway], mode: 'forbidden' }).ok).toBe(true);
    expect(world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: w.index(40, 24, Z), orientation: 0, materialChoice: 0 }).ok).toBe(true);
    w.spawnItem('bed', 'oak', w.index(40, 12, Z));
    w.spawnDwarf({ at: w.index(42, 10, Z), skills: { carpentry: 5 } });
    w.step(1);
    const stopSampling = sampleInvariants(w.game);
    w.step(6 * TICKS_PER_HOUR);
    const board = world.services.jobs as JobBoard;
    const job = [...board.jobs.values()].find((j) => board.typeId(j) === 'build');
    expect(job).toBeDefined();
    // The labels join the dwarf to the room; only the forbidden doorway keeps it out.
    expect(w.reachable(w.index(42, 10, Z), w.index(40, 23, Z))).toBe(true);
    expect(w.events('JobClaimed').filter((e) => e['jobId'] === job!.id)).toEqual([]);
    const held = board.jobs.get(job!.id)!;
    expect(held.state).toBe('blocked');
    expect(held.blockedReason).toBe('unreachable');
    expect(held.failedWalk).not.toBe(true);
    // A job that waits for the player to lift a forbid is no T-331 fault, however long it waits.
    w.step(TICKS_PER_DAY);
    expect(checkInvariants(w.game).filter((f) => f.inv.startsWith('job.unreachable'))).toEqual([]);
    stopSampling();
    expect(world.applyCommand({ type: 'SetTraffic', tiles: [doorway], mode: 'normal' }).ok).toBe(true);
    const beds = w.readers.of<BuildingsReader>('14');
    w.until(() => beds.byType('bed').some((id) => beds.get(id)?.state === 'built'), 6 * TICKS_PER_HOUR);
  });
});
