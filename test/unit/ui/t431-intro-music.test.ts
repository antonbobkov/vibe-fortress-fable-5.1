/**
 * T-431: the intro's piece of music (24 § Music, 03-content/music.md `out_of_the_hold`). The `intro`
 * scene has a mood of its own; its tune plays once, and the menu theme follows it.
 */
import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { parseScore, type InstrumentDef, type TuneDef } from '@content/schema';
import type { SynthNote, SynthOut, SynthPiece } from '@platform/audio';
import { Music, MusicDirector, arrange, moodOf, type TuneLength } from '@ui/music';
import { MUSIC_CHANGE_GAP_S, MUSIC_MENU_GAP_S } from '@ui/constants';
import { DEFAULT_USER_SETTINGS } from '@ui/settings';

const registry = loadContent();
const tunes = registry.table<TuneDef>('tunes');
const instruments = registry.table<InstrumentDef>('instruments');

class FakeSynth implements SynthOut {
  now = 0;
  pieces = 0;
  fades = 0;
  readonly played: SynthNote[] = [];
  begin(): SynthPiece {
    this.pieces += 1;
    return { play: (note) => { this.played.push(note); }, fadeOut: () => { this.fades += 1; } };
  }
  setVolume(): void {}
  setAudible(): void {}
}

describe('T-431 the intro tune', () => {
  const rows = tunes.ids().map((id) => tunes.byId(id) as TuneDef);
  const intro = rows.filter((t) => t.role === 'intro');

  it('is one original piece of about 45 seconds whose voices have the same length', () => {
    expect(intro.map((t) => t.id)).toEqual(['out_of_the_hold']);
    const tune = intro[0] as TuneDef;
    expect(tune.source).toBe('original');
    const lengths = tune.voices.map((voice) => {
      const score = parseScore(voice.notes);
      return typeof score === 'string' ? -1 : score.steps;
    });
    expect(new Set(lengths).size).toBe(1);
    expect(lengths[0]).toBe(120);
    const seconds = arrange(tune, (id) => instruments.byId(id)).seconds;
    expect(seconds).toBeGreaterThan(40);
    expect(seconds).toBeLessThan(50);
    for (const voice of tune.voices) expect(instruments.byId(voice.instrument), voice.instrument).toBeDefined();
  });

  it('every sawtooth instrument is filtered at 2000 Hz or below', () => {
    for (const id of instruments.ids()) {
      const row = instruments.byId(id) as InstrumentDef;
      if (row.wave === 'sawtooth') expect(row.filterHz).toBeLessThanOrEqual(2000);
    }
  });
});

