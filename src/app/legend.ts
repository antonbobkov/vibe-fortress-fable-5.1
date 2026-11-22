/** The permanent record of a finished fortress (24 § The legend record). */
import { formatDate } from '@core/calendar';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import type { Registry } from '@core/registry';
import type { StorageAdapter } from '@platform/storage';
import type { WorldMap } from '@systems/worldgen';
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
    peakPopulation: Math.max(journal.peakPopulation(), fortress.populationCached),
    deepestLevel: Math.max(0, surfaceZ - journal.deepestZ()),
    finalWealth: fortress.wealthCached,
    milestones: fortress.milestones.map((entry) => ({
      id: entry.id,
      date: formatDate(entry.tick),
      text: milestoneTable.byId(entry.id)?.text ?? entry.id,
    })),
    killsOfNote: journal.kills().filter((entry) => entry.count > 0)
      .slice(0, LEGEND_NOTABLE_KILLS).map((entry) => `${entry.name} slew ${entry.count} ${entry.count === 1 ? 'enemy' : 'enemies'}.`),
    lastWords: log.filter((line) => line.severity === 'alert' || line.severity === 'danger')
      .slice(-LEGEND_LOG_LINES).map(lineText),
    cause: endText(tick, fortress.populationCached, reason, new Strings(registry)),
    ...(fortress.testing === true ? { testing: true } : {}),
  };
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
