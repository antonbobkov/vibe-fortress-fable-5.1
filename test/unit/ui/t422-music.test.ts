/**
 * T-422: music (24 § Music, 03-content/music.md). Track selection from events, the settings and the
 * mute key, and no audio context where there must be none.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { ContentError, parseScore, type TuneDef } from '@content/schema';
import { Game } from '@app/game';
import { SettingsStore } from '@app/settings-store';
import { HeadlessGame } from '@app/headless';
import { MemoryStorage } from '@platform/storage';
import { AudioGate, type SynthNote, type SynthOut, type SynthPiece } from '@platform/audio';
import { DEFAULT_USER_SETTINGS, readSettings } from '@ui/settings';
import { SettingsScreen } from '@ui/screens/settings';
import { Music, MusicDirector, TenseWatch, arrange, frequencyOf, moodOf, volumeGain, type TuneLength } from '@ui/music';
import {
  MUSIC_CHANGE_GAP_S,
  MUSIC_MASTER_GAIN,
  MUSIC_MENU_GAP_S,
  MUSIC_SILENCE_MAX_S,
  MUSIC_SILENCE_MIN_S,
  MUSIC_TAIL_S,
  MUSIC_TENSE_GAP_S,
} from '@ui/constants';
import type { GameEvent } from '@core/events';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press } from './ui-fixture';

const registry = loadContent();

function game(store = new SettingsStore(new MemoryStorage()), random = (): number => 0): Game {
  return new Game({ canvas: new MockCanvas(), seed: 't422-music', registry, createCanvas: mockCanvasFactory(),
    devicePixelRatio: 1, width: 1280, height: 800, settingsStore: store, musicRandom: random });
}

const ev = (type: string, fields: Record<string, unknown> = {}): GameEvent => ({ type, ...fields }) as GameEvent;

/** A synthesizer that records what it is asked to play, on a clock the test moves. */
class FakeSynth implements SynthOut {
  now = 0;
  volume = -1;
  readonly played: { note: SynthNote; time: number }[] = [];
  pieces = 0;
  fades = 0;
  begin(): SynthPiece {
    this.pieces += 1;
    return {
      play: (note, time) => { this.played.push({ note, time }); },
      fadeOut: () => { this.fades += 1; },
    };
  }
  setVolume(gain: number): void { this.volume = gain; }
  setAudible(): void {}
}

/** Count every audio context made while a test runs. */
let made = 0;
const realAudioContext = (globalThis as { AudioContext?: unknown }).AudioContext;
function countAudioContexts(): void {
  made = 0;
  (globalThis as { AudioContext?: unknown }).AudioContext = class {
    constructor() { made += 1; }
  };
}
afterEach(() => {
  (globalThis as { AudioContext?: unknown }).AudioContext = realAudioContext;
});

describe('T-422 the content: instruments and tunes', () => {
  it('has an intro, menu, fortress and tense tune, each original or with a named source', () => {
    const tunes = registry.table<TuneDef>('tunes');
    const rows = tunes.ids().map((id) => tunes.byId(id) as TuneDef);
    expect(rows.filter((t) => t.role === 'intro').length).toBeGreaterThanOrEqual(1);
    expect(rows.filter((t) => t.role === 'menu').length).toBeGreaterThanOrEqual(1);
    expect(rows.filter((t) => t.role === 'fortress').length).toBeGreaterThanOrEqual(3);
    expect(rows.filter((t) => t.role === 'tense').length).toBeGreaterThanOrEqual(1);
    for (const tune of rows) expect(tune.source.length).toBeGreaterThan(0);
  });

  it('parses the score notation and refuses what it does not know', () => {
    const score = parseScore('A4 D3+A3*4 .*2 F#3 Bb2*3');
    expect(typeof score).toBe('object');
    if (typeof score === 'string') return;
    expect(score.steps).toBe(11);
    expect(score.notes.map((n) => [n.start, n.steps, ...n.pitches])).toEqual([[0, 1, 69], [1, 4, 50, 57], [7, 1, 54], [8, 3, 46]]);
    expect(parseScore('H4')).toMatch(/not a pitch/);
    expect(parseScore('A4*0')).toMatch(/1 to 64 steps/);
    expect(parseScore('')).toMatch(/empty/);
    expect(frequencyOf(69)).toBeCloseTo(440, 6);
  });

  it('fails the content check when the voices of a tune differ in length, or a sawtooth is unfiltered', () => {
    const tunes = registry.table<TuneDef>('tunes');
    const rows = tunes.ids().map((id) => ({ ...(tunes.byId(id) as TuneDef) }));
    const first = rows[0] as TuneDef;
    rows[0] = { ...first, voices: [...first.voices, { instrument: 'harp', notes: 'A4' }] };
    expect(() => loadContent({ overrides: { tunes: rows } })).toThrow(ContentError);
    const instruments = (registry.table('instruments').ids()).map((id) => ({ ...(registry.table('instruments').byId(id) as object) })) as { id: string; wave: string; filterHz: number }[];
    const drone = instruments.find((i) => i.wave === 'sawtooth') as { filterHz: number };
    drone.filterHz = 8000;
    expect(() => loadContent({ overrides: { instruments } })).toThrow(/filtered at 2000 Hz/);
  });

  it('arranges a tune: every voice in time order, its length with the tail', () => {
    const tune = registry.table<TuneDef>('tunes').byId('hall_beneath') as TuneDef;
    const out = arrange(tune, (id) => registry.table('instruments').byId(id) as never);
    const steps = (parseScore(tune.voices[0]?.notes ?? '') as { steps: number }).steps;
    expect(out.seconds).toBeCloseTo(steps * 60 / tune.tempo + MUSIC_TAIL_S, 6);
    for (let k = 1; k < out.notes.length; k += 1) expect((out.notes[k] as SynthNote).at).toBeGreaterThanOrEqual((out.notes[k - 1] as SynthNote).at);
    // No voice is louder than its row says, and none is a harsh unfiltered wave.
    for (const note of out.notes) {
      expect(note.voice.level).toBeLessThanOrEqual(0.6);
      if (note.voice.wave === 'sawtooth') expect(note.voice.filterHz).toBeLessThanOrEqual(2000);
    }
  });
});

