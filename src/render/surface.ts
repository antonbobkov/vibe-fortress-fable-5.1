/**
 * Surface variety: `02-systems/23-rendering.md` § Compositor step 2 (natural outdoor surfaces),
 * over the biome's row of `03-content/regions-biomes-and-traits.md` § Biome surface.
 *
 * Presentation only. Every choice is a pure function of the tile's position: a per-tile hash picks
 * glyph variants, flowers and plant shades, and a low-frequency patch field groups the tints, so a
 * meadow drifts between greens in patches rather than flickering tile by tile. The colours are a
 * small fixed set per biome (blends at two strengths), so the atlas keeps few colour sheets.
 */

import { FIXED_SCALE, type Fixed } from '@core/fixed';
import { hashInts, valueNoise2 } from '@core/noise';
import type { Registry } from '@core/registry';
import type { Cell } from './cellbuffer';
import {
  GLYPH_FLOWER,
  GLYPH_GRASS,
  GLYPH_GRASS_SHORT,
  GLYPH_GRASS_TUFT,
  GLYPH_PEBBLE,
  GLYPH_ROUGH_FLOOR,
  GLYPH_STONE,
} from './glyphs';
import { blend, brighten, type Palette, type Rgb } from './palette';
import {
  GRASS_TINT_ALPHA,
  HILL_BG_ALPHA,
  HILL_SOIL_TONE,
  PLANT_SHADE_DARK,
  PLANT_SHADE_LIGHT,
  ROCK_TINT_ALPHA,
  ROCK_TINT_FROM,
  SURFACE_PATCH_PERIOD,
} from './constants';

/** Salts of the per-tile hash and the patch field (presentation only). */
const SALT_TILE = 0x5f3759df;
const SALT_PATCH = 0x2c1b3c6d;

interface SurfaceRow {
  readonly id: string;
  readonly soil?: readonly { readonly material: string; readonly weight: number }[];
  readonly surface?: {
    readonly grassTints: readonly string[];
    readonly flowers: Fixed;
    readonly flowerColors: readonly string[];
    readonly rockTints: readonly string[];
  };
}

interface Look {
  readonly grassTints: readonly Rgb[];
  readonly flowers: Fixed;
  readonly flowerColors: readonly Rgb[];
  readonly rockTints: readonly Rgb[];
}

const NO_LOOK: Look = { grassTints: [], flowers: 0, flowerColors: [], rockTints: [] };

export class SurfaceVariety {
  private readonly looks = new Map<string, Look>();
  private look: Look = NO_LOOK;
  private readonly blends = new Map<string, Rgb>();
  private readonly black: Rgb;

  constructor(registry: Registry, palette: Palette) {
    this.black = palette.color('black');
    this.defaultTone = palette.color(HILL_SOIL_TONE);
    this.soilTone = this.defaultTone;
    const biomes = registry.table<SurfaceRow>('biomes');
    const materials = registry.table<{ id: string; color: string }>('materials');
    const color = (id: string): Rgb | null => (palette.has(id) ? palette.color(id) : null);
    const colors = (ids: readonly string[] | undefined): Rgb[] => (ids ?? []).map(color).filter((c): c is Rgb => c !== null);
    for (const id of biomes.ids()) {
      const s = biomes.byId(id)?.surface;
      this.looks.set(id, {
        grassTints: colors(s?.grassTints),
        flowers: s?.flowers ?? 0,
        flowerColors: colors(s?.flowerColors),
        rockTints: colors(s?.rockTints),
      });
      const soil = [...(biomes.byId(id)?.soil ?? [])].sort((a, b) => b.weight - a.weight)[0];
      const soilColor = soil === undefined ? undefined : materials.byId(soil.material)?.color;
      if (soilColor !== undefined && palette.has(soilColor)) this.tones.set(id, palette.color(soilColor));
    }
  }

  /** The biome of the map in view (null: no variety but the plant shades). */
  setBiome(biome: string | null): void {
    this.look = biome === null ? NO_LOOK : (this.looks.get(biome) ?? NO_LOOK);
    this.soilTone = biome === null ? this.defaultTone : (this.tones.get(biome) ?? this.defaultTone);
  }

  /** The tone of higher ground of soil: the colour of the biome's commonest soil. */
  soilTone: Rgb;
  private readonly tones = new Map<string, Rgb>();
  private readonly defaultTone: Rgb;

