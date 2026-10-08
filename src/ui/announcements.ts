/**
 * The announcement registry and the log.
 *
 * `02-systems/24-ui-and-input.md` § Announcements and the log: "The announcement registry maps
 * event types to `{ severity, text, focus }` (from `register.announcement`). Text comes from the
 * strings table with placeholders filled from the event and readers." `note` is appended in gray;
 * `alert` in yellow and the strip flashes for one second; `danger` in red, the game pauses when
 * `auto-pause on danger` is on (default on), the view centres on the focus and the strip shows the
 * line until any key dismisses it. "Log size `LOG_MAX_LINES` in memory"; "Repeated identical
 * announcements within `LOG_DEDUP_TICKS` are merged with a count ("×3")."
 */

import { C } from '@core/components';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { AnnouncementSpec } from '@core/system';
import type { TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { LOG_DEDUP_TICKS, LOG_MAX_LINES } from './constants';
import { stockpileName } from './messages';
import { MOOD_TIER_NAMES } from './panels/mood';
import type { Strings } from './strings';

export type Severity = 'note' | 'alert' | 'danger';

export interface LogLine {
  tick: number;
  severity: Severity;
  text: string;
  /** How many identical lines were merged into this one. */
  count: number;
  focus?: TileIndex;
  category?: string;
}

/** The strip's prefix per severity: "danger lines are prefixed `!!`, alerts `!`". */
export function prefixOf(severity: Severity): string {
  return severity === 'danger' ? '!! ' : severity === 'alert' ? '! ' : '';
}

/** A line as the strip and the log panel print it, with its merge count. */
export function lineText(line: LogLine): string {
  return `${prefixOf(line.severity)}${line.text}${line.count > 1 ? ` ×${line.count}` : ''}`;
}

interface NamedRow {
  readonly id: string;
  readonly name: string;
}

/** What announcing one event produced. */
export interface Announced {
  readonly line: LogLine;
  readonly severity: Severity;
  readonly focus: TileIndex | undefined;
}

export class AnnouncementLog {
  private readonly combatPairs = new Set<string>();
  readonly lines: LogLine[] = [];
  private readonly specs = new Map<string, AnnouncementSpec>();
  private readonly seen = new Set<string>();

  constructor(
    private readonly strings: Strings,
    private readonly registry: Registry,
  ) {}

  /** Load the rows systems registered (`register.announcement`). */
  register(rows: readonly { type: EventType; spec: AnnouncementSpec }[]): void {
    for (const row of rows) this.specs.set(row.type, row.spec);
  }

  specFor(type: string): AnnouncementSpec | undefined {
    return this.specs.get(type);
  }

  /** The placeholders an event offers: its fields, with ids and indices named through the readers. */
  params(event: GameEvent, readers: ReaderSet): Record<string, string | number> {
    const out: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(event)) {
      if (typeof value === 'string' || typeof value === 'number') out[key] = value;
    }
    const e = event as unknown as Record<string, unknown>;
    const deadId = e['id'];
    if (event.type === 'CreatureDied' && typeof deadId === 'number') {
      const creature = readers.entities.get(deadId, C.Creature);
      const name = typeof e['name'] === 'string' && e['name'].length > 0 ? e['name'] : creature?.name;
      if (name) { out['name'] = name; out['dwarf'] = name; }
      else if (typeof e['species'] === 'number') out['name'] = this.registry.table<NamedRow>('creatures').byIndex(e['species'])?.name ?? 'A creature';
    }
    const trapped = e['creatureId'];
    if (typeof trapped === 'number') {
      const creature = readers.entities.get(trapped, C.Creature);
      if (creature !== undefined) out['species'] = this.registry.table<NamedRow>('creatures').byIndex(creature.species)?.name ?? '';
    }
    for (const key of ['finderId', 'minerId', 'dwarfId', 'id'] as const) {
      const who = e[key];
      if (typeof who === 'number') {
        const name = readers.entities.get(who, C.Creature)?.name;
        if (typeof name === 'string' && name.length > 0) {
          out['dwarf'] = name;
          break;
        }
      }
    }
    // A hunt names its hunter and its prey (09 § Registrations, T-M7-10).
    const hunter = e['hunterId'];
    if (typeof hunter === 'number' && hunter !== 0) out['hunter'] = readers.entities.get(hunter, C.Creature)?.name ?? '';
    const prey = e['targetId'];
    if (typeof prey === 'number' && prey !== 0) out['prey'] = this.speciesName(readers, prey);
    // A species field, as an index or a content id, reads as the species' name.
    const speciesOf = e['species'];
    if (out['species'] === undefined) {
      const table = this.registry.table<NamedRow>('creatures');
      if (typeof speciesOf === 'number') out['species'] = table.byIndex(speciesOf)?.name ?? '';
      else if (typeof speciesOf === 'string') out['species'] = table.byId(speciesOf)?.name ?? speciesOf;
    }
    const skill = e['skill'];
    if (typeof skill === 'string' && this.registry.hasTable('skills')) {
      out['skill'] = this.registry.table<NamedRow>('skills').byId(skill)?.name ?? skill;
    }
    const crafter = e['crafterId'];
    if (typeof crafter === 'number') out['crafter'] = readers.entities.get(crafter, C.Creature)?.name ?? '';
    const itemId = e['itemId'];
    if (typeof itemId === 'number') {
      const item = readers.entities.get(itemId, C.Item);
      if (item !== undefined) out['item'] = this.registry.table<NamedRow>('items').byIndex(item.type)?.name ?? '';
    }
    const tier = e['tier'];
    if (typeof tier === 'number' && this.registry.hasTable('roomTiers')) {
      const tiers = this.registry.table<{ id: string; tier: number }>('roomTiers');
      out['tierName'] = tiers.ids().find((id) => tiers.byId(id)?.tier === tier) ?? String(tier);
    }
    const material = e['material'];
    if (typeof material === 'number' || typeof material === 'string') {
      const table = this.registry.table<NamedRow>('materials');
      const row = typeof material === 'number' ? materialByIndex(table, material) : table.byId(material);
      out['material'] = row?.name ?? String(material);
    }
    const thoughtId = e['thoughtId'];
    if (typeof thoughtId === 'string' && this.registry.hasTable('thoughts')) {
      const thoughtRow = this.registry.table<{ id: string; text?: string }>('thoughts').byId(thoughtId);
      if (thoughtRow?.text !== undefined) out['thought'] = thoughtRow.text;
    }
    const attackerId = e['attackerId'] ?? e['attacker'];
    if (typeof attackerId === 'number' && attackerId !== 0) {
      const creature = readers.entities.get(attackerId, C.Creature);
      out['attacker'] = creature?.name || (creature ? this.registry.table<NamedRow>('creatures').byIndex(creature.species)?.name ?? '' : '') || 'attacker';
    }
    const defenderId = e['defenderId'] ?? e['defender'];
    if (typeof defenderId === 'number' && defenderId !== 0) {
      const creature = readers.entities.get(defenderId, C.Creature);
      out['defender'] = creature?.name || (creature ? this.registry.table<NamedRow>('creatures').byIndex(creature.species)?.name ?? '' : '') || 'defender';
    }
    if (event.type === 'AttackResolved') {
      if (typeof out['attacker'] === 'string') out['attacker'] = out['attacker'].split(' ')[0] ?? out['attacker'];
      if (typeof out['defender'] === 'string') out['defender'] = out['defender'].split(' ')[0] ?? out['defender'];
    }
    const killerId = e['killerId'];
    if (typeof killerId === 'number' && killerId !== 0) {
      const creature = readers.entities.get(killerId, C.Creature);
      out['killer'] = creature?.name || (creature ? this.registry.table<NamedRow>('creatures').byIndex(creature.species)?.name ?? '' : '') || 'killer';
    }
    // §4.5: a reason code reads as words ("No immigrants this season: hall spirit must be
    // Content (now Unhappy)", "…fallen: they were offered wooden goods"); a stockpile by name.
    if (event.type === 'ImmigrationSkipped' || event.type === 'ReputationChanged') {
      const reason = String(e['reason'] ?? '');
      const tier = readers.has('15') ? MOOD_TIER_NAMES[readers.of<{ hallSpiritTier(): number }>('15').hallSpiritTier()] ?? '' : '';
      const keyOf = (code: string): string => event.type === 'ImmigrationSkipped' ? `announce.immigration_skipped.reason.${code}` : `announce.reputation_changed.reason.${code}`;
      out['reason'] = this.strings.has(keyOf(reason)) ? this.strings.get(keyOf(reason), { tier }) : this.strings.get(keyOf('other'));
    }
    if (event.type === 'StockpileFull' && typeof deadId === 'number') out['zone'] = stockpileName({ readers, strings: this.strings }, deadId) || this.strings.get('ui.zone.type.stockpile');
    const victimId = e['victimId'];
    if (typeof victimId === 'number' && victimId !== 0) {
      const creature = readers.entities.get(victimId, C.Creature);
      out['victim'] = creature?.name || (creature ? this.registry.table<NamedRow>('creatures').byIndex(creature.species)?.name ?? '' : '') || 'victim';
    }
    return out;
  }

  /** A creature's species name, for the announcements that name the beast and not the dwarf. */
  private speciesName(readers: ReaderSet, id: number): string {
    const creature = readers.entities.get(id, C.Creature);
    if (creature === undefined) return '';
    return this.registry.table<NamedRow>('creatures').byIndex(creature.species)?.name ?? '';
  }

  /** Map an event through the registry and append it; `null` when the event has no row. */
  announce(event: GameEvent, readers: ReaderSet, tick: number): Announced | null {
    const spec = this.specs.get(event.type);
    if (spec === undefined) return null;
    if (spec.atLeast !== undefined) {
      const v = (event as unknown as Record<string, unknown>)[spec.atLeast.field];
      if (typeof v !== 'number' || v < spec.atLeast.value) return null;
    }
    if (spec.atMost !== undefined) {
      const v = (event as unknown as Record<string, unknown>)[spec.atMost.field];
      if (typeof v !== 'number' || v > spec.atMost.value) return null;
    }
    const fields = event as unknown as Record<string, unknown>;
    const creatureId = fields['id'];
    const dwarfDeath = event.type === 'CreatureDied' && typeof creatureId === 'number' &&
      (readers.entities.has(creatureId, C.Brain) ||
        (fields['species'] === this.registry.table('creatures').index('dwarf') && fields['faction'] === 'fortress'));
    if (event.type === 'CreatureUnconscious' && (typeof creatureId !== 'number' || !readers.entities.has(creatureId, C.Brain))) return null;
    if (spec.oneOf !== undefined && !spec.oneOf.values.includes(fields[spec.oneOf.field] as string | number)) return null;
    if (spec.once === true) {
      if (this.seen.has(event.type)) return null;
      this.seen.add(event.type);
    }
    let key = spec.keyField === undefined ? spec.stringKey : `${spec.stringKey}.${String(fields[spec.keyField])}`;
    // §4.5: "drop the clause when 0" children came.
    if (event.type === 'ImmigrantsArrived' && fields['children'] === 0) key = 'announce.immigrants_arrived_adults';
    if (event.type === 'CreatureDied' && typeof creatureId === 'number' && !dwarfDeath) {
      key = readers.entities.get(creatureId, C.Tame)?.petOf ? 'announce.pet_died' : 'announce.creature_died';
    }
    const text = this.strings.get(key, this.params(event, readers));
    const focus = focusOf(event, readers) ?? (event.type === 'StockpileFull' ? zoneFocus(readers, fields['id']) : undefined);
    const category = spec.category;
    let severity = spec.severity;
    if (event.type === 'CreatureDied' && typeof creatureId === 'number' && !dwarfDeath) {
      severity = readers.entities.get(creatureId, C.Tame)?.petOf ? 'alert' : 'note';
    }
    if (event.type === 'RaidEnded' && fields['outcome'] === 'looted') severity = 'alert';
    if (event.type === 'AttackResolved') {
      const attacker = fields['attackerId'];
      const defender = fields['defenderId'];
      if (typeof attacker === 'number' && typeof defender === 'number') {
        const pair = `${attacker}:${defender}`;
        if (this.combatPairs.has(pair)) severity = 'note';
        else this.combatPairs.add(pair);
      }
    }
    const line = this.append(severity, text, tick, focus, category);
    return { line, severity, focus };
  }

  /** `ui.announce(severity, text, focus?, category?)`, with the dedup rule. */
  append(severity: Severity, text: string, tick: number, focus?: TileIndex, category?: string): LogLine {
    for (let k = this.lines.length - 1; k >= 0; k -= 1) {
      const prev = this.lines[k] as LogLine;
      if (tick - prev.tick > LOG_DEDUP_TICKS) break;
      if (prev.text === text && prev.severity === severity && prev.category === category) {
        prev.count += 1;
        prev.tick = tick;
        return prev;
      }
    }
    const line: LogLine = {
      tick,
      severity,
      text,
      count: 1,
      ...(focus === undefined ? {} : { focus }),
      ...(category === undefined ? {} : { category }),
    };
    this.lines.push(line);
    if (this.lines.length > LOG_MAX_LINES) this.lines.splice(0, this.lines.length - LOG_MAX_LINES);
    return line;
  }

  /** The last `n` lines, oldest first (the strip shows the newest at the bottom). */
  tail(n: number): LogLine[] {
    return this.lines.slice(Math.max(0, this.lines.length - n));
  }

  /** "The `once` rows already announced", for a load to restore. */
  markSeen(type: string): void {
    this.seen.add(type);
  }
}

