/**
 * T-332: what the Designate tool, the Overlays menu, the Help panel's two tabs, the Debug panel,
 * the Calendar panel and the fortress screen's bottom rows say. They were stored cell buffers
 * (T-M8-04); each assertion now names what a row means. The fortress: seed `m8-panels` with the
 * default embark, as it opens.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { drawCalendarPanel } from '@ui/panels/calendar';
import { type DebugHost, drawDebugPanel } from '@ui/panels/debug';
import { drawDesignatePanel } from '@ui/panels/designate';
import { drawHelpPanel } from '@ui/panels/help';
import { drawOverlaysPanel } from '@ui/panels/overlays';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { strings, surface } from './ui-fixture';

let game: Game;

/** Rows of a surface with the one-column margin and trailing blanks taken off. */
function rowsOf(lines: string[]): string[] {
  return lines.map((line) => line.trimEnd().replace(/^ /, ''));
}

describe('T-332 panels: designate, overlays, help, debug, calendar and the bottom rows', () => {
  beforeAll(async () => {
    game = new Game({
      canvas: new MockCanvas(),
      seed: 'm8-panels',
      registry: loadContent(),
      createCanvas: mockCanvasFactory(),
      devicePixelRatio: 1,
      width: 1280,
      height: 800,
    });
    await game.start({ embark: 'default' });
  });

  it('Designate offers the fourteen designations with whole captions, a priority control, undo, and tells how to mark an area', () => {
    const s = surface(36, 32);
    game.fortress.tool.choose('d');
    drawDesignatePanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, game.fortress.tool, strings);
    const rows = rowsOf(s.lines());
    // T-280: no caption is cut at 36 columns.
    expect(rows.slice(0, 7)).toEqual([
      '[S-d] Dig        [S-c] Channel',
      '[S-u] Up stair   [S-j] Down stair',
      '[i] Up/down      [r] Ramp',
      '[w] Stairwell    [S-s] Smooth',
      '[S-e] Engrave    [x] Remove',
      '[S-t] Chop trees [g] Gather',
      '[h] Harvest      [S-f] Traffic',
    ]);
    for (const row of rows) expect(row).not.toContain('»');
    expect(rows[7]).toBe('Priority [-] 5 [+]   (1-9)');
    expect(rows[8]).toBe('[Ctrl+Z] undo  [Del] clear');
    expect(rows[9]).toBe('[S-p] last batch to priority 5');
    expect(rows[10]).toBe('Click 2 corners; [<] [>] levels.');
  });

  it('Overlays lists the map layers with a tick for the two that are on, and the debug layers apart', () => {
    const s = surface(36, 32);
    drawOverlaysPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, game.fortress.overlayMenu, game.ui.overlays);
    const rows = rowsOf(s.lines());
    expect(rows.slice(0, 8)).toEqual([
      '[■] designations', '[ ] priority digits', '[■] zones', '[ ] fluid levels',
      '[ ] temperature', '[ ] jobs', '[ ] squad stations', '[ ] stockpile usage',
    ]);
    expect(rows[8]).toBe('Debug:');
    expect(rows.slice(9, 12)).toEqual(['[ ] connectivity', '[ ] paths', '[ ] chunks']);
  });

  it('Help starts on the key list: it says what S- means, names each fortress panel with its key, then the global keys, wrapping what does not fit', () => {
    const s = surface(40, 30);
    game.fortress.help.tab = 0;
    game.fortress.help.scroll = 0;
    drawHelpPanel(s, { col: 0, row: 0, cols: 40, rows: 30 }, game.fortress.help);
    const rows = rowsOf(s.lines());
    expect(rows[0]).toBe('[1] Keys   [2] Legend   [3] Start');
    expect(rows[1]).toBe('S- is Shift');
    expect(rows[2]).toBe('Fortress panels');
    const panels: Record<string, string> = {
      d: 'Designate', b: 'Build', z: 'Zones', u: 'Units', l: 'Labors', j: 'Jobs', o: 'Orders', s: 'Stocks', m: 'Military',
      n: 'Animals', t: 'Threats', c: 'Civilizations', p: 'Population', e: 'Mood', a: 'Log', k: 'Look', f: 'Overlays',
    };
    for (const [key, name] of Object.entries(panels)) expect(rows, `${key} ${name}`).toContain(`${key}  ${name} panel`);
    expect(rows[20]).toBe('Global');
    // A row that does not fit wraps with a hanging indent under its description.
    expect(rows[21]).toBe('Esc  cancel tool → close panel → game');
    expect(rows[22]).toBe('     menu');
    expect(rows[23]).toBe('Space  pause / resume');
    expect(rows[24]).toBe('+ =  speed up (1x → 2x → 4x)');
    expect(rows[25]).toBe('-  speed down');
    expect(rows[26]).toBe('F5  quick save');
    expect(rows[27]).toBe('F9  quick load (confirm)');
    expect(rows[28]).toBe('Ctrl+S  save menu');
    expect(rows[29]).toMatch(/^F12 {2}debug panel +page 1\/\d+$/);
  });

  it('PageDown moves a page less one line and the page mark follows', () => {
    const s = surface(40, 30);
    const help = game.fortress.help;
    help.tab = 0;
    help.scroll = 0;
    drawHelpPanel(s, { col: 0, row: 0, cols: 40, rows: 30 }, help);
    help.page(1);
    expect(help.scroll).toBe(28);
    drawHelpPanel(s, { col: 0, row: 0, cols: 40, rows: 30 }, help);
    expect(rowsOf(s.lines())[29]).toMatch(/page 2\/\d+$/);
    // The rest of the Global keys are on the second page.
    const second = rowsOf(s.lines());
    expect(second).toContain('?  help');
    expect(second.some((row) => row.startsWith('Tab  toggle sidebar'))).toBe(true);
    help.page(-1);
    expect(help.scroll).toBe(0);
  });

  it('Help on the Legend tab explains the terrain, fluid and creature glyphs, each as the glyph and what it stands for', () => {
    const s = surface(40, 30);
    game.fortress.help.tab = 1;
    game.fortress.help.scroll = 0;
    drawHelpPanel(s, { col: 0, row: 0, cols: 40, rows: 30 }, game.fortress.help);
    const rows = rowsOf(s.lines());
    expect(rows[0]).toBe('[1] Keys   [2] Legend   [3] Start');
    expect(rows[1]).toBe('Terrain');
    expect(rows).toContain('▒  rough wall');
    expect(rows).toContain('█  smoothed or block wall');
    expect(rows).toContain('▲  ramp');
    expect(rows).toContain('<  stairs up');
    expect(rows).toContain('>  stairs down');
    expect(rows).toContain('♣  tree');
    expect(rows[17]).toBe('Fluids');
    expect(rows).toContain('~  water, levels 1-2');
    expect(rows).toContain('≈  water, levels 3-7');
    expect(rows).toContain('^  fire');
    expect(rows[25]).toBe('Creatures');
    expect(rows).toContain('b  badger');
    expect(rows).toContain('B  bear');
    expect(rows[29]).toMatch(/ page 1\/\d+$/);
  });

  it('Help on the Start tab gives the eight steps of a first season, wrapped whole', () => {
    const s = surface(40, 30);
    game.fortress.help.tab = 2;
    game.fortress.help.scroll = 0;
    drawHelpPanel(s, { col: 0, row: 0, cols: 40, rows: 30 }, game.fortress.help);
    const rows = rowsOf(s.lines());
    expect(rows[1]).toBe('1. Dig in: [d], drag over a rock face.');
    expect(rows[2]).toBe('   Dwarves dig from the side.');
    const text = rows.join(' ').replace(/\s+/g, ' ');
    expect(text).toContain("4. Workshops: [b] Workshops; then orders with [o]. Build a carpenter's workshop and a still first.");
    expect(text).toContain('7. Safety: a door on your hall set to Lock on alert, and a squad [m] with clubs.');
    expect(text).toContain('8. Space pauses. [?] opens this help.');
    for (const row of rows) expect(row).not.toContain('»');
  });

  it('Debug gives the seed and tick, a timing row for each system, the entity counts, and the debug keys', () => {
    const s = surface(40, 30);
    const debugHost: DebugHost = {
      stats: () => game.host.world.stats(),
      seed: () => game.host.world.seed,
      dumpSave: () => {},
      replaySeasonLog: () => {},
      hashWorld: () => {},
    };
    drawDebugPanel(s, { col: 0, row: 0, cols: 40, rows: 30 }, game.fortress.debugPanel, game.fortress.ctx, debugHost);
    const rows = rowsOf(s.lines());
    expect(rows[0]).toBe(`seed m8-panels  tick ${game.host.readers.calendar.tick}`);
    expect(rows[1]).toMatch(/^last tick \d+\.\d{3} ms$/);
    expect(rows[2]).toMatch(/^─+ Timings ─+$/);
    expect(rows[3]).toMatch(/^System +avg ms +worst ms$/);
    const timings = rows.slice(4, 24);
    expect(timings.length).toBeGreaterThan(15);
    for (const row of timings) expect(row).toMatch(/^\d\d +\d+\.\d{3} +\d+\.\d{3}$/);
    expect(rows[24]).toMatch(/^─+ Counts ─+$/);
    expect(rows[25]).toMatch(/^creature \d+$/);
    expect(rows[26]).toMatch(/^item \d+$/);
    expect(rows.slice(27)).toEqual(['[S-d] dump save', '[r] replay season log', '[h] hash world']);
  });

  it('Calendar gives the season and year, the day and hour, the hours of daylight, and the weather with the temperature', () => {
    const s = surface(36, 24);
    drawCalendarPanel(s, { col: 0, row: 0, cols: 36, rows: 24 }, game.host.readers, strings);
    const rows = rowsOf(s.lines());
    expect(rows[0]).toBe('Spring, Year 1');
    expect(rows[1]).toBe('Day 1, hour 8');
    expect(rows[2]).toBe('Daylight 6-19');
    expect(rows[3]).toMatch(/^clear, 0 h left · -?\d+°C$/);
  });

  it('the rows under the map hold the hint, the status with date, weather, population, mood and depth, and the tool in use', () => {
    game.fortress.tool.choose('d');
    game.ui.panel = null;
    game.ui.sidebar = false;
    game.render();
    const s = game.uiSurface;
    if (!s) throw new Error('game surface missing after render');
    const rows = s.lines();
    const dwarves = game.host.readers.of<{ list(): number[] }>('10').list().length;
    expect(rows).toHaveLength(50);
    // The map fills the screen above the log, and no panel is open beside it.
    expect(rows[0]).toMatch(/^[.]{80}$/);
    // The hint does not fit one line, so it takes two of the strip's lines and none of it is cut.
    expect(rows[46]).toMatch(/^ ☼ Designate a place to dig with \[d\]\. Dwarves dig into rock faces from the {2}/);
    expect(rows[47]?.trim()).toBe('side.');
    expect(rows[48]).toMatch(new RegExp(`^ Day 1 of Spring, Year 1 ☼ clear -?\\d+°C ☺ ${dwarves} ♥ Fine z 32 ║ +\\[Esc\\] menu {2}\\[\\?\\] help *$`));
    expect(rows[49]?.trim()).toBe('Dig · priority 5 · [Esc] cancel');
  });
});