  private mix(base: Rgb, tint: Rgb, alpha: number): Rgb {
    const key = `${base}:${tint}:${alpha}`;
    let c = this.blends.get(key);
    if (c === undefined) {
      c = blend(base, tint, alpha);
      this.blends.set(key, c);
    }
    return c;
  }

  private tileHash(x: number, y: number, z: number): number {
    return hashInts(SALT_TILE, x, y, z);
  }

  /** The patch field at a column: `Fixed` 0 … 1000. */
  private patch(x: number, y: number): number {
    return valueNoise2(SALT_PATCH, x, y, SURFACE_PATCH_PERIOD, 1);
  }

  /**
   * Outdoor grass: the glyph varies (`"` mostly, `'` and `` ` ``); the colour leans toward one of
   * the biome's grass tints by patch, at half or full `GRASS_TINT_ALPHA`; a `flowers` share of the
   * tiles is a flower `*` in one of the biome's flower colours.
   */
  grass(base: Rgb, x: number, y: number, z: number): Cell {
    const h = this.tileHash(x, y, z);
    const look = this.look;
    if (look.flowers > 0 && look.flowerColors.length > 0 && (h >>> 8) % FIXED_SCALE < look.flowers) {
      return { glyph: GLYPH_FLOWER, fg: look.flowerColors[(h >>> 20) % look.flowerColors.length] as Rgb, bg: this.black };
    }
    const g = h % 8;
    const glyph = g < 5 ? GLYPH_GRASS : g < 7 ? GLYPH_GRASS_SHORT : GLYPH_GRASS_TUFT;
    let fg = base;
    if (look.grassTints.length > 0) {
      const p = this.patch(x, y);
      const k = Math.min(look.grassTints.length - 1, Math.floor((p * look.grassTints.length) / FIXED_SCALE));
      const strength = (h >>> 4) % 3;
      if (strength > 0) fg = this.mix(base, look.grassTints[k] as Rgb, (GRASS_TINT_ALPHA * strength) / 2);
    }
    return { glyph, fg, bg: this.black };
  }

  /**
   * An outdoor bare floor of natural rock or soil: loose stones and pebbles (`∙`, `·`) among the
   * plain `.`; rock in a patch above `ROCK_TINT_FROM` leans toward the biome's lichen or moss.
   */
  bareFloor(material: Rgb, rock: boolean, x: number, y: number, z: number): Cell {
    const h = this.tileHash(x, y, z);
    const g = h % 10;
    const glyph = g < 6 ? GLYPH_ROUGH_FLOOR : g < 9 ? GLYPH_PEBBLE : GLYPH_STONE;
    let fg = material;
    const tints = this.look.rockTints;
    if (rock && tints.length > 0) {
      const p = this.patch(x, y);
      if (p >= ROCK_TINT_FROM) {
        const tint = tints[(h >>> 12) % tints.length] as Rgb;
        fg = this.mix(material, tint, (h >>> 5) % 2 === 0 ? ROCK_TINT_ALPHA : ROCK_TINT_ALPHA / 2);
      }
    } else if ((h >>> 5) % 4 === 0) {
      fg = this.mix(material, this.black, PLANT_SHADE_DARK / 2);
    }
    return { glyph, fg, bg: this.black };
  }

  /** The background of ground `levels` up: the surface's own leaning toward the ground's tone, more for each level. */
  hillBg(surfaceBg: Rgb, tone: Rgb, levels: number): Rgb {
    return this.mix(surfaceBg, tone, HILL_BG_ALPHA * (1 + (levels - 1) / 4));
  }

  /** A tree's or shrub's shade: its species colour, a lighter one or a darker one, by tile. */
  plantShade(color: Rgb, x: number, y: number, z: number): Rgb {
    const s = (this.tileHash(x, y, z) >>> 7) % 4;
    if (s === 1) return this.lighter(color);
    if (s === 2) return this.mix(color, this.black, PLANT_SHADE_DARK);
    return color;
  }

  private lighter(color: Rgb): Rgb {
    const key = `light:${color}`;
    let c = this.blends.get(key);
    if (c === undefined) {
      c = brighten(color, PLANT_SHADE_LIGHT);
      this.blends.set(key, c);
    }
    return c;
  }
}
