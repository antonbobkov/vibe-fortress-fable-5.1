/**
 * T-735: a table that scrolls lays its rows out in the cells its list leaves beside the scrollbar, so a
 * row whose cells fit ends in no `»` (`reports/data/2026-11-25-playtest-3.md`, finding 2: from 22
 * dwarves on, every Units row read "Eating »"). The table widget's fix came with T-719; this pins it
 * for every panel whose table scrolls at scale: Units (both tabs), Jobs and Animals, each drawn at
 * the sidebar's 36 columns with more rows than fit. (Military's squad table is as tall as its squads
 * and never scrolls.)
 */
import { describe, expect, it, vi } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { drawAnimalsPanel } from '@ui/panels/animals';
import { drawJobsPanel } from '@ui/panels/jobs';
import { drawUnitsPanel } from '@ui/panels/units';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import type { Surface } from '@ui/surface';
import { defaultUiState } from '@ui/ui-state';
import { table } from '@ui/widgets';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const COLS = 36;
const ROWS = 40;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 10 * TICKS_PER_DAY });
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: () => {},
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 50, true), precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 0,
  };
  return { w, f: new FortressScreen(host, keymap, strings) };
}

/** A panel drawn at the sidebar's width; its rows, without trailing blanks. */
function draw(paint: (s: Surface, rect: { col: number; row: number; cols: number; rows: number }) => void): { s: Surface; rows: string[] } {
  const s = surface(COLS, ROWS);
  paint(s, { col: 0, row: 0, cols: COLS, rows: ROWS });
  return { s, rows: s.lines().map((line) => line.trimEnd()) };
}

/** The rows that end in the list's scrollbar column (`│` track, `█` thumb). */
function scrolled(rows: readonly string[]): string[] {
  return rows.filter((row) => /[│█]$/.test(row));
}

/** Forty dwarves, each eating. */
function eaters(seed: string) {
  const a = setup(seed);
  const dwarves: EntityId[] = [];
  for (let k = 0; k < 40; k += 1) dwarves.push(a.w.spawnDwarf({ at: a.w.index(10 + (k % 20), 10 + Math.floor(k / 20), z), name: `Urist ${k}`, ageYears: 40 }));
  const reader = a.w.readers.of<{ activityText(id: EntityId): string }>('10');
  vi.spyOn(reader, 'activityText').mockImplementation(() => 'Eating');
  return { ...a, dwarves };
}

describe('T-735 a scrolling table cuts no row whose cells fit', () => {
  it('the table widget: a row that fits beside the scrollbar ends in no `»`; one whose last cell is too long does', () => {
    const s = surface(COLS, 8);
    const columns = [{ title: 'Name', width: 12 }, { title: 'Doing', width: 10 }];
    // The last column is 34 − 12 = 22 cells, 21 beside the scrollbar: 21 letters fit, 22 do not.
    const rows = Array.from({ length: 12 }, (_, k) => ['Urist', k === 1 ? 'x'.repeat(22) : 'y'.repeat(21)]);
    table(s, { col: 0, row: 0, cols: 34, rows: 8 }, columns, rows, { selected: 0, scroll: 0 });
    const lines = s.lines().slice(1, 8).map((line) => line.trimEnd());
    expect(lines[0]).toBe(`Urist       ${'y'.repeat(21)}█`);
    expect(lines[1]).toBe(`Urist       ${'x'.repeat(20)}»│`);
    expect(lines.filter((line) => line.includes('»'))).toHaveLength(1);
    expect(s.tooltipAt(12, 2)?.text).toBe('x'.repeat(22));
  });

  it('Units, the Dwarves tab: forty dwarves at 36 columns read "Eating" with no `»`', () => {
    const { f } = eaters('t735-units');
    const { rows } = draw((s, rect) => drawUnitsPanel(s, rect, f.units, f.ctx));
    const list = scrolled(rows);
    expect(list.length).toBeGreaterThan(20);
    for (const row of list) expect(row).toMatch(/Urist \d+ +\S Eating +[│█]$/);
    expect(rows.join('\n')).not.toContain('»');
  });

  it('Units, the All tab: forty dwarves read "Eating" with no `»`', () => {
    const { f } = eaters('t735-units-all');
    f.units.setTab(1);
    const { rows } = draw((s, rect) => drawUnitsPanel(s, rect, f.units, f.ctx));
    const list = scrolled(rows);
    expect(list.length).toBeGreaterThan(20);
    for (const row of list) expect(row).toMatch(/Urist \d+ +Eating +[│█]$/);
    expect(rows.join('\n')).not.toContain('»');
  });

  it('Jobs: sixty jobs listed one to a row end in no `»`', () => {
    const { w, f } = setup('t735-jobs');
    const granite = w.game.registry.table('materials').index('granite');
    const tiles = Array.from({ length: 60 }, (_, k) => w.index(10 + (k % 30), 30 + Math.floor(k / 30), z));
    for (const t of tiles) w.carve(t, TileKind.Wall, granite);
    w.submit({ type: 'Designate', kind: 'dig', tiles, priority: 4 });
    w.step(1);
    // The digs batch into one row; `Enter` lists them one to a row.
    f.jobs.list.selected = 0;
    f.jobs.openBatch(f.ctx);
    const { rows } = draw((s, rect) => drawJobsPanel(s, rect, f.jobs, f.ctx));
    const list = scrolled(rows);
    expect(list.length).toBeGreaterThan(10);
    for (const row of list) expect(row).toMatch(/^ *4 +Dig\b.*\S +[│█]$/);
    expect(list.join('\n')).not.toContain('»');
  });

  it('Animals: forty named dogs, a row each, end in no `»`', () => {
    const { w, f } = setup('t735-animals');
    for (let k = 0; k < 40; k += 1) {
      const dog = w.spawnTame('dog', w.index(10 + (k % 20), 20 + Math.floor(k / 20), z));
      (w.game.world.entities.get(dog, C.Creature) as { name: string }).name = `Rex${k}`;
    }
    f.openPanel('animals');
    const { rows } = draw((s, rect) => drawAnimalsPanel(s, rect, f.animals, f.ctx));
    const list = scrolled(rows);
    expect(list.length).toBeGreaterThan(10);
    for (const row of list) expect(row).toMatch(/dog Rex\d+ .*[│█]$/);
    expect(rows.join('\n')).not.toContain('»');
  });
});
