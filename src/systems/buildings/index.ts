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

export { ZoneStore, settingKey, type ZoneTypeRow } from './zones';
export { BuildingStore, buildKey, deconstructKey, type BuildingRow } from './build';
export { CONSTRUCTION_KIND, onRuleOf, onRuleHolds, type OnRule } from './constructions';
export type { BuildingsReader, ZoneView, BuildingView } from './reader';

export const BUILDINGS_ID = '14';

export class BuildingsSystem extends BaseSystem<BuildingsStateV1> {
  readonly id = BUILDINGS_ID;
  readonly order = 14;
  override readonly cadence = 10;
  override readonly phase = 9;
  override readonly subscribes: readonly EventType[] = ['TilesChanged', 'AlertChanged'];
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
  ];

  private zonesRef: ZoneStore | null = null;
  private buildingsRef: BuildingStore | null = null;
  private readerRef: BuildingsReader | null = null;
  private rng: RngStream | null = null;
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
      jobIdByKey: (key) => (readers.has('11') ? (readers.of<{ byKey(k: string): { id: number } | undefined }>('11').byKey(key)?.id ?? 0) : 0),
    });
    this.buildingsRef = store;
    // 03's `remove` and collapses return the item a construction was built from (D-050).
    world.services.terrain.setConstructionItemSource?.((tile) => store.constructionItemAt(tile));
    // `14` § Registrations: job producer `buildings` (`build`, `deconstruct`).
    ctx.register.jobProducer(store.producer());
    this.rng = ctx.rng;
    this.readerRef = makeReader(this.zones, store);
  }

  override handle(event: GameEvent, _ctx: TickContext): void {
    if (event.type === 'TilesChanged') this.buildings.onTilesChanged(event['tiles'] as readonly TileIndex[]);
    else if (event.type === 'AlertChanged') this.buildings.onAlertChanged();
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
      dirtyRooms: [],
      pendingToggles: [],
      rng: (this.rng as RngStream).state(),
      pendingJobs: this.buildings.pending.slice(),
    };
  }

  deserialize(state: BuildingsStateV1, ctx: InitContext): void {
    if (this.zonesRef === null) this.init(ctx);
    this.zones.deserialize(state.zoneAt);
    this.buildings.hearthId = state.hearthId;
    this.buildings.depots.splice(0, this.buildings.depots.length, ...state.depots);
    this.buildings.coffins.splice(0, this.buildings.coffins.length, ...state.coffins);
    this.buildings.pending.length = 0;
    this.buildings.pending.push(...state.pendingJobs);
    this.rng?.setState(state.rng);
  }
}
