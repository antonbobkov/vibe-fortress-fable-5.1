/**
 * The words of a raid's coming and going: the threats panel's "Coming" line, the line of a raid's
 * end with its counts, what a thief or a raider escaped with, and the note that the alert can come
 * down (18 § Player-facing behavior, `ui-screens/panels.md` § Threats).
 */

import { dayIndexOf } from '@core/calendar';
import { C, type Party } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { CombatReader } from '@systems/combat';
import type { ComingParty, ThreatsReader } from '@systems/threats';
import type { Said } from './announcements';
import { capitalize, materialItemName, speciesPlural, withArticle } from './messages';
import type { Strings } from './strings';

interface NamedRow {
  readonly id: string;
  readonly name: string;
  readonly plural?: string;
  readonly category?: string;
}

/** How many goods of one name a theft line lists before "and n more". */
const THEFT_GROUPS_LISTED = 3;

/** A civilization by its name without the article, as the panels write it ("Gloam", "Hillfolk"). */
export function civWords(registry: Registry, civ: string): string {
  const name = registry.hasTable('civilizations') ? registry.table<NamedRow>('civilizations').byId(civ)?.name ?? civ : civ;
  return capitalize(name.replace(/^the /, ''));
}

/** "tomorrow", "today", "in 3 days": when a tick comes, counted in days from `now`. */
export function whenWords(strings: Strings, tick: number, now: number): string {
  const days = dayIndexOf(tick) - dayIndexOf(now);
  if (days <= 0) return strings.get('ui.threats.when_today');
  if (days === 1) return strings.get('ui.threats.when_tomorrow');
  return strings.get('ui.threats.when_days', { n: days });
}

/**
 * When a warned party comes, as the Coming line says it ("tomorrow", or "today" when fog shortened
 * the lead): the party of the warning's kind, civilization and edge that 18 lists as coming.
 * "tomorrow" when 18 lists none.
 */
export function warningWhen(strings: Strings, readers: ReaderSet, warning: Readonly<Record<string, unknown>>): string {
  const coming = readers.has('18')
    ? readers.of<ThreatsReader>('18').coming().filter((c) => c.kind === warning['kind'] && c.civ === warning['civ'] && c.edge === warning['edge']).pop()
    : undefined;
  return coming === undefined ? strings.get('ui.threats.when_tomorrow') : whenWords(strings, coming.arrivalTick, readers.calendar.tick);
}

/** A warning's size band as a noun: "a few", "a band", "a horde" (18 § Arrival and warning). */
export function sizeWords(strings: Strings, sizeBand: string): string {
  return strings.has(`ui.threats.size.${sizeBand}`) ? strings.get(`ui.threats.size.${sizeBand}`) : sizeBand;
}

/**
 * The threats panel's line for a warned party: "Coming: a horde of Gloam from the north, tomorrow.",
 * "Coming: a Gloam siege, a horde, from the east, in 2 days." The size is the warning's band, never a count.
 */
export function comingText(strings: Strings, registry: Registry, coming: ComingParty, now: number): string {
  const civ = civWords(registry, coming.civ);
  const edge = strings.has(`ui.edge.${coming.edge}`) ? strings.get(`ui.edge.${coming.edge}`) : coming.edge;
  const when = whenWords(strings, coming.arrivalTick, now);
  if (coming.kind === 'siege') return strings.get('ui.threats.coming_siege', { civ, band: sizeWords(strings, coming.sizeBand), edge, when });
  return strings.get('ui.threats.coming', { party: strings.get(`ui.threats.band_${coming.sizeBand}`, { civ }), edge, when });
}

/** A party by its purpose in a line: "Gloam raid", "Gloam siege", "bandit raid", "ambush", "thief", "restless dead". */
export function partyWords(strings: Strings, registry: Registry, party: Party): string {
  const key = `announce.party.${party.purpose}`;
  return strings.has(key) ? strings.get(key, { civ: civWords(registry, party.civ) }) : strings.get('announce.party.raid', { civ: civWords(registry, party.civ) });
}

/** A member still on the map: alive and not caught in a cage (18 § Party AI). */
function onMap(readers: ReaderSet, m: number): boolean {
  return readers.entities.alive(m) && (readers.entities.get(m, C.Creature)?.cagedIn ?? 0) === 0;
}

