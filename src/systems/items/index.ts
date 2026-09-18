/**
 * 13 Items & storage: the system. `02-systems/13-items-and-storage.md`, `04-implementation/
 * tick-order.md` (13 items runs at `(tick − 1) % 10`: "haul job creation, rot queue, miasma,
 * counts, wealth") and `schemas/system-state.md` `ItemsState`.
 *
 * At `init` 13 installs its item API as the world's `items` service and its creator behind
 * `spawn.item` (D-068), so every system that makes or moves items goes through one place.
 */

import { reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext } from '@core/system';
import type { TileIndex } from '@core/types';
import { ItemCore } from './api';
import { applyClaimItem, applyDumpItem, applyForbidItem, applyMeltItem, type ItemCommandHost } from './commands';
import { WEALTH_EVENT_STEP } from './constants';
import { ItemFacts } from './facts';
import { makeBaseReader, type ItemsReader } from './reader';
import type { ItemsStateV1 } from './state';

export { ItemCore, type ItemChange, type ItemListener } from './api';
export { ItemFacts, categoryUnder, type ItemTypeRow } from './facts';
export { itemValue, qualityPermille } from './value';
export { isAvailable } from './counts';
export type { ItemsReader, StockCountView } from './reader';

export const ITEMS_ID = '13';

const COMMAND_HANDLERS: Partial<Record<CommandType, (host: ItemCommandHost, cmd: Command) => CommandResult>> = {
  ForbidItem: applyForbidItem,
  ClaimItem: applyClaimItem,
  DumpItem: applyDumpItem,
  MeltItem: applyMeltItem,
};

export class ItemsSystem extends BaseSystem<ItemsStateV1> {
  readonly id = ITEMS_ID;
  readonly order = 13;
  override readonly cadence = 10;
  override readonly phase = 1;
  override readonly subscribes: readonly EventType[] = ['TilesChanged', 'BuildingCompleted', 'BuildingRemoved'];
  override readonly ownsCommands: readonly CommandType[] = ['ForbidItem', 'ClaimItem', 'DumpItem', 'MeltItem'];

  private coreRef: ItemCore | null = null;
  private readerRef: ItemsReader | null = null;
  private rng: RngStream | null = null;
  private entitiesAt: (i: TileIndex) => readonly number[] = () => [];
  private wealthLastEmitted = 0;

  get core(): ItemCore {
    if (this.coreRef === null) throw new Error('13 items: used before init');
    return this.coreRef;
  }

  override init(ctx: InitContext): void {
    const world = ctx.world;
    const facts = new ItemFacts(ctx.registry);
    const core = new ItemCore({
      map: world.map,
      entities: world.entities,
      facts,
      spatial: () => world.services.spatial,
      emit: (event) => world.emit(event),
      tick: () => world.calendar.tick,
    });
    this.coreRef = core;
    this.rng = ctx.rng;
    this.entitiesAt = (i) => ctx.readers.entities.at(i);
    world.services.items = core;
    world.services.spawn.setItemCreator?.((type, material, at, count, quality) => core.create(type, material, at, count, quality));
    this.readerRef = makeBaseReader(core, ctx.readers.entities);
  }

  /** The items tick: `StocksChanged` for the types whose counts moved; `WealthChanged` past the step. */
  override tick(ctx: TickContext): void {
    const core = this.core;
    const types = core.counts.takeDirty();
    if (types.length > 0) ctx.emit({ type: 'StocksChanged', types });
    const wealth = core.wealth + core.buildingWealth;
    ctx.world.fortress.wealthCached = wealth;
    if (Math.abs(wealth - this.wealthLastEmitted) > WEALTH_EVENT_STEP) {
      this.wealthLastEmitted = wealth;
      ctx.emit({ type: 'WealthChanged', wealth });
    }
  }

  override handle(event: GameEvent, _ctx: TickContext): void {
    const core = this.core;
    if (event.type === 'TilesChanged') {
      for (const t of event['tiles'] as readonly TileIndex[]) core.settleTile(t, this.entitiesAt);
    } else if (event.type === 'BuildingCompleted') {
      // 14 § Value: "Each built building contributes `materialValue + type.valueBonus`".
      core.buildingWealth += typeof event['value'] === 'number' ? (event['value'] as number) : 0;
    } else if (event.type === 'BuildingRemoved') {
      core.buildingWealth -= typeof event['value'] === 'number' ? (event['value'] as number) : 0;
    }
  }

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    const handler = COMMAND_HANDLERS[cmd.type];
    if (handler === undefined) return reject('not_found');
    return handler({ core: this.core, entities: ctx.readers.entities, jobs: ctx.jobs }, cmd);
  }

  override reader(): ItemsReader {
    if (this.readerRef === null) throw new Error('13 items: reader before init');
    return this.readerRef;
  }

  serialize(): ItemsStateV1 {
    const core = this.core;
    return {
      stateVersion: 1,
      wantsHauling: [],
      noHome: [],
      slotReservations: [],
      rotQueue: [],
      miasmaTiles: [],
      counts: core.counts.serialize(),
      wealthCached: core.wealth,
      wealthLastEmitted: this.wealthLastEmitted,
      stockpileTiles: [],
      rng: (this.rng as RngStream).state(),
      dirtyTypes: core.counts.dirty.slice(),
      fullStockpiles: [],
      buildingWealth: core.buildingWealth,
    };
  }

  deserialize(state: ItemsStateV1, ctx: InitContext): void {
    if (this.coreRef === null) this.init(ctx);
    const core = this.core;
    core.counts.deserialize(state.counts);
    core.counts.dirty.length = 0;
    core.counts.dirty.push(...state.dirtyTypes);
    core.wealth = state.wealthCached;
    core.buildingWealth = state.buildingWealth;
    this.wealthLastEmitted = state.wealthLastEmitted;
    this.rng?.setState(state.rng);
  }
}
