/** T-608: the log panel wraps each entry under its own text, and a tooltip box wraps over as many rows as it needs. */
import { describe, expect, it, vi } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { AnnouncementLog } from '@ui/announcements';
import { drawLogPanel, LogView } from '@ui/panels/log';
import { drawTooltip } from '@ui/widgets';
import { Strings } from '@ui/strings';
import { Game } from '@app/game';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, registry, strings, surface } from './ui-fixture';

const SIDEBAR = { col: 0, row: 0, cols: 36, rows: 20 };

function shelterLog(): { log: AnnouncementLog; hint: string } {
  const log = new AnnouncementLog(new Strings(registry), registry);
  const hint = `☼ ${strings.get('hint.hint_shelter')}`;
  log.append('note', 'Ketil found hematite.', 2 * TICKS_PER_DAY);
  log.append('note', hint, 3 * TICKS_PER_DAY, undefined, 'hint');
  log.append('alert', 'Stockpile #2 is full.', 4 * TICKS_PER_DAY, 77);
  return { log, hint };
}

/** The panel's text rows, each without the margin, the date column and trailing blanks. */
function textRows(lines: readonly string[], from: number, to: number, dateCols: number): string[] {
  return lines.slice(from, to).map((line) => line.slice(1 + dateCols).trimEnd());
}

describe('T-608 the log panel wraps each entry', () => {
  it('draws hint_shelter whole, its last word included, wrapped under its text with the date column clear', () => {
    const { log, hint } = shelterLog();
    const s = surface(SIDEBAR.cols, SIDEBAR.rows);
    drawLogPanel(s, SIDEBAR, log.lines, 0, strings, 4 * TICKS_PER_DAY, () => {});
    const lines = s.lines();
    expect(lines[2]).toMatch(/^ Sp 5 ! Stockpile #2 is full\./);
    expect(lines[3]?.startsWith(' Sp 4 ☼ Wild beasts')).toBe(true);
    // Every row of the hint starts after the date column, the dates' cells are blank under the first.
    const hintRows: string[] = [];
    for (let row = 3; row < lines.length && !(lines[row] ?? '').includes('Sp 3'); row += 1) hintRows.push(lines[row] as string);
    expect(hintRows.length).toBeGreaterThan(4);
    for (const row of hintRows.slice(1)) expect(row.slice(0, 6)).toBe('      ');
    const text = textRows(hintRows, 0, hintRows.length, 5).join(' ');
    expect(text).toBe(hint);
    expect(text.endsWith('comes.')).toBe(true);
    expect(s.lines().join('\n')).not.toContain('»');
    // The older line follows the hint, and the foot names Enter.
    expect(lines[3 + hintRows.length]).toMatch(/^ Sp 3 Ketil found hematite\./);
    expect(lines[SIDEBAR.rows - 1]).toContain('[Enter] center on it');
  });

  it('selects, scrolls and pages by entries, and a click on any row of an entry is that entry', () => {
    const { log } = shelterLog();
    const view = new LogView();
    const focused: number[] = [];
    const draw = (rows: number) => {
      const s = surface(SIDEBAR.cols, rows);
      drawLogPanel(s, { ...SIDEBAR, rows }, log.lines, 0, strings, 4 * TICKS_PER_DAY, (line) => focused.push(line.focus ?? -1), view);
      return s;
    };
    let s = draw(20);
    // Nothing is inverted until an entry is chosen; the first ↓ marks the newest, the next moves on.
    expect(s.cells.get(8, 2).fg).toEqual(s.theme.alert);
    view.move(1);
    s = draw(20);
    expect(view.selected).toBe(0);
    expect(s.cells.get(8, 2).bg).toEqual(s.theme.alert);
    view.move(1);
    s = draw(20);
    expect(view.selected).toBe(1);
    expect(view.line?.category).toBe('hint');
    // Each of the hint's rows is inverted.
    for (let row = 3; row < 9; row += 1) expect(s.cells.get(1, row).fg).toEqual(s.theme.black);
    // A click on the hint's fifth row selects the hint, which has no focus to centre on.
    view.reset();
    s = draw(20);
    s.hitAt(10, 7)?.action();
    expect(view.selected).toBe(1);
    expect(focused).toEqual([]);
    s.hitAt(10, 2)?.action();
    expect(view.selected).toBe(0);
    expect(focused).toEqual([77]);
    // In a short panel the selected hint scrolls whole into view, and the scrollbar shows.
    view.move(1);
    s = draw(10);
    expect(view.scroll).toBe(1);
    expect(s.lines()[2]).toContain('☼ Wild beasts');
    const bar = s.lines().slice(2, 9).map((line) => Array.from(line)[34]).join('');
    expect(bar).toBe('│││█│││');
    // A page moves a page of entries less one, never past the oldest.
    view.page(1);
    s = draw(10);
    expect(view.selected).toBe(2);
    expect(s.lines()[2]).toContain('Ketil found hematite.');
  });

  it('keeps the selection on its line when newer lines arrive', () => {
    const { log } = shelterLog();
    const view = new LogView();
    const s = surface(SIDEBAR.cols, SIDEBAR.rows);
    view.move(2);
    drawLogPanel(s, SIDEBAR, log.lines, 0, strings, 4 * TICKS_PER_DAY, () => {}, view);
    expect(view.line?.text).toBe('Ketil found hematite.');
    log.append('note', 'A new line.', 5 * TICKS_PER_DAY);
    drawLogPanel(surface(SIDEBAR.cols, SIDEBAR.rows), SIDEBAR, log.lines, 0, strings, 5 * TICKS_PER_DAY, () => {}, view);
    expect(view.selected).toBe(3);
    expect(view.line?.text).toBe('Ketil found hematite.');
  });
});

describe('T-608 a tooltip box wraps over as many rows as it needs', () => {
  const words = Array.from({ length: 40 }, (_, k) => `word${String(k).padStart(2, '0')}`);
  const long = words.join(' ');

  it('draws every word of a clipped 200-character label above the hovered cell', () => {
    expect(long.length).toBeGreaterThanOrEqual(200);
    const s = surface(80, 30);
    s.tooltip({ col: 50, row: 20, cols: 20, rows: 1 }, long);
    drawTooltip(s, { col: 55, row: 20 }, 24);
    const box = s.lines().slice(0, 20).join(' ');
    for (const word of words) expect(box).toContain(word);
    expect(box).not.toContain('»');
    // Four rows of at most 78 cells, ending on the row above the hovered cell; the hovered row is untouched.
    expect(s.lines()[15]?.trim()).toBe('');
    expect(s.lines()[16]?.trimStart().startsWith('[word00')).toBe(true);
    expect(s.lines()[19]?.trimEnd()).toMatch(/word39 +\]$/);
    expect(s.lines()[20]?.trim()).toBe('');
  });

  it('goes below the hovered cell when the rows above cannot hold it, and is at most the map view high', () => {
    const s = surface(80, 30);
    s.tooltip({ col: 0, row: 1, cols: 20, rows: 1 }, long);
    drawTooltip(s, { col: 3, row: 1 });
    expect(s.lines()[2]?.startsWith('[word00')).toBe(true);
    expect(s.lines()[5]?.trimEnd()).toMatch(/word39 +\]$/);
    const capped = surface(80, 30);
    capped.tooltip({ col: 0, row: 1, cols: 20, rows: 1 }, long);
    drawTooltip(capped, { col: 3, row: 1 }, 2);
    expect(capped.lines()[4]?.trim()).toBe('');
    expect(capped.lines()[3]?.trimEnd()).toMatch(/»\]$/);
  });

  it('keeps a tooltip that fits the window on one row', () => {
    const s = surface(80, 10);
    s.tooltip({ col: 10, row: 5, cols: 8, rows: 1 }, 'Full Tooltip Text');
    drawTooltip(s, { col: 12, row: 5 });
    expect(s.lines()[4]?.trimEnd()).toBe(`${' '.repeat(10)}[Full Tooltip Text]`);
    expect(s.lines()[3]?.trim()).toBe('');
  });
});

