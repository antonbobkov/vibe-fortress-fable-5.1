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
import { JOB_HOLD_TICKS } from './constants';

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

/**
 * `distance(a, b)`, when given, is 11's estimated distance between two tiles (§ Assignment step 2):
 * a unit input then takes more stacks than the fewest when the nearest stacks make it up in less
 * walking (T-659).
 */
export function itemSourceOf(api: ItemsApi, reader: ItemsReader, entities: EntityReader, registry?: Registry,
  distance?: (a: TileIndex, b: TileIndex) => number): ItemSource {
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
    // A channel (25) is a launcher with no ammunition: it hunts nothing.
    return weaponId !== 0 && matchesTool(weaponId, 'ranged') && (registry === undefined || ammoOf(weaponId) !== null) ? weaponId : 0;
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
      // The fewest stacks, one trip each: as many as the largest stacks need (11 § Assignment step 4).
      const largest = candidates.map((c) => c.count).sort((a, b) => b - a);
      let trips = 0;
      for (let sum = 0; sum < n && trips < largest.length; trips += 1) sum += largest[trips] as number;
      if (largest.slice(0, trips).reduce((s, c) => s + c, 0) < n) return [];
      // Of those, the nearest: in search order, a stack is taken while the stacks after it can still
      // make up the rest in the trips left (T-655: a far stack of five was fetched for one bar of fuel
      // with one lying beside the furnace).
      // best[k][s]: the units of the s largest stacks from the k-th on (s < trips).
      const best: number[][] = new Array<number[]>(candidates.length + 1);
      best[candidates.length] = new Array<number>(trips).fill(0);
      const top: number[] = [];
      for (let k = candidates.length - 1; k >= 0; k -= 1) {
        if (trips > 1) {
          const c = (candidates[k] as (typeof candidates)[number]).count;
          let at = top.findIndex((x) => x < c);
          if (at < 0) at = top.length;
          top.splice(at, 0, c);
          if (top.length > trips - 1) top.pop();
        }
        const sums = [0];
        for (let s = 1; s < trips; s += 1) sums.push((sums[s - 1] as number) + (top[s - 1] ?? 0));
        best[k] = sums;
      }
      let selected: typeof candidates = [];
      let remaining = n;
      for (let k = 0; k < candidates.length && remaining > 0; k += 1) {
        const candidate = candidates[k] as (typeof candidates)[number];
        const left = remaining - candidate.count;
        const slots = trips - selected.length - 1;
        if (left > 0 && (slots <= 0 || ((best[k + 1] as number[])[slots] as number) < left)) continue;
        selected.push(candidate);
        remaining = left;
      }
      if (remaining > 0) return [];
      // T-659: more trips to the nearest stacks when they walk less in all than the fewest stacks do,
      // each trip going out from the job and back: two bars of fuel from the two single bars beside
      // the smelter, not one stack of two across the hall.
      if (distance !== undefined && selected.length < candidates.length) {
        const nearest: typeof candidates = [];
        for (let k = 0, units = 0; k < candidates.length && units < n; k += 1) {
          nearest.push(candidates[k] as (typeof candidates)[number]);
          units += (candidates[k] as (typeof candidates)[number]).count;
        }
        const walk = (set: typeof candidates): number => set.reduce((sum, c) => sum + distance(from, reader.tileOf(c.id)), 0);
        if (nearest.length > selected.length && walk(nearest) < walk(selected)) selected = nearest;
      }
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
    wieldsOtherWeapon: (workerId) => {
      const weapon = entities.get(workerId, C.Equipment)?.weapon ?? 0;
      return weapon !== 0 && heldLauncher(workerId) === 0;
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

function isLauncher(items: ItemsReader, itemId: EntityId): boolean {
  const item = items.get(itemId);
  return item !== undefined && items.categoryOf(item.type) === toolFilter('ranged').category;
}

/** Drops the launcher a worker holds as its tool on `tile`, and the unowned ammunition of its kind the worker carries. */
function dropLauncherWithAmmo(board: JobBoard, ctx: TickContext, workerId: EntityId, launcherId: EntityId, tile: TileIndex): void {
  const api = ctx.world.services.items;
  if (api === null) return;
  const items = ctx.readers.of<ItemsReader>('13');
  const launcher = items.get(launcherId);
  const carrying = board.workerOf(workerId).carrying;
  const ammo = ctx.registry.table<{ id: string; launcher?: { ammo?: string } }>('weapons').byId(items.def(launcher?.type ?? -1)?.id ?? '')?.launcher?.ammo;
  dropTool(board, ctx, workerId, launcherId, tile);
  for (const itemId of ammo === undefined ? [] : items.carriedItems(workerId)) {
    const it = items.get(itemId);
    if (it === undefined || it.carriedBy !== workerId || itemId === carrying || (it.flags & ItemFlag.Owned) !== 0) continue;
    if (items.def(it.type)?.id !== ammo) continue;
    if (it.reservedBy !== 0 || (it.flags & ItemFlag.Reserved) !== 0) api.release(itemId);
    api.dropAt(itemId, tile);
  }
}

/**
 * 11 § Assignment: a worker holds one tool. A worker that is about to equip another tool first
 * puts the pick, axe or launcher it holds down on its own tile (the tile it stands on); a launcher
 * goes with the unowned ammunition of its kind the worker carries.
 */
export function dropHeldToolBeforeEquip(board: JobBoard, ctx: TickContext, workerId: EntityId): void {
  if (!ctx.readers.has('13')) return;
  const items = ctx.readers.of<ItemsReader>('13');
  const held = board.workerOf(workerId).toolId;
  if (held === 0 || items.get(held)?.carriedBy !== workerId) return;
  const tile = board.workerTile(workerId);
  if (tile < 0) return;
  if (isLauncher(items, held)) dropLauncherWithAmmo(board, ctx, workerId, held, tile);
  else if (isPickOrAxe(items, held)) dropTool(board, ctx, workerId, held, tile);
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

/**
 * 11 § Assignment step 5: a worker whose weapon slot holds a weapon that is not a launcher cannot
 * loose the launcher it holds as its tool (a hunter who joined a squad and claimed an axe). It drops
 * that launcher, and the unowned ammunition of the launcher's kind it carries, on its own tile.
 */
export function dropUnusableLaunchers(board: JobBoard, ctx: TickContext): void {
  if (ctx.world.services.items === null || !ctx.readers.has('13')) return;
  const items = ctx.readers.of<ItemsReader>('13');
  for (const id of board.workers()) {
    const worker = board.workerOf(id);
    if (worker.toolId === 0 || board.items.wieldsOtherWeapon?.(id) !== true) continue;
    if (items.get(worker.toolId)?.carriedBy !== id || !isLauncher(items, worker.toolId)) continue;
    const tile = board.workerTile(id);
    if (tile < 0) continue;
    dropLauncherWithAmmo(board, ctx, id, worker.toolId, tile);
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

/**
 * 11 § Assignment, a tool held from the fortress (T-661): a pick, axe or launcher held by a worker that
 * cannot use it comes back to the fortress once that has lasted `JOB_HOLD_TICKS`. The worker cannot use
 * it while it is down or a patient (17: in a hospital bed, or waiting for one). A soldier keeps its tool:
 * duty is not counted (a squad goes on and off duty, and a tool put down at every shift came and went
 * between the barracks and the trees), and a squad member whose weapon slot is empty fights with it. The
 * tool is put down on the worker's tile as ordinary stock (`ToolDropped`), so a `no_tool` job retries, a
 * worker with the labor fetches it, and the holder takes up one again when it is back. The count starts on
 * the first jobs tick that sees the worker unable and ends when it is able again.
 */
export function dropToolsOfTheUnable(board: JobBoard, ctx: TickContext): void {
  const away = board.toolAway;
  if (ctx.world.services.items === null || !ctx.readers.has('13')) return;
  const items = ctx.readers.of<ItemsReader>('13');
  const health = ctx.readers.has('17') ? ctx.readers.of<{ isPatient(id: EntityId): boolean }>('17') : null;
  const seen = new Set<EntityId>();
  for (const id of board.workers()) {
    const held = board.workerOf(id).toolId;
    if (held === 0 || items.get(held)?.carriedBy !== id) continue;
    const launcher = isLauncher(items, held);
    if (!launcher && !isPickOrAxe(items, held)) continue;
    const weapon = ctx.world.entities.get(id, C.Equipment)?.weapon ?? 0;
    const fightsWithIt = ctx.world.entities.has(id, C.Soldier) && (weapon === 0 || weapon === held);
    const unable = !fightsWithIt && (board.isDown(id) || health?.isPatient(id) === true);
    if (!unable) continue;
    seen.add(id);
    const since = away.get(id);
    if (since === undefined) {
      away.set(id, board.now);
      continue;
    }
    if (board.now - since < JOB_HOLD_TICKS) continue;
    const tile = board.workerTile(id);
    if (tile < 0) continue;
    away.delete(id);
    seen.delete(id);
    if (launcher) dropLauncherWithAmmo(board, ctx, id, held, tile);
    else dropTool(board, ctx, id, held, tile);
  }
  for (const id of Array.from(away.keys())) if (!seen.has(id)) away.delete(id);
}