describe('T-431 the director\'s choice for the intro scene', () => {
  const list: TuneLength[] = [
    { id: 'i', role: 'intro', seconds: 45 },
    { id: 'm', role: 'menu', seconds: 30 },
    { id: 'f', role: 'fortress', seconds: 60 },
    { id: 't', role: 'tense', seconds: 20 },
  ];

  it('the intro scene has the intro mood', () => {
    expect(moodOf('intro', false)).toBe('intro');
    expect(moodOf('intro', true)).toBe('intro');
    expect(moodOf('menu', false)).toBe('menu');
  });

  it('opened from the menu: the theme fades, the intro piece starts after the change gap and plays once, then the menu theme follows after the change gap', () => {
    const d = new MusicDirector(list, () => 0);
    d.update(0, 'menu');
    expect(d.update(MUSIC_CHANGE_GAP_S, 'menu')).toEqual({ kind: 'play', tune: 'm' });
    expect(d.update(10, 'intro')).toEqual({ kind: 'stop' });
    expect(d.update(10 + MUSIC_CHANGE_GAP_S - 1, 'intro')).toBeNull();
    expect(d.update(10 + MUSIC_CHANGE_GAP_S, 'intro')).toEqual({ kind: 'play', tune: 'i' });
    const end = 10 + MUSIC_CHANGE_GAP_S + 45;
    expect(d.update(end - 1, 'intro')).toBeNull();
    // It ends while the intro still shows: no second turn, the menu theme comes after the change gap.
    expect(d.update(end, 'intro')).toBeNull();
    expect(d.update(end + MUSIC_CHANGE_GAP_S - 1, 'intro')).toBeNull();
    expect(d.update(end + MUSIC_CHANGE_GAP_S, 'intro')).toEqual({ kind: 'play', tune: 'm' });
    // The intro is left: nothing changes and the theme goes on.
    expect(d.update(end + MUSIC_CHANGE_GAP_S + 1, 'menu')).toBeNull();
    expect(d.current).toBe('m');
  });

  it('skipped: the intro piece fades out and the menu theme starts after the change gap', () => {
    const d = new MusicDirector(list, () => 0);
    d.update(0, 'intro');
    expect(d.update(MUSIC_CHANGE_GAP_S, 'intro')).toEqual({ kind: 'play', tune: 'i' });
    expect(d.update(MUSIC_CHANGE_GAP_S + 12, 'menu')).toEqual({ kind: 'stop' });
    expect(d.update(MUSIC_CHANGE_GAP_S + 12 + MUSIC_CHANGE_GAP_S - 1, 'menu')).toBeNull();
    expect(d.update(MUSIC_CHANGE_GAP_S + 12 + MUSIC_CHANGE_GAP_S, 'menu')).toEqual({ kind: 'play', tune: 'm' });
  });

  it('is heard again when the intro is opened again', () => {
    const d = new MusicDirector(list, () => 0);
    d.update(0, 'intro');
    d.update(MUSIC_CHANGE_GAP_S, 'intro');
    const end = MUSIC_CHANGE_GAP_S + 45;
    d.update(end, 'intro');
    expect(d.update(end + MUSIC_CHANGE_GAP_S, 'intro')).toEqual({ kind: 'play', tune: 'm' });
    expect(d.update(end + MUSIC_CHANGE_GAP_S + 1, 'menu')).toBeNull();
    expect(d.update(end + MUSIC_CHANGE_GAP_S + 5, 'intro')).toEqual({ kind: 'stop' });
    expect(d.update(end + MUSIC_CHANGE_GAP_S + 5 + MUSIC_CHANGE_GAP_S, 'intro')).toEqual({ kind: 'play', tune: 'i' });
    expect(MUSIC_MENU_GAP_S).toBeGreaterThan(MUSIC_CHANGE_GAP_S);
  });

  it('with no intro tune the intro is the menu\'s mood', () => {
    const d = new MusicDirector(list.filter((t) => t.role !== 'intro'), () => 0);
    d.update(0, 'intro');
    expect(d.update(MUSIC_CHANGE_GAP_S, 'intro')).toEqual({ kind: 'play', tune: 'm' });
    expect(d.update(MUSIC_CHANGE_GAP_S + 1, 'menu')).toBeNull();
  });
});

describe('T-431 the app plays the intro piece under the intro scene', () => {
  it('Music starts the intro tune on the intro scene and the menu tune when the scene is left', () => {
    const music = new Music(registry, () => 0);
    const synth = new FakeSynth();
    music.attach(() => synth);
    music.update('intro', DEFAULT_USER_SETTINGS);
    synth.now = MUSIC_CHANGE_GAP_S;
    music.update('intro', DEFAULT_USER_SETTINGS);
    expect(music.current).toBe('out_of_the_hold');
    expect(synth.played.length).toBeGreaterThan(0);
    synth.now += 5;
    music.update('menu', DEFAULT_USER_SETTINGS);
    expect(synth.fades).toBe(1);
    synth.now += MUSIC_CHANGE_GAP_S;
    music.update('menu', DEFAULT_USER_SETTINGS);
    expect(tunes.byId(music.current ?? '')?.role).toBe('menu');
  });
});
