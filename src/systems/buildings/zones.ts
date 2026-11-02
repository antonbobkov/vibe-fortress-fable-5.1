/**
 * Zones: `02-systems/14-buildings-and-rooms.md` § Zones, `03-content/buildings-and-furniture.md`
 * § Zone types, and the command-catalog rows `CreateZone` ("tiles walkable (type-specific), no
 * overlap (`overlap`), fishing and farm tile rules"), `ResizeZone` / `RemoveZone` /
 * `SetZoneSetting` ("zone exists; setting key valid for the type").
 *
 * Tile rules by type: every zone needs walkable tiles; a farm plot needs `floor` of material class
 * `soil`, or the `mud` flag, or cavern `cave_loam` (`07` § Farm plots); a fishing zone needs a
 * cardinal shore with deep, unfrozen water on the same level or below a bounded open-air drop
 * (`09` § Fishing). A command
 * whose tiles do not all qualify is rejected whole (`bad_zone_tiles`); the zone tool submits only
 * the tiles that qualify (D-071).
 */

import { C, type Zone } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import { PRIORITY_MAX, PRIORITY_MIN, SEASONS_PER_YEAR } from '@core/constants';
import { TileFlag, TileKind, isSolidBottomed, type Map3D } from '@core/map3d';
import type { EntityStore } from '@core/entities';
import type { GameEvent } from '@core/events';
import type { PathingReader } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, Idx, TileIndex } from '@core/types';
import { validHospitalSupplies } from '@systems/health/supplies';
import { waterOfBank } from '@systems/foraging/fishing';
import { cropChoice, plotKindOf } from '@systems/plants/plots';
import type { PlantRow } from '@systems/plants/facts';

export interface ZoneTypeRow {
  readonly id: string;
  readonly name: string;
  readonly room: boolean;
  readonly requirements: readonly string[];
  readonly settings: readonly string[];
  readonly consumers: readonly string[];
}

interface MaterialRow {
  readonly id: string;
  readonly class: string;
}

/** The zone types a meeting area may overlap (14: "except `meeting_area` may overlap `hearth_hall` and `dining_hall`"). */
const MEETING_OVERLAPS: readonly string[] = ['hearth_hall', 'dining_hall'];
const MEETING = 'meeting_area';

/** The farm plot zone type, whose tiles must be all lit or all dark (`07` § Farm plots). */
const FARM_PLOT_ZONE = 'farm_plot';

/** Stockpile settings live in 13's `Stockpile` component and are set by 13's commands (D-071). */
const STOCKPILE_OWNED_SETTINGS: readonly string[] = ['filter', 'containers', 'priority', 'links'];

export interface ZoneHost {
  readonly map: Map3D;
  readonly entities: EntityStore;
  readonly registry: Registry;
  pathing(): PathingReader | null;
  assignRoom?(zoneId: EntityId, dwarfId: EntityId): CommandResult;
  cropLitAt?(tile: TileIndex): boolean;
  lampCoveredAt?(tile: TileIndex): boolean;
  emit(event: GameEvent): void;
}

/** A settings key as a command may give it: the document's words or their snake_case form. */
export function settingKey(raw: string): string {
  return raw.trim().replace(/\s+/g, '_');
}

export class ZoneStore {
  readonly host: ZoneHost;
  /** One zone per tile (the meeting area over a hall stays in its own tile list). */
  readonly zoneAt = new Map<TileIndex, EntityId>();
  /** Told of every zone created, resized, set or removed, before the `ZoneChanged` goes out (rooms, T-M2-07). */
  onChange: (zoneId: EntityId, typeId: string, change: string) => void = () => {};
  private readonly types: (ZoneTypeRow | undefined)[] = [];
  private readonly typeIndex = new Map<string, number>();
  private readonly caveLoam: number;
  private readonly soilMaterials: Set<number>;

