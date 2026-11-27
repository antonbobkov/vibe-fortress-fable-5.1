/**
 * 03's job producer: `02-systems/03-terrain-and-mining.md` § Digging as a job, § Tile transitions,
 * § Discovery; `03-content/jobs.md` § Terrain.
 *
 * Every designation becomes one job (`<jobType>:<tile>`) with the designation's priority; a job
 * whose designation is removed or changed is cancelled (`target_invalid`); a job the player cancels
 * clears its designation, so it is not made again. `onComplete` applies the transition through the
 * terrain API, drops the item, and emits `MineralMined`, `VeinFound`, `DeepsilverMined`,
 * `CavernBreached` and `TreeFelled`. Experience is 10's, on `JobCompleted`.
 */

import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import { Designation, TileKind, isSolidBottomed } from '@core/map3d';
import type { RngStream } from '@core/rng';
import type { JobProducer, ReaderSetLike, TickContext } from '@core/system';
import type { EntityId, Priority, TileIndex } from '@core/types';
import type { Job, JobSink, JobsReader } from '@systems/jobs';
import type { TerrainCore } from './api';
import type { DesignationWork } from './reader';
import {
  CHANNEL_BASE_TICKS,
  CHOP_BASE_TICKS,
  DIG_BASE_TICKS,
  ENGRAVE_BASE_TICKS,
  GATHER_BASE_TICKS,
  ICE_HARVEST_TICKS,
  IGNITE_TICKS,
  MINING_STONE_DROP_PERMILLE,
  SMOOTH_BASE_TICKS,
  SOIL_DROP_PERMILLE,
} from './constants';
import { clearPlantTransition, iceDesignationHolds, precondition, transition, type TransitionRolls } from './rules/transitions';
import { rollQuality } from './rules/engrave';
import { GIANT_BONE } from './generate/boneyards';

/** `03` § Digging as a job: the job type of each designation. */
export const JOB_TYPE_OF: Readonly<Partial<Record<Designation, string>>> = Object.freeze({
  [Designation.Dig]: 'dig',
  [Designation.Channel]: 'channel',
  [Designation.StairsUp]: 'carve_stairs',
  [Designation.StairsDown]: 'carve_stairs',
  [Designation.StairsUpDown]: 'carve_stairs',
  [Designation.Ramp]: 'carve_ramp',
  [Designation.Smooth]: 'smooth',
  [Designation.Engrave]: 'engrave',
  [Designation.Remove]: 'remove_construction',
  [Designation.Chop]: 'chop',
  [Designation.Gather]: 'gather',
  [Designation.HarvestIce]: 'harvest_ice',
  [Designation.Ignite]: 'ignite',
});

/** `03` § Setting a fire: the item an `ignite` job fetches and spends. */
const FIREBRAND = 'firebrand';

/** The job states in which a worker holds the job. */
const ASSIGNED_STATES: ReadonlySet<string> = new Set(['claimed', 'fetching', 'travelling', 'working', 'completing']);

export function jobKey(kind: Designation, tile: TileIndex): string {
  return `${JOB_TYPE_OF[kind] ?? 'none'}:${tile}`;
}

/**
 * Where the worker stands (`jobs.md` workTile; `03` § Digging as a job: "adjacent (8-neighborhood
 * on the same level, or on the tile itself for channel, stairs_down and smoothing)"): `at` for a
 * channel, down stairs, and smoothing or engraving a floor; `adjacent` otherwise.
 */
export function workTileOf(kind: Designation, targetKind: TileKind): 'at' | 'adjacent' {
  if (kind === Designation.Channel || kind === Designation.StairsDown) return 'at';
  if ((kind === Designation.Smooth || kind === Designation.Engrave) && targetKind !== TileKind.Wall) return 'at';
  return 'adjacent';
}

/** The work time in hundredths of a tick (`jobs.md` § Terrain baseTicks column). */
export function workCentiTicksFor(kind: Designation, hardness: number): number {
  switch (kind) {
    case Designation.Dig:
    case Designation.Ramp:
      return DIG_BASE_TICKS * hardness;
    case Designation.Channel:
      return CHANNEL_BASE_TICKS * hardness;
    case Designation.StairsUp:
    case Designation.StairsDown:
    case Designation.StairsUpDown:
      // `DIG_BASE_TICKS × 1.2 × hardness/100`.
      return (DIG_BASE_TICKS * 12 * hardness) / 10;
    case Designation.Smooth:
      return SMOOTH_BASE_TICKS * 100;
    case Designation.Engrave:
      return ENGRAVE_BASE_TICKS * 100;
    case Designation.Remove:
      return (DIG_BASE_TICKS * 100) / 2;
    case Designation.Chop:
      // `CHOP_BASE_TICKS × max(100, hardness)/100` of the tree's wood: ironwood (200) takes twice.
      return CHOP_BASE_TICKS * Math.max(100, hardness);
    case Designation.Gather:
      return GATHER_BASE_TICKS * 100;
    case Designation.HarvestIce:
      return ICE_HARVEST_TICKS * 100;
    case Designation.Ignite:
      return IGNITE_TICKS * 100;
    case Designation.None:
    case Designation.Harvest:
      return 100;
    default:
      return 100;
  }
}

