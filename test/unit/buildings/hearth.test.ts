import { describe, expect, it } from 'vitest';
import { MOOD_BASELINE } from '@core/constants';
import { moodValue } from '@systems/morale';

describe('T-M4-14 hearth hall bonus', () => {
  it('adds two mood for each hall tier from bare through royal', () => {
    for (let tier = 0; tier <= 5; tier += 1) {
      expect(moodValue([], tier, 0)).toBe(MOOD_BASELINE + 2 * tier);
    }
  });
});
