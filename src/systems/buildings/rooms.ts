/**
 * Rooms: `02-systems/14-buildings-and-rooms.md` § Rooms and quality, § Ownership, and
 * `04-implementation/algorithms/economy.md` § Room quality (14, on dirty rooms and daily):
 *
 * ```
 * scoreRoom(zone):
 *   for t in tiles: score += Constructed ? constructedFloorValue(m) : Engraved ? 3 + engravingQuality(t)
 *                           : Smoothed ? 3 : class(m)=='stone' ? 1 : 0
 *   border = tiles' 8-neighbors not in tiles (same z); enclosed = every border tile is Wall/Fortification
 *            or has a door/hatch building
 *   for b in border: if kind[b]==Wall: score += Engraved ? 2 + engravingQuality(b)/2 : Smoothed ? 2 : 0
 *   for bld in buildings within tiles: if bld.itemId and quality(item) > 0: score += value(item)/10
 *                                      else if bld.type.roomValue is number: score += it
 *   score += min(tiles.length, ROOM_SIZE_CAP)
 *   if enclosed: score = score * ENCLOSED_PERCENT / 100
 *   tier = score < 20 ? 0 : < 60 ? 1 : < 150 ? 2 : < 400 ? 3 : < 1000 ? 4 : 5
 *   requirementsMet per zone type (bed; table+adjacent chair; hearth inside; bed+chest; coffin)
 *   if tier changed: emit RoomQualityChanged
 * ```
 *
 * A statue's linked item counts twice (`buildings-and-furniture.md`: "item × 2"). The worked
 * examples of `buildings-and-furniture.md` count only the cardinal border walls; the rule's
 * 8-neighbourhood is implemented, which leaves every example's tier unchanged (D-075).
 */