/** A zone's first tile, for a line about the zone. */
function zoneFocus(readers: ReaderSet, id: unknown): TileIndex | undefined {
  if (typeof id !== 'number' || !readers.has('14')) return undefined;
  return readers.of<BuildingsReader>('14').zone(id)?.tiles[0];
}

function materialByIndex(table: { ids(): readonly string[]; byId(id: string): NamedRow | undefined; index(id: string): number }, index: number): NamedRow | undefined {
  for (const id of table.ids()) if (table.index(id) === index) return table.byId(id);
  return undefined;
}

/** The focus of an event: its `tile`, the first of its `tiles`, or an involved entity's position. */
export function focusOf(event: GameEvent, readers?: ReaderSet): TileIndex | undefined {
  const e = event as unknown as Record<string, unknown>;
  if (typeof e['tile'] === 'number') return e['tile'];
  const tiles = e['tiles'];
  if (Array.isArray(tiles) && typeof tiles[0] === 'number') return tiles[0];
  if (readers !== undefined) {
    const partyId = e['partyId'];
    if (typeof partyId === 'number') {
      const party = readers.entities.get(partyId, C.Party);
      const member = party?.members.find((id) => readers.entities.has(id, C.Position));
      const pos = member === undefined ? undefined : readers.entities.get(member, C.Position);
      if (pos !== undefined) return readers.map.index(pos.x, pos.y, pos.z);
    }
    for (const key of ['defenderId', 'attackerId', 'victimId', 'id', 'creatureId'] as const) {
      const id = e[key];
      if (typeof id === 'number' && id !== 0) {
        const pos = readers.entities.get(id, C.Position);
        if (pos !== undefined) return readers.map.index(pos.x, pos.y, pos.z);
      }
    }
  }
  return undefined;
}