function designationOfJob(job: Job): Designation {
  const d = job.data['designation'];
  return typeof d === 'number' ? (d as Designation) : Designation.None;
}

export class TerrainProducer implements JobProducer {
  readonly id = 'terrain';
  private seenVersion = -1;

  /** True while the designations have not changed since the last scan (saved by 03, D-082). */
  get current(): boolean {
    return this.seenVersion === this.core.designationsVersion;
  }

  /** On load: the scan state as saved, so a loaded game rescans exactly when the saved one would. */
  set current(value: boolean) {
    this.seenVersion = value ? this.core.designationsVersion : -1;
  }

  constructor(
    private readonly core: TerrainCore,
    private readonly readers: ReaderSetLike,
    private readonly rng: RngStream,
    /**
     * `03` § Tile transitions: the soil drop's own stream, `03.soil_drop`, asked for only when such
     * a tile is dug, so a game that digs none never creates it and draws the same numbers.
     */
    private readonly soilRng: (() => RngStream) | null = null,
  ) {}

  private get map(): TerrainCore['host']['map'] {
    return this.core.host.map;
  }

  /** Where the work of a tile's designation stands, from its job's state (23 § Animation). */
  workOf(tile: TileIndex): DesignationWork | null {
    const kind = this.map.designationAt(tile);
    if (kind === Designation.None) return null;
    if (!this.readers.has('11')) return 'queued';
    // `03` § Ice harvesting: a designation on thawed water has no job; it waits for the ice.
    if (this.iceWaiting(tile)) return 'blocked';
    const state = this.readers.of<JobsReader>('11').stateByKey(jobKey(kind, tile));
    if (state === 'blocked') return 'blocked';
    return state !== null && ASSIGNED_STATES.has(state) ? 'assigned' : 'queued';
  }

  /** The progress of the job carrying a tile's designation (for undo and the saved state). */
  progressOf(tile: TileIndex): number {
    if (!this.readers.has('11')) return 0;
    const kind = this.map.designationAt(tile);
    if (kind === Designation.None) return 0;
    return this.readers.of<JobsReader>('11').byKey(jobKey(kind, tile))?.progress ?? 0;
  }

  produce(ctx: TickContext, sinkIn: unknown): void {
    if (this.core.designationsVersion === this.seenVersion) return;
    this.seenVersion = this.core.designationsVersion;
    const sink = sinkIn as JobSink;
    const map = this.map;
    // Jobs whose designation went away or changed are cancelled; priorities follow the grid.
    const jobs = this.readers.of<JobsReader>('11').list().filter((j) => j.producer === this.id);
    for (const job of jobs) {
      const tile = job.target.ref;
      const kind = map.designationAt(tile);
      if (kind === Designation.None || kind !== designationOfJob(job) || this.iceWaiting(tile)) {
        sink.cancel(job.id, 'target_invalid');
        continue;
      }
      const priority = map.designationPriorityAt(tile) as Priority;
      if (priority !== job.priority) sink.setPriority(job.id, priority);
    }
    let dropped = false;
    const items = ctx.registry.table('items');
    const firebrandType = items.has(FIREBRAND) ? items.index(FIREBRAND) : 0;
    for (const tile of this.core.designated.slice()) {
      const kind = map.designationAt(tile);
      const type = JOB_TYPE_OF[kind];
      if (type === undefined) continue;
      const key = jobKey(kind, tile);
      if (sink.exists(key)) continue;
      if (this.iceWaiting(tile)) {
        // Water gone from under a waiting designation (drained, dried) takes the designation with it.
        if (!iceDesignationHolds(map, tile, this.core.host.facts)) {
          this.core.clearDesignation(tile);
          dropped = true;
        }
        continue;
      }
      // `03` § Tile transitions: designated where a built building already blocks the stand.
      if (this.standBlocked(tile)) {
        this.core.clearDesignation(tile);
        dropped = true;
        continue;
      }
      // `03` § Setting a fire: an `ignite` job fetches one firebrand, which it spends.
      const firebrand = kind === Designation.Ignite ? firebrandType : 0;
      sink.create(key, {
        type,
        priority: map.designationPriorityAt(tile),
        target: { kind: 'tile', ref: tile },
        workTile: workTileOf(kind, map.kindAt(tile)),
        ...(firebrand === 0 ? {} : { inputs: [{ filter: { type: firebrand }, count: 1 }] }),
        data: firebrand === 0 ? { designation: kind } : { designation: kind, inputUnits: true },
      });
    }
    // The dropped designations had no job: nothing is left for a rescan to do.
    if (dropped) this.seenVersion = this.core.designationsVersion;
  }

