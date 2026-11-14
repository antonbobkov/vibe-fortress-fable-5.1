/**
 * The plant rows 07 needs, flattened into arrays once.
 *
 * Two index spaces meet here. A *plant index* is the `plants` table's dense index, which is what
 * `Crop.plant` holds (`schemas/components.md`: `plant: Idx<PlantDef>`). A *species material* is the
 * `materials` table's index of the row the loader generates for every plant species
 * (`03-content/materials.md` § Meal, drink and plant materials: "Each plant species is a material
 * of class `plant`"), which is what a `tree`, `sapling` or `shrub` tile carries in `Map3D.material`
 * (`07` § Concepts: "a tile … whose `material` is the plant species") and what a seed or a harvested
 * plant carries as its item material. The two tables are sorted independently, so the mapping is
 * built explicitly and never assumed.
 */

import type { Registry } from '@core/registry';
import { SAPLING_YEARS } from './constants';

export interface PlantYieldSecondary {
  readonly item: string;
  readonly material?: string;
  readonly count: number;
}

export interface PlantBiomeWeight {
  readonly biome: string;
  readonly weight: number;
}

export interface PlantCavernWeight {
  readonly tier: number;
  readonly weight: number;
}

/** A `plants` table row; the columns of `03-content/plants.md`. */
export interface PlantRow {
  readonly id: string;
  readonly name: string;
  readonly kind: 'tree' | 'fungus_tree' | 'shrub' | 'crop' | 'cave_crop';
  /** Days per stage at 100% growth (crops only). */
  readonly stageDays?: number;
  /** Seasons a surface crop grows in; absent means every season. */
  readonly seasons?: readonly number[];
  readonly light: 'sun' | 'dark' | 'any' | 'glow';
  readonly minC: number;
  readonly maxC: number;
  readonly yield?: readonly [number, number];
  readonly yieldItem?: string;
  readonly yieldMaterial?: string;
  readonly secondary?: PlantYieldSecondary;
  readonly value: number;
  readonly logs?: readonly [number, number];
  readonly saplingYears?: number;
  readonly regrowDays?: number;
  readonly wildSeedPermille?: number;
  readonly seedOf?: string;
  readonly biomes?: readonly PlantBiomeWeight[];
  readonly caverns?: readonly PlantCavernWeight[];
  /** Permille of cave shrubs a rare patch takes over, by cavern tier. */
  readonly rarePermille?: readonly [number, number, number];
  /** `straw` items of the crop's material each harvest drops (`plants.md` § Surface crops). */
  readonly straw?: number;
  /** `ash`: sown only on an ash tile; `stings`: gathering may sting (09). */
  readonly tags?: readonly string[];
  /** A shrub a tame grazer may eat when mature (08 § Grazing shrubs). */
  readonly graze?: boolean;
  readonly glyph: string;
  readonly fg: string;
}

interface RecipeOutputRow {
  readonly item: string;
}

interface RecipeRow {
  readonly id: string;
  readonly outputs: readonly RecipeOutputRow[];
}

/** `07` § Seeds: "always the `seed` item type with the species as material". */
export const SEED_ITEM = 'seed';

/** `07` § Farm plots: the item a crop row's `straw` count drops. */
export const STRAW_ITEM = 'straw';

/** `07` § Ash: the floor material that is ash for good. */
export const ASH_SOIL = 'ash_soil';

export class PlantFacts {
  /** By plant index. */
  private readonly rows: (PlantRow | undefined)[] = [];
  /** Plant index → species material index. */
  private readonly materialOfPlant: number[] = [];
  /** Species material index → plant index. */
  private readonly plantOfMaterialIndex: number[] = [];
  /** Plant index → the material of its `yieldItem` (the `yieldMaterial`, else the species). */
  private readonly yieldMaterials: number[] = [];
  /** Plant index → item index of `yieldItem`, or 0. */
  private readonly yieldItems: number[] = [];
  /** Plant index → the secondary yield, resolved, or null (D-104). */
  private readonly secondaries: ({ item: number; material: number; count: number } | null)[] = [];
  readonly size: number;
  readonly seedItem: number;
  /** The `straw` item index, or 0. */
  readonly strawItem: number;
  /** The `ash_soil` material index, or -1. */
  readonly ashSoil: number;

