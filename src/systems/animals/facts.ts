/**
 * The species rows 08 needs, flattened by `creatures` table index once.
 *
 * `08` § Concepts names the columns: `size`, `speed`, `diet`, `temperament`, `nocturnal`,
 * `movementClass`, `products`, `value`, `tameable`, `trainable`, `biomes` with weights, group size
 * range, `cavern` tier, `perception`. `creatures.md` gives the cap rule
 * (`cap = weight / 5`, rounded up, minimum 2, times the biome's `wildlifeDensity`).
 */

import type { Registry } from '@core/registry';
import { CAP_MIN, CAP_PER_WEIGHT, DEFAULT_PERCEPTION } from './constants';

export type Diet = 'grazer' | 'carnivore' | 'omnivore' | 'none';
export type Temperament = 'timid' | 'neutral' | 'territorial' | 'aggressive';

export interface SpeciesProduct {
  readonly kind: string;
  readonly intervalDays: number;
}

export interface SpeciesBreeding {
  readonly gestationDays: number;
  readonly litter: readonly [number, number];
  readonly growDays: number;
  readonly hatch?: boolean;
}

export interface SpeciesRow {
  readonly id: string;
  readonly name: string;
  readonly plan: string;
  readonly size: number;
  readonly speed: number;
  readonly diet?: Diet;
  readonly temper?: Temperament;
  readonly movementClass: string;
  readonly nocturnal?: boolean;
  readonly products?: readonly SpeciesProduct[];
  readonly meatValue: number;
  readonly hideValue: number;
  readonly value: number;
  readonly naturalArmor: number;
  readonly fleeBloodPercent: number;
  readonly group: readonly [number, number];
  readonly biomes?: readonly { readonly biome: string; readonly weight: number }[];
  /** The seasons a surface species is on the map in; absent means every season. */
  readonly season?: readonly number[];
  readonly cavern?: { readonly tier: number; readonly weight: number; readonly cap: number; readonly initial: number; readonly respawnPermille: number };
  readonly breeding?: SpeciesBreeding;
  readonly flags: Readonly<Record<string, unknown>>;
  readonly factionDefault: string;
  readonly perception?: number;
  readonly glyph: string;
  readonly fg: string;
}

export class AnimalFacts {
  private readonly rows: (SpeciesRow | undefined)[] = [];
  private readonly index = new Map<string, number>();
  readonly size: number;

  constructor(registry: Registry) {
    const table = registry.table<SpeciesRow>('creatures');
    this.size = table.size;
    for (let s = 1; s <= table.size; s += 1) {
      const row = table.byIndex(s) as SpeciesRow;
      this.rows[s] = row;
      this.index.set(row.id, s);
    }
  }

  row(species: number): SpeciesRow | undefined {
    return this.rows[species];
  }

  indexOf(id: string): number {
    return this.index.get(id) ?? 0;
  }

  idOf(species: number): string {
    return this.rows[species]?.id ?? '';
  }

  perceptionOf(species: number): number {
    return this.rows[species]?.perception ?? DEFAULT_PERCEPTION;
  }

  dietOf(species: number): Diet {
    return this.rows[species]?.diet ?? 'none';
  }

  temperOf(species: number): Temperament {
    return this.rows[species]?.temper ?? 'timid';
  }

  isNocturnal(species: number): boolean {
    return this.rows[species]?.nocturnal === true;
  }

  sizeOf(species: number): number {
    return this.rows[species]?.size ?? 0;
  }

  /** `creatures.md`: `cap = weight / 5`, rounded up, minimum 2. */
  baseCap(weight: number): number {
    return Math.max(CAP_MIN, Math.ceil(weight / CAP_PER_WEIGHT));
  }

  /** The wild surface species of a biome in a season, `[species, weight]`, ascending species. */
  surfaceSpecies(biome: string, season: number): (readonly [number, number])[] {
    const out: (readonly [number, number])[] = [];
    for (let s = 1; s <= this.size; s += 1) {
      const row = this.rows[s] as SpeciesRow;
      if (row.factionDefault !== 'wild' || row.cavern !== undefined) continue;
      const weight = row.biomes?.reduce((acc, b) => (b.biome === biome ? acc + b.weight : acc), 0) ?? 0;
      if (weight <= 0) continue;
      if (row.season !== undefined && !row.season.includes(season)) continue;
      out.push([s, weight]);
    }
    return out;
  }

  /** The cavern fauna of a tier, `[species, weight]`, ascending species. */
  cavernSpecies(tier: number): (readonly [number, number])[] {
    const out: (readonly [number, number])[] = [];
    for (let s = 1; s <= this.size; s += 1) {
      const row = this.rows[s] as SpeciesRow;
      if (row.factionDefault !== 'wild' || row.cavern === undefined || row.cavern.tier !== tier) continue;
      if (row.movementClass === 'aquatic') continue;
      if (row.cavern.weight <= 0) continue;
      out.push([s, row.cavern.weight]);
    }
    return out;
  }
}
