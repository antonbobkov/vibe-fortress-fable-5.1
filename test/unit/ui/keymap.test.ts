/**
 * T-M1-12 keymap loader: `keymap.json` (`ui-keymap-and-screens.md` § Keymap) parsed into bindings
 * and resolved per context (24 § Input model).
 */

import { describe, it, expect } from 'vitest';
import { ACTION_IDS, Keymap, parseKeySpec, type KeymapRow } from '@ui/keymap';
import { keymap, press, registry } from './ui-fixture';

describe('T-M1-12 keymap parsing', () => {
  it('parses modifiers, the arrows group and the accelerator pseudo-key', () => {
    expect(parseKeySpec('Ctrl+S')).toEqual([{ key: 'S', ctrl: true, shift: false }]);
    expect(parseKeySpec('Shift+Tab')).toEqual([{ key: 'Tab', ctrl: false, shift: true }]);
    expect(parseKeySpec('+')).toEqual([{ key: '+', ctrl: false, shift: false }]);
    expect(parseKeySpec('Ctrl+↑')).toEqual([{ key: '↑', ctrl: true, shift: false }]);
    expect(parseKeySpec('arrows').map((s) => s.key)).toEqual(['←', '→', '↑', '↓']);
    expect(parseKeySpec('[letter]')).toEqual([{ key: 'any-letter', ctrl: false, shift: false }]);
    expect(() => parseKeySpec('Hyper+X')).toThrow(RangeError);
  });

  it('names every action wording of keymap.json', () => {
    const rows = registry.derived<readonly KeymapRow[]>('keymap');
    expect(rows.length).toBeGreaterThan(50);
    for (const row of rows) expect(ACTION_IDS[row.action], row.action).toBeDefined();
  });

  it('refuses an unknown context or wording', () => {
    expect(() => Keymap.fromRows([{ context: 'moon', key: 'a', action: 'help' }])).toThrow(RangeError);
    expect(() => Keymap.fromRows([{ context: 'global', key: 'a', action: 'fly' }])).toThrow(RangeError);
  });

  it('binds the whole 1–9 priority range from its two documented ends', () => {
    for (let d = 1; d <= 9; d += 1) {
      expect(keymap.resolve('map', press(String(d)))).toEqual({ id: 'priority', arg: d, shift: false });
    }
  });
});

describe('T-M1-12 keymap resolution', () => {
  it('resolves per context', () => {
    expect(keymap.resolve('global', press('Esc'))?.id).toBe('cancel');
    expect(keymap.resolve('global', press('Space'))?.id).toBe('pause');
    expect(keymap.resolve('global', press('S', { ctrl: true }))?.id).toBe('save_menu');
    expect(keymap.resolve('global', press('S'))).toBeNull();
    expect(keymap.resolve('map', press('<'))?.id).toBe('z_down');
    expect(keymap.resolve('map', press('.'))?.id).toBe('z_up');
    expect(keymap.resolve('world_map', press('f'))?.id).toBe('filter');
    expect(keymap.resolve('embark', press('2'))).toEqual({ id: 'tab', arg: 1, shift: false });
    expect(keymap.resolve('embark', press('-'))).toEqual({ id: 'adjust', arg: -1, shift: false });
  });

  it('lets a shifted press reach an unshifted binding, unless the shifted key is bound itself', () => {
    expect(keymap.resolve('map', press('←', { shift: true }))).toEqual({ id: 'pan', arg: '←', shift: true });
    expect(keymap.resolve('global', press('?', { shift: true }))?.id).toBe('help');
    expect(keymap.resolve('panel', press('Tab'))).toEqual({ id: 'field', arg: 1, shift: false });
    expect(keymap.resolve('panel', press('Tab', { shift: true }))).toEqual({ id: 'field', arg: -1, shift: true });
  });

  it('turns any letter into the panel accelerator, after the letters bound explicitly', () => {
    expect(keymap.resolve('panel', press('g'))).toEqual({ id: 'accelerator', arg: 'g', shift: false });
    expect(keymap.resolve('panel', press('G', { shift: true }))).toEqual({ id: 'accelerator', arg: 'g', shift: true });
    expect(keymap.resolve('panel', press('/'))?.id).toBe('filter_focus');
    expect(keymap.resolve('panel', press('1'))).toBeNull();
  });
});
