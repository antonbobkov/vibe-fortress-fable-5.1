/**
 * T-433: the deep intro (`ui-screens/menus-and-world.md` § Intro, `03-content/deep-intro.md`): its
 * content and checks, the effects of its renderer on a small fixture, the Intro style setting, and
 * its piece of music.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadContent } from '@content/loader';
import { ContentError, parseScore, type DeepIntroDef, type InstrumentDef, type TuneDef } from '@content/schema';
import { Game } from '@app/game';
import { SettingsStore } from '@app/settings-store';
import { MemoryStorage } from '@platform/storage';
import { toHex } from '@render/palette';
import { DEEP_INTRO_COURSE_ROWS, DEEP_INTRO_STAGE_COLS, DEEP_INTRO_STAGE_ROWS, MUSIC_CHANGE_GAP_S } from '@ui/constants';
import { Music, MusicDirector, arrange, moodOf } from '@ui/music';
import { DEFAULT_USER_SETTINGS, readSettings } from '@ui/settings';
import { IntroScreen, introTimeline } from '@ui/screens/intro';
import { bayer, cameraAt, deepFilm, deepIntroFrame, noise, stripLayout } from '@ui/screens/intro_deep';
import type { Surface } from '@ui/surface';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { glyphs, press, registry, strings, surface } from './ui-fixture';

const deep = registry.derived<DeepIntroDef>('deepIntro');

const WHITE = '#ffffff';
const RED = '#aa0000';
const BLUE = '#0000aa';
/** Every cell of an 80 × 45 window but the skip line's. */
const WINDOW = 80 * 45 - 'Any key or click to skip'.length;

/** A small deep intro for the renderer's effects: a red, a white and a flickering pixel, and two scenes. */
function fixture(patch: Partial<DeepIntroDef> = {}): DeepIntroDef {
  return {
    colors: [
      { id: 'black', hex: '#000000' }, { id: 'white', hex: '#FFFFFF' }, { id: 'red', hex: '#AA0000' }, { id: 'blue', hex: '#0000AA' },
    ],
    cycles: [{ id: 'flicker', colors: ['red', 'blue'], step: 100, drift: [1, 0] }],
    inks: [
      { ink: '.', glyph: ' ', fg: 'black', bg: 'black' },
      { ink: 'W', glyph: '█', fg: 'white', bg: 'black' },
      { ink: 'R', glyph: '█', fg: 'red', bg: 'black' },
      { ink: '~', glyph: '█', fg: 'flicker', bg: 'black' },
      { ink: 's', glyph: '█', fg: 'red', bg: 'black', density: 50 },
    ],
    parts: [
      { part: 'side', inks: ['R', '.'] }, { part: 'edge', inks: ['W'] }, { part: 'bar', inks: ['.'] },
      { part: 'static', inks: ['W', 'R'] }, { part: 'flash', inks: ['W'] }, { part: 'fade', inks: ['.'] },
    ],
    scenes: [{ id: 'a', ms: 1000, fill: '.' }, { id: 'b', ms: 1000, fill: 'R' }],
    layers: [],
    camera: [],
    effects: [],
    captions: [],
    art: [{ id: 'dot', rows: ['W'] }, { id: 'red', rows: ['R'] }, { id: 'wave', rows: ['~~'] }],
    ...patch,
  };
}

/** Where on a frame the cells of a colour are: `col,row` of each. */
function cellsOf(s: Surface, hex: string): string[] {
  const out: string[] = [];
  for (let row = 0; row < s.rows; row += 1) {
    for (let col = 0; col < s.cols; col += 1) if (toHex(s.cells.get(col, row).fg) === hex && s.cells.get(col, row).glyph === glyphs.index('█')) out.push(`${col},${row}`);
  }
  return out;
}

function frame(def: DeepIntroDef, ms: number, cols = 80, rows = 45): Surface {
  const s = surface(cols, rows);
  deepIntroFrame(s, def, strings, ms);
  return s;
}

/** The strip's top-left cell in an 80 × 45 window. */
const TOP = stripLayout(80, 45).top;

