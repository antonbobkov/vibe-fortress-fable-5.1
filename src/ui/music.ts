/**
 * The music of `02-systems/24-ui-and-input.md` § Music: a presentation listener on the event bus.
 *
 * {@link TenseWatch} reads the events for the danger that makes the music tense (the hearth alert, a
 * siege on the map); {@link MusicDirector} decides what plays when, from the mood and a clock;
 * {@link MusicPlayer} hands a piece's notes to the synthesizer a little ahead of time; {@link Music}
 * puts them together for the app. None of it reads or writes the simulation beyond its events and
 * readers, and none of it uses the simulation's random streams.
 */

import type { GameEvent } from '@core/events';
import type { Registry } from '@core/registry';
import { parseScore, type InstrumentDef, type TuneDef } from '@content/schema';
import type { SynthNote, SynthOut, SynthPiece, SynthVoice } from '@platform/audio';
import {
  MUSIC_CHANGE_GAP_S,
  MUSIC_FADE_S,
  MUSIC_LOOKAHEAD_S,
  MUSIC_MASTER_GAIN,
  MUSIC_MENU_GAP_S,
  MUSIC_SILENCE_MAX_S,
  MUSIC_SILENCE_MIN_S,
  MUSIC_TAIL_S,
  MUSIC_TENSE_GAP_S,
  DEFAULT_USER_SETTINGS,
} from './constants';

/**
 * Where the player is: the intro, the screens before a fortress, or a running fortress and the
 * screens over it.
 */
export type MusicScene = 'intro' | 'menu' | 'fortress';

/** What kind of piece plays: a tune's role in `music.md` § Tunes. */
export type MusicMood = TuneDef['role'];

/** Which intro plays (the Intro style setting); each style has a piece of its own. */
export type IntroStyle = 'deep' | 'hall';

/** The moods of the intros' pieces: each plays once, and the menu theme follows it. */
const INTRO_MOODS: ReadonlySet<MusicMood> = new Set<MusicMood>(['intro', 'deep_intro']);

/**
 * The mood of a scene: the intro has a piece of its own for each style (`deep_intro` for the deep
 * intro, `intro` for the hall), the screens before a fortress the menu theme, and a fortress in
 * danger is tense.
 */
export function moodOf(scene: MusicScene, tense: boolean, introStyle: IntroStyle = DEFAULT_USER_SETTINGS.introStyle): MusicMood {
  if (scene === 'intro') return introStyle === 'deep' ? 'deep_intro' : 'intro';
  if (scene === 'menu') return 'menu';
  return tense ? 'tense' : 'fortress';
}

/** The loudness of the music at a volume of 0 to 100: a square law, so the steps sound even. */
export function volumeGain(volume: number): number {
  const share = Math.max(0, Math.min(100, volume)) / 100;
  return MUSIC_MASTER_GAIN * share * share;
}

/**
 * The danger that makes the music tense, from events on the bus: the hearth alert
 * (`AlertChanged` to `hearth`, until it changes again) and every siege on the map (`RaidArrived` of
 * kind `siege`, until that party's `RaidEnded`).
 */
export class TenseWatch {
  private hearth = false;
  private readonly sieges = new Set<number>();

  get tense(): boolean {
    return this.hearth || this.sieges.size > 0;
  }

  onEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'AlertChanged') this.hearth = event['to'] === 'hearth';
      else if (event.type === 'RaidArrived' && event['kind'] === 'siege') this.sieges.add(Number(event['partyId']));
      else if (event.type === 'RaidEnded') this.sieges.delete(Number(event['partyId']));
    }
  }

  /** Start again from the world as it is (a new or loaded fortress): its alert and its sieges. */
  reset(state: { readonly hearth: boolean; readonly sieges: readonly number[] } = { hearth: false, sieges: [] }): void {
    this.hearth = state.hearth;
    this.sieges.clear();
    for (const id of state.sieges) this.sieges.add(id);
  }
}

/** A piece to start, or the playing piece to fade out. */
export type MusicCue = { readonly kind: 'play'; readonly tune: string } | { readonly kind: 'stop' };

