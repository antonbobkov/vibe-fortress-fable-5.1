/** The permanent record of a finished fortress (24 § The legend record). */
import { dayIndexOf, formatDate } from '@core/calendar';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import type { Registry } from '@core/registry';
import type { StorageAdapter } from '@platform/storage';
import type { WorldMap } from '@systems/worldgen';
import type { DwarvesReader } from '@systems/dwarves';
import type { LegendReader } from '@systems/legend';
import { LEGEND_LOG_LINES, LEGEND_NOTABLE_KILLS } from '@systems/legend/constants';
import type { LogLine } from '@ui/announcements';
import { deathLineKey, lineText } from '@ui/announcements';
import { Strings } from '@ui/strings';
import type { LegendRecord } from '@ui/screens/legend';
import type { HeadlessGame } from './headless';
import { finalSaveId } from './save-manager';

export type EndReason = { readonly kind: 'retired' } | { readonly kind: 'abandoned' } | {
  /** The last death's cause, and its killer as the death's line names it ('' when none). */
  readonly kind: 'all_dead'; readonly lastName: string; readonly lastCause: string; readonly lastKiller?: string;
};

/**
 * 24 § The legend record: the cause of the end. The last death is told in the words of its line
 * (`announce.died.<cause>`): "The last dwarf, Solveig Deephand, has bled to death."; a cause with no
 * line of its own "has died.".
 */
export function endText(tick: number, population: number, reason: EndReason, strings: Strings): string {
  const year = Math.floor(tick / TICKS_PER_YEAR) + 1;
  if (reason.kind === 'retired') return strings.get('ui.legend.cause.retired', { year, n: population });
  if (reason.kind === 'abandoned') return strings.get('ui.legend.cause.abandoned', { year, n: population });
  const who = strings.get('ui.legend.cause.last_dwarf', { name: reason.lastName });
  const killer = reason.lastKiller ?? '';
  const key = deathLineKey(strings, reason.lastCause, killer);
  const how = key === null ? strings.get('announce.dwarf_died', { dwarf: who }) : strings.get(key, { name: who, killer });
  return strings.get('ui.legend.cause.fell', { date: formatDate(tick), how });
}

export function composeLegend(
  game: HeadlessGame,
  worldMap: WorldMap | null,
  registry: Registry,
  journal: LegendReader,
  log: readonly LogLine[],
  reason: EndReason,
): LegendRecord {
  const fortress = game.world.fortress;
  const tick = game.tick;
  const duration = Math.max(0, tick - fortress.embarkTick);
  const region = worldMap?.regions.find((r) => r.id === fortress.regionId);
  const spec = game.terrain?.reader().spec();
  const surfaceZ = game.arrival?.wagon.z ?? game.map.columnSurfaceZ(Math.floor(game.map.w / 2), Math.floor(game.map.h / 2));
  const milestoneTable = registry.table<{ id: string; text: string }>('milestones');
  // The living dwarves, counted now: the cached population is 0 before the first tick (T-686).
  const readers = game.world.readers;
  const population = readers.has('10') ? readers.of<DwarvesReader>('10').population() : fortress.populationCached;
  const strings = new Strings(registry);
  return {
    id: finalSaveId(fortress.name),
    name: fortress.name,
    seed: game.world.seed,
    region: region?.name ?? strings.get('ui.legend.region_unnamed', { id: fortress.regionId }),
    regionId: fortress.regionId,
    // The biome by its name ("forest"), never its content id.
    biome: biomeName(registry, strings, region?.biome ?? spec?.biome),
    wealthRating: region?.wealth ?? spec?.wealth ?? 0,
    perilRating: region?.peril ?? spec?.peril ?? 0,
    foundedTick: fortress.embarkTick,
    endedTick: tick,
    yearsSurvived: Math.floor(duration / TICKS_PER_YEAR),
    daysSurvived: Math.floor((duration % TICKS_PER_YEAR) / TICKS_PER_DAY),
    peakPopulation: Math.max(journal.peakPopulation(), population),
    deepestLevel: Math.max(0, surfaceZ - journal.deepestZ()),
    finalWealth: fortress.wealthCached,
    milestones: fortress.milestones.map((entry) => ({
      id: entry.id,
      date: formatDate(entry.tick),
      text: milestoneTable.byId(entry.id)?.text ?? entry.id,
    })),
    killsOfNote: journal.kills().filter((entry) => entry.count > 0)
      .slice(0, LEGEND_NOTABLE_KILLS).map((entry) => strings.get('ui.legend.kill', { name: entry.name, n: entry.count })),
    lastWords: lastWords(log, strings),
    cause: endText(tick, population, reason, strings),
    ...(fortress.testing === true ? { testing: true } : {}),
  };
}