  /** `03` § Ice harvesting: a `harvest_ice` designation whose water is thawed, waiting for the ice. */
  iceWaiting(tile: TileIndex): boolean {
    return this.map.designationAt(tile) === Designation.HarvestIce && !precondition(this.map, tile, Designation.HarvestIce, this.core.host.facts);
  }

  /**
   * A designation worked from its own tile (channel, down stairs, floor smoothing and engraving)
   * that a built building other than a door blocks for walking: nobody can stand there to do it.
   * A locked door blocks only for as long as it is locked.
   */
  standBlocked(tile: TileIndex): boolean {
    const map = this.map;
    const kind = map.designationAt(tile);
    if (JOB_TYPE_OF[kind] === undefined || workTileOf(kind, map.kindAt(tile)) !== 'at' || !this.readers.has('14')) return false;
    const buildings = this.readers.of<{ blocksMovementAt(i: TileIndex, cls: 'walker'): boolean; doorAt(i: TileIndex): boolean }>('14');
    return buildings.blocksMovementAt(tile, 'walker') && !buildings.doorAt(tile);
  }

  onJobEvent(event: GameEvent): void {
    // A job the player cancels takes its designation with it (`11` § Cancellation).
    if (event.type === 'JobCancelled' && event['reason'] === 'player') {
      const tile = event['target'] as TileIndex;
      if (this.map.validIndex(tile)) this.core.clearDesignation(tile);
    }
  }

  /**
   * `03` § Digging as a job: a designation job's priority set in Jobs (`SetJobPriority`) is its
   * tile's designation priority too, as `SetDesignationPriority` would set it, so the next rescan
   * keeps it.
   */
  onPriorityChanged(jobIn: unknown, priority: number): void {
    const job = jobIn as Job;
    const tile = job.target.ref;
    if (!this.map.validIndex(tile)) return;
    const kind = this.map.designationAt(tile);
    if (kind === Designation.None || kind !== designationOfJob(job)) return;
    if (this.map.designationPriorityAt(tile) !== priority) this.core.setDesignation(tile, kind, priority);
  }

  workCentiTicks(jobIn: unknown): number {
    const job = jobIn as Job;
    const tile = job.target.ref;
    return workCentiTicksFor(designationOfJob(job), this.core.host.facts.hardnessOf(this.map.materialAt(tile)));
  }

  /**
   * Carving stairs in a stairwell: the tile directly above, when it is a down or up/down stair,
   * is also a place to stand (D-058).
   */
  extraStandTiles(jobIn: unknown): readonly TileIndex[] {
    const job = jobIn as Job;
    const kind = designationOfJob(job);
    // `03` § Ice harvesting: standing on an ice floor, or from above: the tile directly above the
    // ice and its eight neighbours on that level (the bank a miner reaches down from).
    if (kind === Designation.HarvestIce) {
      const tile = job.target.ref;
      const up = this.map.above(tile);
      const out: TileIndex[] = [];
      if (this.map.kindAt(tile) === TileKind.Floor) out.push(tile);
      if (up >= 0) out.push(up, ...this.map.neighbors8(up));
      return out;
    }
    if (kind !== Designation.StairsUp && kind !== Designation.StairsUpDown) return [];
    const up = this.map.above(job.target.ref);
    if (up < 0) return [];
    const k = this.map.kindAt(up);
    return k === TileKind.StairsDown || k === TileKind.StairsUpDown ? [up] : [];
  }

