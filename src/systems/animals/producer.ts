/**
 * 08's job producer: `03-content/jobs.md` Â§ Animals (`milk_animal`, `shear_animal`,
 * `collect_egg`) and `08` Â§ Products.
 *
 * A product that is ready makes its job at the farmer's workshop; an egg in a nest box makes a
 * `collect_egg` while the `autoCollectProducts` standing order is on. Leading the animal and
 * delivering products are worked here. This file owns the readiness keys, slaughter path and
 * completion bookkeeping.
 */

import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import { TileKind } from '@core/map3d';
import type { JobProducer, TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { arrivalTame } from '@systems/embark';
import type { Job, JobSink, JobsReader } from '@systems/jobs';
import type { BuildingsReader } from '@systems/buildings';
import {
  KENNEL_WORKSHOP,
  TRAIN_TICKS,
  trainingSuccessChance,
} from './constants';

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

export function trainKey(animalId: EntityId): string {
  return `train_animal:${animalId}`;
}

export function tameKey(cageId: EntityId): string {
  return `tame_animal:${cageId}`;
}

export interface AnimalsProducerHost {
  /** Ready products, `<kind>:<animalId>` → the animal. */
  readonly ready: Map<string, EntityId>;
  /** Eggs waiting in a nest box. */
  readonly eggs: Map<EntityId, { readonly box: EntityId }>;
  /** Animals marked for slaughter, ascending id. */
  marked(): readonly EntityId[];
  readonly pendingTrain: Map<EntityId, 'war' | 'hunting'>;
  readonly pendingTame: Map<EntityId, EntityId>;
  clearPendingTrain(animalId: EntityId): void;
  clearPendingTame(cageId: EntityId): void;
  releaseCagedRecord(cageId: EntityId, creatureId: EntityId): void;
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

  workCentiTicks(jobIn: unknown): number | undefined {
    const job = jobIn as Job;
    if (job.key.startsWith('train_animal:') || job.key.startsWith('tame_animal:')) {
      return TRAIN_TICKS * 100;
    }
    return undefined;
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
    const kennel = this.workshopTile(KENNEL_WORKSHOP);
    if (kennel >= 0) {
      for (const [animalId, kind] of Array.from(this.host.pendingTrain.entries()).sort((a, b) => a[0] - b[0])) {
        if (!this.host.alive(animalId)) {
          this.host.clearPendingTrain(animalId);
          continue;
        }
        const key = trainKey(animalId);
        if (sink.exists(key)) continue;
        sink.create(key, {
          type: 'train_animal',
          target: { kind: 'entity', ref: animalId },
          workTile: kennel,
          data: { animal: animalId, kind, anchorTile: kennel },
        });
      }
      for (const [cageId, creatureId] of Array.from(this.host.pendingTame.entries()).sort((a, b) => a[0] - b[0])) {
        if (!this.host.alive(creatureId)) {
          this.host.clearPendingTame(cageId);
          continue;
        }
        const key = tameKey(cageId);
        if (sink.exists(key)) continue;
        sink.create(key, {
          type: 'tame_animal',
          target: { kind: 'entity', ref: cageId },
          workTile: kennel,
          data: { cage: cageId, creature: creatureId, anchorTile: kennel },
        });
      }
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
   * Complete production at the farmer's workshop, kennel, or move a collected egg out of its nest box.
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
          weight: (ctx.registry.table<{ id: string; size: number }>('creatures').byIndex(creature.species)?.size ?? 0),
          juvenile: tame !== undefined && tame.juvenileUntil > ctx.tick });
        ctx.emit({ type: 'CreatureDied', id: animal, cause: 'slaughter', tile, faction: creature.faction, species: creature.species });
        ctx.emit({ type: 'CorpseCreated', id: corpse, creatureId: animal, species: creature.species });
        ctx.world.entities.destroy(animal);
      }
      return;
    }
    if (job.key.startsWith('train_animal:') && typeof animal === 'number') {
      const kind = job.data['kind'] as ('war' | 'hunting') | undefined;
      const s = ctx.registry.table('skills').index('animal_training');
      const skill = ctx.world.entities.get(job.workerId, C.Skills)?.level[s] ?? 0;
      const success = ctx.rng.chance(trainingSuccessChance(skill));
      if (success && (kind === 'war' || kind === 'hunting')) {
        const tame = ctx.world.entities.get(animal, C.Tame);
        if (tame !== undefined) {
          ctx.world.entities.add(animal, C.Tame, { ...tame, trained: kind });
        }
        ctx.emit({ type: 'AnimalTrained', id: animal, kind });
        this.host.clearPendingTrain(animal);
      }
      return;
    }
    if (job.key.startsWith('tame_animal:')) {
      const cageId = job.data['cage'] as EntityId;
      const creatureId = job.data['creature'] as EntityId;
      if (typeof cageId !== 'number' || typeof creatureId !== 'number' || !this.host.alive(creatureId)) {
        if (typeof cageId === 'number') this.host.clearPendingTame(cageId);
        return;
      }
      const s = ctx.registry.table('skills').index('animal_training');
      const skill = ctx.world.entities.get(job.workerId, C.Skills)?.level[s] ?? 0;
      const success = ctx.rng.chance(trainingSuccessChance(skill));
      if (success) {
        const creature = ctx.world.entities.get(creatureId, C.Creature);
        if (creature !== undefined) {
          ctx.world.entities.remove(creatureId, C.Wild);
          ctx.world.entities.add(creatureId, C.Tame, arrivalTame('none'));
          ctx.world.entities.add(creatureId, C.Creature, { ...creature, faction: 'fortress', cagedIn: 0 });

          // Clear occupant from cage item or building
          const item = ctx.world.entities.get(cageId, C.Item);
          if (item !== undefined) {
            ctx.world.entities.add(cageId, C.Item, { ...item, occupantId: 0 });
          }
          for (const bId of ctx.world.entities.with(C.Building)) {
            const b = ctx.world.entities.get(bId, C.Building);
            if (b !== undefined && (bId === cageId || b.itemId === cageId || b.settings['occupantId'] === creatureId)) {
              ctx.world.entities.add(bId, C.Building, { ...b, settings: { ...b.settings, occupantId: 0 } });
            }
          }

          // Release adjacent to kennel
          const anchorTile = job.data['anchorTile'] as TileIndex;
          let releaseTile = -1;
          if (typeof anchorTile === 'number' && anchorTile >= 0) {
            for (const n of ctx.world.map.neighbors(anchorTile)) {
              if (ctx.world.map.kindAt(n) === TileKind.Floor && ctx.readers.pathing.passable(n, 'walker')) {
                releaseTile = n;
                break;
              }
            }
            if (releaseTile < 0) releaseTile = anchorTile;
          }
          if (releaseTile >= 0) {
            ctx.world.services.movement?.teleport(creatureId, releaseTile);
          }

          this.host.releaseCagedRecord(cageId, creatureId);
          this.host.clearPendingTame(cageId);
          ctx.emit({ type: 'AnimalTamed', id: creatureId });
        }
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
    if (!job.key.startsWith('slaughter:') && !job.key.startsWith('milk:') && !job.key.startsWith('wool:') && !job.key.startsWith('train_animal:')) return true;
    const animal = job.data['animal'];
    const tile = job.data['anchorTile'];
    return typeof animal === 'number' && typeof tile === 'number' && this.host.animalNear(animal, tile);
  }
}

