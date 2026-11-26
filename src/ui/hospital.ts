/**
 * 17 § Player-facing behavior: what the hospitals hold and want, read by the hospital inspector, the
 * hospital's standing alert and the trade screen's "the hospital wants" mark.
 */
import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { HOSPITAL_DEFAULT_SUPPLIES } from '@systems/health/constants';
import { hospitalWantsOf } from '@systems/health/supplies';

interface Env {
  readonly readers: ReaderSet;
  readonly registry: Registry;
}

/** The units of an item type (its id) lying on a zone's tiles, in containers there, or in its furniture's chests. */
export function zoneHolds(env: Env, tiles: readonly TileIndex[], typeName: string): number {
  const it = env.readers.has('13') ? env.readers.of<ItemsReader>('13') : null;
  const b = env.readers.has('14') ? env.readers.of<BuildingsReader>('14') : null;
  const table = env.registry.table<{ id: string }>('items');
  if (it === null || !table.has(typeName)) return 0;
  const type = table.index(typeName);
  let total = 0;
  for (const t of tiles) {
    for (const itId of it.at(t)) {
      const item = it.get(itId);
      if (item !== undefined && item.type === type) total += item.count;
      for (const innerId of it.inContainer(itId)) {
        const inner = it.get(innerId);
        if (inner !== undefined && inner.type === type) total += inner.count;
      }
    }
    const bId = b?.at(t) ?? 0;
    if (bId === 0) continue;
    const building = env.readers.entities.get(bId, C.Building);
    if (building === undefined || building.itemId === 0) continue;
    for (const innerId of it.inContainer(building.itemId)) {
      const inner = it.get(innerId);
      if (inner !== undefined && inner.type === type) total += inner.count;
    }
  }
  return total;
}

/** A hospital's wanted supplies: its setting, or `HOSPITAL_DEFAULT_SUPPLIES`. */
export function hospitalWants(env: Env, zoneId: EntityId): Readonly<Record<string, number>> {
  const b = env.readers.has('14') ? env.readers.of<BuildingsReader>('14') : null;
  return b === null ? HOSPITAL_DEFAULT_SUPPLIES : hospitalWantsOf(b, zoneId);
}

/**
 * The dressings (cloth and bandages, 17 § Bandages first) the hospitals hold and want, summed over
 * every hospital; null with no hospital.
 */
export function hospitalDressingsHeld(env: Env): { readonly held: number; readonly wanted: number } | null {
  const b = env.readers.has('14') ? env.readers.of<BuildingsReader>('14') : null;
  const zones = b?.zonesOfType('hospital') ?? [];
  if (b === null || zones.length === 0) return null;
  let held = 0;
  let wanted = 0;
  for (const id of zones) {
    const tiles = b.zone(id)?.tiles ?? [];
    held += zoneHolds(env, tiles, 'cloth') + zoneHolds(env, tiles, 'bandage');
    const wants = hospitalWants(env, id);
    wanted += (wants['cloth'] ?? 0) + (wants['bandages'] ?? 0);
  }
  return { held, wanted };
}

/**
 * 17 § Player-facing behavior: a merchant's good the trade screen marks "the hospital wants": a
 * cloth or a bandage while the hospitals hold fewer dressings than they want.
 */
export function hospitalWantsItem(env: Env, itemId: EntityId): boolean {
  const it = env.readers.has('13') ? env.readers.of<ItemsReader>('13') : null;
  const item = it?.get(itemId);
  if (it === null || item === undefined) return false;
  const category = it.categoryOf(item.type);
  if (!category.startsWith('textile/cloth') && !category.startsWith('medical/bandage')) return false;
  const dressings = hospitalDressingsHeld(env);
  return dressings !== null && dressings.held < dressings.wanted;
}

/** No bandage and no cloth is to be had in the whole fortress (not forbidden, reserved, owned or carried). */
export function noDressingToBeHad(env: Env): boolean {
  const it = env.readers.has('13') ? env.readers.of<ItemsReader>('13') : null;
  return it !== null && it.countAvailable({ category: 'medical/bandage' }) + it.countAvailable({ category: 'textile/cloth' }) === 0;
}
