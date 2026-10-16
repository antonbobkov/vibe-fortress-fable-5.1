/** T-310: a scrollbar thumb can be dragged; the list follows the pointer's row until the button is released. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const button = { button: 0, shift: false, ctrl: false, alt: false, meta: false } as const;

function setup() {
  const w = new TestWorld({ seed: 't310', world: 'flat-test', embark: 'none' });
  for (let k = 0; k < 60; k += 1) w.spawnDwarf({ at: w.index(10 + (k % 40), 10 + Math.floor(k / 40), z), name: `Dwarf${String(k).padStart(2, '0')} Stone` });
  const layout = computeLayout(80, 42, true);
  const panned: number[] = [];
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c), speed: () => 1, setSpeed: () => {},
    pan: (dx) => { panned.push(dx); }, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  screen.openPanel('units');
  const draw = (): string[] => { const s = surface(80, 42); screen.draw(s); return s.lines(); };
  const track = (): { col: number; rows: number[] } => {
    const lines = draw();
    const col = 79 - 1;
    const rows = lines.map((l, r) => (['│', '█'].includes(Array.from(l)[col] ?? '') && r > 2 && r < 38 ? r : -1)).filter((r) => r >= 0);
    return { col, rows };
  };
  return { screen, draw, track, panned };
}

describe('T-310 dragging a scrollbar thumb', () => {
  it('follows the pointer down and up while the button is held, and stops at the release', () => {
    const f = setup();
    const { col, rows } = f.track();
    expect(rows.length).toBeGreaterThan(10);
    const first = rows[0] as number;
    const last = rows[rows.length - 1] as number;
    expect(f.screen.units.list.scroll).toBe(0);
    f.screen.pointerDown({ col, row: first, ...button });
    f.screen.pointerMove({ col, row: Math.round((first + last) / 2), ...button });
    const middle = f.screen.units.list.scroll;
    expect(middle).toBeGreaterThan(0);
    f.screen.pointerMove({ col: col - 10, row: last, ...button });
    const bottom = f.screen.units.list.scroll;
    expect(bottom).toBeGreaterThan(middle);
    f.screen.pointerMove({ col, row: first, ...button });
    expect(f.screen.units.list.scroll).toBe(0);
    f.screen.pointerMove({ col, row: last, ...button });
    expect(f.screen.units.list.scroll).toBe(bottom);
    f.screen.pointerUp({ col, row: last, ...button });
    f.screen.pointerMove({ col, row: first, ...button });
    expect(f.screen.units.list.scroll).toBe(bottom);
  });

  it('keeps the selection inside the window and leaves the map alone', () => {
    const f = setup();
    const { col, rows } = f.track();
    f.screen.pointerDown({ col, row: rows[0] as number, ...button });
    f.screen.pointerMove({ col, row: rows[rows.length - 1] as number, ...button });
    const list = f.screen.units.list;
    const visible = rows.length - 1;
    expect(list.selected).toBeGreaterThanOrEqual(list.scroll);
    expect(list.selected).toBeLessThan(list.scroll + visible + 2);
    expect(f.panned).toEqual([]);
    expect(f.screen.selection).toBeNull();
  });
});