describe('T-422 track selection from events', () => {
  it('the hearth alert and a siege make the fortress tense, until they end', () => {
    const watch = new TenseWatch();
    expect(watch.tense).toBe(false);
    watch.onEvents([ev('AlertChanged', { from: 'calm', to: 'watchful' })]);
    expect(watch.tense).toBe(false);
    watch.onEvents([ev('AlertChanged', { from: 'watchful', to: 'hearth' })]);
    expect(watch.tense).toBe(true);
    watch.onEvents([ev('AlertChanged', { from: 'hearth', to: 'calm' })]);
    expect(watch.tense).toBe(false);
    watch.onEvents([ev('RaidArrived', { partyId: 7, kind: 'raid', size: 4 })]);
    expect(watch.tense).toBe(false);
    watch.onEvents([ev('RaidArrived', { partyId: 8, kind: 'siege', size: 12 }), ev('RaidArrived', { partyId: 9, kind: 'siege', size: 12 })]);
    expect(watch.tense).toBe(true);
    watch.onEvents([ev('RaidEnded', { partyId: 8, outcome: 'repelled' })]);
    expect(watch.tense).toBe(true);
    watch.onEvents([ev('RaidEnded', { partyId: 9, outcome: 'wiped' })]);
    expect(watch.tense).toBe(false);
    watch.reset({ hearth: false, sieges: [3] });
    expect(watch.tense).toBe(true);
    watch.reset();
    expect(watch.tense).toBe(false);
  });

  it('the mood follows the scene and the danger', () => {
    expect(moodOf('menu', true)).toBe('menu');
    expect(moodOf('fortress', false)).toBe('fortress');
    expect(moodOf('fortress', true)).toBe('tense');
  });

  const tunes: TuneLength[] = [
    { id: 'm', role: 'menu', seconds: 30 },
    { id: 'f1', role: 'fortress', seconds: 60 },
    { id: 'f2', role: 'fortress', seconds: 60 },
    { id: 'f3', role: 'fortress', seconds: 60 },
    { id: 't', role: 'tense', seconds: 20 },
  ];

  it('plays the menu theme again after its pause', () => {
    const d = new MusicDirector(tunes, () => 0);
    expect(d.update(0, 'menu')).toBeNull();
    expect(d.update(MUSIC_CHANGE_GAP_S, 'menu')).toEqual({ kind: 'play', tune: 'm' });
    expect(d.update(MUSIC_CHANGE_GAP_S + 29, 'menu')).toBeNull();
    expect(d.update(MUSIC_CHANGE_GAP_S + 30, 'menu')).toBeNull();
    expect(d.update(MUSIC_CHANGE_GAP_S + 30 + MUSIC_MENU_GAP_S, 'menu')).toEqual({ kind: 'play', tune: 'm' });
  });

  it('plays the fortress pieces in turn with a silence between them', () => {
    let draw = 0.5;
    const d = new MusicDirector(tunes, () => draw);
    // Entering the fortress from the menu: the theme fades, a fortress piece follows.
    d.update(0, 'menu');
    d.update(MUSIC_CHANGE_GAP_S, 'menu');
    expect(d.update(10, 'fortress')).toEqual({ kind: 'stop' });
    const first = d.update(10 + MUSIC_CHANGE_GAP_S, 'fortress');
    expect(first).toEqual({ kind: 'play', tune: 'f2' });
    let now = 10 + MUSIC_CHANGE_GAP_S;
    const order: string[] = [];
    for (let k = 0; k < 4; k += 1) {
      now += 60;
      draw = k % 2 === 0 ? 0 : 1;
      expect(d.update(now, 'fortress')).toBeNull();
      const silence = draw === 0 ? MUSIC_SILENCE_MIN_S : MUSIC_SILENCE_MAX_S;
      expect(d.update(now + silence - 1, 'fortress')).toBeNull();
      const cue = d.update(now + silence, 'fortress');
      expect(cue?.kind).toBe('play');
      order.push(cue?.kind === 'play' ? cue.tune : '');
      now += silence;
    }
    expect(order).toEqual(['f3', 'f1', 'f2', 'f3']);
  });

  it('turns tense at once when the danger comes and back after a silence when it ends', () => {
    const d = new MusicDirector(tunes, () => 0);
    d.update(0, 'fortress');
    expect(d.update(MUSIC_CHANGE_GAP_S, 'fortress')).toEqual({ kind: 'play', tune: 'f1' });
    expect(d.update(20, 'tense')).toEqual({ kind: 'stop' });
    expect(d.update(20 + MUSIC_CHANGE_GAP_S, 'tense')).toEqual({ kind: 'play', tune: 't' });
    expect(d.update(20 + MUSIC_CHANGE_GAP_S + 20, 'tense')).toBeNull();
    expect(d.update(20 + MUSIC_CHANGE_GAP_S + 20 + MUSIC_TENSE_GAP_S, 'tense')).toEqual({ kind: 'play', tune: 't' });
    const calm = 100;
    expect(d.update(calm, 'fortress')).toEqual({ kind: 'stop' });
    expect(d.update(calm + MUSIC_SILENCE_MIN_S - 1, 'fortress')).toBeNull();
    expect(d.update(calm + MUSIC_SILENCE_MIN_S, 'fortress')).toEqual({ kind: 'play', tune: 'f2' });
    // Music off stops the piece; music on starts again after the change gap.
    expect(d.update(200, null)).toEqual({ kind: 'stop' });
    expect(d.update(300, null)).toBeNull();
    expect(d.update(400, 'fortress')).toBeNull();
    expect(d.update(400 + MUSIC_CHANGE_GAP_S, 'fortress')?.kind).toBe('play');
  });

  it('the app follows the bus: a hearth alert in a running fortress plays the tense tune', async () => {
    const g = game();
    await g.start({ embark: 'default' });
    const synth = new FakeSynth();
    g.music.attach(() => synth);
    expect(g.musicScene).toBe('fortress');
    g.updateMusic();
    synth.now = MUSIC_CHANGE_GAP_S;
    g.updateMusic();
    expect(registry.table<TuneDef>('tunes').byId(g.music.current ?? '')?.role).toBe('fortress');
    expect(synth.played.length).toBeGreaterThan(0);
    expect(synth.volume).toBeCloseTo(volumeGain(DEFAULT_USER_SETTINGS.musicVolume), 9);
    g.host.submit({ type: 'SetAlert', level: 'hearth' } as never);
    g.host.step(1);
    synth.now += 1;
    g.updateMusic();
    expect(synth.fades).toBe(1);
    synth.now += MUSIC_CHANGE_GAP_S;
    g.updateMusic();
    expect(registry.table<TuneDef>('tunes').byId(g.music.current ?? '')?.role).toBe('tense');
    // Every note handed over is within the lookahead of the clock.
    for (const { time } of synth.played) expect(time).toBeLessThanOrEqual(synth.now + 1.01);
  });
});

