import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { moodValue } from '@systems/morale';

describe('T-M4-13 property: mood bounds', () => {
  it('stays within 0..100 for arbitrary thought values, needs, room tier and personality base', () => {
    fc.assert(fc.property(
      fc.array(fc.record({ value: fc.integer({ min: -100, max: 100 }), need: fc.boolean() }), { maxLength: 40 }),
      fc.integer({ min: 0, max: 5 }), fc.integer({ min: -6, max: 6 }),
      (thoughts, tier, base) => {
        const mood = moodValue(thoughts, tier, base);
        expect(mood).toBeGreaterThanOrEqual(0);
        expect(mood).toBeLessThanOrEqual(100);
      },
    ), { seed: 1314, numRuns: 200 });
  });
});
