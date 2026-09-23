import { describe, expect, it } from 'vitest';
import { RngStream } from '@core/rng';
import { qualityForRoll, rollQuality } from '@systems/workshops';

describe('T-M4-08 workshops quality', () => {
  it('uses the six exact roll intervals', () => {
    expect([29, 30, 54, 55, 74, 75, 89, 90, 104, 105].map((r) => qualityForRoll(0, r)))
      .toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });

  it('matches the quality distribution over 2,000 rolls at levels 0, 6, 13 and 20', () => {
    for (const level of [0, 6, 13, 20]) {
      const rng = RngStream.forStream('quality-distribution', String(level));
      const counts = [0, 0, 0, 0, 0, 0];
      for (let n = 0; n < 2000; n += 1) {
        const tier = rollQuality(level, rng);
        counts[tier] = (counts[tier] ?? 0) + 1;
      }
      for (let q = 0; q < 6; q += 1) {
        let expected = 0;
        for (let r = 0; r <= 40; r += 1) if (qualityForRoll(level, r) === q) expected += 1;
        expect(Math.abs((counts[q] as number) / 2000 - expected / 41)).toBeLessThanOrEqual(0.03);
      }
    }
  });
});
