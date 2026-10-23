/**
 * The intro (`04-implementation/ui-screens/menus-and-world.md` § Intro): a short animated scene in
 * the game's own glyphs and palette, played from the content of `03-content/intro.md`. The scenes,
 * art, cues and captions are data; this module only plays them on the text grid.
 *
 * Time is the host's clock in ms since the screen opened. {@link introFrame} draws any moment of
 * it, so the tests and the golden can draw a fixed one.
 */

import type { IntroCueDef, IntroDef } from '@content/schema';
import type { KeyPress } from '@platform/input';
import type { Rgb } from '@render/palette';
import { INTRO_FRAME_MS, INTRO_RISE_ROWS, INTRO_STAGE_COLS, INTRO_STAGE_ROWS } from '../constants';
import { MODIFIER_KEYS } from '../keymap';
import type { Screen } from '../screen';
import type { Strings } from '../strings';
import type { Surface } from '../surface';

/** A scene placed on the intro's timeline. */
export interface TimedScene {
  readonly id: string;
  readonly start: number;
  readonly ms: number;
  readonly backdrop: string;
}

/** The scenes one after another, and the length of the whole intro. */
export function introTimeline(intro: IntroDef): { scenes: TimedScene[]; total: number } {
  const scenes: TimedScene[] = [];
  let start = 0;
  for (const scene of intro.scenes) {
    scenes.push({ id: scene.id, start, ms: scene.ms, backdrop: scene.backdrop });
    start += scene.ms;
  }
  return { scenes, total: start };
}

/** The scene playing `ms` after the intro began and the time within it; `null` once it is over. */
export function sceneAt(intro: IntroDef, ms: number): { scene: TimedScene; local: number } | null {
  if (ms < 0) return null;
  for (const scene of introTimeline(intro).scenes) {
    if (ms < scene.start + scene.ms) return { scene, local: ms - scene.start };
  }
  return null;
}

/** Where a cue stands and which frame it shows at `local` ms, or `null` while it is not drawn. */
export function cueState(cue: IntroCueDef, local: number, sceneMs: number): { x: number; y: number; frame: number } | null {
  const rise = cue.effect === 'rise';
  if (local < cue.from || (!rise && cue.until !== undefined && local >= cue.until)) return null;
  const [ax, ay] = cue.at;
  let x = ax;
  let y = ay;
  let moving = false;
  if (cue.to !== undefined) {
    const arrive = cue.arrive ?? cue.until ?? sceneMs;
    const p = Math.max(0, Math.min(1, (local - cue.from) / Math.max(1, arrive - cue.from)));
    x = Math.round(ax + (cue.to[0] - ax) * p);
    y = Math.round(ay + (cue.to[1] - ay) * p);
    moving = local < arrive;
  }
  const step = cue.step ?? INTRO_FRAME_MS;
  const frame = cue.to !== undefined && !moving ? 0 : Math.floor((local - cue.from) / step) % cue.sprite.length;
  return { x, y, frame };
}

/** The shades a rising column passes through on its way up. */
const RISE_SHADES = ['░', '▒', '▓'] as const;

/** The art pieces by id. */
function artOf(intro: IntroDef): Map<string, readonly string[]> {
  return new Map(intro.art.map((piece) => [piece.id, piece.rows]));
}