  constructor(registry: Registry) {
    const plants = registry.table<PlantRow>('plants');
    const materials = registry.table<{ id: string }>('materials');
    const items = registry.table<{ id: string }>('items');
    // An item every recipe can make is a workshop product, not a harvest yield (D-104).
    const madeByRecipe = new Set<string>();
    const recipes = registry.table<RecipeRow>('recipes');
    for (let r = 1; r <= recipes.size; r += 1) {
      for (const out of recipes.byIndex(r)?.outputs ?? []) madeByRecipe.add(out.item);
    }
    this.size = plants.size;
    this.seedItem = items.has(SEED_ITEM) ? items.index(SEED_ITEM) : 0;
    this.strawItem = items.has(STRAW_ITEM) ? items.index(STRAW_ITEM) : 0;
    this.ashSoil = materials.has(ASH_SOIL) ? materials.index(ASH_SOIL) : -1;
    for (let p = 1; p <= plants.size; p += 1) {
      const row = plants.byIndex(p) as PlantRow;
      this.rows[p] = row;
      const material = materials.has(row.id) ? materials.index(row.id) : 0;
      this.materialOfPlant[p] = material;
      if (material > 0) this.plantOfMaterialIndex[material] = p;
      const yieldMaterial = row.yieldMaterial ?? row.id;
      this.yieldMaterials[p] = materials.has(yieldMaterial) ? materials.index(yieldMaterial) : material;
      this.yieldItems[p] = row.yieldItem !== undefined && items.has(row.yieldItem) ? items.index(row.yieldItem) : 0;
      const secondary = row.secondary;
      this.secondaries[p] =
        secondary === undefined || madeByRecipe.has(secondary.item) || !items.has(secondary.item)
          ? null
          : {
              item: items.index(secondary.item),
              material: secondary.material !== undefined && materials.has(secondary.material) ? materials.index(secondary.material) : material,
              count: secondary.count,
            };
    }
  }

  row(plant: number): PlantRow | undefined {
    return this.rows[plant];
  }

  /** The plant index of a species material (a tree, sapling or shrub tile's material), or 0. */
  plantOfMaterial(material: number): number {
    return this.plantOfMaterialIndex[material] ?? 0;
  }

  /** The species material of a plant index, or 0. */
  materialOf(plant: number): number {
    return this.materialOfPlant[plant] ?? 0;
  }

  yieldItemOf(plant: number): number {
    return this.yieldItems[plant] ?? 0;
  }

  yieldMaterialOf(plant: number): number {
    return this.yieldMaterials[plant] ?? 0;
  }

  secondaryOf(plant: number): { item: number; material: number; count: number } | null {
    return this.secondaries[plant] ?? null;
  }

  /** `07` § Concepts: a farm plant, surface (`crop`) or underground (`cave_crop`). */
  isFarmed(plant: number): boolean {
    const kind = this.rows[plant]?.kind;
    return kind === 'crop' || kind === 'cave_crop';
  }

  /** "Cave crops use a growth modifier of 100 in every season and ignore weather." */
  isCave(plant: number): boolean {
    return this.rows[plant]?.kind === 'cave_crop';
  }

  isShrub(plant: number): boolean {
    return this.rows[plant]?.kind === 'shrub';
  }

  isTree(plant: number): boolean {
    const kind = this.rows[plant]?.kind;
    return kind === 'tree' || kind === 'fungus_tree';
  }

  /** `07` § Ash: the crop is sown only on an ash tile (wyrmtongue). */
  ashOnly(plant: number): boolean {
    return this.rows[plant]?.tags?.includes('ash') === true;
  }

  /** `07` § Shrubs: a mature shrub of this species feeds a tame grazer. */
  grazable(plant: number): boolean {
    return this.rows[plant]?.kind === 'shrub' && this.rows[plant]?.graze === true;
  }

  /** `07` § Trees: `saplingYears` from the row, else `SAPLING_YEARS`. */
  saplingYearsOf(plant: number): number {
    return this.rows[plant]?.saplingYears ?? SAPLING_YEARS;
  }

  /** Every farmed species, ascending plant index. */
  farmedPlants(): number[] {
    const out: number[] = [];
    for (let p = 1; p <= this.size; p += 1) if (this.isFarmed(p)) out.push(p);
    return out;
  }

  indexOf(id: string): number {
    for (let p = 1; p <= this.size; p += 1) if (this.rows[p]?.id === id) return p;
    return 0;
  }
}