/**
 * What a party is doing, in words: approach "coming", engage "attacking", loiter "waiting" (or
 * "looting" while a member on the map holds some of its loot), retreat "leaving". A state with no
 * word reads as itself.
 */
export function partyDoingWords(strings: Strings, readers: ReaderSet, party: Party): string {
  if (party.state === 'loiter') {
    const holding = party.loot.some((id) => {
      const carrier = readers.entities.get(id, C.Item)?.carriedBy ?? party.animalCarriers?.[id] ?? 0;
      return carrier !== 0 && party.members.includes(carrier) && onMap(readers, carrier);
    });
    if (holding) return strings.get('ui.threats.doing.looting');
  }
  const key = `ui.threats.doing.${party.state}`;
  return strings.has(key) ? strings.get(key) : party.state;
}

/** A member the map shows: not stealthed, or spotted (18 § Stealth). One it hides is never counted. */
export function memberShown(readers: ReaderSet, m: number): boolean {
  const h = readers.entities.get(m, C.Hostile);
  return h?.stealthed !== true || h.spotted === true;
}

/**
 * The threats panel's line for a party in view, named as the log names it, with the members still
 * on the map ("7 of 10" when some are dead, fled or caged) and what it is doing: "Active: Gloam
 * raid, 7 of 10, attacking", "Active: bandit raid, 4, looting". A member the map hides is left out
 * of both numbers, as in Look's `Party` row: a thief pair with one spotted reads "thief, 1, coming".
 */
export function partyActiveText(strings: Strings, registry: Registry, readers: ReaderSet, party: Party): string {
  const count = partyCountWords(strings, readers, party, (m) => memberShown(readers, m));
  return strings.get('ui.threats.active_party', { party: partyWords(strings, registry, party), count, doing: partyDoingWords(strings, readers, party) });
}

/**
 * What a party in view is made of, by species, counted: "6 warriors, 3 archers, 2 trollkin, a
 * captain, a hexer" (the species' names less the party's civilization, which the Active line
 * names). Only the members the Active line counts are in it: on the map and shown. The kinds come
 * most first, and kinds of as many in the creature table's order. '' when none is left.
 */
export function partyMakeupText(strings: Strings, registry: Registry, readers: ReaderSet, party: Party): string {
  const creatures = registry.table<NamedRow>('creatures');
  const kinds = new Map<number, number>();
  for (const m of party.members) {
    if (!memberShown(readers, m) || !onMap(readers, m)) continue;
    const species = readers.entities.get(m, C.Creature)?.species;
    if (species !== undefined) kinds.set(species, (kinds.get(species) ?? 0) + 1);
  }
  const prefix = `${civWords(registry, party.civ).toLowerCase()} `;
  const bare = (name: string): string => (name.startsWith(prefix) && name.length > prefix.length ? name.slice(prefix.length) : name);
  return [...kinds]
    .sort(([a, na], [b, nb]) => nb - na || a - b)
    .map(([species, n]) => {
      const row = creatures.byIndex(species);
      return n === 1 ? withArticle(strings, bare((row?.name ?? strings.get('ui.creature.unknown')).toLowerCase())) : `${n} ${bare(speciesPlural(row))}`;
    })
    .join(', ');
}

/**
 * How many of a party's members are still on the map: "10", or "7 of 10" when some are dead, fled
 * or caged. Only the members `counted` keeps are counted (Look leaves out those the map hides).
 */
export function partyCountWords(strings: Strings, readers: ReaderSet, party: Party, counted: (m: number) => boolean = () => true): string {
  const members = party.members.filter(counted);
  const total = members.length;
  const here = members.filter((m) => onMap(readers, m)).length;
  return here === total ? String(total) : strings.get('ui.threats.party_of', { n: here, total });
}

/** "14 goods", "a stolen item". */
function goodsWords(strings: Strings, n: number): string {
  return n === 1 ? strings.get('announce.goods_one') : strings.get('announce.goods', { n });
}

