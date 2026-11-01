/**
 * 03 Terrain & mining: the system. `02-systems/03-terrain-and-mining.md` (designations, the tile
 * API, discovery, support, restricted traffic), `04-implementation/tick-order.md` (03 terrain runs
 * first, every tick) and `schemas/system-state.md` `TerrainState`.
 *
 * Local map generation is `./generate` and runs before the world exists; this system owns the map
 * afterwards. It installs its terrain API in place of the core's M0 one (D-017, D-049).
 */

import type { Command, CommandResult } from '@core/commands';
import { reject } from '@core/commands';
import type { CommandType } from '@core/command-types';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { LocalMapSpec } from '@systems/embark';
import { TerrainCore } from './api';
import {
  applyConfirmDeepsilver,
  applyDesignate,
  applyPriority,
  applyStairwell,
  applyTraffic,
  applyUndo,
  type CommandHost,
} from './commands';
import { TerrainFacts } from './facts';
import { TerrainProducer } from './producer';
import { makeReader, type TerrainReader } from './reader';
import type { Engraving, TerrainStateV1 } from './state';
import type { StackLayer } from './generate/common';

export { TerrainCore, cavernAt, CAVERN_BANDS, type IntendedDrop } from './api';
export { TerrainFacts } from './facts';
export { TerrainProducer, JOB_TYPE_OF, jobKey, workTileOf, workCentiTicksFor } from './producer';
export { rollQuality } from './rules/engrave';
export { UNKNOWN_ROCK, type DesignationWork, type TerrainReader, type TileInspection } from './reader';
export { designationOf, stairwellTiles, type TrafficMode } from './commands';
export * from './rules/transitions';

/** The id 03 registers its reader under. */
export const TERRAIN_ID = '03';

export interface TerrainOptions {
  /** The spec the map was generated from (`FLAT_TEST_SPEC` for the fixture). */
  readonly spec?: LocalMapSpec | null;
  /** The rolled rock stack of generation, top first. */
  readonly layerStack?: readonly StackLayer[];
}

type Move = readonly [EntityId, TileIndex, TileIndex];

/** 03's command table (`command-catalog.md`). */
const COMMAND_HANDLERS: Partial<Record<CommandType, (host: CommandHost, cmd: Command) => CommandResult>> = {
  Designate: applyDesignate,
  UndoDesignation: applyUndo,
  SetDesignationPriority: applyPriority,
  SetTraffic: applyTraffic,
  DesignateStairwell: applyStairwell,
  ConfirmDeepsilver: (host) => applyConfirmDeepsilver(host),
};

export class TerrainSystem extends BaseSystem<TerrainStateV1> {
  readonly id = TERRAIN_ID;
  readonly order = 3;
  override readonly subscribes: readonly EventType[] = ['JobCompleted', 'JobCancelled', 'EntitiesMoved', 'BuildingCompleted'];
  override readonly ownsCommands: readonly CommandType[] = [
    'Designate',
    'UndoDesignation',
    'SetDesignationPriority',
    'SetTraffic',
    'DesignateStairwell',
    'ConfirmDeepsilver',
  ];

  private readonly options: TerrainOptions;
  private coreRef: TerrainCore | null = null;
  /** 03's job producer (T-M1-10). */
  producer: TerrainProducer | null = null;
  private readerRef: TerrainReader | null = null;
  private commandHost: CommandHost | null = null;
  private rng: RngStream | null = null;
  private registryMaterials: ((id: string) => number) | null = null;
  private specValue: LocalMapSpec | null;
  private layerStack: { material: number; thickness: number }[] = [];
  private bigDigCounter = 0;
  /** `EntitiesMoved` batches waiting for this system's next tick (`tick-order.md`). */
  private pendingMoves: Move[] = [];
  /**
   * The progress of the job carrying a designation. 03's job producer (T-M1-10) installs the
   * lookup; with no jobs there is no progress.
   */
  progressOf: (tile: TileIndex) => number = () => 0;

  constructor(options: TerrainOptions = {}) {
    super();
    this.options = options;
    this.specValue = options.spec ?? null;
  }

  /** The live core; valid after `init`. */
  get core(): TerrainCore {
    if (this.coreRef === null) throw new Error('03 terrain: used before init');
    return this.coreRef;
  }

  override init(ctx: InitContext): void {
    const world = ctx.world;
    const facts = new TerrainFacts(ctx.registry);
    const materials = ctx.registry.table('materials');
    const items = ctx.registry.table('items');
    this.registryMaterials = (id) => materials.index(id);
    this.layerStack = (this.options.layerStack ?? []).map((l) => ({ material: materials.index(l.material), thickness: l.thickness }));
    this.rng = ctx.rng;
    const core = new TerrainCore({
      map: world.map,
      entities: world.entities,
      facts,
      services: world.services,
      tick: () => world.calendar.tick,
      emit: (event) => world.emit(event),
      entitiesAt: (i) => ctx.readers.entities.at(i),
      // `03` § Digging as a job: "spawn the item on the tile" through the spawn API (T-M1-11).
      spawnItem: (type, material, count, tile) => {
        const m = typeof material === 'number' ? material : materials.has(material) ? materials.index(material) : 0;
        world.services.spawn.item(items.index(type), m, tile, count);
      },
    });
    this.coreRef = core;
    world.services.terrain = core;
    this.commandHost = { core, fortress: world.fortress, progressOf: (tile) => this.progressOf(tile) };
    this.readerRef = makeReader(core, () => this.specValue, (tile) => this.progressOf(tile), (tile) => this.producer?.workOf(tile) ?? null);
    // `03` § Registrations: job producer `terrain` (designation jobs, T-M1-10).
    const producer = new TerrainProducer(core, ctx.readers, ctx.rng);
    this.producer = producer;
    core.plantClearer = (tile, ripe) => producer.clearPlant(tile, ripe);
    this.progressOf = (tile) => producer.progressOf(tile);
    ctx.register.jobProducer(producer);
    ctx.register.inspector('tile', { id: 'tile', order: 0 });
    ctx.register.overlay({ id: 'designations', label: 'Designations', defaultOn: true });
    // `03` § Registrations: "Announcements: `VeinFound` as a note naming the finder and the
    // material; `CavernBreached` as an alert; `DeepsilverMined` first occurrence as a
    // danger-severity announcement that pauses; `ConstructionCollapsed` as an alert."
    ctx.register.announcement('VeinFound', { severity: 'note', stringKey: 'announce.vein_found' });
    ctx.register.announcement('CavernBreached', { severity: 'alert', stringKey: 'announce.cavern_breached' });
    ctx.register.announcement('DeepsilverMined', { severity: 'danger', stringKey: 'announce.deepsilver_mined', once: true });
    ctx.register.announcement('ConstructionCollapsed', { severity: 'alert', stringKey: 'announce.construction_collapsed' });
  }