describe('T-433 deep intro: content', () => {
  it('plays six scenes, cut straight one to the next, between 40 and 60 seconds in all', () => {
    const { scenes, total } = introTimeline(deep);
    expect(scenes.map((s) => s.id)).toEqual(['descent', 'bottom', 'eye', 'torrent', 'strike', 'title']);
    expect(total).toBe(43500);
  });

  it('defines sixteen colours, draws only glyphs of the glyph set, and gives every caption its string', () => {
    expect(deep.colors).toHaveLength(16);
    const unknown = glyphs.index('\u0001');
    for (const ink of deep.inks) expect(glyphs.index(ink.glyph), ink.ink).not.toBe(unknown);
    for (const caption of deep.captions) expect(strings.has(`deep_intro.${caption.id}`), caption.id).toBe(true);
  });

  it('uses every effect, palette cycling and parallax', () => {
    expect(new Set(deep.effects.map((e) => e.effect))).toEqual(new Set(['shake', 'flash', 'fade_in', 'fade_out', 'static']));
    const cycles = new Set(deep.cycles.map((c) => c.id));
    expect(deep.inks.some((ink) => cycles.has(ink.fg) || cycles.has(ink.bg))).toBe(true);
    const descent = new Set(deep.layers.filter((l) => l.scene === 'descent').map((l) => l.depth));
    expect(descent.size).toBeGreaterThanOrEqual(3);
    expect(deep.camera.some((key) => key.scene === 'descent' && key.y !== DEEP_INTRO_STAGE_ROWS / 2)).toBe(true);
  });

  it('refuses an art letter that is no ink, an ink of no colour, a missing part and a shake without its size', () => {
    const bad = (patch: Partial<DeepIntroDef>): (() => unknown) => () => loadContent({ overrides: { deepIntro: { ...deep, ...patch } } });
    expect(bad({ art: [...deep.art, { id: 'oops', rows: ['W?W'] }] })).toThrow(ContentError);
    expect(bad({ inks: [...deep.inks, { ink: 'Q', glyph: '█', fg: 'mauve', bg: 'black' }] })).toThrow(ContentError);
    expect(bad({ parts: deep.parts.filter((p) => p.part !== 'flash') })).toThrow(ContentError);
    expect(bad({ effects: [...deep.effects, { scene: 'eye', effect: 'shake', from: 0, until: 100 }] })).toThrow(ContentError);
    expect(bad({ layers: [...deep.layers, { scene: 'eye', sprite: ['nowhere'], at: [0, 0], from: 0, depth: 1 }] })).toThrow(ContentError);
    expect(() => loadContent()).not.toThrow();
  });

  it('draws the captions, the title and the skip line, at any window size', () => {
    const at = (ms: number, cols = 80, rows = 45): string => frame(deep, ms, cols, rows).lines().join('\n');
    expect(at(2000)).toContain('Somebody always has to go down first.');
    expect(at(13000 + 8000)).toContain('The deep blinked first.');
    const end = at(42500);
    expect(end).toContain('a hall beneath the world');
    expect(end).toContain('Any key or click to skip');
    expect(() => at(25000, 30, 8)).not.toThrow();
    expect(() => at(40000, 203, 61)).not.toThrow();
  });
});

