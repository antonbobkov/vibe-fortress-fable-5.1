/** T-614: the log panel's `/filter` field keeps the entries whose text contains the typed text. */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { AnnouncementLog } from '@ui/announcements';
import { drawLogPanel, LogView } from '@ui/panels/log';
import { Strings } from '@ui/strings';
import { Game } from '@app/game';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, registry, strings, surface } from './ui-fixture';

const SIDEBAR = { col: 0, row: 0, cols: 36, rows: 20 };

function wolfLog(): AnnouncementLog {
  const log = new AnnouncementLog(new Strings(registry), registry);
  log.append('note', 'Ketil found hematite.', 2 * TICKS_PER_DAY);
  log.append('alert', 'A wolf was seen at the edge.', 3 * TICKS_PER_DAY, 40);
  log.append('note', 'Stockpile #2 is full.', 4 * TICKS_PER_DAY);
  log.append('danger', 'The WOLF attacks Brynja.', 5 * TICKS_PER_DAY, 41);
  log.append('note', 'A caravan arrives.', 6 * TICKS_PER_DAY);
  return log;
}

describe('T-614 the log panel filter', () => {
  it('draws the field under the tabs and lists only the entries containing the text, ignoring case, within the tab', () => {
    const log = wolfLog();
    const view = new LogView();
    const draw = (tab: 0 | 1 | 2) => {
      const s = surface(SIDEBAR.cols, SIDEBAR.rows);
      drawLogPanel(s, SIDEBAR, log.lines, tab, strings, 6 * TICKS_PER_DAY, () => {}, view);
      return s.lines().join('\n');
    };
    let text = draw(0);
    expect(text.split('\n')[1]).toContain('/filter:');
    for (const line of ['hematite', 'wolf was seen', 'Stockpile', 'WOLF attacks', 'caravan']) expect(text).toContain(line);
    view.filter.value = 'wolf';
    text = draw(0);
    expect(text).toContain('A wolf was seen');
    expect(text).toContain('The WOLF attacks');
    for (const line of ['hematite', 'Stockpile', 'caravan']) expect(text).not.toContain(line);
    // The newest match is selected.
    expect(view.line?.text).toBe('The WOLF attacks Brynja.');
    // Within the Alerts tab; with no match the list says so.
    view.filter.value = 'caravan';
    text = draw(1);
    expect(text).not.toContain('A caravan arrives');
    expect(text).toContain(strings.get('ui.log.no_match'));
  });

  it('types on the fortress screen after /, counts in the title, and is cleared by Esc then closing the panel', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 't614-log-filter', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const f = game.fortress;
    const tick = game.host.readers.calendar.tick;
    f.log.append('note', 'Zorbleflax the merchant came.', tick);
    for (let k = 0; k < 12; k += 1) f.log.append('note', `Line ${k}.`, tick);
    f.log.append('note', 'Zorbleflax left.', tick);
    game.handleKey(press('a'));
    expect(f.ui.panel).toBe('log');
    game.handleKey(press('ArrowDown'));
    game.handleKey(press('ArrowDown'));
    expect(f.logView.chosen).toBe(true);
    // `/` focuses the field; letters, digits and the panel's letter are text, not keys.
    game.handleKey(press('/'));
    expect(f.logView.filter.focused).toBe(true);
    for (const ch of 'zorbleflax') game.handleKey(press(ch));
    expect(f.ui.panel).toBe('log');
    expect(f.logView.filter.value).toBe('zorbleflax');
    // Typing selects the newest matching entry, unmarked.
    expect(f.logView.chosen).toBe(false);
    const s = surface(160, 50);
    f.draw(s);
    const screen = s.lines().join('\n');
    expect(screen).toContain('Zorbleflax left.');
    expect(screen).toContain('Zorbleflax the merchant');
    expect(screen).not.toContain('Line 3.');
    expect(screen).toMatch(/Log · 2 of \d+ · filter: zorbl/);
    // Esc finishes typing and keeps the text; the arrows then move over the matches.
    game.handleKey(press('Esc'));
    expect(f.logView.filter.focused).toBe(false);
    expect(f.logView.filter.value).toBe('zorbleflax');
    expect(f.ui.panel).toBe('log');
    // The next Esc closes the panel, which clears the filter.
    game.handleKey(press('Esc'));
    expect(f.ui.panel).toBeNull();
    expect(f.logView.filter.value).toBe('');
    game.handleKey(press('a'));
    const again = surface(160, 50);
    f.draw(again);
    expect(again.lines().join('\n')).toContain('Line 11.');
    // Closing with the panel's own key clears it too.
    game.handleKey(press('/'));
    game.handleKey(press('l'));
    game.handleKey(press('i'));
    game.handleKey(press('Enter'));
    expect(f.logView.filter.value).toBe('li');
    game.handleKey(press('a'));
    expect(f.ui.panel).toBeNull();
    expect(f.logView.filter.value).toBe('');
  });
});
