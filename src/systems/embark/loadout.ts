/**
 * Saved loadouts: `02-systems/02-embark-and-loadout.md` § Loadouts.
 *
 * A loadout is what the player spent the embark on: the supply lines and each dwarf's skills by
 * party position. It is stored by content id, never by row number, so a loadout written before a
 * content change still reads: a row that no longer exists is dropped and named in the result.
 * Loading goes through the session's own commands (`SetSupply`, `SetSkill`), so the session's rules
 * decide what a line may hold, and the budget is never touched: a loadout that costs more than the
 * site allows loads whole and the screen says by how much it is over.
 */

import { EMBARK_SKILL_MAX_PER_SKILL } from '@core/constants';
import type { Registry } from '@core/registry';
import type { EmbarkSession } from './index';
import type { EmbarkEntryRow, SupplyLine } from './party';
import type { TestingItemLine } from './testing';

export interface Loadout {
  /** The supply lines, by catalog entry id. */
  readonly supplies: readonly SupplyLine[];
  /** Each dwarf's skills by party position: skill id → level. */
  readonly skills: readonly Readonly<Record<string, number>>[];
  /**
   * A testing loadout (`02` § Testing mode): it loads in testing mode, with a party of as many
   * dwarves as `skills` holds and its free item lines. Absent: a normal loadout.
   */
  readonly mode?: 'testing';
  readonly items?: readonly TestingItemLine[];
}

export interface SavedLoadout extends Loadout {
  readonly name: string;
}

/** What loading a loadout could not take as it was. */
export interface LoadoutResult {
  /** Catalog entries and skills of the loadout that no longer exist, by id. */
  readonly missing: readonly string[];
  /** Catalog entries the site does not offer (their temperature condition fails). */
  readonly unavailable: readonly string[];
  /** Supply lines and skills above their limit, lowered to it. */
  readonly lowered: readonly string[];
  /** Dwarves of the loadout beyond the party, whose skills were left out. */
  readonly extraDwarves: number;
}

/** Loadout names compare without case: "Deep start" and "deep start" are one loadout. */
export function sameLoadoutName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The session's current loadout. */
export function loadoutOf(session: EmbarkSession): Loadout {
  return {
    supplies: session.supplies.filter((line) => line.count > 0).map((line) => ({ entry: line.entry, count: line.count })),
    skills: session.party.map((d) => ({ ...d.skills })),
    ...(session.testing ? { mode: 'testing' as const, items: session.items.map((line) => ({ ...line })) } : {}),
  };
}