describe('T-433 deep intro: the strip and its effects', () => {
  it('scales the strip by whole cells to fit the window, with room for the caption and the skip line', () => {
    expect(stripLayout(80, 45)).toEqual({ scale: 1, left: 0, top: 6, width: DEEP_INTRO_STAGE_COLS, height: DEEP_INTRO_STAGE_ROWS });
    expect(stripLayout(160, 90).scale).toBe(2);
    expect(stripLayout(240, 70).scale).toBe(2);
    expect(stripLayout(40, 10).scale).toBe(1);
    const big = stripLayout(200, 100);
    expect(big.left).toBe(Math.floor((200 - big.width) / 2));
  });

  it('letterboxes a strip that does not fill the window: black above and below, stone courses at its sides', () => {
    const def = fixture({ layers: [{ scene: 'a', sprite: ['dot'], at: [40, 15], from: 0, depth: 1 }] });
    const s = frame(def, 0, 100, 45);
    const { left } = stripLayout(100, 45);
    expect(toHex(s.cells.get(left + 40, TOP + 15).fg)).toBe(WHITE);
    expect(s.cells.get(left + 40, TOP - 1).glyph).toBe(32);
    // the pillar's edge beside the strip, then stone with a mortar course every few rows
    expect(toHex(s.cells.get(left - 1, 10).fg)).toBe(WHITE);
    const mortar = Array.from({ length: 12 }, (_, r) => s.cells.get(left - 3, TOP + r).glyph === 32);
    expect(mortar.filter(Boolean).length).toBe(12 / DEEP_INTRO_COURSE_ROWS);
  });

  it('cycles a colour in turn and drifts it across the strip', () => {
    const def = fixture({ layers: [{ scene: 'a', sprite: ['wave'], at: [10, 10], from: 0, depth: 1 }] });
    const fg = (ms: number, x: number): string => toHex(frame(def, ms).cells.get(x, TOP + 10).fg);
    expect(fg(0, 10)).toBe(RED);
    expect(fg(100, 10)).toBe(BLUE);
    expect(fg(200, 10)).toBe(RED);
    expect(fg(0, 11)).toBe(BLUE);
  });

  it('moves layers by their depth as the camera pans: parallax', () => {
    const def = fixture({
      layers: [
        { scene: 'a', sprite: ['dot'], at: [40, 10], from: 0, depth: 1 },
        { scene: 'a', sprite: ['dot'], at: [40, 15], from: 0, depth: 0.5 },
        { scene: 'a', sprite: ['dot'], at: [40, 20], from: 0, depth: 0 },
      ],
      camera: [{ scene: 'a', at: 0, x: 40, y: 15, move: 'cut' }, { scene: 'a', at: 1000, x: 50, y: 15, move: 'linear' }],
    });
    expect(cellsOf(frame(def, 0), WHITE)).toEqual([`40,${TOP + 10}`, `40,${TOP + 15}`, `40,${TOP + 20}`]);
    expect(cellsOf(frame(def, 500), WHITE)).toEqual([`35,${TOP + 10}`, `37,${TOP + 15}`, `40,${TOP + 20}`]);
  });

  it('pans by cuts, even steps and eases', () => {
    const keys = [
      { scene: 'a', at: 0, x: 40, y: 15, move: 'cut' as const },
      { scene: 'a', at: 600, x: 60, y: 15, move: 'cut' as const },
      { scene: 'a', at: 1000, x: 80, y: 25, move: 'ease' as const },
    ];
    expect(cameraAt(keys, 599).x).toBe(40);
    expect(cameraAt(keys, 600).x).toBe(60);
    expect(cameraAt(keys, 800)).toEqual({ x: 70, y: 20 });
    expect(cameraAt(keys, 700).x).toBeLessThan(65);
    expect(cameraAt(keys, 5000)).toEqual({ x: 80, y: 25 });
    expect(cameraAt([], 100)).toEqual({ x: DEEP_INTRO_STAGE_COLS / 2, y: DEEP_INTRO_STAGE_ROWS / 2 });
  });

  it('shakes the picture by at most its size, and not after it ends', () => {
    const def = fixture({
      layers: [{ scene: 'a', sprite: ['dot'], at: [40, 15], from: 0, depth: 1 }],
      effects: [{ scene: 'a', effect: 'shake', from: 0, until: 500, value: 2 }],
    });
    const places = new Set<string>();
    for (let ms = 0; ms < 200; ms += 10) {
      const [at] = cellsOf(frame(def, ms), WHITE);
      const [col, row] = (at as string).split(',').map(Number) as [number, number];
      expect(Math.abs(col - 40)).toBeLessThanOrEqual(2);
      expect(Math.abs(row - TOP - 15)).toBeLessThanOrEqual(2);
      places.add(at as string);
    }
    expect(places.size).toBeGreaterThan(1);
    expect(cellsOf(frame(def, 600), WHITE)).toEqual([`40,${TOP + 15}`]);
  });

  it('flashes the whole window white, then scatters the flash away', () => {
    const def = fixture({ effects: [{ scene: 'a', effect: 'flash', from: 100, until: 400 }] });
    expect(cellsOf(frame(def, 150), WHITE)).toHaveLength(WINDOW);
    const later = cellsOf(frame(def, 380), WHITE).length;
    expect(later).toBeGreaterThan(0);
    expect(later).toBeLessThan(80 * 45 / 4);
    expect(cellsOf(frame(def, 400), WHITE)).toHaveLength(0);
  });

  it('fades in and out by an ordered dither, and condenses a picture out of static', () => {
    const fade = fixture({ effects: [{ scene: 'b', effect: 'fade_in', from: 0, until: 400 }] });
    const reds = (ms: number): number => cellsOf(frame(fade, 1000 + ms), RED).length;
    expect(reds(0)).toBe(0);
    expect(reds(200)).toBeGreaterThan(80 * 30 * 0.4);
    expect(reds(200)).toBeLessThan(80 * 30 * 0.6);
    expect(reds(400)).toBe(80 * 30);
    const out = fixture({ effects: [{ scene: 'b', effect: 'fade_out', from: 0, until: 400 }] });
    expect(cellsOf(frame(out, 1000 + 399), RED).length).toBeLessThan(80 * 30 * 0.1);
    for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) expect(bayer(x, y)).toBeGreaterThan(0);
    expect(new Set(Array.from({ length: 16 }, (_, k) => bayer(k % 4, k >> 2))).size).toBe(16);

    const noisy = fixture({ effects: [{ scene: 'a', effect: 'static', from: 0, until: 1000 }] });
    const lit = (ms: number): number => cellsOf(frame(noisy, ms), WHITE).length + cellsOf(frame(noisy, ms), RED).length;
    expect(lit(0)).toBe(80 * 30);
    expect(lit(500)).toBeLessThan(80 * 30 * 0.7);
    expect(lit(500)).toBeGreaterThan(80 * 30 * 0.3);
    expect(lit(999)).toBeLessThan(80 * 30 * 0.05);
  });

  it('draws speckle in a share of its cells, chosen anew as it twinkles; tiles art; and is the same every time', () => {
    const def = fixture({
      art: [{ id: 'speck', rows: Array.from({ length: 10 }, () => 's'.repeat(20)) }, { id: 'stripe', rows: ['W', '.', '.'] }],
      layers: [
        { scene: 'a', sprite: ['speck'], at: [0, 0], from: 0, depth: 1 },
        { scene: 'a', sprite: ['stripe'], at: [50, 0], from: 0, depth: 1, tile: 'y' },
      ],
    });
    const speck = (ms: number): string[] => cellsOf(frame(def, ms), RED);
    expect(speck(0).length).toBeGreaterThan(60);
    expect(speck(0).length).toBeLessThan(140);
    expect(speck(0)).not.toEqual(speck(200));
    expect(speck(0)).toEqual(speck(0));
    const stripe = cellsOf(frame(def, 0), WHITE).map((at) => Number(at.split(',')[1]) - TOP);
    expect(stripe).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 27]);
    expect(noise(3, 4, 5)).toBe(noise(3, 4, 5));
    expect(noise(3, 4, 5)).not.toBe(noise(4, 3, 5));
    for (let k = 0; k < 50; k += 1) {
      expect(noise(k, -k, k * 3)).toBeGreaterThanOrEqual(0);
      expect(noise(k, -k, k * 3)).toBeLessThan(1);
    }
  });

  it('puts a caption on the row under the strip while it lasts', () => {
    const def = fixture({ captions: [{ id: 'descent', scene: 'a', from: 0, until: 500 }] });
    expect(frame(def, 0).lines()[TOP + DEEP_INTRO_STAGE_ROWS + 1]).toContain('Somebody always has to go down first.');
    expect(frame(def, 600).lines().join('\n')).not.toContain('Somebody');
  });
});

