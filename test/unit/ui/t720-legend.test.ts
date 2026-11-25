import { describe, expect, it } from 'vitest';
import { lastWords } from '@app/legend';
import { TICKS_PER_DAY } from '@core/constants';
import type { LogLine } from '@ui/announcements';
import { LegendScreen, legendLines, type LegendRecord } from '@ui/screens/legend';
import { press, strings, surface } from './ui-fixture';

const NAMES = ['Modi', 'Dagny', 'Rurik', 'Ulfhild Beareye'];

function line(day: number, severity: LogLine['severity'], text: string, count = 1): LogLine {
  return { tick: day * TICKS_PER_DAY + 100, severity, text, count };
}

/** A fortress's log as the second playtest's: a starving line and a rising every day, three deaths among them. */
function reedholmLog(): LogLine[] {
  const log: LogLine[] = [];
  log.push(line(2, 'alert', strings.get('announce.cavern_breached')));
  for (let day = 10; day < 40; day += 1) {
    const names = NAMES.slice(0, 2 + (day % 3));
    log.push(line(day, 'note', `Note ${day}`));
    log.push(line(day, 'alert', strings.get('announce.starving_many', { n: names.length, names: names.join(', ') })));
    if (day >= 26) log.push(line(day, 'alert', strings.get('announce.restless_rose')));
    if (day === 12) log.push(line(day, 'danger', strings.get('announce.died.killed_by', { name: 'Borin Wolfcloak', killer: 'a gloam warrior' })));
    if (day === 30) log.push(line(day, 'danger', strings.get('announce.died.starvation', { name: 'Ulfhild Beareye' })));
    if (day === 38) log.push(line(day, 'danger', strings.get('announce.died.starvation', { name: 'Dagny' })));
  }
  return log;
}

function record(lastWordsLines: readonly string[]): LegendRecord {
  return {
    id: 'final-reedholm', name: 'Reedholm', seed: 'deep-2346-1', region: 'Reedholm', biome: 'forest', wealthRating: 2, perilRating: 2,
    foundedTick: 0, endedTick: 98 * TICKS_PER_DAY, yearsSurvived: 0, daysSurvived: 98, peakPopulation: 11, deepestLevel: 5, finalWealth: 1200,
    milestones: [{ id: 'm_hearth', date: 'Day 1 of Spring, Year 1', text: 'The hearth was lit.' }],
    killsOfNote: [], lastWords: lastWordsLines, cause: 'Abandoned in Year 1 by 11 dwarves.',
  };
}

describe('T-720 the legend scrolls to its end, and its last words fold repeats', () => {
  it('folds thirty daily starving lines into one with its day count and keeps every death, newest first', () => {
    const words = lastWords(reedholmLog(), strings);
    const starving = words.filter((text) => text.includes('are starving'));
    expect(starving).toEqual([`! ${strings.get('announce.starving_many', { n: 2, names: 'Modi, Dagny' })} (30 days)`]);
    expect(words.filter((text) => text.includes('restless dead rise'))).toEqual(['! The restless dead rise. (14 days)']);
    expect(words.filter((text) => text.startsWith('!! '))).toEqual([
      '!! Dagny has starved to death.',
      '!! Ulfhild Beareye has starved to death.',
      '!! Borin Wolfcloak has been killed by a gloam warrior.',
    ]);
    expect(words).toContain('! A cavern has been breached.');
    expect(words).toHaveLength(6);
    expect(new Set(words).size).toBe(words.length);
    // Newest first: day 39's rising leads, then its starving line; the breach (day 2) ends.
    expect(words[0]).toContain('restless dead rise');
    expect(words[1]).toContain('are starving');
    expect(words[words.length - 1]).toBe('! A cavern has been breached.');
  });

  it('folds a line about one dwarf per dwarf, and merges lines of one day into a count', () => {
    const log = [
      line(5, 'alert', strings.get('announce.starving', { dwarf: 'Modi' })),
      line(6, 'alert', strings.get('announce.starving', { dwarf: 'Modi' })),
      line(6, 'alert', strings.get('announce.starving', { dwarf: 'Rurik' })),
      line(7, 'alert', 'Something no template says.', 2),
      line(7, 'alert', 'Something no template says.'),
    ];
    expect(lastWords(log, strings)).toEqual([
      '! Something no template says. ×3',
      '! Rurik is starving.',
      '! Modi is starving. (2 days)',
    ]);
  });

  it('keeps deaths before other alerts when more kinds than fit', () => {
    const log: LogLine[] = [line(1, 'danger', strings.get('announce.died.drowned', { name: 'Eldest' }))];
    for (let i = 0; i < 60; i += 1) log.push(line(2 + i, 'alert', `Distinct alert ${i}.`));
    const words = lastWords(log, strings);
    expect(words).toHaveLength(50);
    expect(words).toContain('!! Eldest has drowned.');
    expect(words[0]).toBe('! Distinct alert 59.');
  });

  it('stops ↓ at the last line, and PageDown, End and Home move by a page and to the ends', () => {
    const rec = record(lastWords(reedholmLog(), strings).concat(Array.from({ length: 40 }, (_, i) => `! Old line ${i}.`)));
    const total = legendLines(rec, strings).length;
    const screen = new LegendScreen([rec], { back: () => {}, strings }, rec.id);
    const s = surface(80, 25);
    screen.draw(s);
    const rows = 25 - 5;
    expect(total).toBeGreaterThan(rows);
    for (let i = 0; i < 100; i += 1) screen.key(press('↓'));
    expect(screen.scroll).toBe(total - rows);
    screen.draw(s);
    expect(s.lines().join('\n')).toContain(`Scroll ${total - rows + 1}/${total}`);
    // The last line is on the page, on its last row.
    expect(s.lines()[3 + rows - 1]).toContain('Old line 39.');
    screen.key(press('Home'));
    expect(screen.scroll).toBe(0);
    screen.key(press('PageDown'));
    expect(screen.scroll).toBe(rows - 1);
    screen.key(press('End'));
    expect(screen.scroll).toBe(total - rows);
    screen.key(press('PageDown'));
    expect(screen.scroll).toBe(total - rows);
    screen.key(press('PageUp'));
    expect(screen.scroll).toBe(total - rows - (rows - 1));
    for (let i = 0; i < 20; i += 1) screen.wheel({ col: 0, row: 0, dy: 1 } as Parameters<LegendScreen['wheel']>[0]);
    expect(screen.scroll).toBe(total - rows);
  });
});
