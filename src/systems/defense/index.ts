/** System 19: `02-systems/19-defense-and-traps.md`. */
import { C, ItemFlag } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext, type WorldLike } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import { updatePlate } from './plates';
import { PLATE_RESET_TICKS } from '@systems/buildings/constants';
import type { DefenseReader } from './reader';
import { retreatTile } from './retreat';
import type { DefenseStateV1, PlateRecord, TrapKind, TrapRecord } from './state';
import { triggerTrap } from './traps';
import { SPOT_RADIUS_DOG } from '@systems/threats/constants';

export type { DefenseReader } from './reader';
export * from './constants';

const TRAP_KINDS: readonly TrapKind[] = ['stone_fall', 'spike', 'cage', 'weapon'];

export class DefenseSystem extends BaseSystem<DefenseStateV1> {
  readonly id = '19';
  readonly order = 19;
  override readonly subscribes: readonly EventType[] = ['EntitiesMoved', 'BuildingCompleted', 'BuildingRemoved', 'BuildingStateChanged', 'FluidsChanged', 'JobCompleted', 'AlertChanged', 'CreatureDied'];
  override readonly ownsCommands: readonly CommandType[] = ['SetTrapMode', 'PullLever'];
  readonly traps = new Map<EntityId, TrapRecord>();
  readonly trapTiles = new Map<TileIndex, EntityId>();
  readonly plates = new Map<EntityId, PlateRecord>();
  readonly chains = new Map<EntityId, EntityId>();
  private world: WorldLike | null = null;
  private initCtx: InitContext | null = null;
  private rng: RngStream | null = null;

  override init(ctx: InitContext): void {
    this.world = ctx.world;
    this.initCtx = ctx;
    this.rng = ctx.rng;
    ctx.register.jobProducer({
      id: 'defense',
      produce: (tick) => this.produce(tick),
      onComplete: (job, tick) => this.completeJob(job as { key: string; target: { ref: number }; inputs: { delivered: EntityId[] }[] }, tick),
    });
    ctx.register.announcement('TrapTriggered', { severity: 'note', stringKey: 'announce.trap_triggered' });
    ctx.register.announcement('TrapJammed', { severity: 'alert', stringKey: 'announce.trap_jammed' });
    ctx.register.announcement('TrapSpent', { severity: 'note', stringKey: 'announce.trap_spent' });
    ctx.register.announcement('CreatureCaged', { severity: 'alert', stringKey: 'announce.creature_caged' });
    ctx.register.inspector('building', { id: 'trap', order: 30 });
    ctx.register.inspector('building', { id: 'plate', order: 31 });
  }

  override reader(): DefenseReader {
    return {
      trapAt: (tile) => this.trapTiles.get(tile) ?? 0,
      trapState: (id) => this.traps.get(id)?.state ?? null,
      trapMode: (id) => this.traps.get(id)?.mode ?? null,
      retreatTile: (id) => this.initCtx === null ? -1 : retreatTile(this.initCtx, id),
      plateActive: (id) => this.plates.get(id)?.lastState ?? false,
      stationOf: (animalId) => this.world?.entities.get(animalId, C.Tame)?.assignedTo ?? 0,
    };
  }

