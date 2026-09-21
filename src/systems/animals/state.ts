/**
 * 08 animals' saved state: `04-implementation/schemas/system-state.md` `AnimalsState`, and
 * `02-systems/08-animals-and-domestication.md` § State. Private to the system.
 *
 * Supersets: `dailyDue` (the `DayPassed` seen in step 4 is worked off in 08's own tick, D-089),
 * `provoked` (who attacked whom, which a `neutral` animal fears — 16 fills it in M6) and
 * `cavernTilesStale` (the cached walkable cavern floors, rebuilt on load; D-082).
 */

import type { RngState } from '@core/rng';
import type { EntityId } from '@core/types';

export interface SpeciesCount {
  wild: number;
  tame: number;
}

export interface AnimalsStateV1 {
  stateVersion: 1;
  breedingCaps: [number, number][];
  speciesCounts: [number, SpeciesCount][];
  nestBoxes: EntityId[];
  caged: [EntityId, EntityId][];
  rng: RngState;
  dailyDue: boolean;
  provoked: [EntityId, EntityId][];
  grazedPending: number[];
}