describe('T-422 settings: volume and the mute key', () => {
  it('reads the music settings, falling back field by field', () => {
    expect(readSettings({ music: false, musicVolume: 30, soundVolume: 70 })).toMatchObject({ music: false, musicVolume: 30, soundVolume: 70 });
    expect(readSettings({ musicVolume: 33, soundVolume: 'loud' })).toMatchObject({ music: true, musicVolume: DEFAULT_USER_SETTINGS.musicVolume, soundVolume: DEFAULT_USER_SETTINGS.soundVolume });
    expect(readSettings({ musicVolume: 120 }).musicVolume).toBe(DEFAULT_USER_SETTINGS.musicVolume);
    expect(volumeGain(100)).toBeCloseTo(MUSIC_MASTER_GAIN, 9);
    expect(volumeGain(0)).toBe(0);
  });

  it('the settings screen changes the volume and the music, and they survive a reload', async () => {
    const store = new SettingsStore(new MemoryStorage());
    const first = game(store);
    const screen = new SettingsScreen({
      keymap: first.keymap, strings: first.strings, settings: () => first.userSettings,
      change: (patch) => first.changeSettings(patch), bindingsChanged: () => undefined, resetDefaults: () => first.resetSettings(), back: () => undefined,
    });
    for (let k = 0; k < 10; k += 1) screen.key(press('ArrowDown'));
    screen.key(press('ArrowLeft'));
    screen.key(press('ArrowLeft'));
    expect(first.userSettings.musicVolume).toBe(30);
    screen.key(press('ArrowDown'));
    screen.key(press('Enter'));
    expect(first.userSettings.music).toBe(false);
    await first.settled();
    const second = game(store);
    await second.loadSettings();
    expect(second.userSettings.music).toBe(false);
    expect(second.userSettings.musicVolume).toBe(30);
    expect((await store.load())?.preferences.soundVolume).toBe(DEFAULT_USER_SETTINGS.soundVolume);
  });

  it('the mute key works on the main menu and in the fortress, rebound too, and is saved', async () => {
    const store = new SettingsStore(new MemoryStorage());
    const g = game(store);
    await g.showMainMenu();
    expect(g.screen).toBe('main_menu');
    expect(g.handleKey(press('m', { ctrl: true }))).toBe(true);
    expect(g.userSettings.music).toBe(false);
    await g.settled();
    expect((await store.load())?.preferences.music).toBe(false);
    await g.start({ embark: 'default' });
    expect(g.handleKey(press('m', { ctrl: true }))).toBe(true);
    expect(g.userSettings.music).toBe(true);
    expect(g.textRows().join('\n')).toContain('Music on.');
    const mute = g.keymap.bindings.findIndex((b) => b.context === 'global' && b.id === 'music');
    expect(g.keymap.nameOf(mute)).toBe('global/music');
    expect(g.keymap.rebind(mute, { key: 'F7', ctrl: false, shift: false })).toBeNull();
    g.handleKey(press('m', { ctrl: true }));
    expect(g.userSettings.music).toBe(true);
    g.handleKey(press('F7'));
    expect(g.userSettings.music).toBe(false);
  });
});

