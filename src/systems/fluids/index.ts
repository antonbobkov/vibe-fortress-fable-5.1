/**
 * 04 Fluids: the system. `02-systems/04-fluids.md`, `04-implementation/algorithms/fluids.md`,
 * `tick-order.md` (04 runs every second tick: the water step, and the magma step every fourth
 * tick) and `schemas/system-state.md` `FluidsState`.
 */

import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext } from '@core/system';
import { C } from '@core/components';
import type { TileIndex } from '@core/types';
import { FLUID_TICK_CADENCE_WATER } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings/reader';
import { makeReader, type FluidsReader } from './reader';
import { FluidSim } from './step';
import type { FluidsStateV1 } from './state';

export { FluidSim } from './step';
export type { FluidsReader, FluidTypeName } from './reader';

/** The id 04 registers its reader under. */
export const FLUIDS_ID = '04';

export interface FluidsOptions {
  /** River outflow tiles of the generated map (`LocalMapResult.sinks`). */
  readonly sinks?: readonly TileIndex[];
}

const BUILDINGS_ID = '14';

export class FluidsSystem extends BaseSystem<FluidsStateV1> {
  readonly id = FLUIDS_ID;
  readonly order = 4;
  override readonly cadence = FLUID_TICK_CADENCE_WATER;
  override readonly phase = 0;
  override readonly subscribes: readonly EventType[] = ['TilesChanged', 'BuildingStateChanged', 'EntitiesMoved'];

  private readonly options: FluidsOptions;
  private simRef: FluidSim | null = null;
  private readerRef: FluidsReader | null = null;
  private rng: RngStream | null = null;

  constructor(options: FluidsOptions = {}) {
    super();
    this.options = options;
  }

  /** The live simulation; valid after `init`. */
  get sim(): FluidSim {
    if (this.simRef === null) throw new Error('04 fluids: used before init');
    return this.simRef;
  }

  override init(ctx: InitContext): void {
    const world = ctx.world;
    const materials = ctx.registry.table<{ id: string; class: string }>('materials');
    const mudClass: boolean[] = [];
    for (let m = 1; m <= materials.size; m += 1) {
      const cls = materials.byIndex(m)?.class;
      mudClass[m] = cls === 'soil' || cls === 'stone';
    }
    const readers = ctx.readers;
    let buildings: BuildingsReader | null | undefined;
    const buildingsReader = (): BuildingsReader | null => {
      if (buildings === undefined || buildings === null) buildings = readers.has(BUILDINGS_ID) ? readers.of<BuildingsReader>(BUILDINGS_ID) : null;
      return buildings;
    };
    this.rng = ctx.rng;
    const sim = new FluidSim({
      map: world.map,
      rng: ctx.rng,
      terrain: () => world.services.terrain,
      blocksFluidAt: (i) => buildingsReader()?.blocksFluidAt(i) === true,
      blocksFallAt: (i) => buildingsReader()?.blocksFallAt(i) === true,
      mudMaterial: (m) => mudClass[m] === true,
      // `04` § Water and magma contact names the material.
      obsidian: materials.has('obsidian') ? materials.index('obsidian') : 0,
      entitiesAt: (i) => readers.entities.at(i),
      creatureSize: (id) => (world.entities.kind(id) === 'creature' ? (world.entities.get(id, C.Creature)?.sizeClass ?? 0) : -1),
      emit: (event) => world.emit(event),
    });
    sim.scanSources();
    sim.rescanDrained();
    for (const s of [...(this.options.sinks ?? [])].sort((a, b) => a - b)) sim.sinks.push(s);
    this.simRef = sim;
    this.readerRef = makeReader(sim, () => false);
    // `04` § Registrations: overlay `fluid levels`, inspector section `tile › fluid`.
    ctx.register.overlay({ id: 'fluid_levels', label: 'Fluid levels', defaultOn: false });
    ctx.register.inspector('tile', { id: 'fluid', order: 10 });
    // `04` § Player-facing behavior: "`ObsidianFormed` as a note".
    ctx.register.announcement('ObsidianFormed', { severity: 'note', stringKey: 'announce.obsidian_formed' });
  }

