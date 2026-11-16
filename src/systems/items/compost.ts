/**
 * 13 § The compost heap: rotten food and dung lying on a `compost` zone turn to `compost`.
 *
 * Each `HourPassed`, every item lying loose on a heap tile of category `refuse/rotten` or `farm/dung`
 * that has no count gets one (`Item.compostAt`, the tick it turns: `COMPOST_DAYS_ROTTEN` or
 * `COMPOST_DAYS_DUNG` days on); an item whose tick has come is destroyed (`composted`) and as many
 * `compost` as it had units take its place on the tile. Picking an item up clears its count (the
 * system's item listener), as does a heap that stops covering its tile (`StockpileStore`). No rng.
 */

import { TICKS_PER_DAY } from '@core/constants';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import type { ItemCore } from './api';
import { COMPOST_DAYS_DUNG, COMPOST_DAYS_ROTTEN } from './constants';
import { categoryUnder } from './facts';
import type { StockpileStore } from './stockpiles';

/** The days an item turns in, by its category: rotten food, dung, or 0 when it does not compost. */
export function compostDays(category: string): number {
  if (categoryUnder(category, 'refuse/rotten')) return COMPOST_DAYS_ROTTEN;
  if (categoryUnder(category, 'farm/dung')) return COMPOST_DAYS_DUNG;
  return 0;
}

/** The loose items on the compost heaps' tiles that compost, ascending id. */
export function heapItems(core: ItemCore, store: StockpileStore): EntityId[] {
  const out: EntityId[] = [];
  for (const sp of store.all()) {
    if (!store.isCompost(sp)) continue;
    for (const tile of store.tilesOf(sp)) {
      for (const id of store.host.itemsOn(tile)) {
        const it = core.get(id);
        if (it === undefined || it.containerId !== 0 || it.carriedBy !== 0 || core.container(id) !== undefined) continue;
        if (compostDays(core.host.facts.row(it.type).category) > 0) out.push(id);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

/** `HourPassed`: start the counts of new arrivals, and turn the items whose tick has come. */
export function compostHour(core: ItemCore, store: StockpileStore, ctx: TickContext): void {
  const facts = core.host.facts;
  const compostType = facts.typeIndex('compost');
  const compostMaterial = facts.materialIndex('compost');
  if (compostType === 0 || compostMaterial === 0) return;
  for (const id of heapItems(core, store)) {
    const it = core.get(id);
    if (it === undefined) continue;
    const at = it.compostAt ?? 0;
    if (at === 0) {
      core.setCompostAt(id, ctx.tick + compostDays(facts.row(it.type).category) * TICKS_PER_DAY);
      continue;
    }
    if (ctx.tick < at) continue;
    const tile = core.tileOf(id);
    const units = it.count;
    core.destroy(id, 'composted');
    if (tile < 0) continue;
    // One compost a unit, in stacks no larger than a compost stack.
    const stack = Math.max(1, facts.row(compostType).stack);
    for (let left = units; left > 0; left -= stack) ctx.spawn.item(compostType, compostMaterial, tile, Math.min(stack, left));
  }
}
