/**
 * T-280: sidebar text is never cut without a mark; Help wraps and starts with how to begin; a hint
 * that does not fit takes two lines of the log strip; a panel with `[S-x]` captions says what S- is.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { label } from '@ui/widgets';
import { MemoryStorage } from '@platform/storage';
import { SaveManager } from '@app/save-manager';
import { drawLogStrip } from '@ui/panels/log';
import type { LogLine } from '@ui/announcements';
import { fgOfText, hexOf, press, surface, theme } from './ui-fixture';

async function game(width = 1280, height = 800): Promise<Game> {
  const g = new Game({ canvas: new MockCanvas(), seed: 't280', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width, height });
  await g.start({ embark: 'default' });
  return g;
}

describe('T-280 no text in the last column without a mark', () => {
  it('every panel, drawn in the sidebar at 80 columns, ends each row in its last drawable column with a blank, a scrollbar glyph or »', async () => {
    const g = await game();
    expect(g.viewCols).toBe(80);
    const ids = g.fortress.panels().map((p) => p.id);
    expect(ids.length).toBeGreaterThan(15);
    const bad: string[] = [];
    const empty: string[] = [];
    for (const id of ids) {
      g.fortress.openPanel(id);
      g.render();
      const s = g.uiSurface;
      if (s === null) throw new Error('no surface');
      const drawn = s.lines().filter((line, row) => row < s.rows - 5 && line.slice(44).trim().length > 1);
      if (drawn.length < 2 && id !== 'look') empty.push(id);
      s.lines().forEach((line, row) => {
        // The sidebar's rows: the log strip and the status rows below the map are not the panel's.
        if (row >= s.rows - 5) return;
        // The panel's last drawable column is the one before the screen's last (the margin). A row may fill
        // it exactly with a whole word (listed below); any other word reaching it may be cut without the mark.
        const chars = Array.from(line);
        const last = chars[s.cols - 2] ?? ' ';
        const before = chars[s.cols - 3] ?? ' ';
        if (/[\p{L}\p{N}]/u.test(last) && /[\p{L}\p{N}]/u.test(before)) bad.push(`${id}: ...${line.trimEnd().split(/[ /]/).pop() as string}`);
      });
    }
    expect(empty).toEqual([]);
    // Whole words that end exactly in the last column (each was read in the drawn panel; a cut word would end in »).
    expect(bad).toEqual([
      'designate: ...stair', 'help: ...Start', 'help: ...then', 'animals: ...name', 'jobs: ...reason',
      'labors: ...off', 'labors: ...labors', 'mood: ...thought', 'military: ...spears',
    ]);
  });
});

describe('T-280 the cut mark', () => {
  it('a label that does not fit ends with » and has a tooltip with the whole text', () => {
    const s = surface(20, 2);
    const n = label(s, 0, 0, 'A long caption here', { width: 8 });
    expect(n).toBe(8);
    expect(s.lines()[0]?.slice(0, 8)).toBe('A long »');
    expect(s.tooltipAt(3, 0)?.text).toBe('A long caption here');
    label(s, 0, 1, 'Fits', { width: 8 });
    expect(s.lines()[1]?.trimEnd()).toBe('Fits');
    expect(s.tooltipAt(1, 1)).toBeNull();
  });
});

describe('T-280 S- is Shift', () => {
  it('Designate ends with the note; the Calendar, which has no [S-x] caption, does not', async () => {
    const g = await game();
    g.fortress.openPanel('designate');
    g.render();
    const rows = g.uiSurface!.lines();
    const last = rows[rows.length - 6]; // the sidebar's last row, above the log strip and status rows
    expect(rows.some((line) => line.slice(45).trim() === 'S- is Shift'), String(last)).toBe(true);
    // And no designation caption is cut in the real sidebar.
    expect(rows.slice(0, 12).some((line) => line.slice(44).includes('»'))).toBe(false);
    g.fortress.openPanel('calendar');
    g.render();
    expect(g.uiSurface!.lines().some((line) => line.includes('S- is Shift'))).toBe(false);
  });

  it('a panel whose last row is used has no note', async () => {
    const g = await game();
    g.fortress.openPanel('units');
    g.render();
    expect(g.uiSurface!.lines().some((line) => line.includes('S- is Shift'))).toBe(false);
  });
});

describe('T-280 the tool keeps its full name in the status row', () => {
  it('the short Designate captions do not shorten the prompt', async () => {
    const g = await game();
    g.fortress.openPanel('designate');
    g.fortress.tool.choose('x');
    expect(g.fortress.statusRow2()).toContain('Remove construction');
    g.fortress.tool.choose('g');
    expect(g.fortress.statusRow2()).toContain('Gather plants');
  });
});

describe('T-280 Help', () => {
  it('opens on the Start tab the first time in a fortress and on the tab it was left at after that', async () => {
    const g = await game();
    g.handleKey(press('?'));
    expect(g.fortress.help.tab).toBe(2);
    g.fortress.help.setTab(1);
    g.handleKey(press('?'));
    expect(g.ui.panel).toBeNull();
    g.handleKey(press('?'));
    expect(g.fortress.help.tab).toBe(1);
    g.handleKey(press('3'));
    expect(g.fortress.help.tab).toBe(2);
    g.render();
    expect(g.textRows().join(' ')).toContain('1. Dig in: [d]');
  });

  it('PageDown moves a page less one line', async () => {
    const g = await game();
    g.handleKey(press('?'));
    g.handleKey(press('1'));
    g.render();
    const visible = g.fortress.help.visible;
    g.handleKey(press('PageDown'));
    expect(g.fortress.help.scroll).toBe(visible - 1);
    g.handleKey(press('PageUp'));
    expect(g.fortress.help.scroll).toBe(0);
  });
});

describe('T-280 hints', () => {
  it('a hint that does not fit one line takes two of the strip lines, whole, in the value colour', async () => {
    const g = await game();
    g.ui.panel = null;
    g.ui.sidebar = false;
    g.render();
    const rows = g.uiSurface!.lines();
    const at = rows.findIndex((line) => line.startsWith(' ☼ Designate a place to dig'));
    expect(at).toBeGreaterThan(0);
    expect(rows[at + 1]?.trim()).toBe('side.');
    expect(rows[at]).not.toContain('»');
    expect(fgOfText(g.uiSurface!, at, '☼')).toBe(hexOf(theme.value));
  });
});

describe('T-280 the log strip', () => {
  const line = (text: string, category?: string): LogLine => ({ tick: 0, severity: 'note', text, count: 1, ...(category === undefined ? {} : { category }) });
  const hint = line(`☼ ${'a hint that is long enough to need two lines '.repeat(2).trim()}`, 'hint');

  it('fills from the newest line back: a hint followed by two newer lines is one cut line, and the newer lines stay', () => {
    const s = surface(40, 3);
    drawLogStrip(s, { col: 0, row: 0, cols: 40, rows: 3 }, [hint, line('Newer one.'), line('Newest.')], null, false);
    const rows = s.lines().map((l) => l.trim());
    expect(rows[0]).toMatch(/^☼ a hint that is long enough to need »$/);
    expect(rows[1]).toBe('Newer one.');
    expect(rows[2]).toBe('Newest.');
  });

  it('a hint followed by one newer line takes two lines, whole', () => {
    const s = surface(40, 3);
    drawLogStrip(s, { col: 0, row: 0, cols: 40, rows: 3 }, [line('Older.'), hint, line('Newest.')], null, false);
    const rows = s.lines().map((l) => l.trim());
    expect(rows[0]).toMatch(/^☼ a hint that is long enough to need/);
    expect(rows[0]).not.toContain('»');
    expect(rows[1]).toMatch(/lines/);
    expect(rows[2]).toBe('Newest.');
  });
});

describe('T-280 Help opens on Start once for each fortress', () => {
  it('is saved with the fortress: a save made after it opens on the left tab, an earlier save opens Start again', async () => {
    const g = new Game({ canvas: new MockCanvas(), seed: 't280-help', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800, saves: new SaveManager(new MemoryStorage()) });
    await g.start({ embark: 'default' });
    await g.saveAs('manual', 'manual-1');
    g.handleKey(press('?'));
    expect(g.fortress.help.tab).toBe(2);
    g.handleKey(press('?'));
    await g.saveAs('manual', 'manual-2');
    g.fortress.help.setTab(0);
    await g.loadSave('manual-2');
    g.handleKey(press('?'));
    expect(g.fortress.help.tab).toBe(0);
    g.handleKey(press('?'));
    await g.loadSave('manual-1');
    g.handleKey(press('?'));
    expect(g.fortress.help.tab).toBe(2);
  });
});
