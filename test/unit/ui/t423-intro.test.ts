/**
 * T-423: the intro (`ui-screens/menus-and-world.md` § Intro, `03-content/intro.md`). Its timing,
 * its cues, the skip, when it plays at launch, the menu entry and the music hook.
 */
import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { ContentError, type IntroDef } from '@content/schema';
import { Game } from '@app/game';
import { SettingsStore } from '@app/settings-store';
import { MemoryStorage } from '@platform/storage';
import { DEFAULT_USER_SETTINGS, readSettings } from '@ui/settings';
import { IntroScreen, cueState, introFrame, introTimeline, sceneAt } from '@ui/screens/intro';
import { moodOf } from '@ui/music';
import { INTRO_STAGE_COLS, INTRO_STAGE_ROWS } from '@ui/constants';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { glyphs, press, registry, strings, surface } from './ui-fixture';

const intro = registry.derived<IntroDef>('intro');

function game(store = new SettingsStore(new MemoryStorage())): Game {
  return new Game({ canvas: new MockCanvas(), seed: 't423-intro', registry, createCanvas: mockCanvasFactory(),
    devicePixelRatio: 1, width: 1280, height: 800, settingsStore: store });
}

/** Let the app's promises (the main menu's newest-save lookup, the settings write) settle. */
async function settle(g: Game): Promise<void> {
  for (let k = 0; k < 5; k += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  await g.settled();
}

/** A clock the test moves. */
function clock(): { now: () => number; at: number } {
  const c = { at: 1000, now: () => c.at };
  return c;
}

describe('T-423 intro: scenes and timing', () => {
  it('plays four scenes one after another, between 30 and 60 seconds in all', () => {
    const { scenes, total } = introTimeline(intro);
    expect(scenes.map((s) => s.id)).toEqual(['hold', 'road', 'mountain', 'title']);
    expect(total).toBe(45000);
    expect(total).toBeGreaterThanOrEqual(30000);
    expect(total).toBeLessThanOrEqual(60000);
    expect(sceneAt(intro, 0)).toEqual({ scene: scenes[0], local: 0 });
    expect(sceneAt(intro, 8999)?.scene.id).toBe('hold');
    expect(sceneAt(intro, 9000)).toEqual({ scene: scenes[1], local: 0 });
    expect(sceneAt(intro, 44999)?.scene.id).toBe('title');
    expect(sceneAt(intro, 45000)).toBeNull();
    expect(sceneAt(intro, -1)).toBeNull();
  });

  it('moves a walking cue at an even pace, changes its frames only while it moves, and hides it after its end', () => {
    const cue = { scene: 'x', sprite: ['☺', '☻'], at: [0, 5] as const, to: [40, 5] as const, from: 1000, arrive: 5000, until: 8000 };
    expect(cueState(cue, 999, 9000)).toBeNull();
    expect(cueState(cue, 1000, 9000)).toEqual({ x: 0, y: 5, frame: 0 });
    expect(cueState(cue, 3000, 9000)).toEqual({ x: 20, y: 5, frame: 0 });
    expect(cueState(cue, 3250, 9000)?.frame).toBe(1);
    expect(cueState(cue, 6000, 9000)).toEqual({ x: 40, y: 5, frame: 0 });
    expect(cueState(cue, 8000, 9000)).toBeNull();
    const still = { scene: 'x', sprite: ['d', 'b'], at: [3, 3] as const, from: 0, step: 1400 };
    expect(cueState(still, 1399, 9000)?.frame).toBe(0);
    expect(cueState(still, 1400, 9000)?.frame).toBe(1);
    expect(cueState(still, 8999, 9000)).not.toBeNull();
    const rise = { scene: 'x', sprite: ['deepholm'], at: [8, 1] as const, from: 600, until: 5600, effect: 'rise' as const };
    expect(cueState(rise, 8000, 9000)).not.toBeNull();
  });

  it('draws only glyphs of the glyph set and gives every caption its string', () => {
    const unknown = glyphs.index('\u0001');
    for (const piece of intro.art) {
      for (const row of piece.rows) for (const ch of Array.from(row)) expect(glyphs.index(ch), `${piece.id} ${ch}`).not.toBe(unknown);
      expect(Math.max(...piece.rows.map((row) => Array.from(row).length)), piece.id).toBeLessThanOrEqual(INTRO_STAGE_COLS);
      expect(piece.rows.length, piece.id).toBeLessThanOrEqual(INTRO_STAGE_ROWS);
    }
    for (const cue of intro.cues) for (const frame of cue.sprite) for (const ch of Array.from(frame)) expect(glyphs.index(ch)).not.toBe(unknown);
    for (const caption of intro.captions) {
      expect(strings.has(`intro.${caption.id}`), caption.id).toBe(true);
      expect(Array.from(strings.get(`intro.${caption.id}`)).length).toBeLessThanOrEqual(INTRO_STAGE_COLS + 16);
    }
  });

  it('refuses intro content whose cue names no scene or whose backdrop is not art', () => {
    const bad = { ...intro, cues: [{ ...intro.cues[0], scene: 'nowhere' }], scenes: [{ ...intro.scenes[0], backdrop: 'missing' }] };
    expect(() => loadContent({ overrides: { intro: bad } })).toThrow(ContentError);
  });

  it('draws the seven dwarves leaving, the rabbit startled, the strike and the risen title, at any window size', () => {
    const at = (ms: number, cols = 80, rows = 25): string => {
      const s = surface(cols, rows);
      introFrame(s, intro, strings, ms);
      return s.lines().join('\n');
    };
    expect(at(6000)).toContain('So seven of them packed a wagon');
    expect(at(9000 + 3600)).toContain('!');
    expect(at(9000 + 4400)).toContain('Mostly.');
    expect(at(25000 + 6000)).toContain('─');
    const end = at(44000);
    expect(end).toContain('████▄ █████ █████ ████▄ █   █ ▄███▄ █     █▄ ▄█');
    expect(end).toContain('a hall beneath the world');
    expect(end).toContain('Any key or click to skip');
    // A small window clips the stage; a large one runs the ground on to its edges.
    expect(() => at(44000, 30, 8)).not.toThrow();
    const wide = at(12000, 160, 40).split('\n');
    expect(wide.some((line) => line === '"'.repeat(160))).toBe(true);
  });
});

describe('T-423 intro: the screen and the skip', () => {
  it('ends once by itself when its time is up', () => {
    const c = clock();
    let done = 0;
    const screen = new IntroScreen({ now: c.now, done: () => { done += 1; } }, intro, strings);
    screen.draw(surface(80, 25));
    c.at += 44999;
    screen.draw(surface(80, 25));
    expect(done).toBe(0);
    c.at += 1;
    screen.draw(surface(80, 25));
    screen.draw(surface(80, 25));
    expect(done).toBe(1);
    expect(screen.finished).toBe(true);
  });

  it('skips on any key or a click, but not on a modifier alone', () => {
    let done = 0;
    const screen = new IntroScreen({ now: () => 0, done: () => { done += 1; } }, intro, strings);
    expect(screen.key(press('Shift', { shift: true }))).toBe(false);
    expect(screen.key(press('Control', { ctrl: true }))).toBe(false);
    expect(done).toBe(0);
    expect(screen.key(press('q'))).toBe(true);
    expect(done).toBe(1);
    expect(screen.key(press('Escape'))).toBe(true);
    expect(done).toBe(1);
    const clicked = new IntroScreen({ now: () => 0, done: () => { done += 1; } }, intro, strings);
    clicked.pointerDown();
    expect(done).toBe(2);
  });
});

describe('T-423 intro: when it plays', () => {
  it('reads the setting and the seen mark, with defaults for an older store', () => {
    expect(DEFAULT_USER_SETTINGS.intro).toBe('first time');
    expect(DEFAULT_USER_SETTINGS.introSeen).toBe(false);
    expect(readSettings({}).intro).toBe('first time');
    expect(readSettings({ intro: 'always', introSeen: true })).toMatchObject({ intro: 'always', introSeen: true });
    expect(readSettings({ intro: 'sometimes', introSeen: 'yes' })).toMatchObject({ intro: 'first time', introSeen: false });
  });

  it('plays at the first launch only, marks itself seen in the store, and a reset does not bring it back', async () => {
    const store = new SettingsStore(new MemoryStorage());
    const first = game(store);
    await first.loadSettings();
    expect(first.introAtLaunch()).toBe(true);
    await settle(first);
    expect((await store.load())?.preferences.introSeen).toBe(true);

    const second = game(store);
    await second.loadSettings();
    expect(second.introAtLaunch()).toBe(false);
    second.resetSettings();
    expect(second.userSettings.introSeen).toBe(true);
    expect(second.introAtLaunch()).toBe(false);

    second.changeSettings({ intro: 'always' });
    expect(second.introAtLaunch()).toBe(true);
    second.changeSettings({ intro: 'off' });
    const fresh = game(new SettingsStore(new MemoryStorage()));
    fresh.changeSettings({ intro: 'off' });
    expect(fresh.introAtLaunch()).toBe(false);
    expect(fresh.userSettings.introSeen).toBe(false);
  });

  it('opens from the main menu entry, gives the music its own scene, and a key returns to the main menu', async () => {
    const g = game();
    await g.showMainMenu();
    expect(g.textRows().join('\n')).toContain('[i] Intro');
    expect(g.musicScene).toBe('menu');
    g.handleKey(press('i'));
    expect(g.screen).toBe('intro');
    expect(g.musicScene).toBe('intro');
    expect(moodOf('intro', false)).toBe('menu');
    expect(g.textRows().join('\n')).toContain('Any key or click to skip');
    g.handleKey(press(' '));
    await settle(g);
    expect(g.screen).toBe('main_menu');
  });

  it('has a settings row that steps round first time, always and off', async () => {
    const g = game();
    await g.showMainMenu();
    g.handleKey(press('o'));
    expect(g.screen).toBe('settings');
    expect(g.textRows().join('\n')).toMatch(/Intro at launch +\[first time\]/);
    for (let k = 0; k < 12; k += 1) g.handleKey(press('ArrowDown'));
    g.handleKey(press('Enter'));
    expect(g.userSettings.intro).toBe('always');
    g.handleKey(press('Enter'));
    expect(g.userSettings.intro).toBe('off');
    g.handleKey(press('Enter'));
    expect(g.userSettings.intro).toBe('first time');
  });
});
