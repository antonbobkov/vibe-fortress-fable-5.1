/**
 * 08 § Pastures and feeding, as the player reads it: what a pasture's grass feeds against the grazers
 * on it. The zone inspector's capacity lines, the Animals panel's `[p]` notice and the starving alert
 * all say it in the same words ("Pasture #1 feeds 0 of 6 grazers"). Presentation only.
 */

import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { EntityId } from '@core/types';
import type { AnimalsReader } from '@systems/animals';
import { GRASS_PER_GRAZER, SHRUB_GRAZE_WEIGHT } from '@systems/animals/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { PlantsReader } from '@systems/plants';
import type { Strings } from './strings';

/** A pasture's feed: its grass and grazing shrubs, the grazers they feed, and the grazers and animals on it. */
export interface PastureFeed {
  readonly grass: number;
  readonly shrubs: number;
  /** `floor((grass + shrubs / SHRUB_GRAZE_WEIGHT) / GRASS_PER_GRAZER)`. */
  readonly supported: number;
  /** Tame grazers assigned to it. */
  readonly grazers: number;
  /** Tame animals of any diet assigned to it. */
  readonly animals: number;
}

/**
 * The feed of pasture `zoneId`, or null when there is no such pasture. `moving` are animals about to be
 * put on it (the Animals panel's `[p]`): they count as on it, wherever they are now.
 */
export function pastureFeed(readers: ReaderSet, zoneId: EntityId, moving: readonly EntityId[] = []): PastureFeed | null {
  if (!readers.has('14') || !readers.has('08')) return null;
  const zone = readers.of<BuildingsReader>('14').zone(zoneId);
  if (zone === undefined || zone.type !== 'pasture') return null;
  const animals = readers.of<AnimalsReader>('08');
  const plants = readers.has('07') ? readers.of<PlantsReader>('07') : null;
  const grass = plants === null ? 0 : zone.tiles.filter((tile) => plants.hasGrass(tile)).length;
  // 08 § Grazing shrubs: a grazable shrub counts as 1 / SHRUB_GRAZE_WEIGHT of a grass tile.
  const shrubs = plants === null ? 0 : zone.tiles.filter((tile) => {
    const def = plants.def(plants.speciesAt(tile));
    return def?.graze === true && def.kind === 'shrub';
  }).length;
  const supported = Math.floor((grass + shrubs / SHRUB_GRAZE_WEIGHT) / GRASS_PER_GRAZER);
  const moved = new Set(moving);
  const on = [...animals.tameList().filter((id) => !moved.has(id) && animals.pastureOf(id) === zoneId), ...moved];
  const grazes = (id: EntityId): boolean => animals.def(readers.entities.get(id, C.Creature)?.species ?? 0)?.diet === 'grazer';
  return { grass, shrubs, supported, grazers: on.filter(grazes).length, animals: on.length };
}

/** Whether a pasture holds more grazers than its grass feeds. */
export function overGrazed(feed: PastureFeed): boolean {
  return feed.grazers > feed.supported;
}

/** "Feeds 0 of 6 grazers"; with no grazer on it, what it would feed: "Feeds 2 grazers". */
export function feedsText(strings: Strings, feed: PastureFeed): string {
  return feed.grazers === 0 ? strings.get('ui.zone.pasture.feeds_none', { n: feed.supported })
    : strings.get('ui.zone.pasture.feeds', { fed: Math.min(feed.supported, feed.grazers), n: feed.grazers });
}

/** "35 grass; 48 a grazer", "12 grass, 30 grazing shrubs; 48 a grazer". */
export function feedDetailText(strings: Strings, feed: PastureFeed): string {
  return feed.shrubs > 0 ? strings.get('ui.zone.pasture.grass_shrubs', { grass: feed.grass, shrubs: feed.shrubs, per: GRASS_PER_GRAZER })
    : strings.get('ui.zone.pasture.grass', { grass: feed.grass, per: GRASS_PER_GRAZER });
}
