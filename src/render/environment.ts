/**
 * The M3 layers of the compositor: `02-systems/23-rendering.md` § Compositor steps 3 (fluids, mist)
 * and 9 (lighting), the `fluid levels` and `temperature` overlays of step 8, § Animation (active
 * fluid shimmer, fire, rain and snow particles), and `algorithms/compositor.md` `fluidOver` and
 * `lighting`, over `glyphs-and-colors.md` § Fluid ramps. DECISIONS.md D-103.
 */

import { FLUID_MAX_LEVEL } from '@core/constants';
import { FLUID_FROZEN_BIT, FLUID_LEVEL_MASK, FLUID_TYPE_BIT, TileFlag, TileKind } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { TileIndex } from '@core/types';
import type { Cell } from './cellbuffer';
import { GLYPH_DIGIT_0 } from './glyphs';
import { blend, type Palette, type Rgb } from './palette';

/** The overlay ids 04 and 05 register (`fluid levels`, `temperature`). */
export const OVERLAY_FLUID_LEVELS = 'fluid_levels';
export const OVERLAY_TEMPERATURE = 'temperature';

/** `~` for levels 1–2, `≈` for 3–7 (CP437 126 and 247). */
export const GLYPH_WATER_LOW = 126;
export const GLYPH_WATER_HIGH = 247;
/** Fire alternates `^` and `‼` (CP437 94 and 19). */
export const GLYPH_FIRE_A = 94;
export const GLYPH_FIRE_B = 19;
/** Rain draws `'`, snow `*` (CP437 39 and 42). */
export const GLYPH_RAIN = 39;
export const GLYPH_SNOW = 42;

/** The temperature overlay's ramp: blue at or below the first, red at or above the second (D-103). */
export const TEMPERATURE_RAMP_COLD_C = -20;
export const TEMPERATURE_RAMP_HOT_C = 40;

/** One outdoor open cell in `PARTICLE_ONE_IN` carries a rain or snow particle each frame (D-103). */
export const PARTICLE_ONE_IN = 16;

interface FluidsLike {
  isMisty(i: TileIndex): boolean;
  isActive?(i: TileIndex): boolean;
}

interface MaterialsLike {
  isBurning(i: TileIndex): boolean;
  temperatureAt(i: TileIndex): number;
}

/** The fluid ramp band of a level: 1–2, 3–4, 5–6, 7. */
export function levelBand(level: number): number {
  if (level >= FLUID_MAX_LEVEL) return 3;
  return Math.min(2, Math.floor((level - 1) / 2));
}

export class EnvironmentLayers {
  private readonly water: readonly Rgb[];
  private readonly magma: readonly Rgb[];
  private readonly waterBg: Rgb;
  private readonly waterFullBg: Rgb;
  private readonly magmaBg: Rgb;
  private readonly magmaFullBg: Rgb;
  private readonly mistBg: Rgb;
  private readonly fireA: Rgb;
  private readonly fireB: Rgb;
  private readonly rain: Rgb;
  private readonly snow: Rgb;
  private readonly digit: Rgb;
  private readonly cold: Rgb;
  private readonly hot: Rgb;

  private readers: ReaderSet | null = null;
  private fluids: FluidsLike | null = null;
  private materials: MaterialsLike | null = null;
  private weather: string | null = null;
  private daylight = true;
  private frame = 0;
  /** The `FLUID_ANIM_MS` phase (0 or 1). */
  fastPhase = 0;
  /** The 1000 ms phase (0 or 1): fire, blink, the hearth pulse. */
  slowPhase = 0;

  constructor(palette: Palette, _glyphOf: (ch: string) => number) {
    const c = (id: string): Rgb => palette.color(id);
    this.water = [c('water_1'), c('water_2'), c('water_3'), c('water_7')];
    this.magma = [c('magma_1'), c('magma_2'), c('magma_3'), c('magma_7')];
    this.waterBg = c('water_bg');
    this.waterFullBg = c('blue');
    this.magmaBg = c('magma_bg');
    this.magmaFullBg = c('dark_red');
    this.mistBg = c('mist_bg');
    this.fireA = c('yellow');
    this.fireB = c('red');
    this.rain = c('water_1');
    this.snow = c('white');
    this.digit = c('white');
    this.cold = c('blue');
    this.hot = c('red');
  }

  /** Read the frame's readers once: 04, 05, 06 when present, the daylight and the phases. */
  beginFrame(readers: ReaderSet, animFrame: number): void {
    this.readers = readers;
    this.fluids = readers.has('04') ? readers.of<FluidsLike>('04') : null;
    this.materials = readers.has('05') ? readers.of<MaterialsLike>('05') : null;
    this.weather = readers.has('06') ? readers.of<{ state(): string }>('06').state() : null;
    this.daylight = readers.calendar.isDaylight;
    this.frame = animFrame;
    this.fastPhase = animFrame & 1;
    this.slowPhase = (animFrame >> 1) & 1;
  }

