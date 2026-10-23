/**
 * T-430: the music's audio context while music is off, interrupted or hidden (24 § Music). The
 * context is suspended while no music is wanted and resumed from any state but running or closed;
 * the director pauses while the document is hidden. Every test runs against a fake context or a
 * fake synthesizer: no AudioContext is created here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadContent } from '@content/loader';
import type { InstrumentDef, TuneDef } from '@content/schema';
import { AudioGate, resumeContext, type SynthNote, type SynthOut, type SynthPiece } from '@platform/audio';
import { Music, arrange } from '@ui/music';
import { MUSIC_CHANGE_GAP_S, MUSIC_SUSPEND_DELAY_S } from '@ui/constants';
import { DEFAULT_USER_SETTINGS } from '@ui/settings';

const registry = loadContent();

/** The parts of an AudioContext the synthesizer and the gate use, with its state kept by the test. */
class FakeContext {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  resumes = 0;
  suspends = 0;
  private node(): Record<string, unknown> {
    const param = { value: 0, setTargetAtTime: () => undefined, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined };
    return { gain: param, connect: () => undefined, disconnect: () => undefined };
  }
  createGain(): unknown { return this.node(); }
  createConvolver(): unknown { return { buffer: null, connect: () => undefined }; }
  createBuffer(_channels: number, length: number): unknown { return { getChannelData: () => new Float32Array(length) }; }
  resume(): Promise<void> { this.resumes += 1; this.state = 'running'; return Promise.resolve(); }
  suspend(): Promise<void> { this.suspends += 1; this.state = 'suspended'; return Promise.resolve(); }
}

interface Gate {
  readonly gate: AudioGate;
  readonly ctx: FakeContext;
  readonly created: () => number;
  readonly gesture: () => void;
  settings: { music: boolean; musicVolume: number };
  readonly music: Music;
  /** One frame of the music at the settings now. */
  frame(scene?: 'menu' | 'fortress'): void;
}