  /**
   * `tick-order.md` 03: "discovery from last tick's EntitiesMoved". A fortress creature entering a
   * tile whose neighbours are not all discovered discovers them (`03` § Discovery).
   */
  override tick(_ctx: TickContext): void {
    if (this.pendingMoves.length === 0) return;
    const moves = this.pendingMoves;
    this.pendingMoves = [];
    const core = this.core;
    for (const [id, , to] of moves) {
      if (to < 0 || !core.isFortressCreature(id)) continue;
      if (!core.allDiscoveredAround(to)) core.discoverAround(to);
    }
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'EntitiesMoved') {
      const moves = event['moves'] as readonly Move[];
      for (const m of moves) this.pendingMoves.push(m);
    } else if (event.type === 'BuildingCompleted') {
      this.clearBlockedDesignations(event['id'] as EntityId, ctx);
    }
    // `JobCompleted` and `JobCancelled` reach 03's job producer (T-M1-10) through the jobs system;
    // `BuildingCompleted` re-checks support once 14 builds constructions (M2).
  }

  /**
   * `03` § Tile transitions: a designation worked from its own tile is cleared when a building that
   * blocks walking is built there (the producer's rule); its job goes on the producer's next scan.
   */
  private clearBlockedDesignations(buildingId: EntityId, ctx: TickContext): void {
    const producer = this.producer;
    if (producer === null || !ctx.readers.has('14')) return;
    const footprint = ctx.readers.of<{ get(id: EntityId): { readonly footprint: readonly TileIndex[] } | undefined }>('14').get(buildingId)?.footprint ?? [];
    for (const tile of footprint) if (producer.standBlocked(tile)) this.core.clearDesignation(tile);
  }

  override applyCommand(cmd: Command, _ctx: TickContext): CommandResult {
    const host = this.commandHost;
    if (host === null) return reject('not_found');
    const handler = COMMAND_HANDLERS[cmd.type];
    return handler === undefined ? reject('not_found') : handler(host, cmd);
  }

  override reader(): TerrainReader {
    if (this.readerRef === null) throw new Error('03 terrain: reader before init');
    return this.readerRef;
  }

  serialize(): TerrainStateV1 {
    const core = this.core;
    const engravings = Array.from(core.engravings.keys())
      .sort((a, b) => a - b)
      .map((tile): [TileIndex, Engraving] => [tile, { ...(core.engravings.get(tile) as Engraving) }]);
    const pendingTerrain = core.savePending();
    return {
      stateVersion: 1,
      designations: this.reader().designations(),
      engravings,
      forbiddenTiles: core.forbidden.slice(),
      cavernBreached: [core.cavernBreached[0], core.cavernBreached[1], core.cavernBreached[2]],
      layerStack: this.layerStack.map((l) => ({ ...l })),
      rng: (this.rng as RngStream).state(),
      bigDigCounter: this.bigDigCounter,
      veinsFound: core.veinsFound.slice(),
      spec: this.specValue,
      pendingMoves: this.pendingMoves.map((m) => [m[0], m[1], m[2]] as [EntityId, TileIndex, TileIndex]),
      producerCurrent: this.producer?.current ?? false,
      ...(pendingTerrain === undefined ? {} : { pendingTerrain }),
    };
  }

  deserialize(state: TerrainStateV1, ctx: InitContext): void {
    if (this.coreRef === null) this.init(ctx);
    const core = this.core;
    core.loadPending(state.pendingTerrain);
    core.designated.length = 0;
    for (const d of state.designations) core.designated.push(d.tile);
    core.designated.sort((a, b) => a - b);
    core.engravings.clear();
    for (const [tile, e] of state.engravings) core.engravings.set(tile, { ...e });
    core.forbidden.length = 0;
    core.forbidden.push(...state.forbiddenTiles);
    core.cavernBreached[0] = state.cavernBreached[0];
    core.cavernBreached[1] = state.cavernBreached[1];
    core.cavernBreached[2] = state.cavernBreached[2];
    core.veinsFound.length = 0;
    core.veinsFound.push(...state.veinsFound);
    this.layerStack = state.layerStack.map((l) => ({ ...l }));
    this.bigDigCounter = state.bigDigCounter;
    this.specValue = state.spec;
    this.pendingMoves = (state.pendingMoves ?? []).map((m) => [m[0], m[1], m[2]] as const);
    if (this.producer !== null) this.producer.current = state.producerCurrent === true;
    this.rng?.setState(state.rng);
  }

  /** The material index of a content id (for producers that drop by id). */
  materialIndex(id: string): number {
    if (this.registryMaterials === null) throw new Error('03 terrain: used before init');
    return this.registryMaterials(id);
  }
}
