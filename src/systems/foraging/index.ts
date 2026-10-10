/** 09 Hunting, Gathering & Fishing, §§ Gathering, Fishing, Butchery; 08 § Slaughter. */
import { C } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import { PRIORITY_DEFAULT } from '@core/constants';
import { Designation, type Map3D } from '@core/map3d';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import { BaseSystem, type InitContext, type TickContext, type JobProducer, type WorldLike } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { RngStream } from '@core/rng';
import type { AnimalsReader, SpeciesRow } from '@systems/animals';
import type { BuildingsReader } from '@systems/buildings';
import type { Job, JobSink } from '@systems/jobs';
import type { ItemsReader } from '@systems/items';
import type { PlantsReader } from '@systems/plants';
import { butcherYields } from './butcher';
import { waterOfBank, floodBodies, type WaterBody } from './fishing';
import { BUTCHER_ROT_LIMIT, BUTCHER_TICKS, FISH_BASE_PERMILLE, FISH_PER_SKILL, FISH_PER_TILE, FISH_REGEN_PERCENT,
  FISH_RETRY_TICKS, FISH_TICKS, HUNT_MIN_SIZE, MIN_FISHING_TILES } from './constants';
import type { ForagingReader } from './reader';
import type { ForagingStateV1 } from './state';

export * from './constants';
export { butcherYields, type ButcherYields } from './butcher';
export { floodBodies, fishingWater, type WaterBody } from './fishing';
export type { ForagingReader } from './reader';
export const FORAGING_ID = '09';

const FISH_MATERIAL: Readonly<Record<WaterBody['kind'], string>> = Object.freeze({ river: 'trout_meat', lake: 'perch_meat', cavern: 'blindfish_meat' });

export class ForagingSystem extends BaseSystem<ForagingStateV1> {
  readonly id = FORAGING_ID;
  readonly order = 9;
  override readonly subscribes: readonly EventType[] = ['DayPassed', 'TilesChanged', 'FluidsChanged', 'ZoneChanged', 'CreatureDied', 'JobStarted', 'JobCompleted', 'JobCancelled', 'HuntKill'];
  override readonly ownsCommands: readonly CommandType[] = ['SetHuntable'];
  private world: WorldLike | null = null;
  private initCtx: InitContext | null = null;
  private rng: RngStream | null = null;
  private readerRef: ForagingReader | null = null;
  readonly huntable = new Set<number>();
  readonly hunterAssignments = new Map<EntityId, EntityId>();
  readonly bodies: WaterBody[] = [];
  readonly bodyOfTile = new Map<TileIndex, number>();
  readonly nextFishTick = new Map<EntityId, number>();
  bodiesStale = true;
  version = 0;
  nextBodyId = 1;
  dailyDue = false;
  private readonly producer: JobProducer = {
    id: 'foraging',
    produce: (ctx, sink) => this.produce(ctx, sink),
    onComplete: (job, ctx) => this.onComplete(job, ctx),
    workCentiTicks: (job) => this.workCentiTicks(job),
  };

  private get ctx(): InitContext { if (this.initCtx === null) throw new Error('09 before init'); return this.initCtx; }
  private get map(): Map3D { if (this.world === null) throw new Error('09 before init'); return this.world.map; }
  private get buildings(): BuildingsReader { return this.ctx.readers.of<BuildingsReader>('14'); }
  private get items(): ItemsReader { return this.ctx.readers.of<ItemsReader>('13'); }
  private get plants(): PlantsReader { return this.ctx.readers.of<PlantsReader>('07'); }
  private get animals(): AnimalsReader { return this.ctx.readers.of<AnimalsReader>('08'); }
  private speciesIndex(s: string | number): number { return typeof s === 'number' ? s : this.ctx.registry.table('creatures').index(s); }
  private row(s: string | number): SpeciesRow | undefined { return this.animals.def(s); }

