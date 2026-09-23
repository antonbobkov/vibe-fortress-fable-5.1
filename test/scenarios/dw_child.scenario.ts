import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import { TICKS_PER_YEAR } from '@core/constants';
import { C } from '@core/components';
import type { JobSink, JobsReader } from '@systems/jobs';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'dw_child', milestone: 4, seed: 'dw-child', world: 'flat-test', embark: 'none', startTick: TICKS_PER_YEAR - 100,
  run: (w) => {
    const at = w.index(12, 12, 32);
    const child = w.spawnDwarf({ at, ageYears: 11 });
    const target = w.index(14, 12, 32);
    w.game.world.services.terrain.setKind(target, TileKind.Wall, w.game.registry.table('materials').index('granite'));
    const producer = { id: 'child-dig-test', done: false, produce(_ctx: unknown, sink: JobSink): void {
      if (this.done) return;
      this.done = true;
      sink.create('child-dig', { type: 'dig', target: { kind: 'tile', ref: target }, workTile: 'adjacent' });
    } };
    w.game.world.registrations.jobProducer(producer);
    w.step(99);
    expect(w.dwarves.reader().isChild(child)).toBe(true);
    expect(w.readers.of<JobsReader>('11').byKey('child-dig')?.workerId).toBe(0);
    expect(w.game.world.applyCommand({ type: 'SetLabor', dwarfId: child, labor: 'mining', on: true })).toEqual({ ok: false, reason: 'child_labor' });
    w.step(3);
    expect(w.dwarves.reader().isChild(child)).toBe(false);
    expect(w.game.world.entities.get(child, C.Creature)?.ageTicks).toBe(12 * TICKS_PER_YEAR);
    expect(w.events('DwarfBecameAdult').some((e) => e['id'] === child)).toBe(true);
  },
};
export default scenario;
