/** Equipment, including spare carried items, leaves the map with its creature. */
import { C } from '@core/components';
import type { WorldLike } from '@core/system';
import type { EntityId } from '@core/types';

export function removeLeavingEquipment(world: WorldLike, carrier: EntityId, except: readonly EntityId[] = []): void {
  const items = world.services.items;
  if (items === null) return;
  const protectedIds = new Set(except);
  const dispose = (id: EntityId): void => {
    if (protectedIds.has(id) || !world.entities.has(id, C.Item)) return;
    for (const child of world.entities.get(id, C.Container)?.contents.slice() ?? []) dispose(child);
    items.destroy(id, 'left_map');
  };
  for (const id of world.entities.with(C.Item)) {
    const item = world.entities.get(id, C.Item);
    if (item !== undefined && (item.carriedBy === carrier || item.ownerId === carrier)) dispose(id);
  }
}
