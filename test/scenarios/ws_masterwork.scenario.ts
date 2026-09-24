/** `acceptance-tests.md` ws_masterwork; `12` § Quality and `15` § Thoughts. */
import { expect } from 'vitest';
import type { TickContext } from '@core/system';
import type { Job } from '@systems/jobs';
import type { MoraleReader } from '@systems/morale';
import type { WorkshopsSystem } from '@systems/workshops';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'ws_masterwork', milestone: 5, seed: 'ws-masterwork', world: 'flat-test', embark: 'none',
  run: (w) => {
    const at = w.index(15, 15, 32);
    const carpenter = w.build('carpenter', at);
    const maker = w.spawnDwarf({ at: w.index(19, 17, 32), skills: { carpentry: 20 } });
    w.step(1);
    const op = (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;
    for (let n = 0; n < 100; n += 1) {
      const log = w.spawnItem('log', 'oak', w.index(19, 18, 32));
      op.producer().onComplete?.({ id: n + 1, workerId: maker, target: { kind: 'building', ref: carpenter },
        inputs: [{ filter: {}, count: 1, reserved: [log], delivered: [log] }],
        data: { recipe: 'make_bed', orderIndex: -1, globalOrder: false } } as unknown as Job, ctx);
    }
    w.step(2);
    const crafted = w.events('ItemCrafted').filter((e) => e['recipeId'] === 'make_bed');
    expect(crafted).toHaveLength(100);
    const masterworks = w.events('MasterworkCreated').filter((e) => e['crafterId'] === maker);
    expect(masterworks.length).toBeGreaterThanOrEqual(40);
    expect(w.readers.of<MoraleReader>('15').thoughts(maker).some((t) => t.id === 'made_masterwork')).toBe(true);
  },
};

export default scenario;
