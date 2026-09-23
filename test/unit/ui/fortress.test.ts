/**
 * T-M1-14 fortress screen: the designate tool, the look panel, the log strip, the status bar,
 * the announcement registry, the mouse model and the `ui` save section
 * (`ui-screens/fortress-screen.md`, 24 § Fortress screen layout, § Input model, § Inspection,
 * § Announcements and the log, `ui-keymap-and-screens.md` § Mouse).
 */

import { describe, it, expect, vi } from 'vitest';
import { loadContent } from '@content/loader';
import type { Command } from '@core/commands';
import { Designation, TileFlag } from '@core/map3d';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Game } from '@app/game';
import { readJsonSection } from '@app/save-manager';
import { AnnouncementLog, lineText } from '@ui/announcements';
import { LOG_DEDUP_TICKS } from '@ui/constants';
import { DesignateTool, rectTiles } from '@ui/panels/designate';
import { speedText, statusFields, statusRow1 } from '@ui/status';
import { defaultUiState, fromSaved, toSaved, type SavedUiState } from '@ui/ui-state';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, strings } from './ui-fixture';

const registry = loadContent();

async function fortressGame(): Promise<Game> {
  const game = new Game({
    canvas: new MockCanvas(),
    seed: 'fortress-ui',
    registry,
    createCanvas: mockCanvasFactory(),
    devicePixelRatio: 1,
    width: 1280,
    height: 800,
  });
  await game.start();
  return game;
}

function key(game: Game, k: string, mods: Partial<{ shift: boolean; ctrl: boolean }> = {}): boolean {
  return game.handleKey(press(k, mods));
}

function cell(game: Game, col: number, row: number, button = 0): { x: number; y: number; button: number; shift: boolean; ctrl: boolean; alt: boolean; meta: boolean } {
  const c = game.cellCenter(col, row);
  return { x: c.x, y: c.y, button, shift: false, ctrl: false, alt: false, meta: false };
}