  override init(ctx: InitContext): void {
    this.world = ctx.world; this.initCtx = ctx; this.rng = ctx.rng;
    const species = ctx.registry.table<SpeciesRow>('creatures');
    for (let i = 1; i <= species.size; i += 1) {
      const row = species.byIndex(i) as SpeciesRow;
      if (row.factionDefault === 'wild' && (row.temper === 'timid' || row.temper === 'neutral') && row.size >= HUNT_MIN_SIZE) this.huntable.add(i);
    }
    this.rebuildBodies();
    this.readerRef = {
      isHuntable: (s) => this.huntable.has(this.speciesIndex(s)),
      huntTargets: () => this.animals.wildList().filter((id) => this.huntable.has(this.world?.entities.get(id, C.Creature)?.species ?? 0) && !this.hunterAssignments.has(id)),
      waterBodyAt: (tile) => { this.ensureBodies(); const id = this.bodyOfTile.get(tile); return id === undefined ? undefined : this.body(id); },
      fishPool: (id) => { this.ensureBodies(); return this.body(id)?.fishPool ?? 0; },
      canFishAt: (tile) => this.canFishAt(tile),
      butcherYields: (s) => { const row = this.row(s); return butcherYields(row?.size ?? 0, row?.shell === true); },
    };
    ctx.register.jobProducer(this.producer);
    ctx.register.announcement('FishPoolDepleted', { severity: 'note', stringKey: 'announce.fish_pool_depleted' });
    // `09` § Registrations: "`HuntKill` note, … `HuntAbandoned { no_ammo }` alert" (T-M7-10).
    ctx.register.announcement('HuntKill', { severity: 'note', stringKey: 'announce.hunt_kill' });
    ctx.register.announcement('HuntAbandoned', { severity: 'alert', stringKey: 'announce.hunt_no_ammo',
      oneOf: { field: 'reason', values: ['no_ammo'] } });
    ctx.register.inspector('zone', { id: 'fishing', order: 30 });
    ctx.register.inspector('zone', { id: 'gather', order: 31 });
  }

  private rebuildBodies(): void {
    const old = this.bodies.slice();
    const oldAt = new Map(this.bodyOfTile);
    const built = floodBodies(this.map, ++this.version);
    const overlap = new Map<number, Map<number, number>>();
    for (const [tile, tempId] of built.bodyOfTile) {
      const oldId = oldAt.get(tile);
      if (oldId === undefined) continue;
      const counts = overlap.get(tempId) ?? new Map<number, number>();
      counts.set(oldId, (counts.get(oldId) ?? 0) + 1);
      overlap.set(tempId, counts);
    }
    const stable = new Map<number, number>();
    const used = new Set<number>();
    for (const body of built.bodies) {
      const candidates = Array.from(overlap.get(body.id) ?? []).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      const prior = candidates.find(([id]) => !used.has(id))?.[0];
      const id = prior ?? this.nextBodyId++;
      stable.set(body.id, id); used.add(id);
      const previous = prior === undefined ? undefined : old.find((b) => b.id === prior);
      if (previous !== undefined && previous.tileCount >= MIN_FISHING_TILES) {
        body.fishPool = Math.min(body.fishPool, body.fishPool * previous.fishPool / (previous.tileCount * FISH_PER_TILE));
      }
      body.id = id;
    }
    this.bodies.splice(0, this.bodies.length, ...built.bodies);
    this.bodyOfTile.clear();
    for (const [tile, tempId] of built.bodyOfTile) this.bodyOfTile.set(tile, stable.get(tempId) as number);
    this.bodiesStale = false;
  }
  private body(id: number): WaterBody | undefined { return this.bodies.find((b) => b.id === id); }
  private ensureBodies(): void { if (this.bodiesStale) this.rebuildBodies(); }

  private waterOfBank(tile: TileIndex): number {
    return waterOfBank(this.map, tile);
  }
  private canFishAt(tile: TileIndex): boolean {
    return this.map.validIndex(tile) && this.ctx.readers.pathing.passable(tile, 'walker') && this.waterOfBank(tile) >= 0;
  }

  override tick(ctx: TickContext): void {
    if (!this.dailyDue) return;
    this.dailyDue = false;
    for (const body of this.bodies) {
      if (body.tileCount < MIN_FISHING_TILES) continue;
      const capacity = body.tileCount * FISH_PER_TILE;
      body.fishPool = Math.min(capacity, body.fishPool + capacity * FISH_REGEN_PERCENT * (body.kind === 'river' ? 2 : 1) / 100);
    }
    for (const id of this.buildings.zonesOfType('gather')) {
      const zone = this.buildings.zone(id);
      if (zone === undefined) continue;
      const priority = typeof zone.settings['priority'] === 'number' ? zone.settings['priority'] as number : PRIORITY_DEFAULT;
      for (const tile of zone.tiles) if (this.plants.shrubReady(tile) && this.map.designationAt(tile) === Designation.None) ctx.terrain.setDesignation(tile, Designation.Gather, priority);
    }
  }