/** A tune as the director needs it: its role and how long it plays. */
export interface TuneLength {
  readonly id: string;
  readonly role: MusicMood;
  readonly seconds: number;
}

/**
 * What plays when. The intro's piece plays once; when it ends, the menu theme follows after
 * {@link MUSIC_CHANGE_GAP_S}, as it does when the intro is left. Of the other moods, the fortress
 * pieces play in turn with a silence of {@link MUSIC_SILENCE_MIN_S} to {@link MUSIC_SILENCE_MAX_S}
 * seconds between them, the menu theme and the tense piece again after a short pause. A change of
 * mood fades out the piece that plays and starts the new mood's after {@link MUSIC_CHANGE_GAP_S},
 * except that the fortress pieces come back after a whole silence when the danger is over. A `null`
 * mood is silence (music off).
 */
export class MusicDirector {
  private mood: MusicMood | null = null;
  private playing: { readonly tune: string; endsAt: number } | null = null;
  private quietUntil = 0;
  /** The clock when the director was paused, or `null`. */
  private pausedAt: number | null = null;
  /** Whether the intro's piece has played to its end during this intro. */
  private introEnded = false;
  private readonly byRole: Readonly<Record<MusicMood, readonly TuneLength[]>>;
  private readonly turns: Record<MusicMood, number>;

  constructor(tunes: readonly TuneLength[], private readonly random: () => number) {
    const of = (role: MusicMood): TuneLength[] => tunes.filter((tune) => tune.role === role);
    this.byRole = { intro: of('intro'), deep_intro: of('deep_intro'), menu: of('menu'), fortress: of('fortress'), tense: of('tense') };
    // The fortress pieces begin at a random one of them; each mood then goes round in table order.
    this.turns = { intro: 0, deep_intro: 0, menu: 0, fortress: Math.floor(random() * Math.max(1, this.byRole.fortress.length)), tense: 0 };
  }

  /** The tune playing now, if any. */
  get current(): string | null {
    return this.playing?.tune ?? null;
  }

  private silence(): number {
    return MUSIC_SILENCE_MIN_S + this.random() * (MUSIC_SILENCE_MAX_S - MUSIC_SILENCE_MIN_S);
  }

  private gapAfter(mood: MusicMood): number {
    return mood === 'fortress' ? this.silence() : mood === 'menu' || INTRO_MOODS.has(mood) ? MUSIC_MENU_GAP_S : MUSIC_TENSE_GAP_S;
  }

  /** Stop the clock at `now` (the document is hidden): the piece and the silence keep what they have left. */
  pause(now: number): void {
    this.pausedAt ??= now;
  }

  /** Start the clock again at `now`: the time paused does not count against the piece or the silence. */
  resume(now: number): void {
    if (this.pausedAt === null) return;
    const away = Math.max(0, now - this.pausedAt);
    this.pausedAt = null;
    if (this.playing !== null) this.playing.endsAt += away;
    this.quietUntil += away;
  }

  /** At `now` seconds, with the mood the game is in: what to start or stop, if anything. */
  update(now: number, requested: MusicMood | null): MusicCue | null {
    // The intro's piece is heard once; with none, or after it, the intro is the menu's mood.
    let mood = requested;
    if (mood !== null && INTRO_MOODS.has(mood) && (this.byRole[mood].length === 0 || this.introEnded)) mood = 'menu';
    else if (mood !== null && !INTRO_MOODS.has(mood)) this.introEnded = false;
    if (mood !== this.mood) {
      const was = this.mood;
      this.mood = mood;
      this.quietUntil = now + (was === 'tense' && mood === 'fortress' ? this.silence() : MUSIC_CHANGE_GAP_S);
      if (this.playing !== null) {
        this.playing = null;
        return { kind: 'stop' };
      }
    }
    if (mood === null) return null;
    if (this.playing !== null && now >= this.playing.endsAt) {
      this.playing = null;
      if (INTRO_MOODS.has(mood)) {
        this.introEnded = true;
        mood = 'menu';
        this.mood = 'menu';
        this.quietUntil = now + MUSIC_CHANGE_GAP_S;
      } else this.quietUntil = now + this.gapAfter(mood);
    }
    if (this.playing !== null || now < this.quietUntil) return null;
    const list = this.byRole[mood];
    const tune = list[this.turns[mood] % Math.max(1, list.length)];
    if (tune === undefined) return null;
    this.turns[mood] += 1;
    this.playing = { tune: tune.id, endsAt: now + tune.seconds };
    return { kind: 'play', tune: tune.id };
  }
}

