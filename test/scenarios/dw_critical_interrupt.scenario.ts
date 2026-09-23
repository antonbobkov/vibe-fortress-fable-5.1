import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { JobsReader } from '@systems/jobs';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'dw_critical_interrupt', milestone: 4, seed: 'dw-critical', world: 'flat-test', embark: 'none',
  run: (w) => {
    const at = w.index(12, 12, 32);
    const id = w.spawnDwarf({ at });
    w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: 'mining', on: true });
    w.spawnItem('pick', 'copper', at);
    w.spawnItem('drink', 'ale', at, 5);
    const target = w.index(14, 12, 32);
    w.game.world.services.terrain.setKind(target, TileKind.Wall, w.game.registry.table('materials').index('granite'));
    w.discover(target);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [target], kind: 'dig', priority: 5 })).toEqual({ ok: true });
    const jobs = w.readers.of<JobsReader>('11');
    const active = (): ReturnType<JobsReader['list']>[number] | undefined => jobs.list().find((j) => j.target.ref === target);
    w.until(() => (active()?.progress ?? 0) > 0, 500);
    const before = active();
    expect(before?.workerId).toBe(id);
    w.setNeed(id, 'thirst', 90);
    w.step(2);
    const interrupted = active();
    expect(interrupted?.state).toBe('open');
    expect(interrupted?.progress).toBeGreaterThanOrEqual(before?.progress ?? 0);
    w.until(() => w.events('DrankAlcohol').some((e) => e['id'] === id), 200);
    expect(w.game.world.entities.get(id, C.Needs)?.thirst).toBeLessThan(50);
    w.until(() => (active()?.workerId ?? 0) === id || w.map.kindAt(target) === TileKind.Floor, 500);
    expect((active()?.workerId ?? 0) === id || w.map.kindAt(target) === TileKind.Floor).toBe(true);
  },
};
export default scenario;
