/**
 * `it_wealth` of `04-implementation/acceptance-tests.md` § 13 Items: "craft 10 common granite
 * tables | wealth rises by 80 (2 × 4 × 10)". Crafting is 12's (M5), so the ten tables are spawned
 * by hand through the spawn API, which is where a crafted item enters the world too (T-M2-01:
 * "`it_wealth` (with hand-spawned items)").
 */

import { expect } from 'vitest';
import type { ItemsReader } from '@systems/items';
import type { TickContext } from '@core/system';
import type { Job } from '@systems/jobs';
import type { WorkshopsSystem } from '@systems/workshops';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'it_wealth',
  milestone: 2,
  seed: 'it-wealth',
  world: 'flat-test',
  embark: 'default',
  run: (w) => {
    w.step(20);
    const items = w.readers.of<ItemsReader>('13');
    const before = items.wealth();
    expect(w.game.world.fortress.wealthCached).toBe(before);
    for (let k = 0; k < 10; k += 1) w.spawnItem('table', 'granite', w.index(40 + k, 40, 32), 1, 1);
    expect(items.wealth() - before).toBe(80);
    w.step(10);
    expect(w.game.world.fortress.wealthCached - before).toBe(80);
    const mason = w.build('mason', w.index(15, 15, 32));
    const maker = w.spawnDwarf({ at: w.index(19, 17, 32), skills: { masonry: 0 } });
    w.step(1);
    const craftedBefore = items.wealth();
    const op = (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
    const crafted: number[] = [];
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: Parameters<typeof w.game.world.emit>[0]) => {
        if (event.type === 'ItemCrafted' && event['recipeId'] === 'make_table_stone') crafted.push(event['itemId'] as number);
        w.game.world.emit(event);
      } } as unknown as TickContext;
    for (let n = 0; n < 10; n += 1) {
      const raw = w.spawnItem('raw_stone', 'granite', w.index(19, 18, 32));
      op.producer().onComplete?.({ id: n + 1, workerId: maker, target: { kind: 'building', ref: mason },
        inputs: [{ filter: {}, count: 1, reserved: [raw], delivered: [raw] }],
        data: { recipe: 'make_table_stone', orderIndex: -1, globalOrder: false } } as unknown as Job, ctx);
    }
    expect(crafted).toHaveLength(10);
    const craftedValue = crafted.reduce((sum, id) => sum + items.value(id), 0);
    expect(items.wealth() - craftedBefore).toBe(craftedValue);
  },
};

export default scenario;
