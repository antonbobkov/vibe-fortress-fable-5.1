/**
 * `readers.of('08')`: `02-systems/08-animals-and-domestication.md` § Interfaces › Reader. Records
 * and arrays returned are fresh copies; entity references are ids.
 */

import type { EntityId } from '@core/types';
import type { SpeciesRow } from './facts';

export interface AnimalsReader {
  isWild(id: EntityId): boolean;
  isTame(id: EntityId): boolean;
  /** The `Wild.state` of a wild animal, or `''`. */
  state(id: EntityId): string;
  /** Tame animals, ascending id. */
  tameList(): EntityId[];
  /** Wild animals, ascending id. */
  wildList(): EntityId[];
  /** The animals of a species; `wild` omitted means both. */
  bySpecies(species: number | string, wild?: boolean): EntityId[];
  pastureOf(id: EntityId): EntityId;
  condition(id: EntityId): number;
  assignedTo(id: EntityId): EntityId;
  /** Whether the animal currently treats the fortress as a threat (16 reads it for hostility). */
  threatTo(id: EntityId): boolean;
  def(species: number | string): SpeciesRow | undefined;
  /** The live cap of a wild species in this region (`creatures.md` and the region traits). */
  capOf(species: number | string): number;
  /** The player's breeding cap for a species (`BREEDING_CAP_DEFAULT` until set). */
  breedingCap(species: number | string): number;
  /** Nest box buildings, ascending id. */
  nestBoxes(): EntityId[];
}
