/** 13 § Rot and corpses; algorithms/jobs-and-hauling.md § Rot queue. */
import { C, ItemFlag, type Corpse } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { CORPSE_ROT_DAYS, MIASMA_DURATION, ROT_COLD_C, ROT_CONTAINER_PERCENT, ROT_HOT_C } from './constants';
import type { ItemCore, ItemChange } from './api';
import type { StockpileStore } from './stockpiles';
import { FREEZE_C } from '@systems/fluids/constants';
import { entityIndex } from '@core/entities';
import { sortedInsert, sortedRemove } from './state';

export interface RotRecord { id: EntityId; type: number; progress: number; sampledTick: number; speed: number; due: number }

export class RotQueue {
  readonly records = new Map<EntityId, RotRecord>();
  readonly miasma = new Map<TileIndex, number>();
  private readonly buckets = new Map<number, EntityId[]>();
  private readonly rotten = new Set<EntityId>();

  /** Derived miasma sources are restored once, rather than scanning every stock item each tick. */
  rebuildSources(): void {
    this.rotten.clear();
    for (const id of this.core.host.entities.with(C.Item)) {
      if (this.core.get(id)?.rotStage === 2) this.rotten.add(id);
    }
  }

  constructor(private readonly core: ItemCore, private readonly store: StockpileStore,
    private readonly temperature: (tile: TileIndex) => number) {}

  private days(type: number): number {
    const row = this.core.host.facts.row(type);
    return row.category === 'refuse/corpse' ? CORPSE_ROT_DAYS : row.rotDays;
  }

  private speed(id: EntityId, type: number): number {
    const it = this.core.get(id);
    if (it === undefined) return 0;
    const tile = this.core.tileOf(id);
    if (tile < 0) return 1;
    let speed = 1;
    if (it.containerId !== 0) {
      const container = this.core.container(it.containerId);
      if (container?.classId === 'bag' && this.core.host.facts.row(type).category.startsWith('food/plant/')) return 0;
      if (this.store.stockpileAt(tile) !== 0) speed = ROT_CONTAINER_PERCENT / 100;
    }
    const temp = this.temperature(tile);
    if (temp < FREEZE_C) return 0;
    if (temp > ROT_HOT_C) speed *= 2;
    else if (temp < ROT_COLD_C) speed /= 2;
    return speed;
  }

  private unqueue(id: EntityId): void {
    const due = this.records.get(id)?.due;
    if (due === undefined) return;
    const ids = this.buckets.get(due);
    if (ids === undefined) return;
    sortedRemove(ids, id);
    if (ids.length === 0) this.buckets.delete(due);
  }

  private queue(record: RotRecord): void {
    if (record.speed <= 0) { record.due = 0; return; }
    const stage = this.core.get(record.id)?.rotStage ?? 0;
    const span = this.days(record.type) * TICKS_PER_DAY / 2;
    const remaining = Math.max(0, (stage + 1) * span - record.progress);
    record.due = Math.ceil((record.sampledTick + remaining / record.speed) / TICKS_PER_HOUR) * TICKS_PER_HOUR;
    const bucket = this.buckets.get(record.due) ?? [];
    sortedInsert(bucket, record.id);
    this.buckets.set(record.due, bucket);
  }

  /** Creation and movement preserve elapsed decay, then sample the new location. */
  changed(id: EntityId, change: ItemChange): void {
    if (this.core.get(id)?.rotStage === 2) this.rotten.add(id);
    else this.rotten.delete(id);
    if (change === 'destroyed') { this.unqueue(id); this.records.delete(id); return; }
    if (change !== 'created' && change !== 'placed' && change !== 'lifted' && change !== 'contained') return;
    const it = this.core.get(id);
    if (it === undefined) return;
    const now = this.core.host.tick();
    let rec = this.records.get(id);
    if (rec === undefined) {
      if (this.days(it.type) <= 0) return;
      rec = { id, type: it.type, progress: it.rotStage * this.days(it.type) * TICKS_PER_DAY / 2,
        sampledTick: now, speed: 0, due: 0 };
      this.records.set(id, rec);
    } else {
      rec.progress += Math.max(0, now - rec.sampledTick) * rec.speed;
      rec.sampledTick = now;
      this.unqueue(id);
    }
    rec.speed = this.speed(id, rec.type);
    this.queue(rec);
  }

  resample(): void { for (const id of Array.from(this.records.keys()).sort((a, b) => a - b)) this.changed(id, 'placed'); }

