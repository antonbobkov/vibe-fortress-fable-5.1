/** `acceptance-tests.md` ws_bed: a level-6 carpenter makes one bed from one log. */
import { expect } from 'vitest';
import type { Scenario } from './runner';
import type { ItemsReader } from '@systems/items';
import type { WorkshopsReader } from '@systems/workshops';

const scenario: Scenario = {
  id: 'ws_bed', milestone: 4, seed: 'ws-bed', world: 'flat-test', embark: 'none',
  run: (w) => {
    const tile = w.index(15, 15, 32);
    const workshop = w.build('carpenter', tile);
    const carpenter = w.spawnDwarf({ at: w.index(17, 17, 32), skills: { carpentry: 6 } });
    w.spawnItem('log', 'oak', w.index(18, 17, 32));
    w.step(1);
    const result = w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: workshop,
      order: { recipeId: 'make_bed', mode: 'once', remaining: 1, priority: 5 } });
    expect(result).toEqual({ ok: true });
    const items = w.readers.of<ItemsReader>('13');
    w.until(() => items.count('bed') >= 1, 800);
    expect(w.events('ItemCrafted').some((e) => e['recipeId'] === 'make_bed' && e['crafterId'] === carpenter)).toBe(true);
    expect(w.events('WorkOrderCompleted').some((e) => e['workshopId'] === workshop)).toBe(true);
    expect(w.readers.of<WorkshopsReader>('12').ordersOf(workshop)).toHaveLength(0);
  },
};

export default scenario;

