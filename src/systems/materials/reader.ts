/**
 * `readers.of('05')`: `02-systems/05-materials-and-temperature.md` § Interfaces › Reader.
 */

import type { TileIndex } from '@core/types';

export interface OreYield {
  readonly metal: number;
  readonly count: number;
}

export interface AlloyInput {
  readonly material: number;
  readonly count: number;
}

export type MaterialProperty = 'value' | 'density' | 'hardness' | 'sharpness' | 'meltsAtC' | 'burnable' | 'burnTicks' | 'magmaSafe' | 'color';

export interface MaterialsReader {
  temperatureAt(i: TileIndex): number;
  /** The surface temperature this system is using (06's, or D-093's fallback). */
  surfaceTempC(): number;
  isBurning(i: TileIndex): boolean;
  /** Burning tiles, ascending. */
  burningTiles(): TileIndex[];
  /** The tile can catch fire (`05` § Fire, Burnable tiles). */
  burnableTile(i: TileIndex): boolean;
  propertyOf(material: number, property: MaterialProperty): number | boolean | string | undefined;
  hardness(material: number): number;
  meltsAt(material: number): number;
  burnable(material: number): boolean;
  value(material: number): number;
  classOf(material: number): string;
  /** `meltsAtC > MAGMA_C`. */
  isMagmaSafe(material: number): boolean;
  yieldsOf(ore: number): readonly OreYield[];
  alloyInputs(metal: number): readonly AlloyInput[];
  /** A `gemsprings` warm spring tile (`05` § Warm springs). */
  isWarmSpring(i: TileIndex): boolean;
}
