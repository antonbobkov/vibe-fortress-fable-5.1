/**
 * U-01: the hostile counter, glyph aliases, the build list, list heights and the help layout
 * (`docs/archive/ui-fixes/README.md` D-U8; UI audit Q7, Q8, Q12 `hint_fuel`, Q13, Q14, S6).
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import { AnnouncementLog } from '@ui/announcements';
import type { ReaderSet } from '@core/readers';
import { fuelShort, HintEngine } from '@ui/hints';
import { buildRowText } from '@ui/panels/build';
import type { PanelContext } from '@ui/panels/context';
import { helpKeyRows, keysLabel } from '@ui/panels/help';
import { drawLaborsPanel, LaborsPanel } from '@ui/panels/labors';
import { drawMilitaryPanel, MilitaryPanel } from '@ui/panels/military';
import { drawThreatsPanel, ThreatsPanel } from '@ui/panels/threats';
import { statusFields, visibleHostiles } from '@ui/status';
import { GlyphMap } from '@ui/surface';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function ctxOf(w: TestWorld): PanelContext {
  return {
    readers: w.readers,
    registry: w.game.registry,
    strings,
    submit: (cmd) => w.submit(cmd),
    focusOn: () => {},
    look: () => {},
    openPanel: () => {},
    shiftClick: () => false,
  };
}

function hostile(w: TestWorld, at: number, spotted = false): number {
  const id = w.spawnCreature('gloam_warrior', at, 'hostile:gloam');
  w.game.world.entities.add(id, C.Hostile, {
    partyId: 0, role: 'warrior', behaviorState: 'attack', stealthed: false, spotted, breakingDoorId: 0, breakingSince: 0,
  });
  return id;
}

describe('U-01 the hostile counter counts what the player can know of (D-U8, Q8, S6)', () => {
  it('a hostile on an undiscovered tile is not counted; on a discovered tile, or spotted, it is', () => {
    const w = new TestWorld({ seed: 'u01-hostiles', world: 'flat-test', embark: 'none' });
    const deep = w.index(30, 30, z - 10);
    w.discover(deep, false);
    hostile(w, deep);
    expect(visibleHostiles(w.readers)).toBe(0);
    expect(statusFields(w.readers, strings, z, 0).some((f) => f.startsWith('!'))).toBe(false);
    const seen = w.index(31, 30, z);
    w.discover(seen);
    hostile(w, seen);
    const spotted = w.index(32, 30, z - 10);
    w.discover(spotted, false);
    hostile(w, spotted, true);
    expect(visibleHostiles(w.readers)).toBe(2);
    expect(statusFields(w.readers, strings, z, 0)).toContain('!2');
    // The threats panel's "Active" line agrees with the counter.
    const s = surface(40, 30);
    drawThreatsPanel(s, { col: 0, row: 0, cols: 40, rows: 30 }, new ThreatsPanel(), ctxOf(w));
    expect(s.lines().join('\n')).toContain('Active: 2 hostile creatures');
  });
});

describe('U-01 glyphs and the build list (Q7)', () => {
  it('●, ★ and a newline draw through CP437 aliases, not as ?', () => {
    const glyphs = GlyphMap.of(registry);
    expect(glyphs.index('●')).toBe(glyphs.index('•'));
    expect(glyphs.index('★')).toBe(glyphs.index('☼'));
    expect(glyphs.index('\n')).toBe(glyphs.index(' '));
    expect(glyphs.index('●')).not.toBe(glyphs.unknown);
  });

  it('a build row keeps the name whole and shortens the inputs', () => {
    expect(buildRowText("Butcher's shop", '1 table+1 stone', ' (1)', 33)).toBe("Butcher's shop 1 table+1 sto… (1)");
    expect(buildRowText('Loom', '2 logs', ' (5)', 20)).toBe('Loom      2 logs (5)');
    expect(buildRowText('Wall', '', '', 10)).toBe('Wall      ');
  });
});

describe('U-01 lists show every row (Q13)', () => {
  it('the military list shows the one squad below its header', () => {
    const w = new TestWorld({ seed: 'u01-mil', world: 'flat-test', embark: 'none' });
    w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    w.step(1);
    const s = surface(40, 40);
    drawMilitaryPanel(s, { col: 0, row: 0, cols: 40, rows: 40 }, new MilitaryPanel(), ctxOf(w));
    const text = s.lines().join('\n');
    expect(text).toMatch(/Squad +Size +Mode/);
    expect(text).toMatch(/The Hearthguard +0\/\d+ +\w+/);
  });

  it('the labor grid scrolls its rows to the selected dwarf', () => {
    const w = new TestWorld({ seed: 'u01-labors', world: 'flat-test', embark: 'none' });
    for (let k = 0; k < 12; k += 1) w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` });
    const panel = new LaborsPanel();
    const ctx = ctxOf(w);
    for (let k = 0; k < 11; k += 1) panel.move(1, ctx);
    const s = surface(40, 10);
    drawLaborsPanel(s, { col: 0, row: 0, cols: 40, rows: 10 }, panel, ctx);
    expect(panel.selectedRow).toBe(11);
    expect(panel.firstRow).toBeGreaterThan(0);
    expect(s.lines().join('\n')).toContain('Dwarf11 S.');
  });
});

describe('U-01 help groups keys and lists the panel hotkeys first (Q14)', () => {
  it('panel hotkeys come first; arrows and digits share a row', () => {
    const rows = helpKeyRows(keymap);
    expect(rows[0]).toMatchObject({ heading: true, text: 'Fortress panels' });
    expect(rows[1]?.text).toBe('d  Designate panel');
    expect(rows.some((r) => r.text === '←→↑↓  pan by 1 cell (Shift: 10)')).toBe(true);
    expect(rows.some((r) => r.text === '1–9  with a designation or zone tool: set priority')).toBe(true);
    expect(rows.some((r) => r.text === '+ -  quantity' && r.category === 'trade_session')).toBe(true);
    expect(keysLabel(['any-letter'])).toBe('[letter]');
    expect(rows.length).toBeLessThan(keymap.bindings.length);
  });
});

describe('U-01 hint_fuel recognises a smelter waiting for fuel (Q12)', () => {
  /** Readers where workshop 7 is a smelter whose one order the reader reports as `reason`. */
  function readersWith(reason: string): ReaderSet {
    const workshops = {
      ordersOf: () => [{ recipe: 1 }],
      recipe: () => ({ id: 'smelt_x' }),
      isRunnable: () => ({ runnable: false, reason }),
    };
    const buildings = { get: (id: number) => (id === 7 ? { typeId: 'smelter' } : undefined) };
    return { has: (id: string) => id === '12' || id === '14', of: (id: string) => (id === '12' ? workshops : buildings) } as unknown as ReaderSet;
  }

  function marked(reason: string): boolean {
    const ui = defaultUiState(z);
    const hints = new HintEngine(registry, ui, new AnnouncementLog(strings, registry));
    hints.onEvents([{ type: 'WorkshopBlocked', workshopId: 7, reason: 'missing_input' } as unknown as GameEvent], readersWith(reason));
    return ui.hintPending.includes('hint_fuel');
  }

  it('missing_input marks hint_fuel when the orders wait for fuel, not when they wait for an input', () => {
    expect(fuelShort(readersWith('missing_input'), 7)).toBe(true);
    expect(marked('missing_input')).toBe(true);
    expect(marked('waiting for raw_stone')).toBe(false);
  });
});
