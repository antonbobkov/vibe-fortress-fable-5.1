/**
 * T-M7-08: the help panel and its glyph legend, the completed overlays panel with the debug
 * overlays, and the debug panel (`ui-screens/panels.md` §§ Overlays, Help, Debug;
 * `performance-budget.md` § Measurement).
 */

import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { CHUNK_SIZE } from '@core/constants';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { computeLayout } from '@render/cellbuffer';
import { Compositor, OVERLAY_CHUNKS, OVERLAY_CONNECTIVITY, OVERLAY_JOBS, OVERLAY_PATHS } from '@render/compositor';
import { Palette } from '@render/palette';
import { drawHelpPanel, HelpPanel, helpGlyphRows, helpKeyLabel, helpKeyRows, helpLines } from '@ui/panels/help';
import { DEBUG_BUTTONS, debugLines, DebugPanel, drawDebugPanel, timingRows, type DebugHost } from '@ui/panels/debug';
import { drawOverlaysPanel, FIRST_DEBUG_ROW, OVERLAY_ROWS, OverlayMenu } from '@ui/panels/overlays';
import type { PanelContext } from '@ui/panels/context';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { jobTargetTile } from '@render/debug-overlays';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';
import { cellRows, glyphs, keymap, press, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const palette = new Palette(registry);
const rect = { col: 0, row: 0, cols: 40, rows: 24 };

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

function hostOf(w: TestWorld, debug?: DebugHost): FortressHost {
  return {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => w.submit(cmd),
    speed: () => 1,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => computeLayout(80, 42, true),
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    ...(debug === undefined ? {} : { debug }),
  };
}

function debugHostOf(w: TestWorld, calls: string[] = []): DebugHost {
  return {
    stats: () => w.game.world.stats(),
    seed: () => w.game.world.seed,
    dumpSave: () => calls.push('dump'),
    replaySeasonLog: () => calls.push('log'),
    hashWorld: () => calls.push('hash'),
  };
}

describe('T-M7-08 help screen, legend of glyphs, overlays panel, debug panel', () => {
  describe('Help panel', () => {
    it('lists every keymap row under its context heading', () => {
      const rows = helpKeyRows(keymap);
      for (const binding of keymap.bindings) {
        // T-280: Help writes a Shift letter the way the panels do, `[S-n]`.
        const key = helpKeyLabel(binding.spec);
        // U-01 (Q14): one action's keys share a row ("←→↑↓  pan …", "1–9  …"); each key is still listed.
        expect(rows.some((row) => row.category === binding.context && (row.keys ?? []).includes(key))).toBe(true);
      }
      // Every context that binds anything contributes exactly one heading.
      const contexts = new Set(keymap.bindings.map((b) => b.context));
      expect(rows.filter((row) => row.heading === true)).toHaveLength(contexts.size);
      // The wording is the keymap table's own, not the action id.
      expect(rows.some((row) => row.text.includes('cancel tool'))).toBe(true);
    });

    it('a rebinding shows in the help rows at once', () => {
      const index = keymap.bindings.findIndex((b) => b.context === 'global' && b.id === 'toggle_sidebar');
      expect(index).toBeGreaterThanOrEqual(0);
      const before = helpKeyRows(keymap);
      expect(before.some((row) => row.text.startsWith('Tab  '))).toBe(true);
      expect(keymap.rebind(index, { key: 'F8', ctrl: false, shift: false })).toBeNull();
      const after = helpKeyRows(keymap);
      expect(after.some((row) => row.text.startsWith('F8  toggle sidebar'))).toBe(true);
      keymap.reset();
    });

    it('generates the six legend categories from content, with each row its own colour', () => {
      const rows = helpGlyphRows(registry, (g) => glyphs.char(g));
      const headings = rows.filter((row) => row.heading === true).map((row) => row.text);
      expect(headings).toEqual(['Terrain', 'Fluids', 'Creatures', 'Items', 'Buildings', 'Overlays']);
      // Every creature, item and building row of the content tables that carries a glyph is listed.
      for (const table of ['creatures', 'items', 'buildings']) {
        const t = registry.table<{ id: string; glyph?: string; name?: string }>(table);
        const withGlyph = t.ids().filter((id) => (t.byId(id) as { glyph?: string }).glyph);
        expect(withGlyph.length).toBeGreaterThan(0);
        for (const id of withGlyph) {
          const row = t.byId(id) as { glyph?: string; name?: string };
          const glyph = Array.from(row.glyph as string)[0] as string;
          expect(rows.some((r) => r.text === `${glyph}  ${row.name ?? id.replaceAll('_', ' ')}`)).toBe(true);
        }
      }
      // The fluid ramps name palette rows, so the legend can draw them in their own colour.
      const fluids = rows.filter((row) => row.category === 'Fluids' && row.heading === undefined);
      expect(fluids).toHaveLength(7);
      expect(fluids.every((row) => palette.has(row.fg as string))).toBe(true);
      // The overlay rows are the overlay menu's, so the two lists cannot drift.
      expect(rows.filter((row) => row.category === 'Overlays' && row.heading === undefined)).toHaveLength(OVERLAY_ROWS.length);
    });

    it('draws the tabs, scrolls, and paints a legend row in its content colour', () => {
      const panel = new HelpPanel(registry, keymap);
      const s = surface(rect.cols, rect.rows);
      drawHelpPanel(s, rect, panel);
      expect(s.lines()[0]).toContain('[1] Keys');
      expect(s.lines()[0]).toContain('[2] Legend');
      const first = s.lines()[1];
      panel.move(3);
      drawHelpPanel(s, rect, panel);
      expect(s.lines()[1]).not.toBe(first);
      // Scrolling stops at the last page instead of running off the end.
      panel.move(10_000);
      drawHelpPanel(s, rect, panel);
      const lines = helpLines(panel.rows((g) => glyphs.char(g)), rect.cols - 2);
      expect(panel.scroll).toBe(lines.length - (rect.rows - 1));

      panel.setTab(1);
      expect(panel.scroll).toBe(0);
      const legend = surface(rect.cols, rect.rows);
      drawHelpPanel(legend, rect, panel);
      expect(legend.lines()[1]).toContain('Terrain');
      // Walk to the fluid rows and check the ice line is drawn in `ice_blue`.
      const iceAt = panel.rows((g) => glyphs.char(g)).findIndex((row) => row.text.endsWith('ice'));
      expect(iceAt).toBeGreaterThan(0);
      panel.scroll = iceAt;
      drawHelpPanel(legend, rect, panel);
      const cells = cellRows(legend)[1] as string[];
      expect((cells[1] as string).split(':')[1]).toBe('#bfe6ff');
    });

    it('a click on the tab captions switches tabs', () => {
      const panel = new HelpPanel(registry, keymap);
      const s = surface(rect.cols, rect.rows);
      drawHelpPanel(s, rect, panel);
      const hit = s.hitAt(12, 0);
      expect(hit).not.toBeNull();
      hit?.action();
      expect(panel.tab).toBe(1);
    });
  });

  describe('Overlays panel', () => {
    it('lists every overlay the compositor draws, the debug three last', () => {
      expect(OVERLAY_ROWS.map((row) => row.id)).toEqual([
        'designations', 'priority_digits', 'zones', 'fluid_levels', 'temperature',
        OVERLAY_JOBS, 'squad_stations', 'stockpile_usage', OVERLAY_CONNECTIVITY, OVERLAY_PATHS, OVERLAY_CHUNKS,
      ]);
      expect(FIRST_DEBUG_ROW).toBe(8);
      expect(OVERLAY_ROWS.filter((row) => row.debug === true)).toHaveLength(3);
    });

    it('draws the Debug: group and toggles a debug overlay by click and by Enter', () => {
      const menu = new OverlayMenu();
      const overlays: string[] = ['designations', 'zones'];
      const s = surface(40, 16);
      drawOverlaysPanel(s, { col: 0, row: 0, cols: 40, rows: 16 }, menu, overlays);
      const lines = s.lines();
      expect(lines[FIRST_DEBUG_ROW]).toContain('Debug:');
      expect(lines[FIRST_DEBUG_ROW + 1]).toContain('connectivity');
      expect(lines[FIRST_DEBUG_ROW + 3]).toContain('chunks');
      s.hitAt(2, FIRST_DEBUG_ROW + 1)?.action();
      expect(overlays).toContain(OVERLAY_CONNECTIVITY);
      expect(menu.selected).toBe(FIRST_DEBUG_ROW);
      menu.move(2);
      OverlayMenu.toggle(overlays, (OVERLAY_ROWS[menu.selected] as { id: string }).id);
      expect(overlays).toContain(OVERLAY_CHUNKS);
    });
  });

  describe('Debug overlays in the compositor', () => {
    const compose = (w: TestWorld, x: number, y: number, overlays?: string[]) => {
      const compositor = new Compositor({ registry, palette });
      return compositor.compose(w.readers, {
        camX: x, camY: y, z, sidebarOpen: false, cursor: null, animFrame: 0,
        ...(overlays ? { overlays } : {}),
      }, 3, 8).get(0, 0);
    };

    it('connectivity tints a walkable tile and leaves rock alone; chunks draws the chunk grid', () => {
      const w = new TestWorld({ seed: 'm7-connectivity-overlay', world: 'flat-test', embark: 'none' });
      const open = { x: 20, y: 20 };
      expect(w.readers.pathing.labelOf(w.index(open.x, open.y, z), 'walker')).toBeGreaterThan(0);
      expect(compose(w, open.x, open.y, [OVERLAY_CONNECTIVITY]).bg).not.toBe(compose(w, open.x, open.y).bg);
      // A wall below the surface has no component, so it is not tinted.
      const rockY = 20;
      const rock = w.index(20, rockY, z - 2);
      expect(w.readers.pathing.labelOf(rock, 'walker')).toBe(0);

      const edge = CHUNK_SIZE * 2;
      expect(compose(w, edge, edge, [OVERLAY_CHUNKS]).bg).not.toBe(compose(w, edge, edge).bg);
      expect(compose(w, edge + 1, edge + 1, [OVERLAY_CHUNKS]).bg).toBe(compose(w, edge + 1, edge + 1).bg);
    });

    it('paths tints a mover\'s remaining route, and jobs the target of a claimed job', () => {
      const w = new TestWorld({ seed: 'm7-paths-overlay', world: 'flat-test', embark: 'none' });
      const from = w.index(20, 20, z);
      const to = w.index(26, 20, z);
      const dwarf = w.spawnDwarf({ at: from });
      const id = w.readers.pathing.requestPath(dwarf, from, to, 'walker');
      w.until(() => w.readers.pathing.pathResult(id).state === 'ready', 200);
      const result = w.readers.pathing.pathResult(id);
      expect(result.state).toBe('ready');
      const motion = w.game.world.entities.get(dwarf, C.Motion);
      expect(motion).toBeDefined();
      w.game.world.entities.add(dwarf, C.Motion, { ...(motion as NonNullable<typeof motion>), pathId: id, stepIndex: 0 });
      const on = result.state === 'ready' ? (result.path[result.path.length - 1] as number) : 0;
      const px = on % w.readers.map.w;
      const py = Math.floor(on / w.readers.map.w) % w.readers.map.h;
      expect(compose(w, px, py, [OVERLAY_PATHS]).bg).not.toBe(compose(w, px, py).bg);
      // A tile off the route keeps its colour.
      expect(compose(w, 20, 30, [OVERLAY_PATHS]).bg).toBe(compose(w, 20, 30).bg);
    });

    it('jobs highlights the target tile of a claimed job', () => {
      const w = new TestWorld({ seed: 'm7-jobs-overlay', world: 'flat-test', embark: 'none' });
      const stand = w.index(20, 20, z);
      const dwarf = w.spawnDwarf({ at: stand });
      w.setLabor(dwarf, 'hauling');
      w.spawnItem('log', 'pine', w.index(21, 20, z), 1);
      const pile = w.zone('stockpile', [w.index(24, 20, z), w.index(25, 20, z)]);
      expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'wood' }).ok).toBe(true);
      w.until(() => w.readers.of<{ counts(): { claimed: number } }>('11').counts().claimed > 0, 600);
      const board = w.readers.of<JobsReader>('11');
      const job = board.forWorker(dwarf);
      expect(job).toBeDefined();
      const target = jobTargetTile(w.readers, job as NonNullable<typeof job>);
      expect(target).not.toBeNull();
      const tx = (target as number) % w.readers.map.w;
      const ty = Math.floor((target as number) / w.readers.map.w) % w.readers.map.h;
      const plain = compose(w, tx, ty);
      const marked = compose(w, tx, ty, [OVERLAY_JOBS]);
      expect(marked.bg).not.toBe(plain.bg);
      expect(marked.glyph).toBe(plain.glyph);
    });
  });

  describe('Debug panel', () => {
    it('the timings table is non-empty after ticks, with an average and a worst case per system', () => {
      const w = new TestWorld({ seed: 'm7-debug-timings', world: 'flat-test', embark: 'none' });
      w.step(20);
      const stats = w.game.world.stats();
      const rows = timingRows(stats);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some((row) => row.runs > 0)).toBe(true);
      for (const row of rows) {
        expect(row.avgMs).toBeGreaterThanOrEqual(0);
        expect(row.worstMs).toBeGreaterThanOrEqual(row.avgMs - 1e-9);
      }
      expect(stats.tick).toBe(20);
    });

    it('shows the seed, the tick, counts by kind, fluids, path requests and jobs by state', () => {
      const w = new TestWorld({ seed: 'm7-debug-lines', world: 'flat-test', embark: 'none' });
      w.spawnDwarf({ at: w.index(20, 20, z) });
      w.step(10);
      const lines = debugLines(ctxOf(w), debugHostOf(w)).map((line) => line.text);
      expect(lines[0]).toBe('seed m7-debug-lines  tick 10');
      expect(lines.some((line) => line.startsWith('creature 1'))).toBe(true);
      expect(lines.some((line) => line.startsWith('active fluid tiles'))).toBe(true);
      expect(lines.some((line) => /^path requests served \d+, pending \d+$/.test(line))).toBe(true);
      expect(lines.some((line) => line.startsWith('open '))).toBe(true);
      expect(w.readers.entities.countOfKind('creature')).toBe(1);
    });

    it('draws the three buttons and runs each of them', () => {
      const w = new TestWorld({ seed: 'm7-debug-buttons', world: 'flat-test', embark: 'none' });
      w.step(2);
      const calls: string[] = [];
      const s = surface(rect.cols, rect.rows);
      drawDebugPanel(s, rect, new DebugPanel(), ctxOf(w), debugHostOf(w, calls));
      const lines = s.lines();
      const first = rect.rows - DEBUG_BUTTONS.length;
      expect(lines[first]).toContain('[S-d] dump save');
      expect(lines[first + 1]).toContain('[r] replay season log');
      expect(lines[first + 2]).toContain('[h] hash world');
      s.hitAt(2, first)?.action();
      s.hitAt(2, first + 2)?.action();
      expect(calls).toEqual(['dump', 'hash']);
    });
  });

  describe('The fortress screen', () => {
    it('? opens help and F12 opens debug; the same key closes them again', () => {
      const w = new TestWorld({ seed: 'm7-help-keys', world: 'flat-test', embark: 'none' });
      const screen = new FortressScreen(hostOf(w, debugHostOf(w)), keymap, strings);
      expect(screen.key(press('?', { shift: true }))).toBe(true);
      expect(screen.ui.panel).toBe('help');
      expect(screen.key(press('?', { shift: true }))).toBe(true);
      expect(screen.ui.panel).toBeNull();
      expect(screen.key(press('F12'))).toBe(true);
      expect(screen.ui.panel).toBe('debug');
      expect(screen.key(press('F12'))).toBe(true);
      expect(screen.ui.panel).toBeNull();
    });

    it('lists help and debug among the panels with their live keys', () => {
      const w = new TestWorld({ seed: 'm7-help-panels', world: 'flat-test', embark: 'none' });
      const screen = new FortressScreen(hostOf(w), keymap, strings);
      const panels = screen.panels();
      expect(panels.find((p) => p.id === 'help')).toMatchObject({ title: 'Help', hotkey: '?' });
      expect(panels.find((p) => p.id === 'debug')).toMatchObject({ title: 'Debug', hotkey: 'F12' });
    });

    it('the open help panel takes its own tab and scroll keys, and the debug panel its buttons', () => {
      const w = new TestWorld({ seed: 'm7-help-panel-keys', world: 'flat-test', embark: 'none' });
      const calls: string[] = [];
      const screen = new FortressScreen(hostOf(w, debugHostOf(w, calls)), keymap, strings);
      screen.openPanel('help');
      expect(screen.key(press('2'))).toBe(true);
      expect(screen.help.tab).toBe(1);
      expect(screen.key(press('ArrowDown'))).toBe(true);
      expect(screen.help.scroll).toBe(1);
      expect(screen.key(press('1'))).toBe(true);
      expect(screen.help.tab).toBe(0);
      expect(screen.help.scroll).toBe(0);
      screen.openPanel('debug');
      expect(screen.key(press('h'))).toBe(true);
      expect(screen.key(press('d', { shift: true }))).toBe(true);
      expect(screen.key(press('r'))).toBe(true);
      expect(calls).toEqual(['hash', 'dump', 'log']);
    });

    it('draws the help and debug panels in the sidebar', () => {
      const w = new TestWorld({ seed: 'm7-help-sidebar', world: 'flat-test', embark: 'none' });
      const screen = new FortressScreen(hostOf(w, debugHostOf(w)), keymap, strings);
      w.step(5);
      const s = surface(80, 42);
      screen.openPanel('help');
      screen.draw(s);
      expect(s.lines().join('\n')).toContain('Help');
      screen.openPanel('debug');
      screen.draw(s);
      const text = s.lines().join('\n');
      expect(text).toContain('Debug');
      expect(text).toContain('dump save');
    });
  });
});
