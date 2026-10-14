/**
 * T-275: the Units list reads at a glance (idle filter, wounded first, `l` to the labors) and the
 * labor manager shows skill, jumps by letter and writes its heads in full.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { LABOR_SKILL_GOOD_LEVEL, LABOR_SKILL_VALUE_LEVEL, LABOR_TALL_WINDOW_ROWS } from '@ui/constants';
import { laborHeads } from '@ui/panels/labors';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { LaborManagerScreen } from '@ui/screens/labor_manager';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, registry, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function fortress(seed: string, count: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const dwarves: EntityId[] = [];
  for (let k = 0; k < count; k += 1) dwarves.push(w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` }));
  const layout = computeLayout(80, 42, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c), speed: () => 1, setSpeed: () => {},
    pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  const draw = (): string[] => { const s = surface(80, 42); screen.draw(s); return s.lines(); };
  const setActivity = (id: EntityId, activity: string): void => {
    const brain = w.game.world.entities.get(id, C.Brain);
    if (brain !== undefined) w.game.world.entities.add(id, C.Brain, { ...brain, activity });
  };
  const rows = (): readonly EntityId[] => screen.units.rows({ readers: w.readers, registry: w.game.registry, strings, submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false });
  return { w, screen, dwarves, draw, setActivity, rows };
}
const sidebar = (lines: string[]): string[] => lines.map((l) => l.slice(44));

describe('T-275 Units: columns, idle filter, wounded first', () => {
  it('lists name, mood glyph and activity in the 36-column sidebar, with no profession column', () => {
    const f = fortress('t275-columns', 3);
    f.setActivity(f.dwarves[0] as EntityId, 'Digging');
    f.screen.openPanel('units');
    const text = sidebar(f.draw()).join('\n');
    expect(text).toContain('Act.');
    expect(text).not.toContain('Prof.');
    expect(text).toContain('Digging');
    expect(text).toContain('Idle');
    expect(text).not.toContain('No job');
    const row = sidebar(f.draw()).find((l) => l.includes('Dwarf01')) as string;
    // Marker and name in 14 cells, the mood glyph, then the activity.
    expect(row.indexOf('Idle')).toBeGreaterThanOrEqual(15);
    expect(row.indexOf('Idle')).toBeLessThanOrEqual(18);
  });

  it('puts the dwarf count and the idle count in the title, and i filters to the idle ones', () => {
    const f = fortress('t275-idle', 8);
    for (const id of f.dwarves.slice(0, 3)) f.setActivity(id, 'Digging');
    f.screen.openPanel('units');
    expect(sidebar(f.draw()).join('\n')).toContain('Units (8, 5 idle)');
    f.screen.key(press('i'));
    expect(f.screen.units.idleOnly).toBe(true);
    const lines = sidebar(f.draw()).join('\n');
    expect(lines).toContain('Units · idle (5)');
    expect(lines).not.toContain('Dwarf00');
    expect(lines).toContain('Dwarf07');
    expect(f.rows()).toHaveLength(5);
    // Kept when the panel closes and opens again; i toggles it off.
    f.screen.openPanel(null);
    f.screen.openPanel('units');
    expect(f.screen.units.idleOnly).toBe(true);
    f.screen.key(press('i'));
    expect(sidebar(f.draw()).join('\n')).toContain('Units (8, 5 idle)');
  });

  it('Shift+W lists wounded dwarves first and keeps list order within each group', () => {
    const f = fortress('t275-wounded', 5);
    for (const id of [f.dwarves[3] as EntityId, f.dwarves[1] as EntityId]) {
      const body = f.w.game.world.entities.get(id, C.Body);
      if (body === undefined) throw new Error('no body');
      f.w.game.world.entities.add(id, C.Body, { ...body, parts: body.parts.map((p, k) => (k === 0 ? { ...p, wounds: [{} as never] } : p)) });
    }
    f.screen.openPanel('units');
    const before = f.rows();
    f.screen.key(press('W', { shift: true }));
    expect(f.screen.units.woundedFirst).toBe(true);
    expect(f.rows()).toEqual([before[1], before[3], before[0], before[2], before[4]]);
    f.screen.key(press('W', { shift: true }));
    expect(f.rows()).toEqual(before);
  });

  it('l over a Units row opens the Labors panel on that dwarf, at its first column', () => {
    const f = fortress('t275-l', 6);
    f.screen.openPanel('units');
    f.screen.units.list.selected = 4;
    f.screen.labors.firstColumn = 3;
    f.screen.key(press('l'));
    expect(f.screen.ui.panel).toBe('labors');
    expect(f.screen.labors.selectedRow).toBe(4);
    expect(f.screen.labors.firstColumn).toBe(0);
    // From anywhere else it opens as before.
    f.screen.openPanel(null);
    f.screen.labors.selectedRow = 0;
    f.screen.key(press('l'));
    expect(f.screen.ui.panel).toBe('labors');
    expect(f.screen.labors.selectedRow).toBe(0);
  });
});

describe('T-275 labors: unique three-letter heads', () => {
  it('gives every labor of the content table its own three-letter head', () => {
    const table = registry.table<{ id: string; name: string }>('labors');
    const names = table.ids().map((id) => (table.byId(id) as { name: string }).name);
    const heads = laborHeads(names);
    expect(heads.every((h) => Array.from(h).length === 3)).toBe(true);
    expect(new Set(heads).size).toBe(names.length);
    expect(heads[names.indexOf('Animal care')]).toBe('AnC');
    expect(heads[names.indexOf('Animal training')]).toBe('AnT');
    expect(heads[names.indexOf('Brewing')]).toBe('Bre');
    expect(heads[names.indexOf('Butchery')]).toBe('But');
  });

  it('keeps heads apart that would share their first letters', () => {
    expect(new Set(laborHeads(['Gem cutting', 'Gem carving', 'Gemology'])).size).toBe(3);
  });
});

function manager(seed: string, count = 3) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const dwarves: EntityId[] = [];
  for (let k = 0; k < count; k += 1) dwarves.push(w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` }));
  const screen = new LaborManagerScreen({ readers: w.readers, registry: w.game.registry, strings, submit: (c) => w.submit(c), back: () => {} });
  return { w, screen, dwarves };
}
const laborTable = registry.table<{ id: string; name: string }>('labors');
const laborNames = laborTable.ids().map((id) => (laborTable.byId(id) as { name: string }).name);

describe('T-275 labor manager: skill, letter jump, full heads', () => {
  it('colours a cell by the dwarf skill in the labor skill and names the skill in the header', () => {
    const { w, screen, dwarves } = manager('t275-skill');
    const d0 = dwarves[0] as EntityId;
    const miningCol = laborNames.indexOf('Mining');
    const levels = [0, 3, LABOR_SKILL_VALUE_LEVEL + 1, LABOR_SKILL_GOOD_LEVEL + 2];
    const colours = levels.map((level) => {
      w.setSkill(d0, 'mining', level);
      const s = surface(80, 42);
      screen.draw(s);
      const g = screen.grid(80, 42);
      return s.cells.get(g.gridCol + miningCol * g.cellCols, g.dataRow).fg;
    });
    expect(colours[0]).toBe(theme.dim);
    expect(colours[1]).toBe(theme.text);
    expect(colours[2]).toBe(theme.value);
    expect(colours[3]).toBe(theme.good);
    screen.cursorRow = 0;
    screen.cursorCol = miningCol;
    w.setSkill(d0, 'mining', 6);
    const s = surface(80, 42);
    screen.draw(s);
    expect(s.lines()[1]).toContain('skill 6 (Competent)');
    w.setSkill(d0, 'mining', 0);
    const s2 = surface(80, 42);
    screen.draw(s2);
    expect(s2.lines()[1]).toContain('no skill');
  });

  it('a typed letter jumps to the next labor starting with it, wrapping', () => {
    const { screen } = manager('t275-jump');
    const at = (name: string): number => laborNames.indexOf(name);
    screen.cursorCol = 0;
    const seen: number[] = [];
    for (let k = 0; k < 5; k += 1) { screen.key(press('m')); seen.push(screen.cursorCol); }
    expect(seen).toEqual([at('Masonry'), at('Mechanics'), at('Medicine'), at('Mining'), at('Masonry')]);
    // Shift jumps for the letters the manager keeps: a, c, t.
    screen.cursorCol = 0;
    screen.key(press('C', { shift: true }));
    expect(screen.cursorCol).toBe(at('Carpentry'));
    screen.key(press('T', { shift: true }));
    expect(screen.cursorCol).toBe(at('Textiles'));
    expect(screen.templateMenu).toBeNull();
    // The bare keys keep their meaning.
    screen.key(press('t'));
    expect(screen.templateMenu).toBe(0);
  });

  it('writes the heads in full in a tall window and cut to nine rows in a short one', () => {
    const { screen } = manager('t275-heads');
    const longest = Math.max(...laborNames.map((n) => Array.from(n).length));
    const tall = screen.grid(80, LABOR_TALL_WINDOW_ROWS);
    expect(tall.headerRows).toBe(longest);
    const s = surface(80, LABOR_TALL_WINDOW_ROWS);
    screen.draw(s);
    const lines = s.lines();
    const k = laborNames.indexOf('Animal training');
    const col = tall.gridCol + k * tall.cellCols;
    const down = Array.from({ length: tall.headerRows }, (_, r) => lines[tall.headerRow + r]?.charAt(col) ?? ' ').join('').trimEnd();
    expect(down).toBe('Animal training');
    expect(screen.grid(80, LABOR_TALL_WINDOW_ROWS - 1).headerRows).toBe(9);
  });
});
