/**
 * T-429: Help's Keys tab has one section per panel. The keymap rows come first; the lines that
 * follow them say only what the rows do not (the mouse's way, typing in a field, the keys inside a
 * dropdown or a list, ranges and limits). A key is never listed twice, and each key a note still
 * names is the one its binding has now.
 */

import { describe, expect, it } from 'vitest';
import { Keymap, type KeyContext, type KeySpec } from '@ui/keymap';
import { contextTitle, helpKeyRows, type HelpRow } from '@ui/panels/help';
import { keymap, strings } from './ui-fixture';

function key(k: string, mods: Partial<KeySpec> = {}): KeySpec {
  return { key: k, ctrl: false, shift: false, ...mods };
}

/** The note lines of a section: the lines of its context that are not keymap rows or headings. */
function notes(rows: readonly HelpRow[], context: string): string[] {
  return rows.filter((r) => r.category === context && r.heading !== true && r.keys === undefined).map((r) => r.text);
}

/**
 * The notes that remain, per panel, and why each stays: it says what no keymap row of the panel
 * says. A panel that is not listed has none.
 */
const REMAINING: Readonly<Record<string, readonly { readonly id: string; readonly why: string }[]>> = {
  designate_panel: [{ id: 'ui.help.designate.undo', why: 'how many batches undo keeps and when they are cleared (limits); the row names the key' }],
  build_panel: [
    { id: 'ui.help.build.drag', why: 'the mouse: a drag places one per valid tile' },
    { id: 'ui.help.build.corner', why: 'the keyboard corner, which no row of the panel lists' },
    { id: 'ui.help.build.order', why: 'the out-of-stock order, whose key the building list gives' },
  ],
  zones_panel: [{ id: 'ui.help.zones.select', why: 'how a zone is selected: Enter at the map cursor, or a click' }],
  zone_inspector: [
    { id: 'ui.help.zones.links', why: 'how a link or an unlink is picked: a click or Enter on the map, and Esc' },
    { id: 'ui.help.zones.preset', why: 'the keys inside the preset dropdown, and the click' },
    { id: 'ui.help.zones.tree', why: 'the keys inside the category tree, and the click' },
    { id: 'ui.help.zones.numbers', why: 'the keys that move and adjust the numeric settings, and the click' },
    { id: 'ui.help.zones.materials', why: 'the keys inside the material classes, and the click' },
    { id: 'ui.help.zones.owner', why: 'the keys inside the owner picker, and the click' },
    { id: 'ui.help.zones.farm', why: 'the season rows and the crop menu of a farm plot, and the click' },
  ],
  jobs_panel: [
    { id: 'ui.help.jobs.filter', why: 'typing in the filter field, and how it ends' },
    { id: 'ui.help.jobs.waiting', why: 'what a waiting order does when chosen' },
    { id: 'ui.help.jobs.cycle', why: 'the mouse: the labor and state rows cycle when clicked' },
  ],
  orders_panel: [{ id: 'ui.help.orders.picker', why: 'typing in the order picker' }],
  building_panel: [{ id: 'ui.help.building.rows', why: 'what the list keys choose in this panel' }],
  stocks_panel: [{ id: 'ui.help.stocks.filter', why: 'typing in the filter field, and how it ends' }],
  animals_panel: [
    { id: 'ui.help.animals.train', why: 'the War or Hunting choice that training opens' },
    { id: 'ui.help.animals.cap', why: 'the number field of the breeding cap: digits, steps, range, buttons' },
  ],
  game_menu: [{ id: 'ui.help.game_menu.rename', why: 'the name field that renaming opens' }],
};