  override handle(event: GameEvent): void {
    if (event.type === 'DayPassed') this.dailyDue = true;
    else if (event.type === 'TilesChanged' || event.type === 'FluidsChanged' || event.type === 'ZoneChanged') this.bodiesStale = true;
    else if (event.type === 'JobStarted' && event['jobType'] === 'fish') this.ensureBodies();
    else if (event.type === 'JobStarted' && event['jobType'] === 'hunt') this.hunterAssignments.set(event['target'] as number, event['workerId'] as number);
    else if ((event.type === 'JobCompleted' || event.type === 'JobCancelled') && event['jobType'] === 'hunt') this.hunterAssignments.delete(event['target'] as number);
    else if (event.type === 'HuntKill') this.hunterAssignments.delete(event['targetId'] as number);
    else if (event.type === 'CreatureDied') this.hunterAssignments.delete(event['id'] as number);
  }

  override applyCommand(cmd: Command): CommandResult {
    if (cmd.type !== 'SetHuntable') return reject('not_found');
    const s = cmd['species']; const on = cmd['on'];
    if ((typeof s !== 'string' && typeof s !== 'number') || typeof on !== 'boolean') return reject('not_found');
    if (typeof s === 'string' && !this.ctx.registry.table('creatures').has(s)) return reject('not_found');
    const idx = this.speciesIndex(s);
    const row = this.row(idx);
    if (row === undefined || row.factionDefault !== 'wild') return reject('not_found');
    if (on) this.huntable.add(idx); else this.huntable.delete(idx);
    return OK;
  }

  /** Job producer: one fishing job per zone; butcher every eligible corpse at a built workshop. */
  produce(ctx: TickContext, sinkIn: unknown): void {
    const sink = sinkIn as JobSink;
    for (const animalId of this.readerRef?.huntTargets() ?? []) {
      if (!ctx.world.entities.alive(animalId)) continue;
      const key = `hunt:${animalId}`;
      if (sink.exists(key)) continue;
      const pos = ctx.world.entities.get(animalId, C.Position);
      if (pos === undefined) continue;
      const targetTile = this.map.index(pos.x, pos.y, pos.z);
      sink.create(key, {
        type: 'hunt',
        target: { kind: 'entity', ref: animalId },
        workTile: 'ranged',
        tool: 'ranged',
        data: { animal: animalId, anchorTile: targetTile },
      });
    }

    for (const id of this.buildings.zonesOfType('fishing')) {
      if (ctx.tick < (this.nextFishTick.get(id) ?? 0)) continue;
      const zone = this.buildings.zone(id);
      const bank = zone?.tiles.find((tile) => this.canFishAt(tile));
      if (bank === undefined) continue;
      const water = this.waterOfBank(bank);
      let bodyId = this.bodyOfTile.get(water);
      if (bodyId === undefined && this.bodiesStale) { this.ensureBodies(); bodyId = this.bodyOfTile.get(water); }
      const body = bodyId === undefined ? undefined : this.body(bodyId);
      if (body === undefined || body.fishPool < 1) continue;
      const key = `fish:${id}`;
      if (sink.exists(key)) continue;
      sink.create(key, { type: 'fish', target: { kind: 'zone', ref: id }, workTile: bank, data: { bank, anchorTile: bank } });
    }
    const workshop = this.buildings.byType('butcher').find((id) => this.buildings.get(id)?.state === 'built');
    if (workshop === undefined) return;
    const workTile = this.buildings.get(workshop)?.origin ?? -1;
    if (workTile < 0) return;
    for (const corpse of ctx.world.entities.with(C.Corpse, C.Item)) {
      const c = ctx.world.entities.get(corpse, C.Corpse);
      const row = c === undefined ? undefined : this.row(c.species);
      if (row?.flags['butcherable'] !== true) continue;
      // `items.md` § Refuse: an animal skeleton still yields `bone_pile` when butchered.
      if (this.items.rotStage(corpse) > BUTCHER_ROT_LIMIT && this.items.def(this.items.get(corpse)?.type ?? 0)?.id !== 'skeleton') continue;
      const key = `butcher:${corpse}`;
      if (sink.exists(key)) continue;
      sink.create(key, { type: 'butcher', target: { kind: 'entity', ref: corpse }, workTile,
        inputs: [{ filter: { itemId: corpse }, count: 1 }], data: { corpse, workshop, anchorTile: workTile, deliveryTile: workTile } });
    }
  }