import { C, type Building, type Room, type Zone } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import { TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { EntityStore } from '@core/entities';
import type { GameEvent } from '@core/events';
import type { Registry } from '@core/registry';
import type { EntityId, RoomTier, TileIndex } from '@core/types';
import type { BuildingStore } from './build';
import { ENCLOSED_PERCENT, HEARTH_HALL_SIDE, ROOM_SIZE_CAP } from './constants';
import { lowerBound, sortedInsert } from './state';
import type { ZoneStore } from './zones';

/** The room types of 14 § Concepts (the zone types whose `room` column is yes). */
export const ROOM_TYPES: readonly string[] = Object.freeze(['bedroom', 'dining_hall', 'hearth_hall', 'hospital', 'barracks', 'tomb']);

/** 14 § Ownership: "titled dwarves first (Thane, then Warden, Broker, Chief Medic)". */
const TITLE_ORDER: readonly string[] = Object.freeze(['thane', 'warden', 'broker', 'chief_medic']);

interface MaterialRow {
  readonly id: string;
  readonly class: string;
  readonly value: number;
}

interface TierRow {
  readonly tier: number;
  readonly id: string;
  readonly score: number;
}

export interface RoomHost {
  readonly map: Map3D;
  readonly entities: EntityStore;
  readonly registry: Registry;
  readonly zones: ZoneStore;
  readonly buildings: BuildingStore;
  emit(event: GameEvent): void;
  /** 13's `value(item)`. */
  itemValue(id: EntityId): number;
  /** The item's quality tier 0 … 5 (0 poor). */
  itemQuality(id: EntityId): number;
  /** 03's engraving quality on a tile (0 when none). */
  engravingQuality(i: TileIndex): number;
  /** 15's mood of a dwarf; the stub is 55 until 15 exists (T-M2-07). */
  mood(dwarfId: EntityId): number;
  /** The value multiplier (thousandths) of a bar, for metal floors ("metal blocks value(bar)/5"). */
  barMult(): number;
}

/** A room's computed facts. */
export interface RoomScore {
  readonly score: number;
  readonly tier: RoomTier;
  readonly enclosed: boolean;
  readonly requirementsMet: boolean;
  /** The parts of the score, for the zone › room inspector. */
  readonly parts: { readonly tiles: number; readonly walls: number; readonly furniture: number; readonly size: number };
}

/** Read-only facts for the room inspector; never stored in a Room component. */
export interface RoomDiagnostics {
  readonly openBorder: readonly TileIndex[];
  readonly missing: readonly ('bed' | 'table_chair' | 'hearth' | 'chest' | 'coffin')[];
}

export class RoomStore {
  readonly host: RoomHost;
  /** `BuildingsState.dirtyRooms`: zone ids whose room waits for a recompute, ascending. */
  readonly dirty: EntityId[] = [];
  private readonly materials: (MaterialRow | undefined)[] = [];
  /** Lower score bound of tiers 1 … 5 (`roomTiers.json`, from `buildings-and-furniture.md`). */
  private readonly bounds: number[];

  constructor(host: RoomHost) {
    this.host = host;
    const mats = host.registry.table<MaterialRow>('materials');
    for (let m = 1; m <= mats.size; m += 1) this.materials[m] = mats.byIndex(m);
    const tiers = host.registry.table<TierRow & { id: string }>('roomTiers');
    const rows: TierRow[] = [];
    for (let t = 1; t <= tiers.size; t += 1) rows.push(tiers.byIndex(t) as TierRow);
    rows.sort((a, b) => a.tier - b.tier);
    this.bounds = rows.filter((r) => r.tier > 0).map((r) => r.score);
  }

  private get map(): Map3D {
    return this.host.map;
  }

  isRoomType(typeId: string): boolean {
    return ROOM_TYPES.includes(typeId);
  }

  /** The room entity of a zone, or 0. */
  roomOf(zoneId: EntityId): EntityId {
    for (const id of this.host.entities.with(C.Room)) if (this.host.entities.get(id, C.Room)?.zoneId === zoneId) return id;
    return 0;
  }

  room(zoneId: EntityId): Room | undefined {
    const id = this.roomOf(zoneId);
    return id === 0 ? undefined : this.host.entities.get(id, C.Room);
  }

  /** Every room's zone id, ascending. */
  roomZones(): EntityId[] {
    return this.host.entities
      .with(C.Room)
      .map((id) => (this.host.entities.get(id, C.Room) as Room).zoneId)
      .sort((a, b) => a - b);
  }

  tierOf(score: number): RoomTier {
    let tier = 0;
    for (let k = 0; k < this.bounds.length; k += 1) if (score >= (this.bounds[k] as number)) tier = k + 1;
    return tier as RoomTier;
  }

  // ---------- dirty tracking ----------

  markDirty(zoneId: EntityId): void {
    sortedInsert(this.dirty, zoneId);
  }

  /** Tiles changed (a building, a smoothing, an engraving): every room on them or bordering them is dirty. */
  markTiles(tiles: readonly TileIndex[]): void {
    const zones = this.host.zones;
    if (zones.zoneAt.size === 0) return;
    for (const t of tiles) {
      if (!this.map.validIndex(t)) continue;
      const z = this.map.zOf(t);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const n = dx === 0 && dy === 0 ? t : this.map.offset(t, dx, dy, 0);
          if (n < 0 || this.map.zOf(n) !== z) continue;
          // A meeting area (the only zone that shares a tile) is no room: `zoneAt` is enough.
          const zone = zones.zoneAt.get(n);
          if (zone !== undefined && this.isRoomType(zones.typeIdOf(zone))) this.markDirty(zone);
        }
      }
    }
  }

  markAll(): void {
    for (const zone of this.roomZones()) this.markDirty(zone);
  }

  /** `ZoneChanged`: a room zone gets its `Room` (kind `room`), loses it when removed, and is dirty. */
  onZoneChanged(zoneId: EntityId, typeId: string, change: string): void {
    if (!this.isRoomType(typeId)) return;
    const existing = this.roomOf(zoneId);
    if (change === 'removed') {
      if (existing !== 0) this.host.entities.destroy(existing);
      const at = lowerBound(this.dirty, zoneId);
      if (this.dirty[at] === zoneId) this.dirty.splice(at, 1);
      return;
    }
    if (existing === 0) {
      const id = this.host.entities.create('room');
      this.host.entities.add(id, C.Room, { zoneId, score: 0, tier: 0, ownerId: 0, enclosed: false, requirementsMet: false });
    }
    this.markDirty(zoneId);
  }

  /** Recompute every dirty room; `RoomQualityChanged { zoneId, tier }` when a tier changes. */
  recompute(): void {
    const entities = this.host.entities;
    for (const zoneId of this.dirty.splice(0)) {
      const zone = this.host.zones.zone(zoneId);
      const roomId = this.roomOf(zoneId);
      if (zone === undefined || roomId === 0) continue;
      const room = entities.get(roomId, C.Room) as Room;
      const s = this.score(zone.tiles, this.host.zones.typeIdOf(zoneId));
      entities.add(roomId, C.Room, { ...room, score: s.score, tier: s.tier, enclosed: s.enclosed, requirementsMet: s.requirementsMet });
      if (s.tier !== room.tier) this.host.emit({ type: 'RoomQualityChanged', zoneId, tier: s.tier });
    }
  }

  // ---------- scoring ----------

  /** U-07 M9: the same border and built-furniture requirements used by scoring. */
  diagnostics(tiles: readonly TileIndex[], typeId: string): RoomDiagnostics {
    const inside = new Set(tiles);
    const border = new Set<TileIndex>();
    for (const t of tiles) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const n = this.map.offset(t, dx, dy, 0);
      if (n >= 0 && !inside.has(n)) border.add(n);
    }
    const openBorder = Array.from(border).sort((a, b) => a - b).filter((tile) => {
      const kind = this.map.kindAt(tile);
      if (kind === TileKind.Wall || kind === TileKind.Fortification) return false;
      const b = this.host.buildings.get(this.map.buildingAtTile(tile));
      const tags = b === undefined ? [] : this.host.buildings.row(b.type).tags;
      return b?.state !== 'built' || !(tags.includes('door') || tags.includes('hatch'));
    });
    const within = this.buildingsWithin(tiles);
    const missing: RoomDiagnostics['missing'][number][] = [];
    if ((typeId === 'bedroom' || typeId === 'hospital') && this.tagged(within, 'sleep').length === 0) missing.push('bed');
    if (typeId === 'dining_hall' && this.seatsAmong(within).length === 0) missing.push('table_chair');
    if (typeId === 'hearth_hall' && this.tagged(within, 'hearth').length === 0) missing.push('hearth');
    if (typeId === 'hospital' && !within.some((id) => this.host.buildings.typeIdOf(id) === 'chest')) missing.push('chest');
    if (typeId === 'tomb' && this.tagged(within, 'coffin').length === 0) missing.push('coffin');
    return { openBorder, missing };
  }

  /** `constructedFloorValue(m) = value(m)`; "metal blocks value(bar)/5". */
  private constructedFloorValue(m: number): number {
    const row = this.materials[m];
    if (row === undefined) return 0;
    if (row.class === 'metal') return (row.value * this.host.barMult()) / 1000 / 5;
    return row.value;
  }

  /** The built buildings with a footprint tile among `tiles`, ascending id. */
  buildingsWithin(tiles: readonly TileIndex[]): EntityId[] {
    const out = new Set<EntityId>();
    for (const t of tiles) {
      const id = this.map.buildingAtTile(t);
      if (id !== 0 && this.host.buildings.get(id)?.state === 'built') out.add(id);
    }
    return Array.from(out).sort((a, b) => a - b);
  }

  /** `scoreRoom` over a tile set (a zone's, or the stand-in hearth hall's). */
  score(tiles: readonly TileIndex[], typeId: string): RoomScore {
    const map = this.map;
    const inside = new Set(tiles);
    let tileScore = 0;
    for (const t of tiles) {
      const m = map.materialAt(t);
      if (map.hasFlag(t, TileFlag.Constructed)) tileScore += this.constructedFloorValue(m);
      else if (map.hasFlag(t, TileFlag.Engraved)) tileScore += 3 + this.host.engravingQuality(t);
      else if (map.hasFlag(t, TileFlag.Smoothed)) tileScore += 3;
      else if (this.materials[m]?.class === 'stone') tileScore += 1;
    }
    const border = new Set<TileIndex>();
    for (const t of tiles) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const n = map.offset(t, dx, dy, 0);
          if (n >= 0 && !inside.has(n)) border.add(n);
        }
      }
    }
    let enclosed = tiles.length > 0;
    let wallScore = 0;
    for (const b of Array.from(border).sort((a, c) => a - c)) {
      const kind = map.kindAt(b);
      if (kind === TileKind.Wall) {
        if (map.hasFlag(b, TileFlag.Engraved)) wallScore += 2 + this.host.engravingQuality(b) / 2;
        else if (map.hasFlag(b, TileFlag.Smoothed)) wallScore += 2;
        continue;
      }
      if (kind === TileKind.Fortification) continue;
      const bid = map.buildingAtTile(b);
      const tags = bid === 0 ? [] : this.host.buildings.row((this.host.buildings.get(bid) as Building).type).tags;
      if (!(tags.includes('door') || tags.includes('hatch')) || this.host.buildings.get(bid)?.state !== 'built') enclosed = false;
    }
    let furniture = 0;
    const within = this.buildingsWithin(tiles);
    for (const id of within) {
      const b = this.host.buildings.get(id) as Building;
      const row = this.host.buildings.row(b.type);
      if (b.itemId !== 0 && this.host.itemQuality(b.itemId) > 0) {
        furniture += (this.host.itemValue(b.itemId) / 10) * (row.roomValue === 'item_x2' ? 2 : 1);
      } else if (typeof row.roomValue === 'number') {
        furniture += row.roomValue;
      }
    }
    const size = Math.min(tiles.length, ROOM_SIZE_CAP);
    let score = tileScore + wallScore + furniture + size;
    if (enclosed) score = (score * ENCLOSED_PERCENT) / 100;
    return {
      score,
      tier: this.tierOf(score),
      enclosed,
      requirementsMet: this.requirementsMet(typeId, within),
      parts: { tiles: tileScore, walls: wallScore, furniture, size },
    };
  }

  private tagged(ids: readonly EntityId[], tag: string): EntityId[] {
    const b = this.host.buildings;
    return ids.filter((id) => b.row((b.get(id) as Building).type).tags.includes(tag));
  }

  /** "bed; table+adjacent chair; hearth inside; bed+chest; coffin"; barracks needs nothing. */
  requirementsMet(typeId: string, within: readonly EntityId[]): boolean {
    switch (typeId) {
      case 'bedroom':
        return this.tagged(within, 'sleep').length > 0;
      case 'dining_hall':
        return this.seatsAmong(within).length > 0;
      case 'hearth_hall':
        return this.tagged(within, 'hearth').length > 0;
      case 'hospital':
        return this.tagged(within, 'sleep').length > 0 && within.some((id) => this.host.buildings.typeIdOf(id) === 'chest');
      case 'barracks':
        return true;
      case 'tomb':
        return this.tagged(within, 'coffin').length > 0;
      default:
        return false;
    }
  }

  /** Chairs (`sit`) adjacent to a table (`eat_at`): "a chair adjacent to a table makes a dining seat". */
  seatsAmong(ids: readonly EntityId[]): EntityId[] {
    const b = this.host.buildings;
    const map = this.map;
    const tables = new Set<TileIndex>();
    for (const id of this.tagged(ids, 'eat_at')) for (const t of (b.get(id) as Building).footprint) tables.add(t);
    return this.tagged(ids, 'sit').filter((id) =>
      (b.get(id) as Building).footprint.some((t) => {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const n = map.offset(t, dx, dy, 0);
            if ((dx !== 0 || dy !== 0) && n >= 0 && tables.has(n)) return true;
          }
        }
        return false;
      }),
    );
  }

  // ---------- the hearth hall ----------

  /** Comfort light belongs to the built hearth, not the map's crop-light flag. */
  hearthLightAt(tile: TileIndex): boolean {
    const hearth = this.host.buildings.hearthId;
    const b = hearth === 0 ? undefined : this.host.buildings.get(hearth);
    if (b === undefined || b.state !== 'built' || !this.map.validIndex(tile)) return false;
    const half = Math.floor(HEARTH_HALL_SIDE / 2);
    return this.map.zOf(tile) === this.map.zOf(b.origin)
      && Math.abs(this.map.xOf(tile) - this.map.xOf(b.origin)) <= half
      && Math.abs(this.map.yOf(tile) - this.map.yOf(b.origin)) <= half;
  }

  /** The hearth hall's tiles: the first hearth-hall zone with the hearth inside, else the 5×5 around the hearth. */
  hearthHallTiles(): TileIndex[] {
    for (const zoneId of this.roomZones()) {
      if (this.host.zones.typeIdOf(zoneId) !== 'hearth_hall') continue;
      if (this.room(zoneId)?.requirementsMet === true) return (this.host.zones.zone(zoneId) as Zone).tiles.slice();
    }
    const hearth = this.host.buildings.hearthId;
    const b = hearth === 0 ? undefined : this.host.buildings.get(hearth);
    if (b === undefined || b.state !== 'built') return [];
    const half = Math.floor(HEARTH_HALL_SIDE / 2);
    const out: TileIndex[] = [];
    for (let dy = -half; dy <= half; dy += 1) {
      for (let dx = -half; dx <= half; dx += 1) {
        const t = this.map.offset(b.origin, dx, dy, 0);
        if (t >= 0) out.push(t);
      }
    }
    return out.sort((a, c) => a - c);
  }

  /** The hearth hall's tier (the fortress-wide baseline); 0 without a hearth. */
  hearthHallTier(): RoomTier {
    for (const zoneId of this.roomZones()) {
      if (this.host.zones.typeIdOf(zoneId) !== 'hearth_hall') continue;
      const room = this.room(zoneId);
      if (room?.requirementsMet === true) return room.tier;
    }
    const tiles = this.hearthHallTiles();
    return tiles.length === 0 ? 0 : this.score(tiles, 'hearth_hall').tier;
  }

  // ---------- ownership ----------

  /** The bedroom zone a dwarf owns, or 0. */
  bedroomOf(dwarfId: EntityId): EntityId {
    if (dwarfId === 0) return 0;
    for (const zoneId of this.roomZones()) {
      if (this.host.zones.typeIdOf(zoneId) === 'bedroom' && this.room(zoneId)?.ownerId === dwarfId) return zoneId;
    }
    return 0;
  }

  /** A bedroom is free in its owner's death tick; reserved coffins are untouched. */
  ownerDied(dwarfId: EntityId): void {
    if (dwarfId === 0) return;
    for (const zoneId of this.roomZones()) {
      if (this.host.zones.typeIdOf(zoneId) === 'bedroom' && this.room(zoneId)?.ownerId === dwarfId) {
        this.setOwner(zoneId, 0);
      }
    }
  }

  private setOwner(zoneId: EntityId, dwarfId: EntityId): void {
    const roomId = this.roomOf(zoneId);
    const room = this.host.entities.get(roomId, C.Room) as Room;
    if (room.ownerId === dwarfId) return;
    this.host.entities.add(roomId, C.Room, { ...room, ownerId: dwarfId });
    this.host.emit({ type: 'RoomAssigned', zoneId, dwarfId });
  }

  private isDwarf(id: EntityId): boolean {
    const e = this.host.entities;
    return e.alive(id) && e.has(id, C.Title) && e.get(id, C.Creature)?.faction === 'fortress';
  }

  /** `AssignRoom { zoneId, dwarfId | 0 }`: "bedroom with a bed" (`no_bed`); a dwarf keeps one bedroom. */
  assign(cmd: Command): CommandResult {
    const zoneId = cmd['zoneId'];
    const dwarfId = cmd['dwarfId'] ?? 0;
    if (typeof zoneId !== 'number' || this.host.zones.zone(zoneId) === undefined) return reject('not_found');
    if (this.host.zones.typeIdOf(zoneId) !== 'bedroom' || this.roomOf(zoneId) === 0) return reject('precondition_failed');
    const zone = this.host.zones.zone(zoneId) as Zone;
    if (this.tagged(this.buildingsWithin(zone.tiles), 'sleep').length === 0) return reject('no_bed');
    if (typeof dwarfId !== 'number' || (dwarfId !== 0 && !this.isDwarf(dwarfId))) return reject('not_found');
    if (dwarfId !== 0) {
      const old = this.bedroomOf(dwarfId);
      if (old !== 0 && old !== zoneId) this.setOwner(old, 0);
    }
    this.setOwner(zoneId, dwarfId);
    return OK;
  }

  /**
   * Daily auto-assignment: "every unowned bedroom is given to a dwarf without one, titled dwarves
   * first (Thane, then Warden, Broker, Chief Medic), then by lowest mood"; ties by id. Bedrooms go
   * in zone id order; only a bedroom with a bed counts.
   */
  autoAssign(): void {
    const e = this.host.entities;
    const free = this.roomZones().filter((z) => this.host.zones.typeIdOf(z) === 'bedroom' && this.room(z)?.ownerId === 0 && this.room(z)?.requirementsMet === true);
    if (free.length === 0) return;
    const owners = new Set<EntityId>(this.roomZones().map((z) => this.room(z)?.ownerId ?? 0));
    const rank = (id: EntityId): number => {
      const t = TITLE_ORDER.indexOf(e.get(id, C.Title)?.title ?? 'none');
      return t < 0 ? TITLE_ORDER.length : t;
    };
    const waiting = e
      .with(C.Title, C.Creature)
      .filter((id) => this.isDwarf(id) && !owners.has(id))
      .sort((a, b) => rank(a) - rank(b) || this.host.mood(a) - this.host.mood(b) || a - b);
    for (let k = 0; k < free.length && k < waiting.length; k += 1) this.setOwner(free[k] as EntityId, waiting[k] as EntityId);
  }

  /** Built beds no one owns: not inside an owned bedroom. */
  freeBeds(): EntityId[] {
    const b = this.host.buildings;
    return b
      .all()
      .filter((id) => {
        const bld = b.get(id) as Building;
        if (bld.state !== 'built' || !b.row(bld.type).tags.includes('sleep')) return false;
        return bld.footprint.every((t) => this.host.zones.zonesAt(t).every((z) => this.host.zones.typeIdOf(z) !== 'bedroom' || (this.room(z)?.ownerId ?? 0) === 0));
      });
  }
}