/** A stored free item line read back, or null when malformed. */
function readItemLine(value: unknown): TestingItemLine | null {
  if (value === null || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const count = positiveInt(row['count']);
  if (typeof row['item'] !== 'string' || typeof row['material'] !== 'string' || count === null) return null;
  const quality = row['quality'];
  return {
    item: row['item'],
    material: row['material'],
    count,
    ...(typeof quality === 'number' && Number.isInteger(quality) ? { quality } : {}),
    ...(typeof row['stone'] === 'string' ? { stone: row['stone'] } : {}),
    ...(typeof row['enchant'] === 'string' ? { enchant: row['enchant'] } : {}),
  };
}

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * A stored loadout read back, or null when it has no name. Malformed lines and skills are dropped;
 * a repeated entry keeps its first line. Ids are kept as written: whether they still exist is
 * decided when the loadout is loaded.
 */
export function readLoadout(value: unknown): SavedLoadout | null {
  if (value === null || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const name = typeof row['name'] === 'string' ? row['name'].trim() : '';
  if (name.length === 0) return null;
  const supplies: SupplyLine[] = [];
  for (const line of Array.isArray(row['supplies']) ? row['supplies'] as unknown[] : []) {
    if (line === null || typeof line !== 'object') continue;
    const entry = (line as Record<string, unknown>)['entry'];
    const count = positiveInt((line as Record<string, unknown>)['count']);
    if (typeof entry !== 'string' || count === null || supplies.some((l) => l.entry === entry)) continue;
    supplies.push({ entry, count });
  }
  const skills: Record<string, number>[] = [];
  for (const dwarf of Array.isArray(row['skills']) ? row['skills'] as unknown[] : []) {
    const out: Record<string, number> = {};
    if (dwarf !== null && typeof dwarf === 'object') {
      for (const [skill, level] of Object.entries(dwarf as Record<string, unknown>)) {
        const n = positiveInt(level);
        if (n !== null) out[skill] = n;
      }
    }
    skills.push(out);
  }
  if (row['mode'] !== 'testing') return { name, supplies, skills };
  const items: TestingItemLine[] = [];
  for (const line of Array.isArray(row['items']) ? row['items'] as unknown[] : []) {
    const item = readItemLine(line);
    if (item !== null) items.push(item);
  }
  return { name, supplies, skills, mode: 'testing', items };
}

/** The stored list read back: unreadable rows dropped, one loadout per name (the first), sorted by name. */
export function readLoadouts(value: unknown): SavedLoadout[] {
  const out: SavedLoadout[] = [];
  for (const row of Array.isArray(value) ? value as unknown[] : []) {
    const loadout = readLoadout(row);
    if (loadout !== null && !out.some((l) => sameLoadoutName(l.name, loadout.name))) out.push(loadout);
  }
  return sortLoadouts(out);
}

export function sortLoadouts(list: SavedLoadout[]): SavedLoadout[] {
  return list.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** What a loadout costs at today's prices; lines whose entry no longer exists cost nothing. */
export function loadoutTotal(registry: Registry, loadout: Loadout): number {
  const table = registry.table<EmbarkEntryRow>('embarkCatalog');
  let total = 0;
  for (const line of loadout.supplies) total += (table.byId(line.entry)?.price ?? 0) * line.count;
  return total;
}

/**
 * Replace the session's supplies and skills with a loadout's. The fortress name, the party's names
 * and rerolls stay as they are. A line or skill that no longer exists is dropped, an entry the site
 * does not offer (`available` false) is left out, and a count or level the session refuses as above
 * its limit is lowered to that limit; each is named in the result.
 */
export function applyLoadout(
  session: EmbarkSession,
  registry: Registry,
  loadout: Loadout,
  available: (entry: string) => boolean = () => true,
): LoadoutResult {
  const missing: string[] = [];
  const unavailable: string[] = [];
  const lowered: string[] = [];
  const note = (list: string[], id: string): void => {
    if (!list.includes(id)) list.push(id);
  };
  // A loadout loads in its own mode; a testing one brings its party size (`02` § Testing mode).
  const testing = loadout.mode === 'testing';
  session.apply({ type: 'SetEmbarkMode', mode: testing ? 'testing' : 'normal' });
  if (testing) {
    const size = Math.max(1, loadout.skills.length);
    while (session.party.length < size && session.apply({ type: 'AddDwarf' }).ok);
    while (session.party.length > size && session.apply({ type: 'RemoveDwarf', dwarf: session.party.length - 1 }).ok);
  }
  while (session.items.length > 0 && session.apply({ type: 'SetItemCount', index: session.items.length - 1, count: 0 }).ok);
  for (const line of session.supplies.slice()) session.apply({ type: 'SetSupply', entry: line.entry, count: 0 });
  session.party.forEach((d, dwarf) => {
    for (const skill of Object.keys(d.skills)) session.apply({ type: 'SetSkill', dwarf, skill, level: 0 });
  });
  const catalog = registry.table<EmbarkEntryRow>('embarkCatalog');
  for (const line of loadout.supplies) {
    const entry = catalog.byId(line.entry);
    if (entry === undefined) {
      note(missing, line.entry);
      continue;
    }
    if (!available(line.entry)) {
      note(unavailable, line.entry);
      continue;
    }
    const r = session.apply({ type: 'SetSupply', entry: line.entry, count: line.count });
    if (!r.ok && r.reason === 'invalid' && line.count > entry.max) {
      if (session.apply({ type: 'SetSupply', entry: line.entry, count: entry.max }).ok) note(lowered, line.entry);
    }
  }
  loadout.skills.forEach((skills, dwarf) => {
    if (dwarf >= session.party.length) return;
    for (const [skill, level] of Object.entries(skills)) {
      const r = session.apply({ type: 'SetSkill', dwarf, skill, level });
      if (r.ok) continue;
      if (r.reason === 'not_found') note(missing, skill);
      else if (r.reason === 'invalid' && level > EMBARK_SKILL_MAX_PER_SKILL) {
        if (session.apply({ type: 'SetSkill', dwarf, skill, level: EMBARK_SKILL_MAX_PER_SKILL }).ok) note(lowered, skill);
      }
    }
  });
  for (const line of testing ? loadout.items ?? [] : []) {
    const r = session.apply({ type: 'AddItem', line });
    if (!r.ok) note(missing, line.item);
  }
  const extraDwarves = loadout.skills.slice(session.party.length).filter((s) => Object.keys(s).length > 0).length;
  session.preset = null;
  return { missing, unavailable, lowered, extraDwarves };
}
