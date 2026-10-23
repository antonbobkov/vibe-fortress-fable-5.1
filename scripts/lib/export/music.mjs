// docs/03-content/music.md -> instruments, tunes.

import { join } from 'node:path';
import { CONTENT_DIR, asObjects, findTable, id, int, plain, readTables, ticked } from '../md-tables.mjs';

const MUSIC = () => readTables(join(CONTENT_DIR, 'music.md'));

export function exportInstruments() {
  const table = findTable(MUSIC(), 'Instruments', 'Wave');
  return asObjects(table).map((row) => ({
    id: id(row.id),
    name: plain(row.name),
    wave: plain(row.Wave),
    attackMs: int(row['Attack (ms)']),
    decayMs: int(row['Decay (ms)']),
    sustainPercent: int(row['Sustain (%)']),
    releaseMs: int(row['Release (ms)']),
    levelPercent: int(row['Level (%)']),
    filterHz: int(row['Filter (Hz)']),
    detuneCents: int(row['Detune (cents)']),
    reverbPercent: int(row['Reverb (%)']),
  }));
}

/** Each tune row with its score: the rows of one voice run on, in table order. */
export function exportTunes() {
  const tables = MUSIC();
  const tunes = findTable(tables, 'Tunes', 'Role');
  return asObjects(tunes).map((row) => {
    const tuneId = id(row.id);
    const score = tables.find((t) => t.headings[t.headings.length - 1] === tuneId && t.headings.includes('Scores'));
    if (score === undefined) throw new Error(`music.md: no score for ${tuneId}`);
    const voices = [];
    for (const line of asObjects(score)) {
      const n = int(line.Voice);
      const instrument = id(line.Instrument);
      const notes = ticked(line.Notes).join(' ');
      const voice = voices.find((v) => v.n === n);
      if (voice === undefined) voices.push({ n, instrument, notes });
      else {
        if (voice.instrument !== instrument) throw new Error(`music.md: ${tuneId} voice ${n} changes instrument`);
        voice.notes = `${voice.notes} ${notes}`;
      }
    }
    return {
      id: tuneId,
      name: plain(row.name),
      role: plain(row.Role),
      tempo: int(row['Tempo (steps/min)']),
      mode: plain(row.Mode),
      source: plain(row.Source),
      voices: voices.map(({ instrument, notes }) => ({ instrument, notes })),
    };
  });
}
