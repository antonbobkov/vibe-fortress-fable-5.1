/** `items.md` § Meal ingredients; `names.md` § Dish words. */
import { C } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import { hashString } from '@core/rng';
import type { EntityId } from '@core/types';

type MealTier = 'easy' | 'fine' | 'lavish';
interface ItemRow { readonly id: string; readonly category: string }
interface MaterialRow { readonly id: string; readonly name: string }
interface DishNames { readonly dishes: Readonly<Record<MealTier, readonly string[]>> }

/** The seasoning whose meal is named "salted …". */
const SALT = 'salt';

/** A crafted meal keeps its first ingredient's material, so no extra item state is required. */
export function mealName(entities: EntityStore, registry: Registry, itemId: EntityId): string | null {
  const item = entities.get(itemId, C.Item);
  if (item === undefined) return null;
  const category = registry.table<ItemRow>('items').byIndex(item.type)?.category ?? '';
  const tier = category.startsWith('food/meal/') ? category.slice('food/meal/'.length) : '';
  if (tier !== 'easy' && tier !== 'fine' && tier !== 'lavish') return null;
  const ingredient = registry.table<MaterialRow>('materials').byIndex(item.material)?.name ?? '';
  const words = registry.derived<DishNames>('names').dishes[tier];
  if (ingredient === '' || words.length === 0) return null;
  // 12 § Smoke, salt and the smokehouse: a meal seasoned with salt is "salted boar stew".
  const materials = registry.table<MaterialRow>('materials');
  const salted = (item.seasoned ?? []).some((m) => materials.byIndex(m)?.id === SALT);
  return `${salted ? 'salted ' : ''}${ingredient} ${words[hashString(String(itemId)) % words.length]}`;
}
