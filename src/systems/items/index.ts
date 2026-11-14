import { UNBURIED_DAYS } from '@systems/morale/constants';
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
import { TileFlag, TileKind } from '@core/map3d';
import { ItemCore } from './api';
import { applyClaimItem, applyDumpItem, applyForbidItem, applyMeltItem, type ItemCommandHost } from './commands';
import {
  applyLinkStockpile,
  applySetStockpileCellar,
  applySetStockpileContainers,
  applySetStockpileFilter,
  applySetStockpilePriority,
  type StockpileCommandHost,
} from './stockpile-commands';
import { StockpileStore } from './stockpiles';
import { Hauling, type JobsView } from './hauling';
import { WEALTH_EVENT_STEP } from './constants';
import { TICKS_PER_DAY } from '@core/constants';
import { C, ItemFlag } from '@core/components';
import type { MaterialsReader } from '@systems/materials/reader';
import { RotQueue } from './rot';
import { cellarDay, judgeCellar, type CellarHost } from './cellar';
import { ItemFacts } from './facts';
import { makeReader, type ItemsReader } from './reader';
import { ItemSearch } from './search';
import type { ItemsStateV1 } from './state';

export { ItemCore, type ItemChange, type ItemListener } from './api';
export { ItemFacts, categoryUnder, type ItemTypeRow } from './facts';
export { itemValue, qualityPermille } from './value';
export { isAvailable } from './counts';
export type { ItemsReader, StockCountView } from './reader';
export { ItemSearch, matches, type ItemFilter, type SearchOptions } from './search';
export {
  StockpileStore,
  STOCKPILE_PRESETS,
  CATEGORY_TREE,
  emptyFilter,
  defaultStockpile,
  presetFilter,
  type Slot,
  type ContainerNeeded,
} from './stockpiles';

export { Hauling, haulKey, dumpKey, stripKey } from './hauling';

export const ITEMS_ID = '13';

const COMMAND_HANDLERS: Partial<Record<CommandType, (host: ItemCommandHost, cmd: Command) => CommandResult>> = {
  ForbidItem: applyForbidItem,
  ClaimItem: applyClaimItem,
  DumpItem: applyDumpItem,
  MeltItem: applyMeltItem,
};

const STOCKPILE_HANDLERS: Partial<Record<CommandType, (host: StockpileCommandHost, cmd: Command) => CommandResult>> = {
  SetStockpileFilter: applySetStockpileFilter,
  SetStockpileContainers: applySetStockpileContainers,
  SetStockpilePriority: applySetStockpilePriority,
  LinkStockpile: applyLinkStockpile,
  SetStockpileCellar: applySetStockpileCellar,
};

interface ZoneViewLike {
  readonly type: string;
  readonly tiles: readonly TileIndex[];
}

export class ItemsSystem extends BaseSystem<ItemsStateV1> {
  readonly id = ITEMS_ID;
  readonly order = 13;
  override readonly cadence = 10;
  override readonly phase = 1;
  override readonly subscribes: readonly EventType[] = ['TilesChanged', 'BuildingCompleted', 'BuildingRemoved', 'ZoneChanged', 'ItemMelted', 'CreatureDied', 'CorpseCreated', 'SeasonChanged', 'ThiefEscaped', 'DayPassed'];
  override readonly ownsCommands: readonly CommandType[] = [
    'ForbidItem',
    'ClaimItem',
    'DumpItem',
    'MeltItem',
    'SetStockpileFilter',
    'SetStockpileContainers',
    'SetStockpilePriority',
    'LinkStockpile',
    'SetStockpileCellar',
  ];

  private coreRef: ItemCore | null = null;
  private search: ItemSearch | null = null;
  private storeRef: StockpileStore | null = null;
  private stockpileHost: StockpileCommandHost | null = null;
  private haulingRef: Hauling | null = null;
  private readerRef: ItemsReader | null = null;
  private rng: RngStream | null = null;
  private entitiesAt: (i: TileIndex) => readonly number[] = () => [];
  private wealthLastEmitted = 0;
  private rotRef: RotQueue | null = null;
  private cellarRef: CellarHost | null = null;
  private readonly pendingDeaths = new Map<number, ItemsStateV1['pendingDeaths'][number]>();

  get core(): ItemCore {
    if (this.coreRef === null) throw new Error('13 items: used before init');
    return this.coreRef;
  }

