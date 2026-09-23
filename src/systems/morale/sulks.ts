/** `15` § Sulks: trait precedence and the five nonviolent effects. */
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { Registry } from '@core/registry';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import type { TraitDef } from './thoughts';

export type SulkKind = 'day_off' | 'argue' | 'weep' | 'hoard' | 'break';

export function advanceSulkCounter(counter: number, miserable: boolean): { days: number; sulk: boolean } {
  const days = miserable ? counter + 1 : Math.max(0, counter - 1);
  return days >= 7 ? { days: 0, sulk: true } : { days, sulk: false };
}

export function sulkKind(registry: Registry, traits: readonly number[]): SulkKind {
  const names = new Set(traits.map((id) => registry.table<TraitDef>('personality').byIndex(id)?.id));
  if (names.has('restless')) return 'day_off';
  if (names.has('gregarious')) return 'argue';
  if (names.has('sensitive')) return 'weep';
  if (names.has('greedy')) return 'hoard';
  return 'break';
}

function distance(ctx: TickContext, a: EntityId, b: EntityId): number {
  const p = ctx.world.entities.get(a, C.Position);
  const q = ctx.world.entities.get(b, C.Position);
  return p === undefined || q === undefined ? Infinity : Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z));
}

/** The returned fields accompany `SulkHappened`; 10 and 14 own the grudge and broken tile. */
export function doSulk(kind: SulkKind, id: EntityId, ctx: TickContext, dayOffUntil: Map<EntityId, number>): Record<string, unknown> {
  const buildings = ctx.readers.of<BuildingsReader>('14');
  const dwarves = ctx.readers.of<DwarvesReader>('10');
  if (kind === 'day_off') {
    dayOffUntil.set(id, ctx.tick + TICKS_PER_DAY);
    ctx.jobs.interrupt(id, true);
    return {};
  }
  if (kind === 'argue') {
    const other = dwarves.list().filter((candidate) => candidate !== id).sort((a, b) => distance(ctx, id, a) - distance(ctx, id, b) || a - b)[0];
    return other === undefined ? {} : { partnerId: other };
  }
  if (kind === 'weep') return { targetTile: buildings.hearthHallTiles()[0] ?? -1 };
  if (kind === 'hoard') {
    const items = ctx.readers.of<ItemsReader>('13');
    const options = ctx.world.entities.with(C.Item).filter((item) => items.itemCategory(item).startsWith('craft/') && items.get(item)?.ownerId === 0)
      .sort((a, b) => distanceItem(ctx, id, items.tileOf(a)) - distanceItem(ctx, id, items.tileOf(b)) || a - b);
    const item = options[0];
    if (item === undefined) return {};
    const room = buildings.zone(buildings.bedroomOf(id));
    const at = room?.tiles[0] ?? items.tileOf(item);
    ctx.world.services.items?.setOwner(item, id);
    if (at >= 0) ctx.world.services.items?.dropAt(item, at);
    return { itemId: item };
  }
  const items = ctx.readers.of<ItemsReader>('13');
  const furniture = ['chair', 'table', 'cabinet'].flatMap((type) => buildings.byType(type)).filter((building) => {
    const b = buildings.get(building);
    return b?.state === 'built' && b.itemId !== 0 && (items.get(b.itemId)?.quality ?? 6) <= 1;
  }).sort((a, b) => distanceTile(ctx, id, buildings.get(a)?.origin ?? -1) - distanceTile(ctx, id, buildings.get(b)?.origin ?? -1) || a - b);
  return furniture[0] === undefined ? {} : { buildingId: furniture[0] };
}

function distanceTile(ctx: TickContext, id: EntityId, tile: number): number {
  const p = ctx.world.entities.get(id, C.Position);
  if (p === undefined || tile < 0) return Infinity;
  return Math.max(Math.abs(p.x - ctx.world.map.xOf(tile)), Math.abs(p.y - ctx.world.map.yOf(tile)), Math.abs(p.z - ctx.world.map.zOf(tile)));
}

function distanceItem(ctx: TickContext, id: EntityId, tile: number): number { return distanceTile(ctx, id, tile); }
