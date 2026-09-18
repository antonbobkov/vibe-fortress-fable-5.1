/**
 * 14 Buildings & rooms: the system. `02-systems/14-buildings-and-rooms.md`,
 * `04-implementation/tick-order.md` (14 buildings runs at `(tick − 9) % 10`) and
 * `schemas/system-state.md` `BuildingsState`.
 *
 * T-M2-03: zones (`CreateZone`, `ResizeZone`, `RemoveZone`, `SetZoneSetting`, `zoneAt`, overlap and
 * per-type tile rules).
 */

import { reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext } from '@core/system';
import { makeReader, type BuildingsReader } from './reader';
import type { BuildingsStateV1 } from './state';
import { ZoneStore } from './zones';

export { ZoneStore, settingKey, type ZoneTypeRow } from './zones';
export type { BuildingsReader, ZoneView } from './reader';

export const BUILDINGS_ID = '14';

export class BuildingsSystem extends BaseSystem<BuildingsStateV1> {
  readonly id = BUILDINGS_ID;
  readonly order = 14;
  override readonly cadence = 10;
  override readonly phase = 9;
  override readonly ownsCommands: readonly CommandType[] = ['CreateZone', 'ResizeZone', 'RemoveZone', 'SetZoneSetting'];

  private zonesRef: ZoneStore | null = null;
  private readerRef: BuildingsReader | null = null;
  private rng: RngStream | null = null;
  /** The id of the zone the last accepted `CreateZone` made (for setup helpers and the UI). */
  lastCreatedZone = 0;

  get zones(): ZoneStore {
    if (this.zonesRef === null) throw new Error('14 buildings: used before init');
    return this.zonesRef;
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
    this.rng = ctx.rng;
    this.readerRef = makeReader(this.zones);
  }

  override applyCommand(cmd: Command, _ctx: TickContext): CommandResult {
    const zones = this.zones;
    const handlers: Partial<Record<CommandType, () => CommandResult>> = {
      CreateZone: () =>
        zones.create(cmd, (id) => {
          this.lastCreatedZone = id;
        }),
      ResizeZone: () => zones.resize(cmd),
      RemoveZone: () => zones.remove(cmd),
      SetZoneSetting: () => zones.setSetting(cmd),
    };
    const handler = handlers[cmd.type];
    return handler === undefined ? reject('not_found') : handler();
  }

  override reader(): BuildingsReader {
    if (this.readerRef === null) throw new Error('14 buildings: reader before init');
    return this.readerRef;
  }

  serialize(): BuildingsStateV1 {
    return {
      stateVersion: 1,
      zoneAt: this.zones.serialize(),
      hearthId: 0,
      depots: [],
      coffins: [],
      dirtyRooms: [],
      pendingToggles: [],
      rng: (this.rng as RngStream).state(),
    };
  }

  deserialize(state: BuildingsStateV1, ctx: InitContext): void {
    if (this.zonesRef === null) this.init(ctx);
    this.zones.deserialize(state.zoneAt);
    this.rng?.setState(state.rng);
  }
}
