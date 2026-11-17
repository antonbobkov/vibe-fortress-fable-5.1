/**
 * Equipment, including spare carried items, leaves the map with its creature (13 § Containers in
 * play): every item it carries or owns, everything inside those, and the load in its own
 * `Container` (a pack animal's, 20), all destroyed as `left_map`. Escaped loot in its hands (`except`)
 * is spared: `ThiefEscaped` removes it as `stolen`, with what it holds (18). What sits inside a
 * container that leaves goes with that container, loot or not, so no item is left pointing at a
 * container that is gone (T-579).
 */
import { C } from '@core/components';
import type { WorldLike } from '@core/system';
import type { EntityId } from '@core/types';

export function removeLeavingEquipment(world: WorldLike, carrier: EntityId, except: readonly EntityId[] = []): void {
  const items = world.services.items;
  if (items === null) return;
  const protectedIds = new Set(except);
  const dispose = (id: EntityId, inside: boolean): void => {
    if ((!inside && protectedIds.has(id)) || !world.entities.has(id, C.Item)) return;
    for (const child of world.entities.get(id, C.Container)?.contents.slice() ?? []) dispose(child, true);
    items.destroy(id, 'left_map');
  };
  for (const id of world.entities.get(carrier, C.Container)?.contents.slice() ?? []) dispose(id, true);
  for (const id of world.entities.with(C.Item)) {
    const item = world.entities.get(id, C.Item);
    if (item !== undefined && (item.carriedBy === carrier || item.ownerId === carrier)) dispose(id, false);
  }
}
