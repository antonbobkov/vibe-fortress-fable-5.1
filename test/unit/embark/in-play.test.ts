import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { C } from '@core/components';
import type { AnimalsReader } from '@systems/animals';
import type { ItemsReader } from '@systems/items';

describe('T-M4-16 embarked supplies and animals in play', () => {
  it('exposes purchased animals through 08 and supplies through 13 after arrival and ticks', () => {
    const game = new HeadlessGame({ seed: 'embark-in-play', world: 'flat-test', embark: 'default' });
    const animals = game.world.readers.of<AnimalsReader>('08');
    const items = game.world.readers.of<ItemsReader>('13');
    const arrived = game.arrival?.animals ?? [];
    expect(arrived).toHaveLength(3);
    expect(animals.tameList()).toEqual(arrived);
    for (const id of arrived) {
      expect(animals.isTame(id)).toBe(true);
      expect(animals.pastureOf(id)).toBe(0);
      expect(game.world.entities.get(id, C.Creature)?.faction).toBe('fortress');
    }
    expect(items.count('pick')).toBe(2);
    game.step(100);
    expect(arrived.every((id) => game.world.entities.alive(id))).toBe(true);
    expect(items.count('pick')).toBe(2);
  });
});
