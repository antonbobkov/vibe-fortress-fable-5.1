/**
 * T-489: a job whose stand tile is forbidden traffic (03) is not claimed. The connectivity labels know
 * the terrain only (22) and join the worker to the tile, but the pathfinder keeps every dwarf out of
 * it: a plant job on a forbidden plot tile was claimed, its seed fetched and carried, and the walk to
 * the plot failed, again after every FAILED_WALK_RETRY_TICKS (the sweep's three-year seeds, 223 such
 * walks over 64 runs, most where a workshop's forbidden corner lies on the plot).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { JobBoard, JobsReader } from '@systems/jobs';
import { checkInvariants, sampleInvariants } from '../../scenarios/invariants';
import { TestWorld } from '../../scenarios/test-world';

describe('T-489 a forbidden stand tile', () => {
  it('leaves the plant job of a forbidden plot tile unclaimed, and plants it once the tile is open', () => {
    const w = new TestWorld({ seed: 't489-forbidden-plot', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const tiles = [20, 21, 22].map((x) => w.index(x, 20, Z));
    const forbidden = tiles[1]!;
    const zoneId = w.zone('farm_plot', tiles);
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: world.calendar.season, speciesId: 'barley' }).ok).toBe(true);
    expect(world.applyCommand({ type: 'SetTraffic', tiles: [forbidden], mode: 'forbidden' }).ok).toBe(true);
    w.spawnItem('seed', 'barley', w.index(30, 30, Z), 20);
    w.spawnDwarf({ at: w.index(25, 25, Z), skills: { farming: 5 } });
    const stopSampling = sampleInvariants(w.game);
    w.step(6 * TICKS_PER_HOUR);
    const jobs = w.readers.of<JobsReader>('11');
    const board = world.services.jobs as JobBoard;
    for (const t of [tiles[0]!, tiles[2]!]) expect(w.plants.cropAtTile.has(t), `open plot tile ${t} planted`).toBe(true);
    const job = jobs.byKey(`plant:${forbidden}`);
    expect(job).toBeDefined();
    // The labels join the dwarf to the tile; only the forbidden set keeps it out.
    expect(w.pathing.reader().reachable(w.index(25, 25, Z), forbidden, 'walker')).toBe(true);
    expect(w.events('JobClaimed').filter((e) => e['jobId'] === job!.id)).toEqual([]);
    expect(board.jobs.get(job!.id)!.state).toBe('blocked');
    expect(board.jobs.get(job!.id)!.blockedReason).toBe('unreachable');
    expect(board.jobs.get(job!.id)!.failedWalk).not.toBe(true);
    // A job that waits for the player to lift a forbid is no T-331 fault, however long it waits.
    w.step(TICKS_PER_DAY);
    expect(checkInvariants(w.game).filter((f) => f.inv.startsWith('job.unreachable'))).toEqual([]);
    stopSampling();
    expect(world.applyCommand({ type: 'SetTraffic', tiles: [forbidden], mode: 'normal' }).ok).toBe(true);
    w.until(() => w.plants.cropAtTile.has(forbidden), 6 * TICKS_PER_HOUR);
  });
});