  onComplete(jobIn: unknown, ctx: TickContext): void {
    const job = jobIn as Job;
    const type = this.ctx.registry.table('jobTypes').idOf(job.type);
    if (type === 'fish') this.completeFish(job, ctx);
    else if (type === 'butcher') this.completeButcher(job, ctx);
  }
  private completeFish(job: Job, ctx: TickContext): void {
    this.ensureBodies();
    const bank = job.data['bank'] as number;
    const water = this.waterOfBank(bank);
    const bodyId = this.bodyOfTile.get(water);
    const body = bodyId === undefined ? undefined : this.body(bodyId);
    const skillIndex = ctx.registry.table('skills').index('fishing');
    const skill = ctx.world.entities.get(job.workerId, C.Skills)?.level[skillIndex] ?? 0;
    if (body === undefined || body.fishPool < 1 || !this.canFishAt(bank) || !(this.rng as RngStream).chance(FISH_BASE_PERMILLE + skill * FISH_PER_SKILL)) {
      this.nextFishTick.set(job.target.ref, ctx.tick + FISH_RETRY_TICKS);
      return;
    }
    body.fishPool -= 1;
    const material = ctx.registry.table('materials').index(FISH_MATERIAL[body.kind]);
    ctx.spawn.item(ctx.registry.table('items').index('raw_fish'), material, bank, 1);
    ctx.emit({ type: 'FishCaught', fisherId: job.workerId, bodyId: body.id, species: FISH_MATERIAL[body.kind].replace('_meat', '') });
    if (body.fishPool < 1) ctx.emit({ type: 'FishPoolDepleted', bodyId: body.id });
  }
  private completeButcher(job: Job, ctx: TickContext): void {
    const corpse = job.data['corpse'] as number;
    const c = ctx.world.entities.get(corpse, C.Corpse);
    const row = c === undefined ? undefined : this.row(c.species);
    if (c === undefined || row === undefined) return;
    const yieldCounts = butcherYields(row.size, row.shell === true, c.juvenile === true, this.items.rotStage(corpse) >= BUTCHER_ROT_LIMIT);
    const itemTypes = ctx.registry.table('items'); const materials = ctx.registry.table('materials');
    const tile = job.data['anchorTile'] as number;
    const spawn = (type: string, material: string, count: number): void => { if (count > 0) ctx.spawn.item(itemTypes.index(type), materials.index(material), tile, count); };
    spawn('raw_meat', `${row.id}_meat`, yieldCounts.meat);
    spawn('raw_hide', `${row.id}_hide`, yieldCounts.hide);
    spawn('bone_pile', 'bone', yieldCounts.bone);
    spawn('fat', 'tallow', yieldCounts.fat);
    spawn('skull', 'skull_bone', yieldCounts.skull);
    spawn('shell_piece', `${row.id}_shell`, yieldCounts.shell);
    ctx.world.services.items?.destroy(corpse, 'butchered');
    ctx.emit({ type: 'ButcheryDone', workshopId: job.data['workshop'], species: row.id, yields: yieldCounts });
  }
  workCentiTicks(jobIn: unknown): number | undefined {
    const job = jobIn as Job;
    const type = this.ctx.registry.table('jobTypes').idOf(job.type);
    return type === 'fish' ? FISH_TICKS * 100 : type === 'butcher' ? BUTCHER_TICKS * 100 : undefined;
  }

  override reader(): ForagingReader { if (this.readerRef === null) throw new Error('09 reader before init'); return this.readerRef; }
  serialize(): ForagingStateV1 {
    return { stateVersion: 1, huntable: Array.from(this.huntable).sort((a,b)=>a-b),
      hunterAssignments: Array.from(this.hunterAssignments).sort((a,b)=>a[0]-b[0]),
      waterBodies: this.bodies.map((b)=>({...b})), bodyOfTile: Array.from(this.bodyOfTile).sort((a,b)=>a[0]-b[0]),
      bodiesStale: this.bodiesStale, version: this.version, nextBodyId: this.nextBodyId,
      nextFishTick: Array.from(this.nextFishTick).sort((a,b)=>a[0]-b[0]),
      dailyDue: this.dailyDue, rng: (this.rng as RngStream).state() };
  }
  deserialize(state: ForagingStateV1, ctx: InitContext): void {
    if (this.world === null) this.init(ctx);
    this.huntable.clear(); for (const s of state.huntable) this.huntable.add(s);
    this.hunterAssignments.clear(); for (const [a,b] of state.hunterAssignments) this.hunterAssignments.set(a,b);
    this.bodies.splice(0, this.bodies.length, ...state.waterBodies.map((b)=>({...b})));
    this.bodyOfTile.clear(); for (const [tile,id] of state.bodyOfTile) this.bodyOfTile.set(tile,id);
    this.bodiesStale = state.bodiesStale; this.version = state.version; this.nextBodyId = state.nextBodyId;
    this.nextFishTick.clear(); for (const [id,tick] of state.nextFishTick) this.nextFishTick.set(id,tick);
    this.dailyDue = state.dailyDue; (this.rng as RngStream).setState(state.rng);
  }
}
