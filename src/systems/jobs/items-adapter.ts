/**
 * 11's item seam over the real item system (T-M2-02): `algorithms/jobs-and-hauling.md`
 * § Assignment (`items.findItems(input.filter, …, 'walker', {reservable: true})`, reserve with
 * `items.setFlag(it, Reserved, true); Item[it].reservedBy = job.id`; the tool through
 * `items.findItem({tag: job.tool, category: 'tool/*' or weapon for 'ranged'}, …)`) and § Job steps
 * (`items.attachToCarrier`, `items.dropAt`, `equip`).
 *
 * It replaces {@link NO_ITEMS} (D-054) once 13 is present. The shim of D-070 (a tool counted as in
 * hand while none existed) went with T-M2-08, when the embark supplies put the picks in the wagon.
 */

import { C } from '@core/components';
import type { EntityReader } from '@core/readers';
import type { ItemsApi } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { ItemSource } from './producers';
import type { ItemFilter, Tool } from './state';

/** The item filter of a tool kind: `pick` and `axe` are `tool/*` rows, `ranged` a ranged weapon. */
export function toolFilter(tool: Tool): ItemFilter {
  switch (tool) {
    case 'pick':
      return { category: 'tool/pick' };
    case 'axe':
      return { category: 'tool/axe' };
    case 'ranged':
      return { category: 'weapon/ranged' };
    case 'bucket':
      return { category: 'container/bucket' };
    default:
      return { category: `tool/${String(tool)}` };
  }
}

export function itemSourceOf(api: ItemsApi, reader: ItemsReader, entities: EntityReader): ItemSource {
  const matchesTool = (id: EntityId, tool: Tool): boolean => {
    const it = reader.get(id);
    if (it === undefined) return false;
    const category = reader.categoryOf(it.type);
    const want = toolFilter(tool).category as string;
    return category === want || category.startsWith(`${want}/`);
  };
  return {
    findItems: (filter, n, from) => reader.findItems(filter, n, from, 'walker', { reservable: true }),
    findUnits: (filter, n, from) => {
      const candidates: { id: EntityId; count: number; order: number }[] = [];
      const excluded = [...(filter.excludeIds ?? [])];
      for (;;) {
        const id = reader.findItem({ ...filter, excludeIds: excluded }, from, 'walker', { reservable: true });
        if (id === 0) break;
        excluded.push(id);
        const count = reader.get(id)?.count ?? 0;
        if (count > 0) candidates.push({ id, count, order: candidates.length });
      }
      // Largest stacks minimise trips; the search order breaks ties and orders the fetches.
      const chosen = candidates.slice().sort((a, b) => b.count - a.count || a.order - b.order);
      const selected: typeof candidates = [];
      let remaining = n;
      for (const candidate of chosen) {
        if (remaining <= 0) break;
        selected.push(candidate);
        remaining -= candidate.count;
      }
      if (remaining > 0) return [];
      const out: EntityId[] = [];
      remaining = n;
      for (const candidate of selected.sort((a, b) => a.order - b.order)) {
        const take = Math.min(candidate.count, remaining);
        const id = take < candidate.count ? api.split(candidate.id, take) : candidate.id;
        if (id === 0) return [];
        out.push(id);
        remaining -= take;
      }
      return out;
    },
    countOf: (itemId) => reader.get(itemId)?.count ?? 0,
    findTool: (tool, from) => reader.findItem(toolFilter(tool), from, 'walker', { reservable: true }),
    hasTool: (workerId, tool) => {
      const held = entities.get(workerId, C.Worker)?.toolId ?? 0;
      return held !== 0 && matchesTool(held, tool) && reader.get(held)?.carriedBy === workerId;
    },
    reserve: (itemId, jobId) => api.reserve(itemId, jobId),
    release: (itemId) => api.release(itemId),
    tileOf: (itemId): TileIndex => reader.tileOf(itemId),
    pickUp: (itemId, workerId) => api.attachToCarrier(itemId, workerId),
    dropAt: (itemId, tile) => api.dropAt(itemId, tile),
    equip: (workerId, itemId) => api.attachToCarrier(itemId, workerId),
  };
}
