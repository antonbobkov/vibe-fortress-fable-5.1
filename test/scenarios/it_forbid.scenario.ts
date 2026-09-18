/**
 * `it_forbid` of `04-implementation/acceptance-tests.md` § 13 Items: "forbid a log | no job takes it;
 * claim → hauled". Written with T-M2-04, when hauling exists (D-069): a wood stockpile would take the
 * log and a job needs one, but while the log is forbidden neither touches it; `ClaimItem` makes it
 * wanted again and it is hauled.
 */

import { expect } from 'vitest';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';
import { rect } from './m1-helpers';

const Z = 32;
let log = 0;
let pile = 0;

const scenario: Scenario = {
  id: 'it_forbid',
  milestone: 2,
  seed: 'it-forbid',
  world: 'flat-test',
  embark: 'default',
  setup: (w) => {
    log = w.spawnItem('log', 'oak', w.index(45, 14, Z));
    const r = w.game.world.applyCommand({ type: 'ForbidItem', itemId: log, on: true });
    if (!r.ok) throw new Error(`forbid: ${r.reason}`);
    pile = w.zone('stockpile', rect(w, 50, 20, Z, 3, 3));
    w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'wood' });
    w.game.world.services.jobs.create('test:needs-log', {
      type: 'build',
      target: { kind: 'tile', ref: w.index(40, 20, Z) },
      workTile: w.index(40, 20, Z),
      inputs: [{ filter: { type: w.game.registry.table('items').index('log') }, count: 1 }],
      data: { labor: 'construction' },
    });
  },
  run: (w) => {
    const items = w.readers.of<ItemsReader>('13');
    w.step(800);
    expect(items.get(log)).toMatchObject({ reservedBy: 0, carriedBy: 0 });
    expect(items.tileOf(log)).toBe(w.index(45, 14, Z));
    expect(w.events('ItemReserved').filter((e) => e['itemId'] === log)).toHaveLength(0);
    expect(items.wantsHaulingCount()).toBe(0);
    // Cancel the job that wants a log, so only hauling can take it after the claim.
    const job = w.game.world.readers.of<{ byKey(k: string): { id: number } | undefined }>('11').byKey('test:needs-log');
    w.game.world.applyCommand({ type: 'CancelJob', jobId: job?.id ?? 0 });
    expect(w.game.world.applyCommand({ type: 'ClaimItem', itemId: log })).toEqual({ ok: true });
    w.until(() => items.stockpileAt(items.tileOf(log)) === pile && items.get(log)?.reservedBy === 0, 1500);
  },
};

export default scenario;
