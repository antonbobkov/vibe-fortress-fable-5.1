/**
 * 08's job producer: `03-content/jobs.md` § Animals (`milk_animal`, `shear_animal`,
 * `collect_egg`) and `08` § Products.
 *
 * A product that is ready makes its job at the farmer's workshop; an egg in a nest box makes a
 * `collect_egg` while the `autoCollectProducts` standing order is on. Leading the animal and
 * delivering products are worked here. This file owns the readiness keys, slaughter path and
 * completion bookkeeping.
 */

import { C } from '@core/components';
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
  animalNear(id: EntityId, tile: TileIndex): boolean;
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
    const butcher = this.workshopTile(BUTCHER_WORKSHOP);
    if (butcher >= 0) for (const animalId of this.host.marked()) {
      const key = slaughterKey(animalId);
      if (sink.exists(key)) continue;
      sink.create(key, { type: 'slaughter', target: { kind: 'entity', ref: animalId }, workTile: butcher,
        data: { animal: animalId, anchorTile: butcher } });
    }
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
   * Complete production at the farmer's workshop and move a collected egg out of its nest box.
   */
  onComplete(jobIn: unknown, ctx: TickContext): void {
    const job = jobIn as Job;
    const animal = job.data['animal'];
    const product = job.data['product'];
    if (job.key.startsWith('slaughter:') && typeof animal === 'number') {
      const creature = ctx.world.entities.get(animal, C.Creature);
      const tile = job.data['anchorTile'];
      if (creature !== undefined && typeof tile === 'number') {
        const corpse = ctx.spawn.item(ctx.registry.table('items').index('corpse'),
          ctx.registry.table('materials').index(`${ctx.registry.table('creatures').idOf(creature.species)}_meat`), tile, 1);
        const tame = ctx.world.entities.get(animal, C.Tame);
        ctx.world.entities.add(corpse, C.Corpse, { species: creature.species, diedTick: ctx.tick, wornItems: [], dwarfName: null,
          juvenile: tame !== undefined && tame.juvenileUntil > ctx.tick });
        ctx.emit({ type: 'CreatureDied', id: animal, cause: 'slaughter' });
        ctx.emit({ type: 'CorpseCreated', id: corpse, creatureId: animal, species: creature.species });
        ctx.world.entities.destroy(animal);
      }
      return;
    }
    if (typeof animal === 'number' && typeof product === 'string') {
      const tile = job.data['anchorTile'];
      if (typeof tile === 'number' && this.host.animalNear(animal, tile)) {
        const item = product === 'milk' ? 'milk' : product === 'wool' ? 'wool_raw' : '';
        const material = product === 'milk' ? 'milk' : product === 'wool' ? 'wool' : '';
        if (item !== '' && material !== '') ctx.spawn.item(ctx.registry.table('items').index(item),
          ctx.registry.table('materials').index(material), tile, 1);
        this.host.ready.delete(productKey(animal, product));
      }
    }
    const egg = job.data['egg'];
    if (typeof egg === 'number') {
      this.host.eggs.delete(egg);
      const items = ctx.world.services.items;
      const worker = ctx.world.entities.get(job.workerId, C.Position);
      if (items !== null && worker !== undefined) {
        items.attachToCarrier(egg, job.workerId);
        items.dropAt(egg, ctx.world.map.index(worker.x, worker.y, worker.z));
        items.release(egg);
      }
    }
  }

  onJobEvent(_event: GameEvent): void {}

  canComplete(jobIn: unknown): boolean {
    const job = jobIn as Job;
    if (!job.key.startsWith('slaughter:') && !job.key.startsWith('milk:') && !job.key.startsWith('wool:')) return true;
    const animal = job.data['animal'];
    const tile = job.data['anchorTile'];
    return typeof animal === 'number' && typeof tile === 'number' && this.host.animalNear(animal, tile);
  }
}
