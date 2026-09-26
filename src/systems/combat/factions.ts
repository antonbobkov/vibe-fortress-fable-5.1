/**
 * Combat factions and hostility rules: `02-systems/16-combat.md` § Concepts.
 */

import { C } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { EntityId } from '@core/types';

/**
 * Checks whether two faction strings are inherently hostile to each other.
 *
 * Rules from 16 § Concepts:
 * - `fortress` vs `hostile:*` and `deep` always
 * - `trader:*` vs `hostile:*` and `deep` always
 * - `deep` vs everyone always
 */
export function isFactionHostile(factionA: string, factionB: string): boolean {
  if (factionA === '' || factionB === '') return false;
  if (factionA === factionB) return false;
  if (factionA === 'deep' || factionB === 'deep') return true;

  if (factionA === 'fortress') {
    return factionB.startsWith('hostile') || factionB === 'deep';
  }
  if (factionB === 'fortress') {
    return factionA.startsWith('hostile') || factionA === 'deep';
  }

  if (factionA.startsWith('trader')) {
    return factionB.startsWith('hostile') || factionB === 'deep';
  }
  if (factionB.startsWith('trader')) {
    return factionA.startsWith('hostile') || factionA === 'deep';
  }

  return false;
}

/**
 * Checks whether creature `a` is hostile to creature `b`.
 * Considers factions, explicit targets, and animal attack states.
 */
export function isCreatureHostile(
  entities: EntityStore,
  a: EntityId,
  b: EntityId,
  targetOfFn?: (id: EntityId) => EntityId,
): boolean {
  if (a === b || a === 0 || b === 0) return false;
  if (!entities.alive(a) || !entities.alive(b)) return false;

  // Explicit target check
  if (targetOfFn) {
    if (targetOfFn(a) === b || targetOfFn(b) === a) return true;
  }

  const creatureA = entities.get(a, C.Creature);
  const creatureB = entities.get(b, C.Creature);
  if (!creatureA || !creatureB) return false;

  const fA = creatureA.faction;
  const fB = creatureB.faction;

  // Wild animals are hostile only while in 'attack' state (08)
  if (fA === 'wild') {
    const wild = entities.get(a, C.Wild);
    if (wild?.state === 'attack') return true;
    return false;
  }
  if (fB === 'wild') {
    const wild = entities.get(b, C.Wild);
    if (wild?.state === 'attack') return true;
    return false;
  }

  return isFactionHostile(fA, fB);
}
