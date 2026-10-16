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

  it('Designate offers the twelve designations with their keys, a priority control, undo, and tells how to mark an area', () => {
    const s = surface(36, 32);
    game.fortress.tool.choose('d');
    drawDesignatePanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, game.fortress.tool, strings);
    const rows = rowsOf(s.lines());
    expect(rows[0]).toMatch(/^\[S-d\] Dig {8}\[S-c\] Channel$/);
    expect(rows[1]).toMatch(/^\[S-u\] Up stairs {2}\[S-j\] Down stair/);
    expect(rows[2]).toMatch(/^\[i\] Up\/down {6}\[r\] Ramp$/);
    expect(rows[3]).toMatch(/^\[w\] Stairwell {4}\[S-s\] Smooth$/);
    expect(rows[4]).toMatch(/^\[S-e\] Engrave {4}\[x\] Remove const/);
    expect(rows[5]).toMatch(/^\[S-t\] Chop trees \[g\] Gather plant$/);
    expect(rows[6]).toMatch(/^\[h\] Harvest {6}\[S-f\] Traffic/);
    expect(rows[7]).toBe('Priority [-] 5 [+]   (1-9)');
    expect(rows[8]).toBe('[Ctrl+Z] undo last  [Del] clear');
    expect(rows[9]).toBe('[S-p] last batch to priority 5');
    expect(rows[10]).toBe('─ Drag a rectangle on the map, or');
    expect(rows[11]).toMatch(/^ {2}click two corners\. Enter confirms/);
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

  it('Help starts on the key list, which names each fortress panel with its key and then the global keys, and shows how far it is scrolled', () => {
    const s = surface(40, 30);
    game.fortress.help.tab = 0;
    drawHelpPanel(s, { col: 0, row: 0, cols: 40, rows: 30 }, game.fortress.help);
    const rows = rowsOf(s.lines());
    expect(rows[0]).toBe('[1] Keys   [2] Legend');
    expect(rows[1]).toBe('Fortress panels');
    const panels: Record<string, string> = {
      d: 'Designate', b: 'Build', z: 'Zones', u: 'Units', l: 'Labors', j: 'Jobs', o: 'Orders', s: 'Stocks', m: 'Military',
      n: 'Animals', t: 'Threats', c: 'Civilizations', p: 'Population', e: 'Mood', a: 'Log', k: 'Look', f: 'Overlays',
    };
    for (const [key, name] of Object.entries(panels)) expect(rows, `${key} ${name}`).toContain(`${key}  ${name} panel`);
    expect(rows[19]).toBe('Global');
    expect(rows[20]).toBe('Esc  cancel tool → close panel → game');
    expect(rows[21]).toBe('Space  pause / resume');
    expect(rows[22]).toBe('+ =  speed up (1x → 2x → 4x)');
    expect(rows[23]).toBe('-  speed down');
    expect(rows[24]).toBe('F5  quick save');
    expect(rows[25]).toBe('F9  quick load (confirm)');
    expect(rows[26]).toBe('Ctrl+S  save menu');
    expect(rows[27]).toBe('F12  debug panel');
    expect(rows[28]).toBe('?  help');
    expect(rows[29]).toMatch(/^Tab {2}toggle sidebar +1\/\d+$/);
  });

  it('Help on the Legend tab explains the terrain, fluid and creature glyphs, each as the glyph and what it stands for', () => {
    const s = surface(40, 30);
    game.fortress.help.tab = 1;
    drawHelpPanel(s, { col: 0, row: 0, cols: 40, rows: 30 }, game.fortress.help);
    const rows = rowsOf(s.lines());
    expect(rows[0]).toBe('[1] Keys   [2] Legend');
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
    expect(rows[29]).toMatch(/ +1\/\d+$/);
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
    expect(rows[47]).toMatch(/^ ☼ Designate a place to dig with \[d\]\./);
    expect(rows[48]).toMatch(new RegExp(`^ Day 1 of Spring, Year 1 ☼ clear -?\\d+°C ☺ ${dwarves} ♥ Fine z 32 ║ +\\[Esc\\] menu {2}\\[\\?\\] help *$`));
    expect(rows[49]?.trim()).toBe('Dig · priority 5 · [Esc] cancel');
  });
});