/** Draw the intro as it is `ms` after it began: the stage centred, its caption under it, the skip line at the bottom. */
export function introFrame(surface: Surface, intro: IntroDef, strings: Strings, ms: number): void {
  const at = sceneAt(intro, ms);
  if (at === null) return;
  const { scene, local } = at;
  const art = artOf(intro);
  const colors = new Map(intro.colors.map((row) => [row.glyph, row.color]));
  const colorOf = (ch: string): Rgb => {
    const id = colors.get(ch);
    return id === undefined ? surface.theme.text : surface.color(id);
  };
  const black = surface.theme.black;
  const left = Math.floor((surface.cols - INTRO_STAGE_COLS) / 2);
  const top = Math.max(0, Math.floor((surface.rows - INTRO_STAGE_ROWS - 3) / 2));
  const onStage = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < INTRO_STAGE_COLS && y < INTRO_STAGE_ROWS;
  const put = (x: number, y: number, ch: string, fg: Rgb): void => {
    if (ch === ' ' || !onStage(x, y)) return;
    surface.put(left + x, top + y, surface.glyphs.index(ch), fg, black);
  };

  // The backdrop. A row runs on to the window's left edge with its first glyph, and a row as wide
  // as the stage to the right edge with its last, and the dwarves of a crowd shuffle.
  const shuffle = Math.floor(local / INTRO_FRAME_MS);
  (art.get(scene.backdrop) ?? []).forEach((row, y) => {
    const chars = Array.from(row);
    chars.forEach((ch, x) => {
      const swap = (ch === '☺' || ch === '☻') && (x * 7 + y * 13 + shuffle) % 11 === 0;
      const glyph = swap ? (ch === '☺' ? '☻' : '☺') : ch;
      put(x, y, glyph, colorOf(ch));
    });
    if (y >= INTRO_STAGE_ROWS) return;
    const first = chars[0] ?? ' ';
    if (first !== ' ') for (let col = 0; col < left; col += 1) surface.put(col, top + y, surface.glyphs.index(first), colorOf(first), black);
    const last = chars[chars.length - 1] ?? ' ';
    if (chars.length === INTRO_STAGE_COLS && last !== ' ') {
      for (let col = left + INTRO_STAGE_COLS; col < surface.cols; col += 1) surface.put(col, top + y, surface.glyphs.index(last), colorOf(last), black);
    }
  });

  // The cues, in table order.
  for (const cue of intro.cues) {
    if (cue.scene !== scene.id) continue;
    const state = cueState(cue, local, scene.ms);
    if (state === null) continue;
    const frame = cue.sprite[state.frame] as string;
    const rows = art.get(frame) ?? [frame];
    const fixed = cue.color === undefined ? null : surface.color(cue.color);
    if (cue.effect === 'rise') {
      const width = Math.max(...rows.map((row) => Array.from(row).length));
      const span = (cue.until ?? scene.ms) - cue.from;
      const climb = span / 3;
      for (let c = 0; c < width; c += 1) {
        const start = cue.from + (width > 1 ? ((span - climb) * c) / (width - 1) : 0);
        if (local < start) continue;
        const p = Math.min(1, (local - start) / climb);
        const drop = Math.round((1 - p) * INTRO_RISE_ROWS);
        rows.forEach((row, r) => {
          const ch = Array.from(row)[c] ?? ' ';
          if (ch === ' ') return;
          const shown = p >= 1 ? ch : RISE_SHADES[Math.min(2, Math.floor(p * 3))] as string;
          put(state.x + c, state.y + r + drop, shown, fixed ?? colorOf(ch));
        });
      }
      continue;
    }
    rows.forEach((row, r) => {
      Array.from(row).forEach((ch, c) => put(state.x + c, state.y + r, ch, fixed ?? colorOf(ch)));
    });
  }

  // The caption under the stage, and the skip line.
  const captionRow = top + INTRO_STAGE_ROWS + 1;
  for (const caption of intro.captions) {
    if (caption.scene !== scene.id || local < caption.from || local >= caption.until) continue;
    const text = strings.get(`intro.${caption.id}`);
    surface.text(Math.max(0, Math.floor((surface.cols - Array.from(text).length) / 2)), captionRow, text, surface.theme.text);
  }
  const skip = strings.get('ui.intro.skip');
  const skipRow = surface.rows - 1;
  if (skipRow > captionRow) surface.text(Math.max(0, Math.floor((surface.cols - Array.from(skip).length) / 2)), skipRow, skip, surface.theme.dim);
}

/** What the intro asks of the app: the clock, and the way on when it ends or is skipped. */
export interface IntroHost {
  now(): number;
  done(): void;
}

export class IntroScreen implements Screen {
  readonly id = 'intro' as const;
  private readonly start: number;
  private readonly total: number;
  private over = false;

  constructor(
    private readonly host: IntroHost,
    private readonly intro: IntroDef,
    private readonly strings: Strings,
  ) {
    this.start = host.now();
    this.total = introTimeline(intro).total;
  }

  /** Milliseconds since the intro began. */
  elapsed(): number {
    return this.host.now() - this.start;
  }

  get finished(): boolean {
    return this.over;
  }

  /** End the intro once, whether it ran out or was skipped. */
  finish(): void {
    if (this.over) return;
    this.over = true;
    this.host.done();
  }

  draw(surface: Surface): void {
    const ms = this.elapsed();
    if (ms >= this.total) this.finish();
    introFrame(surface, this.intro, this.strings, Math.max(0, Math.min(ms, this.total - 1)));
  }

  /** Any key skips (a fixed key, `ui-keymap-and-screens.md` § Fixed keys); a modifier alone does not. */
  key(press: KeyPress): boolean {
    if (MODIFIER_KEYS.has(press.key)) return false;
    this.finish();
    return true;
  }

  /** A click skips too. */
  pointerDown(): void {
    this.finish();
  }
}