  constructor(host: ZoneHost) {
    this.host = host;
    const table = host.registry.table<ZoneTypeRow>('zoneTypes');
    for (let t = 1; t <= table.size; t += 1) {
      const row = table.byIndex(t) as ZoneTypeRow;
      this.types[t] = row;
      this.typeIndex.set(row.id, t);
    }
    const materials = host.registry.table<MaterialRow>('materials');
    this.caveLoam = materials.has('cave_loam') ? materials.index('cave_loam') : -1;
    this.soilMaterials = new Set<number>();
    for (let m = 1; m <= materials.size; m += 1) if (materials.byIndex(m)?.class === 'soil') this.soilMaterials.add(m);
  }

  typeOf(id: string | number): number {
    return typeof id === 'number' ? (this.types[id] === undefined ? 0 : id) : (this.typeIndex.get(id) ?? 0);
  }

  typeRow(type: number): ZoneTypeRow | undefined {
    return this.types[type];
  }

  zone(id: EntityId): Zone | undefined {
    return this.host.entities.get(id, C.Zone);
  }

  typeIdOf(id: EntityId): string {
    const z = this.zone(id);
    return z === undefined ? '' : (this.types[z.type]?.id ?? '');
  }

  /** Every zone, ascending id. */
  all(): EntityId[] {
    return this.host.entities.with(C.Zone);
  }

  /** The zones on a tile: the tile's zone and any meeting area over it. */
  zonesAt(i: TileIndex): EntityId[] {
    const out: EntityId[] = [];
    const main = this.zoneAt.get(i);
    if (main !== undefined) out.push(main);
    for (const id of this.all()) {
      if (id === main || this.typeIdOf(id) !== MEETING) continue;
      if (binaryHas((this.zone(id) as Zone).tiles, i)) out.push(id);
    }
    return out.sort((a, b) => a - b);
  }

  // ---------- tile rules ----------

  private walkable(i: TileIndex): boolean {
    const map = this.host.map;
    // A building on a floor keeps the tile a floor: furniture, a hearth or a door may lie inside a
    // zone (14: "furniture may be placed inside a zone"; a hearth hall "contains the hearth"). D-075.
    if (map.buildingAtTile(i) !== 0 && map.kindAt(i) === TileKind.Floor) return true;
    const pathing = this.host.pathing();
    if (pathing !== null) return pathing.passable(i, 'walker');
    return isSolidBottomed(map.kindAt(i));
  }

  /** `07` § Farm plots: floor of class soil, or mud, or cave loam. */
  private farmable(i: TileIndex): boolean {
    const map = this.host.map;
    if (map.kindAt(i) !== TileKind.Floor) return false;
    const m = map.materialAt(i);
    return this.soilMaterials.has(m) || map.hasFlag(i, TileFlag.Mud) || m === this.caveLoam;
  }

  /** `09` § Fishing: the same cardinal shore lookup used by fishing jobs. */
  private fishable(i: TileIndex): boolean {
    return waterOfBank(this.host.map, i) >= 0;
  }

  /** Whether a tile qualifies for a zone type (the green of the zone tool). */
  qualifies(type: number, i: TileIndex): boolean {
    const map = this.host.map;
    if (!map.validIndex(i)) return false;
    const id = this.types[type]?.id ?? '';
    // 14 § Zones permits gather zones to include the shrub itself, which is not walkable.
    if (id === 'gather' && map.kindAt(i) === TileKind.Shrub) return true;
    if (!this.walkable(i)) return false;
    if (id === FARM_PLOT_ZONE) return this.farmable(i);
    if (id === 'fishing') return this.fishable(i);
    return true;
  }

  /** The zone a tile would collide with, or 0 (`except` names a zone being resized). */
  private overlapOn(type: number, i: TileIndex, except: EntityId): EntityId {
    const id = this.types[type]?.id ?? '';
    const main = this.zoneAt.get(i);
    if (main !== undefined && main !== except) {
      const other = this.typeIdOf(main);
      const allowed = (id === MEETING && MEETING_OVERLAPS.includes(other)) || (other === MEETING && MEETING_OVERLAPS.includes(id));
      if (!allowed) return main;
    }
    if (id === MEETING) {
      // A meeting area never overlaps another meeting area.
      for (const z of this.zonesAt(i)) if (z !== except && this.typeIdOf(z) === MEETING) return z;
    }
    return 0;
  }

