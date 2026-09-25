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
import { LOG_DEDUP_TICKS, LOG_MAX_LINES } from './constants';
import type { Strings } from './strings';

export type Severity = 'note' | 'alert' | 'danger';

export interface LogLine {
  tick: number;
  severity: Severity;
  text: string;
  /** How many identical lines were merged into this one. */
  count: number;
  focus?: TileIndex;
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
    for (const key of ['finderId', 'minerId', 'id'] as const) {
      const who = e[key];
      if (typeof who === 'number') {
        const name = readers.entities.get(who, C.Creature)?.name;
        if (typeof name === 'string' && name.length > 0) {
          out['dwarf'] = name;
          break;
        }
      }
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
    return out;
  }

  /** Map an event through the registry and append it; `null` when the event has no row. */
  announce(event: GameEvent, readers: ReaderSet, tick: number): Announced | null {
    const spec = this.specs.get(event.type);
    if (spec === undefined) return null;
    if (spec.atLeast !== undefined) {
      const v = (event as unknown as Record<string, unknown>)[spec.atLeast.field];
      if (typeof v !== 'number' || v < spec.atLeast.value) return null;
    }
    const fields = event as unknown as Record<string, unknown>;
    if (spec.oneOf !== undefined && !spec.oneOf.values.includes(fields[spec.oneOf.field] as string | number)) return null;
    if (spec.once === true) {
      if (this.seen.has(event.type)) return null;
      this.seen.add(event.type);
    }
    const key = spec.keyField === undefined ? spec.stringKey : `${spec.stringKey}.${String(fields[spec.keyField])}`;
    const text = this.strings.get(key, this.params(event, readers));
    const focus = focusOf(event);
    const line = this.append(spec.severity, text, tick, focus);
    return { line, severity: spec.severity, focus };
  }

  /** `ui.announce(severity, text, focus?)`, with the dedup rule. */
  append(severity: Severity, text: string, tick: number, focus?: TileIndex): LogLine {
    for (let k = this.lines.length - 1; k >= 0; k -= 1) {
      const prev = this.lines[k] as LogLine;
      if (tick - prev.tick > LOG_DEDUP_TICKS) break;
      if (prev.text === text && prev.severity === severity) {
        prev.count += 1;
        prev.tick = tick;
        return prev;
      }
    }
    const line: LogLine = focus === undefined ? { tick, severity, text, count: 1 } : { tick, severity, text, count: 1, focus };
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

function materialByIndex(table: { ids(): readonly string[]; byId(id: string): NamedRow | undefined; index(id: string): number }, index: number): NamedRow | undefined {
  for (const id of table.ids()) if (table.index(id) === index) return table.byId(id);
  return undefined;
}

/** The focus of an event: its `tile`, or the first of its `tiles`. */
export function focusOf(event: GameEvent): TileIndex | undefined {
  const e = event as unknown as Record<string, unknown>;
  if (typeof e['tile'] === 'number') return e['tile'];
  const tiles = e['tiles'];
  if (Array.isArray(tiles) && typeof tiles[0] === 'number') return tiles[0];
  return undefined;
}