  get stockpiles(): StockpileStore {
    if (this.storeRef === null) throw new Error('13 items: used before init');
    return this.storeRef;
  }

  get hauling(): Hauling {
    if (this.haulingRef === null) throw new Error('13 items: used before init');
    return this.haulingRef;
  }

  /** A stockpile's filter, containers, priority, links or tiles changed: `noHome` and its items are looked at again. */
  private stockpileChanged(id: number, tiles?: readonly TileIndex[]): void {
    this.hauling.stockpileChanged(id, tiles ?? this.stockpiles.tilesOf(id));
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
      // The wagon holds the embark supplies in its own container (D-074).
      holderTile: (id) => (ctx.readers.has('14') ? ctx.readers.of<{ holderTile(id: number): TileIndex }>('14').holderTile(id) : -1),
    });
    this.coreRef = core;
    this.rng = ctx.rng;
    this.entitiesAt = (i) => ctx.readers.entities.at(i);
    world.services.items = core;
    world.services.spawn.setItemCreator?.((type, material, at, count, quality) => core.create(type, material, at, count, quality));
    const readers = ctx.readers;
    const itemsOn = (i: TileIndex): number[] => readers.entities.at(i).filter((id) => core.isItem(id));
    const store = new StockpileStore({
      core,
      zone: (id) => (readers.has('14') ? readers.of<{ zone(id: number): ZoneViewLike | undefined }>('14').zone(id) : undefined),
      itemsOn,
      buildingAt: (i) => world.map.buildingAtTile(i),
      // 13 § Stockpiles: solid or open terrain, or a built building that blocks walkers, leaves no place to stand.
      standable: (i) => {
        const kind = world.map.kindAt(i);
        if (kind === TileKind.Wall || kind === TileKind.Tree || kind === TileKind.Boulder || kind === TileKind.Open || kind === TileKind.Fortification) return false;
        return !readers.has('14') || !readers.of<{ blocksMovementAt(i: TileIndex, cls: 'walker'): boolean }>('14').blocksMovementAt(i, 'walker');
      },
    });
    this.storeRef = store;
    const classes = new Set<string>();
    const materials = ctx.registry.table<{ id: string; class: string }>('materials');
    for (let m = 1; m <= materials.size; m += 1) classes.add(materials.byIndex(m)?.class ?? '');
    // 13 § Aging in a cellar: dark is no `lit` flag and no comfort light (14), warm is 05's temperature.
    const cellar: CellarHost = {
      core,
      store,
      dark: (i) => !world.map.hasFlag(i, TileFlag.Lit) &&
        !(readers.has('14') && readers.of<{ comfortLightAt(i: TileIndex): boolean }>('14').comfortLightAt(i)),
      temperature: (i) => readers.of<MaterialsReader>('05').temperatureAt(i),
      emit: (event) => world.emit(event),
    };
    this.cellarRef = cellar;
    this.stockpileHost = {
      store,
      materialClasses: classes,
      changed: (id) => this.stockpileChanged(id),
      judgeCellar: (id) => judgeCellar(cellar, store.tilesOf(id)),
    };
    this.search = new ItemSearch({
      core,
      entities: readers.entities,
      spatial: () => (readers.has('spatial') ? readers.spatial : null),
      pathing: () => (readers.has('pathing') ? readers.pathing : null),
      stockpileAt: (i) => store.stockpileAt(i),
    });
    this.rotRef = new RotQueue(core, store, (tile) => readers.of<MaterialsReader>('05').temperatureAt(tile));
    this.readerRef = makeReader(core, readers.entities, this.search, store, () => this.hauling.wants.length,
      (tile) => this.rotRef?.miasma.has(tile) ?? false,
      (tick) => world.entities.with(C.Corpse, C.Item).some((id) => {
        const corpse = world.entities.get(id, C.Corpse);
          return corpse?.dwarfName !== null && corpse?.dwarfName !== undefined && corpse.memorialized !== true && tick - corpse.diedTick > UNBURIED_DAYS * TICKS_PER_DAY;
      }));
    type BuildingsView = {
      zoneAt(i: TileIndex): number;
      zone(id: number): { readonly type: string; readonly tiles: readonly TileIndex[] } | undefined;
      zonesOfType(type: string): number[];
    };
    const b = (): BuildingsView | null => (readers.has('14') ? readers.of<BuildingsView>('14') : null);
    const hauling = new Hauling({
      core,
      store,
      jobs: () => world.services.jobs,
      jobsView: () => (readers.has('11') ? readers.of<JobsView>('11') : null),
      zoneTypeAt: (i) => {
        const v = b();
        if (v === null) return '';
        const z = v.zoneAt(i);
        return z === 0 ? '' : (v.zone(z)?.type ?? '');
      },
      zonesOfType: (type) => {
        const v = b();
        if (v === null) return [];
        return v.zonesOfType(type).map((id) => ({ id, tiles: v.zone(id)?.tiles ?? [] }));
      },
      walkable: (i) => !readers.has('pathing') || readers.pathing.passable(i, 'walker', { faction: 'fortress' }),
      emit: (event) => world.emit(event),
    });
    this.haulingRef = hauling;
    core.listen((id, change) => hauling.onChange(id, change));
    core.listen((id, change) => {
      this.rotRef?.changed(id, change);
      if (change === 'placed' || change === 'lifted' || change === 'contained')
        for (const child of core.container(id)?.contents ?? []) this.rotRef?.changed(child, 'placed');
    });
    // `13` § Registrations: the stocks panel and the `StockpileFull` note.
    ctx.register.panel({ id: 'stocks', title: 'Stocks', hotkey: 's' });
    ctx.register.announcement('StockpileFull', { severity: 'note', stringKey: 'announce.stockpile_full' });
    ctx.register.announcement('MiasmaSpread', { severity: 'alert', stringKey: 'announce.miasma' });
    // `13` § Registrations: job producer `items` (`haul_to_stockpile`, `haul_to_dump`, `strip_corpse`).
    ctx.register.jobProducer({
      id: 'items',
      produce: () => {},
      onComplete: (job) => hauling.complete(job as Parameters<Hauling['complete']>[0]),
      onJobEvent: (event) => {
        if (event.type !== 'JobCancelled') return;
        const jobId = event['jobId'] as number;
        for (const key of Array.from(store.reservations.keys())) if (store.reservations.get(key) === jobId) store.releaseKey(key);
      },
    });
  }

  /** The items tick: `StocksChanged` for the types whose counts moved; `WealthChanged` past the step. */
  override tick(ctx: TickContext): void {
    const core = this.core;
    for (const death of Array.from(this.pendingDeaths.values()).sort((a, b) => a.id - b.id)) {
      if (ctx.world.map.validIndex(death.tile)) this.rotRef?.createCorpse(ctx, death.id, death.species, death.tile, death.name, death.wornItems, death.foreign);
    }
    this.pendingDeaths.clear();
    this.rotRef?.tick(ctx);
    this.hauling.tick(ctx);
    const types = core.counts.takeDirty();
    if (types.length > 0) ctx.emit({ type: 'StocksChanged', types });
    const wealth = core.wealth + core.buildingWealth;
    ctx.world.fortress.wealthCached = wealth;
    if (Math.abs(wealth - this.wealthLastEmitted) > WEALTH_EVENT_STEP) {
      this.wealthLastEmitted = wealth;
      ctx.emit({ type: 'WealthChanged', wealth });
    }
  }

  /**
   * 13 § Corpses: a dead creature's `remains` (its species row) appear with it as `foreign` items,
   * each made of the material that shares its id, and go onto the corpse with its worn gear, so
   * `strip_corpse` recovers them. No rng.
   */
  private spawnRemains(ctx: TickContext, species: number, tile: TileIndex): number[] {
    const row = ctx.registry.table<{ id: string; remains?: readonly { item: string; count: number }[] }>('creatures').byIndex(species);
    if (row?.remains === undefined || !ctx.world.map.validIndex(tile)) return [];
    const items = ctx.registry.table('items');
    const materials = ctx.registry.table('materials');
    const out: number[] = [];
    for (const { item, count } of row.remains) {
      if (!items.has(item) || !materials.has(item) || count <= 0) continue;
      const id = ctx.spawn.item(items.index(item), materials.index(item), tile, count);
      if (id === 0) continue;
      this.core.setFlag(id, ItemFlag.Foreign, true);
      out.push(id);
    }
    return out;
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    const core = this.core;
    if (event.type === 'CreatureDied') {
      const id = event['id']; const tile = event['tile'];
      const species = event['species'] ?? (typeof id === 'number' ? core.host.entities.get(id, C.Creature)?.species : undefined);
      const faction = event['faction'] ?? (typeof id === 'number' ? core.host.entities.get(id, C.Creature)?.faction : undefined);
      if (typeof id === 'number') {
        for (const itemId of core.host.entities.with(C.Item)) {
          const item = core.get(itemId);
          if (item?.ownerId === id) core.setOwner(itemId, 0);
          // Older saves may retain a personal reservation after its activity plan was lost.
          if (item?.reservedBy === id) {
            core.release(itemId);
            ctx.emit({ type: 'ItemReleased', itemId, jobId: id });
          }
        }
      }
      // 25 § Summons: a summoned species leaves no corpse.
      const summoned = typeof species === 'number' &&
        ctx.registry.table<{ id: string; flags?: { summoned?: boolean } }>('creatures').byIndex(species)?.flags?.summoned === true;
      if (typeof id === 'number' && typeof tile === 'number' && typeof species === 'number' && !summoned) {
        const equip = core.host.entities.get(id, C.Equipment);
        const wornItems = Array.isArray(event['wornItems']) ? (event['wornItems'] as number[]).slice() : equip === undefined ? [] :
          [equip.weapon, equip.shield, equip.quiver, ...Object.values(equip.armor), ...Object.values(equip.clothing)]
            .filter((itemId) => itemId !== 0 && core.isItem(itemId));
        wornItems.push(...core.carriedItems(id));
        wornItems.push(...this.spawnRemains(ctx, species, tile));
        const death = { id, tile, species, name: typeof event['name'] === 'string' ? event['name'] : core.host.entities.get(id, C.Creature)?.name ?? null,
          wornItems: Array.from(new Set(wornItems)).sort((a, b) => a - b),
          ...(typeof faction === 'string' && faction !== 'fortress' ? { foreign: true } : {}) };
        // A removed creature cannot remain the carrier until the next items cadence.
        // Keep queued deaths readable for older saves and initialization-only callers.
        if (this.rotRef !== null && ctx.world.map.validIndex(tile)) {
          this.pendingDeaths.delete(id);
          this.rotRef.createCorpse(ctx, id, species, tile, death.name, death.wornItems, death.foreign);
        } else this.pendingDeaths.set(id, death);
      }
    } else if (event.type === 'CorpseCreated') {
      const id = event['creatureId'];
      if (typeof id === 'number') this.pendingDeaths.delete(id);
    } else if (event.type === 'ThiefEscaped') {
      const itemId = event['itemId'] as number | undefined;
      if (typeof itemId === 'number' && core.host.entities.alive(itemId)) {
        core.destroy(itemId, 'stolen');
      }
    } else if (event.type === 'DayPassed') {
      if (this.cellarRef !== null) cellarDay(this.cellarRef);
    } else if (event.type === 'SeasonChanged') {
      this.rotRef?.resample();
    } else if (event.type === 'TilesChanged') {
      for (const t of event['tiles'] as readonly TileIndex[]) core.settleTile(t, this.entitiesAt);
      this.hauling.groundChanged(event['tiles'] as readonly TileIndex[]);
    } else if (event.type === 'ItemMelted') {
      // 13 § Events consumed: "`MagmaContact` (04): items with `meltsAt ≤ MAGMA_C` are destroyed with
      // `ItemMelted` (05 decides; this system destroys)".
      const id = event['id'] as number;
      if (core.host.entities.alive(id)) core.destroy(id, 'melted');
    } else if (event.type === 'BuildingCompleted') {
      // 14 § Value: "Each built building contributes `materialValue + type.valueBonus`".
      core.buildingWealth += typeof event['value'] === 'number' ? (event['value'] as number) : 0;
      // A built container in a stockpile or hospital (a hospital's chest) gives it slots.
      const building = core.host.entities.get(event['id'] as number, C.Building);
      // A building that blocks walkers takes the slot of the tile it stands on.
      if (building !== undefined) this.hauling.groundChanged(building.footprint);
      if (building !== undefined && building.itemId !== 0 && core.container(building.itemId) !== undefined &&
        building.footprint.some((t) => this.stockpiles.stockpileAt(t) !== 0)) this.hauling.slotsGained();
    } else if (event.type === 'BuildingRemoved') {
      core.buildingWealth -= typeof event['value'] === 'number' ? (event['value'] as number) : 0;
    } else if (event.type === 'ZoneChanged') {
      if (event['zoneType'] !== 'stockpile' && event['zoneType'] !== 'hospital') return;
      const id = event['zoneId'] as number;
      const change = event['change'];
      const tiles = (event['tiles'] as readonly TileIndex[] | undefined) ?? [];
      if (change === 'removed') {
        this.stockpiles.removed(id);
        this.hauling.cancelBoundFor(id);
      } else {
        this.stockpiles.ensure(id);
        if (change === 'resized') this.stockpiles.syncTiles(id);
      }
      this.stockpileChanged(id, tiles);
      this.rotRef?.resample();
    }
  }

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    const spHandler = STOCKPILE_HANDLERS[cmd.type];
    if (spHandler !== undefined) return spHandler(this.stockpileHost as StockpileCommandHost, cmd);
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
      wantsHauling: this.hauling.wants.slice(),
      noHome: this.hauling.noHome.slice(),
      slotReservations: Array.from(this.stockpiles.reservations.keys())
        .sort()
        .map((k): [string, number] => [k, this.stockpiles.reservations.get(k) as number]),
      rotQueue: this.rotRef?.serializeQueue() ?? [],
      rotRecords: Array.from(this.rotRef?.records.values() ?? []).sort((a, b) => a.id - b.id).map((r) => ({ ...r })),
      miasmaTiles: Array.from(this.rotRef?.miasma ?? []).sort((a, b) => a[0] - b[0]),
      pendingDeaths: Array.from(this.pendingDeaths.values()).sort((a, b) => a.id - b.id),
      counts: core.counts.serialize(),
      wealthCached: core.wealth,
      wealthLastEmitted: this.wealthLastEmitted,
      stockpileTiles: Array.from(this.stockpiles.tiles.keys())
        .sort((a, b) => a - b)
        .map((t): [TileIndex, number] => [t, this.stockpiles.tiles.get(t) as number]),
      rng: (this.rng as RngStream).state(),
      dirtyTypes: core.counts.dirty.slice(),
      fullStockpiles: this.hauling.full.slice(),
      buildingWealth: core.buildingWealth,
      explicitPriority: this.stockpiles.explicitPriority.slice(),
      incomingContainers: Array.from(this.stockpiles.incomingContainers.keys())
        .sort((a, b) => a - b)
        .map((c): [number, number] => [c, this.stockpiles.incomingContainers.get(c) as number]),
    };
  }

  deserialize(state: ItemsStateV1, ctx: InitContext): void {
    if (this.coreRef === null) this.init(ctx);
    const core = this.core;
    core.rebuildStockCounts();
    core.resetSearchIndex();
    core.counts.dirty.length = 0;
    core.counts.dirty.push(...state.dirtyTypes);
    core.wealth = state.wealthCached;
    core.buildingWealth = state.buildingWealth;
    this.wealthLastEmitted = state.wealthLastEmitted;
    const hauling = this.hauling;
    hauling.forgetParked();
    hauling.wants.length = 0;
    hauling.wants.push(...state.wantsHauling);
    hauling.noHome.length = 0;
    hauling.noHome.push(...state.noHome);
    hauling.full.length = 0;
    hauling.full.push(...state.fullStockpiles);
    const store = this.stockpiles;
    store.reservations.clear();
    for (const [k, j] of state.slotReservations) store.reservations.set(k, j);
    store.tiles.clear();
    for (const [t, id] of state.stockpileTiles) store.tiles.set(t, id);
    store.explicitPriority.length = 0;
    store.explicitPriority.push(...state.explicitPriority);
    store.incomingContainers.clear();
    for (const [c, sp] of state.incomingContainers) store.incomingContainers.set(c, sp);
    this.rng?.setState(state.rng);
    this.rotRef?.records.clear();
    for (const rec of state.rotRecords ?? []) this.rotRef?.records.set(rec.id, { ...rec });
    this.rotRef?.deserializeQueue(state.rotQueue);
    this.rotRef?.rebuildSources();
    this.rotRef?.miasma.clear();
    for (const [tile, expiry] of state.miasmaTiles) this.rotRef?.miasma.set(tile, expiry);
    this.pendingDeaths.clear();
    for (const death of state.pendingDeaths ?? []) this.pendingDeaths.set(death.id, death);
  }
}
