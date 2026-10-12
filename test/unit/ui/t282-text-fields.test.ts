/**
 * T-282: what a text field accepts, names, a filter that ends with its panel, and `Space` typed
 * into a focused field.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { TextInputScreen } from '@ui/screens/text_input';
import { PanelFilter } from '@ui/panels/filter';
import { editText, type TextFieldState } from '@ui/widgets';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

/** The audit's seven: bell, NUL, ESC, DEL, tab, CR, backspace as raw characters. */
const CONTROL = ['\u0007', '\u0000', '\u001b', '\u007f', '\t', '\r', '\b'];

function setup(count = 4): { screen: FortressScreen; speeds: number[]; draw(): string[] } {
  const w = new TestWorld({ seed: 't282', world: 'flat-test', embark: 'none' });
  for (let k = 0; k < count; k += 1) w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` });
  const speeds: number[] = [];
  const layout = computeLayout(80, 42, true);
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => { w.submit(cmd); },
    speed: () => 1,
    setSpeed: (s) => { speeds.push(s); },
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => layout,
    precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 0,
    prompt: () => {},
    laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  const draw = (): string[] => {
    const s = surface(80, 42);
    screen.draw(s);
    return s.lines();
  };
  return { screen, speeds, draw };
}

function field(): TextFieldState {
  return { value: '', focused: true, maxLength: 24 };
}

describe('T-282 a text field takes only printable characters', () => {
  it('refuses the seven control characters in the shared field code', () => {
    for (const key of CONTROL) {
      const f = field();
      expect(editText(f, press(key))).toBe(false);
      expect(f.value).toBe('');
    }
  });

  it('refuses them in a panel filter', () => {
    const filter = new PanelFilter();
    filter.focused = true;
    for (const key of CONTROL) expect(filter.key(press(key))).toBe(false);
    expect(filter.value).toBe('');
  });

  it('refuses them in the name dialog, which then still needs a name', () => {
    let answer: string | null | undefined;
    const dialog = new TextInputScreen({ title: 'Rename', value: '', maxLength: 24 }, strings, (text) => { answer = text; });
    for (const key of CONTROL) dialog.key(press(key));
    expect(dialog.field.value).toBe('');
    dialog.key(press('Enter'));
    expect(answer).toBeUndefined();
    expect(dialog.message).toBe(strings.get('ui.text_input.too_short', { min: 1 }));
  });

  it('refuses them in the Units filter', () => {
    const f = setup();
    f.screen.openPanel('units');
    f.screen.key(press('/'));
    for (const key of CONTROL) f.screen.key(press(key));
    expect(f.screen.units.filter).toBe('');
  });

  it('still takes emoji and right-to-left text', () => {
    for (const text of ['😀', 'ש', 'ع', 'é']) {
      const f = field();
      expect(editText(f, press(text))).toBe(true);
      expect(f.value).toBe(text);
    }
    const filter = new PanelFilter();
    filter.focused = true;
    expect(filter.key(press('😀'))).toBe(true);
    expect(filter.value).toBe('😀');
  });
});

describe('T-282 names', () => {
  function answerOf(typed: string): { answer: string | null | undefined; dialog: TextInputScreen } {
    const out: { answer: string | null | undefined; dialog: TextInputScreen | undefined } = { answer: undefined, dialog: undefined };
    const dialog = new TextInputScreen({ title: 'Rename', value: '', maxLength: 24 }, strings, (text) => { out.answer = text; });
    for (const ch of Array.from(typed)) dialog.key(press(ch));
    dialog.key(press('Enter'));
    return { answer: out.answer, dialog };
  }

  it('trims a name and turns runs of spaces into one', () => {
    expect(answerOf('  Ketil   Iron  vein ').answer).toBe('Ketil Iron vein');
  });

  it('refuses a name of spaces only with the existing line', () => {
    const { answer, dialog } = answerOf('     ');
    expect(answer).toBeUndefined();
    expect(dialog.message).toBe(strings.get('ui.text_input.too_short', { min: 1 }));
  });
});

describe('T-282 a filter does not outlive its panel', () => {
  it('clears the Units filter when the panel closes and reopens unfiltered', () => {
    const f = setup();
    f.screen.openPanel('units');
    f.screen.key(press('/'));
    for (const ch of 'xxx') f.screen.key(press(ch));
    f.screen.key(press('Enter'));
    expect(f.screen.units.filter).toBe('xxx');
    f.screen.key(press('Esc'));
    expect(f.screen.ui.panel).toBeNull();
    f.screen.openPanel('units');
    expect(f.screen.units.filter).toBe('');
    expect(f.draw().some((l) => l.includes('Dwarf00 Stone'))).toBe(true);
  });

  it('clears the Jobs and Stocks filters when their panel closes or another opens', () => {
    const f = setup();
    f.screen.openPanel('jobs');
    f.screen.jobs.filter.focused = true;
    f.screen.key(press('a'));
    expect(f.screen.jobs.filter.value).toBe('a');
    f.screen.openPanel('stocks');
    expect(f.screen.jobs.filter.value).toBe('');
    expect(f.screen.jobs.filter.focused).toBe(false);
    f.screen.stocks.filter.focused = true;
    f.screen.key(press('b'));
    expect(f.screen.stocks.filter.value).toBe('b');
    f.screen.openPanel(null);
    expect(f.screen.stocks.filter.value).toBe('');
  });

  it('shows an active filter in the header of Units with the counts', () => {
    const f = setup(4);
    f.screen.openPanel('units');
    expect(f.draw().join('\n')).not.toContain('Units · filter');
    f.screen.key(press('/'));
    for (const ch of 'f01') f.screen.key(press(ch));
    expect(f.draw().join('\n')).toContain('Units · filter: f01 (1 of 4)');
  });
});

describe('T-282 Space in a focused field', () => {
  for (const space of [' ', 'Space']) {
    it(`types a space in the Units filter and leaves the clock alone (${JSON.stringify(space)})`, () => {
      const f = setup();
      f.screen.openPanel('units');
      f.screen.key(press('/'));
      f.screen.key(press('a'));
      f.screen.key(press(space));
      f.screen.key(press('b'));
      expect(f.screen.units.filter).toBe('a b');
      expect(f.speeds).toEqual([]);
    });

    it(`types a space in the Jobs and Stocks filters (${JSON.stringify(space)})`, () => {
      const f = setup();
      for (const panel of ['jobs', 'stocks'] as const) {
        f.screen.openPanel(panel);
        const filter = panel === 'jobs' ? f.screen.jobs.filter : f.screen.stocks.filter;
        filter.focused = true;
        f.screen.key(press('a'));
        f.screen.key(press(space));
        f.screen.key(press('b'));
        expect(filter.value).toBe('a b');
      }
      expect(f.speeds).toEqual([]);
    });

    it(`types a space in the name dialog (${JSON.stringify(space)})`, () => {
      const dialog = new TextInputScreen({ title: 'Rename', value: '', maxLength: 24 }, strings, () => {});
      dialog.key(press('a'));
      dialog.key(press(space));
      dialog.key(press('b'));
      expect(dialog.field.value).toBe('a b');
    });
  }
});
