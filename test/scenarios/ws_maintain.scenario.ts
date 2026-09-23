/** `acceptance-tests.md` ws_maintain: meals reach ten and the order persists. */
import { expect } from 'vitest';
import type { Scenario } from './runner';
import type { ItemsReader } from '@systems/items';
import type { WorkshopsReader } from '@systems/workshops';

const scenario: Scenario = {
  id: 'ws_maintain', milestone: 4, seed: 'ws-maintain', world: 'flat-test', embark: 'none',
  run: (w) => {
    const workshop = w.build('kitchen', w.index(15, 15, 32));
    w.spawnDwarf({ at: w.index(17, 17, 32), skills: { cooking: 4 } });
    w.spawnItem('plant_food', 'turnip', w.index(18, 17, 32), 20);
    w.spawnItem('plant_food', 'dimcap', w.index(18, 18, 32), 20);
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: workshop,
      order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 10, priority: 5 } })).toEqual({ ok: true });
    const items = w.readers.of<ItemsReader>('13');
    w.until(() => items.count('easy_meal') >= 10, 2000);
    expect(w.readers.of<WorkshopsReader>('12').ordersOf(workshop)).toHaveLength(1);
    w.step(2);
    expect(w.events('JobCreated').filter((e) => e['jobType'] === 'craft')).toHaveLength(3);
  },
};

export default scenario;