describe('T-434 deep intro: no chapter cards and no zooms', () => {
  it('has no chapter card, and its camera only pans', () => {
    expect(deep.scenes.some((s) => s.id.startsWith('chapter'))).toBe(false);
    expect(Object.keys(registry.derived<Record<string, string>>('strings')).some((key) => key.startsWith('deep_intro.chapter'))).toBe(false);
    for (const key of deep.camera) expect(Object.keys(key).sort()).toEqual(['at', 'move', 'scene', 'x', 'y']);
  });

  it('draws an art pixel as one cell at every moment of the film, in a window of 80 by 45 cells', () => {
    // A one-pixel layer in each scene, fixed to the strip: wherever the film is, it covers one cell.
    const marked = { ...deep, inks: [...deep.inks, { ink: '#', glyph: '█', fg: 'light_magenta', bg: 'light_magenta' }],
      art: [...deep.art, { id: 'mark', rows: ['#'] }], effects: deep.effects.filter((e) => e.effect !== 'flash' && e.effect !== 'static' && e.effect !== 'fade_in' && e.effect !== 'fade_out'),
      layers: [...deep.layers, ...deep.scenes.map((s) => ({ scene: s.id, sprite: ['mark'], at: [3, 3] as const, from: 0, depth: 0 }))] };
    for (let ms = 0; ms < introTimeline(deep).total; ms += 250) expect(cellsOf(frame(marked, ms), '#ff55ff'), `${ms} ms`).toHaveLength(1);
  });
});

