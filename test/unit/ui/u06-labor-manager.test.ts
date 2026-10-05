/**
 * U-06: the labor manager (`ui-screens/panels.md` § Labor manager; UI audit M5 and § 3 "Set many
 * dwarves' labors", "Change labor priority"): scrolling rows, named heads, the priority row,
 * profession templates and multi-select.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import type { JobsReader } from '@systems/jobs';
import { LABOR_HEADER_ROWS, LABOR_TEMPLATES } from '@ui/constants';
import { LaborManagerScreen } from '@ui/screens/labor_manager';
import { TestWorld } from '../../scenarios/test-world';
import { press, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const COLS = 80;
const ROWS = 42;

interface Fixture {
  w: TestWorld;
  screen: LaborManagerScreen;
  sent: Command[];
  dwarves: EntityId[];
  closed: { n: number };
}

function setup(seed: string, count: number, children = 0): Fixture {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const dwarves: EntityId[] = [];
  for (let k = 0; k < count; k += 1) {
    dwarves.push(w.spawnDwarf({ at: w.index(10 + (k % 40), 10 + Math.floor(k / 40), z), name: `Dwarf${String(k).padStart(2, '0')} Stone`, ageYears: k < children ? 3 : 30 }));
  }
  const sent: Command[] = [];
  const closed = { n: 0 };
  const screen = new LaborManagerScreen({
    readers: w.readers,
    registry: w.game.registry,
    strings,
    submit: (c) => { sent.push(c); w.submit(c); },
    back: () => { closed.n += 1; },
  });
  return { w, screen, sent, dwarves, closed };
}

function draw(screen: LaborManagerScreen): string[] {
  const s = surface(COLS, ROWS);
  screen.draw(s);
  return s.lines();
}

function click(screen: LaborManagerScreen, col: number, row: number, shift = false): void {
  screen.pointerDown({ col, row, button: 0, shift, ctrl: false, alt: false, meta: false });
}

const jobs = (w: TestWorld): JobsReader => w.readers.of<JobsReader>('11');
const laborIds = registry.table<{ id: string; name: string }>('labors').ids();

describe('U-06 labor manager: rows and heads (M5)', () => {
  it('reaches dwarf #60 of 80 with the keyboard, the wheel and End', () => {
    const { screen } = setup('u06-lm-80', 80);
    expect(draw(screen).join('\n')).not.toContain('Dwarf59 Stone');
    for (let k = 0; k < 59; k += 1) screen.key(press('↓'));
    const text = draw(screen).join('\n');
    expect(screen.cursorRow).toBe(59);
    expect(screen.firstRow).toBeGreaterThan(0);
    expect(text).toContain('Dwarf59 Stone');
    screen.key(press('End'));
    expect(draw(screen).join('\n')).toContain('Dwarf79 Stone');
    screen.key(press('Home'));
    expect(draw(screen).join('\n')).toContain('Dwarf00 Stone');
    for (let k = 0; k < 20; k += 1) screen.wheel({ col: 40, row: 20, dy: 1, shift: false, ctrl: false, alt: false, meta: false });
    expect(draw(screen).join('\n')).toContain('Dwarf59 Stone');
  });

  it('shows every labor at 80 columns under a head that is unique, and names the cursor labor in full', () => {
    const { screen } = setup('u06-lm-heads', 3);
    const g = screen.grid(COLS, ROWS);
    expect(g.fit).toBe(laborIds.length);
    const names = laborIds.map((id) => registry.table<{ id: string; name: string }>('labors').byId(id)?.name ?? '');
    const heads = names.map((n) => Array.from(n).slice(0, LABOR_HEADER_ROWS).join(''));
    expect(new Set(heads).size).toBe(names.length);
    const lines = draw(screen);
    // The head of column k reads downward.
    names.forEach((_name, k) => {
      const col = g.gridCol + k * g.cellCols;
      const down = Array.from({ length: LABOR_HEADER_ROWS }, (_, r) => lines[g.headerRow + r]?.charAt(col) ?? ' ').join('').trimEnd();
      expect(down).toBe(heads[k]?.trimEnd());
    });
    screen.key(press('→'));
    expect(draw(screen)[1]).toContain('Animal training');
    expect(draw(screen)[1]).toContain('Dwarf00 Stone');
    // Hovering another cell names that dwarf and labor instead.
    screen.pointerMove({ col: g.gridCol + 4 * g.cellCols, row: g.dataRow + 2, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    const info = draw(screen)[1] ?? '';
    expect(info).toContain('Dwarf02 Stone');
    expect(info).toContain(names[4] as string);
  });

  it('a narrow screen scrolls the columns to the cursor', () => {
    const { screen } = setup('u06-lm-narrow', 2);
    const s = surface(40, 30);
    for (let k = 0; k < laborIds.length - 1; k += 1) screen.key(press('→'));
    screen.draw(s);
    expect(screen.cursorCol).toBe(laborIds.length - 1);
    expect(screen.firstCol).toBeGreaterThan(0);
    expect(s.lines()[1]).toContain('Woodcutting');
  });
});

describe('U-06 labor manager: cells, marks and templates (M5)', () => {
  it('a click toggles one cell and shows it at once; the command applies at the next tick', () => {
    const { w, screen, sent, dwarves } = setup('u06-lm-click', 4);
    const g = screen.grid(COLS, ROWS);
    draw(screen);
    const mining = laborIds.indexOf('mining');
    const before = jobs(w).laborEnabled(dwarves[1] as EntityId, 'mining');
    click(screen, g.gridCol + mining * g.cellCols, g.dataRow + 1);
    expect(sent).toEqual([{ type: 'SetLabor', dwarfId: dwarves[1], labor: 'mining', on: !before }]);
    // Paused: the reader still has the old value, the screen shows what was asked.
    expect(jobs(w).laborEnabled(dwarves[1] as EntityId, 'mining')).toBe(before);
    expect(screen.enabled(dwarves[1] as EntityId, 'mining')).toBe(!before);
    w.step(1);
    draw(screen);
    expect(jobs(w).laborEnabled(dwarves[1] as EntityId, 'mining')).toBe(!before);
    expect(screen.enabled(dwarves[1] as EntityId, 'mining')).toBe(!before);
  });

  it('Space marks rows, Shift-click a range, * all; an action on a marked row reaches every marked dwarf', () => {
    const { screen, sent, dwarves } = setup('u06-lm-marks', 8);
    const g = screen.grid(COLS, ROWS);
    draw(screen);
    screen.key(press(' '));
    expect(screen.marks.list(dwarves)).toEqual([dwarves[0]]);
    // Shift-click the fourth name: rows 0..3.
    click(screen, 5, g.dataRow + 3, true);
    expect(screen.marks.list(dwarves)).toEqual(dwarves.slice(0, 4));
    expect(draw(screen)[g.headerRow]).toContain('4 of 8 marked');
    // Enter on a marked row: the cursor's cell value goes to all four.
    const on = !screen.enabled(dwarves[3] as EntityId, laborIds[0] as string);
    screen.key(press('Enter'));
    expect(sent.every((c) => c.type === 'SetLabor' && c['labor'] === laborIds[0] && c['on'] === on)).toBe(true);
    expect(new Set(sent.map((c) => c['dwarfId']))).toEqual(new Set(dwarves.slice(0, 4)));
    // An unmarked row acts alone.
    sent.length = 0;
    click(screen, g.gridCol, g.dataRow + 6);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.['dwarfId']).toBe(dwarves[6]);
    screen.key(press('*', { shift: true }));
    expect(screen.marks.size).toBe(8);
    screen.key(press('*', { shift: true }));
    expect(screen.marks.size).toBe(0);
    // Shift+↓ marks the rows it passes.
    screen.key(press('Home'));
    screen.key(press('↓', { shift: true }));
    screen.key(press('↓', { shift: true }));
    expect(screen.marks.list(dwarves)).toEqual(dwarves.slice(0, 3));
  });

  it('a template applied to 5 selected dwarves sends exactly the SetLabor commands that make them miners', () => {
    const { w, screen, sent, dwarves } = setup('u06-lm-template', 9);
    draw(screen);
    const chosen = dwarves.slice(2, 7);
    screen.key(press('↓'));
    screen.key(press('↓'));
    for (let k = 0; k < 5; k += 1) {
      screen.key(press(' '));
      screen.key(press('↓'));
    }
    expect(screen.marks.list(dwarves)).toEqual(chosen);
    const miner = LABOR_TEMPLATES.find((t) => t.id === 'miner')?.labors ?? [];
    const expected: Command[] = [];
    for (const d of chosen) for (const labor of laborIds) {
      const want = miner.includes(labor);
      if (jobs(w).laborEnabled(d, labor) !== want) expected.push({ type: 'SetLabor', dwarfId: d, labor, on: want });
    }
    expect(expected.length).toBeGreaterThan(0);
    screen.key(press('t'));
    expect(draw(screen).join('\n')).toContain('Apply a template to 5 dwarves');
    expect(draw(screen).join('\n')).toContain('[1] Miner');
    expect(draw(screen).join('\n')).toContain('Mining, Hauling');
    screen.key(press('1'));
    expect(screen.templateMenu).toBeNull();
    expect(sent).toEqual(expected);
    expect(screen.notice).toBe(`Miner: ${expected.length} labors changed for 5 dwarves.`);
    w.step(1);
    for (const d of chosen) expect(laborIds.filter((l) => jobs(w).laborEnabled(d, l)).sort()).toEqual([...miner].sort());
    // The others keep theirs, and a second application has nothing to send.
    expect(laborIds.filter((l) => jobs(w).laborEnabled(dwarves[0] as EntityId, l)).length).toBeGreaterThan(2);
    sent.length = 0;
    screen.applyTemplate('miner');
    expect(sent).toEqual([]);
    expect(screen.notice).toContain('Nothing to change');
  });

  it('every template names labors that exist; the menu applies by arrow and Enter, and by click', () => {
    for (const t of LABOR_TEMPLATES) {
      for (const labor of t.labors) expect(laborIds).toContain(labor);
      expect(strings.has(`ui.labor_manager.template.${t.id}`)).toBe(true);
    }
    expect(LABOR_TEMPLATES.map((t) => t.id)).toEqual(['miner', 'hauler', 'farmer', 'crafter', 'soldier', 'none']);
    const { w, screen, sent, dwarves } = setup('u06-lm-menu', 2);
    draw(screen);
    screen.key(press('t'));
    screen.key(press('↓'));
    screen.key(press('Enter'));
    w.step(1);
    expect(laborIds.filter((l) => jobs(w).laborEnabled(dwarves[0] as EntityId, l))).toEqual(['hauling']);
    // Esc closes the menu, not the screen.
    screen.key(press('t'));
    screen.key(press('Esc'));
    expect(screen.templateMenu).toBeNull();
    // By mouse: the footer button opens it, a row applies it.
    sent.length = 0;
    const s = surface(COLS, ROWS);
    screen.key(press('↓'));
    screen.draw(s);
    const foot = s.lines().findIndex((l) => l.includes('[t] templates'));
    click(screen, (s.lines()[foot] ?? '').indexOf('[t] templates') + 1, foot);
    expect(screen.templateMenu).toBe(0);
    const s2 = surface(COLS, ROWS);
    screen.draw(s2);
    const row = s2.lines().findIndex((l) => l.includes('Everything off'));
    click(screen, (s2.lines()[row] ?? '').indexOf('Everything off'), row);
    w.step(1);
    expect(laborIds.filter((l) => jobs(w).laborEnabled(dwarves[1] as EntityId, l))).toEqual([]);
  });

  it('children are skipped and the status line says so', () => {
    const { screen, sent, dwarves } = setup('u06-lm-children', 4, 2);
    draw(screen);
    screen.key(press('Enter'));
    expect(sent).toEqual([]);
    expect(screen.notice).toBe('Nothing changed: children take no labors.');
    expect(draw(screen)[1]).toContain('children take no labors');
    screen.key(press('*', { shift: true }));
    screen.applyTemplate('none');
    expect(sent.length).toBeGreaterThan(0);
    expect(new Set(sent.map((c) => c['dwarfId']))).toEqual(new Set(dwarves.slice(2)));
    expect(screen.notice).toContain('2 children skipped');
  });

  it('[c] toggles the column for everyone, [a] the row; Esc and the close button leave', () => {
    const { screen, sent, dwarves, closed } = setup('u06-lm-col', 5);
    draw(screen);
    screen.key(press('c'));
    expect(sent).toHaveLength(dwarves.length);
    expect(sent.every((c) => c['labor'] === laborIds[0])).toBe(true);
    sent.length = 0;
    screen.key(press('a'));
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((c) => c['dwarfId'] === dwarves[0])).toBe(true);
    screen.key(press('Esc'));
    expect(closed.n).toBe(1);
    const s = surface(COLS, ROWS);
    screen.draw(s);
    click(screen, (s.lines()[0] ?? '').indexOf('[Esc] close') + 2, 0);
    expect(closed.n).toBe(2);
  });
});

describe('U-06 labor manager: the priority row (M5, § 3 "Change labor priority")', () => {
  it('+, -, a digit and a click send SetLaborPriority; the limit says why nothing is sent', () => {
    const { w, screen, sent } = setup('u06-lm-priority', 3);
    const g = screen.grid(COLS, ROWS);
    const mining = laborIds.indexOf('mining');
    for (let k = 0; k < mining; k += 1) screen.key(press('→'));
    draw(screen);
    const before = jobs(w).laborPriority('mining');
    screen.key(press('+', { shift: true }));
    expect(sent).toEqual([{ type: 'SetLaborPriority', labor: 'mining', priority: before + 1 }]);
    expect(draw(screen)[g.priorityRow]?.charAt(g.gridCol + mining * g.cellCols)).toBe(String(before + 1));
    w.step(1);
    expect(jobs(w).laborPriority('mining')).toBe(before + 1);
    screen.key(press('-'));
    screen.key(press('2'));
    w.step(1);
    expect(jobs(w).laborPriority('mining')).toBe(2);
    expect(sent.map((c) => c['priority'])).toEqual([before + 1, before, 2]);
    // A click on the number: +1; with Shift: -1.
    click(screen, g.gridCol + mining * g.cellCols, g.priorityRow);
    click(screen, g.gridCol + mining * g.cellCols, g.priorityRow, true);
    click(screen, g.gridCol + mining * g.cellCols, g.priorityRow, true);
    w.step(1);
    expect(jobs(w).laborPriority('mining')).toBe(1);
    sent.length = 0;
    screen.key(press('-'));
    expect(sent).toEqual([]);
    expect(screen.notice).toBe('Mining: the priority stays within 1–9.');
    screen.key(press('9'));
    screen.key(press('+', { shift: true }));
    expect(sent).toEqual([{ type: 'SetLaborPriority', labor: 'mining', priority: 9 }]);
  });
});
