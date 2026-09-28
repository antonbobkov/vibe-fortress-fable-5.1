/**
 * The palette.
 *
 * Implements `02-systems/23-rendering.md` § Palette over the `palette` table of
 * `03-content/glyphs-and-colors.md`: named colors (base 16, state and UI, fluid ramps,
 * designation and zone tints, material and nature colors), the colorblind alternates, and
 * `dim(color, level)` = each channel × `DIM_FACTOR^level`, "computed once per color and cached".
 *
 * A color is carried as a 24-bit `0xRRGGBB` number so that it is a cheap cache key for the atlas
 * and the dim cache; `hex()` turns one into the `#rrggbb` string the canvas wants, also cached.
 */

import type { Registry } from '@core/registry';
import { DIM_FACTOR } from './constants';

/** A color as `0xRRGGBB`. */
export type Rgb = number;

/** One row of the `palette` table. */
interface PaletteRow {
  readonly id: string;
  readonly hex: string;
  readonly alt?: string;
}

export interface PaletteOptions {
  /**
   * `23` § Palette: "A colorblind-safe alternative palette swaps the reds and greens used for
   * state to blue/orange pairs"; those are the rows with an `alt` column.
   */
  readonly colorblind?: boolean;
}

/** Parse `#RRGGBB` into `0xRRGGBB`. */
export function parseHex(hex: string): Rgb {
  const text = hex.startsWith('#') ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(text)) throw new RangeError(`palette: not a #RRGGBB color: "${hex}"`);
  return Number.parseInt(text, 16);
}

/** Render `0xRRGGBB` as `#rrggbb`. */
export function toHex(color: Rgb): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

export function red(color: Rgb): number {
  return (color >> 16) & 0xff;
}

export function green(color: Rgb): number {
  return (color >> 8) & 0xff;
}

export function blue(color: Rgb): number {
  return color & 0xff;
}

export function rgb(r: number, g: number, b: number): Rgb {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

/**
 * Blend `tint` over `base` at `alpha` (0..1). Used by the zone overlay's `ZONE_TINT_ALPHA`
 * backgrounds (23 § Compositor step 8).
 */
export function blend(base: Rgb, tint: Rgb, alpha: number): Rgb {
  const mix = (a: number, b: number): number => Math.floor(a + (b - a) * alpha);
  return rgb(mix(red(base), red(tint)), mix(green(base), green(tint)), mix(blue(base), blue(tint)));
}

export class Palette {
  private readonly colors = new Map<string, Rgb>();
  private readonly dimCache = new Map<number, Rgb>();
  private readonly hexCache = new Map<Rgb, string>();
  colorblind: boolean;

  constructor(private readonly registry: Registry, options: PaletteOptions = {}) {
    this.colorblind = options.colorblind === true;
    this.loadColors();
  }

  setColorblind(on: boolean): void {
    if (on === this.colorblind) return;
    this.colorblind = on;
    this.colors.clear();
    this.dimCache.clear();
    this.loadColors();
  }

  private loadColors(): void {
    const table = this.registry.table<PaletteRow>('palette');
    for (const id of table.ids()) {
      const row = table.byId(id) as PaletteRow;
      const hex = this.colorblind && row.alt !== undefined ? row.alt : row.hex;
      // `cursor` is documented as "inverted": it is a rule, not a color, and the compositor
      // swaps fg and bg for it (23 § Compositor step 10). It carries no parsable hex.
      if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) continue;
      this.colors.set(id, parseHex(hex));
    }
  }

  has(id: string): boolean {
    return this.colors.has(id);
  }

  /** The named color; throws for an id the table does not carry. */
  color(id: string): Rgb {
    const found = this.colors.get(id);
    if (found === undefined) throw new RangeError(`palette: no color "${id}"`);
    return found;
  }

  /** Every color id, sorted, for the legend panel and the tests. */
  ids(): readonly string[] {
    return Array.from(this.colors.keys()).sort();
  }

  /**
   * `dim(color, level)`: each channel × `DIM_FACTOR^level`, truncated (the project's rounding
   * convention, DECISIONS.md D-006), cached per `(color, level)`.
   */
  dim(color: Rgb, level: number): Rgb {
    if (level <= 0) return color;
    const key = (color & 0xffffff) * 8 + Math.min(level, 7);
    const cached = this.dimCache.get(key);
    if (cached !== undefined) return cached;
    const factor = DIM_FACTOR ** level;
    const value = rgb(
      Math.floor(red(color) * factor),
      Math.floor(green(color) * factor),
      Math.floor(blue(color) * factor),
    );
    this.dimCache.set(key, value);
    return value;
  }

  /** `#rrggbb`, cached, because it is written to `fillStyle` on every run of every frame. */
  hex(color: Rgb): string {
    const cached = this.hexCache.get(color);
    if (cached !== undefined) return cached;
    const text = toHex(color);
    this.hexCache.set(color, text);
    return text;
  }

  /** Number of entries in the dim cache; the test that pins "cached" reads it. */
  get dimCacheSize(): number {
    return this.dimCache.size;
  }
}
