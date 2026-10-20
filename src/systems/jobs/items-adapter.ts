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

import { C, ItemFlag } from '@core/components';
import type { EntityReader } from '@core/readers';
import type { Registry } from '@core/registry';
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

export function itemSourceOf(api: ItemsApi, reader: ItemsReader, entities: EntityReader, registry?: Registry): ItemSource {
  const matchesTool = (id: EntityId, tool: Tool): boolean => {
    const it = reader.get(id);
    if (it === undefined) return false;
    const category = reader.categoryOf(it.type);
    const want = toolFilter(tool).category as string;
    return category === want || category.startsWith(`${want}/`);
  };
  /** The item id of the ammunition a launcher shoots (content: the weapon row's `launcher.ammo`). */
  const ammoOf = (launcherId: EntityId): string | null => {
    const it = reader.get(launcherId);
    const def = it === undefined ? undefined : reader.def(it.type);
    if (def === undefined || registry === undefined) return null;
    return registry.table<{ id: string; launcher?: { ammo?: string } }>('weapons').byId(def.id)?.launcher?.ammo ?? null;
  };
  const heldLauncher = (workerId: EntityId): EntityId => {
    const equip = entities.get(workerId, C.Equipment);
    const worker = entities.get(workerId, C.Worker);
    const weaponId = equip && equip.weapon !== 0 ? equip.weapon : worker && worker.toolId !== 0 ? worker.toolId : 0;
    return weaponId !== 0 && matchesTool(weaponId, 'ranged') ? weaponId : 0;
  };
  /** Ammunition in the quiver or carried; of the item id `kind`, or of any kind when it is null. */
  const holdsAmmo = (workerId: EntityId, kind: string | null): boolean => {
    const isAmmo = (id: EntityId): boolean => {
      const it = reader.get(id);
      if (it === undefined || it.count <= 0 || !reader.categoryOf(it.type).startsWith('ammo/')) return false;
      return kind === null || reader.def(it.type)?.id === kind;
    };
    const quiver = entities.get(workerId, C.Equipment)?.quiver ?? 0;
    if (quiver !== 0 && (isAmmo(quiver) || reader.inContainer(quiver).some(isAmmo))) return true;
    return reader.carriedItems(workerId).some((id) => reader.get(id)?.carriedBy === workerId && isAmmo(id));
  };
  const freeAmmo = (kind: string | null, from: TileIndex): EntityId => {
    if (kind === null || registry === undefined) return 0;
    const type = registry.table('items').index(kind);
    return type <= 0 ? 0 : reader.findItem({ type }, from, 'walker', { reservable: true });
  };
  /** The nearest free launcher that has ammunition: its own kind held by `workerId`, or a free stack. */
  const freeKit = (workerId: EntityId, from: TileIndex): { launcher: EntityId; ammo: EntityId } | null => {
    const excludeIds: EntityId[] = [];
    for (;;) {
      const launcher = reader.findItem({ ...toolFilter('ranged'), excludeIds }, from, 'walker', { reservable: true });
      if (launcher === 0) return null;
      const kind = ammoOf(launcher);
      if (kind !== null && workerId !== 0 && holdsAmmo(workerId, kind)) return { launcher, ammo: 0 };
      const ammo = freeAmmo(kind, from);
      if (ammo !== 0) return { launcher, ammo };
      excludeIds.push(launcher);
    }
  };
  return {
    findItems: (filter, n, from, allowed) => reader.findItems(filter, n, from, 'walker', { reservable: true, ...(allowed === undefined ? {} : { allowedTile: allowed }) }),
    findUnits: (filter, n, from, split = true, allowed) => {
      const candidates: { id: EntityId; count: number; order: number }[] = [];
      // Every match in the order `findItem` would return them one after the other.
      for (const id of reader.findItems({ ...filter }, Number.MAX_SAFE_INTEGER, from, 'walker', { reservable: true, ...(allowed === undefined ? {} : { allowedTile: allowed }) })) {
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
      // A ranged tool is a launcher with its own ammunition; ammunition is never the tool.
      if (tool === 'ranged') return freeKit(0, from)?.launcher ?? 0;
      return reader.findItem(toolFilter(tool), from, 'walker', { reservable: true });
    },
    findRangedKit: (workerId, from) => {
      const held = heldLauncher(workerId);
      if (held === 0) return freeKit(workerId, from);
      const kind = ammoOf(held);
      if (holdsAmmo(workerId, kind)) return { launcher: 0, ammo: 0 };
      const ammo = freeAmmo(kind, from);
      return ammo === 0 ? null : { launcher: 0, ammo };
    },
    limitStack: (itemId, n) => {
      const count = reader.get(itemId)?.count ?? 0;
      if (count <= n) return itemId;
      const part = api.split(itemId, n);
      return part === 0 ? itemId : part;
    },
    hasTool: (workerId, tool) => {
      if (tool === 'ranged') {
        const launcher = heldLauncher(workerId);
        return launcher !== 0 && holdsAmmo(workerId, ammoOf(launcher));
      }
      // A tool in the weapon slot is held too (16 § Equipment).
      const held = entities.get(workerId, C.Worker)?.toolId ?? 0;
      if (held !== 0 && matchesTool(held, tool) && reader.get(held)?.carriedBy === workerId) return true;
      const weapon = entities.get(workerId, C.Equipment)?.weapon ?? 0;
      return weapon !== 0 && matchesTool(weapon, tool) && reader.get(weapon)?.carriedBy === workerId;
    },
    reserve: (itemId, jobId) => api.reserve(itemId, jobId),
    release: (itemId) => api.release(itemId),
    reservedFor: (itemId) => {
      const it = reader.get(itemId);
      if (it === undefined || it.count <= 0) return -1;
      return (it.flags & ItemFlag.Reserved) !== 0 ? it.reservedBy : 0;
    },
    tileOf: (itemId): TileIndex => reader.tileOf(itemId),
    pickUp: (itemId, workerId) => api.attachToCarrier(itemId, workerId),
    dropAt: (itemId, tile) => api.dropAt(itemId, tile),
    equip: (workerId, itemId) => api.attachToCarrier(itemId, workerId),
  };
}

/** Drops a pick or axe the worker holds on `tile` through the item API and clears what referred to it. */
function dropTool(board: JobBoard, ctx: TickContext, workerId: EntityId, itemId: EntityId, tile: TileIndex): void {
  const api = ctx.world.services.items;
  if (api === null) return;
  const equipment = ctx.world.entities.get(workerId, C.Equipment);
  if (equipment?.weapon === itemId) ctx.world.entities.add(workerId, C.Equipment, { ...equipment, weapon: 0 });
  const item = ctx.world.entities.get(itemId, C.Item);
  if (item !== undefined && (item.reservedBy !== 0 || (item.flags & ItemFlag.Reserved) !== 0)) api.release(itemId);
  api.dropAt(itemId, tile);
  if (board.workerOf(workerId).toolId === itemId) board.setWorker(workerId, { toolId: 0 });
  ctx.emit({ type: 'ToolDropped', itemId });
}

function isPickOrAxe(items: ItemsReader, itemId: EntityId): boolean {
  const item = items.get(itemId);
  if (item === undefined) return false;
  const category = items.categoryOf(item.type);
  return category === 'tool/pick' || category === 'tool/axe';
}

/**
 * 11 § Assignment: a worker holds one tool. A worker that is about to equip another tool first
 * puts the pick or axe it holds down on its own tile (the tile it stands on).
 */
export function dropHeldToolBeforeEquip(board: JobBoard, ctx: TickContext, workerId: EntityId): void {
  if (!ctx.readers.has('13')) return;
  const items = ctx.readers.of<ItemsReader>('13');
  const held = board.workerOf(workerId).toolId;
  if (held === 0 || items.get(held)?.carriedBy !== workerId || !isPickOrAxe(items, held)) return;
  const tile = board.workerTile(workerId);
  if (tile < 0) return;
  dropTool(board, ctx, workerId, held, tile);
}

/** 11 § Assignment: a worker carries no pick or axe it does not hold (its `toolId`, its `Equipment`, or the item it hauls). */
export function dropStrandedTools(board: JobBoard, ctx: TickContext): void {
  if (ctx.world.services.items === null || !ctx.readers.has('13')) return;
  const items = ctx.readers.of<ItemsReader>('13');
  for (const id of board.workers()) {
    const carried = items.carriedItems(id);
    if (carried.length === 0) continue;
    const worker = board.workerOf(id);
    const equipment = ctx.world.entities.get(id, C.Equipment);
    const worn = equipment === undefined ? [] : [equipment.weapon, equipment.shield, equipment.quiver,
      ...Object.values(equipment.armor), ...Object.values(equipment.clothing)];
    const tile = board.workerTile(id);
    if (tile < 0) continue;
    for (const itemId of carried) {
      if (itemId === worker.toolId || itemId === worker.carrying || worn.includes(itemId) || !isPickOrAxe(items, itemId)) continue;
      dropTool(board, ctx, id, itemId, tile);
    }
  }
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
    dropTool(board, ctx, id, worker.toolId, tile);
  }
}