describe('T-433 deep intro: the Intro style setting', () => {
  afterEach(() => { vi.useRealTimers(); });

  function game(): Game {
    return new Game({ canvas: new MockCanvas(), seed: 't433-intro', registry, createCanvas: mockCanvasFactory(),
      devicePixelRatio: 1, width: 1280, height: 800, settingsStore: new SettingsStore(new MemoryStorage()) });
  }

  it('is deep by default, reads hall, and falls back to deep for anything else', () => {
    expect(DEFAULT_USER_SETTINGS.introStyle).toBe('deep');
    expect(readSettings({}).introStyle).toBe('deep');
    expect(readSettings({ introStyle: 'hall' }).introStyle).toBe('hall');
    expect(readSettings({ introStyle: 'loud' }).introStyle).toBe('deep');
  });

  it('has a settings row under Intro at launch that steps between deep and hall', async () => {
    const g = game();
    await g.showMainMenu();
    g.handleKey(press('o'));
    expect(g.textRows().join('\n')).toMatch(/Intro style +\[deep\]/);
    for (let k = 0; k < 13; k += 1) g.handleKey(press('ArrowDown'));
    g.handleKey(press('Enter'));
    expect(g.userSettings.introStyle).toBe('hall');
    g.handleKey(press('Enter'));
    expect(g.userSettings.introStyle).toBe('deep');
  });

  it('plays the chosen style from the main menu', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    const g = game();
    await g.showMainMenu();
    g.handleKey(press('i'));
    vi.setSystemTime(1_002_000);
    g.render();
    expect(g.textRows().join('\n')).toContain('Somebody always has to go down first.');
    g.handleKey(press(' '));
    g.changeSettings({ introStyle: 'hall' });
    await g.showMainMenu();
    g.handleKey(press('i'));
    vi.setSystemTime(1_007_000);
    g.render();
    expect(g.textRows().join('\n')).toContain('So seven of them packed a wagon');
  });

  it('plays a film to its end and skips like the hall intro', () => {
    let done = 0;
    const c = { at: 0 };
    const screen = new IntroScreen({ now: () => c.at, done: () => { done += 1; } }, deepFilm(deep, strings));
    screen.draw(surface(80, 45));
    c.at = 43499;
    screen.draw(surface(80, 45));
    expect(done).toBe(0);
    c.at = 43500;
    screen.draw(surface(80, 45));
    expect(done).toBe(1);
    const skipped = new IntroScreen({ now: () => 0, done: () => { done += 1; } }, deepFilm(deep, strings));
    expect(skipped.key(press('Shift', { shift: true }))).toBe(false);
    expect(skipped.key(press('x'))).toBe(true);
    expect(done).toBe(2);
  });
});

describe('T-433 deep intro: its music', () => {
  const tunes = registry.table<TuneDef>('tunes');
  const instruments = registry.table<InstrumentDef>('instruments');

  it('is one original piece of about 42 seconds, its voices of one length, its sawtooths gently filtered', () => {
    const rows = tunes.ids().map((id) => tunes.byId(id) as TuneDef).filter((t) => t.role === 'deep_intro');
    expect(rows.map((t) => t.id)).toEqual(['the_deep_answers']);
    const tune = rows[0] as TuneDef;
    expect(tune.source).toBe('original');
    const lengths = new Set(tune.voices.map((v) => { const s = parseScore(v.notes); return typeof s === 'string' ? -1 : s.steps; }));
    expect(lengths).toEqual(new Set([162]));
    const seconds = arrange(tune, (id) => instruments.byId(id)).seconds;
    expect(seconds).toBeGreaterThan(40);
    expect(seconds).toBeLessThan(45);
    for (const v of tune.voices) {
      const row = instruments.byId(v.instrument) as InstrumentDef;
      if (row.wave === 'sawtooth') expect(row.filterHz).toBeLessThanOrEqual(2000);
    }
  });

  it('is the intro scene\'s mood for the deep style, which is the default', () => {
    expect(moodOf('intro', false, 'deep')).toBe('deep_intro');
    expect(moodOf('intro', true)).toBe('deep_intro');
    expect(moodOf('intro', false, 'hall')).toBe('intro');
    const d = new MusicDirector([{ id: 'd', role: 'deep_intro', seconds: 40 }, { id: 'm', role: 'menu', seconds: 30 }], () => 0);
    d.update(0, 'deep_intro');
    expect(d.update(MUSIC_CHANGE_GAP_S, 'deep_intro')).toEqual({ kind: 'play', tune: 'd' });
    d.update(MUSIC_CHANGE_GAP_S + 40, 'deep_intro');
    expect(d.update(2 * MUSIC_CHANGE_GAP_S + 40, 'deep_intro')).toEqual({ kind: 'play', tune: 'm' });
  });

  it('plays under the intro with the default settings', () => {
    const music = new Music(registry, () => 0);
    const synth = { now: 0, begin: () => ({ play: () => {}, fadeOut: () => {} }), setVolume: () => {}, setAudible: () => {} };
    music.attach(() => synth);
    music.update('intro', DEFAULT_USER_SETTINGS);
    synth.now = MUSIC_CHANGE_GAP_S;
    music.update('intro', DEFAULT_USER_SETTINGS);
    expect(music.current).toBe('the_deep_answers');
  });
});


