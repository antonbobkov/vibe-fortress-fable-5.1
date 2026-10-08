import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import type { DwarvesReader } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import { RENOWN_POP_WEIGHT, RENOWN_WEALTH_DIVISOR } from '@systems/threats/constants';
import type { ThreatsReader } from '@systems/threats/reader';
import { TestWorld } from '../../scenarios/test-world';

/** `18` § Renown: `renown = wealth / RENOWN_WEALTH_DIVISOR + dwarf population × RENOWN_POP_WEIGHT`. */
describe('F-17c renown counts dwarves, not animals', () => {
  it('tame animals add nothing to renown; each dwarf adds RENOWN_POP_WEIGHT', () => {
    const w = new TestWorld({ seed: 'f17-renown', world: 'flat-test', embark: 'none' });
    const threats = w.readers.of<ThreatsReader>('18');
    const dwarves = w.readers.of<DwarvesReader>('10');
    const items = w.readers.of<ItemsReader>('13');
    for (let k = 0; k < 3; k += 1) w.spawnDwarf({ at: w.index(10 + k, 10, 32) });
    w.step(TICKS_PER_DAY + 1);
    expect(dwarves.population()).toBe(3);
    const wealth = items.wealth();
    expect(threats.renown()).toBeCloseTo(wealth / RENOWN_WEALTH_DIVISOR + 3 * RENOWN_POP_WEIGHT, 6);

    // Five fortress animals: the creature count is 8, the dwarf population still 3.
    for (const [k, species] of ['dog', 'dog', 'cat', 'cow', 'sheep'].entries()) w.spawnTame(species, w.index(10 + k, 14, 32));
    w.step(TICKS_PER_DAY);
    expect(dwarves.population()).toBe(3);
    expect(items.wealth()).toBe(wealth);
    expect(threats.renown()).toBeCloseTo(wealth / RENOWN_WEALTH_DIVISOR + 3 * RENOWN_POP_WEIGHT, 6);
    expect(threats.renown()).not.toBeCloseTo(wealth / RENOWN_WEALTH_DIVISOR + 8 * RENOWN_POP_WEIGHT, 6);

    // A fourth dwarf does count.
    w.spawnDwarf({ at: w.index(14, 10, 32) });
    w.step(TICKS_PER_DAY);
    expect(threats.renown()).toBeCloseTo(items.wealth() / RENOWN_WEALTH_DIVISOR + 4 * RENOWN_POP_WEIGHT, 6);
  });
});
