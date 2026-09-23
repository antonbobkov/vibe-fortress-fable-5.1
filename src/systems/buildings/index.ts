/**
 * 14 Buildings & rooms: the system. `02-systems/14-buildings-and-rooms.md`,
 * `04-implementation/tick-order.md` (14 buildings runs at `(tick − 9) % 10`) and
 * `schemas/system-state.md` `BuildingsState`.
 *
 * T-M2-03: zones (`CreateZone`, `ResizeZone`, `RemoveZone`, `SetZoneSetting`, `zoneAt`, overlap and
 * per-type tile rules). T-M2-05: placement, the `build` and `deconstruct` jobs, constructions
 * through the terrain API, `buildingAt`, passability for 22, `BuildingPlaced/Completed/Removed`.
 */

import { C } from '@core/components';
import { reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { BuildingStore } from './build';
import { makeReader, type BuildingsReader } from './reader';
import type { BuildingsStateV1 } from './state';
import { ZoneStore } from './zones';
import { RoomStore } from './rooms';
import { MOOD_BASELINE } from '@core/constants';

export { ZoneStore, settingKey, type ZoneTypeRow } from './zones';
export { BuildingStore, buildKey, deconstructKey, type BuildingRow } from './build';
export { CONSTRUCTION_KIND, onRuleOf, onRuleHolds, type OnRule } from './constructions';
export { RoomStore, ROOM_TYPES, type RoomScore } from './rooms';
export type { BuildingsReader, ZoneView, BuildingView } from './reader';

export const BUILDINGS_ID = '14';

export class BuildingsSystem extends BaseSystem<BuildingsStateV1> {
  readonly id = BUILDINGS_ID;
  readonly order = 14;
  override readonly cadence = 10;
  override readonly phase = 9;
  override readonly subscribes: readonly EventType[] = [
    'TilesChanged',
    'AlertChanged',
    'DayPassed',
    'MagmaContact',
    'SulkHappened',
  ];
  override readonly ownsCommands: readonly CommandType[] = [
    'CreateZone',
    'ResizeZone',
    'RemoveZone',
    'SetZoneSetting',
    'PlaceBuilding',
    'CancelBuilding',
    'DeconstructBuilding',
    'SetBuildingPriority',
    'SetDoorMode',
    'SetHatchMode',
    'AssignRoom',
  ];

  private zonesRef: ZoneStore | null = null;
  private buildingsRef: BuildingStore | null = null;
  private roomsRef: RoomStore | null = null;
  private readerRef: BuildingsReader | null = null;
  private rng: RngStream | null = null;
  readonly brokenFurniture: EntityId[] = [];
  /** The id of the zone the last accepted `CreateZone` made (for setup helpers and the UI). */
  lastCreatedZone = 0;
  /** The id of the building the last accepted `PlaceBuilding` made. */
  lastPlacedBuilding = 0;

  get zones(): ZoneStore {
    if (this.zonesRef === null) throw new Error('14 buildings: used before init');
    return this.zonesRef;
  }

  get buildings(): BuildingStore {
    if (this.buildingsRef === null) throw new Error('14 buildings: used before init');
    return this.buildingsRef;
  }

  get rooms(): RoomStore {
    if (this.roomsRef === null) throw new Error('14 buildings: used before init');
    return this.roomsRef;
  }

  override init(ctx: InitContext): void {
    const world = ctx.world;
    const readers = ctx.readers;
    this.zonesRef = new ZoneStore({
      map: world.map,
      entities: world.entities,
      registry: ctx.registry,
      pathing: () => (readers.has('pathing') ? readers.pathing : null),
      emit: (event) => world.emit(event),
    });
    const store = new BuildingStore({
      map: world.map,
      entities: world.entities,
      registry: ctx.registry,
      services: world.services,
      emit: (event) => world.emit(event),
      creaturesAt: (i) => readers.entities.at(i).filter((id) => world.entities.kind(id) === 'creature'),
      dwarvesAlive: () => world.entities.with(C.Labors).some((id) => world.entities.get(id, C.Creature)?.faction === 'fortress'),
      alert: () => world.fortress.alert,
      waterBelow: (i, depth) =>
        readers.has('04') ? readers.of<{ waterBelow(i: number, d: number): number }>('04').waterBelow(i, depth) : null,
      jobIdByKey: (key) => (readers.has('11') ? (readers.of<{ byKey(k: string): { id: number } | undefined }>('11').byKey(key)?.id ?? 0) : 0),
    });
    this.buildingsRef = store;
    // 03's `remove` and collapses return the item a construction was built from (D-050).
    world.services.terrain.setConstructionItemSource?.((tile) => store.constructionItemAt(tile));
    // `14` § Registrations: job producer `buildings` (`build`, `deconstruct`).
    ctx.register.jobProducer(store.producer());
    // `14` § Registrations: panels `build` and `zones`; the announcements.
    ctx.register.panel({ id: 'build', title: 'Build', hotkey: 'b' });
    ctx.register.panel({ id: 'zones', title: 'Zones', hotkey: 'z' });
    ctx.register.announcement('HearthLit', { severity: 'note', stringKey: 'announce.hearth_lit' });
    ctx.register.announcement('DoorBroken', { severity: 'alert', stringKey: 'announce.door_broken' });
    ctx.register.announcement('Buried', { severity: 'note', stringKey: 'announce.buried' });
    ctx.register.announcement('RoomQualityChanged', { severity: 'note', stringKey: 'announce.room_quality', atLeast: { field: 'tier', value: 4 } });
    const items = (): { value(id: number): number; get(id: number): { quality: number } | undefined } | null =>
      readers.has('13') ? readers.of('13') : null;
    const bars = ctx.registry.table<{ id: string; mult: number }>('items');
    const barMult = bars.has('bar') ? (bars.byId('bar')?.mult ?? 1000) : 1000;
    this.roomsRef = new RoomStore({
      map: world.map,
      entities: world.entities,
      registry: ctx.registry,
      zones: this.zones,
      buildings: store,
      emit: (event) => world.emit(event),
      itemValue: (id) => items()?.value(id) ?? 0,
      itemQuality: (id) => items()?.get(id)?.quality ?? 0,
      engravingQuality: (i) =>
        readers.has('03') ? (readers.of<{ engravingAt(i: number): { quality: number } | null }>('03').engravingAt(i)?.quality ?? 0) : 0,
      // 15's mood arrives in M4; until then every dwarf stands at `MOOD_BASELINE` (T-M2-07).
      mood: () => MOOD_BASELINE,
      barMult: () => barMult,
    });
    // A building completed or removed inside a room, or on its border, dirties it.
    const rooms = this.roomsRef;
    store.onFootprintChanged = (tiles) => rooms.markTiles(tiles);
    this.zones.onChange = (zoneId, typeId, change) => rooms.onZoneChanged(zoneId, typeId, change);
    this.rng = ctx.rng;
    this.readerRef = makeReader(this.zones, store, this.roomsRef);
  }

  override handle(event: GameEvent, _ctx: TickContext): void {
    const rooms = this.rooms;
    if (event.type === 'TilesChanged') {
      const tiles = event['tiles'] as readonly TileIndex[];
      this.buildings.onTilesChanged(tiles);
      rooms.markTiles(tiles);
    } else if (event.type === 'AlertChanged') {
      this.buildings.onAlertChanged();
    } else if (event.type === 'MagmaContact') {
      // 14 § Events consumed: "`MagmaContact` (destroy non-magma-safe buildings)", at 14's next tick.
      this.buildings.magmaTouched(event['tile'] as TileIndex);
    } else if (event.type === 'SulkHappened' && event['kind'] === 'break' && typeof event['buildingId'] === 'number') {
      const id = event['buildingId'] as EntityId;
      if (!this.brokenFurniture.includes(id)) this.brokenFurniture.push(id);
    } else if (event.type === 'DayPassed') {
      rooms.markAll();
      rooms.recompute();
      rooms.autoAssign();
    }
  }

  /** 14's tick: dirty rooms are scored again (`economy.md` § Room quality, "on dirty rooms and daily"). */
  override tick(_ctx: TickContext): void {
    for (const id of this.brokenFurniture.splice(0).sort((a, b) => a - b)) {
      const b = this.buildings.get(id);
      if (b === undefined || b.state !== 'built') continue;
      const item = b.itemId;
      this.buildings.remove(id);
      if (item !== 0) _ctx.world.services.items?.destroy(item, 'sulk');
    }
    this.buildings.destroyMagmaTouched();
    this.rooms.recompute();
  }

  override applyCommand(cmd: Command, _ctx: TickContext): CommandResult {
    const zones = this.zones;
    const buildings = this.buildings;
    const handlers: Partial<Record<CommandType, () => CommandResult>> = {
      CreateZone: () =>
        zones.create(cmd, (id) => {
          this.lastCreatedZone = id;
        }),
      ResizeZone: () => zones.resize(cmd),
      RemoveZone: () => zones.remove(cmd),
      SetZoneSetting: () => zones.setSetting(cmd),
      PlaceBuilding: () =>
        buildings.place(cmd, (id) => {
          this.lastPlacedBuilding = id;
        }),
      CancelBuilding: () => buildings.cancel(cmd),
      DeconstructBuilding: () => buildings.deconstruct(cmd),
      SetBuildingPriority: () => buildings.setPriority(cmd),
      SetDoorMode: () => buildings.setMode(cmd, 'door'),
      SetHatchMode: () => buildings.setMode(cmd, 'hatch'),
      AssignRoom: () => this.rooms.assign(cmd),
    };
    const handler = handlers[cmd.type];
    return handler === undefined ? reject('not_found') : handler();
  }

  /**
   * `TestWorld.build`: complete a placed building at once through the job's completion path;
   * `linked` is the furniture item to link (else one is made).
   */
  completeNow(id: EntityId, material: number, linked: EntityId = 0): void {
    const store = this.buildings;
    const b = store.get(id);
    if (b === undefined || b.state === 'built') return;
    const at = store.pending.indexOf(id);
    if (at >= 0) store.pending.splice(at, 1);
    store.complete(id, [], material, linked);
  }

  override reader(): BuildingsReader {
    if (this.readerRef === null) throw new Error('14 buildings: reader before init');
    return this.readerRef;
  }

  serialize(): BuildingsStateV1 {
    return {
      stateVersion: 1,
      zoneAt: this.zones.serialize(),
      hearthId: this.buildings.hearthId,
      depots: this.buildings.depots.slice(),
      coffins: this.buildings.coffins.slice(),
      dirtyRooms: this.rooms.dirty.slice(),
      pendingToggles: [],
      rng: (this.rng as RngStream).state(),
      pendingJobs: this.buildings.pending.slice(),
        magmaTouched: this.buildings.magmaPending.slice(),
        brokenFurniture: this.brokenFurniture.slice(),
    };
  }

  deserialize(state: BuildingsStateV1, ctx: InitContext): void {
    if (this.zonesRef === null) this.init(ctx);
    this.zones.deserialize(state.zoneAt);
    this.buildings.hearthId = state.hearthId;
    this.buildings.depots.splice(0, this.buildings.depots.length, ...state.depots);
    this.buildings.coffins.splice(0, this.buildings.coffins.length, ...state.coffins);
    this.rooms.dirty.splice(0, this.rooms.dirty.length, ...state.dirtyRooms);
    this.buildings.pending.length = 0;
    this.buildings.pending.push(...state.pendingJobs);
    this.buildings.magmaPending.length = 0;
      this.buildings.magmaPending.push(...(state.magmaTouched ?? []));
      this.brokenFurniture.splice(0, this.brokenFurniture.length, ...(state.brokenFurniture ?? []));
    this.rng?.setState(state.rng);
  }
}
