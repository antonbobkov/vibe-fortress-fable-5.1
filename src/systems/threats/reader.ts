/**
 * Threats reader implementation: `02-systems/18-threats-monsters-and-raids.md` § Reader.
 */

import { SEASON_NAMES } from '@core/calendar';
import { C, type Party } from '@core/components';
import { DAYS_PER_SEASON, DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import type { EntityStore } from '@core/entities';
import type { EntityId, TileIndex } from '@core/types';
import type { ThreatScheduleEntry } from './schedule';
import type { PendingArrivalState } from './state';
import { hasMorale, moraleOf, moraleWord, type MoraleWord } from './morale';

/** A party that a `ThreatWarning` has announced and that has not arrived yet (18 § Arrival and warning). */
export interface ComingParty {
  readonly kind: string;
  readonly civ: string;
  /** The warning's size band, never the exact count; the UI words it ("a horde of Gloam"). */
  readonly sizeBand: SizeBand;
  readonly edge: 'n' | 'e' | 's' | 'w';
  readonly arrivalTick: number;
}

/** When a threat kind is first possible: a season and a year (1 is the first), never the exact tick. */
export interface SchedulePreview {
  readonly season: (typeof SEASON_NAMES)[number];
  readonly year: number;
}

/** A warned party's size band (18 § Arrival and warning): fewer than 6, 6 to 15, more. */
export type SizeBand = 'few' | 'band' | 'horde';

/** The warning's size band of a party of `size` (18 § Arrival and warning). */
export function sizeBandOf(size: number): SizeBand {
  return size < 6 ? 'few' : size <= 15 ? 'band' : 'horde';
}

export interface ThreatsReader {
  activeParties(): readonly EntityId[];
  party(id: EntityId): Party | undefined;
  partyOf(creatureId: EntityId): Party | undefined;
  /** 18 § Morale: a party's morale in words ('' for a party without morale or no party). */
  moraleWord(partyId: EntityId): MoraleWord | '';
  isHostile(id: EntityId): boolean;
  isStealthed(id: EntityId): boolean;
  isSpotted(id: EntityId): boolean;
  renown(): number;
  /** Per kind, the season and year it is first possible in, or `null` for a kind that never comes; never the exact next date. */
  schedulePreview(): Readonly<Record<string, SchedulePreview | null>>;
  /** 18 § Schedule peril: the peril whose rows the schedule reads, the region's plus renown's steps. */
  schedulePeril(): number;
  /** 18 § Schedule peril: the renown at which the schedule next reads a higher peril, or `null` where it cannot. */
  nextPerilRenown(): number | null;
  deepPressure(): number;
  deepLevel(): number;
  deepNextThreshold(): number;
  monstersInCavern(n: number): number;
  /** The living, uncaged monsters of cavern `n`, ascending (the Threats panel reads which can reach the halls). */
  cavernMonsters(n: number): EntityId[];
  /** The warned parties still to come, soonest first. */
  coming(): readonly ComingParty[];
  /** The living Hollow-born, ascending (the Threats panel's Deep count). */
  hollowBorn(): EntityId[];
  /** The tile the next emergence would crack at (§ The Deep), or -1 with no base. */
  emergenceBase(): TileIndex;
}

export function makeThreatsReader(
  entities: EntityStore,
  getRenown: () => number,
  getSchedule: () => ReadonlyMap<string, ThreatScheduleEntry>,
  getDeepPressure: () => number,
  getDeepLevel: () => number,
  getMonstersInCavern?: (n: number) => number,
  getDeepNextThreshold?: () => number,
  getPendingArrivals?: () => readonly PendingArrivalState[],
  getCavernMonsters?: (n: number) => EntityId[],
  getHollowBorn?: () => EntityId[],
  getEmergenceBase?: () => TileIndex,
  getNextPerilRenown?: () => number | null,
): ThreatsReader {
  return {
    activeParties: () => {
      const parties: EntityId[] = [];
      for (const id of entities.with(C.Party)) {
        if (entities.alive(id)) {
          const p = entities.get(id, C.Party);
          if (p && p.state !== 'gone') parties.push(id);
        }
      }
      return parties;
    },
    party: (id: EntityId) => entities.get(id, C.Party),
    partyOf: (creatureId: EntityId) => {
      const h = entities.get(creatureId, C.Hostile);
      return h && h.partyId !== 0 ? entities.get(h.partyId, C.Party) : undefined;
    },
    moraleWord: (partyId: EntityId) => {
      const p = entities.get(partyId, C.Party);
      return p !== undefined && hasMorale(p) ? moraleWord(moraleOf(p)) : '';
    },
    isHostile: (id: EntityId) => entities.has(id, C.Hostile),
    isStealthed: (id: EntityId) => entities.get(id, C.Hostile)?.stealthed === true,
    isSpotted: (id: EntityId) => entities.get(id, C.Hostile)?.spotted === true,
    renown: getRenown,
    schedulePreview: () => {
      const preview: Record<string, SchedulePreview | null> = {};
      for (const [kind, entry] of getSchedule()) {
        if (entry.earliestTick < 0) {
          preview[kind] = null;
        } else {
          const dayIndex = Math.floor(entry.earliestTick / TICKS_PER_DAY);
          const year = Math.floor(dayIndex / DAYS_PER_YEAR) + 1;
          const season = SEASON_NAMES[Math.floor((dayIndex % DAYS_PER_YEAR) / DAYS_PER_SEASON)] ?? 'spring';
          preview[kind] = { season, year };
        }
      }
      return preview;
    },
    schedulePeril: () => getSchedule().get('thief')?.peril ?? 0,
    nextPerilRenown: () => getNextPerilRenown?.() ?? null,
    deepPressure: getDeepPressure,
    deepLevel: getDeepLevel,
    deepNextThreshold: () => getDeepNextThreshold?.() ?? 50,
    monstersInCavern: (n: number) => getMonstersInCavern?.(n) ?? 0,
    cavernMonsters: (n: number) => getCavernMonsters?.(n) ?? [],
    hollowBorn: () => getHollowBorn?.() ?? [],
    emergenceBase: () => getEmergenceBase?.() ?? -1,
    coming: () => (getPendingArrivals?.() ?? [])
      .filter((a) => a.warningEmitted)
      .map((a) => ({ kind: a.kind, civ: a.civ, sizeBand: sizeBandOf(a.size), edge: a.edge, arrivalTick: a.arrivalTick }))
      .sort((a, b) => a.arrivalTick - b.arrivalTick),
  };
}
