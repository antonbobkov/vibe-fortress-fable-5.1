/**
 * Threats reader implementation: `02-systems/18-threats-monsters-and-raids.md` § Reader.
 */

import { C, type Party } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { EntityId } from '@core/types';
import type { ThreatScheduleEntry } from './schedule';

export interface ThreatsReader {
  activeParties(): readonly EntityId[];
  party(id: EntityId): Party | undefined;
  partyOf(creatureId: EntityId): Party | undefined;
  isHostile(id: EntityId): boolean;
  isStealthed(id: EntityId): boolean;
  isSpotted(id: EntityId): boolean;
  renown(): number;
  schedulePreview(): Readonly<Record<string, string>>;
  deepPressure(): number;
  deepLevel(): number;
  deepNextThreshold(): number;
  monstersInCavern(n: number): number;
}

export function makeThreatsReader(
  entities: EntityStore,
  getRenown: () => number,
  getSchedule: () => ReadonlyMap<string, ThreatScheduleEntry>,
  getDeepPressure: () => number,
  getDeepLevel: () => number,
): ThreatsReader {
  return {
    activeParties: () => {
      const parties: EntityId[] = [];
      for (const id of entities.with(C.Party)) {
        if (entities.alive(id)) parties.push(id);
      }
      return parties;
    },
    party: (id: EntityId) => entities.get(id, C.Party),
    partyOf: (creatureId: EntityId) => {
      const h = entities.get(creatureId, C.Hostile);
      return h && h.partyId !== 0 ? entities.get(h.partyId, C.Party) : undefined;
    },
    isHostile: (id: EntityId) => entities.has(id, C.Hostile),
    isStealthed: (id: EntityId) => entities.get(id, C.Hostile)?.stealthed === true,
    isSpotted: (id: EntityId) => entities.get(id, C.Hostile)?.spotted === true,
    renown: getRenown,
    schedulePreview: () => {
      const preview: Record<string, string> = {};
      for (const [kind, entry] of getSchedule()) {
        if (entry.earliestTick < 0) {
          preview[kind] = 'never';
        } else {
          const dayIndex = Math.floor(entry.earliestTick / 1200);
          const year = Math.floor(dayIndex / 112) + 1;
          const seasonIdx = Math.floor((dayIndex % 112) / 28);
          const seasonName = ['Spring', 'Summer', 'Autumn', 'Winter'][seasonIdx] ?? 'Spring';
          preview[kind] = `possible from ${seasonName}, Year ${year}`;
        }
      }
      return preview;
    },
    deepPressure: getDeepPressure,
    deepLevel: getDeepLevel,
    deepNextThreshold: () => 50,
    monstersInCavern: () => 0,
  };
}
