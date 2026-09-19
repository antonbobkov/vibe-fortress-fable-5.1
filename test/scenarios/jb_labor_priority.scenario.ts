/**
 * `jb_labor_priority` of `04-implementation/acceptance-tests.md` § 11 Jobs: "mining labor priority
 * 3, hauling 5 | mining jobs chosen over equidistant haul jobs by every dwarf".
 *
 * The dig jobs come from designations (D-056). Hauling belongs to 13 (M2), so the haul jobs are
 * made by a test producer registered as `items`, the producer of `haul_to_stockpile`; they stand
 * one row beside the dig targets, at the same distance from the dwarves within a tile.
 */

import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { JobProducer } from '@core/system';
import type { JobSink } from '@systems/jobs';
import type { Scenario } from './runner';
import { dwarves } from './m1-helpers';

const COUNT = 7;

const scenario: Scenario = {
  id: 'jb_labor_priority',
  milestone: 1,
  seed: 'jb-labor-priority',
  world: 'flat-test',
  embark: 'default',
  setup: (w) => {
    const wagon = w.game.arrival?.wagon;
    if (wagon === undefined) throw new Error('no wagon');
    const granite = w.game.registry.table('materials').index('granite');
    const digs: number[] = [];
    const hauls: number[] = [];
    for (let k = 0; k < COUNT; k += 1) {
      const x = wagon.x - 3 + k;
      const dig = w.index(x, wagon.y + 7, wagon.z);
      w.game.world.services.terrain.setKind(dig, TileKind.Wall, granite);
      digs.push(dig);
      hauls.push(w.index(x, wagon.y + 6, wagon.z));
    }
    // Mining needs a pick (13; the D-070 shim went with T-M2-08) and the Balanced wagon holds two:
    // five more beside the wagon let every dwarf mine, which is what the scenario compares.
    for (let k = 0; k < COUNT - 2; k += 1) w.spawnItem('pick', 'iron', w.index(wagon.x - 2 + k, wagon.y + 2, wagon.z));
    let made = false;
    const producer: JobProducer = {
      id: 'items',
      produce: (_ctx, sink) => {
        if (made) return;
        made = true;
        hauls.forEach((t, k) =>
          (sink as JobSink).create(`haul:${k}`, { type: 'haul_to_stockpile', target: { kind: 'tile', ref: t }, workTile: 'at' }),
        );
      },
    };
    w.game.world.registrations.jobProducer(producer);
    const r1 = w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'mining', priority: 3 });
    const r2 = w.game.world.applyCommand({ type: 'SetLaborPriority', labor: 'hauling', priority: 5 });
    const r3 = w.game.world.applyCommand({ type: 'Designate', tiles: digs, kind: 'dig' });
    if (!r1.ok || !r2.ok || !r3.ok) throw new Error('setup commands rejected');
  },
  run: 30,
  expect: (w) => {
    const first = new Map<number, string>();
    for (const e of w.events('JobClaimed')) {
      const id = e['workerId'] as number;
      if (!first.has(id)) first.set(id, e['jobType'] as string);
    }
    for (const id of dwarves(w)) expect([id, first.get(id)]).toEqual([id, 'dig']);
    expect(w.events('JobCreated').filter((e) => e['jobType'] === 'haul_to_stockpile')).toHaveLength(COUNT);
  },
};

export default scenario;