describe('T-429 Help shows each panel once', () => {
  it('has one heading per section, and no second list of a panel under another title', () => {
    const headings = helpKeyRows(keymap, strings).filter((r) => r.heading === true).map((r) => r.text);
    expect(new Set(headings).size).toBe(headings.length);
    for (const old of ['Work orders', 'Build', 'Building panel (click a building)', 'Jobs', 'Stocks', 'Animals', 'Game menu', 'Zones and stockpiles']) {
      expect(headings.filter((h) => h === old), old).toHaveLength(old === 'Game menu' ? 1 : 0);
    }
    expect(headings).toContain('Orders panel');
    expect(headings).toContain('Zone inspector');
  });

  it('keeps, under each panel\'s heading, only the notes that say what its rows do not', () => {
    const rows = helpKeyRows(keymap, strings);
    const contexts = new Set(rows.filter((r) => r.heading !== true).map((r) => r.category));
    for (const context of contexts) {
      const expected = (REMAINING[context] ?? []).map((n) => strings.get(n.id));
      expect(notes(rows, context).filter((t) => !t.startsWith('S- ') && !t.startsWith('Shift+letter')), context).toEqual(expected);
    }
    for (const [context, list] of Object.entries(REMAINING)) {
      for (const n of list) expect(n.why.length, `${context} ${n.id}`).toBeGreaterThan(10);
    }
  });

  it('puts a panel\'s notes after its keymap rows, in its own section', () => {
    const rows = helpKeyRows(keymap, strings);
    for (const context of Object.keys(REMAINING)) {
      const own = rows.map((r, i) => [r, i] as const).filter(([r]) => r.category === context);
      const heading = own.find(([r]) => r.heading === true);
      expect(heading?.[0].text, context).toBe(contextTitle(context));
      const firstNote = own.find(([r]) => r.heading !== true && r.keys === undefined && !r.text.startsWith('Shift+letter'));
      const lastRow = [...own].reverse().find(([r]) => r.keys !== undefined);
      if (firstNote !== undefined && lastRow !== undefined) expect(firstNote[1], context).toBeGreaterThan(lastRow[1]);
    }
  });

  it('lists no key twice in a section: a key a note names is not also a row of that section', () => {
    const rows = helpKeyRows(keymap, strings);
    const contexts = [...new Set(rows.map((r) => r.category))];
    for (const context of contexts) {
      const section = rows.filter((r) => r.category === context && r.heading !== true);
      const rowKeys = new Set(section.flatMap((r) => r.keys ?? []));
      for (const note of section.filter((r) => r.keys === undefined)) {
        for (const named of note.text.matchAll(/\[([^\]\s]{1,8})\]/g)) {
          expect(rowKeys.has(`[${named[1] as string}]`), `${context}: ${note.text}`).toBe(false);
        }
      }
    }
  });

  it('a note names the key its binding has now', () => {
    const keys = new Keymap(keymap.bindings);
    const index = keys.bindings.findIndex((b) => b.context === 'panel' && b.id === 'filter_focus');
    expect(keys.rebind(index, key('F6'))).toBeNull();
    const rows = helpKeyRows(keys, strings);
    expect(notes(rows, 'jobs_panel')[0]).toBe('[F6] filter jobs by target name or worker; click the field. Enter or Esc finishes typing.');
    expect(notes(rows, 'stocks_panel')[0]).toBe('[F6] filter stocks by category, item or material; click the field. Enter or Esc finishes typing.');
  });

  it('a row shows the live binding once, and no note repeats it', () => {
    const keys = new Keymap(keymap.bindings);
    const at = (context: KeyContext, id: string): number => keys.bindings.findIndex((b) => b.context === context && b.id === id);
    expect(keys.rebind(at('jobs_panel', 'cycle_labor'), key('F6'))).toBeNull();
    expect(keys.rebind(at('zone_inspector', 'preset'), key('F7'))).toBeNull();
    expect(keys.rebind(at('animals_panel', 'train'), key('F8'))).toBeNull();
    const text = helpKeyRows(keys, strings).map((r) => r.text);
    expect(text.filter((t) => t.startsWith('F6  cycle the labors'))).toHaveLength(1);
    expect(text.filter((t) => t.startsWith('F7  open the stockpile preset'))).toHaveLength(1);
    expect(text.filter((t) => t.includes('F8'))).toHaveLength(1);
    expect(text.filter((t) => t.includes('F6') && /cycle labors|labors/.test(t))).toHaveLength(1);
    expect(text.filter((t) => t.includes('F7'))).toHaveLength(1);
  });
});
