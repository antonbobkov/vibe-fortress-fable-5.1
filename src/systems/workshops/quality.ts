import type { RngStream } from '@core/rng';
import type { Quality } from '@core/types';

/** `12` § Quality; `economy.md` § Workshop operation. */
export function qualityForRoll(level: number, draw: number): Quality {
  const roll = level * 5 + draw;
  return (roll < 30 ? 0 : roll < 55 ? 1 : roll < 75 ? 2 : roll < 90 ? 3 : roll < 105 ? 4 : 5) as Quality;
}

/** The roll's draw is `rng.int(0, 40)`: 40 is its highest. */
const DRAW_MAX = 40;

export function rollQuality(level: number, rng: Pick<RngStream, 'int'>): Quality {
  return qualityForRoll(level, rng.int(0, DRAW_MAX));
}

/** The best quality a crafter of this level can roll: its highest draw (`10` § The Thane's whim). */
export function bestQuality(level: number): Quality {
  return qualityForRoll(level, DRAW_MAX);
}

