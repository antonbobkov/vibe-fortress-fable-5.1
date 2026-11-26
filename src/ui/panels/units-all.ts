/**
 * The Units panel's All tab (T-678, `ui-screens/panels.md` § Units): every creature the map draws,
 * dwarves, tame and wild animals, visitors and hostiles, one row each with one fact. A stealthed
 * hostile no dwarf has spotted is not listed, as the map does not draw it ({@link creatureShown});
 * the dead are not creatures any more.
 */

import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import type { HealthReader } from '@systems/health';
import { creatureName, hasOwnName } from '../creature-name';
import type { Strings } from '../strings';
import type { PanelContext } from './context';
import { creatureShown } from './look';
import { isDown, unitsActivity } from './units';

/** The kinds of creature, in the All tab's order (the owner's: dwarves, tame, wild, visitors, hostiles), then the rest. */
export const CREATURE_KINDS = ['dwarf', 'tame', 'wild', 'visitor', 'hostile', 'other'] as const;
export type CreatureKind = (typeof CREATURE_KINDS)[number];

export interface CreatureRow {
  readonly id: EntityId;
  readonly kind: CreatureKind;
  /** The name the row shows: a creature's own name, its species' for one without ("cow"), or both for a named animal ("dog Bramble"). */
  readonly name: string;
}

interface SpeciesRow {
  readonly id: string;
  readonly name: string;
  readonly glyph?: string;
}

/**
 * What a creature is to the fortress: a dwarf of the fortress, a hostile (a raider, a cavern
 * monster, a turned shade), a visitor (a caravan's merchants, guards and pack animals, `trader:*`),
 * a tame or wild animal, or anything else (a summons).
 */
export function creatureKind(readers: ReaderSet, id: EntityId, dwarves: ReadonlySet<EntityId>): CreatureKind {
  if (dwarves.has(id)) return 'dwarf';
  const e = readers.entities;
  if (e.has(id, C.Hostile)) return 'hostile';
  if ((e.get(id, C.Creature)?.faction ?? '').startsWith('trader:')) return 'visitor';
  if (e.has(id, C.Tame)) return 'tame';
  if (e.has(id, C.Wild)) return 'wild';
  return 'other';
}

function dwarfSet(readers: ReaderSet): Set<EntityId> {
  return new Set(readers.has('10') ? readers.of<{ list(): EntityId[] }>('10').list() : []);
}

/**
 * Every creature the map draws, by kind, then name, then id. One pass over the creatures with a
 * place; the facts are left to the rows drawn.
 */
export function allCreatures(readers: ReaderSet, registry: Registry): CreatureRow[] {
  const dwarves = dwarfSet(readers);
  const species = registry.table<SpeciesRow>('creatures');
  const out: CreatureRow[] = [];
  for (const id of readers.entities.with(C.Creature, C.Position)) {
    if (!creatureShown(readers, id)) continue;
    const kind = creatureKind(readers, id, dwarves);
    const c = readers.entities.get(id, C.Creature);
    const def = species.byIndex(c?.species ?? -1);
    const animal = kind === 'tame' || kind === 'wild';
    const name = !hasOwnName(registry, c) || !animal || def === undefined ? creatureName(registry, c) : `${def.name} ${c?.name ?? ''}`;
    out.push({ id, kind, name });
  }
  const order = (k: CreatureKind): number => CREATURE_KINDS.indexOf(k);
  return out.sort((a, b) => order(a.kind) - order(b.kind) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || a.id - b.id);
}

/** How many creatures of each kind a list holds. */
export function kindCounts(rows: readonly CreatureRow[]): Map<CreatureKind, number> {
  const out = new Map<CreatureKind, number>();
  for (const r of rows) out.set(r.kind, (out.get(r.kind) ?? 0) + 1);
  return out;
}

/** The species glyph the map draws for a creature. */
export function creatureGlyph(readers: ReaderSet, registry: Registry, id: EntityId): string {
  const c = readers.entities.get(id, C.Creature);
  return Array.from(registry.table<SpeciesRow>('creatures').byIndex(c?.species ?? -1)?.glyph ?? '?')[0] ?? '?';
}

/** A creature's state in words: "grazing", "attacking"; the raw state, spaced, when it has no words. */
export function stateWords(strings: Strings, state: string): string {
  const key = `ui.units.state.${state}`;
  return strings.has(key) ? strings.get(key) : state.replace(/_/g, ' ');
}

export function isWounded(readers: ReaderSet, id: EntityId): boolean {
  return readers.has('17') && readers.of<HealthReader>('17').isWounded(id);
}

/**
 * The one fact of a row (`panels.md` § Units): a dwarf's activity as the Dwarves tab gives it;
 * "Tame" or "Pet"; "Wild, grazing"; "Merchant" or "Caravan"; "Hostile, attacking"; "Summoned";
 * ", unconscious" in place of the state, or after the fact, for a creature that is down ("Wild,
 * unconscious", "Pet, unconscious"); then "· hurt" for a wounded creature.
 */
export function creatureFact(ctx: PanelContext, row: CreatureRow): string {
  const { readers, strings } = ctx;
  const e = readers.entities;
  const id = row.id;
  let fact = '';
  if (row.kind === 'dwarf') fact = unitsActivity(ctx, id);
  else if (row.kind === 'tame') fact = strings.get((e.get(id, C.Tame)?.petOf ?? 0) !== 0 ? 'ui.units.fact.pet' : 'ui.units.fact.tame');
  else if (row.kind === 'visitor') fact = strings.get(e.has(id, C.Merchant) ? 'ui.units.fact.merchant' : 'ui.units.fact.caravan');
  else if (row.kind === 'wild' || row.kind === 'hostile') {
    const state = row.kind === 'wild' ? e.get(id, C.Wild)?.state ?? '' : e.get(id, C.Hostile)?.behaviorState ?? '';
    fact = state === ''
      ? strings.get(`ui.units.fact.${row.kind}`)
      : strings.get(`ui.units.fact.${row.kind}_state`, { state: stateWords(strings, state) });
  } else if (e.has(id, C.Summoned)) fact = strings.get('ui.units.fact.summoned');
  // A creature that is down says so, over the state it was in when it fell ("Wild, unconscious").
  if (row.kind !== 'dwarf' && isDown(ctx, id)) {
    const kind = row.kind === 'wild' || row.kind === 'hostile' ? strings.get(`ui.units.fact.${row.kind}`) : fact;
    fact = kind === '' ? strings.get('ui.units.down') : strings.get('ui.units.fact.down', { fact: kind });
  }
  if (!isWounded(readers, id)) return fact;
  return fact === '' ? strings.get('ui.units.fact.hurt_only') : strings.get('ui.units.fact.hurt', { fact });
}