function gated(state = 'running'): Gate {
  const ctx = new FakeContext();
  ctx.state = state;
  let created = 0;
  const listeners: Record<string, (event: never) => void> = {};
  const target = { addEventListener: (type: string, fn: (event: never) => void) => { listeners[type] = fn; }, removeEventListener: () => undefined };
  const out: Gate = {
    ctx,
    created: () => created,
    settings: { ...DEFAULT_USER_SETTINGS, music: true, musicVolume: 50 },
    gesture: () => listeners['keydown']?.(undefined as never),
    music: new Music(registry, () => 0),
    frame(scene = 'menu') { this.music.update(scene, this.settings); },
    gate: new AudioGate(
      () => out.settings.music && out.settings.musicVolume > 0,
      () => { created += 1; return ctx as unknown as AudioContext; },
      0.01,
      MUSIC_SUSPEND_DELAY_S,
    ),
  };
  out.gate.attach(target);
  out.music.attach(() => out.gate.output());
  return out;
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('T-430 the context is suspended while no music is wanted', () => {
  it('suspends when music turns off, once the last piece has faded, and resumes when it turns on', async () => {
    const g = gated();
    g.gesture();
    g.frame();
    expect(g.created()).toBe(1);
    expect(g.ctx.suspends).toBe(0);
    g.settings = { ...g.settings, music: false };
    g.frame();
    expect(g.ctx.suspends).toBe(0);
    vi.advanceTimersByTime(MUSIC_SUSPEND_DELAY_S * 1000 - 1);
    expect(g.ctx.suspends).toBe(0);
    vi.advanceTimersByTime(2);
    expect(g.ctx.suspends).toBe(1);
    // It stays suspended while music is off, whatever the frames and gestures do.
    g.frame();
    g.gesture();
    vi.advanceTimersByTime(60_000);
    expect(g.ctx.suspends).toBe(1);
    expect(g.ctx.resumes).toBe(0);
    g.settings = { ...g.settings, music: true };
    g.frame();
    expect(g.ctx.resumes).toBe(1);
    expect(g.ctx.state).toBe('running');
    expect(g.created()).toBe(1);
  });

  it('suspends at volume 0 and resumes when the volume comes back', () => {
    const g = gated();
    g.gesture();
    g.frame();
    g.settings = { ...g.settings, musicVolume: 0 };
    g.frame();
    vi.advanceTimersByTime(MUSIC_SUSPEND_DELAY_S * 1000 + 1);
    expect(g.ctx.suspends).toBe(1);
    g.settings = { ...g.settings, musicVolume: 30 };
    g.frame();
    expect(g.ctx.resumes).toBe(1);
  });

  it('does not suspend when music comes back before the delay is over', () => {
    const g = gated();
    g.gesture();
    g.frame();
    g.settings = { ...g.settings, music: false };
    g.frame();
    vi.advanceTimersByTime(1000);
    g.settings = { ...g.settings, music: true };
    g.frame();
    vi.advanceTimersByTime(MUSIC_SUSPEND_DELAY_S * 1000 * 2);
    expect(g.ctx.suspends).toBe(0);
    expect(g.ctx.resumes).toBe(0);
  });

  it('makes no context while music is off, and none when the first gesture comes with it off', () => {
    const g = gated();
    g.settings = { ...g.settings, music: false };
    g.gesture();
    g.frame();
    expect(g.created()).toBe(0);
  });
});

describe('T-430 the gate resumes a context in any state but running or closed', () => {
  it.each([['suspended', 1], ['interrupted', 1], ['running', 0], ['closed', 0]] as const)('a gesture with the context %s resumes it %i time(s)', (state, resumes) => {
    const g = gated(state);
    g.gesture();
    g.frame();
    // The first gesture made the context; a later one finds it in the state the browser left it in.
    g.ctx.resumes = 0;
    g.ctx.state = state;
    g.gesture();
    expect(g.ctx.resumes).toBe(resumes);
  });

  it('resumeContext leaves a running or closed context alone and survives a refused resume', () => {
    const ctx = new FakeContext();
    ctx.state = 'interrupted';
    resumeContext(ctx as unknown as AudioContext);
    expect(ctx.resumes).toBe(1);
    ctx.state = 'closed';
    resumeContext(ctx as unknown as AudioContext);
    expect(ctx.resumes).toBe(1);
    const refused = { state: 'suspended', resume: () => Promise.reject(new Error('needs a gesture')) } as unknown as AudioContext;
    expect(() => resumeContext(refused)).not.toThrow();
  });
});

/** A synthesizer that records what it is asked to play, on a clock the test moves. */
class FakeSynth implements SynthOut {
  now = 0;
  pieces = 0;
  fades = 0;
  audible: boolean[] = [];
  readonly played: { note: SynthNote; time: number; piece: number }[] = [];
  begin(): SynthPiece {
    this.pieces += 1;
    const piece = this.pieces;
    return {
      play: (note, time) => { this.played.push({ note, time, piece }); },
      fadeOut: () => { this.fades += 1; },
    };
  }
  setVolume(): void {}
  setAudible(audible: boolean): void { this.audible.push(audible); }
}

function tuneSeconds(id: string): number {
  const instruments = registry.table<InstrumentDef>('instruments');
  return arrange(registry.table<TuneDef>('tunes').byId(id) as TuneDef, (instrument) => instruments.byId(instrument)).seconds;
}

function playing(): { music: Music; synth: FakeSynth } {
  const music = new Music(registry, () => 0);
  const synth = new FakeSynth();
  music.attach(() => synth);
  music.update('menu', DEFAULT_USER_SETTINGS);
  synth.now = MUSIC_CHANGE_GAP_S;
  music.update('menu', DEFAULT_USER_SETTINGS);
  expect(music.current).not.toBeNull();
  return { music, synth };
}

describe('T-430 the music pauses while the document is hidden', () => {
  it('keeps the piece, and goes on from where it was when the document shows again', () => {
    const { music, synth } = playing();
    const tune = music.current as string;
    const start = synth.now + 0.1;
    synth.now = start + 20;
    music.update('menu', DEFAULT_USER_SETTINGS);
    const playedBefore = synth.played.length;
    music.setHidden(true);
    expect(synth.fades).toBe(1);
    // A slow tick in the hidden tab neither plays nor ends the piece, however far the clock goes.
    synth.now = start + tuneSeconds(tune) + 500;
    music.update('menu', DEFAULT_USER_SETTINGS);
    music.update('menu', DEFAULT_USER_SETTINGS);
    expect(synth.played.length).toBe(playedBefore);
    expect(synth.pieces).toBe(1);
    expect(music.current).toBe(tune);
    music.setHidden(false);
    const resumedAt = synth.now + 1;
    for (let k = 0; k < 5; k += 1) {
      synth.now += 1;
      music.update('menu', DEFAULT_USER_SETTINGS);
    }
    // The same tune goes on with a bus of its own, from the place it had reached.
    expect(music.current).toBe(tune);
    expect(synth.pieces).toBe(2);
    const resumed = synth.played.slice(playedBefore);
    expect(resumed.length).toBeGreaterThan(0);
    expect(resumed.every((p) => p.piece === 2)).toBe(true);
    expect(Math.min(...resumed.map((p) => p.note.at))).toBeGreaterThanOrEqual(20 - 1e-6);
    expect(Math.min(...resumed.map((p) => p.time))).toBeGreaterThanOrEqual(resumedAt - 1e-6);
    // It is not over when the original end time has passed: the time hidden does not count.
    synth.now += 10;
    music.update('menu', DEFAULT_USER_SETTINGS);
    expect(music.current).toBe(tune);
  });

  it('starts the new mood\'s piece after the gap when the mood changed meanwhile', () => {
    const { music, synth } = playing();
    synth.now += 5;
    music.update('menu', DEFAULT_USER_SETTINGS);
    music.setHidden(true);
    synth.now += 200;
    music.update('fortress', DEFAULT_USER_SETTINGS);
    expect(synth.pieces).toBe(1);
    music.setHidden(false);
    music.update('fortress', DEFAULT_USER_SETTINGS);
    expect(music.current).toBeNull();
    expect(synth.pieces).toBe(1);
    synth.now += MUSIC_CHANGE_GAP_S - 0.5;
    music.update('fortress', DEFAULT_USER_SETTINGS);
    expect(synth.pieces).toBe(1);
    synth.now += 1;
    music.update('fortress', DEFAULT_USER_SETTINGS);
    expect(synth.pieces).toBe(2);
    expect(music.current).not.toBeNull();
  });

  it('keeps a silence between pieces going while hidden, and ignores a repeated event', () => {
    const music = new Music(registry, () => 0);
    const synth = new FakeSynth();
    music.attach(() => synth);
    synth.now = 1;
    music.update('menu', DEFAULT_USER_SETTINGS);
    music.setHidden(true);
    music.setHidden(true);
    synth.now = 1000;
    music.update('menu', DEFAULT_USER_SETTINGS);
    expect(synth.pieces).toBe(0);
    music.setHidden(false);
    music.setHidden(false);
    music.update('menu', DEFAULT_USER_SETTINGS);
    // The gap that was running when it was hidden still has its three seconds to go.
    expect(synth.pieces).toBe(0);
    synth.now += MUSIC_CHANGE_GAP_S;
    music.update('menu', DEFAULT_USER_SETTINGS);
    expect(synth.pieces).toBe(1);
  });

  it('a Music with no output ignores hiding and makes no context', () => {
    const made: number[] = [];
    const real = (globalThis as { AudioContext?: unknown }).AudioContext;
    (globalThis as { AudioContext?: unknown }).AudioContext = class { constructor() { made.push(1); } };
    try {
      const music = new Music(registry, () => 0);
      music.setHidden(true);
      music.update('menu', DEFAULT_USER_SETTINGS);
      music.setHidden(false);
      music.update('menu', DEFAULT_USER_SETTINGS);
      expect(made).toEqual([]);
    } finally {
      (globalThis as { AudioContext?: unknown }).AudioContext = real;
    }
  });
});