describe('T-422 no audio context where there must be none', () => {
  it('a game, its menus, its keys, its events and its music make none without an output', async () => {
    countAudioContexts();
    const g = game();
    await g.showMainMenu();
    g.handleKey(press('m', { ctrl: true }));
    g.handleKey(press('m', { ctrl: true }));
    g.updateMusic();
    await g.start({ embark: 'default' });
    g.host.step(50);
    g.updateMusic();
    expect(g.music.attached).toBe(false);
    expect(g.music.current).toBeNull();
    expect(made).toBe(0);
  });

  it('a headless run makes none', () => {
    countAudioContexts();
    const headless = new HeadlessGame({ seed: 't422-headless', world: 'flat-test', embark: 'default' });
    headless.step(100);
    expect(made).toBe(0);
  });

  it('the gate makes a context only after a key press or click, and only while music is wanted', () => {
    const listeners: Record<string, (event: never) => void> = {};
    const target = { addEventListener: (type: string, fn: (event: never) => void) => { listeners[type] = fn; }, removeEventListener: () => undefined };
    let wanted = true;
    let created = 0;
    const gate = new AudioGate(() => wanted, () => { created += 1; return null; }, 1);
    gate.attach(target);
    expect(gate.output()).toBeNull();
    expect(created).toBe(0);
    wanted = false;
    listeners['keydown']?.(undefined as never);
    expect(gate.unlocked).toBe(true);
    expect(gate.output()).toBeNull();
    expect(created).toBe(0);
    wanted = true;
    listeners['pointerdown']?.(undefined as never);
    expect(created).toBe(1);
    // A browser without Web Audio stays silent and is not asked again.
    expect(gate.output()).toBeNull();
    expect(created).toBe(1);
  });

  it('a Music without an output never asks for the clock', () => {
    const music = new Music(registry, () => 0);
    music.onEvents([ev('AlertChanged', { from: 'calm', to: 'hearth' })]);
    music.update('fortress', DEFAULT_USER_SETTINGS);
    expect(music.watch.tense).toBe(true);
    expect(music.current).toBeNull();
  });
});
