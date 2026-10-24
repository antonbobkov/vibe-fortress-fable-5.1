/**
 * The deep intro (`04-implementation/ui-screens/menus-and-world.md` § Intro, `03-content/deep-intro.md`):
 * big block art in which every art pixel is a cell (or a square of cells) holding a block or shade
 * glyph in two colours of the intro's own palette. Its scenes, layers, camera keys, effects and
 * captions are data; this module composes them on a letterboxed strip that fills the window.
 *
 * It shares the timeline, the motion of its layers and the screen with the hall intro
 * (`intro.ts`): a layer moves and changes frames as a hall cue does.
 */

import type { DeepIntroCameraDef, DeepIntroDef, DeepIntroEffectDef, DeepIntroLayerDef } from '@content/schema';
import { parseHex, type Rgb } from '@render/palette';
import { DEEP_INTRO_BLOCK_COLS, DEEP_INTRO_COURSE_ROWS, DEEP_INTRO_NOISE_MS, DEEP_INTRO_SHAKE_MS, DEEP_INTRO_STAGE_COLS, DEEP_INTRO_STAGE_ROWS } from '../constants';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { cueState, drawSkipLine, introTimeline, sceneAt, type IntroFilm } from './intro';

/** A hash of three integers to [0, 1): the static, the speckle and the shake, the same at the same moment every time. */
export function noise(x: number, y: number, t: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(t | 0, 1103515245)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** The 4×4 ordered-dither threshold of an art pixel, in (0, 1): the dithered fades and the flash. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
export function bayer(x: number, y: number): number {
  const i = (((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4);
  return ((BAYER[i] as number) + 0.5) / 16;
}

/** A colour of an ink: fixed, or a cycle's turn at a place and a time. */
type Paint = { readonly rgb: Rgb } | { readonly cycle: readonly Rgb[]; readonly step: number; readonly dx: number; readonly dy: number };

interface Ink {
  readonly glyph: string;
  readonly fg: Paint;
  readonly bg: Paint;
  readonly density: number | null;
}

interface Art {
  readonly rows: readonly (readonly string[])[];
  readonly width: number;
  readonly height: number;
}

/** The content made ready to draw: everything looked up once. */
interface Prepared {
  readonly inks: ReadonlyMap<string, Ink>;
  readonly art: ReadonlyMap<string, Art>;
  readonly parts: ReadonlyMap<string, readonly Ink[]>;
}

const prepared = new WeakMap<DeepIntroDef, Prepared>();

function prepare(deep: DeepIntroDef): Prepared {
  const known = prepared.get(deep);
  if (known !== undefined) return known;
  const colors = new Map(deep.colors.map((row) => [row.id, parseHex(row.hex)]));
  const paints = new Map<string, Paint>();
  for (const [id, rgb] of colors) paints.set(id, { rgb });
  for (const cycle of deep.cycles) {
    paints.set(cycle.id, { cycle: cycle.colors.map((id) => colors.get(id) ?? 0), step: cycle.step, dx: cycle.drift[0], dy: cycle.drift[1] });
  }
  const black: Paint = { rgb: 0 };
  const inks = new Map<string, Ink>(deep.inks.map((row) => [row.ink, {
    glyph: row.glyph,
    fg: paints.get(row.fg) ?? black,
    bg: paints.get(row.bg) ?? black,
    density: row.density ?? null,
  }]));
  const art = new Map<string, Art>(deep.art.map((piece) => {
    const rows = piece.rows.map((row) => Array.from(row));
    return [piece.id, { rows, width: Math.max(1, ...rows.map((row) => row.length)), height: Math.max(1, rows.length) }];
  }));
  const parts = new Map(deep.parts.map((row) => [row.part, row.inks.map((ink) => inks.get(ink)).filter((ink): ink is Ink => ink !== undefined)]));
  const out = { inks, art, parts };
  prepared.set(deep, out);
  return out;
}

function paint(p: Paint, x: number, y: number, ms: number): Rgb {
  if ('rgb' in p) return p.rgb;
  const n = p.cycle.length;
  const turn = Math.floor(ms / p.step) - p.dx * x - p.dy * y;
  return p.cycle[((turn % n) + n) % n] as Rgb;
}

/** Where the strip lies in a window: its scale (cells per art pixel) and its cells. */
export interface StripLayout {
  readonly scale: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The strip at the largest whole scale that fits the window with a row for the caption and one for
 * the skip line, centred.
 */
export function stripLayout(cols: number, rows: number): StripLayout {
  const scale = Math.max(1, Math.floor(Math.min(cols / DEEP_INTRO_STAGE_COLS, (rows - 2) / DEEP_INTRO_STAGE_ROWS)));
  const width = DEEP_INTRO_STAGE_COLS * scale;
  const height = DEEP_INTRO_STAGE_ROWS * scale;
  return { scale, width, height, left: Math.floor((cols - width) / 2), top: Math.max(0, Math.floor((rows - height - 2) / 2)) };
}

/** The camera of a scene at `local` ms: the art point at the strip's centre and the zoom. */
export function cameraAt(keys: readonly DeepIntroCameraDef[], local: number): { x: number; y: number; zoom: number } {
  const centre = { x: DEEP_INTRO_STAGE_COLS / 2, y: DEEP_INTRO_STAGE_ROWS / 2, zoom: 1 };
  if (keys.length === 0) return centre;
  let before: DeepIntroCameraDef | null = null;
  for (const key of keys) {
    if (key.at <= local) {
      before = key;
      continue;
    }
    if (before === null) return { x: key.x, y: key.y, zoom: key.zoom };
    if (key.move === 'cut') break;
    let p = (local - before.at) / Math.max(1, key.at - before.at);
    if (key.move === 'ease') p = p * p * (3 - 2 * p);
    return { x: before.x + (key.x - before.x) * p, y: before.y + (key.y - before.y) * p, zoom: before.zoom + (key.zoom - before.zoom) * p };
  }
  const last = before ?? (keys[0] as DeepIntroCameraDef);
  return { x: last.x, y: last.y, zoom: last.zoom };
}

/** How far an effect has run at `local` ms, from 0 to 1, or `null` outside it. */
function progress(effect: DeepIntroEffectDef, local: number): number | null {
  if (local < effect.from || local >= effect.until) return null;
  return (local - effect.from) / (effect.until - effect.from);
}

/**
 * The stone pillars beside the strip: courses `DEEP_INTRO_COURSE_ROWS` tall of blocks
 * `DEEP_INTRO_BLOCK_COLS` wide, each course set half a block along from the one under it. The
 * part's first ink is the stone, its second the mortar, and any others mark a few stones.
 */
function masonry(inks: readonly Ink[], x: number, y: number): Ink | null {
  const course = Math.floor(y / DEEP_INTRO_COURSE_ROWS);
  const shift = (((course % 2) + 2) % 2) * (DEEP_INTRO_BLOCK_COLS / 2);
  const along = (((x + shift) % DEEP_INTRO_BLOCK_COLS) + DEEP_INTRO_BLOCK_COLS) % DEEP_INTRO_BLOCK_COLS;
  const mortar = (((y % DEEP_INTRO_COURSE_ROWS) + DEEP_INTRO_COURSE_ROWS) % DEEP_INTRO_COURSE_ROWS) === DEEP_INTRO_COURSE_ROWS - 1 || along === DEEP_INTRO_BLOCK_COLS - 1;
  if (mortar) return inks[1] ?? inks[0] ?? null;
  const marks = inks.slice(2);
  if (marks.length > 0 && noise(x, y, 1) < 0.15) return marks[Math.floor(noise(x, y, 2) * marks.length)] as Ink;
  return inks[0] ?? null;
}

/** Whether a flash still covers an art pixel: solid for its first third, then scattered away pixel by pixel. */
function flashCovers(p: number, x: number, y: number): boolean {
  return p < 1 / 3 || noise(x, y, 7) >= (p - 1 / 3) * 1.5;
}

/** Draw the deep intro as it is `ms` after it began. */
export function deepIntroFrame(surface: Surface, deep: DeepIntroDef, strings: Strings, ms: number): void {
  const at = sceneAt(deep, ms);
  if (at === null) return;
  const { scene, local } = at;
  const ready = prepare(deep);
  const layout = stripLayout(surface.cols, surface.rows);
  const { scale: k, left, top, width, height } = layout;
  const sc = DEEP_INTRO_STAGE_COLS;
  const sr = DEEP_INTRO_STAGE_ROWS;
  const tick = Math.floor(local / DEEP_INTRO_NOISE_MS);

  const layers: { def: DeepIntroLayerDef; art: Art; x: number; y: number; seed: number }[] = [];
  deep.layers.forEach((def, n) => {
    if (def.scene !== scene.id) return;
    const state = cueState(def, local, scene.ms);
    if (state === null) return;
    const art = ready.art.get(def.sprite[state.frame] as string);
    if (art !== undefined) layers.push({ def, art, x: state.x, y: state.y, seed: n * 7919 });
  });
  const effects = deep.effects.filter((effect) => effect.scene === scene.id);
  const camera = cameraAt(deep.camera.filter((key) => key.scene === scene.id), local);

  // A shake moves the whole picture by up to its size in art pixels, less and less as it runs out.
  let shakeX = 0;
  let shakeY = 0;
  const jolt = Math.floor(local / DEEP_INTRO_SHAKE_MS);
  for (const effect of effects) {
    const p = effect.effect === 'shake' ? progress(effect, local) : null;
    if (p === null) continue;
    const size = (effect.value ?? 0) * (1 - p) * k;
    shakeX += Math.round((noise(jolt, 11, 3) * 2 - 1) * size);
    shakeY += Math.round((noise(jolt, 29, 5) * 2 - 1) * size);
  }

  const fill = ready.inks.get(scene.fill) ?? null;
  const part = (name: string): readonly Ink[] => ready.parts.get(name) ?? [];
  const staticInks = part('static');
  const fadeInk = part('fade')[0] ?? null;
  const flashInk = part('flash')[0] ?? null;
  const flashes = effects.filter((effect) => effect.effect === 'flash');

  const put = (col: number, row: number, ink: Ink, x: number, y: number): void => {
    surface.put(col, row, surface.glyphs.index(ink.glyph), paint(ink.fg, x, y, local), paint(ink.bg, x, y, local));
  };

  /** The ink of a strip cell, `px` and `py` in art pixels across the strip at zoom 1. */
  const inkAt = (px: number, py: number): Ink | null => {
    for (let n = layers.length - 1; n >= 0; n -= 1) {
      const layer = layers[n] as (typeof layers)[number];
      const depth = layer.def.depth;
      const wx = sc / 2 + (camera.x - sc / 2) * depth + (px - sc / 2) / camera.zoom;
      const wy = sr / 2 + (camera.y - sr / 2) * depth + (py - sr / 2) / camera.zoom;
      let lx = Math.floor(wx - layer.x);
      let ly = Math.floor(wy - layer.y);
      const tile = layer.def.tile;
      if (tile === 'x' || tile === 'xy') lx = ((lx % layer.art.width) + layer.art.width) % layer.art.width;
      if (tile === 'y' || tile === 'xy') ly = ((ly % layer.art.height) + layer.art.height) % layer.art.height;
      const ch = layer.art.rows[ly]?.[lx];
      if (ch === undefined || ch === ' ') continue;
      const ink = ready.inks.get(ch);
      if (ink === undefined) continue;
      if (ink.density !== null && noise(lx, ly, tick + layer.seed) * 100 >= ink.density) continue;
      return ink;
    }
    return fill;
  };

  // The strip, or the whole window for a wide scene.
  const c0 = scene.wide ? 0 : left;
  const r0 = scene.wide ? 0 : top;
  const c1 = scene.wide ? surface.cols : left + width;
  const r1 = scene.wide ? surface.rows : top + height;
  for (let row = r0; row < r1; row += 1) {
    for (let col = c0; col < c1; col += 1) {
      const px = (col - left - shakeX + 0.5) / k;
      const py = (row - top - shakeY + 0.5) / k;
      const x = Math.floor(px);
      const y = Math.floor(py);
      let ink = inkAt(px, py);
      for (const effect of effects) {
        const p = progress(effect, local);
        if (p === null) continue;
        if (effect.effect === 'static' && staticInks.length > 0 && noise(x, y, tick + 4099) < 1 - p) {
          ink = staticInks[Math.floor(noise(x, y, tick + 8191) * staticInks.length)] as Ink;
        } else if (effect.effect === 'fade_in' && bayer(x, y) >= p) ink = fadeInk;
        else if (effect.effect === 'fade_out' && bayer(x, y) < p) ink = fadeInk;
      }
      if (ink === null) continue;
      put(col, row, ink, x, y);
    }
  }

  // Round the strip: stone at the sides, its edge beside the strip, and black above and below.
  if (!scene.wide) {
    const side = part('side');
    const edge = part('edge')[0] ?? null;
    const bar = part('bar')[0] ?? null;
    for (let row = 0; row < surface.rows; row += 1) {
      for (let col = 0; col < surface.cols; col += 1) {
        const inStrip = col >= left && col < left + width;
        if (inStrip && row >= top && row < top + height) continue;
        const x = Math.floor((col - left) / k);
        const y = Math.floor((row - top) / k);
        let ink: Ink | null;
        if (inStrip) ink = bar;
        else if (x === -1 || x === sc) ink = edge;
        else ink = masonry(side, x, y);
        if (ink !== null) put(col, row, ink, x, y);
      }
    }
  }

  // A flash covers the whole window.
  if (flashInk !== null) {
    for (const effect of flashes) {
      const p = progress(effect, local);
      if (p === null) continue;
      for (let row = 0; row < surface.rows; row += 1) {
        for (let col = 0; col < surface.cols; col += 1) {
          const x = Math.floor((col - left) / k);
          const y = Math.floor((row - top) / k);
          if (flashCovers(p, x, y)) put(col, row, flashInk, x, y);
        }
      }
    }
  }

  // Captions: under the strip, or in a bar on it.
  const captionRow = top + height + 1;
  const white = surface.theme.text;
  const black = surface.theme.black;
  for (const caption of deep.captions) {
    if (caption.scene !== scene.id || local < caption.from || local >= caption.until) continue;
    const text = strings.get(`deep_intro.${caption.id}`);
    if (caption.at === undefined) {
      if (captionRow < surface.rows - 1) surface.text(Math.max(0, Math.floor((surface.cols - Array.from(text).length) / 2)), captionRow, text, white);
      continue;
    }
    const barText = `  ${text}  `;
    const row = top + caption.at * k + Math.floor(k / 2);
    surface.text(Math.max(0, left + Math.floor((width - Array.from(barText).length) / 2)), row, barText, white, black);
  }
  drawSkipLine(surface, strings, captionRow);
}

/** The deep intro of `deep-intro.md` as a film. */
export function deepFilm(deep: DeepIntroDef, strings: Strings): IntroFilm {
  return { total: introTimeline(deep).total, frame: (surface, ms) => deepIntroFrame(surface, deep, strings, ms) };
}
