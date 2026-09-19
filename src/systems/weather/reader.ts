/**
 * `readers.of('06')`: `02-systems/06-weather-and-seasons.md` § Interfaces › Reader.
 */

import type { ChunkIndex, TileIndex } from '@core/types';
import type { WeatherStateId } from './constants';

export interface WeatherReader {
  state(): WeatherStateId;
  /** The surface temperature of the current game hour (computed at the weather tick and cached). */
  surfaceTempC(): number;
  isDaylight(): boolean;
  /** Percent, season × state (07). */
  growthModifier(): number;
  /** Percent (10): `heatwave` 150, else 100. */
  thirstModifier(): number;
  /** Percent (18, 09): `fog` 50, else 100. */
  visibilityModifier(): number;
  /** Reads the `snow` flag. */
  isSnowCovered(i: TileIndex): boolean;
  /** Reads the `wet` flag. */
  isWet(i: TileIndex): boolean;
  /** The current state's remaining hours (no true forecast). */
  forecast(): number;
  /** The chunks with snow cover, ascending (23 redraws them; debug). */
  snowCoveredChunks(): readonly ChunkIndex[];
}