  private tilesOf(raw: unknown): TileIndex[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const out = new Set<TileIndex>();
    for (const t of raw as unknown[]) {
      if (typeof t !== 'number' || !Number.isInteger(t) || !this.host.map.validIndex(t)) return null;
      out.add(t);
    }
    return Array.from(out).sort((a, b) => a - b);
  }

  private validate(type: number, tiles: readonly TileIndex[], except: EntityId): CommandResult {
    for (const t of tiles) if (!this.qualifies(type, t)) return reject('bad_zone_tiles');
    // `07` § Farm plots: "a plot with any `lit` tile is a surface plot; a plot with no `lit` tile is
    // a cave plot; mixed plots are refused" (T-M4-01).
    if (this.types[type]?.id === FARM_PLOT_ZONE && this.mixedLight(tiles)) return reject('bad_zone_tiles');
    for (const t of tiles) if (this.overlapOn(type, t, except) !== 0) return reject('overlap');
    return OK;
  }

  /** True when a tile set holds both lit and unlit tiles. */
  private mixedLight(tiles: readonly TileIndex[]): boolean {
    let lit = 0;
    for (const t of tiles) if (this.host.map.hasFlag(t, TileFlag.Lit)) lit += 1;
    return lit > 0 && lit < tiles.length;
  }

  // ---------- commands ----------

  /** `CreateZone { type, tiles }`. The new zone's id is returned through `created`. */
  create(cmd: Command, created?: (id: EntityId) => void): CommandResult {
    const type = this.typeOf(typeof cmd['zoneType'] === 'string' || typeof cmd['zoneType'] === 'number' ? (cmd['zoneType'] as string | number) : '');
    if (type === 0) return reject('not_found');
    const tiles = this.tilesOf(cmd['tiles']);
    if (tiles === null) return reject('out_of_bounds');
    const ok = this.validate(type, tiles, 0);
    if (!ok.ok) return ok;
    const id = this.host.entities.create('zone');
    this.host.entities.add(id, C.Zone, { type: type as Idx<'ZoneTypeDef'>, tiles, settings: {} });
    this.claim(id, tiles);
    created?.(id);
    this.changed(id, 'created');
    return OK;
  }

  /** `ResizeZone { zoneId, tiles }`: the zone's tiles become exactly the given set. */
  resize(cmd: Command): CommandResult {
    const id = cmd['zoneId'];
    const zone = typeof id === 'number' ? this.zone(id) : undefined;
    if (zone === undefined) return reject('not_found');
    const tiles = this.tilesOf(cmd['tiles']);
    if (tiles === null) return reject('out_of_bounds');
    const ok = this.validate(zone.type, tiles, id as EntityId);
    if (!ok.ok) return ok;
    this.release(id as EntityId, zone.tiles);
    this.host.entities.add(id as EntityId, C.Zone, { ...zone, tiles });
    this.claim(id as EntityId, tiles);
    this.changed(id as EntityId, 'resized');
    return OK;
  }

  /** `RemoveZone { zoneId }`. */
  remove(cmd: Command): CommandResult {
    const id = cmd['zoneId'];
    const zone = typeof id === 'number' ? this.zone(id) : undefined;
    if (zone === undefined) return reject('not_found');
    const typeId = this.types[zone.type]?.id ?? '';
    this.release(id as EntityId, zone.tiles);
    this.host.entities.destroy(id as EntityId);
    this.onChange(id as EntityId, typeId, 'removed');
    this.host.emit({ type: 'ZoneChanged', zoneId: id, zoneType: typeId, change: 'removed', tiles: zone.tiles.slice() });
    return OK;
  }

