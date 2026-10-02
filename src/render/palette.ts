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

/**
 * State and UI color ids of `03-content/glyphs-and-colors.md` § State and UI colors.
 */
export const STATE_COLORS: readonly string[] = Object.freeze([
  'dwarf_normal',
  'dwarf_need',
  'dwarf_wounded',
  'dwarf_asleep',
  'dwarf_child',
  'dwarf_soldier',
  'hostile',
  'hostile_bright',
  'undead_gray',
  'hollow_violet',
  'wyrm_red',
  'trader_mountainhome',
  'trader_hillfolk',
  'trader_wildwood',
  'undiscovered',
  'sky_day',
  'sky_night',
  'abyss',
  'panel_bg',
  'panel_border',
  'text',
  'text_dim',
  'text_key',
  'text_value',
  'text_good',
  'text_bad',
  'note',
  'alert',
  'danger',
  'ghost_ok',
  'ghost_bad',
  'lever_gray',
  'trap_gray',
  'well_blue',
  'hearth_orange',
  'grass_green',
  'water_1',
  'water_2',
  'water_3',
  'water_7',
]);

/**
 * Colorblind-safe alternative palette mappings (23 § Palette: "swaps the reds and greens
 * used for state to blue/orange pairs"). Supplements any row without an authored alt.
 */
export const COLORBLIND_ALTERNATES: Readonly<Record<string, string>> = Object.freeze({
  dwarf_need: '#FFB000',
  dwarf_wounded: '#FF7F00',
  dwarf_soldier: '#00A2FF',
  hostile: '#FF8C00',
  hostile_bright: '#FFB347',
  alert: '#FFB000',
  danger: '#FF7F00',
  text_good: '#00A2FF',
  text_bad: '#FF7F00',
  text_key: '#FFB000',
  ghost_ok: '#1E3A5F',
  ghost_bad: '#5F351E',
  trader_wildwood: '#00C8FF',
  wyrm_red: '#E64500',
  grass_green: '#3A7A9C',
  water_1: '#40B0FF',
  water_2: '#2090E0',
  water_3: '#1070C0',
  water_7: '#0050A0',
});

/**
 * State colors used side by side or representing opposing/paired states.
 * T-M8-07 asserts that no two state colors in each pair or group are identical in either palette.
 */
export const SIDE_BY_SIDE_STATE_PAIRS: readonly (readonly [string, string])[] = Object.freeze([
  ['text_good', 'text_bad'],
  ['ghost_ok', 'ghost_bad'],
  ['note', 'alert'],
  ['alert', 'danger'],
  ['note', 'danger'],
  ['dwarf_normal', 'dwarf_need'],
  ['dwarf_normal', 'dwarf_wounded'],
  ['dwarf_normal', 'dwarf_soldier'],
  ['dwarf_normal', 'dwarf_asleep'],
  ['dwarf_normal', 'dwarf_child'],
  ['dwarf_need', 'dwarf_wounded'],
  ['dwarf_need', 'dwarf_soldier'],
  ['dwarf_wounded', 'dwarf_soldier'],
  ['dwarf_soldier', 'hostile'],
  ['dwarf_normal', 'hostile'],
  ['hostile', 'hostile_bright'],
  ['water_1', 'water_2'],
  ['water_2', 'water_3'],
  ['water_3', 'water_7'],
  ['water_7', 'magma_7'],
  ['trader_mountainhome', 'trader_hillfolk'],
  ['trader_mountainhome', 'trader_wildwood'],
  ['trader_hillfolk', 'trader_wildwood'],
]);

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
      const alt = row.alt ?? COLORBLIND_ALTERNATES[id];
      const hex = this.colorblind && alt !== undefined ? alt : row.hex;
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
