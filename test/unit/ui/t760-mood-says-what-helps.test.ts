/**
 * T-760: "X is miserable" from the second day, and nothing said what would help (playtest
 * 2026-11-25, finding 6). The Mood panel's summary says what helps under its three heaviest negative
 * thoughts, a dwarf's row and its view under its strongest negative thought that has a remedy, and
 * the first miserable line of a fortress brings `hint_mood` (`panels.md` § Mood, 24 § Hints).
 */
import { describe, expect, it, vi } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { EntityId } from '@core/types';
import type { MoraleReader, ThoughtView } from '@systems/morale';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import type { PanelContext } from '@ui/panels/context';
import { drawCreatureView } from '@ui/panels/look';
import { drawMoodPanel, MoodPanel } from '@ui/panels/mood';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const THOUGHTS: ThoughtView[] = [
  { id: 'uncomfortable', text: 'There is nowhere to sit.', value: -4, remainingHours: null },
  { id: 'friend_died', text: 'My friend is dead.', value: -15, remainingHours: 48 },
  { id: 'slept_outdoors', text: 'Slept under the sky.', value: -5, remainingHours: 20 },
];

const SIT = 'Helps: a chair at a table in a dining room, or a hearth hall [b > Special]';
const SKY = 'Helps: a bed indoors: a dug hall with beds or pallets';

function ctxOf(w: TestWorld): PanelContext {
  return {
    readers: w.readers, registry: w.game.registry, strings,
    submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
}

/** Three dwarves who each hold the three thoughts above. */
function setup() {
  const w = new TestWorld({ seed: 't760-helps', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ids = ['Asa', 'Njal', 'Liv'].map((name, k) => w.spawnDwarf({ at: w.index(10 + k, 10, Z), name }));
  w.step(2);
  vi.spyOn(w.readers.of<MoraleReader>('15'), 'thoughts').mockImplementation(() => THOUGHTS.map((t) => ({ ...t })));
  return { w, ids };
}

/** The rows' text, each joined to the rows it wraps onto (those that start further in). */
function joined(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const last = out.length - 1;
    if (last >= 0 && /^ {5,}\S/.test(line) && !/^\s*(Helps:|[+-]\d)/.test(trimmed)) out[last] = `${out[last] as string} ${trimmed}`;
    else out.push(trimmed);
  }
  return out;
}

describe('T-760 the mood says what helps', () => {
  it('the summary gives the two remedies under its thoughts, and none for a thought without one', () => {
    const { w } = setup();
    const s = surface(36, 40);
    drawMoodPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, new MoodPanel(), ctxOf(w));
    const rows = joined(s.lines());
    const at = (start: string): number => rows.findIndex((r) => r.startsWith(start));
    const held = at('Thoughts held by most');
    const names = at('Name');
    const summary = rows.slice(held + 1, names).map((r) => r.replace(/ +/g, ' '));
    expect(summary).toEqual([
      '-15 My friend is dead. x3',
      '-5 Slept under the sky. x3',
      SKY,
      '-4 There is nowhere to sit. x3',
      SIT,
    ]);
    // Each dwarf's row: the line for its strongest negative thought that has one, the sky's.
    const asa = rows.slice(at('Asa'), at('Njal'));
    expect(asa[0]).toMatch(/^Asa +\w+$/);
    expect(asa.slice(1)).toEqual(['-15 My friend is dead.', '-5 Slept under the sky.', SKY, '-4 There is nowhere to sit.']);
  });

  it("the dwarf's view gives the line under its strongest negative thought that has one", () => {
    const { w, ids } = setup();
    const s = surface(36, 60);
    drawCreatureView(s, { col: 0, row: 0, cols: 36, rows: 60 }, w.readers, w.game.registry, strings, ids[0] as EntityId, Z);
    const rows = joined(s.lines());
    const sky = rows.indexOf('-5 Slept under the sky.');
    expect(sky).toBeGreaterThan(0);
    expect(rows[sky + 1]).toBe(SKY);
    expect(rows.filter((r) => r.startsWith('Helps:'))).toHaveLength(1);
  });

  it('the first miserable line brings hint_mood once, after it', () => {
    const { w, ids } = setup();
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const hints = new HintEngine(w.game.registry, defaultUiState(Z), log);
    const fall = (id: EntityId, to: number): void => {
      const event = { type: 'MoodTierChanged', id, from: to + 1, to } as unknown as GameEvent;
      log.announce(event, w.readers, w.tick);
      hints.onEvents([event], w.readers);
    };
    const hint = '☼ A miserable dwarf works slower and may sulk. The Mood panel [e] says what helps.';
    // A fall to Unhappy makes no line, and no hint.
    fall(ids[0] as EntityId, 1);
    expect(log.lines.map((l) => l.text)).not.toContain(hint);
    fall(ids[0] as EntityId, 0);
    fall(ids[1] as EntityId, 0);
    w.step(TICKS_PER_DAY);
    fall(ids[2] as EntityId, 0);
    const texts = log.lines.map((l) => l.text);
    expect(texts.filter((t) => t === hint)).toHaveLength(1);
    const first = texts.findIndex((t) => t.startsWith('2 dwarves are miserable: Asa, Njal.'));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(texts.indexOf(hint)).toBe(first + 1);
  });
});