  override tick(ctx: TickContext): void {
    const sim = this.sim;
    sim.run(ctx.tick);
    const chunks = sim.takeTouchedChunks();
    if (chunks.length > 0) ctx.emit({ type: 'FluidsChanged', chunks });
  }

  /**
   * `04` § Step algorithm: "Any `TilesChanged` event from 03 or a building state change from 14/19
   * touches the changed tiles and their neighbors."
   */
  override handle(event: GameEvent, ctx: TickContext): void {
    const sim = this.sim;
    if (event.type === 'TilesChanged') {
      for (const t of event['tiles'] as readonly TileIndex[]) sim.touch(t);
    } else if (event.type === 'BuildingStateChanged') {
      const b = ctx.readers.entities.get(event['id'] as number, C.Building);
      if (b !== undefined) for (const t of b.footprint) sim.touch(t);
    } else if (event.type === 'EntitiesMoved') {
      // `tick-order.md`: 04 consumes `EntitiesMoved`; a creature that fell or was pushed into deep
      // water or magma is checked where it landed (`04` § Creatures and items in fluid).
      for (const [id, , to] of event['moves'] as readonly (readonly [number, number, number])[]) {
        if (to >= 0) sim.checkEntities(to, id);
      }
    }
  }

  override reader(): FluidsReader {
    if (this.readerRef === null) throw new Error('04 fluids: reader before init');
    return this.readerRef;
  }

  serialize(): FluidsStateV1 {
    const sim = this.sim;
    const active: number[] = [];
    const offsets: number[] = [0];
    const idle: number[] = [];
    for (let c = 0; c < sim.active.length; c += 1) {
      const list = sim.active[c] as number[];
      for (let k = 0; k < list.length; k += 1) {
        const t = list[k] as number;
        active.push(t);
        idle.push(sim.idle[t] as number);
      }
      offsets.push(active.length);
    }
    return {
      stateVersion: 1,
      active,
      activeChunkOffsets: offsets,
      idleCounter: idle,
      waterSources: sim.waterSources.slice(),
      magmaSources: sim.magmaSources.slice(),
      sinks: sim.sinks.slice(),
      outdoorWaterTiles: [],
      frozenOriginalKind: [],
      mistTiles: [],
      stepParity: sim.parity,
      spreadRotation: sim.rotation,
      rng: (this.rng as RngStream).state(),
      freezePending: false,
    };
  }

  deserialize(state: FluidsStateV1, ctx: InitContext): void {
    if (this.simRef === null) this.init(ctx);
    const sim = this.sim;
    const map = sim.map;
    for (let c = 0; c < sim.active.length; c += 1) {
      const list = sim.active[c] as number[];
      for (const t of list) {
        sim.isActive[t] = 0;
        sim.idle[t] = 0;
      }
      list.length = 0;
    }
    for (let c = 0; c < sim.active.length; c += 1) {
      const from = state.activeChunkOffsets[c] ?? 0;
      const to = state.activeChunkOffsets[c + 1] ?? from;
      const list = sim.active[c] as number[];
      for (let k = from; k < to; k += 1) {
        const t = state.active[k] as number;
        list.push(t);
        sim.isActive[t] = 1;
        sim.idle[t] = state.idleCounter[k] ?? 0;
      }
      const rec = map.chunk(c);
      if (rec !== undefined) rec.activeFluidCount = list.length;
    }
    const copy = (to: number[], from: readonly number[]): void => {
      to.length = 0;
      for (let k = 0; k < from.length; k += 1) to.push(from[k] as number);
    };
    copy(sim.waterSources, state.waterSources);
    copy(sim.magmaSources, state.magmaSources);
    copy(sim.sinks, state.sinks);
    sim.parity = state.stepParity;
    sim.rotation = state.spreadRotation;
    sim.rescanDrained();
    this.rng?.setState(state.rng);
  }
}