describe('T-608 the log panel keys on the fortress screen', () => {
  it('moves by entries with the arrows and PageDown, starts a new filter at the newest, and centres with Enter', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 't608-log-keys', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const f = game.fortress;
    const tick = game.host.readers.calendar.tick;
    const tile = game.host.readers.map.index(5, 5, game.ui.z);
    f.log.append('alert', 'An old alert.', tick, tile);
    for (let k = 0; k < 30; k += 1) f.log.append('note', `Line ${k}.`, tick);
    game.handleKey(press('a'));
    f.draw(surface(80, 50));
    expect(f.logView.chosen).toBe(false);
    game.handleKey(press('ArrowDown'));
    game.handleKey(press('ArrowDown'));
    expect(f.logView.selected).toBe(1);
    game.handleKey(press('PageDown'));
    f.draw(surface(80, 50));
    expect(f.logView.selected).toBeGreaterThan(10);
    // Another filter starts at the newest, unmarked: under Alerts that is the alert, and Enter centres the map on its tile.
    game.handleKey(press('2'));
    expect(f.logView.selected).toBe(0);
    expect(f.logView.chosen).toBe(false);
    f.draw(surface(80, 50));
    expect(f.logView.line?.text).toBe('An old alert.');
    const focus = vi.spyOn(f, 'focusOn');
    expect(game.handleKey(press('Enter'))).toBe(true);
    expect(focus).toHaveBeenCalledWith(tile);
  });
});
