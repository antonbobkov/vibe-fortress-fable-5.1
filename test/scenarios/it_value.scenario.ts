/**
 * `it_value` of `04-implementation/acceptance-tests.md` § 13 Items: "masterwork steel breastplate |
 * value 4,000" (`items.md` § Value examples: 40 × 20 × 5.0).
 */

import { expect } from 'vitest';
import type { ItemsReader } from '@systems/items';
import type { TickContext } from '@core/system';
import type { Job } from '@systems/jobs';
import type { WorkshopsSystem } from '@systems/workshops';
import type { Scenario } from './runner';

let breastplate = 0;

const scenario: Scenario = {
  id: 'it_value',
  milestone: 2,
  seed: 'it-value',
  world: 'flat-test',
  setup: (w) => {
    breastplate = w.spawnItem('breastplate', 'steel', w.index(40, 40, 32), 1, 5);
  },
  run: 1,
  expect: (w) => {
    const items = w.readers.of<ItemsReader>('13');
    expect(items.get(breastplate)).toMatchObject({ quality: 5, count: 1 });
    expect(items.value(breastplate)).toBe(4000);
    const forge = w.build('forge', w.index(15, 15, 32));
    const maker = w.spawnDwarf({ at: w.index(19, 17, 32), skills: { armorsmithing: 20 } });
    w.step(1);
    const op = (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;
    for (let n = 0; n < 20 && w.events('ItemCrafted').filter((e) => e['recipeId'] === 'forge_breastplate' && e['quality'] === 5).length === 0; n += 1) {
      const bars = w.spawnItem('bar', 'steel', w.index(19, 18, 32), 4);
      const fuel = w.spawnItem('charcoal_bar', 'charcoal', w.index(19, 18, 32));
      op.producer().onComplete?.({ id: n + 1, workerId: maker, target: { kind: 'building', ref: forge },
        inputs: [{ filter: {}, count: 4, reserved: [bars], delivered: [bars] }, { filter: {}, count: 1, reserved: [fuel], delivered: [fuel] }],
        data: { recipe: 'forge_breastplate', orderIndex: -1, globalOrder: false } } as unknown as Job, ctx);
    }
    w.step(1);
    const crafted = w.events('ItemCrafted').find((e) => e['recipeId'] === 'forge_breastplate' && e['quality'] === 5);
    expect(crafted).toBeDefined();
    expect(items.get(crafted?.['itemId'] as number)).toMatchObject({ quality: 5, material: w.game.registry.table('materials').index('steel') });
    expect(items.value(crafted?.['itemId'] as number)).toBe(4000);
  },
};

export default scenario;
