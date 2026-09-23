import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { JobSink, JobsReader } from '@systems/jobs';
import type { Scenario } from './runner';

/** T-M4-07 extends this with adulthood and fixed child labors. */
const scenario: Scenario = {
  id: 'dw_child', milestone: 4, seed: 'dw-child', world: 'flat-test', embark: 'none',
  run: (w) => {
    const at = w.index(12, 12, 32);
    const child = w.spawnDwarf({ at, ageYears: 8 });
    const target = w.index(14, 12, 32);
    w.game.world.services.terrain.setKind(target, TileKind.Wall, w.game.registry.table('materials').index('granite'));
    const producer = { id: 'child-dig-test', done: false, produce(_ctx: unknown, sink: JobSink): void {
      if (this.done) return;
      this.done = true;
      sink.create('child-dig', { type: 'dig', target: { kind: 'tile', ref: target }, workTile: 'adjacent' });
    } };
    w.game.world.registrations.jobProducer(producer);
    w.step(100);
    expect(w.dwarves.reader().isChild(child)).toBe(true);
    expect(w.readers.of<JobsReader>('11').byKey('child-dig')?.workerId).toBe(0);
  },
};
export default scenario;
