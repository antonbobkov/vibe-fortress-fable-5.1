/**
 * `13` § Containers in play, Pots break: a container of a `fragile` material (earthenware: a pot, a
 * clay jug) that a creature carries breaks when the creature is hit (16's `AttackResolved` with
 * `outcome: 'hit'`). The drink in it is lost with it; anything else it holds lies where it was. No draw.
 */

import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import type { ItemCore } from './api';

/** The material tag that makes a container break when its carrier is hit (`materials.md` § Fired at the kiln). */
export const FRAGILE_TAG = 'fragile';

/** The `ItemDestroyed` reason of a broken pot and of the drink lost with it. */
export const BROKEN_REASON = 'broken';

/** The material indices tagged `fragile`, from the registry. */
export function fragileMaterials(registry: Registry): ReadonlySet<number> {
  const materials = registry.table<{ id: string; tags?: readonly string[] }>('materials');
  const out = new Set<number>();
  for (let m = 1; m <= materials.size; m += 1) if (materials.byIndex(m)?.tags?.includes(FRAGILE_TAG) === true) out.add(m);
  return out;
}

/** Breaks every fragile container the creature carries; returns the broken containers' ids. */
export function breakCarried(core: ItemCore, fragile: ReadonlySet<number>, carrierId: EntityId): EntityId[] {
  if (fragile.size === 0) return [];
  const broken: EntityId[] = [];
  for (const id of core.carriedItems(carrierId)) {
    const item = core.get(id);
    if (item === undefined || !fragile.has(item.material) || core.host.facts.containerClassOf(item.type) === '') continue;
    for (const inner of core.container(id)?.contents.slice() ?? []) {
      const held = core.get(inner);
      if (held !== undefined && core.host.facts.categoryPath(held.type).startsWith('drink')) core.destroy(inner, BROKEN_REASON);
    }
    core.destroy(id, BROKEN_REASON);
    broken.push(id);
  }
  return broken;
}
