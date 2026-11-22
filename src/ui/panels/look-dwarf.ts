/**
 * The creature inspector's dwarf sections (`ui-screens/fortress-screen.md` § Inspection panel; 10
 * § Registrations, `creature › dwarf`): the identity line, the needs as bars, the skill bars, what
 * the creature holds and wears, its relations and its titles. The look panel draws them in the
 * wireframe's order.
 */

import { C } from '@core/components';
import { NEED_MAX, SKILL_MAX_LEVEL } from '@core/constants';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat';
import { CRITICAL, cumulativeXp, NEED_NAMES, WANT, xpToNext, type DwarvesReader, type NeedName } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import type { Strings } from '../strings';
import { NEED_BAR_CELLS, SKILL_BAR_CELLS, TITLE_IDS } from '../constants';
import { barCells } from '../widgets/bar';
import { gearName, heldWeapon, weaponRowOf } from './gear';
import { joinSpans, spansText, stringSpans, type Span } from './look-links';
import { professionOf } from './units';

const FULL = '▓';
const EMPTY = '░';

function meter(filled: number, cells: number): string {
  return `${FULL.repeat(filled)}${EMPTY.repeat(cells - filled)}`;
}

/** Whether a creature is one of the fortress's dwarves (10's list). */
export function isDwarf(readers: ReaderSet, id: EntityId): boolean {
  return readers.has('10') && readers.of<DwarvesReader>('10').list().includes(id);
}

/** "Miner · adult", "Peasant · child", and the squad of a soldier: "Miner · adult · The Hearthguard". */
export function identityLine(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): string {
  const profession = professionOf({ readers, registry, strings }, id);
  const age = strings.get(readers.of<DwarvesReader>('10').isChild(id) ? 'ui.look.dwarf.child' : 'ui.look.dwarf.adult');
  const squad = readers.has('16') ? readers.of<CombatReader>('16').squadOf(id) : undefined;
  return squad === undefined
    ? strings.get('ui.look.dwarf.identity', { profession, age })
    : strings.get('ui.look.dwarf.identity_squad', { profession, age, squad: squad.name });
}

/** One need as the inspector draws it, and how pressing it is: 0 below its want, 1 at it, 2 at its critical threshold. */
export interface NeedCell {
  readonly text: string;
  readonly level: 0 | 1 | 2;
}

/** Cells a need takes: its name padded to the longest, a space, the bar, a space and three digits. */
export function needCellWidth(strings: Strings): number {
  return Math.max(...NEED_NAMES.map((n) => Array.from(strings.get(`ui.look.dwarf.need.${n}`)).length)) + NEED_BAR_CELLS + 5;
}

/** The seven needs in 10's order: "hunger  ▓▓░░  42" (0 is satisfied, `NEED_MAX` the worst). */
export function needCells(readers: ReaderSet, strings: Strings, id: EntityId): NeedCell[] {
  const dwarves = readers.of<DwarvesReader>('10');
  const pad = needCellWidth(strings) - NEED_BAR_CELLS - 5;
  return NEED_NAMES.map((need: NeedName) => {
    const value = Math.round(dwarves.need(id, need));
    const critical = CRITICAL[need];
    const level = critical !== undefined && value >= critical ? 2 : value >= WANT[need] ? 1 : 0;
    const name = strings.get(`ui.look.dwarf.need.${need}`).padEnd(pad);
    return { text: `${name} ${meter(barCells(value, NEED_MAX, NEED_BAR_CELLS), NEED_BAR_CELLS)} ${String(value).padStart(3)}`, level };
  });
}

/** The progress to a skill's next level as a bar: full at `SKILL_MAX_LEVEL`. */
export function skillBar(readers: ReaderSet, registry: Registry, id: EntityId, skillId: string): string {
  const index = registry.table('skills').index(skillId);
  const skills = readers.entities.get(id, C.Skills);
  const level = index < 0 ? 0 : skills?.level[index] ?? 0;
  if (level >= SKILL_MAX_LEVEL) return meter(SKILL_BAR_CELLS, SKILL_BAR_CELLS);
  const xp = index < 0 ? 0 : skills?.xp[index] ?? 0;
  return meter(barCells(xp - cumulativeXp(level), xpToNext(level), SKILL_BAR_CELLS), SKILL_BAR_CELLS);
}

/** 10's seven attributes in the order of § Concepts. */
const ATTRIBUTES = ['str', 'agi', 'tou', 'end', 'wil', 'wit', 'cha'] as const;

/**
 * The attributes, as many to a row as fit `width`: "Str 61 Agi 48 Tou 55 End 50 Wil 47", "Wit 52
 * Cha 49" (10 § Attributes).
 */
export function attributeRows(readers: ReaderSet, strings: Strings, id: EntityId, width: number): string[] {
  const dwarves = readers.of<DwarvesReader>('10');
  const cells = ATTRIBUTES.map((attr) => strings.get('ui.look.dwarf.attribute', { name: strings.get(`ui.look.dwarf.attr.${attr}`), value: Math.round(dwarves.attribute(id, attr)) }));
  const rows: string[] = [];
  for (const cell of cells) {
    const last = rows[rows.length - 1];
    if (last !== undefined && Array.from(last).length + 1 + Array.from(cell).length <= width) rows[rows.length - 1] = `${last} ${cell}`;
    else rows.push(cell);
  }
  return rows;
}

