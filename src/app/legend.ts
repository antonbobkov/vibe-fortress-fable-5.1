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
export function endText(tick: number, population: number, reason: EndReason, strings: Strings = new Strings()): string {
  if (reason.kind === 'retired') return `Retired in Year ${Math.floor(tick / TICKS_PER_YEAR) + 1} with ${population} dwarves.`;
  if (reason.kind === 'abandoned') return `Abandoned in Year ${Math.floor(tick / TICKS_PER_YEAR) + 1} by ${population} dwarves.`;
  const who = `The last dwarf, ${reason.lastName},`;
  const killer = reason.lastKiller ?? '';
  const key = deathLineKey(strings, reason.lastCause, killer);
  const how = key === null ? strings.get('announce.dwarf_died', { dwarf: who }) : strings.get(key, { name: who, killer });
  return `The hall fell silent on ${formatDate(tick)}. ${how}`;
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
  return {
    id: finalSaveId(fortress.name),
    name: fortress.name,
    seed: game.world.seed,
    region: region?.name ?? `Region ${fortress.regionId}`,
    regionId: fortress.regionId,
    // The biome by its name ("forest"), never its content id.
    biome: biomeName(registry, region?.biome ?? spec?.biome),
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
      .slice(0, LEGEND_NOTABLE_KILLS).map((entry) => `${entry.name} slew ${entry.count} ${entry.count === 1 ? 'enemy' : 'enemies'}.`),
    lastWords: lastWords(log, new Strings(registry)),
    cause: endText(tick, population, reason, new Strings(registry)),
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
 * placeholder never claims a line.
 */
function lineKinds(strings: Strings): LineKind[] {
  const kinds: LineKind[] = [];
  for (const [key, template] of strings.templates('announce.')) {
    const literal = template.replace(PLACEHOLDER, '').replace(/\s/g, '').length;
    if (literal < 4 || !/[.!?"]$/.test(template)) continue;
    const fields: string[] = [];
    let source = '';
    let at = 0;
    for (const match of template.matchAll(PLACEHOLDER)) {
      source += `${escapeRegExp(template.slice(at, match.index))}(.+?)`;
      fields.push(match[1] as string);
      at = match.index + match[0].length;
    }
    source += escapeRegExp(template.slice(at));
    kinds.push({ key, re: new RegExp(`^${source}$`, 's'), fields, literal });
  }
  return kinds.sort((a, b) => b.literal - a.literal || a.key.localeCompare(b.key));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * What a line folds by (T-720): its string key and, for a line about one creature, that creature;
 * a line no template reads back folds only with its own text. Null for a death, never folded.
 */
function foldKey(text: string, kinds: readonly LineKind[], deaths: readonly LineKind[]): string | null {
  if (deaths.some((kind) => kind.re.test(text))) return null;
  for (const kind of kinds) {
    const match = kind.re.exec(text);
    if (match === null) continue;
    const who = kind.fields.map((field, i) => SUBJECT_FIELDS.has(field) ? match[i + 1] : '').join('|');
    return `${kind.key}|${who}`;
  }
  return `text|${text}`;
}

/**
 * 24 § The legend record: the last words, from the alert and danger lines of the log (T-720). Lines
 * of one kind (one string key, and one creature for a line about one) fold into the newest, marked
 * with how many days they came ("! The restless dead rise. (14 days)"); a death is never folded.
 * Up to `LEGEND_LOG_LINES` lines, newest first; when there are more, deaths and danger lines are
 * kept before the other alerts.
 */
export function lastWords(log: readonly LogLine[], strings: Strings = new Strings()): string[] {
  const all = lineKinds(strings);
  const deaths = all.filter((kind) => DEATH_KEY.test(kind.key));
  const kinds = all.filter((kind) => !DEATH_KEY.test(kind.key));
  const groups = new Map<string, { lines: LogLine[]; order: number }>();
  const entries: { lines: LogLine[]; order: number }[] = [];
  log.forEach((line, order) => {
    if (line.severity !== 'alert' && line.severity !== 'danger') return;
    const key = foldKey(line.text, kinds, deaths);
    const open = key === null ? undefined : groups.get(key);
    if (open !== undefined) { open.lines.push(line); open.order = order; return; }
    const entry = { lines: [line], order };
    if (key !== null) groups.set(key, entry);
    entries.push(entry);
  });
  const newest = entries.sort((a, b) => b.order - a.order);
  const kept = new Set(newest.filter((entry) => isKeptFirst(entry.lines[0] as LogLine, deaths)).slice(0, LEGEND_LOG_LINES));
  for (const entry of newest) if (kept.size < LEGEND_LOG_LINES) kept.add(entry);
  return newest.filter((entry) => kept.has(entry)).map((entry) => {
    const last = entry.lines[entry.lines.length - 1] as LogLine;
    const days = new Set(entry.lines.map((line) => dayIndexOf(line.tick))).size;
    if (days > 1) return strings.get('ui.legend.folded', { line: lineText({ ...last, count: 1 }), n: days });
    return lineText({ ...last, count: entry.lines.reduce((sum, line) => sum + line.count, 0) });
  });
}

/** A death or a danger line: kept before the other alerts when the last words are full. */
function isKeptFirst(line: LogLine, deaths: readonly LineKind[]): boolean {
  return line.severity === 'danger' || deaths.some((kind) => kind.re.test(line.text));
}

function biomeName(registry: Registry, id: string | undefined): string {
  if (id === undefined) return 'unknown';
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
