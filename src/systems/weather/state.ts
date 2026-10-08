/**
 * 06 Weather's saved state: `04-implementation/schemas/system-state.md` `WeatherState`, and
 * `02-systems/06-weather-and-seasons.md` § State.
 *
 * Supersets (docs/archive/decisions-archive.md D-101): `started` (the initial `clear` has had its duration rolled),
 * `forced` (`TestWorld.forceWeather`: a state held until released, or null), `rainHours`
 * (consecutive rain or storm hours, for "mud … with rain for 2+ hours"), `isDaylightCached`.
 *
 * Private to the system (`module-interfaces.md` § Interface stability).
 */

import type { RngState } from '@core/rng';
import type { ChunkIndex, Tick } from '@core/types';

export interface WeatherStateV1 {
  stateVersion: 1;
  state: string;
  stateEndsTick: Tick;
  surfaceTempCached: number;
  growthModifierCached: number;
  snowCoveredChunks: ChunkIndex[];
  wetChunks: [ChunkIndex, Tick][];
  rng: RngState;
  started: boolean;
  forced: string | null;
  rainHours: number;
  isDaylightCached: boolean;
}