/** "Personality Stoic, Gregarious, Brave": the dwarf's three traits by name (10 § Concepts); null without a `Personality`. */
export function personalityText(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): string | null {
  const personality = readers.entities.get(id, C.Personality);
  if (personality === undefined) return null;
  const table = registry.table<{ id: string; name: string }>('personality');
  const names = personality.traits.map((trait) => table.byIndex(trait)?.name ?? '').filter((name) => name !== '');
  return names.length === 0 ? null : strings.get('ui.look.dwarf.personality', { traits: names.join(', ') });
}

/** "Productivity 85%": 10's `dwarves.productivity`, the mood, the wounds and tipsiness together. */
export function productivityText(readers: ReaderSet, strings: Strings, id: EntityId): string {
  return strings.get('ui.look.dwarf.productivity', { n: readers.of<DwarvesReader>('10').productivity(id) });
}

/**
 * What a creature holds (16 § Equipment): its weapon, the tool it works with, its shield, its armor
 * from head to feet, its quiver and the ammunition of its launcher. "Equipment iron spear, iron
 * helm"; "Equipment none" for a dwarf with nothing; null for another creature with nothing.
 */
export function equipmentText(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId, dwarf: boolean): string | null {
  const spans = equipmentSpans(readers, registry, strings, id, dwarf);
  return spans === null ? null : spansText(spans);
}

/** {@link equipmentText} with each item a link to its view (24 § Inspection). */
export function equipmentSpans(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId, dwarf: boolean): Span[] | null {
  const equip = readers.entities.get(id, C.Equipment);
  const held: EntityId[] = [];
  const add = (item: EntityId): void => {
    if (item !== 0 && readers.entities.alive(item) && !held.includes(item)) held.push(item);
  };
  add(heldWeapon(readers, registry, id));
  add(readers.entities.get(id, C.Worker)?.toolId ?? 0);
  if (equip !== undefined) {
    add(equip.shield);
    for (const slot of ['head', 'body', 'arms', 'legs', 'feet'] as const) add(equip.armor[slot]);
    add(equip.quiver);
    const ammo = equip.weapon === 0 ? undefined : weaponRowOf(readers, registry, equip.weapon)?.launcher?.ammo;
    if (ammo !== undefined && readers.has('13')) {
      const type = registry.table('items').index(ammo);
      for (const item of readers.of<ItemsReader>('13').carriedItems(id)) if (readers.entities.get(item, C.Item)?.type === type) add(item);
    }
  }
  if (held.length === 0) return dwarf ? [{ text: strings.get('ui.look.dwarf.equipment_none') }] : null;
  return stringSpans(strings, 'ui.look.dwarf.equipment', { list: itemLinks(readers, registry, held) });
}

/** What a creature wears (10 § Clothing): "Wearing linen tunic, linen trousers, leather boots"; null for a creature with no clothing slots. */
export function wearingText(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): string | null {
  const spans = wearingSpans(readers, registry, strings, id);
  return spans === null ? null : spansText(spans);
}

/** {@link wearingText} with each piece a link to its view. */
export function wearingSpans(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): Span[] | null {
  const clothing = readers.entities.get(id, C.Equipment)?.clothing;
  if (clothing === undefined) return null;
  const worn = (['body', 'legs', 'feet', 'over'] as const).map((slot) => clothing[slot]).filter((item) => item !== 0 && readers.entities.alive(item));
  return worn.length === 0 ? [{ text: strings.get('ui.look.dwarf.wearing_none') }] : stringSpans(strings, 'ui.look.dwarf.wearing', { list: itemLinks(readers, registry, worn) });
}

/** Items by name, each a link to its view, joined by commas. */
function itemLinks(readers: ReaderSet, registry: Registry, items: readonly EntityId[]): Span[] {
  return joinSpans(items.map((item) => [{ text: gearName(readers, registry, item), target: { kind: 'item', id: item } }]), ', ');
}

/** "Relations friends: Brynja Coldhammer; grudges: Orm Ashbrow" (10 § Relationships), or "Relations none yet". */
export function relationsText(readers: ReaderSet, strings: Strings, id: EntityId): string {
  return spansText(relationsSpans(readers, strings, id));
}

/** {@link relationsText} with each friend and grudge a link to that creature's view. */
export function relationsSpans(readers: ReaderSet, strings: Strings, id: EntityId): Span[] {
  const name = (other: EntityId): string => readers.entities.get(other, C.Creature)?.name ?? '';
  const friends = readers.of<DwarvesReader>('10').friends(id).filter((other) => name(other) !== '');
  const grudges = (readers.entities.get(id, C.Relationships)?.grudges ?? []).map((g) => g.id).filter((other) => name(other) !== '');
  const links = (ids: readonly EntityId[]): Span[] => joinSpans(ids.map((other) => [{ text: name(other), target: { kind: 'creature', id: other } }]), ', ');
  const parts: Span[][] = [];
  if (friends.length > 0) parts.push(stringSpans(strings, 'ui.look.dwarf.friends', { names: links(friends) }));
  if (grudges.length > 0) parts.push(stringSpans(strings, 'ui.look.dwarf.grudges', { names: links(grudges) }));
  return parts.length === 0 ? [{ text: strings.get('ui.look.dwarf.relations_none') }] : stringSpans(strings, 'ui.look.dwarf.relations', { list: joinSpans(parts, '; ') });
}

/** "Title Thane, Warden" (10 § Titles), in the title table's order; null for a dwarf with none. */
export function titleText(readers: ReaderSet, strings: Strings, id: EntityId): string | null {
  const held = readers.of<DwarvesReader>('10').titles(id).filter((title) => (TITLE_IDS as readonly string[]).includes(title));
  return held.length === 0 ? null : strings.get('ui.look.dwarf.title', { titles: held.map((title) => strings.get(`ui.title.${title}`)).join(', ') });
}
