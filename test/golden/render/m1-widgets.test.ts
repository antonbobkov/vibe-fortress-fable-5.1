/**
 * Golden render: every widget of T-M1-12 laid out in cells with fixed inputs.
 *
 * `archive/build-plan/M1-ground.md` T-M1-12: "widget layout in cells for each widget with fixed inputs
 * (golden cell buffers)". Each widget draws into its own 40×4 surface; the file holds the text of
 * each row and every cell's `glyph:fg:bg`. Rewritten only by
 * `npm run golden:update -- render/m1-widgets`.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import type { Surface } from '@ui/surface';
import { bar, button, label, list, menu, separator, tabs, textField } from '@ui/widgets';
import { cellRows, surface } from '../../unit/ui/ui-fixture';

const GOLDEN_NAME = 'render/m1-widgets';
const file = fileURLToPath(new URL('./m1-widgets.json', import.meta.url));
const update =
  process.env['DEEPHOLM_GOLDEN_UPDATE'] === GOLDEN_NAME || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';

interface WidgetGolden {
  text: string[];
  cells: string[][];
}

const WIDGETS: Record<string, (s: Surface) => void> = {
  label: (s) => {
    label(s, 1, 0, 'Wealth');
    label(s, 1, 1, '[g] Generate');
    label(s, 1, 2, 'A clipped line of text', { width: 9 });
  },
  separator: (s) => {
    separator(s, 0, 0, 30);
    separator(s, 0, 2, 30, 'Skills (points left: 0)');
  },
  bar: (s) => {
    bar(s, 0, 0, 3, 5, 5);
    bar(s, 0, 1, 62, 100, 10);
    bar(s, 0, 2, 0, 4, 5);
  },
  button: (s) => {
    button(s, 0, 0, 'Enter', 'Embark', () => {});
    button(s, 0, 1, 'g', 'Generate', () => {}, { focused: true });
    button(s, 0, 2, 'Enter', 'Embark', () => {}, { enabled: false });
  },
  menu: (s) =>
    void menu(
      s,
      0,
      0,
      [
        { id: 'new_world', key: 'n', label: 'New world' },
        { id: 'continue', key: 'c', label: 'Continue', hidden: true },
        { id: 'load', key: 'l', label: 'Load', enabled: false },
        { id: 'settings', key: 'o', label: 'Settings', detail: '(soon)' },
      ],
      'new_world',
      () => {},
    ),
  list: (s) => list(s, { col: 0, row: 0, cols: 20, rows: 3 }, ['Ketil Ironvein', 'Brynja Coldhammer', 'Orm Ashbrow', 'Solveig Deephand'], { selected: 1, scroll: 0 }),
  tabs: (s) => void tabs(s, 0, 0, [{ key: '1', label: 'Dwarves' }, { key: '2', label: 'Supplies' }, { key: '3', label: 'Animals' }], 1, () => {}),
  text: (s) => {
    textField(s, 0, 0, 12, { value: 'e2e-1', focused: true, maxLength: 32 });
    textField(s, 0, 1, 12, { value: 'coldmere-4471-long', focused: false, maxLength: 32 });
  },
};

function render(name: string): WidgetGolden {
  const s = surface(40, 4);
  (WIDGETS[name] as (s: Surface) => void)(s);
  return { text: s.lines(), cells: cellRows(s) };
}

const golden: Record<string, WidgetGolden> = existsSync(file)
  ? (JSON.parse(readFileSync(file, 'utf8')) as { widgets: Record<string, WidgetGolden> }).widgets
  : {};

describe('T-M1-12 golden: widget layouts in cells', () => {
  if (update) {
    const next: Record<string, WidgetGolden> = {};
    for (const name of Object.keys(WIDGETS)) next[name] = render(name);
    writeFileSync(file, `${JSON.stringify({ $note: 'npm run golden:update -- render/m1-widgets', widgets: next }, null, 2)}\n`, 'utf8');
    Object.assign(golden, next);
  }
  for (const name of Object.keys(WIDGETS)) {
    it(`${name} matches test/golden/render/m1-widgets.json`, () => {
      expect(golden[name]).toBeDefined();
      expect(render(name)).toEqual(golden[name]);
    });
  }
  it('lays out the documented shapes', () => {
    expect(render('bar').text[0]?.startsWith('▓▓▓░░')).toBe(true);
    expect(render('menu').text).toEqual(expect.arrayContaining([expect.stringContaining('► [n] New world')]));
    expect(render('menu').text.join('\n')).not.toContain('Continue');
    expect(render('text').text[0]?.startsWith('[ e2e-1_______ ]')).toBe(true);
    expect(render('tabs').text[0]?.startsWith('[1] Dwarves   [2] Supplies   [3] Animals')).toBe(true);
    expect(render('separator').text[2]?.startsWith('─── Skills (points left: 0) ─')).toBe(true);
  });
});