describe('T-M1-14 designate tool: drag rectangle → Designate', () => {
  it('press d, d, pick a priority, drag a 4×3 rectangle: one Designate with those tiles and that priority', async () => {
    const game = await fortressGame();
    const spy = vi.spyOn(game.host, 'submit');
    key(game, 'd');
    expect(game.ui.panel).toBe('designate');
    key(game, 'd');
    expect(game.fortress.tool.kind).toBe('dig');
    key(game, '3');
    key(game, '<'); // z 31: the soil under the surface, undiscovered, accepted blind
    game.pointerDown(cell(game, 10, 5));
    game.pointerMove(cell(game, 13, 7));
    expect(game.fortress.statusRow2()).toBe('Dig 4×3 (12 tiles), priority 3');
    // CP437 has no `×`; the cell holds its nearest glyph, `x` (GLYPH_ALIASES).
    expect(game.textRows().join('\n')).toContain('Dig 4x3 (12 tiles), priority 3');
    game.pointerUp(cell(game, 13, 7));
    expect(spy).toHaveBeenCalledTimes(1);
    const cmd = spy.mock.calls[0]?.[0] as Command;
    const map = game.host.readers.map;
    const z = FLAT_TEST_SURFACE_Z - 1;
    const want = rectTiles(map, { x: game.ui.camX + 10, y: game.ui.camY + 5, z }, { x: game.ui.camX + 13, y: game.ui.camY + 7, z });
    expect(cmd).toEqual({ type: 'Designate', tiles: want, kind: 'dig', priority: 3 });
    game.host.step(1);
    expect(map.designationAt(want[0] as number)).toBe(Designation.Dig);
    // Ctrl+Z undoes the last batch.
    key(game, 'z', { ctrl: true });
    expect(spy.mock.calls[1]?.[0]).toEqual({ type: 'UndoDesignation', tiles: want });
  });

  it('keeps only the tiles that pass the precondition or are undiscovered (D-052)', async () => {
    const game = await fortressGame();
    const spy = vi.spyOn(game.host, 'submit');
    key(game, 'd');
    key(game, 'd');
    // The surface: discovered floors cannot be dug, so nothing is submitted.
    game.pointerDown(cell(game, 2, 2));
    game.pointerUp(cell(game, 4, 4));
    expect(spy).not.toHaveBeenCalled();
    // A channel is allowed on floor.
    key(game, 'c');
    game.pointerDown(cell(game, 2, 2));
    game.pointerUp(cell(game, 2, 2));
    expect((spy.mock.calls[0]?.[0] as Command)['kind']).toBe('channel');
    expect((spy.mock.calls[0]?.[0] as Command)['tiles']).toHaveLength(1);
  });

  it('the tool filters a mixed rectangle through the precondition', () => {
    const tool = new DesignateTool();
    tool.choose('d');
    const flags = new Map<number, number>([[0, TileFlag.Discovered], [1, 0], [2, TileFlag.Discovered]]);
    const map = {
      w: 3,
      h: 1,
      inBounds: (x: number, y: number, z: number) => x >= 0 && x < 3 && y === 0 && z === 0,
      index: (x: number) => x,
      flagsAt: (i: number) => flags.get(i) ?? 0,
      designationAt: () => Designation.None,
    } as unknown as Parameters<DesignateTool['commands']>[0]['map'];
    const cmds = tool.commands({ map, precondition: (i) => i === 2 }, { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 });
    expect(cmds).toEqual([{ type: 'Designate', tiles: [1, 2], kind: 'dig', priority: 5 }]);
    tool.choose('f');
    expect(tool.commands({ map, precondition: () => false }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toEqual([
      { type: 'SetTraffic', tiles: [0, 1], mode: 'restricted' },
    ]);
    tool.choose('f');
    expect(tool.traffic).toBe('forbidden');
    expect(tool.choose('h')).toBe(false);
  });

  it('Enter at the cursor starts and ends a rectangle', async () => {
    const game = await fortressGame();
    const spy = vi.spyOn(game.host, 'submit');
    key(game, 'd');
    key(game, 'c');
    key(game, 'Enter');
    key(game, '→');
    key(game, 'Enter');
    expect(spy).toHaveBeenCalledTimes(1);
    // The cursor is the map centre, which the pan moved one tile east: a 2×1 rectangle.
    expect(((spy.mock.calls[0]?.[0] as Command)['tiles'] as number[]).length).toBe(2);
  });
});

describe('T-M1-14 mouse model', () => {
  it('right click cancels the tool; with no tool it opens the look panel', async () => {
    const game = await fortressGame();
    key(game, 'd');
    key(game, 'd');
    game.pointerDown(cell(game, 3, 3));
    game.pointerDown(cell(game, 3, 3, 2));
    expect(game.fortress.tool.active).toBe(false);
    expect(game.fortress.tool.anchor).toBeNull();
    game.pointerDown(cell(game, 3, 3, 2));
    expect(game.ui.panel).toBe('look');
    expect(game.ui.cursor).toEqual({ x: game.ui.camX + 3, y: game.ui.camY + 3 });
  });

  it('the wheel changes z (down is deeper); Shift pans vertically', async () => {
    const game = await fortressGame();
    const z = game.ui.z;
    game.wheel({ x: 20, y: 20, dx: 0, dy: 100, shift: false, ctrl: false, alt: false, meta: false });
    expect(game.ui.z).toBe(z - 1);
    game.wheel({ x: 20, y: 20, dx: 0, dy: -100, shift: false, ctrl: false, alt: false, meta: false });
    expect(game.ui.z).toBe(z);
    const camY = game.ui.camY;
    game.wheel({ x: 20, y: 20, dx: 0, dy: 100, shift: true, ctrl: false, alt: false, meta: false });
    expect(game.ui.camY).toBe(camY + 1);
  });

  it('a left click with no tool looks at the tile; middle drag pans', async () => {
    const game = await fortressGame();
    game.pointerDown(cell(game, 5, 6));
    expect(game.ui.panel).toBe('look');
    const text = game.textRows().join('\n');
    expect(text).toContain('Look');
    expect(text).toContain('Loam floor');
    const camX = game.ui.camX;
    game.pointerDown(cell(game, 20, 10, 1));
    game.pointerMove(cell(game, 18, 10, 1));
    game.pointerUp(cell(game, 18, 10, 1));
    expect(game.ui.camX).toBe(camX + 2);
  });

  it('the hover line names the tile under the mouse', async () => {
    const game = await fortressGame();
    game.pointerMove(cell(game, 5, 6));
    expect(game.fortress.statusRow2()).toMatch(/^Loam floor · \[k\] look/);
  });
});

describe('T-M1-14 keys', () => {
  it('Esc cancels the tool, then closes the panel; Tab toggles the sidebar without closing the panel', async () => {
    const game = await fortressGame();
    key(game, 'd');
    key(game, 'd');
    key(game, 'Esc');
    expect(game.fortress.tool.active).toBe(false);
    expect(game.ui.panel).toBe('designate');
    key(game, 'Tab');
    expect(game.ui.sidebar).toBe(false);
    expect(game.compositor.layout.sidebar).toBeNull();
    key(game, 'Tab');
    expect(game.compositor.layout.sidebar).not.toBeNull();
    key(game, 'Esc');
    expect(game.ui.panel).toBeNull();
    // The M0 map keys still work, and an unbound key is not consumed.
    expect(key(game, 'q')).toBe(false);
  });

  it('Space pauses and resumes; + and - step 1× → 2× → 4×', async () => {
    const game = await fortressGame();
    expect(game.host.speed()).toBe(0);
    key(game, ' ');
    expect(game.host.speed()).toBe(1);
    key(game, '+');
    key(game, '+');
    key(game, '+');
    expect(game.host.speed()).toBe(4);
    key(game, '-');
    expect(game.host.speed()).toBe(2);
    key(game, ' ');
    expect(game.host.speed()).toBe(0);
  });

  it('opens registered panels by hotkey with their title row', async () => {
    const game = await fortressGame();
    key(game, 'u');
    expect(game.ui.panel).toBe('units');
    expect(game.textRows().join('\n')).toContain('Units');
    key(game, 'a');
    expect(game.ui.panel).toBe('log');
    expect(game.textRows().join('\n')).toContain('Nothing has happened yet.');
  });
});

describe('T-M1-14 status bar', () => {
  it('row 1 for a fixed state: date, population, z, speed, help at the right edge', async () => {
    const game = await fortressGame();
    const readers = game.host.readers;
    // Since T-M3-08 the weather field (06) follows the date: glyph, word and temperature; this
    // world starts at midnight, so the clear sky shows the moon `C` (`glyphs-and-colors.md`).
    expect(statusFields(readers, strings, 32, 0)).toEqual(['Day 1 of Spring, Year 1', 'C clear 8°C', '☺ 0', 'z 32', '║']);
    const row = statusRow1(readers, strings, 32, 2, 80);
    expect(row.startsWith(' Day 1 of Spring, Year 1   C clear 8°C   ☺ 0   z 32   ►► 2×')).toBe(true);
    expect(row.endsWith('[?] help ')).toBe(true);
    expect(Array.from(row)).toHaveLength(80);
    expect(speedText(1)).toBe('► 1×');
    expect(speedText(4)).toBe('►►► 4×');
    const rows = game.textRows();
    expect(rows[rows.length - 2]).toContain('Day 1 of Spring, Year 1');
  });

  it('row 2 shows a refused command for STATUS_HINT_SECONDS', async () => {
    const game = await fortressGame();
    game.host.submit({ type: 'Designate', tiles: [-5], kind: 'dig' });
    game.host.step(1);
    expect(game.fortress.statusRow2()).toBe('Refused: out of bounds');
  });
});

describe('T-M1-14 announcements', () => {
  it('03 registers its rows with the documented severities', async () => {
    const game = await fortressGame();
    const rows = game.host.world.registrations.announcements;
    const severity = Object.fromEntries(rows.map((r) => [r.type, r.spec.severity]));
    // 03's rows; since T-M2-09 also 13's and 14's (13 and 14 § Registrations); since T-M3-02 04's;
    // since T-M3-06 06's (`WeatherChanged` to storm, snow, heatwave, cold snap; `SeasonChanged`).
    expect(severity).toEqual({
      WeatherChanged: 'note',
      SeasonChanged: 'note',
      VeinFound: 'note',
      ObsidianFormed: 'note',
      FireStarted: 'alert',
      CavernBreached: 'alert',
      DeepsilverMined: 'danger',
      ConstructionCollapsed: 'alert',
      StockpileFull: 'note',
      HearthLit: 'note',
      DoorBroken: 'alert',
      Buried: 'note',
      RoomQualityChanged: 'note',
      // T-M4-01: 07 § Registrations ("announcement `PlotNeedsSeeds` as a note").
      PlotNeedsSeeds: 'note',
      // T-M4-03: 08 § Registrations ("announcements for starving, pet death, adoption").
      AnimalStarving: 'alert',
      PetAdopted: 'note',
      MasterworkCreated: 'note',
      WorkshopBlocked: 'alert',
      FishPoolDepleted: 'note',
      MoodTierChanged: 'note',
      SulkHappened: 'alert',
      ThoughtGained: 'note',
    });
  });

  it('maps events to lines: text from the strings table, dedup with a count, danger pauses and pins', async () => {
    const game = await fortressGame();
    const log = game.fortress.log;
    game.host.setSpeed(2);
    const hematite = registry.table('materials').index('hematite');
    game.fortress.onEvents([{ type: 'VeinFound', material: hematite, tile: 5, finderId: 0 } as never]);
    expect(log.lines[0]?.severity).toBe('note');
    expect(log.lines[0]?.text).toMatch(/has found hematite\.$/);
    game.fortress.onEvents([{ type: 'VeinFound', material: hematite, tile: 5, finderId: 0 } as never]);
    expect(log.lines).toHaveLength(1);
    expect(lineText(log.lines[0]!)).toMatch(/ ×2$/);
    game.fortress.onEvents([{ type: 'CavernBreached', cavern: 1, tile: 9 } as never]);
    expect(lineText(log.lines[1]!)).toBe('! A cavern has been breached.');
    game.fortress.onEvents([{ type: 'DeepsilverMined', tile: game.host.readers.map.index(40, 40, 20), minerId: 0 } as never]);
    expect(game.host.speed()).toBe(0);
    expect(game.ui.z).toBe(20);
    expect(game.fortress.pinned?.severity).toBe('danger');
    game.render();
    expect(game.textRows().join('\n')).toContain('!! Deepsilver has been mined.');
    // Any key dismisses the pinned line; only the first DeepsilverMined is announced.
    expect(key(game, 'x')).toBe(true);
    expect(game.fortress.pinned).toBeNull();
    game.fortress.onEvents([{ type: 'DeepsilverMined', tile: 1, minerId: 0 } as never]);
    expect(log.lines).toHaveLength(3);
  });

  it('merges only within LOG_DEDUP_TICKS', () => {
    const log = new AnnouncementLog(strings, registry);
    log.append('note', 'a', 0);
    log.append('note', 'a', LOG_DEDUP_TICKS);
    log.append('note', 'a', 2 * LOG_DEDUP_TICKS + 1);
    expect(log.lines.map((l) => l.count)).toEqual([2, 1]);
  });
});

describe('T-M3-06 announcements: weather and seasons', () => {
  it('WeatherChanged announces storm, snow, heatwave and cold snap only, each with its line; SeasonChanged its season line', async () => {
    const game = await fortressGame();
    const log = new AnnouncementLog(strings, registry);
    log.register(game.host.world.registrations.announcements);
    const readers = game.host.world.readers;
    expect(log.announce({ type: 'WeatherChanged', from: 'clear', to: 'rain' } as never, readers, 1)).toBeNull();
    expect(log.announce({ type: 'WeatherChanged', from: 'rain', to: 'storm' } as never, readers, 2)?.line.text).toBe('A storm rolls in from the west.');
    expect(log.announce({ type: 'WeatherChanged', from: 'clear', to: 'cold_snap' } as never, readers, 3)?.severity).toBe('note');
    expect(log.announce({ type: 'SeasonChanged', season: 0, year: 2 } as never, readers, 4)?.line.text).toBe('Spring, Year 2. The river runs again.');
    expect(log.announce({ type: 'SeasonChanged', season: 3, year: 1 } as never, readers, 5)?.line.text).toBe('Winter, Year 1.');
  });
});

describe('T-M1-14 UiState save section', () => {
  it('round-trips the saved fields and the log tail', async () => {
    const game = await fortressGame();
    game.fortress.log.append('alert', 'Something.', 3, 7);
    game.ui.panel = 'log';
    const section = game.uiSection();
    expect(section.name).toBe('ui');
    const saved = readJsonSection(section) as SavedUiState;
    expect(saved).toMatchObject({ camX: game.ui.camX, z: game.ui.z, panel: 'log', overlays: ['designations', 'zones'] });
    expect(saved.logTail).toEqual([{ tick: 3, severity: 'alert', text: 'Something.', focus: 7 }]);
    const ui = defaultUiState(0);
    const lines = fromSaved(ui, saved);
    expect(toSaved(ui, lines)).toEqual(saved);
  });
});