/** A tune made ready to play: its notes in time order, in seconds. */
export interface Arrangement {
  readonly id: string;
  readonly notes: readonly SynthNote[];
  /** Its length with the tail its last notes need. */
  readonly seconds: number;
}

/** The synthesizer's voice for an instrument row. */
export function voiceOf(instrument: InstrumentDef): SynthVoice {
  return {
    wave: instrument.wave,
    attack: instrument.attackMs / 1000,
    decay: instrument.decayMs / 1000,
    sustain: instrument.sustainPercent / 100,
    release: instrument.releaseMs / 1000,
    level: instrument.levelPercent / 100,
    filterHz: instrument.filterHz,
    detuneCents: instrument.detuneCents,
    reverb: instrument.reverbPercent / 100,
  };
}

/** The frequency of a MIDI pitch (A4 = 69 = 440 Hz). */
export function frequencyOf(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

/** A tune's notes, every voice together, in seconds. */
export function arrange(tune: TuneDef, instrument: (id: string) => InstrumentDef | undefined): Arrangement {
  const stepSeconds = 60 / tune.tempo;
  const notes: SynthNote[] = [];
  let steps = 0;
  for (const part of tune.voices) {
    const row = instrument(part.instrument);
    const score = parseScore(part.notes);
    if (row === undefined || typeof score === 'string') continue;
    const voice = voiceOf(row);
    steps = Math.max(steps, score.steps);
    for (const note of score.notes) {
      notes.push({ at: note.start * stepSeconds, duration: note.steps * stepSeconds, freqs: note.pitches.map(frequencyOf), voice });
    }
  }
  notes.sort((a, b) => a.at - b.at);
  return { id: tune.id, notes, seconds: steps * stepSeconds + MUSIC_TAIL_S };
}

/** Plays one piece at a time, handing its notes to the synthesizer {@link MUSIC_LOOKAHEAD_S} ahead. */
export class MusicPlayer {
  private piece: { readonly notes: readonly SynthNote[]; next: number; readonly start: number; readonly bus: SynthPiece } | null = null;
  /** The piece set aside while the document is hidden, and how far into it the music had got. */
  private paused: { readonly notes: readonly SynthNote[]; readonly position: number } | null = null;

  get playing(): boolean {
    return this.piece !== null;
  }

  start(arrangement: Arrangement, synth: SynthOut): void {
    this.stop();
    this.piece = { notes: arrangement.notes, next: 0, start: synth.now + 0.1, bus: synth.begin() };
    this.pump(synth);
  }

  stop(): void {
    this.piece?.bus.fadeOut(MUSIC_FADE_S);
    this.piece = null;
    this.paused = null;
  }

  /** Set the piece aside where it is: its sound fades out and it is kept to go on from there. */
  pause(synth: SynthOut): void {
    const piece = this.piece;
    if (piece === null) return;
    this.paused = { notes: piece.notes, position: Math.max(0, synth.now - piece.start) };
    piece.bus.fadeOut(MUSIC_FADE_S);
    this.piece = null;
  }

  /** Go on with the piece set aside, from the place it had reached. */
  resume(synth: SynthOut): void {
    const paused = this.paused;
    if (paused === null) return;
    this.paused = null;
    const next = paused.notes.findIndex((note) => note.at >= paused.position);
    this.piece = { notes: paused.notes, next: next < 0 ? paused.notes.length : next, start: synth.now + 0.1 - paused.position, bus: synth.begin() };
    this.pump(synth);
  }

  /** Schedule the notes that start within the lookahead; a note whose time went by unplayed (a hidden tab) is skipped. */
  pump(synth: SynthOut): void {
    const piece = this.piece;
    if (piece === null) return;
    const now = synth.now;
    while (piece.next < piece.notes.length) {
      const note = piece.notes[piece.next] as SynthNote;
      const time = piece.start + note.at;
      if (time > now + MUSIC_LOOKAHEAD_S) break;
      if (time >= now) piece.bus.play(note, time);
      piece.next += 1;
    }
  }
}

/** The settings the music follows. */
export interface MusicSettings {
  readonly music: boolean;
  readonly musicVolume: number;
  /** The intro's piece is the one of the chosen intro style (the setting's default when absent). */
  readonly introStyle?: IntroStyle;
}

/**
 * The music for the app: it listens to the world's events, and each frame it asks the synthesizer
 * for the time, lets the director choose and lets the player play. Without an output (headless, the
 * tests, an e2e build, or before the first key press or click) it only follows the events.
 */
export class Music {
  readonly watch = new TenseWatch();
  private readonly director: MusicDirector;
  private readonly player = new MusicPlayer();
  private readonly tunes: ReadonlyMap<string, TuneDef>;
  private readonly arrangements = new Map<string, Arrangement>();
  private output: (() => SynthOut | null) | null = null;
  /** The synthesizer the last frame used: where a pause reads the clock. */
  private synth: SynthOut | null = null;
  /** Whether the document is hidden. */
  private hidden = false;
  /** Whether the director and the player are paused, until the first frame after the document is shown. */
  private paused = false;

  constructor(private readonly registry: Registry, random: () => number) {
    const table = registry.table<TuneDef>('tunes');
    const tunes = table.ids().map((id) => table.byId(id) as TuneDef);
    this.tunes = new Map(tunes.map((tune) => [tune.id, tune]));
    this.director = new MusicDirector(tunes.map((tune) => ({ id: tune.id, role: tune.role, seconds: this.arrangement(tune.id).seconds })), random);
  }

  /** Give the music somewhere to play: the audio gate's synthesizer. */
  attach(output: () => SynthOut | null): void {
    this.output = output;
  }

  get attached(): boolean {
    return this.output !== null;
  }

  /** The tune playing now, if any. */
  get current(): string | null {
    return this.director.current;
  }

  onEvents(events: readonly GameEvent[]): void {
    this.watch.onEvents(events);
  }

  /**
   * The document was hidden or shown (`visibilitychange`). While it is hidden the piece fades out
   * and the clock stops; the first frame after it is shown goes on from where the piece was.
   */
  setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (hidden && this.synth !== null && !this.paused) this.pause(this.synth);
  }

  private pause(synth: SynthOut): void {
    this.paused = true;
    this.director.pause(synth.now);
    this.player.pause(synth);
  }

  private arrangement(id: string): Arrangement {
    let out = this.arrangements.get(id);
    if (out === undefined) {
      const instruments = this.registry.table<InstrumentDef>('instruments');
      out = arrange(this.tunes.get(id) as TuneDef, (instrument) => instruments.byId(instrument));
      this.arrangements.set(id, out);
    }
    return out;
  }

  /** Once a frame. */
  update(scene: MusicScene, settings: MusicSettings): void {
    if (this.output === null) return;
    const on = settings.music && settings.musicVolume > 0;
    const synth = this.output();
    if (synth === null) return;
    this.synth = synth;
    synth.setAudible(on);
    synth.setVolume(on ? volumeGain(settings.musicVolume) : 0);
    if (this.hidden) {
      if (!this.paused) this.pause(synth);
      return;
    }
    const goOn = this.paused;
    if (goOn) {
      this.paused = false;
      this.director.resume(synth.now);
    }
    const cue = this.director.update(synth.now, on ? moodOf(scene, this.watch.tense, settings.introStyle) : null);
    if (cue?.kind === 'stop') this.player.stop();
    else if (cue?.kind === 'play') this.player.start(this.arrangement(cue.tune), synth);
    else if (goOn) this.player.resume(synth);
    this.player.pump(synth);
  }
}
