/**
 * 07's job producer: `02-systems/07-plants-and-farming.md` § Farm plots (`plant` and `harvest`),
 * `04-implementation/algorithms/environment.md` § Plant growth (the `plots (hourly)` and
 * `harvest jobs` blocks), and `03-content/jobs.md` § Plants.
 *
 * ```
 * plots (hourly): for each plot, species = settings.cropBySeason[season]
 *   for each tile with no crop and no job: a seed in stock → plant job, else PlotNeedsSeeds once
 * harvest: crops at stage 3 with `autoHarvest` (11) or a `harvest` designation
 * plant  onComplete: consume the delivered seed, create the Crop at stage 0, CropPlanted
 * harvest onComplete: yieldCount of yieldItem (rolled, +1 per 5 farming levels, capped at max + 2),
 *                     SEEDS_PER_HARVEST seeds, the secondary yield, destroy the crop, CropHarvested
 * ```
 *
 * The producer is polled by 11 every tick; 07 raises {@link PlantsProducer.due} once per game hour
 * so that the plot scan keeps the cadence `tick-order.md` gives it.
 */

import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import { Designation, TileFlag, type Map3D } from '@core/map3d';
import type { RngStream } from '@core/rng';
import type { JobProducer, ReaderSetLike, TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { ItemFilter, Job, JobSink, JobsReader } from '@systems/jobs';
import type { ItemsReader } from '@systems/items';
import type { BuildingsReader } from '@systems/buildings';
import { rollQuality } from '@systems/terrain/rules/engrave';
import { HARVEST_TICKS, PLANT_TICKS, SEEDS_PER_HARVEST } from './constants';
import type { PlantFacts } from './facts';
import { harvestCount, isMature, stageLength } from './growth';
import { cropsOf, isAshTile } from './plots';

/** `11` § Standing orders: "`autoHarvest` (07)". */
export const AUTO_HARVEST = 'autoHarvest';

export function plantKey(tile: TileIndex): string {
  return `plant:${tile}`;
}

export function harvestKey(tile: TileIndex): string {
  return `harvest:${tile}`;
}

/** What the producer needs from the system that owns the crops. */
export interface PlantsProducerHost {
  readonly facts: PlantFacts;
  readonly map: Map3D;
  readonly readers: ReaderSetLike;
  readonly rng: RngStream;
  /** Tile → crop entity. */
  readonly cropAtTile: Map<TileIndex, EntityId>;
  /** Farm plot zone ids, ascending. */
  plots(): readonly EntityId[];
  /** Create the crop entity at stage 0 and emit `CropPlanted`. */
  plantCrop(ctx: TickContext, tile: TileIndex, plant: number, zoneId: EntityId): EntityId;
  /** Remove a crop entity (no event). */
  removeCrop(id: EntityId): void;
  /** `PlotNeedsSeeds` once per plot per season. */
  announceNeedsSeeds(ctx: TickContext, zoneId: EntityId, plant: number): void;
  /** `07` § Ash: a wyrmtongue harvest renews its tile's ash. */
  renewAsh(tile: TileIndex, tick: number): void;
}

export class PlantsProducer implements JobProducer {
  readonly id = 'plants';
  /** Raised by 07's hourly tick; the scan runs on 11's next poll. */
  due = true;

  constructor(private readonly host: PlantsProducerHost) {}

  private get facts(): PlantFacts {
    return this.host.facts;
  }

  private items(): ItemsReader | null {
    return this.host.readers.has('13') ? this.host.readers.of<ItemsReader>('13') : null;
  }

  private buildings(): BuildingsReader | null {
    return this.host.readers.has('14') ? this.host.readers.of<BuildingsReader>('14') : null;
  }

  /** `07` § Seeds: the `seed` item type with the species as material. */
  seedFilter(plant: number): ItemFilter {
    return { type: this.facts.seedItem, materialId: this.facts.materialOf(plant) };
  }

  produce(ctx: TickContext, sinkIn: unknown): void {
    if (!this.due) return;
    this.due = false;
    const sink = sinkIn as JobSink;
    this.cancelStale(sink);
    this.plantJobs(ctx, sink);
    this.harvestJobs(ctx, sink);
  }

  /** Jobs whose tile grew a crop, left its plot, or whose crop is gone. */
  private cancelStale(sink: JobSink): void {
    if (!this.host.readers.has('11')) return;
    const jobs = this.host.readers.of<JobsReader>('11').list().filter((j) => j.producer === this.id);
    for (const job of jobs) {
      if (job.key.startsWith('plant:')) {
        const tile = job.target.ref;
        const zone = typeof job.data['zone'] === 'number' ? (job.data['zone'] as EntityId) : 0;
        const stillInPlot = this.buildings()?.zoneAt(tile) === zone;
        if (this.host.cropAtTile.has(tile) || !stillInPlot || this.underBuilding(tile)) sink.cancel(job.id, 'target_invalid');
      } else if (job.key.startsWith('harvest:')) {
        const tile = typeof job.data['tile'] === 'number' ? (job.data['tile'] as TileIndex) : -1;
        if (this.host.cropAtTile.get(tile) !== job.target.ref) sink.cancel(job.id, 'target_invalid');
      }
    }
  }

  /** `07` § Farm plots: a plot tile that a built building covers is not plantable. */
  private underBuilding(tile: TileIndex): boolean {
    const buildings = this.buildings();
    const id = buildings === null ? 0 : buildings.at(tile);
    return id !== 0 && buildings?.get(id)?.state === 'built';
  }

  private plantJobs(ctx: TickContext, sink: JobSink): void {
    const season = ctx.readers.calendar.season;
    const buildings = this.buildings();
    const items = this.items();
    if (buildings === null) return;
    for (const zoneId of this.host.plots()) {
      const zone = buildings.zone(zoneId);
      if (zone === undefined) continue;
      const plant = cropsOf(zone.settings)[season] ?? 0;
      if (plant === 0) continue;
      const filter = this.seedFilter(plant);
      let available = items === null ? 0 : items.countAvailable(filter);
      let short = false;
      const ashOnly = this.facts.ashOnly(plant);
      for (const tile of zone.tiles) {
        if (this.host.cropAtTile.has(tile) || this.underBuilding(tile)) continue;
        // `07` § Ash: wyrmtongue is sown only on an ash tile; every other crop never on one with `ash`.
        if (ashOnly ? !isAshTile(this.host.map, tile, this.facts.ashSoil) : this.host.map.hasFlag(tile, TileFlag.Ash)) continue;
        const key = plantKey(tile);
        if (sink.exists(key)) {
          available -= 1;
          continue;
        }
        if (available <= 0) {
          short = true;
          continue;
        }
        available -= 1;
        sink.create(key, {
          type: 'plant',
          target: { kind: 'tile', ref: tile },
          workTile: 'at',
          inputs: [{ filter, count: 1 }],
          data: { species: plant, zone: zoneId, deliveryTile: tile },
        });
      }
      if (short) this.host.announceNeedsSeeds(ctx, zoneId, plant);
    }
  }

  private harvestJobs(ctx: TickContext, sink: JobSink): void {
    const auto = this.host.readers.has('11') && this.host.readers.of<JobsReader>('11').standingOrder(AUTO_HARVEST);
    const entities = ctx.world.entities;
    for (const tile of Array.from(this.host.cropAtTile.keys()).sort((a, b) => a - b)) {
      const id = this.host.cropAtTile.get(tile) as EntityId;
      const crop = entities.get(id, C.Crop);
      if (crop === undefined) continue;
      const row = this.facts.row(crop.plant);
      if (row === undefined || !isMature({ stage: crop.stage, growth: crop.growth }, stageLength(row))) continue;
      const designated = this.host.map.designationAt(tile) === Designation.Harvest;
      if (!auto && !designated) continue;
      const key = harvestKey(tile);
      if (sink.exists(key)) continue;
      sink.create(key, {
        type: 'harvest',
        target: { kind: 'entity', ref: id },
        workTile: 'at',
        data: { tile, anchorTile: tile, crop: id },
      });
    }
  }

  /** `jobs.md`: `plant` takes `PLANT_TICKS`, `harvest` takes `HARVEST_TICKS` (skill-scaled by 11). */
  workCentiTicks(jobIn: unknown): number {
    const job = jobIn as Job;
    return (job.key.startsWith('plant:') ? PLANT_TICKS : HARVEST_TICKS) * 100;
  }

  onComplete(jobIn: unknown, ctx: TickContext): void {
    const job = jobIn as Job;
    if (job.key.startsWith('plant:')) this.completePlant(job, ctx);
    else if (job.key.startsWith('harvest:')) this.completeHarvest(job, ctx);
  }

  /** "fetch the seed, walk to the tile, work `PLANT_TICKS`, consume the seed, create the `Crop`". */
  private completePlant(job: Job, ctx: TickContext): void {
    const tile = job.target.ref;
    const plant = job.data['species'];
    const zone = job.data['zone'];
    if (typeof plant !== 'number' || typeof zone !== 'number') return;
    if (this.host.cropAtTile.has(tile)) return;
    const api = ctx.world.services.items;
    for (const input of job.inputs) {
      for (const it of input.delivered) {
        if (ctx.world.entities.alive(it)) api?.consume(it, 1);
      }
    }
    this.host.plantCrop(ctx, tile, plant, zone);
  }

  /**
   * "spawn `yieldCount` of `yieldItem` (rolled, +1 per 5 farming skill levels, capped at
   * `yieldMax + 2`) and exactly `SEEDS_PER_HARVEST` seeds, plus the secondary yield if any;
   * destroy the crop."
   */
  private completeHarvest(job: Job, ctx: TickContext): void {
    const tile = typeof job.data['tile'] === 'number' ? (job.data['tile'] as TileIndex) : -1;
    const id = this.host.cropAtTile.get(tile);
    if (id === undefined) return;
    const crop = ctx.world.entities.get(id, C.Crop);
    if (crop === undefined) return;
    const facts = this.facts;
    const row = facts.row(crop.plant);
    if (row === undefined) return;
    const skill = ctx.registry.table('skills').has('farming')
      ? ((ctx.world.entities.get(job.workerId, C.Skills)?.level[ctx.registry.table('skills').index('farming')] ?? 0) as number)
      : 0;
    const [lo, hi] = row.yield ?? [1, 1];
    const count = harvestCount(row, this.host.rng.int(lo, hi), skill);
    const quality = rollQuality(skill, this.host.rng);
    const yieldItem = facts.yieldItemOf(crop.plant);
    if (yieldItem !== 0 && count > 0) ctx.spawn.item(yieldItem, facts.yieldMaterialOf(crop.plant), tile, count, quality);
    if (facts.seedItem !== 0) ctx.spawn.item(facts.seedItem, facts.materialOf(crop.plant), tile, SEEDS_PER_HARVEST, 1);
    // `07` § Farm plots: a crop row's `straw` drops that many straw of its own material, beside the seed.
    const straw = row.straw ?? 0;
    if (straw > 0 && facts.strawItem !== 0) ctx.spawn.item(facts.strawItem, facts.materialOf(crop.plant), tile, straw, 1);
    if (facts.ashOnly(crop.plant)) this.host.renewAsh(tile, ctx.tick);
    const secondary = facts.secondaryOf(crop.plant);
    if (secondary !== null) ctx.spawn.item(secondary.item, secondary.material, tile, secondary.count, quality);
    this.host.removeCrop(id);
    if (this.host.map.designationAt(tile) === Designation.Harvest) ctx.terrain.setDesignation(tile, Designation.None, 0);
    ctx.emit({ type: 'CropHarvested', tile, species: row.id, count, farmerId: job.workerId });
  }

  onJobEvent(event: GameEvent): void {
    // A harvest the player cancels takes its designation with it, as 03's designations do.
    if (event.type === 'JobCancelled' && event['reason'] === 'player') this.due = true;
  }
}
