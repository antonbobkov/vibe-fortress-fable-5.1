/**
 * `10-dwarves.md` § The Thane's whim: what the Thane wishes for in a season (`personality-and-
 * thoughts.md` § Whims), whether the fortress could meet it, and whether it has. All face: 15 reads
 * only `WhimJudged`.
 */
import type { Registry } from '@core/registry';
import type { ReaderSetLike } from '@core/system';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemFilter, ItemsReader } from '@systems/items';

/** The whim's draw: a stream of its own, so a game without a Thane draws the same numbers. */
export const WHIMS_STREAM = '10.whims';

/** A row of `whims.json`. */
export interface WhimRow {
  readonly id: string;
  readonly kind: 'stock' | 'room';
  /** An item id (a room whim's building type, which is also its item), or `any`. */
  readonly item: string;
  readonly material?: string;
  readonly quality?: number;
  readonly bedding?: 'feather';
  readonly zone?: string;
  /** The zone is the Thane's own. */
  readonly thane?: boolean;
  readonly count: number;
  readonly text: string;
}

/** The saved whim of the season: its row and the tick it was set (`DwarvesState.whim`). */
export interface Whim {
  readonly id: string;
  readonly setTick: number;
}

interface ItemRow { readonly id: string; readonly tags?: readonly string[] }
interface RecipeRow {
  readonly id: string;
  readonly workshop: string;
  readonly quality: boolean;
  readonly inputs: readonly { readonly match: string }[];
  readonly outputs: readonly { readonly item: string; readonly material: { readonly fixed?: string; readonly from?: string; readonly index?: number } }[];
}

/** The whims of the content, in registry order; [] without the table. */
export function whimRows(registry: Registry): WhimRow[] {
  if (!registry.hasTable('whims')) return [];
  const table = registry.table<WhimRow>('whims');
  return table.ids().map((id) => table.byId(id) as WhimRow);
}

/** The stock a whim counts: its item type, of its material and quality when it names them. */
function stockFilter(registry: Registry, row: WhimRow): ItemFilter | null {
  const items = registry.table<ItemRow>('items');
  const materials = registry.table('materials');
  const filter: ItemFilter = {};
  if (row.item !== 'any') {
    if (!items.has(row.item)) return null;
    filter.type = items.index(row.item);
  }
  if (row.material !== undefined) {
    if (!materials.has(row.material)) return null;
    filter.materialId = materials.index(row.material);
  }
  if (row.quality !== undefined) filter.minQuality = row.quality;
  return filter;
}

/** The built buildings that answer a room whim: of its type and material, made up as it says, in its zone. */
function roomMatches(readers: ReaderSetLike, registry: Registry, row: WhimRow, thaneId: EntityId): number {
  if (!readers.has('14')) return 0;
  const b14 = readers.of<BuildingsReader>('14');
  const materials = registry.table('materials');
  const material = row.material === undefined ? -1 : materials.has(row.material) ? materials.index(row.material) : -2;
  if (material === -2) return 0;
  let n = 0;
  for (const id of b14.byType(row.item)) {
    const b = b14.get(id);
    if (b === undefined || b.state !== 'built') continue;
    if (material >= 0 && b.material !== material) continue;
    if (row.bedding !== undefined && b14.bedding(id) !== row.bedding) continue;
    const zones = new Set(b.footprint.flatMap((t) => b14.zonesAt(t)));
    const inZone = Array.from(zones).some((z) => (row.zone === undefined || b14.zone(z)?.type === row.zone) &&
      (row.thane !== true || (thaneId !== 0 && b14.ownerOf(z) === thaneId)));
    if (inZone) n += 1;
  }
  return n;
}

/**
 * `10` § The Thane's whim, judged: a `stock` whim has at least `count` units of its item in stock
 * (available: not forbidden, reserved, owned or installed); a `room` whim has `count` built buildings
 * of its type in a zone of its type (the Thane's own when it says so).
 */
export function whimMet(readers: ReaderSetLike, registry: Registry, row: WhimRow, thaneId: EntityId): boolean {
  if (row.kind === 'room') return roomMatches(readers, registry, row, thaneId) >= row.count;
  const filter = stockFilter(registry, row);
  if (filter === null || !readers.has('13')) return false;
  return readers.of<ItemsReader>('13').countAvailable(filter) >= row.count;
}

/** The item types whose id or tags answer a recipe input's `match` (alternatives split on `|`). */
function answering(registry: Registry, match: string): number[] {
  const items = registry.table<ItemRow>('items');
  const names = match.split('|');
  return items.ids().filter((id) => names.includes(id) || (items.byId(id)?.tags ?? []).some((t) => names.includes(t)))
    .map((id) => items.index(id));
}

/**
 * `10` § The Thane's whim, possible: its item type is in the content, and one such item (of its
 * material and quality) is in stock, or a built workshop has a recipe that makes the type, of the
 * named material when there is one (the recipe fixes its output's material to it, or makes it from an
 * input of which an item of that material is in stock); `any` item with any built workshop that has a
 * quality recipe.
 */
export function whimPossible(readers: ReaderSetLike, registry: Registry, row: WhimRow): boolean {
  const filter = stockFilter(registry, row);
  if (filter === null || !readers.has('13') || !readers.has('14')) return false;
  const items13 = readers.of<ItemsReader>('13');
  if (items13.countAvailable(filter) > 0) return true;
  const b14 = readers.of<BuildingsReader>('14');
  const builtTypes = new Set<string>();
  for (const type of b14.types()) {
    if (type.category !== 'workshop') continue;
    const made = (b14.byType(type.id)).some((id) => b14.get(id)?.state === 'built');
    if (!made) continue;
    builtTypes.add(type.id);
    const variantOf = (type as { magmaVariantOf?: string }).magmaVariantOf;
    if (variantOf !== undefined) builtTypes.add(variantOf);
  }
  if (builtTypes.size === 0) return false;
  const recipes = registry.table<RecipeRow>('recipes');
  const materials = registry.table('materials');
  for (const id of recipes.ids()) {
    const recipe = recipes.byId(id) as RecipeRow;
    if (!builtTypes.has(recipe.workshop)) continue;
    if (row.item === 'any') {
      if (recipe.quality) return true;
      continue;
    }
    for (const out of recipe.outputs) {
      if (out.item !== row.item) continue;
      if (row.material === undefined) return true;
      if (out.material.fixed === row.material) return true;
      if (out.material.from === 'input') {
        const input = recipe.inputs[out.material.index ?? 0];
        if (input === undefined || !materials.has(row.material)) continue;
        const types = answering(registry, input.match);
        if (types.length > 0 && items13.countAvailable({ types, materialId: materials.index(row.material) }) > 0) return true;
      }
    }
  }
  return false;
}
