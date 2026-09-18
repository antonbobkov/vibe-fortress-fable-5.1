/**
 * `it_wealth` of `04-implementation/acceptance-tests.md` § 13 Items: "craft 10 common granite
 * tables | wealth rises by 80 (2 × 4 × 10)". Crafting is 12's (M5), so the ten tables are spawned
 * by hand through the spawn API, which is where a crafted item enters the world too (T-M2-01:
 * "`it_wealth` (with hand-spawned items)").
 */

import { expect } from 'vitest';
import type { ItemsReader } from '@systems/items';
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
  },
};

export default scenario;
