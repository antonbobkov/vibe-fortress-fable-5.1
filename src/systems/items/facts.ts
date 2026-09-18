/**
 * The content facts 13 reads per item type and material, resolved once from the registry
 * (`03-content/items.md` columns; `materials.md` value and class).
 */

import type { Registry } from '@core/registry';
import { BAG_CAPACITY, BARREL_CAPACITY, BIN_CAPACITY, CHEST_CAPACITY } from './constants';

export interface ItemTypeRow {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  /** `Fixed` (thousandths). */
  readonly mult: number;
  readonly stack: number;
  /** The container class the type wants in a stockpile, or `none`. */
  readonly container: string;
  readonly rotDays: number;
  readonly weight: string;
  readonly materials: string | readonly string[];
  readonly glyph?: string;
  readonly quality: boolean;
  readonly tags?: readonly string[];
  readonly edible?: boolean;
  readonly drinkable?: boolean;
  readonly capacity?: number;
  /** The class of container this type *is* (`barrel`, `bag`, `bin`, `bucket`, `chest`). */
  readonly containerClass?: string;
}

interface MaterialRow {
  readonly id: string;
  readonly class: string;
  readonly value: number;
}

/** Container classes and their capacity when a row gives none (13 § Tuning constants). */
const CLASS_CAPACITY: Readonly<Record<string, number>> = Object.freeze({
  barrel: BARREL_CAPACITY,
  bag: BAG_CAPACITY,
  bin: BIN_CAPACITY,
  chest: CHEST_CAPACITY,
  bucket: 1,
});

/**
 * Container classes whose capacity counts units (`BARREL_CAPACITY` "Units of drink or food",
 * `BAG_CAPACITY` "Seeds or units of powder", the bucket's "one unit"); a bin and a chest count
 * items (`BIN_CAPACITY` "Items per bin"). D-068.
 */
const UNIT_CLASSES: ReadonlySet<string> = new Set(['barrel', 'bag', 'bucket']);

export class ItemFacts {
  readonly types: (ItemTypeRow | undefined)[] = [];
  readonly typeCount: number;
  private readonly materialValues: number[] = [];
  private readonly materialClasses: string[] = [];
  readonly typeIndex: (id: string) => number;
  readonly materialIndex: (id: string) => number;
  readonly materialIdOf: (index: number) => string;

  constructor(registry: Registry) {
    const items = registry.table<ItemTypeRow>('items');
    this.typeCount = items.size;
    for (let t = 1; t <= items.size; t += 1) this.types[t] = items.byIndex(t);
    const materials = registry.table<MaterialRow>('materials');
    for (let m = 1; m <= materials.size; m += 1) {
      const row = materials.byIndex(m);
      this.materialValues[m] = row?.value ?? 0;
      this.materialClasses[m] = row?.class ?? '';
    }
    this.typeIndex = (id) => (items.has(id) ? items.index(id) : 0);
    this.materialIndex = (id) => (materials.has(id) ? materials.index(id) : 0);
    this.materialIdOf = (index) => (materials.byIndex(index) === undefined ? '' : materials.idOf(index));
  }

  row(type: number): ItemTypeRow {
    const row = this.types[type];
    if (row === undefined) throw new RangeError(`items: unknown item type index ${type}`);
    return row;
  }

  has(type: number): boolean {
    return this.types[type] !== undefined;
  }

  materialValue(material: number): number {
    return this.materialValues[material] ?? 0;
  }

  materialClass(material: number): string {
    return this.materialClasses[material] ?? '';
  }

  /** The class of container a type is, or '' when it is not a container. */
  containerClassOf(type: number): string {
    const row = this.types[type];
    if (row === undefined) return '';
    if (row.containerClass !== undefined) return row.containerClass;
    return '';
  }

  /** A container's capacity: the row's `capacity`, else its class constant. */
  capacityOf(type: number): number {
    const row = this.row(type);
    if (row.capacity !== undefined) return row.capacity;
    return CLASS_CAPACITY[row.containerClass ?? ''] ?? 0;
  }

  /** True when the class counts units rather than items. */
  countsUnits(containerClass: string): boolean {
    return UNIT_CLASSES.has(containerClass);
  }

  /** The type's category path with every ancestor (`food/meat/raw` → `food`, `food/meat`, `food/meat/raw`). */
  categoryPath(type: number): string {
    return this.row(type).category;
  }

  hasTag(type: number, tag: string): boolean {
    const tags = this.types[type]?.tags;
    return tags !== undefined && tags.includes(tag);
  }
}

/** True when `category` is `node` or lies under it in the category tree (13 § Category tree). */
export function categoryUnder(category: string, node: string): boolean {
  if (node === '' || node === '*') return true;
  return category === node || category.startsWith(`${node}/`);
}
