/**
 * 08's job producer: `03-content/jobs.md` § Animals (`milk_animal`, `shear_animal`,
 * `collect_egg`) and `08` § Products.
 *
 * A product that is ready makes its job at the farmer's workshop; an egg in a nest box makes a
 * `collect_egg` while the `autoCollectProducts` standing order is on. Leading the animal and
 * delivering products is T-M4-12's; slaughter is T-M4-11's. This file owns the readiness keys and
 * completion bookkeeping.
 */

import type { GameEvent } from '@core/events';
import type { JobProducer, TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { Job, JobSink, JobsReader } from '@systems/jobs';
import type { BuildingsReader } from '@systems/buildings';

/** `11` § Standing orders: "`autoCollectProducts` (08)". */
export const AUTO_COLLECT = 'autoCollectProducts';

/** The workshop each animal job is worked at (`jobs.md` § Animals, the `workTile` column). */
export const FARMERS_WORKSHOP = 'farmers_workshop';
export const BUTCHER_WORKSHOP = 'butcher';

export function productKey(animalId: EntityId, kind: string): string {
  return `${kind}:${animalId}`;
}

export function slaughterKey(animalId: EntityId): string {
  return `slaughter:${animalId}`;
}

export function eggKey(itemId: EntityId): string {
  return `collect_egg:${itemId}`;
}

export interface AnimalsProducerHost {
  /** Ready products, `<kind>:<animalId>` → the animal. */
  readonly ready: Map<string, EntityId>;
  /** Eggs waiting in a nest box. */
  readonly eggs: Map<EntityId, { readonly box: EntityId }>;
  /** Animals marked for slaughter, ascending id. */
  marked(): readonly EntityId[];
  buildings(): BuildingsReader | null;
  jobs(): JobsReader | null;
  alive(id: EntityId): boolean;
}

/** The job type a product kind is worked with. */
export const JOB_OF_PRODUCT: Readonly<Record<string, string>> = Object.freeze({
  milk: 'milk_animal',
  wool: 'shear_animal',
});

export class AnimalsProducer implements JobProducer {
  readonly id = 'animals';

  constructor(private readonly host: AnimalsProducerHost) {}

  /** The tile a workshop is worked at: the `workTile` cell of its footprint, else its origin. */
  private workshopTile(type: string): TileIndex {
    const buildings = this.host.buildings();
    if (buildings === null) return -1;
    for (const id of buildings.byType(type)) {
      const b = buildings.get(id);
      if (b === undefined || b.state !== 'built') continue;
      return b.footprint[Math.min(b.footprint.length - 1, 4)] ?? b.origin;
    }
    return -1;
  }

  produce(_ctx: TickContext, sinkIn: unknown): void {
    const sink = sinkIn as JobSink;
    const buildings = this.host.buildings();
    if (buildings === null) return;
    const farm = this.workshopTile(FARMERS_WORKSHOP);
    if (farm >= 0) {
      for (const key of Array.from(this.host.ready.keys()).sort()) {
        const animalId = this.host.ready.get(key) as EntityId;
        const kind = key.slice(0, key.indexOf(':'));
        const type = JOB_OF_PRODUCT[kind];
        if (type === undefined) continue;
        if (!this.host.alive(animalId)) {
          this.host.ready.delete(key);
          continue;
        }
        if (sink.exists(key)) continue;
        sink.create(key, {
          type,
          target: { kind: 'entity', ref: animalId },
          workTile: farm,
          data: { animal: animalId, product: kind, anchorTile: farm },
        });
      }
    }
    // T-M4-11 owns the slaughter job and its butcher/corpse transition. The mark is already
    // persisted on Tame; creating the job now would let 11 complete it without killing the animal.
    // Eggs are hauled out of their nest box while the standing order is on.
    const jobs = this.host.jobs();
    if (jobs === null || !jobs.standingOrder(AUTO_COLLECT)) return;
    for (const itemId of Array.from(this.host.eggs.keys()).sort((a, b) => a - b)) {
      const record = this.host.eggs.get(itemId) as { readonly box: EntityId };
      const box = buildings.get(record.box);
      if (box === undefined || !this.host.alive(itemId)) continue;
      const key = eggKey(itemId);
      if (sink.exists(key)) continue;
      sink.create(key, {
        type: 'collect_egg',
        target: { kind: 'building', ref: record.box },
        workTile: 'adjacent',
        data: { egg: itemId, anchorTile: box.origin },
      });
    }
  }

  /**
   * The bookkeeping half of a completion: the product leaves the ready set, a collected egg leaves
   * the nest box (so it no longer hatches). The items themselves arrive with T-M4-12.
   */
  onComplete(jobIn: unknown, _ctx: TickContext): void {
    const job = jobIn as Job;
    const animal = job.data['animal'];
    const product = job.data['product'];
    if (typeof animal === 'number' && typeof product === 'string') this.host.ready.delete(productKey(animal, product));
    const egg = job.data['egg'];
    if (typeof egg === 'number') this.host.eggs.delete(egg);
  }

  onJobEvent(_event: GameEvent): void {}
}
