/**
 * `ui_keymap_parity` of `archive/build-plan/M7-outside-world.md` T-M7-09: "a table-driven check over the keymap
 * and mouse tables of `ui-keymap-and-screens.md`: every UI action has a key and a mouse path", over
 * 24 § Input model ("Keyboard and mouse produce the same actions; there is no action reachable only
 * one way").
 *
 * The three tables are parsed out of the document, so a row added there fails this scenario until it
 * is implemented (D-200):
 *
 * 1. § Keymap — every key cell of the context tables is a row of `keymap.json` with the same
 *    action wording, and back; every row resolves in its context to the `ACTION_IDS` id of its
 *    wording.
 * 2. § Fortress panels — every row's panel is in the fortress screen's panel list under that
 *    hotkey, the hotkey opens it, and the drawn sidebar shows its title.
 * 3. § Mouse — every gesture row is exercised on a live fortress screen and must have an effect.
 */

import { expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeLayout } from '@render/cellbuffer';
import { Palette } from '@render/palette';
import { GlyphMap, Surface, themeOf } from '@ui/surface';
import { CellBuffer } from '@render/cellbuffer';
import { ACTION_IDS, Keymap, parseKeySpec, type KeymapRow } from '@ui/keymap';
import { Strings } from '@ui/strings';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import type { KeyPress } from '@platform/input';
import type { Command } from '@core/commands';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

const docPath = fileURLToPath(new URL('../../docs/03-content/ui-keymap-and-screens.md', import.meta.url));

/** The `### <heading>` names of § Keymap, in the contexts `ui/keymap.ts` gives them. */
const CONTEXT_OF: Readonly<Record<string, string>> = {
  Global: 'global',
  Map: 'map',
  Panels: 'panel',
  'Map selection': 'selection',
  'Designate panel': 'designate_panel',
  'Build panel': 'build_panel',
  'Zones panel': 'zones_panel',
  'Zone inspector': 'zone_inspector',
  'Units panel': 'units_panel',
  'Labors panel': 'labors_panel',
  'Jobs panel': 'jobs_panel',
  'Orders panel': 'orders_panel',
  'Workshop panel': 'workshop_panel',
  'Building panel': 'building_panel',
  'Stocks panel': 'stocks_panel',
  'Depot panel': 'depot_panel',
  'Military panel': 'military_panel',
  'Animals panel': 'animals_panel',
  'Civilizations panel': 'civilizations_panel',
  'Population panel': 'population_panel',
  'Mood panel': 'mood_panel',
  'Log panel': 'log_panel',
  'Look panel': 'look_panel',
  'Help panel': 'help_panel',
  'Debug panel': 'debug_panel',
  // U-06: the labor manager and the units and military panels' own keys.
  'Labor manager': 'labor_manager',
  'Profession templates': 'labor_templates',
  'Trade session': 'trade_session',
  'Game menu': 'game_menu',
  Confirmation: 'confirm',
  'Main menu': 'main_menu',
  'World generation': 'world_gen',
  'World map': 'world_map',
  Embark: 'embark',
  Load: 'load',
};

interface DocRow { readonly context: string; readonly keys: string[]; readonly action: string }

/** The cells of a markdown table row, without the outer pipes. */
function cells(line: string): string[] {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/** The section between a heading and the next heading of the same or a higher level. */
function section(text: string, heading: string): string {
  const level = heading.startsWith('### ') ? 3 : 2;
  const at = text.indexOf(`\n${heading}\n`);
  if (at < 0) throw new Error(`ui_keymap_parity: no section "${heading}"`);
  const rest = text.slice(at + heading.length + 2);
  const next = rest.search(level === 3 ? /\n#{1,3} / : /\n#{1,2} /);
  return next < 0 ? rest : rest.slice(0, next);
}

/**
 * The keys a key cell binds: every backticked token, which is how the exporter expanded the cells
 * that name several keys (`+` `=`; `1`–`9` as its two ends; `Ctrl+↑` / `Ctrl+↓`). A cell with no
 * backticks is the word itself (`arrows`).
 */
export function keysOf(cell: string): string[] {
  const ticked = Array.from(cell.matchAll(/`([^`]+)`/g)).map((m) => m[1] as string);
  return ticked.length > 0 ? ticked : [cell];
}

function keymapRows(text: string): DocRow[] {
  const keymap = section(text, '## Keymap (defaults)');
  const out: DocRow[] = [];
  let context: string | null = null;
  for (const line of keymap.split('\n')) {
    const heading = /^### (.+)$/.exec(line.trim());
    if (heading !== null) {
      context = CONTEXT_OF[heading[1] as string] ?? null;
      expect(context, `§ Keymap has an unknown context "${heading[1] as string}"`).not.toBeNull();
      continue;
    }
    if (context === null || !line.trim().startsWith('|')) continue;
    const row = cells(line);
    if (row.length < 2 || row[0] === 'Key' || (row[0] as string).startsWith('-')) continue;
    out.push({ context, keys: keysOf(row[0] as string), action: (row[1] as string).replace(/`/g, '') });
  }
  return out;
}