  /**
   * Step 3: water `~` (1–2) or `≈` (3–7) in the ramp colour of its band on `water_bg` (level 7 on
   * `blue`); magma the same on `magma_bg` (7: `dark_red`); an active tile swaps the two glyphs on
   * odd phases; frozen water is ice, drawn by step 2. Mist gives `mist_bg`; a burning tile
   * alternates `^` yellow and `‼` red.
   */
  fluidOver(cell: Cell, i: TileIndex): Cell {
    const readers = this.readers;
    if (readers === null) return cell;
    let c = cell;
    const f = readers.map.fluidAt(i);
    const level = f & FLUID_LEVEL_MASK;
    if (level > 0 && (f & FLUID_FROZEN_BIT) === 0) {
      const magma = (f & FLUID_TYPE_BIT) !== 0;
      let glyph = level <= 2 ? GLYPH_WATER_LOW : GLYPH_WATER_HIGH;
      if (this.fastPhase === 1 && this.fluids?.isActive?.(i) === true) glyph = glyph === GLYPH_WATER_LOW ? GLYPH_WATER_HIGH : GLYPH_WATER_LOW;
      const band = levelBand(level);
      const full = level >= FLUID_MAX_LEVEL;
      const fg = (magma ? this.magma : this.water)[band] as Rgb;
      const bg = magma ? (full ? this.magmaFullBg : this.magmaBg) : full ? this.waterFullBg : this.waterBg;
      c = { glyph, fg, bg };
    }
    if (this.fluids?.isMisty(i) === true) c = { glyph: c.glyph, fg: c.fg, bg: this.mistBg };
    if (this.materials?.isBurning(i) === true || (readers.map.flagsAt(i) & TileFlag.Burning) !== 0) {
      c = this.slowPhase === 0 ? { glyph: GLYPH_FIRE_A, fg: this.fireA, bg: c.bg } : { glyph: GLYPH_FIRE_B, fg: this.fireB, bg: c.bg };
    }
    return c;
  }

  /**
   * § Animation: "Rain draws `'` on a few random outdoor cells per frame; snow draws `*`": on an
   * outdoor `open` tile with no creature, one cell in `PARTICLE_ONE_IN`, chosen by a hash of the
   * cell and the frame (presentation only, so a golden stays reproducible).
   */
  particleOver(cell: Cell, i: TileIndex, x: number, y: number): Cell {
    const readers = this.readers;
    const w = this.weather;
    if (readers === null || (w !== 'rain' && w !== 'storm' && w !== 'snow')) return cell;
    if (readers.map.kindAt(i) !== TileKind.Open || !readers.map.isOutdoor(i)) return cell;
    let h = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul(this.frame + 1, 83492791);
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    if (((h >>> 0) % PARTICLE_ONE_IN) !== 0) return cell;
    return w === 'snow' ? { glyph: GLYPH_SNOW, fg: this.snow, bg: cell.bg } : { glyph: GLYPH_RAIN, fg: this.rain, bg: cell.bg };
  }

  /** `fluid levels`: the level digit over a fluid tile, never over a creature. */
  fluidLevelsOver(cell: Cell, i: TileIndex, creature: boolean): Cell {
    const readers = this.readers;
    if (readers === null || creature) return cell;
    const f = readers.map.fluidAt(i);
    const level = f & FLUID_LEVEL_MASK;
    if (level === 0 || (f & FLUID_FROZEN_BIT) !== 0) return cell;
    return { glyph: GLYPH_DIGIT_0 + level, fg: this.digit, bg: cell.bg };
  }

  /** `temperature`: the `bg` from blue to red over `TEMPERATURE_RAMP_COLD_C` … `TEMPERATURE_RAMP_HOT_C`. */
  temperatureOver(cell: Cell, i: TileIndex): Cell {
    const m = this.materials;
    if (m === null) return cell;
    const t = m.temperatureAt(i);
    const span = TEMPERATURE_RAMP_HOT_C - TEMPERATURE_RAMP_COLD_C;
    const a = Math.max(0, Math.min(1, (t - TEMPERATURE_RAMP_COLD_C) / span));
    return { glyph: cell.glyph, fg: cell.fg, bg: blend(this.cold, this.hot, a) };
  }

  /**
   * Step 9: outdoor tiles at night are dimmed one step (two under storm); fog dims the surface one
   * step; underground tiles are not dimmed.
   */
  dimSteps(i: TileIndex): number {
    const readers = this.readers;
    if (readers === null || !readers.map.isOutdoor(i)) return 0;
    let k = 0;
    if (!this.daylight) k += this.weather === 'storm' ? 2 : 1;
    if (this.weather === 'fog') k += 1;
    return k;
  }
}
