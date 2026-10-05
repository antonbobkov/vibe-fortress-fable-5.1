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
  dwarf_wounded: '#FF77CC',
  dwarf_soldier: '#00A2FF',
  hostile: '#E65100',
  hostile_bright: '#FFB74D',
  alert: '#FFB000',
  danger: '#FF7F00',
  text_good: '#00A2FF',
  text_bad: '#FF7F00',
  text_key: '#FFFF55',
  ghost_ok: '#2B558C',
  ghost_bad: '#8C4E2B',
  trader_wildwood: '#00C8FF',
  wyrm_red: '#E64500',
  grass_green: '#3A7A9C',
  water_1: '#68D0FF',
  water_2: '#1890E8',
  water_3: '#0058B8',
  water_7: '#002878',
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
  ['hostile', 'dwarf_wounded'],
  ['text_key', 'alert'],
  ['trader_mountainhome', 'trader_hillfolk'],
  ['trader_mountainhome', 'trader_wildwood'],
  ['trader_hillfolk', 'trader_wildwood'],
]);

export interface Lab {
  readonly L: number;
  readonly a: number;
  readonly b: number;
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function fLab(t: number): number {
  return t > 0.0088564516790356308 ? Math.cbrt(t) : t * (841 / 108) + 4 / 29;
}

/** Convert sRGB color (`0xRRGGBB`) to CIELAB under D65 standard illuminant. */
export function rgbToLab(color: Rgb): Lab {
  const rLin = srgbToLinear((color >> 16) & 0xff);
  const gLin = srgbToLinear((color >> 8) & 0xff);
  const bLin = srgbToLinear(color & 0xff);

  // Standard sRGB to XYZ (D65 illuminant, 2° observer) normalized by D65 reference white
  // Xn = 0.95047, Yn = 1.00000, Zn = 1.08883
  const x = (rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375) / 0.95047;
  const y = (rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.0721750) / 1.00000;
  const z = (rLin * 0.0193339 + gLin * 0.1191920 + bLin * 0.9503041) / 1.08883;

  const fx = fLab(x);
  const fy = fLab(y);
  const fz = fLab(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * CIEDE2000 color difference formula (CIE Publication 142-2001).
 * Calculates the perceptual color distance ΔE between two CIELAB colors.
 */
export function ciede2000Lab(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625))); // 25^7 = 6103515625

  const a1Prime = a1 * (1 + G);
  const a2Prime = a2 * (1 + G);

  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);

  const radToDeg = 180 / Math.PI;
  const degToRad = Math.PI / 180;

  function hueDeg(aP: number, bVal: number): number {
    if (aP === 0 && bVal === 0) return 0;
    let deg = Math.atan2(bVal, aP) * radToDeg;
    if (deg < 0) deg += 360;
    return deg;
  }

  const h1Prime = hueDeg(a1Prime, b1);
  const h2Prime = hueDeg(a2Prime, b2);

  const deltaLPrime = L2 - L1;
  const deltaCPrime = C2Prime - C1Prime;

  let deltahPrime = 0;
  if (C1Prime * C2Prime !== 0) {
    const diff = h2Prime - h1Prime;
    if (Math.abs(diff) <= 180) {
      deltahPrime = diff;
    } else if (diff > 180) {
      deltahPrime = diff - 360;
    } else {
      deltahPrime = diff + 360;
    }
  }

  const deltaHPrime = 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin((deltahPrime / 2) * degToRad);

  const LbarPrime = (L1 + L2) / 2;
  const CbarPrime = (C1Prime + C2Prime) / 2;

  let HbarPrime = 0;
  if (C1Prime * C2Prime === 0) {
    HbarPrime = h1Prime + h2Prime;
  } else {
    const diff = Math.abs(h1Prime - h2Prime);
    if (diff <= 180) {
      HbarPrime = (h1Prime + h2Prime) / 2;
    } else if (h1Prime + h2Prime < 360) {
      HbarPrime = (h1Prime + h2Prime + 360) / 2;
    } else {
      HbarPrime = (h1Prime + h2Prime - 360) / 2;
    }
  }

  const T =
    1 -
    0.17 * Math.cos((HbarPrime - 30) * degToRad) +
    0.24 * Math.cos(2 * HbarPrime * degToRad) +
    0.32 * Math.cos((3 * HbarPrime + 6) * degToRad) -
    0.20 * Math.cos((4 * HbarPrime - 63) * degToRad);

  const deltaTheta = 30 * Math.exp(-Math.pow((HbarPrime - 275) / 25, 2));

  const CbarPrime7 = Math.pow(CbarPrime, 7);
  const RC = 2 * Math.sqrt(CbarPrime7 / (CbarPrime7 + 6103515625));

  const LbarMinus50Sq = Math.pow(LbarPrime - 50, 2);
  const SL = 1 + (0.015 * LbarMinus50Sq) / Math.sqrt(20 + LbarMinus50Sq);
  const SC = 1 + 0.045 * CbarPrime;
  const SH = 1 + 0.015 * CbarPrime * T;

  const RT = -Math.sin(2 * deltaTheta * degToRad) * RC;

  const dL = deltaLPrime / SL;
  const dC = deltaCPrime / SC;
  const dH = deltaHPrime / SH;

  return Math.sqrt(dL * dL + dC * dC + dH * dH + RT * dC * dH);
}

/** Compute CIEDE2000 perceptual distance ΔE between two RGB colors (`0xRRGGBB`). */
export function ciede2000(c1: Rgb, c2: Rgb): number {
  return ciede2000Lab(rgbToLab(c1), rgbToLab(c2));
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