  /** The rolls a transition needs, drawn from 03's stream. Public so the unit tests can sample them. */
  rolls(): TransitionRolls {
    const facts = this.core.host.facts;
    return {
      stoneDrops: () => this.rng.chance(MINING_STONE_DROP_PERMILLE),
      ...(this.soilRng === null ? {} : { soilDrops: () => (this.soilRng as () => RngStream)().chance(SOIL_DROP_PERMILLE) }),
      logs: (species) => {
        const [lo, hi] = facts.logRange(species);
        return this.rng.int(lo, hi);
      },
      gather: (species) => {
        const row = facts.plant(species);
        if (row === undefined || row.yieldItem === undefined || row.yieldMaterial === undefined) return null;
        const [lo, hi] = row.yield ?? [1, 1];
        const count = this.rng.int(lo, hi);
        // `07` § Shrubs: "and, with `wildSeedPermille`, one seed" of the crop the shrub sows.
        const permille = row.wildSeedPermille ?? 0;
        const sows = row.seedOf;
        const seed = sows !== undefined && permille > 0 && this.rng.chance(permille) ? sows : undefined;
        // `09` § Gathering: a shrub with a second product gives it too, at once (the barrel cactus's fiber).
        const second = row.kind === 'shrub' ? row.secondary : undefined;
        const extra = second === undefined ? undefined : { type: second.item, material: second.material ?? row.yieldMaterial, count: second.count };
        return { type: row.yieldItem, material: row.yieldMaterial, count, ...(seed === undefined ? {} : { seed }), ...(extra === undefined ? {} : { extra }) };
      },
      logMaterial: (species) => facts.logMaterial(species),
    };
  }

  /** `03` § Digging as a job, "On completion". */
  onComplete(jobIn: unknown, ctx: TickContext): void {
    const job = jobIn as Job;
    const core = this.core;
    const map = this.map;
    const facts = core.host.facts;
    const tile = job.target.ref;
    const kind = designationOfJob(job);
    const worker = job.workerId;
    // "When a designation is applied to a tile that no longer matches its precondition …, the
    // designation is cleared silently."
    if (!precondition(map, tile, kind, facts)) {
      // `03` § Ice harvesting: ice that thawed under the pick leaves the designation waiting for it.
      if (kind !== Designation.HarvestIce || !iceDesignationHolds(map, tile, facts)) core.clearDesignation(tile);
      return;
    }
    if (kind === Designation.HarvestIce) {
      this.cutIce(tile, worker, ctx);
      return;
    }
    if (kind === Designation.Ignite) {
      this.lightFire(job, ctx);
      return;
    }
    const wasTree = map.kindAt(tile) === TileKind.Tree;
    const material = map.materialAt(tile);
    const materialId = facts.materialId(material);
    const cls = facts.classOf(material);
    // Stairs mine only when carved from rock: cut into a floor or re-carved from stairs, they mine nothing (`03` § Digging as a job).
    const mines =
      kind === Designation.Dig || kind === Designation.Ramp ||
      ((kind === Designation.StairsUp || kind === Designation.StairsUpDown) && map.kindAt(tile) === TileKind.Wall);
    const raw = transition(map, tile, kind, facts, this.rolls(), (m) => facts.isMetal(m));
    // `remove` returns the item 14 recorded the construction was built from (D-050, T-M2-05).
    const result =
      kind === Designation.Remove
        ? { ...raw, drops: raw.drops.map((d) => ({ ...d, type: core.constructionItemAt(tile, material) })) }
        : raw;

    // A channel removes the floor under the worker: it steps off first (`03` § Digging as a job).
    if (kind === Designation.Channel) this.stepOff(worker, tile, ctx);

    core.writeMany(result.changes);
    // With nowhere to step off to, the worker falls (22 movement helper), and so does every other
    // creature standing on the tile as it opens: nothing is left in the air over the ramp below.
    const movement = ctx.world.services.movement;
    if (movement !== null && map.kindAt(tile) === TileKind.Open) {
      for (const id of core.host.entitiesAt(tile).slice()) {
        if (core.host.entities.kind(id) === 'creature') movement.fall(id, ctx);
      }
    }
    if (kind === Designation.Engrave) {
      const skills = core.host.entities.get(worker, C.Skills);
      const level = skills === undefined ? 0 : ((skills.level[this.skillIndex(ctx, 'engraving')] ?? 0) as number);
      const quality = rollQuality(level, this.rng);
      core.engravings.set(tile, { quality, engraverId: worker, motif: 0 });
      // An engraving rolls masterwork as an item does, and is told as one: the tile, no item.
      if (quality === 5) ctx.emit({ type: 'MasterworkCreated', itemId: 0, crafterId: worker, tile });
    }
    core.clearDesignation(tile);

    // Discovery: a breach first (it needs the undiscovered neighbours), then the changed tiles.
    for (const c of result.changes) core.checkBreach(c.tile);
    for (const c of result.changes) core.discoverAround(c.tile);

    // `03` § State `rockDug`: the fortress has dug a tile of rock (the workshops' stone advice reads it).
    if (mines && cls === 'stone') core.rockDug = true;
    // Minerals and deepsilver.
    if (mines && (cls === 'ore' || cls === 'gem')) {
      ctx.emit({ type: 'MineralMined', tile, material: materialId, minerId: worker });
      if (core.findVein(tile)) ctx.emit({ type: 'VeinFound', material: materialId, tile, finderId: worker });
    }
    // `03` § Digging as a job: a tile of class `bone` "emits `MineralMined` as an ore does, and no
    // `VeinFound`"; the first one dug in a fortress emits `FossilFound` once.
    if (mines && cls === 'bone') {
      ctx.emit({ type: 'MineralMined', tile, material: materialId, minerId: worker });
      if (!core.fossilFound) {
        core.fossilFound = true;
        ctx.emit({ type: 'FossilFound', dwarfId: worker, tile });
      }
    }
    if (mines && facts.isDeepsilver(material)) ctx.emit({ type: 'DeepsilverMined', tile, minerId: worker });
    if (kind === Designation.Chop && wasTree) ctx.emit({ type: 'TreeFelled', tile, species: facts.plant(material)?.id ?? '' });

    // Items land on the tile, or below it when the tile is now open.
    for (const d of result.drops) {
      const at = isSolidBottomed(map.kindAt(d.tile)) ? d.tile : core.landingTile(d.tile);
      core.drop(d.type, d.material, d.count, at, JOB_TYPE_OF[kind] ?? 'terrain');
    }
    // `03` § Tile transitions: the last wall of a boneyard's skull dug drops the `giant_skull` beside its fossil.
    for (const c of result.changes) {
      if (!core.skullDone(c.tile)) continue;
      const at = isSolidBottomed(map.kindAt(c.tile)) ? c.tile : core.landingTile(c.tile);
      core.drop('giant_skull', GIANT_BONE, 1, at, JOB_TYPE_OF[kind] ?? 'terrain');
    }
  }