/** A placeholder as `fill` reads it: `{name}` or `{n|day|days}`. */
const PLACEHOLDER = /\{(\w+)(?:\|[^|}]+\|[^|}]+)?\}/g;
/** The placeholders that name the one creature a line is about: its lines fold per creature. */
const SUBJECT_FIELDS: ReadonlySet<string> = new Set(['dwarf', 'name', 'animal']);
/** The lines of a death (`CreatureDied`): never folded. */
const DEATH_KEY = /^announce\.(died\.|dwarf_died$|creature_died$|pet_died$)/;

interface LineKind { readonly key: string; readonly re: RegExp; readonly fields: readonly string[]; readonly literal: number }

/**
 * The announcement templates a line's text can be read back from, the most literal first: a whole
 * sentence with at least four letters of its own, so a fragment ("{n} raiders") or a bare
 * placeholder never claims a line. Only a line with no key of its own (an older save's) is read so.
 */
function lineKinds(strings: Strings): LineKind[] {
  const kinds: LineKind[] = [];
  for (const [key, template] of strings.templates('announce.')) {
    const literal = template.replace(PLACEHOLDER, '').replace(/\s/g, '').length;
    if (literal < 4 || !/[.!?"]$/.test(template)) continue;
    kinds.push(lineKind(key, template, literal));
  }
  return kinds.sort((a, b) => b.literal - a.literal || a.key.localeCompare(b.key));
}

/** A template as a pattern that reads its placeholders back from a line's text. */
function lineKind(key: string, template: string, literal = 0, flags = 's'): LineKind {
  const fields: string[] = [];
  let source = '';
  let at = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    source += `${escapeRegExp(template.slice(at, match.index))}(.+?)`;
    fields.push(match[1] as string);
    at = match.index + match[0].length;
  }
  source += escapeRegExp(template.slice(at));
  return { key, re: new RegExp(`^${source}$`, flags), fields, literal };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** How the last words tell a line's kind: by its own key (T-725), else by reading its text back (T-720). */
class LineKinds {
  private readonly kinds: readonly LineKind[];
  private readonly deaths: readonly LineKind[];
  private readonly byKey = new Map<string, LineKind>();

  constructor(private readonly strings: Strings) {
    const all = lineKinds(strings);
    this.deaths = all.filter((kind) => DEATH_KEY.test(kind.key));
    this.kinds = all.filter((kind) => !DEATH_KEY.test(kind.key));
  }

  /** A death (`CreatureDied`): never folded, and kept first when the last words are full. */
  isDeath(line: LogLine): boolean {
    if (line.key !== undefined) return DEATH_KEY.test(line.key);
    return this.deaths.some((kind) => kind.re.test(line.text));
  }

  /**
   * What a line folds by: its string key and, for a line about one creature (its template names a
   * `{dwarf}`, `{name}` or `{animal}`), that creature. A line with a key of its own folds by it
   * (T-725), the creature read from its text by that key's template (the line's subject when the
   * text is not the template's: its subject may be an item the event names first, so the name is
   * read first). One without a key (an older save's) folds by the template its text reads back as,
   * the most literal first, and a line no template reads folds only with lines of its own text
   * (T-720). Null for a death, never folded.
   */
  foldKey(line: LogLine): string | null {
    if (this.isDeath(line)) return null;
    if (line.key !== undefined) {
      const kind = this.kindOf(line.key);
      if (!kind.fields.some((field) => SUBJECT_FIELDS.has(field))) return `${kind.key}|`;
      const named = who(kind, kind.re.exec(line.text)) ?? (line.subject === undefined ? `text|${line.text}` : `#${line.subject}`);
      return `${kind.key}|${named}`;
    }
    for (const kind of this.kinds) {
      const named = who(kind, kind.re.exec(line.text));
      if (named !== null) return `${kind.key}|${named}`;
    }
    return `text|${line.text}`;
  }

  /**
   * A key's template as a pattern, made once; `get` with no params gives the template as written.
   * It ignores case, as the log capitalizes a line's first letter.
   */
  private kindOf(key: string): LineKind {
    let kind = this.byKey.get(key);
    if (kind === undefined) {
      kind = lineKind(key, this.strings.get(key), 0, 'si');
      this.byKey.set(key, kind);
    }
    return kind;
  }
}

/** The creature a line read back by its template names, '' for a template that names none; null when the text is not the template's. */
function who(kind: LineKind, match: RegExpExecArray | null): string | null {
  if (match === null) return null;
  return kind.fields.map((field, i) => SUBJECT_FIELDS.has(field) ? match[i + 1] : '').join('|');
}

/**
 * 24 § The legend record: the last words, from the alert and danger lines of the log (T-720). Lines
 * of one kind (one string key, and one creature for a line about one) fold into the newest, marked
 * with how many days they came ("! The restless dead rise. (14 days)"); a death is never folded.
 * Up to `LEGEND_LOG_LINES` lines, newest first; when there are more, deaths and danger lines are
 * kept before the other alerts.
 */
export function lastWords(log: readonly LogLine[], strings: Strings): string[] {
  const kinds = new LineKinds(strings);
  const groups = new Map<string, { lines: LogLine[]; order: number }>();
  const entries: { lines: LogLine[]; order: number }[] = [];
  log.forEach((line, order) => {
    if (line.severity !== 'alert' && line.severity !== 'danger') return;
    const key = kinds.foldKey(line);
    const open = key === null ? undefined : groups.get(key);
    if (open !== undefined) { open.lines.push(line); open.order = order; return; }
    const entry = { lines: [line], order };
    if (key !== null) groups.set(key, entry);
    entries.push(entry);
  });
  const newest = entries.sort((a, b) => b.order - a.order);
  const kept = new Set(newest.filter((entry) => isKeptFirst(entry.lines[0] as LogLine, kinds)).slice(0, LEGEND_LOG_LINES));
  for (const entry of newest) if (kept.size < LEGEND_LOG_LINES) kept.add(entry);
  return newest.filter((entry) => kept.has(entry)).map((entry) => {
    const last = entry.lines[entry.lines.length - 1] as LogLine;
    // A standing alert the log already folded (T-741) stands for its days in a row, up to its own.
    const dayset = new Set<number>();
    for (const line of entry.lines) for (let d = 0; d < (line.days ?? 1); d += 1) dayset.add(dayIndexOf(line.tick) - d);
    const days = dayset.size;
    if (days > 1) return strings.get('ui.legend.folded', { line: lineText({ ...last, count: 1, days: 1 }, strings), n: days });
    return lineText({ ...last, count: entry.lines.reduce((sum, line) => sum + line.count, 0), days: 1 }, strings);
  });
}

/** A death or a danger line: kept before the other alerts when the last words are full. */
function isKeptFirst(line: LogLine, kinds: LineKinds): boolean {
  return line.severity === 'danger' || kinds.isDeath(line);
}

function biomeName(registry: Registry, strings: Strings, id: string | undefined): string {
  if (id === undefined) return strings.get('ui.legend.biome_unknown');
  return registry.hasTable('biomes') ? registry.table<{ id: string; name: string }>('biomes').byId(id)?.name ?? id : id;
}

/** IndexedDB's `legends` store, with the same adapter as saves and settings. */
export class LegendStore {
  constructor(private readonly storage: StorageAdapter) {}
  write(record: LegendRecord): Promise<void> { return this.storage.put('legends', record.id, record); }
  read(id: string): Promise<LegendRecord | undefined> { return this.storage.get<LegendRecord>('legends', id); }
  async list(): Promise<LegendRecord[]> {
    const rows = await this.storage.all<LegendRecord>('legends');
    return rows.map((row) => row.value).sort((a, b) => b.endedTick - a.endedTick || a.id.localeCompare(b.id));
  }
}