/**
 * `RaidEnded` by its outcome, with the party's counts: "The Gloam raid is over: 6 raiders fled
 * with 14 goods, 3 fell.", "The Gloam raid was driven off: 4 raiders fled, 5 fell, 1 caught.",
 * "The Gloam siege was destroyed: all 22 fell.", "The bandit raid has withdrawn: 5 raiders left
 * empty-handed." A thief's end says only that it went with nothing (its theft has its own line);
 * the restless dead go back to their rest. Null when the party is gone from the readers, which
 * keeps the plain line. The words come with their string key (T-725).
 */
export function raidEndedText(strings: Strings, registry: Registry, readers: ReaderSet, partyId: number, outcome: string): Said | null {
  if (!readers.has('18')) return null;
  const party = readers.of<ThreatsReader>('18').party(partyId);
  if (party === undefined) return null;
  const said = (key: string, params: Readonly<Record<string, string | number>> = {}): Said => ({ key, text: strings.get(key, params) });
  if (party.purpose === 'thief') return outcome === 'looted' ? null : said('announce.raid_ended.thief');
  if (party.purpose === 'restless') return said('announce.raid_ended.restless');
  const total = party.members.length;
  const fled = Math.min(total, party.despawnedCount ?? 0);
  // A member still on the map when its party ended is in a cage (18 § Party AI): caught, not fled or fallen.
  const caught = party.members.filter((m) => readers.entities.alive(m) && (readers.entities.get(m, C.Creature)?.cagedIn ?? 0) !== 0).length;
  const fell = Math.max(0, total - fled - caught);
  const goods = party.escapedLootCount ?? 0;
  const raiders = (n: number): string => strings.get(n === 1 ? 'announce.raid_ended.raider' : 'announce.raid_ended.raiders', { n });
  const parts: string[] = [];
  if (fled > 0) {
    if (goods > 0) parts.push(strings.get('announce.raid_ended.fled_with', { who: raiders(fled), goods: goodsWords(strings, goods) }));
    else if (outcome === 'withdrew') parts.push(strings.get('announce.raid_ended.left', { who: raiders(fled) }));
    else parts.push(strings.get('announce.raid_ended.fled', { who: raiders(fled) }));
  }
  if (fell > 0) {
    if (fell === total && total > 1) parts.push(strings.get('announce.raid_ended.all_fell', { n: fell }));
    else parts.push(strings.get(parts.length === 0 ? 'announce.raid_ended.fell_first' : 'announce.raid_ended.fell', { n: fell, who: raiders(fell) }));
  }
  if (caught > 0) parts.push(strings.get(parts.length === 0 ? 'announce.raid_ended.caught_first' : 'announce.raid_ended.caught', { n: caught, who: raiders(caught) }));
  const key = `announce.raid_ended.${outcome}`;
  if (parts.length === 0 || !strings.has(key)) return null;
  return said(key, { party: partyWords(strings, registry, party), counts: parts.join(', ') });
}

/** The kinds of `RaidArrived` that are announced (a thief comes unseen), and `AmbushSprung`: a raid at the fortress. */
const ARRIVED_KINDS: readonly unknown[] = ['raid', 'siege', 'bandits'];

/** Whether an event is a raid's danger line: `RaidArrived` of a raid, a siege or bandits, or `AmbushSprung`. */
export function raidArrival(event: Readonly<Record<string, unknown>>): boolean {
  return event['type'] === 'AmbushSprung' || (event['type'] === 'RaidArrived' && ARRIVED_KINDS.includes(event['kind']));
}

/**
 * 18 § Registrations: what a raid's or an ambush's danger line adds while the alert is Calm, with
 * the player's keys: "The alert is Calm: [m] [3] sends the civilians to shelter.", and, while no
 * squad with members is Active, "…; Active [v] sends the squads.", or with no such squad at all
 * "…; [m] [+] makes a squad.". Null under Watch or Hearth, when every squad stands to already.
 */
export function calmTail(strings: Strings, readers: ReaderSet): string | null {
  if (!readers.has('16')) return null;
  const combat = readers.of<CombatReader>('16');
  if (combat.alert() !== 'calm') return null;
  const manned = combat.squads().filter((squad) => squad.members.length > 0);
  const key = manned.length === 0 ? 'announce.raid_calm_tail.no_squad'
    : manned.some((squad) => squad.mode === 'active') ? 'announce.raid_calm_tail' : 'announce.raid_calm_tail.squads';
  return strings.get(key);
}

