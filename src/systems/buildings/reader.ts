/**
 * `readers.of('14')`: `02-systems/14-buildings-and-rooms.md` § Interfaces › Reader. Records and
 * arrays returned are fresh copies; entity references are ids.
 */

import type { Building } from '@core/components';
import type { MoverOptions } from '@core/pathfinding';
import type { EntityId, MovementClass, TileIndex } from '@core/types';
import type { BuildingStore } from './build';
import type { ZoneStore } from './zones';

export interface BuildingView extends Building {
  readonly id: EntityId;
  /** The building type's content id. */
  readonly typeId: string;
}

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
  /** `buildings.at(i)`: the building on a tile, or 0. */
  at(i: TileIndex): EntityId;
  /** `buildings.get(id)` (a copy). */
  get(id: EntityId): BuildingView | undefined;
  /** The buildings of a type, ascending id. */
  byType(type: string): EntityId[];
  /** The buildings carrying a function tag, ascending id. */
  byTag(tag: string): EntityId[];
  /** 22's hook: a built building that is not passable blocks movement (doors by faction and class). */
  blocksMovementAt(i: TileIndex, cls: MovementClass, faction?: string, mover?: MoverOptions): boolean;
  /** A closed floodgate or raised bridge (04 reads it). */
  blocksFluidAt(i: TileIndex): boolean;
  /** A locked hatch: nothing falls through the tile. */
  blocksFallAt(i: TileIndex): boolean;
  /** 22's hooks. */
  doorAt(i: TileIndex): boolean;
  lockedHatchAt(i: TileIndex): boolean;
  blocksSightAt(i: TileIndex): boolean;
  /** Door open or closed for drawing: a creature stands in the doorway. */
  doorOpen(id: EntityId): boolean;
  /** `buildings.mechanismState(id)`: door/hatch mode (`locked` for an alert-locked door), floodgate `open`/`closed`, bridge `raised`/`lowered`, lever `on`/`off`. */
  mechanismState(id: EntityId): string;
  /** Built trade depots, ascending. */
  depots(): EntityId[];
  /** Built wells, ascending. */
  wells(): EntityId[];
  /** Whether a well has water within `WELL_DEPTH` below. */
  wellWorking(id: EntityId): boolean;
  /** Built coffins without an occupant, ascending. */
  freeCoffins(): EntityId[];
  /** The creature held in a cage building, or 0. */
  cageOccupant(id: EntityId): EntityId;
  /** The tile a building's container contents lie on (the wagon), or -1. */
  holderTile(id: EntityId): TileIndex;
  /** The wagon, or 0. */
  wagon(): EntityId;
  /** The hearth, or 0. */
  hearth(): EntityId;
  /** A building's contribution to wealth when built (`materialValue + valueBonus`). */
  value(id: EntityId): number;
}

export function makeReader(zones: ZoneStore, buildings: BuildingStore): BuildingsReader {
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
    at: (i) => zones.host.map.buildingAtTile(i),
    get: (id) => {
      const b = buildings.get(id);
      if (b === undefined) return undefined;
      return {
        ...b,
        footprint: b.footprint.slice(),
        linkedIds: b.linkedIds.slice(),
        settings: { ...b.settings },
        id,
        typeId: buildings.typeIdOf(id),
      };
    },
    byType: (type) => buildings.all().filter((id) => buildings.typeIdOf(id) === type),
    byTag: (tag) => buildings.all().filter((id) => buildings.row((buildings.get(id) as Building).type).tags.includes(tag)),
    blocksMovementAt: (i, cls, faction, mover) => buildings.blocksMovementAt(i, cls, faction, mover),
    blocksFluidAt: (i) => buildings.blocksFluidAt(i),
    blocksFallAt: (i) => buildings.lockedHatchAt(i),
    doorAt: (i) => buildings.doorAt(i),
    lockedHatchAt: (i) => buildings.lockedHatchAt(i),
    blocksSightAt: (i) => buildings.blocksSightAt(i),
    doorOpen: (id) => {
      const b = buildings.get(id);
      return b !== undefined && b.state === 'built' && !buildings.doorLocked(b) && b.footprint.some((t) => buildings.host.creaturesAt(t).length > 0);
    },
    mechanismState: (id) => {
      const b = buildings.get(id);
      if (b === undefined) return '';
      const tags = buildings.row(b.type).tags;
      if (tags.includes('door')) return buildings.doorLocked(b) ? 'locked' : b.mode;
      if (tags.includes('hatch')) return b.mode;
      if (tags.includes('floodgate')) return b.toggled ? 'open' : 'closed';
      if (tags.includes('bridge')) return b.toggled ? 'raised' : 'lowered';
      if (tags.includes('lever')) return b.toggled ? 'on' : 'off';
      return '';
    },
    depots: () => buildings.depots.slice(),
    wells: () => buildings.all().filter((id) => (buildings.get(id) as Building).state === 'built' && buildings.row((buildings.get(id) as Building).type).tags.includes('well')),
    wellWorking: (id) => buildings.wellWorking(id),
    freeCoffins: () => buildings.coffins.filter((id) => ((buildings.get(id)?.settings['occupantId'] as number | undefined) ?? 0) === 0),
    cageOccupant: (id) => (buildings.get(id)?.settings['occupantId'] as number | undefined) ?? 0,
    holderTile: (id) => buildings.holderTile(id),
    wagon: () => buildings.all().find((id) => buildings.typeIdOf(id) === 'wagon') ?? 0,
    hearth: () => buildings.hearthId,
    value: (id) => {
      const b = buildings.get(id);
      return b === undefined || b.state !== 'built' ? 0 : buildings.valueOf(b);
    },
  };
}
