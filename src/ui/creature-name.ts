/**
 * A creature's name as the screens show it (24 § Inspection): its own name, else its species' name
 * ("gloam captain", "cow"). Spawn gives a creature it names nothing its species' id as its
 * `Creature.name` (`gloam_captain`); saves and world hashes hold that, so the id stays in the data
 * and is read here as no name at all.
 */

import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';

interface SpeciesRow {
  readonly id: string;
  readonly name: string;
}

interface NamedCreature {
  readonly name: string;
  readonly species: number;
}

/** Whether a creature has a name of its own: not empty, and neither its species' id nor its species' name. */
export function hasOwnName(registry: Registry, c: NamedCreature | undefined): boolean {
  if (c === undefined || c.name === '') return false;
  const row = registry.table<SpeciesRow>('creatures').byIndex(c.species);
  return row === undefined || (c.name !== row.id && c.name !== row.name);
}

/** A creature's name as shown: its own, else its species' name ("gloam captain"); '' for none. */
export function creatureName(registry: Registry, c: NamedCreature | undefined): string {
  if (c === undefined) return '';
  if (hasOwnName(registry, c)) return c.name;
  return registry.table<SpeciesRow>('creatures').byIndex(c.species)?.name ?? c.name.replace(/_/g, ' ');
}

/** {@link creatureName} of a creature by its id; '' when it is no creature. */
export function creatureNameOf(readers: ReaderSet, registry: Registry, id: EntityId): string {
  return creatureName(registry, readers.entities.get(id, C.Creature));
}
