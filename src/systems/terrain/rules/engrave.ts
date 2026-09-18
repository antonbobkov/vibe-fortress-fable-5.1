/**
 * Engraving quality: `03` § Tile transitions, `engrave`: "quality from the engraver's skill is
 * stored in a side table". The roll is 12's quality roll (`algorithms/economy.md` `rollQuality`),
 * the one rule the specification has for quality from skill (D-058).
 */

import type { RngStream } from '@core/rng';
import type { Quality } from '@core/types';

/** `rollQuality(level)`: `roll = level × 5 + rng.int(0, 40)`, then the tier thresholds 30/55/75/90/105. */
export function rollQuality(level: number, rng: RngStream): Quality {
  const roll = level * 5 + rng.int(0, 40);
  return roll < 30 ? 0 : roll < 55 ? 1 : roll < 75 ? 2 : roll < 90 ? 3 : roll < 105 ? 4 : 5;
}
