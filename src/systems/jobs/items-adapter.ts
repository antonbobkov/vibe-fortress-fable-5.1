/**
 * 11's item seam over the real item system (T-M2-02): `algorithms/jobs-and-hauling.md`
 * § Assignment (`items.findItems(input.filter, …, 'walker', {reservable: true})`, reserve with
 * `items.setFlag(it, Reserved, true); Item[it].reservedBy = job.id`; the tool through
 * `items.findItem({tag: job.tool, category: 'tool/*' or weapon for 'ranged'}, …)`) and § Job steps
 * (`items.attachToCarrier`, `items.dropAt`, `equip`).
 *
 * It replaces {@link NO_ITEMS} (D-054) once 13 is present. One part of D-054 stays until the
 * embark supplies exist (T-M2-08): while the fortress holds no item of a tool's kind at all, the
 * tool still counts as in hand (D-070).
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
    findTool: (tool, from) => reader.findItem(toolFilter(tool), from, 'walker', { reservable: true }),
    hasTool: (workerId, tool) => {
      const held = entities.get(workerId, C.Worker)?.toolId ?? 0;
      if (held !== 0 && matchesTool(held, tool) && reader.get(held)?.carriedBy === workerId) return true;
      // D-070: no item of the kind exists anywhere yet (the embark supplies arrive with T-M2-08).
      return reader.countMatching(toolFilter(tool)) === 0;
    },
    reserve: (itemId, jobId) => api.reserve(itemId, jobId),
    release: (itemId) => api.release(itemId),
    tileOf: (itemId): TileIndex => reader.tileOf(itemId),
    pickUp: (itemId, workerId) => api.attachToCarrier(itemId, workerId),
    dropAt: (itemId, tile) => api.dropAt(itemId, tile),
    equip: (workerId, itemId) => api.attachToCarrier(itemId, workerId),
  };
}
