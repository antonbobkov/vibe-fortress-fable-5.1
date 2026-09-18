/**
 * `readers.of('14')`: `02-systems/14-buildings-and-rooms.md` § Interfaces › Reader. Records and
 * arrays returned are fresh copies; entity references are ids.
 */

import type { EntityId, TileIndex } from '@core/types';
import type { ZoneStore } from './zones';

export interface ZoneView {
  readonly id: EntityId;
  /** The zone type's content id (`stockpile`, `farm_plot`, …). */
  readonly type: string;
  /** Ascending. */
  readonly tiles: readonly TileIndex[];
  readonly settings: Readonly<Record<string, unknown>>;
}

export interface BuildingsReader {
  /** The zone on a tile, or 0. */
  zoneAt(i: TileIndex): EntityId;
  /** Every zone on a tile (a meeting area may lie over a hall), ascending. */
  zonesAt(i: TileIndex): EntityId[];
  zone(id: EntityId): ZoneView | undefined;
  /** The zones of a type, ascending id. */
  zonesOfType(type: string): EntityId[];
  zoneSetting(id: EntityId, key: string): unknown;
  /** Whether a tile qualifies for a zone type (the zone tool's green). */
  zoneTileQualifies(type: string, i: TileIndex): boolean;
}

export function makeReader(zones: ZoneStore): BuildingsReader {
  const view = (id: EntityId): ZoneView | undefined => {
    const z = zones.zone(id);
    if (z === undefined) return undefined;
    return { id, type: zones.typeIdOf(id), tiles: z.tiles.slice(), settings: { ...z.settings } };
  };
  return {
    zoneAt: (i) => zones.zoneAt.get(i) ?? 0,
    zonesAt: (i) => zones.zonesAt(i),
    zone: view,
    zonesOfType: (type) => zones.all().filter((id) => zones.typeIdOf(id) === type),
    zoneSetting: (id, key) => zones.zone(id)?.settings[key],
    zoneTileQualifies: (type, i) => {
      const t = zones.typeOf(type);
      return t !== 0 && zones.qualifies(t, i);
    },
  };
}