/**
 * Whether a raid's end leaves the alert up with nothing to raise it for: the alert is Watchful or
 * Hearth, the party that ended was no thief's, and no other threat party but a thief is still on
 * the map.
 */
export function raidGone(readers: ReaderSet, partyId: number): boolean {
  if (!readers.has('18') || !readers.has('16')) return false;
  if (readers.of<CombatReader>('16').alert() === 'calm') return false;
  const threats = readers.of<ThreatsReader>('18');
  const ended = threats.party(partyId);
  if (ended !== undefined && (ended.purpose === 'thief' || ended.purpose === 'caravan')) return false;
  return threats.activeParties().every((id) => {
    if (id === partyId) return true;
    const p = threats.party(id);
    return p === undefined || p.state === 'gone' || p.purpose === 'thief' || p.purpose === 'caravan';
  });
}

/** One stolen thing as `ThiefEscaped` names it: its name, singular, and how many. */
export interface Stolen {
  readonly name: string;
  readonly plural: string;
  readonly n: number;
}

/** What one `ThiefEscaped` took, from the event's content ids (the item is gone when the line is made). */
export function stolenOf(registry: Registry, fields: Readonly<Record<string, unknown>>): Stolen | null {
  const species = fields['species'];
  if (typeof fields['animalId'] === 'number' && typeof species === 'string' && species !== '') {
    const name = (registry.table<NamedRow>('creatures').byId(species)?.name ?? species.replace(/_/g, ' ')).toLowerCase();
    return { name, plural: name, n: 1 };
  }
  const type = fields['itemType'];
  if (typeof type !== 'string' || type === '') return null;
  const row = registry.table<NamedRow>('items').byId(type) ?? { id: type, name: type.replace(/_/g, ' ') };
  const materialId = fields['material'];
  const material = typeof materialId === 'string' && materialId !== '' ? registry.table<NamedRow>('materials').byId(materialId)?.name ?? '' : '';
  const n = typeof fields['count'] === 'number' && fields['count'] > 0 ? fields['count'] : 1;
  return { name: materialItemName(material, row, 1), plural: materialItemName(material, row, 2), n };
}

/**
 * The goods of a theft line: one kind by itself ("an iron short sword", "6 iron bars"); more,
 * counted and listed by kind in the order they went, up to {@link THEFT_GROUPS_LISTED} ("14 goods:
 * iron bars ×6, oak logs ×7 and an iron short sword", "… and 2 more").
 */
export function stolenGoodsText(strings: Strings, stolen: readonly Stolen[]): string {
  const groups: Stolen[] = [];
  for (const s of stolen) {
    const at = groups.findIndex((g) => g.name === s.name);
    if (at < 0) groups.push({ ...s });
    else groups[at] = { ...groups[at] as Stolen, n: (groups[at] as Stolen).n + s.n };
  }
  const total = groups.reduce((sum, g) => sum + g.n, 0);
  const only = groups.length === 1 ? groups[0] : undefined;
  if (only !== undefined) return only.n === 1 ? withArticle(strings, only.name) : `${only.n} ${only.plural}`;
  const word = (g: Stolen): string => g.n === 1 ? withArticle(strings, g.name) : strings.get('announce.theft.many_of', { n: g.n, name: g.plural });
  const shown = groups.slice(0, THEFT_GROUPS_LISTED).map(word);
  const rest = groups.length - shown.length;
  const list = rest > 0
    ? strings.get('announce.list_and', { list: shown.join(', '), last: strings.get('announce.theft.more', { n: rest }) })
    : strings.get('announce.list_and', { list: shown.slice(0, -1).join(', '), last: shown[shown.length - 1] as string });
  return strings.get('announce.theft.goods', { n: total, list });
}

/** Who escaped, by the party's purpose: a thief, bandits, or raiders (a raid, a siege, an ambush). */
export function theftKey(readers: ReaderSet, partyId: unknown): string {
  const purpose = typeof partyId === 'number' && readers.has('18') ? readers.of<ThreatsReader>('18').party(partyId)?.purpose : undefined;
  if (purpose === undefined || purpose === 'thief') return 'announce.thief_escaped';
  return purpose === 'bandits' ? 'announce.thief_escaped.bandits' : 'announce.thief_escaped.raiders';
}
