/**
 * T-811: a dig whose only stand tile lies behind forbidden traffic waits for the player, and is no
 * T-331 fault. In `three-years-p2-4` at shift 150 the script forbade the corners of a workshop site
 * (T-451), and a dig ran south from one corner: its first tile was cut from the edge of the site,
 * diagonally, and the next dig's only stand tile was that one-tile pocket, joined to the fortress by
 * the labels (22 knows the terrain only) and closed by the forbidden corner (T-530). The board kept
 * the job blocked `unreachable`, as 11 § Blocked jobs says; the invariant's "a tile beside the anchor
 * is reachable" read the labels alone and called it lost after a day.
 */
import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { checkInvariants, sampleInvariants } from '../../scenarios/invariants';
import { TestWorld } from '../../scenarios/test-world';

describe('T-811 a dig behind a forbidden tile', () => {
  it('stays blocked unreachable with no invariant finding, and is dug once the forbid is lifted', () => {
    const registry = contentRegistry();
    // A corridor along y = 1 between walls; the forbidden tile at x = 6 closes the one-tile pocket at x = 7.
    const w = new TestWorld({ seed: 't811-forbidden-pocket', world: 'flat-test', embark: 'none',
      registry, map: buildFlatTestMap(registry, 9, 3) });
    for (let x = 0; x < 9; x += 1) for (const y of [0, 2]) w.carve(w.index(x, y, 32), TileKind.Wall);
    const target = w.index(8, 1, 32);
    w.carve(target, TileKind.Wall);
    const barrier = w.index(6, 1, 32);
    const pocket = w.index(7, 1, 32);
    const at = w.index(1, 1, 32);
    const dwarf = w.spawnDwarf({ at, skills: { mining: 10 } });
    const pick = w.spawnItem('pick', 'iron', at);
    w.items.attachToCarrier(pick, dwarf);
    w.game.world.entities.add(dwarf, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
    const equipment = w.game.world.entities.get(dwarf, C.Equipment)!;
    w.game.world.entities.add(dwarf, C.Equipment, { ...equipment, weapon: pick });
    expect(w.game.world.applyCommand({ type: 'SetTraffic', tiles: [barrier], mode: 'forbidden' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [target] }).ok).toBe(true);
    const stopSampling = sampleInvariants(w.game);
    w.step(300);
    const board = w.game.world.services.jobs as JobBoard;
    const job = [...board.jobs.values()].find((j) => j.target.ref === target)!;
    expect(job).toBeDefined();
    // The labels join the dwarf to the stand tile; only the forbidden tile keeps it out.
    expect(board.standTiles(job)).toEqual([pocket]);
    expect(w.pathing.reader().reachable(at, pocket, 'walker')).toBe(true);
    expect(board.pocketOf(pocket)).not.toBe(board.pocketOf(at));
    expect(job.state).toBe('blocked');
    expect(job.blockedReason).toBe('unreachable');
    expect(w.events('JobClaimed').filter((e) => e['jobId'] === job.id)).toEqual([]);
    // Waiting for the player to lift a forbid is no T-331 fault, however long it waits.
    w.step(2 * TICKS_PER_DAY);
    expect(checkInvariants(w.game).filter((f) => f.inv.startsWith('job.unreachable'))).toEqual([]);
    stopSampling();
    expect(w.game.world.applyCommand({ type: 'SetTraffic', tiles: [barrier], mode: 'normal' }).ok).toBe(true);
    w.until((v) => v.events('JobCompleted').some((e) => e['jobId'] === job.id), 6000);
    expect(w.map.kindAt(target)).toBe(TileKind.Floor);
  });
});
