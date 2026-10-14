/**
 * T-270: every caption on the fortress screen is a button: the hotkey strip, the fields of status
 * row 1, `[x]` on a panel's title row, the menu, the speed glyph, the wheel over a list.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { Speed } from '@ui/status';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
void registry;

function setup(seed: string, dwarves = 3) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const ids: EntityId[] = [];
  for (let k = 0; k < dwarves; k += 1) ids.push(w.spawnDwarf({ at: w.index(10 + (k % 40), 10 + Math.floor(k / 40), z), name: `Dwarf${String(k).padStart(2, '0')} Stone` }));
  const layout = computeLayout(80, 42, true);
  const state = { speed: 1 as Speed, menu: 0, zChanges: [] as number[] };
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c),
    speed: () => state.speed, setSpeed: (s) => { state.speed = s; },
    pan: () => {}, changeZ: (d) => { state.zChanges.push(d); }, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {}, gameMenu: () => { state.menu += 1; },
  };
  const screen = new FortressScreen(host, keymap, strings);
  const draw = (): string[] => { const s = surface(80, 42); screen.draw(s); return s.lines(); };
  const click = (text: string, button = 0, within = ''): void => {
    const lines = draw();
    const row = lines.findIndex((l) => l.includes(text) && l.includes(within));
    if (row < 0) throw new Error(`not on screen: ${text}`);
    screen.pointerDown({ col: (lines[row] as string).indexOf(text), row, button, shift: false, ctrl: false, alt: false, meta: false });
  };
  return { w, screen, host, state, ids, draw, click, layout };
}

describe('T-270 the hotkey strip and status row 1 are buttons', () => {
  it('opens a panel from each strip entry', () => {
    const f = setup('t270-strip');
    for (const [entry, panel] of [['[u] units', 'units'], ['[l] labors', 'labors'], ['[o] orders', 'orders'], ['[m] military', 'military'], ['[b] build', 'build'], ['[z] zones', 'zones'], ['[d] dig', 'designate']] as const) {
      f.screen.openPanel(null);
      f.click(entry);
      expect(f.screen.ui.panel, entry).toBe(panel);
    }
  });

  it('opens Units, Mood, Calendar and the help from row 1, and the menu from [Esc] menu', () => {
    const f = setup('t270-row1');
    f.click('☺ 3');
    expect(f.screen.ui.panel).toBe('units');
    f.click('♥');
    expect(f.screen.ui.panel).toBe('mood');
    f.click('Day 1 of');
    expect(f.screen.ui.panel).toBe('calendar');
    f.click('[?] help');
    expect(f.screen.ui.panel).toBe('help');
    f.click('[Esc] menu');
    expect(f.state.menu).toBe(1);
  });

  it('a click on the speed glyph pauses and resumes; a right click steps 1x, 2x, 4x', () => {
    const f = setup('t270-speed');
    f.click('► 1x', 0, 'Day 1 of');
    expect(f.state.speed).toBe(0);
    f.click('║', 0, 'Day 1 of');
    expect(f.state.speed).toBe(1);
    f.click('► 1x', 2, 'Day 1 of');
    expect(f.state.speed).toBe(2);
    f.click('►► 2x', 2, 'Day 1 of');
    expect(f.state.speed).toBe(4);
    f.click('►►► 4x', 2, 'Day 1 of');
    expect(f.state.speed).toBe(1);
  });

  it('the [x] on a panel title row closes the panel', () => {
    const f = setup('t270-close');
    f.screen.openPanel('units');
    expect(f.draw().some((l) => l.includes('Units') && l.includes('[x]'))).toBe(true);
    expect(f.draw().some((l) => l.includes('[u]') && l.includes('Units'))).toBe(false);
    f.click('[x]');
    expect(f.screen.ui.panel).toBeNull();
  });

  it('a pinned danger line is dismissed by a click on it', () => {
    const f = setup('t270-pinned');
    f.screen.pinned = { tick: 0, severity: 'danger', text: 'A raid is coming', count: 1 };
    const lines = f.draw();
    const row = lines.findIndex((l) => l.includes('A raid is coming'));
    expect(row).toBeGreaterThan(0);
    f.screen.pointerDown({ col: 10, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(f.screen.pinned).toBeNull();
  });
});

describe('T-270 designate buttons, scrollbars and the wheel', () => {
  it('Priority [-] n [+] steps the priority, [Ctrl+Z] undoes and [Del] says to select first', () => {
    const f = setup('t270-designate');
    f.screen.openPanel('designate');
    const before = f.screen.tool.priority;
    f.click('[+]');
    expect(f.screen.tool.priority).toBe(before + 1);
    f.click('[-]');
    f.click('[-]');
    expect(f.screen.tool.priority).toBe(before - 1);
    f.click('[Ctrl+Z] undo last');
    expect(f.screen.currentNotice).toBe('Nothing to undo.');
    f.click('[Del] clear');
    expect(f.screen.currentNotice).toBe('Select a rectangle on the map first.');
  });

  it('the wheel over the sidebar moves the list three rows a notch and leaves the level alone', () => {
    const f = setup('t270-wheel', 30);
    f.screen.openPanel('units');
    f.screen.wheel({ col: 70, row: 8, dy: 1, shift: false, ctrl: false, alt: false, meta: false });
    expect(f.screen.units.list.selected).toBe(3);
    f.screen.wheel({ col: 70, row: 8, dy: -1, shift: false, ctrl: false, alt: false, meta: false });
    expect(f.screen.units.list.selected).toBe(0);
    expect(f.state.zChanges).toEqual([]);
    // Over the map it changes the level as before.
    f.screen.wheel({ col: 10, row: 8, dy: 1, shift: false, ctrl: false, alt: false, meta: false });
    expect(f.state.zChanges).toEqual([-1]);
  });

  it('a click on a scrollbar track jumps the list there', () => {
    const f = setup('t270-scrollbar', 60);
    f.screen.openPanel('units');
    const lines = f.draw();
    // The scrollbar is the column of `│` and `█` inside the list; click near the bottom of the track.
    const col = (lines[8] as string).lastIndexOf('█') >= 0 ? (lines[8] as string).lastIndexOf('█') : (lines[8] as string).lastIndexOf('│');
    const track = lines.map((l, r) => (['│', '█'].includes(Array.from(l)[col] ?? '') && r > 3 ? r : -1)).filter((r) => r >= 0);
    f.screen.pointerDown({ col, row: track[track.length - 1] as number, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(f.screen.units.list.scroll).toBeGreaterThan(0);
  });
});
