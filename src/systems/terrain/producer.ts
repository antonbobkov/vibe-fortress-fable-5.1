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
import {
  CHANNEL_BASE_TICKS,
  CHOP_BASE_TICKS,
  DIG_BASE_TICKS,
  ENGRAVE_BASE_TICKS,
  GATHER_BASE_TICKS,
  MINING_STONE_DROP_PERMILLE,
  SMOOTH_BASE_TICKS,
} from './constants';
import { precondition, transition, type TransitionRolls } from './rules/transitions';
import { rollQuality } from './rules/engrave';

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
});

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
      return CHOP_BASE_TICKS * 100;
    case Designation.Gather:
      return GATHER_BASE_TICKS * 100;
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
  ) {}

  private get map(): TerrainCore['host']['map'] {
    return this.core.host.map;
  }

  /** The progress of the job carrying a tile's designation (for undo and the saved state). */
  progressOf(tile: TileIndex): number {
    if (!this.readers.has('11')) return 0;
    const kind = this.map.designationAt(tile);
    if (kind === Designation.None) return 0;
    return this.readers.of<JobsReader>('11').byKey(jobKey(kind, tile))?.progress ?? 0;
  }

  produce(_ctx: TickContext, sinkIn: unknown): void {
    if (this.core.designationsVersion === this.seenVersion) return;
    this.seenVersion = this.core.designationsVersion;
    const sink = sinkIn as JobSink;
    const map = this.map;
    // Jobs whose designation went away or changed are cancelled; priorities follow the grid.
    const jobs = this.readers.of<JobsReader>('11').list().filter((j) => j.producer === this.id);
    for (const job of jobs) {
      const tile = job.target.ref;
      const kind = map.designationAt(tile);
      if (kind === Designation.None || kind !== designationOfJob(job)) {
        sink.cancel(job.id, 'target_invalid');
        continue;
      }
      const priority = map.designationPriorityAt(tile) as Priority;
      if (priority !== job.priority) sink.setPriority(job.id, priority);
    }
    let dropped = false;
    for (const tile of this.core.designated.slice()) {
      const kind = map.designationAt(tile);
      const type = JOB_TYPE_OF[kind];
      if (type === undefined) continue;
      const key = jobKey(kind, tile);
      if (sink.exists(key)) continue;
      // `03` § Tile transitions: designated where a built building already blocks the stand.
      if (this.standBlocked(tile)) {
        this.core.clearDesignation(tile);
        dropped = true;
        continue;
      }
      sink.create(key, {
        type,
        priority: map.designationPriorityAt(tile),
        target: { kind: 'tile', ref: tile },
        workTile: workTileOf(kind, map.kindAt(tile)),
        data: { designation: kind },
      });
    }
    // The dropped designations had no job: nothing is left for a rescan to do.
    if (dropped) this.seenVersion = this.core.designationsVersion;
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
        return { type: row.yieldItem, material: row.yieldMaterial, count, ...(seed === undefined ? {} : { seed }) };
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
      core.clearDesignation(tile);
      return;
    }
    const material = map.materialAt(tile);
    const materialId = facts.materialId(material);
    const cls = facts.classOf(material);
    const mines =
      kind === Designation.Dig || kind === Designation.StairsUp || kind === Designation.StairsUpDown || kind === Designation.Ramp;
    const raw = transition(map, tile, kind, facts, this.rolls(), (m) => facts.isMetal(m));
    // `remove` returns the item 14 recorded the construction was built from (D-050, T-M2-05).
    const result =
      kind === Designation.Remove
        ? { ...raw, drops: raw.drops.map((d) => ({ ...d, type: core.constructionItemAt(tile, material) })) }
        : raw;

    // A channel removes the floor under the worker: it steps off first (`03` § Digging as a job).
    if (kind === Designation.Channel) this.stepOff(worker, tile, ctx);

    core.writeMany(result.changes);
    // With nowhere to step off to, the worker falls (22 movement helper).
    const movement = ctx.world.services.movement;
    if (movement !== null && movement.tileOf(worker) === tile && map.kindAt(tile) === TileKind.Open) movement.fall(worker, ctx);
    if (kind === Designation.Engrave) {
      const skills = core.host.entities.get(worker, C.Skills);
      const level = skills === undefined ? 0 : ((skills.level[this.skillIndex(ctx, 'engraving')] ?? 0) as number);
      core.engravings.set(tile, { quality: rollQuality(level, this.rng), engraverId: worker, motif: 0 });
    }
    core.clearDesignation(tile);

    // Discovery: a breach first (it needs the undiscovered neighbours), then the changed tiles.
    for (const c of result.changes) core.checkBreach(c.tile);
    for (const c of result.changes) core.discoverAround(c.tile);

    // Minerals and deepsilver.
    if (mines && (cls === 'ore' || cls === 'gem')) {
      ctx.emit({ type: 'MineralMined', tile, material: materialId, minerId: worker });
      if (core.findVein(tile)) ctx.emit({ type: 'VeinFound', material: materialId, tile, finderId: worker });
    }
    if (mines && facts.isDeepsilver(material)) ctx.emit({ type: 'DeepsilverMined', tile, minerId: worker });
    if (kind === Designation.Chop) ctx.emit({ type: 'TreeFelled', tile, species: facts.plant(material)?.id ?? '' });

    // Items land on the tile, or below it when the tile is now open.
    for (const d of result.drops) {
      const at = isSolidBottomed(map.kindAt(d.tile)) ? d.tile : core.landingTile(d.tile);
      core.drop(d.type, d.material, d.count, at, JOB_TYPE_OF[kind] ?? 'terrain');
    }
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
