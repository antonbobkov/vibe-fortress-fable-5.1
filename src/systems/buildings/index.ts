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
import { BurialStore } from './burial';
import { makeReader, type BuildingsReader } from './reader';
import type { BuildingsStateV1 } from './state';
import { ZoneStore } from './zones';
import { RoomStore } from './rooms';
import { MOOD_BASELINE } from '@core/constants';
import { DOOR_BREAK_TICKS } from './constants';
import { LINK_DELAY_TICKS } from './constants';
import type { Job } from '@systems/jobs';

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
    'DoorBreakAttempt',
    'MechanismTriggered',
    'CorpseCreated',
    'ItemDestroyed',
    'BuildingCompleted',
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
    'LinkMechanism',
    'UnlinkMechanism',
    'SetPlateTrigger',
    'ReleaseCage',
    'AssignCoffin',
  ];
  readonly pendingToggles: { id: EntityId; on: boolean; atTick: number }[] = [];

  private zonesRef: ZoneStore | null = null;
  private buildingsRef: BuildingStore | null = null;
  private roomsRef: RoomStore | null = null;
  private readerRef: BuildingsReader | null = null;
  private rng: RngStream | null = null;
  private burialRef: BurialStore | null = null;
  readonly brokenFurniture: EntityId[] = [];
  readonly doorBreakProgress = new Map<EntityId, number>();
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

  get burial(): BurialStore {
    if (this.burialRef === null) throw new Error('14 buildings: burial before init');
    return this.burialRef;
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
      tick: () => world.calendar.tick,
      waterBelow: (i, depth) =>
        readers.has('04') ? readers.of<{ waterBelow(i: number, d: number): number }>('04').waterBelow(i, depth) : null,
      jobIdByKey: (key) => (readers.has('11') ? (readers.of<{ byKey(k: string): { id: number } | undefined }>('11').byKey(key)?.id ?? 0) : 0),
    });
    this.buildingsRef = store;
    // 03's `remove` and collapses return the item a construction was built from (D-050).
    world.services.terrain.setConstructionItemSource?.((tile) => store.constructionItemAt(tile));
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
    this.burialRef = new BurialStore(store, this.roomsRef, this.zones);
    const buildProducer = store.producer();
    const burial = this.burialRef;
    ctx.register.jobProducer({ ...buildProducer,
      produce: (tick, sink) => { buildProducer.produce(tick, sink); burial.produce(tick); },
      onComplete: (job, tick) => {
        if ((job as Job).key.startsWith('bury:')) burial.complete(job as Job, tick);
        else buildProducer.onComplete?.(job, tick);
      },
    });
    // A building completed or removed inside a room, or on its border, dirties it.
    const rooms = this.roomsRef;
    store.onFootprintChanged = (tiles) => rooms.markTiles(tiles);
    this.zones.onChange = (zoneId, typeId, change) => rooms.onZoneChanged(zoneId, typeId, change);
    this.rng = ctx.rng;
    this.readerRef = makeReader(this.zones, store, this.roomsRef, (id) => burial.eligible(id));
  }

  override handle(event: GameEvent, _ctx: TickContext): void {
    const rooms = this.rooms;
    this.burial.handle(event, _ctx);
    if (event.type === 'TilesChanged') {
      const tiles = event['tiles'] as readonly TileIndex[];
      this.buildings.onTilesChanged(tiles);
      this.buildings.refreshLampLight();
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
    } else if (event.type === 'DoorBreakAttempt') {
      const doorId = event['doorId'] as EntityId;
      const b = this.buildings.get(doorId);
      if (b !== undefined && b.state === 'built') {
        const progress = (this.doorBreakProgress.get(doorId) ?? 0) + 1;
        if (progress >= DOOR_BREAK_TICKS) {
          this.doorBreakProgress.delete(doorId);
          this.buildings.remove(doorId);
          _ctx.emit({ type: 'DoorBroken', id: doorId });
        } else {
          this.doorBreakProgress.set(doorId, progress);
        }
      }
    } else if (event.type === 'MechanismTriggered') {
      const source = this.buildings.get(event['sourceId'] as EntityId);
      if (source?.state !== 'built') return;
      for (const id of source.linkedIds.slice().sort((a, b) => a - b)) {
        if (this.buildings.get(id)?.state === 'built') this.pendingToggles.push({ id, on: event['on'] === true, atTick: _ctx.tick + LINK_DELAY_TICKS });
      }
    }
  }

  /** 14's tick: dirty rooms are scored again (`economy.md` § Room quality, "on dirty rooms and daily"). */
  override tick(_ctx: TickContext): void {
    for (const pending of this.pendingToggles.splice(0).sort((a, b) => a.atTick - b.atTick || a.id - b.id)) {
      if (pending.atTick > _ctx.tick) { this.pendingToggles.push(pending); continue; }
      this.buildings.applyMechanism(pending.id, pending.on, _ctx, this.rng as RngStream);
    }
    for (const id of this.brokenFurniture.splice(0).sort((a, b) => a - b)) {
      const b = this.buildings.get(id);
      if (b === undefined || b.state !== 'built') continue;
      const item = b.itemId;
      this.buildings.remove(id);
      if (item !== 0) _ctx.world.services.items?.destroy(item, 'sulk');
    }
    this.buildings.destroyMagmaTouched();
    this.buildings.tickAlertDoors();
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
      LinkMechanism: () => buildings.link(cmd, _ctx),
      UnlinkMechanism: () => buildings.unlink(cmd, _ctx),
      SetPlateTrigger: () => buildings.setPlateTrigger(cmd),
      ReleaseCage: () => buildings.releaseCage(cmd),
      AssignCoffin: () => this.burial.assign(cmd, _ctx),
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
      pendingToggles: this.pendingToggles.slice(),
      rng: (this.rng as RngStream).state(),
      pendingJobs: this.buildings.pending.slice(),
        magmaTouched: this.buildings.magmaPending.slice(),
        brokenFurniture: this.brokenFurniture.slice(),
        ...(this.buildings.lampLight.size > 0 ? { lampLight: Array.from(this.buildings.lampLight,
          ([tile, value]) => ({ tile, ...value })).sort((a, b) => a.tile - b.tile) } : {}),
      doorBreakProgress: Array.from(this.doorBreakProgress.entries()),
      ...(this.burial.dead.size > 0 ? { deadDwarves: this.burial.serialize() } : {}),
      ...(this.burial.assignments.size > 0 ? { burialAssignments: Array.from(this.burial.assignments.entries()).sort((a, b) => a[0] - b[0]) } : {}),
    };
  }

  deserialize(state: BuildingsStateV1, ctx: InitContext): void {
    if (this.zonesRef === null) this.init(ctx);
    this.zones.deserialize(state.zoneAt);
    this.buildings.hearthId = state.hearthId;
    this.buildings.depots.splice(0, this.buildings.depots.length, ...state.depots);
    this.buildings.coffins.splice(0, this.buildings.coffins.length, ...state.coffins);
    this.rooms.dirty.splice(0, this.rooms.dirty.length, ...state.dirtyRooms);
    this.pendingToggles.splice(0, this.pendingToggles.length, ...state.pendingToggles);
    this.burial.restore(state.deadDwarves ?? [], state.burialAssignments ?? []);
    this.buildings.pending.length = 0;
    this.buildings.pending.push(...state.pendingJobs);
    this.buildings.magmaPending.length = 0;
      this.buildings.magmaPending.push(...(state.magmaTouched ?? []));
      this.brokenFurniture.splice(0, this.brokenFurniture.length, ...(state.brokenFurniture ?? []));
    this.buildings.lampLight.clear();
    for (const { tile, count, baseLit } of state.lampLight ?? []) this.buildings.lampLight.set(tile, { count, baseLit });
    this.doorBreakProgress.clear();
    if (state.doorBreakProgress) {
      for (const [id, count] of state.doorBreakProgress) {
        this.doorBreakProgress.set(id, count);
      }
    }
    this.rng?.setState(state.rng);
  }
}
