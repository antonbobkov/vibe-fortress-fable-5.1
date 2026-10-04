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
import type { TickContext } from '@core/system';
import type { JobBoard } from './board';
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
    findUnits: (filter, n, from, split = true) => {
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
      if (!split) {
        return selected.sort((a, b) => a.order - b.order).map((c) => c.id);
      }
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
    findTool: (tool, from) => {
      if (tool === 'ranged') {
        const weapon = reader.findItem(toolFilter('ranged'), from, 'walker', { reservable: true });
        const ammo = reader.findItem({ category: 'ammo' }, from, 'walker', { reservable: true });
        if (ammo === 0) return 0;
        return weapon !== 0 ? weapon : ammo;
      }
      return reader.findItem(toolFilter(tool), from, 'walker', { reservable: true });
    },
    hasTool: (workerId, tool) => {
      if (tool === 'ranged') {
        const equip = entities.get(workerId, C.Equipment);
        const worker = entities.get(workerId, C.Worker);
        const weaponId = equip && equip.weapon !== 0 ? equip.weapon : worker && worker.toolId !== 0 ? worker.toolId : 0;
        if (weaponId === 0 || !matchesTool(weaponId, 'ranged')) return false;

        // Check quiver and carried items for ammo
        if (equip && equip.quiver !== 0) {
          const q = reader.get(equip.quiver);
          if (q !== undefined && q.count > 0 && reader.categoryOf(q.type).startsWith('ammo/')) return true;
          for (const inner of reader.inContainer(equip.quiver)) {
            const it = reader.get(inner);
            if (it !== undefined && it.count > 0 && reader.categoryOf(it.type).startsWith('ammo/')) return true;
          }
        }
        for (const id of reader.carriedItems(workerId)) {
          const it = reader.get(id);
          if (it !== undefined && it.carriedBy === workerId && it.count > 0 && reader.categoryOf(it.type).startsWith('ammo/')) {
            return true;
          }
        }
        return false;
      }
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

/** 11 § Assignment: keep tools until both tool labors are off and a stockpile is passed. */
export function dropUnusedTools(board: JobBoard, ctx: TickContext): void {
  const api = ctx.world.services.items;
  if (api === null || !ctx.readers.has('13')) return;
  const items = ctx.readers.of<ItemsReader>('13');
  const mining = board.laborOf('mining');
  const woodcutting = board.laborOf('woodcutting');
  for (const id of board.workers()) {
    const worker = board.workerOf(id);
    if (worker.toolId === 0 || board.laborEnabled(id, mining) || board.laborEnabled(id, woodcutting)) continue;
    const item = items.get(worker.toolId);
    if (item?.carriedBy !== id) continue;
    const category = items.categoryOf(item.type);
    if (category !== 'tool/pick' && category !== 'tool/axe') continue;
    const tile = board.workerTile(id);
    if (tile < 0 || items.stockpileAt(tile) === 0) continue;
    const equipment = ctx.world.entities.get(id, C.Equipment);
    if (equipment?.weapon === worker.toolId) ctx.world.entities.add(id, C.Equipment, { ...equipment, weapon: 0 });
    api.dropAt(worker.toolId, tile);
    board.setWorker(id, { toolId: 0 });
    ctx.emit({ type: 'ToolDropped', itemId: worker.toolId });
  }
}
