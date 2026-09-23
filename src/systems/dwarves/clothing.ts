/** `10-dwarves.md` § Clothing: three required slots, with `over` optional. */
import { C, type Equipment } from '@core/components';
import type { World } from '@core/world';
import type { EntityId, TileIndex } from '@core/types';

interface GarmentRow {
  readonly id: string;
  readonly category: string;
  readonly materials: readonly string[] | string;
}

interface MaterialRow { readonly id: string; readonly class: string }

export function isUnclothed(e: Equipment | undefined, hasItem: (id: EntityId) => boolean): boolean {
  return e === undefined || !hasItem(e.clothing.body) || !hasItem(e.clothing.legs) || !hasItem(e.clothing.feet);
}

/** Content-driven default outfit for settlers and future immigrants (D-122). */
export function equipStartingClothes(world: World, id: EntityId, at: TileIndex): void {
  const itemTypes = world.registry.table<GarmentRow>('items');
  const materials = world.registry.table<MaterialRow>('materials');
  const cloth = materials.ids().find((key) => materials.byId(key)?.class === 'cloth');
  const clothing: Equipment['clothing'] = { body: 0, legs: 0, feet: 0, over: 0 };
  if (cloth !== undefined) for (const slot of ['body', 'legs', 'feet'] as const) {
    const type = itemTypes.ids().find((key) => {
      const row = itemTypes.byId(key);
      return row?.category === `clothing/${slot}` && Array.isArray(row.materials) && row.materials.includes('cloth');
    });
    if (type === undefined) continue;
    const garment = world.services.spawn.item(itemTypes.index(type), materials.index(cloth), at);
    if (garment !== 0) {
      world.services.items?.attachToCarrier(garment, id);
      clothing[slot] = garment;
    }
  }
  world.entities.add(id, C.Equipment, {
    weapon: 0, shield: 0, armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 }, clothing, quiver: 0,
  });
}