function panelRows(text: string): { key: string; panel: string }[] {
  const out: { key: string; panel: string }[] = [];
  for (const line of section(text, '## Fortress panels').split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const row = cells(line);
    if (row.length < 2 || row[0] === 'Hotkey' || (row[0] as string).startsWith('-')) continue;
    out.push({ key: (row[0] as string).replace(/`/g, ''), panel: (row[1] as string).toLowerCase() });
  }
  return out;
}

function mouseGestures(text: string): string[] {
  const out: string[] = [];
  for (const line of section(text, '## Mouse').split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const row = cells(line);
    if (row.length < 2 || row[0] === 'Gesture' || (row[0] as string).startsWith('-')) continue;
    out.push((row[0] as string).replace(/`/g, ''));
  }
  return out;
}

function press(key: string, mods: Partial<Omit<KeyPress, 'key'>> = {}): KeyPress {
  return { key, repeat: false, shift: false, ctrl: false, alt: false, meta: false, ...mods };
}

const Z = 32;

const scenario: Scenario = {
  id: 'ui_keymap_parity',
  milestone: 7,
  seed: 'ui-keymap-parity',
  world: 'flat-test',
  embark: 'default',
  run: (w: TestWorld) => {
    const text = readFileSync(docPath, 'utf8');
    const registry = w.game.registry;
    const exported = registry.derived<readonly KeymapRow[]>('keymap');
    const keymap = Keymap.fromRows(exported);
    const strings = new Strings(registry);

    // ---------- 1. § Keymap ----------
    const doc = keymapRows(text);
    expect(doc.length).toBeGreaterThan(40);
    const exportedKeys = new Set(exported.map((row) => `${row.context}|${row.key}|${row.action}`));
    const docKeys = new Set<string>();
    for (const row of doc) {
      for (const key of row.keys) {
        const id = `${row.context}|${key}|${row.action}`;
        docKeys.add(id);
        expect(exportedKeys.has(id), `keymap.json is missing ${id}`).toBe(true);
      }
    }
    for (const id of exportedKeys) expect(docKeys.has(id), `keymap.json has ${id}, the document does not`).toBe(true);

    // Every row resolves in its context to the action id of its wording.
    for (const row of doc) {
      const want = ACTION_IDS[row.action];
      expect(want, `no action id for "${row.action}"`).toBeDefined();
      for (const key of row.keys) {
        for (const spec of parseKeySpec(key)) {
          // An accelerator always takes its letter with Shift; `[letter]` any letter.
          const probe = spec.key === 'any-letter' ? 'q' : spec.accel === true ? spec.key.toUpperCase() : spec.key;
          const action = keymap.resolve(row.context as 'global', press(probe, { ctrl: spec.ctrl, shift: spec.shift || spec.accel === true }));
          expect(action, `${row.context} ${key} resolves to nothing`).not.toBeNull();
          expect(action?.id, `${row.context} ${key}`).toBe(want);
        }
      }
    }

    // ---------- the live fortress screen ----------
    const submitted: Command[] = [];
    let speed = 1;
    let centered: { x: number; y: number; z: number } | null = null;
    let panned: { dx: number; dy: number } | null = null;
    let zoomed = 0;
    let dz = 0;
    let homed = false;
    let menu = false;
    const ui = defaultUiState(Z);
    const host: FortressHost = {
      readers: w.readers,
      registry,
      ui,
      submit: (cmd) => { submitted.push(cmd); w.submit(cmd); },
      speed: () => speed as 0 | 1 | 2 | 4,
      setSpeed: (s) => { speed = s; },
      pan: (dx, dy) => { panned = { dx, dy }; },
      changeZ: (d) => { dz += d; },
      centerOn: (x, y, z) => { centered = { x, y, z }; },
      home: () => { homed = true; },
      zoom: (delta) => { zoomed += delta; },
      layout: () => computeLayout(80, 42, ui.sidebar && ui.panel !== null),
      precondition: () => true,
      registeredPanels: () => w.game.world.registrations.panels,
      announcements: () => w.game.world.registrations.announcements,
      now: () => 1000,
      gameMenu: () => { menu = true; },
      confirm: (_id, _params, answer) => answer(true),
    };
    const screen = new FortressScreen(host, keymap, strings);
    const palette = new Palette(registry);
    const theme = themeOf(palette);
    const glyphs = GlyphMap.of(registry);
    const draw = (): Surface => {
      const cells = new CellBuffer(80, 42);
      cells.fill(0, theme.black, theme.black);
      const surface = new Surface(cells, glyphs, theme, palette);
      screen.draw(surface);
      return surface;
    };

    // ---------- 2. § Fortress panels ----------
    for (const row of panelRows(text)) {
      const panel = screen.panels().find((p) => p.id === row.panel);
      expect(panel, `no panel "${row.panel}"`).toBeDefined();
      expect(panel?.hotkey, `panel ${row.panel}`).toBe(row.key);
      screen.openPanel(null);
      expect(screen.key(press(row.key, { shift: row.key === '?' })), `${row.key} is consumed`).toBe(true);
      expect(ui.panel, `${row.key} opens ${row.panel}`).toBe(row.panel);
      // A mouse path to the same panel: the sidebar draws its title row (24 § Panels).
      expect(draw().lines().join('\n')).toContain(panel?.title as string);
    }
    screen.openPanel(null);

    // ---------- 3. § Mouse ----------
    const map = host.layout().map;
    const cell = (x: number, y: number) => ({ col: map.col + x - ui.camX, row: map.row + y - ui.camY });
    const pointer = (x: number, y: number, over: Partial<{ button: number; clicks: number; shift: boolean; ctrl: boolean }> = {}) =>
      ({ ...cell(x, y), button: 0, clicks: 1, shift: false, ctrl: false, alt: false, meta: false, ...over });
    const checks: Record<string, () => void> = {
      'Left click': () => {
        screen.openPanel(null);
        screen.pointerDown(pointer(20, 20));
        expect(ui.panel).toBe('look');
        expect(ui.cursor).toEqual({ x: 20, y: 20 });
        // With a tool (T-441 two-click box): the first click is a corner, the second designates.
        screen.openPanel('designate');
        screen.tool.choose('d');
        submitted.length = 0;
        screen.pointerDown(pointer(21, 21));
        screen.pointerUp(pointer(21, 21));
        expect(submitted, 'the first click only sets the corner').toEqual([]);
        expect(screen.tool.anchor).toEqual({ x: 21, y: 21, z: Z });
        screen.pointerDown(pointer(21, 21));
        screen.pointerUp(pointer(21, 21));
        const one = submitted.find((c) => c.type === 'Designate');
        expect(one, 'a left click with the dig tool designates').toBeDefined();
        expect((one as Command)['tiles']).toEqual([w.index(21, 21, Z)]);
        screen.tool.cancel();
      },
      'Left drag': () => {
        // With no tool: a rectangle selection.
        screen.openPanel(null);
        screen.selection = null;
        screen.pointerDown(pointer(20, 20));
        screen.pointerMove(pointer(23, 22));
        screen.pointerUp(pointer(23, 22));
        expect(screen.selectionTiles()).toHaveLength(12);
        expect(screen.statusRow2()).toContain('Selection');
        expect(screen.key(press('Esc'))).toBe(true);
        expect(screen.selection).toBeNull();
        // With a tool: a designation rectangle.
        screen.openPanel('designate');
        screen.tool.choose('d');
        submitted.length = 0;
        screen.pointerDown(pointer(30, 30));
        screen.pointerMove(pointer(32, 31));
        expect(screen.tool.end).toEqual({ x: 32, y: 31, z: Z });
        screen.pointerUp(pointer(32, 31));
        const rect = submitted.find((c) => c.type === 'Designate');
        expect(rect, 'a left drag with the dig tool designates the rectangle').toBeDefined();
        expect((rect as Command)['tiles']).toHaveLength(6);
        screen.tool.cancel();
        screen.openPanel(null);
      },
      'Right click': () => {
        screen.openPanel('designate');
        screen.tool.choose('d');
        screen.pointerDown(pointer(20, 20, { button: 2 }));
        expect(screen.tool.active).toBe(false);
        screen.openPanel(null);
        screen.pointerDown(pointer(24, 24, { button: 2 }));
        expect(ui.panel).toBe('look');
      },
      Wheel: () => {
        const before = dz;
        screen.wheel({ ...cell(20, 20), dy: 1, shift: false, ctrl: false, alt: false, meta: false });
        expect(dz).toBe(before - 1);
      },
      'Ctrl + wheel': () => {
        const before = zoomed;
        screen.wheel({ ...cell(20, 20), dy: -1, shift: false, ctrl: true, alt: false, meta: false });
        expect(zoomed).toBe(before + 1);
      },
      'Shift + wheel': () => {
        panned = null;
        screen.wheel({ ...cell(20, 20), dy: 1, shift: true, ctrl: false, alt: false, meta: false });
        expect(panned).toEqual({ dx: 0, dy: 1 });
      },
      'Middle drag': () => {
        panned = null;
        screen.pointerDown(pointer(20, 20, { button: 1 }));
        screen.pointerMove(pointer(22, 20, { button: 1 }));
        screen.pointerUp(pointer(22, 20, { button: 1 }));
        expect(panned).toEqual({ dx: -2, dy: 0 });
      },
      Hover: () => {
        screen.openPanel(null);
        screen.selection = null;
        screen.pointerMove(pointer(26, 26));
        expect(screen.statusRow2().length).toBeGreaterThan(0);
        // With a tool: the rectangle size while dragging.
        screen.openPanel('designate');
        screen.tool.choose('d');
        screen.tool.anchor = { x: 26, y: 26, z: Z };
        expect(screen.statusRow2()).toContain('1×1');
        screen.tool.cancel();
        screen.openPanel(null);
      },
      'Click on a panel row': () => {
        screen.openPanel('units');
        const surface = draw();
        const bar = host.layout().sidebar;
        expect(bar, 'the sidebar has a rectangle').not.toBeNull();
        const hit = surface.hits.find((h) => bar !== null && h.rect.col >= bar.col && h.rect.row > bar.row);
        expect(hit, 'the units panel draws clickable rows').toBeDefined();
        hit?.action();
      },
      'Double-click a unit or job row': () => {
        screen.openPanel('units');
        const surface = draw();
        const bar = host.layout().sidebar;
        const row = surface.hits.find((h) => bar !== null && h.rect.col >= bar.col && h.rect.row > bar.row);
        expect(row, 'a unit row to double-click').toBeDefined();
        centered = null;
        const at = (row as NonNullable<typeof row>).rect;
        screen.pointerDown({ col: at.col, row: at.row, button: 0, clicks: 2, shift: false, ctrl: false, alt: false, meta: false });
        expect(centered, 'a double-clicked unit row centres the map').not.toBeNull();
        screen.openPanel(null);
      },
    };
    const gestures = mouseGestures(text);
    expect(gestures).toEqual(Object.keys(checks));
    for (const gesture of gestures) (checks[gesture] as () => void)();

    // The Esc chain of 24 § Game menu: tool → panel → menu.
    screen.openPanel('designate');
    screen.tool.choose('d');
    expect(screen.key(press('Esc'))).toBe(true);
    expect(screen.tool.active).toBe(false);
    expect(ui.panel).toBe('designate');
    expect(screen.key(press('Esc'))).toBe(true);
    expect(ui.panel).toBeNull();
    expect(menu).toBe(false);
    expect(screen.key(press('Esc'))).toBe(true);
    expect(menu).toBe(true);
    expect(homed).toBe(false);
    expect(speed).toBe(1);
  },
};

export default scenario;
