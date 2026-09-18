/**
 * `it_value` of `04-implementation/acceptance-tests.md` § 13 Items: "masterwork steel breastplate |
 * value 4,000" (`items.md` § Value examples: 40 × 20 × 5.0).
 */

import { expect } from 'vitest';
import type { ItemsReader } from '@systems/items';
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
  },
};

export default scenario;
