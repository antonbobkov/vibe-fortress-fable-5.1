/**
 * Material and plant facts 03 needs from the registry, flattened into arrays by index once.
 *
 * `materials.md` § Columns gives each material a `class`; `03` § Reader `materialClassAt` names the
 * seven classes 03 reports. `minerals-and-metals.md` marks the deepsilver mineral with its
 * `deepsilver` flag; `plants.md` gives trees their `logs` range and log material and shrubs their
 * `yield`, `yieldItem` and `yieldMaterial`.
 */

import type { Registry } from '@core/registry';
import { TREE_LOGS_MAX, TREE_LOGS_MIN } from './constants';
import type { MaterialClass, MaterialFacts } from './rules/transitions';

interface MaterialRow {
  readonly id: string;
  readonly class: string;
  readonly hardness: number;
  readonly name: string;
}

interface MineralRow {
  readonly id: string;
  readonly deepsilver?: boolean;
}

interface PlantRow {
  readonly id: string;
  readonly kind: string;
  readonly logs?: readonly [number, number];
  readonly yield?: readonly [number, number];
  readonly yieldItem?: string;
  readonly yieldMaterial?: string;
  /** `plants.md`: the chance a gathered wild shrub also gives one seed. */
  readonly wildSeedPermille?: number;
  /** The crop species a wild shrub's seed sows. */
  readonly seedOf?: string;
  /** A second product, given with the first at each gathering (`plants.md`: "and 1 `fiber`"). */
  readonly secondary?: { readonly item: string; readonly material?: string; readonly count: number };
}

function classOfRow(cls: string): MaterialClass {
  switch (cls) {
    case 'stone':
    case 'obsidian':
      return 'stone';
    case 'soil':
      return 'soil';
    case 'ore':
      return 'ore';
    case 'gem':
      return 'gem';
    case 'ice':
      return 'ice';
    case 'wood':
      return 'wood';
    default:
      return 'other';
  }
}

export class TerrainFacts implements MaterialFacts {
  private readonly classes: MaterialClass[];
  private readonly metal: boolean[];
  private readonly deepsilver: boolean[];
  private readonly hardness: number[];
  private readonly names: string[];
  private readonly plants: (PlantRow | undefined)[];
  readonly materialIds: readonly string[];

  constructor(registry: Registry) {
    const materials = registry.table<MaterialRow>('materials');
    const minerals = registry.table<MineralRow>('minerals');
    const plants = registry.table<PlantRow>('plants');
    this.classes = [];
    this.metal = [];
    this.deepsilver = [];
    this.hardness = [];
    this.names = [];
    const ids: string[] = [''];
    for (let m = 1; m <= materials.size; m += 1) {
      const row = materials.byIndex(m) as MaterialRow;
      this.classes[m] = classOfRow(row.class);
      this.metal[m] = row.class === 'metal';
      this.deepsilver[m] = minerals.byId(row.id)?.deepsilver === true;
      this.hardness[m] = row.hardness;
      this.names[m] = row.name;
      ids[m] = row.id;
    }
    this.materialIds = ids;
    // A tree, sapling or shrub tile carries the *material* index of its species (`07` § Concepts,
    // and stage 9 of local map generation writes `materialIndex(species)`), so the plant rows are
    // indexed by material index here, not by the `plants` table's own index (T-M4-02).
    this.plants = [];
    for (let p = 1; p <= plants.size; p += 1) {
      const row = plants.byIndex(p) as PlantRow;
      if (materials.has(row.id)) this.plants[materials.index(row.id)] = row;
    }
  }

  classOf(material: number): MaterialClass {
    return this.classes[material] ?? 'other';
  }

  isMetal(material: number): boolean {
    return this.metal[material] === true;
  }

  isDeepsilver(material: number): boolean {
    return this.deepsilver[material] === true;
  }

  /** `materials.md` `hardness`: 100 is one `DIG_BASE_TICKS`. */
  hardnessOf(material: number): number {
    return this.hardness[material] ?? 100;
  }

  materialName(material: number): string {
    return this.names[material] ?? '';
  }

  materialId(material: number): string {
    return this.materialIds[material] ?? '';
  }

  /** The `plants` row of a species material index (a tree, sapling or shrub tile's material). */
  plant(species: number): PlantRow | undefined {
    return this.plants[species];
  }

  /** `plants.md` tree `logs` range, clamped to `TREE_LOGS_MIN … TREE_LOGS_MAX`. */
  logRange(species: number): [number, number] {
    const row = this.plants[species];
    const lo = Math.max(TREE_LOGS_MIN, row?.logs?.[0] ?? TREE_LOGS_MIN);
    const hi = Math.min(TREE_LOGS_MAX, Math.max(lo, row?.logs?.[1] ?? lo));
    return [lo, hi];
  }

  /** The wood a tree species is felled into: its `yieldMaterial` (`plants.md`, trees yield `log`). */
  logMaterial(species: number): string {
    const row = this.plants[species];
    return row?.yieldMaterial ?? row?.id ?? '';
  }
}