  /**
   * `03` § Ice harvesting: one `stone_block` of `ice` on the worker's tile; the tile stays frozen
   * water as it was, and waits `ICE_RECUT_DAYS` before it can be designated again.
   */
  private cutIce(tile: TileIndex, worker: EntityId, ctx: TickContext): void {
    const core = this.core;
    core.clearDesignation(tile);
    core.iceCut.set(tile, ctx.tick);
    const movement = ctx.world.services.movement;
    const at = movement?.tileOf(worker) ?? -1;
    // With no worker on the map (a test's direct completion), the block lands where the tile above lets it.
    const drop = at >= 0 ? at : core.landingTile(this.map.above(tile) >= 0 ? this.map.above(tile) : tile);
    core.drop('stone_block', this.map.materialAt(tile), 1, drop, 'harvest_ice');
  }

  /**
   * `03` § Setting a fire: the firebrand is spent and `TileIgnited` names the tile and the dwarf;
   * 05 lights it at its next materials tick by its ordinary ignition.
   */
  private lightFire(job: Job, ctx: TickContext): void {
    const tile = job.target.ref;
    this.core.clearDesignation(tile);
    const items = ctx.world.services.items;
    for (const input of job.inputs) {
      for (const id of input.delivered) {
        if (items !== null) items.consume(id, 1);
        else ctx.world.entities.destroy(id);
      }
    }
    ctx.emit({ type: 'TileIgnited', tile, dwarfId: job.workerId });
  }

  /** 14 § Placement step 4 through the terrain API: uproot a sapling or shrub, dropping a ripe shrub's product. */
  clearPlant(tile: TileIndex, ripe: boolean): void {
    const core = this.core;
    const kind = this.map.kindAt(tile);
    if (kind !== TileKind.Sapling && kind !== TileKind.Shrub) return;
    const result = clearPlantTransition(this.map, tile, core.host.facts, this.rolls(), ripe);
    core.writeMany(result.changes);
    core.clearDesignation(tile);
    for (const d of result.drops) core.drop(d.type, d.material, d.count, d.tile, 'clear_plant');
  }

  private skillIndex(ctx: TickContext, id: string): number {
    return ctx.registry.table('skills').index(id);
  }

  /** Move the worker off a tile that is about to open, to a walkable 8-neighbour on its level. */
  private stepOff(worker: EntityId, tile: TileIndex, ctx: TickContext): void {
    const movement = ctx.world.services.movement;
    if (movement === null || movement.tileOf(worker) !== tile) return;
    for (const n of this.map.neighbors8(tile)) {
      if (this.readers.pathing.passable(n, 'walker', { faction: 'fortress' })) {
        movement.teleport(worker, n);
        return;
      }
    }
  }
}