  private registerBuilding(id: EntityId, ctx: TickContext): void {
    const b = ctx.world.entities.get(id, C.Building);
    if (b?.state !== 'built') return;
    const row = ctx.registry.table<{ id: string; tags: readonly string[] }>('buildings').byIndex(b.type);
    const tag = row?.tags.find((candidate) => candidate.startsWith('trap:'));
    const kind = tag?.slice(5) as TrapKind | undefined;
    if (kind !== undefined && TRAP_KINDS.includes(kind)) {
      this.traps.set(id, { kind, mode: b.mode === 'all' ? 'all' : 'enemies', state: 'armed', loaded: ((b.settings['trapLoaded'] as EntityId[] | undefined) ?? []).slice() });
      for (const tile of b.footprint) this.trapTiles.set(tile, id);
    }
    if (row?.tags.includes('plate')) this.plates.set(id, { lastState: false, lastEdgeTick: -PLATE_RESET_TICKS });
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'BuildingCompleted') { this.registerBuilding(event['id'] as EntityId, ctx); return; }
    if (event.type === 'BuildingRemoved') {
      const id = event['id'] as EntityId;
      const tile = Array.from(this.trapTiles.entries()).find(([, trapId]) => trapId === id)?.[0] ?? -1;
      if (tile >= 0) for (const item of this.traps.get(id)?.loaded ?? []) ctx.world.services.items?.uninstall?.(item, tile);
      this.traps.delete(id);
      this.plates.delete(id);
      this.chains.delete(id);
      for (const [tile, trapId] of Array.from(this.trapTiles.entries())) if (trapId === id) this.trapTiles.delete(tile);
      return;
    }
    if (event.type === 'BuildingStateChanged' && event['state'] === 'extended') {
      const id = event['id'] as EntityId;
      const record = this.traps.get(id);
      const building = ctx.world.entities.get(id, C.Building);
      if (record?.kind === 'spike' && building !== undefined) {
        for (const creatureId of ctx.readers.entities.at(building.origin)) triggerTrap(ctx, id, creatureId, record);
      }
    }
    if (event.type === 'EntitiesMoved') {
      for (const move of (event['moves'] as [EntityId, TileIndex, TileIndex][])) {
        const [id, , to] = move;
        const trapId = this.trapTiles.get(to);
        const record = trapId === undefined ? undefined : this.traps.get(trapId);
        if (trapId !== undefined && record !== undefined) triggerTrap(ctx, trapId, id, record);
      }
    }
    if (event.type === 'JobCompleted' && event['jobType'] === 'pull_lever') {
      const id = event['target'];
      const b = typeof id === 'number' ? ctx.world.entities.get(id, C.Building) : undefined;
      if (b === undefined) return;
      const on = !b.toggled;
      ctx.world.entities.add(id as EntityId, C.Building, { ...b, toggled: on });
      ctx.emit({ type: 'MechanismTriggered', sourceId: id, on });
    }
    if (event.type === 'FluidsChanged') {
      for (const id of Array.from(this.plates.keys()).sort((a, b) => a - b)) updatePlate(ctx, id, this.plates.get(id) as PlateRecord);
    }
  }

  override tick(ctx: TickContext): void {
    for (const id of Array.from(this.plates.keys()).sort((a, b) => a - b)) updatePlate(ctx, id, this.plates.get(id) as PlateRecord);
    this.chains.clear();
    const buildings = ctx.readers.of<BuildingsReader>('14');
    for (const animalId of ctx.world.entities.with(C.Tame)) {
      const station = ctx.world.entities.get(animalId, C.Tame)?.assignedTo ?? 0;
      if (station !== 0 && buildings.get(station)?.state === 'built' && buildings.byTag('chain').includes(station)) {
        this.chains.set(station, animalId);
        const at = ctx.world.services.movement?.tileOf(animalId) ?? -1;
        if (at < 0) continue;
        for (const hostileId of ctx.world.entities.with(C.Hostile)) {
          const hostile = ctx.world.entities.get(hostileId, C.Hostile);
          const pos = ctx.world.entities.get(hostileId, C.Position);
          if (hostile?.stealthed !== true || pos === undefined || pos.z !== ctx.world.map.zOf(at)) continue;
          if (Math.max(Math.abs(pos.x - ctx.world.map.xOf(at)), Math.abs(pos.y - ctx.world.map.yOf(at))) <= SPOT_RADIUS_DOG) {
            ctx.world.entities.add(hostileId, C.Hostile, { ...hostile, stealthed: false, spotted: true });
            ctx.emit({ type: 'ThiefSpotted', id: hostileId, animalId });
          }
        }
      }
    }
  }

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    if (cmd.type === 'SetTrapMode') {
      const id = cmd['trapId'];
      const trap = typeof id === 'number' ? this.traps.get(id) : undefined;
      if (trap === undefined) return reject('not_found');
      if (cmd['mode'] !== 'enemies' && cmd['mode'] !== 'all') return reject('bad_setting');
      trap.mode = cmd['mode'];
      return OK;
    }
    if (cmd.type === 'PullLever') {
      const id = cmd['leverId'];
      const b = typeof id === 'number' ? ctx.readers.of<BuildingsReader>('14').get(id) : undefined;
      if (b === undefined) return reject('not_found');
      if (b.state !== 'built' || !ctx.readers.of<BuildingsReader>('14').byTag('lever').includes(id as number)) return reject('no_tag');
      ctx.jobs.create(`pull_lever:${id}:${ctx.tick}`, { type: 'pull_lever', target: { kind: 'building', ref: id as number }, workTile: 'adjacent', data: { anchorTile: b.origin } });
      return OK;
    }
    return reject('not_found');
  }

  private produce(ctx: TickContext): void {
    const jobs = ctx.readers.of<JobsReader>('11');
    const auto = jobs.standingOrder('autoRearmTraps');
    const buildings = ctx.readers.of<BuildingsReader>('14');
    for (const id of Array.from(this.traps.keys()).sort((a, b) => a - b)) {
      const trap = this.traps.get(id) as TrapRecord;
      const b = buildings.get(id);
      if (b === undefined) continue;
      if (trap.state === 'spent' && auto && !ctx.jobs.exists(`rearm_trap:${id}`)) {
        const row = ctx.registry.table<{ id: string; inputs: readonly { match: string }[] }>('buildings').byIndex(b.type);
        const types = buildings.inputTypes(row?.inputs[1]?.match ?? '');
        ctx.jobs.create(`rearm_trap:${id}`, { type: 'rearm_trap', target: { kind: 'building', ref: id }, workTile: 'adjacent',
          inputs: types.length > 0 ? [{ filter: { types, ...(trap.kind === 'cage' ? { unoccupied: true } : {}) }, count: 1 }] : [], data: { anchorTile: b.origin } });
      }
      if (trap.state === 'jammed' && !ctx.jobs.exists(`clean_trap:${id}`)) {
        ctx.jobs.create(`clean_trap:${id}`, { type: 'clean_trap', target: { kind: 'building', ref: id }, workTile: 'adjacent', data: { anchorTile: b.origin } });
      }
    }
  }

  private completeJob(job: { key: string; target: { ref: number }; inputs: { delivered: EntityId[] }[] }, ctx: TickContext): void {
    const id = job.target.ref;
    const trap = this.traps.get(id);
    if (trap === undefined) return;
    if (job.key.startsWith('rearm_trap:')) {
      const item = job.inputs[0]?.delivered[0];
      if (item === undefined) return;
      ctx.world.services.items?.install?.(item);
      trap.loaded = [item];
      trap.state = 'armed';
      ctx.emit({ type: 'TrapRearmed', trapId: id });
    } else if (job.key.startsWith('clean_trap:')) {
      const b = ctx.world.entities.get(id, C.Building);
      if (b === undefined) return;
      for (const corpse of ctx.readers.entities.at(b.origin)) {
        if (ctx.world.entities.has(corpse, C.Corpse)) ctx.world.services.items?.setFlag(corpse, ItemFlag.Dump, true);
      }
      trap.state = 'armed';
    }
  }

  serialize(): DefenseStateV1 {
    return { stateVersion: 1,
      traps: Array.from(this.traps.entries()).sort((a, b) => a[0] - b[0]).map(([id, value]) => [id, { ...value, loaded: value.loaded.slice() }]),
      trapTiles: Array.from(this.trapTiles.entries()).sort((a, b) => a[0] - b[0]),
      plates: Array.from(this.plates.entries()).sort((a, b) => a[0] - b[0]).map(([id, value]) => [id, { ...value }]),
      chains: Array.from(this.chains.entries()).sort((a, b) => a[0] - b[0]),
      rng: (this.rng as RngStream).state() };
  }
  deserialize(state: DefenseStateV1, ctx: InitContext): void {
    if (this.rng === null) this.init(ctx);
    this.traps.clear(); for (const [id, record] of state.traps) this.traps.set(id, { ...record, loaded: record.loaded.slice() });
    this.trapTiles.clear(); for (const [tile, id] of state.trapTiles) this.trapTiles.set(tile, id);
    this.plates.clear(); for (const [id, record] of state.plates) this.plates.set(id, { ...record });
    this.chains.clear(); for (const [id, animal] of state.chains) this.chains.set(id, animal);
    this.rng?.setState(state.rng);
  }
}
