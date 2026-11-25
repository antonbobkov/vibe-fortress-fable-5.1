/**
 * T-725: a log line keeps the string key it was written from, through a save, and the legend's last
 * words fold by it. A line with no key (an older save's) is still read back from its text (T-720).
 */
import { describe, expect, it } from 'vitest';
import { lastWords } from '@app/legend';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import { AnnouncementLog, type LogLine } from '@ui/announcements';
import { defaultUiState, fromSaved, toSaved, type SavedUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const event = (fields: Record<string, unknown>): GameEvent => fields as unknown as GameEvent;

/** A dwarf and a cow both called Modi, each starving on its own day: two lines of the same words. */
function twoModis() {
  const w = new TestWorld({ seed: 't725-modi', world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 10 * TICKS_PER_DAY });
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  const dwarf = w.spawnDwarf({ at: w.index(10, 10, z), name: 'Modi' });
  const cow = w.spawnTame('cow', w.index(12, 10, z));
  expect(w.game.world.applyCommand({ type: 'NameAnimal', animalId: cow, name: 'Modi' }).ok).toBe(true);
  const day = 10 * TICKS_PER_DAY + 100;
  log.announce(event({ type: 'Starving', id: dwarf, need: 'hunger' }), w.readers, day);
  log.announce(event({ type: 'AnimalStarving', id: cow }), w.readers, day + TICKS_PER_DAY);
  return { w, log, dwarf, cow, day };
}

/** The log through a save and a load, as the `ui` section carries it. */
function reloaded(lines: readonly LogLine[], strip = false): LogLine[] {
  const saved = JSON.parse(JSON.stringify(toSaved(defaultUiState(z), lines))) as { logTail: Record<string, unknown>[] };
  if (strip) for (const line of saved.logTail) delete line['key'];
  return fromSaved(defaultUiState(z), saved as unknown as SavedUiState);
}

describe('T-725 a log line keeps the string key it was written from', () => {
  it('the announcer writes the key, a growing line takes its new key, and both survive a save and a load', () => {
    const { w, log, dwarf, day } = twoModis();
    expect(log.lines.map((l) => [l.text, l.key])).toEqual([
      ['Modi is starving.', 'announce.starving'],
      ['Modi is starving.', 'announce.animal_starving'],
    ]);
    // A second dwarf on the dwarf's day: the line names them both, by the many-dwarves key.
    const other = w.spawnDwarf({ at: w.index(14, 10, z), name: 'Rurik Stonehand' });
    log.announce(event({ type: 'Starving', id: other, need: 'hunger' }), w.readers, day + 2 * TICKS_PER_DAY);
    log.announce(event({ type: 'Starving', id: dwarf, need: 'hunger' }), w.readers, day + 2 * TICKS_PER_DAY + 10);
    const many = log.lines[log.lines.length - 1];
    expect(many?.text).toBe(strings.get('announce.starving_many', { n: 2, names: 'Rurik, Modi' }));
    expect(many?.key).toBe('announce.starving_many');
    const saved = toSaved(defaultUiState(z), log.lines);
    expect(saved.logTail.map((l) => l.key)).toEqual(['announce.starving', 'announce.animal_starving', 'announce.starving_many']);
    expect(reloaded(log.lines).map((l) => l.key)).toEqual(['announce.starving', 'announce.animal_starving', 'announce.starving_many']);
    // A line the UI writes itself has no key, and saves none.
    log.append('alert', 'Cannot place that here.', day + 3 * TICKS_PER_DAY);
    expect(toSaved(defaultUiState(z), log.lines).logTail.at(-1)).toEqual({ tick: day + 3 * TICKS_PER_DAY, severity: 'alert', text: 'Cannot place that here.' });
  });

  it('the last words fold by key: a dwarf and an animal of one name starving do not fold together, as the text alone would have', () => {
    const { log } = twoModis();
    expect(lastWords(reloaded(log.lines), strings)).toEqual(['! Modi is starving.', '! Modi is starving.']);
    // The text alone reads both as one template, the same creature: one line of two days.
    expect(lastWords(reloaded(log.lines, true), strings)).toEqual(['! Modi is starving. (2 days)']);
  });

  it('a line with a key folds per creature by that key, and an older save’s lines still fold by their text', () => {
    const at = (day: number): number => day * TICKS_PER_DAY + 100;
    const keyed: LogLine[] = [
      { tick: at(5), severity: 'alert', text: 'Modi is starving.', count: 1, key: 'announce.starving' },
      { tick: at(6), severity: 'alert', text: 'Modi is starving.', count: 1, key: 'announce.starving' },
      { tick: at(6), severity: 'alert', text: 'Rurik is starving.', count: 1, key: 'announce.starving' },
      { tick: at(7), severity: 'alert', text: 'The restless dead rise.', count: 1, key: 'announce.restless_rose' },
      { tick: at(8), severity: 'danger', text: 'Modi has starved to death.', count: 1, key: 'announce.died.starvation' },
      { tick: at(9), severity: 'danger', text: 'Rurik has starved to death.', count: 1, key: 'announce.died.starvation' },
    ];
    const expected = [
      '!! Rurik has starved to death.',
      '!! Modi has starved to death.',
      '! The restless dead rise.',
      '! Rurik is starving.',
      '! Modi is starving. (2 days)',
    ];
    expect(lastWords(reloaded(keyed), strings)).toEqual(expected);
    const old = reloaded(keyed, true);
    expect(old.every((l) => l.key === undefined)).toBe(true);
    expect(lastWords(old, strings)).toEqual(expected);
  });
});
