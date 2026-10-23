/**
 * The Web Audio adapter of `02-systems/24-ui-and-input.md` § Music: a small synthesizer that plays
 * notes, and the gate that creates the audio context only after the player's first key press or
 * click (the browsers' autoplay policy). This is the only module that touches `AudioContext`; the
 * headless runner, the tests and the e2e build never load a gate, so they create none.
 */

import type { EventTargetLike } from './input';

/** How one note sounds: an instrument row in seconds and shares of one (03-content/music.md). */
export interface SynthVoice {
  readonly wave: 'sine' | 'triangle' | 'sawtooth';
  readonly attack: number;
  readonly decay: number;
  /** Share of the peak held after the decay. */
  readonly sustain: number;
  readonly release: number;
  /** Peak loudness, a share of one. */
  readonly level: number;
  readonly filterHz: number;
  /** A second oscillator this many cents apart; 0 for one oscillator. */
  readonly detuneCents: number;
  /** Share sent to the reverb. */
  readonly reverb: number;
}

/** One note of a piece: when it starts after the piece's start and how long it lasts, in seconds. */
export interface SynthNote {
  readonly at: number;
  readonly duration: number;
  readonly freqs: readonly number[];
  readonly voice: SynthVoice;
}

/** One piece being played: its notes go through one bus, which fades out as a whole. */
export interface SynthPiece {
  /** Play a note at `time` on the audio clock. */
  play(note: SynthNote, time: number): void;
  fadeOut(seconds: number): void;
}

/** The synthesizer the music player drives. */
export interface SynthOut {
  /** The audio clock, in seconds. */
  readonly now: number;
  begin(): SynthPiece;
  /** The master gain, from 0. */
  setVolume(gain: number): void;
}

/** A deterministic noise source for the reverb's impulse, so no two loads differ. */
function noise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x80000000 - 1;
  };
}

/** The synthesizer over a Web Audio context: a master gain, a cave reverb, and a bus per piece. */
export class WebAudioSynth implements SynthOut {
  private readonly master: GainNode;
  private readonly reverb: ConvolverNode;
  private volume = -1;

  constructor(private readonly ctx: AudioContext, reverbSeconds: number) {
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    const length = Math.max(1, Math.floor(ctx.sampleRate * reverbSeconds));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      const next = noise(0x9e3779b9 + channel);
      for (let i = 0; i < length; i += 1) data[i] = next() * Math.pow(1 - i / length, 3);
    }
    this.reverb.buffer = impulse;
    this.reverb.connect(this.master);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  setVolume(gain: number): void {
    if (gain === this.volume) return;
    this.volume = gain;
    this.master.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
  }

  begin(): SynthPiece {
    const ctx = this.ctx;
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    dry.connect(this.master);
    wet.connect(this.reverb);
    let ended = false;
    return {
      play: (note, time) => {
        if (ended) return;
        const voice = note.voice;
        const end = time + note.duration;
        const attack = Math.min(voice.attack, note.duration * 0.9);
        // A chord shares the voice's loudness.
        const peak = voice.level / Math.sqrt(Math.max(1, note.freqs.length));
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(peak, time + attack);
        env.gain.setTargetAtTime(peak * voice.sustain, time + attack, Math.max(0.01, voice.decay / 3));
        env.gain.setTargetAtTime(0, end, Math.max(0.01, voice.release / 3));
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = voice.filterHz;
        filter.Q.value = 0.5;
        filter.connect(env);
        env.connect(dry);
        let send: GainNode | null = null;
        if (voice.reverb > 0) {
          send = ctx.createGain();
          send.gain.value = voice.reverb;
          env.connect(send);
          send.connect(wet);
        }
        const stop = end + voice.release * 1.5 + 0.05;
        const detunes = voice.detuneCents > 0 ? [-voice.detuneCents / 2, voice.detuneCents / 2] : [0];
        let live = 0;
        for (const freq of note.freqs) {
          for (const detune of detunes) {
            const osc = ctx.createOscillator();
            osc.type = voice.wave;
            osc.frequency.value = freq;
            osc.detune.value = detune;
            osc.connect(filter);
            osc.start(time);
            osc.stop(stop);
            live += 1;
            osc.onended = () => {
              osc.disconnect();
              live -= 1;
              if (live === 0) { filter.disconnect(); env.disconnect(); send?.disconnect(); }
            };
          }
        }
      },
      fadeOut: (seconds) => {
        if (ended) return;
        ended = true;
        const now = ctx.currentTime;
        for (const bus of [dry, wet]) {
          bus.gain.setValueAtTime(bus.gain.value, now);
          bus.gain.linearRampToValueAtTime(0, now + seconds);
        }
        setTimeout(() => { dry.disconnect(); wet.disconnect(); }, (seconds + 4) * 1000);
      },
    };
  }
}

/**
 * The audio context, made on demand and never before a key press or a click: the browser lets a
 * page start sound only after the player has used it. `wanted` says whether music should sound now
 * (on, with some volume); while it is not, no context is made.
 */
export class AudioGate {
  private gestured = false;
  private synth: WebAudioSynth | null = null;
  private ctx: AudioContext | null = null;
  private failed = false;

  constructor(
    private readonly wanted: () => boolean,
    private readonly create: () => AudioContext | null,
    private readonly reverbSeconds: number,
  ) {}

  /** Listen for the first gesture on `target`; every gesture also resumes a suspended context. */
  attach(target: EventTargetLike): void {
    const gesture = (): void => {
      this.gestured = true;
      if (this.wanted()) this.output();
      if (this.ctx !== null && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    };
    target.addEventListener('keydown', gesture, true);
    target.addEventListener('pointerdown', gesture, true);
  }

  /** Whether a key press or click has happened. */
  get unlocked(): boolean {
    return this.gestured;
  }

  /** The synthesizer: made after the first gesture while music is wanted, then kept. */
  output(): SynthOut | null {
    if (this.synth !== null) return this.synth;
    if (!this.gestured || this.failed || !this.wanted()) return null;
    try {
      this.ctx = this.create();
    } catch {
      this.ctx = null;
    }
    if (this.ctx === null) {
      this.failed = true;
      return null;
    }
    this.synth = new WebAudioSynth(this.ctx, this.reverbSeconds);
    return this.synth;
  }
}

/** The browser's audio context, or `null` where there is none. */
export function browserAudioContext(): AudioContext | null {
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  return Ctor === undefined ? null : new Ctor();
}
