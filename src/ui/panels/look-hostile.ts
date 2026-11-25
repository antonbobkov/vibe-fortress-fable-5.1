/**
 * A hostile's sections in its view (18's `creature › hostile`, `ui-screens/fortress-screen.md` §
 * Inspection panel): party, role and state, each a dim label and a value, in the Threats panel's
 * words. `Party` names the party as the log does, with its members on the map and what it is doing
 * ("Gloam raid, 7 of 10, attacking"); `Morale` its morale in words while it has not broken; `Role`
 * the member's part in it ("archer", "captain, leads the party"); `Leader` the member that leads it,
 * a link; `State` "hostile", then "breaking a door", "carrying loot" and "lost its nerve" while they
 * hold. A creature the map hides (a stealthed hostile not yet spotted) is never counted, named or
 * linked: the view of one is not drawn at all (24 § Inspection).
 */

import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import type { ThreatsReader } from '@systems/threats';
import { partyCountWords, partyDoingWords, partyWords } from '../raid-lines';
import type { Strings } from '../strings';
import type { Span } from './look-links';

/** One row of the hostile's sections: its label's key and its value. */
export interface HostileField {
  readonly name: HostileFieldName;
  readonly value: readonly Span[];
}

/** Every label of the sections, in their order; `ui.look.hostile.field.<name>`. */
export const HOSTILE_FIELDS = ['party', 'morale', 'role', 'leader', 'state'] as const;
export type HostileFieldName = (typeof HOSTILE_FIELDS)[number];

interface HostileContext {
  readonly readers: ReaderSet;
  readonly registry: Registry;
  readonly strings: Strings;
  /** Whether the map draws a creature (look.ts's `creatureShown`); a link goes only to one it does. */
  readonly shown: (id: EntityId) => boolean;
}

/** A member stealth still hides: stealthed and not spotted (18 § Stealth). */
function hidden(readers: ReaderSet, id: EntityId): boolean {
  const h = readers.entities.get(id, C.Hostile);
  return h?.stealthed === true && h.spotted !== true;
}

/** The member's part in its party in words; a role with no words reads as itself. */
function roleWords(strings: Strings, role: string): string {
  const key = `ui.look.hostile.role.${role}`;
  return strings.has(key) ? strings.get(key) : role.replace(/_/g, ' ');
}

/** A creature by a name of its own, else by its species's name ("gloam captain"), a link to its view. */
function creatureSpan(ctx: HostileContext, id: EntityId): Span[] {
  const c = ctx.readers.entities.get(id, C.Creature);
  const row = c === undefined ? undefined : ctx.registry.table<{ id: string; name: string }>('creatures').byIndex(c.species);
  // A creature called by its species carries the species's id as its name (spawn's default).
  const own = c !== undefined && c.name !== '' && c.name !== row?.id;
  return [{ text: own ? c.name : row?.name ?? c?.name ?? '', target: { kind: 'creature', id } }];
}

/**
 * The rows of a hostile's sections, in the inspector list's order; none for a creature that is not
 * hostile, or that the map hides.
 */
export function hostileFields(ctx: HostileContext, id: EntityId): HostileField[] {
  const { readers, strings } = ctx;
  const hostile = readers.entities.get(id, C.Hostile);
  if (hostile === undefined || hidden(readers, id)) return [];
  const out: HostileField[] = [];
  const row = (name: HostileFieldName, value: readonly Span[]): void => { out.push({ name, value }); };
  const text = (value: string): Span[] => [{ text: value }];
  const threats = readers.has('18') ? readers.of<ThreatsReader>('18') : null;
  const party = hostile.partyId !== 0 ? threats?.party(hostile.partyId) : undefined;
  if (party !== undefined && threats !== null) {
    // The Threats panel's words, counting only the members the map does not hide.
    const count = partyCountWords(strings, readers, party, (m) => !hidden(readers, m));
    row('party', text(strings.get('ui.look.hostile.party', { party: partyWords(strings, ctx.registry, party), count, doing: partyDoingWords(strings, readers, party) })));
    const morale = party.state === 'retreat' ? '' : threats.moraleWord(hostile.partyId);
    if (morale !== '') row('morale', text(morale));
  }
  const role = roleWords(strings, hostile.role);
  const leads = party !== undefined && party.leaderId === id;
  row('role', text(leads ? strings.get('ui.look.hostile.leads', { role }) : role));
  if (party !== undefined && !leads && party.leaderId !== 0 && readers.entities.alive(party.leaderId) && ctx.shown(party.leaderId)) {
    row('leader', creatureSpan(ctx, party.leaderId));
  }
  const state = [strings.get('ui.look.hostile.hostile')];
  if (hostile.breakingDoorId !== 0) state.push(strings.get('ui.look.hostile.door'));
  const carries = party !== undefined && party.loot.some((item) => (readers.entities.get(item, C.Item)?.carriedBy ?? party.animalCarriers?.[item] ?? 0) === id);
  if (carries) state.push(strings.get('ui.look.hostile.loot'));
  if (hostile.nerveLost === true) state.push(strings.get('ui.look.hostile.nerve'));
  row('state', text(state.join(', ')));
  return out;
}
