import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { LegendScreen, legendLines, legendRows, type LegendRecord } from '@ui/screens/legend';
import { press, strings, surface } from './ui-fixture';

/** The peril-4 playtest's fall: a cause, a milestone and two last words longer than a row of 76 cells. */
const CAUSE = 'The hall fell silent on Day 24 of Autumn, Year 1. The last dwarf, Gunnar Copperroot, has been killed by a gloam captain of the northern warband.';
const MILESTONE = 'The first raid was driven off at the gate by the three soldiers of the Ember Guard and their dogs.';
const STOCKPILE = '! 26 food will rot within 3 days; the largest stack is 6 turnip in Stockpile #2 by the eastern door.';
const FIGHT = '!! 3 dwarves are fighting 3 gloam archers, 5 gloam warriors and a gloam captain at the north gate.';

function record(extraWords: readonly string[] = []): LegendRecord {
  return {
    id: 'final-emberstair', name: 'Emberstair', seed: 'playtest-1125-p4c', region: 'Region 0', biome: 'forest', wealthRating: 2, perilRating: 4,
    foundedTick: 0, endedTick: 78 * TICKS_PER_DAY, yearsSurvived: 0, daysSurvived: 78, peakPopulation: 9, deepestLevel: 8, finalWealth: 4563,
    milestones: [{ id: 'm_raid', date: 'Day 6 of Autumn, Year 1', text: MILESTONE }],
    killsOfNote: ['Gunnar Stonehall slew 1 enemy.'],
    lastWords: [FIGHT, STOCKPILE, ...extraWords],
    cause: CAUSE,
  };
}

/** The words of a text, to find each on screen. */
function words(text: string): string[] {
  return text.split(' ').filter((word) => word !== '');
}

describe('T-747 the legend wraps its lines at the screen width', () => {
  it('shows every word of a long cause, milestone and last word at 80 columns, each continuation indented', () => {
    const rec = record();
    const screen = new LegendScreen([rec], { back: () => {}, strings }, rec.id);
    const s = surface(80, 50);
    screen.draw(s);
    const lines = s.lines();
    const shown = lines.join('\n');
    for (const text of [CAUSE, MILESTONE, STOCKPILE, FIGHT]) for (const word of words(text)) expect(shown, word).toContain(word);
    // No row runs past the screen's edge less its margin, and none is cut mid-word.
    for (const line of lines) expect(line.trimEnd().length).toBeLessThanOrEqual(78);
    expect(shown).not.toContain('Gunnar Cop\n');

    // The cause: its date sentence is a row of its own, and the last dwarf starts the next.
    const fell = lines.findIndex((line) => line.trim() === 'The hall fell silent on Day 24 of Autumn, Year 1.');
    expect(fell).toBeGreaterThan(0);
    expect(lines[fell + 1]?.startsWith('  The last dwarf, Gunnar Copperroot,')).toBe(true);
    // Its continuation stands two cells under its own text.
    expect(lines[fell + 2]?.startsWith('    ')).toBe(true);
    expect(lines[fell + 2]?.[4]).not.toBe(' ');

    // A milestone's continuation lines up after its date.
    const milestone = lines.findIndex((line) => line.includes('Day 6 of Autumn, Year 1  The first raid'));
    const afterDate = 2 + 2 + 'Day 6 of Autumn, Year 1'.length + 2;
    expect(lines[milestone + 1]?.slice(0, afterDate).trim()).toBe('');
    expect(lines[milestone + 1]?.[afterDate]).not.toBe(' ');

    // A last word's continuation lines up after its "!! " or "! " mark.
    const fight = lines.findIndex((line) => line.includes('!! 3 dwarves are fighting'));
    expect(lines[fight + 1]?.slice(0, 7).trim()).toBe('');
    expect(lines[fight + 1]?.[7]).not.toBe(' ');
    const stockpile = lines.findIndex((line) => line.includes('! 26 food will rot'));
    expect(lines[stockpile + 1]?.slice(0, 6).trim()).toBe('');
    expect(lines[stockpile + 1]?.[6]).not.toBe(' ');
  });

  it('keeps the cause whole in the record and puts its date sentence and the last dwarf on lines of their own', () => {
    const lines = legendLines(record(), strings);
    expect(lines).toContain('The hall fell silent on Day 24 of Autumn, Year 1.');
    expect(lines).toContain('The last dwarf, Gunnar Copperroot, has been killed by a gloam captain of the northern warband.');
    // A one-sentence cause stays one line.
    expect(legendLines({ ...record(), cause: 'Retired in Year 8 with 61 dwarves.' }, strings)).toContain('Retired in Year 8 with 61 dwarves.');
  });

  it('scrolls by wrapped rows: End reaches the last row and the scroll line counts the rows', () => {
    const rec = record(Array.from({ length: 30 }, (_, i) => `! Old line ${i} that is long enough to wrap onto a second row of the legend screen.`));
    const total = legendRows(rec, strings, 76).length;
    expect(total).toBeGreaterThan(legendLines(rec, strings).length + 30);
    const screen = new LegendScreen([rec], { back: () => {}, strings }, rec.id);
    const s = surface(80, 25);
    screen.draw(s);
    const rows = 25 - 5;
    screen.key(press('End'));
    expect(screen.scroll).toBe(total - rows);
    screen.draw(s);
    expect(s.lines().join('\n')).toContain(`Scroll ${total - rows + 1}/${total}`);
    // The last wrapped row is on the page's last row.
    expect(s.lines()[3 + rows - 1]?.trim()).toMatch(/screen\.$/);
    expect(s.lines()[3 + rows - 2]).toContain('! Old line 29');
    for (let i = 0; i < 10; i += 1) screen.key(press('↓'));
    expect(screen.scroll).toBe(total - rows);
    screen.key(press('PageUp'));
    expect(screen.scroll).toBe(total - rows - (rows - 1));
  });

  it('cuts a Legends list row too long for its row with »', () => {
    const long = { ...record(), id: 'final-long', name: 'The Hall of the Ever-Burning Hearth Beneath the Ashen Peaks', region: 'The Great Northern Ashfell Highlands' };
    const screen = new LegendScreen([record(), long], { back: () => {}, strings });
    const s = surface(80, 25);
    screen.draw(s);
    const row = s.lines()[4] as string;
    expect(row.trimEnd()).toHaveLength(78);
    expect(row.trimEnd().endsWith('»')).toBe(true);
    expect(s.lines()[3]).toContain('Emberstair');
  });
});