  tick(ctx: TickContext): void {
    const due = Array.from(this.buckets.keys()).filter((bucket) => bucket <= ctx.tick).sort((a, b) => a - b);
    for (const bucket of due) {
      const ids = this.buckets.get(bucket) ?? [];
      this.buckets.delete(bucket);
      for (const id of ids) {
        const rec = this.records.get(id);
        const it = this.core.get(id);
        if (rec === undefined || it === undefined || rec.due !== bucket) continue;
        rec.progress += Math.max(0, ctx.tick - rec.sampledTick) * rec.speed;
        rec.sampledTick = ctx.tick;
        const span = this.days(rec.type) * TICKS_PER_DAY / 2;
        const stage = Math.min(3, Math.floor(rec.progress / span)) as 0 | 1 | 2 | 3;
        if (stage > it.rotStage) {
          const corpse = ctx.world.entities.has(id, C.Corpse);
          if (stage === 3 && corpse) {
            const type = this.core.host.facts.typeIndex('skeleton');
            this.core.setRot(id, 3, type, this.core.host.facts.materialIndex('skull_bone'));
            const remains = ctx.world.entities.get(id, C.Corpse);
            const tile = this.core.tileOf(id);
            if (remains !== undefined && tile >= 0) {
              for (const worn of remains.wornItems) this.core.dropAt(worn, tile);
              ctx.world.entities.add(id, C.Corpse, { ...remains, wornItems: [] });
            }
          } else if (stage === 3) {
            this.core.destroy(id, 'rotted');
          } else {
            const rotten = stage === 2 && !corpse ? this.core.host.facts.typeIndex('rotten') : undefined;
            this.core.setRot(id, stage, rotten);
          }
          ctx.emit({ type: 'ItemRotStage', id, stage });
          if (stage === 2) ctx.emit({ type: 'ItemRotted', id });
        }
        if (stage >= 3) { this.records.delete(id); continue; }
        rec.speed = this.speed(id, rec.type);
        this.queue(rec);
      }
    }
    this.spread(ctx);
  }

  private spread(ctx: TickContext): void {
    for (const [tile, expiry] of this.miasma) if (expiry <= ctx.tick) this.miasma.delete(tile);
    const map = ctx.world.map;
    const added: number[] = [];
    for (const id of Array.from(this.rotten).sort((a, b) => entityIndex(a) - entityIndex(b))) {
      const item = this.core.get(id);
      if (item?.rotStage !== 2 || item.containerId !== 0) continue;
      const origin = this.core.tileOf(id);
      if (origin < 0 || map.hasFlag(origin, TileFlag.Outdoor)) continue;
      const x = map.xOf(origin); const y = map.yOf(origin); const z = map.zOf(origin);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (!map.inBounds(x + dx, y + dy, z)) continue;
        const tile = map.index(x + dx, y + dy, z);
        if (!this.miasma.has(tile)) added.push(tile);
        this.miasma.set(tile, ctx.tick + MIASMA_DURATION);
      }
    }
    if (added.length > 0) ctx.emit({ type: 'MiasmaSpread', tiles: added.sort((a, b) => a - b) });
  }

  createCorpse(ctx: TickContext, creatureId: EntityId, species: number, tile: TileIndex, name: string | null, wornItems: EntityId[] = [], foreign = false): EntityId {
    const speciesId = ctx.registry.table('creatures').idOf(species);
    const materials = ctx.registry.table('materials');
    const material = materials.has(`${speciesId}_meat`) ? materials.index(`${speciesId}_meat`) : materials.index('skull_bone');
    const id = ctx.spawn.item(ctx.registry.table('items').index('corpse'), material, tile, 1);
    if (foreign) this.core.setFlag(id, ItemFlag.Foreign, true);
    const corpse: Corpse = { species, diedTick: ctx.tick, wornItems: wornItems.slice(), dwarfName: speciesId === 'dwarf' ? name : null,
      weight: ctx.registry.table<{ id: string; size: number }>('creatures').byIndex(species)?.size ?? 0 };
    ctx.world.entities.add(id, C.Corpse, corpse);
    for (const worn of wornItems) if (this.core.isItem(worn)) this.core.attachToCarrier(worn, id);
    ctx.emit({ type: 'CorpseCreated', id, itemId: id, creatureId, species });
    return id;
  }

  serializeQueue(): { bucketTick: number; items: EntityId[] }[] {
    return Array.from(this.buckets.keys()).sort((a, b) => a - b).map((bucketTick) => ({ bucketTick, items: (this.buckets.get(bucketTick) ?? []).slice() }));
  }
  deserializeQueue(buckets: readonly { bucketTick: number; items: EntityId[] }[]): void {
    this.buckets.clear();
    for (const b of buckets) this.buckets.set(b.bucketTick, b.items.slice());
  }
}
