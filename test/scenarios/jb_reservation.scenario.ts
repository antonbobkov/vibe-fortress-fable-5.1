/**
 * `jb_reservation` of `04-implementation/acceptance-tests.md` § 11 Jobs: "two craft jobs needing the
 * same single log | one claims, the other blocks `missing_input`; on completion the second
 * proceeds". Crafting is 12's (M5), so the two jobs are stubbed as `build` jobs (T-M2-04: "two
 * craft-like jobs stubbed as `build` jobs needing the same log") created straight on 11's board,
 * each with one `log` input and a work tile of its own; no producer consumes the log, so the first
 * job's completion releases it where it was delivered.
 */

import { expect } from 'vitest';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';

const Z = 32;
const jobIds: number[] = [];
let log = 0;

const scenario: Scenario = {
  id: 'jb_reservation',
  milestone: 2,
  seed: 'jb-reservation',
  world: 'flat-test',
  embark: 'default',
  setup: (w) => {
    jobIds.length = 0;
    log = w.spawnItem('log', 'oak', w.index(45, 14, Z));
    const logType = w.game.registry.table('items').index('log');
    for (const x of [50, 52]) {
      jobIds.push(
        w.game.world.services.jobs.create(`test:craft:${x}`, {
          type: 'build',
          target: { kind: 'tile', ref: w.index(x, 16, Z) },
          workTile: w.index(x, 16, Z),
          inputs: [{ filter: { type: logType }, count: 1 }],
          data: { labor: 'construction' },
        }),
      );
    }
  },
  run: (w) => {
    const items = w.readers.of<ItemsReader>('13');
    const [first, second] = jobIds as [number, number];
    w.until((x) => x.events('JobBlocked').some((e) => e['reason'] === 'missing_input'), 400);
    const claimed = w.events('JobClaimed').map((e) => e['jobId']);
    const blocked = w.events('JobBlocked').filter((e) => e['reason'] === 'missing_input').map((e) => e['jobId']);
    expect(claimed).toHaveLength(1);
    expect(blocked).toHaveLength(1);
    expect([claimed[0], blocked[0]].sort()).toEqual([first, second].sort());
    expect(items.get(log)?.reservedBy).toBe(claimed[0]);
    // The first completes; the log is released; the second claims it and completes too.
    w.until((x) => x.events('JobCompleted').some((e) => e['jobId'] === claimed[0]), 1500);
    w.until((x) => x.events('JobCompleted').some((e) => e['jobId'] === blocked[0]), 1500);
    expect(w.events('JobClaimed').filter((e) => e['jobId'] === blocked[0]).length).toBeGreaterThanOrEqual(1);
    expect(items.get(log)?.reservedBy).toBe(0);
  },
};

export default scenario;