  /** `SetZoneSetting { zoneId, key, value }`: "setting key valid for the type" (`bad_setting`). */
  setSetting(cmd: Command): CommandResult {
    const id = cmd['zoneId'];
    const zone = typeof id === 'number' ? this.zone(id) : undefined;
    if (zone === undefined) return reject('not_found');
    const key = typeof cmd['key'] === 'string' ? settingKey(cmd['key']) : '';
    const row = this.types[zone.type];
    const keys = (row?.settings ?? []).map(settingKey);
    if (!keys.includes(key)) return reject('bad_setting');
    if (row?.id === 'stockpile' && STOCKPILE_OWNED_SETTINGS.includes(key)) return reject('bad_setting');
    let value = cmd['value'];
    let storedKey = key;
    if (key === 'desired_supplies') {
      if (!validHospitalSupplies(value)) return reject('bad_setting');
      value = { ...value };
      storedKey = 'desired supplies';
    } else if (key === 'squad') {
      if (typeof value !== 'number' || !Number.isInteger(value) ||
          (value !== 0 && !this.host.entities.with(C.Squad).includes(value))) return reject('bad_setting');
    } else if (key === 'owner') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || this.host.assignRoom === undefined ||
          !this.host.assignRoom(id as EntityId, value).ok) return reject('bad_setting');
    } else if (key === 'crop_per_season') {
      if (!Array.isArray(value) || value.length !== SEASONS_PER_YEAR) return reject('bad_setting');
      const crops: number[] = [];
      const kind = plotKindOf(this.host.map, zone.tiles, (tile) => this.host.cropLitAt?.(tile) ?? this.host.map.hasFlag(tile, TileFlag.Lit),
        (tile) => this.host.lampCoveredAt?.(tile) ?? false);
      for (const raw of value as unknown[]) {
        const choice = cropChoice(raw, this.host.registry.table<PlantRow>('plants'), kind);
        if (!choice.ok) return reject('bad_setting');
        crops.push(choice.plant);
      }
      value = crops;
    } else if (key === 'priority') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < PRIORITY_MIN || value > PRIORITY_MAX) return reject('bad_setting');
    } else return reject('bad_setting');
    this.host.entities.add(id as EntityId, C.Zone, { ...zone, settings: { ...zone.settings, [storedKey]: value } });
    this.changed(id as EntityId, 'settings');
    return OK;
  }

  private claim(id: EntityId, tiles: readonly TileIndex[]): void {
    const meeting = this.typeIdOf(id) === MEETING;
    for (const t of tiles) {
      if (meeting && this.zoneAt.has(t)) continue;
      this.zoneAt.set(t, id);
    }
  }

  private release(id: EntityId, tiles: readonly TileIndex[]): void {
    for (const t of tiles) {
      if (this.zoneAt.get(t) !== id) continue;
      this.zoneAt.delete(t);
      // A meeting area that lay under the removed hall takes the tile back.
      for (const z of this.all()) {
        if (z === id || this.typeIdOf(z) !== MEETING) continue;
        if (binaryHas((this.zone(z) as Zone).tiles, t)) {
          this.zoneAt.set(t, z);
          break;
        }
      }
    }
  }

  private changed(id: EntityId, change: 'created' | 'resized' | 'settings'): void {
    const zone = this.zone(id) as Zone;
    this.onChange(id, this.typeIdOf(id), change);
    this.host.emit({ type: 'ZoneChanged', zoneId: id, zoneType: this.typeIdOf(id), change, tiles: zone.tiles.slice() });
  }

  // ---------- persistence ----------

  serialize(): [TileIndex, EntityId][] {
    return Array.from(this.zoneAt.keys())
      .sort((a, b) => a - b)
      .map((t): [TileIndex, EntityId] => [t, this.zoneAt.get(t) as EntityId]);
  }

  deserialize(rows: readonly [TileIndex, EntityId][]): void {
    this.zoneAt.clear();
    for (const [t, id] of rows) this.zoneAt.set(t, id);
  }
}

function binaryHas(list: readonly number[], value: number): boolean {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return list[lo] === value;
}
