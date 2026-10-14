/**
 * T-274: a zone drag says what it made and what it left out, the new zone is selected, zone
 * tints are visible on black and stronger when selected, and the zone list's labels fit.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { computeLayout } from '@render/cellbuffer';
import { Compositor } from '@render/compositor';
import { blendWithFloor, Palette, relativeLuminance, rgb } from '@render/palette';
import { ZONE_TINT_MIN_LUMA } from '@render/constants';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const layout = computeLayout(80, 42, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c), speed: () => 1, setSpeed: () => {},
    pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  /** Drag a zone rectangle, let the simulation make it and hand its events to the screen. */
  const drag = (key: string, x0: number, y0: number, x1: number, y1: number): void => {
    screen.openPanel('zones');
    screen.zones.choose(key);
    const before = w.events('ZoneChanged').length;
    screen.commitZone({ x: x0, y: y0, z }, { x: x1, y: y1, z });
    w.step(1);
    screen.onEvents(w.events('ZoneChanged').slice(before));
  };
  return { w, screen, drag };
}

describe('T-274 the message after a zone drag', () => {
  it('says what was made, with the ordinal and the tile count, and selects the new zone', () => {
    const f = setup('t274-made');
    f.drag('s', 10, 10, 13, 12);
    expect(f.screen.currentNotice).toBe('Stockpile #1 made: 12 tiles.');
    expect(f.screen.zones.selected).not.toBe(0);
    f.drag('s', 20, 10, 20, 10);
    expect(f.screen.currentNotice).toBe('Stockpile #2 made: 1 tile.');
  });

  it('counts the tiles left out, by reason, when a drag overlaps another zone', () => {
    const f = setup('t274-trimmed');
    f.drag('s', 10, 10, 13, 12);
    f.drag('b', 12, 10, 15, 12);
    expect(f.screen.currentNotice).toBe('Bedroom #1 made: 6 tiles (6 left out: 6 belong to another zone).');
  });

  it('the refusal where no tile qualifies fits 80 columns', () => {
    const f = setup('t274-none');
    f.drag('s', 10, 10, 13, 12);
    f.drag('b', 10, 10, 13, 12);
    const text = f.screen.statusRow2();
    expect(text).toBe('Bedroom: none of the 12 tiles qualify (floor that no other zone holds).');
    expect(Array.from(text).length).toBeLessThanOrEqual(80);
  });

  it('shows the selected zone name on status row 2 while the tool is idle', () => {
    const f = setup('t274-name');
    f.drag('s', 10, 10, 13, 12);
    f.screen.zones.cancel();
    f.screen.clearNotice();
    expect(f.screen.statusRow2()).toContain('Selected: Stockpile #1 (12 t)');
  });
});

describe('T-274 zone tints and labels', () => {
  it('lifts a tint on a black cell to the luminance floor, in both palettes', () => {
    const black = rgb(0, 0, 0);
    for (const tint of [rgb(80, 90, 110), rgb(120, 80, 40), rgb(20, 20, 40)]) {
      const out = blendWithFloor(black, tint, 0.25, ZONE_TINT_MIN_LUMA);
      expect(relativeLuminance(out)).toBeGreaterThanOrEqual(ZONE_TINT_MIN_LUMA);
    }
    // A bright cell keeps the plain blend.
    const bright = rgb(200, 200, 200);
    expect(blendWithFloor(bright, rgb(80, 90, 110), 0.25, ZONE_TINT_MIN_LUMA)).toBe(blendWithFloor(bright, rgb(80, 90, 110), 0.25, 0));
  });

  it('draws the selected zone stronger than another zone', () => {
    const f = setup('t274-selected');
    f.drag('s', 10, 10, 11, 11);
    f.drag('s', 20, 10, 21, 11);
    const reg = f.w.game.registry;
    const compositor = new Compositor({ registry: reg, palette: new Palette(reg) });
    const bgAt = (x: number, selectedZone: number): number => {
      const cells = compositor.compose(f.w.readers, { camX: 0, camY: 0, z, sidebarOpen: false, cursor: null, selectedZone }, 60, 40);
      return cells.get(x, 10).bg;
    };
    const zones = f.w.readers.of<{ zoneAt(i: number): number }>('14');
    const first = zones.zoneAt(f.w.index(10, 10, z));
    const plain = [bgAt(10, 0), bgAt(20, 0)];
    expect(plain[0]).toBe(plain[1]);
    expect(bgAt(10, first)).not.toBe(plain[0]);
    expect(bgAt(20, first)).toBe(plain[1]);
    expect(relativeLuminance(bgAt(10, first))).toBeGreaterThan(relativeLuminance(plain[0] as number));
  });

  it('writes the zone type list with names that fit a 16 cell column', () => {
    const f = setup('t274-labels');
    f.screen.openPanel('zones');
    const s = surface(80, 42);
    f.screen.draw(s);
    const text = s.lines().join('\n');
    for (const label of ['Dining', 'Hearth', 'Meeting', 'Archery', 'Fishing', 'Gather']) expect(text).toContain(label);
    expect(text).not.toContain('Dining ha');
    expect(text).not.toContain('Meeting a');
    // The full names stay in the tool prompt.
    f.screen.zones.choose('d');
    expect(f.screen.statusRow2()).toContain('Dining hall');
  });
});
