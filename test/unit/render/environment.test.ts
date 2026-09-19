import { describe, it, expect } from 'vitest';
import { STATUS_ROWS, TICKS_PER_HOUR } from '@core/constants';
import { TileFlag } from '@core/map3d';
import { LOG_ROWS } from '@render/constants';
import { Compositor, type ViewState } from '@render/compositor';
import {
  GLYPH_FIRE_A,
  GLYPH_FIRE_B,
  GLYPH_RAIN,
  GLYPH_SNOW,
  GLYPH_WATER_HIGH,
  GLYPH_WATER_LOW,
  OVERLAY_FLUID_LEVELS,
  OVERLAY_TEMPERATURE,
  levelBand,
} from '@render/environment';
import { Palette } from '@render/palette';
import { loadContent } from '@content/loader';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;
const registry = loadContent();
const palette = new Palette(registry);

function world(seed: string, startTick = 8 * TICKS_PER_HOUR): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick });
}

function cellAt(w: TestWorld, x: number, y: number, view: Partial<ViewState> = {}): { glyph: number; fg: number; bg: number } {
  const compositor = new Compositor({ registry, palette });
  const base: ViewState = { camX: x, camY: y, z: Z, sidebarOpen: false, cursor: null, ...view };
  return compositor.compose(w.readers, base, 4, 4 + LOG_ROWS + STATUS_ROWS).get(0, 0);
}

describe('T-M3-08 render: fluids, fire and mist (23 § Compositor step 3)', () => {
  it('draws water and magma by level band, and settled tiles do not animate', () => {
    const w = world('render-fluids');
    const active = w.index(20, 20, Z);
    const settled = w.index(21, 20, Z);
    w.setFluid(active, 2);
    w.setFluid(settled, 6);
    w.fluids.sim.deactivate(settled);
    expect(levelBand(1)).toBe(0);
    expect(levelBand(4)).toBe(1);
    expect(levelBand(6)).toBe(2);
    expect(levelBand(7)).toBe(3);
    const a0 = cellAt(w, 20, 20, { animFrame: 0 });
    expect(a0.glyph).toBe(GLYPH_WATER_LOW);
    expect(a0.fg).toBe(palette.color('water_1'));
    expect(a0.bg).toBe(palette.color('water_bg'));
    // The active tile swaps its glyph on the odd phase; the settled one never does.
    expect(cellAt(w, 20, 20, { animFrame: 1 }).glyph).toBe(GLYPH_WATER_HIGH);
    expect(cellAt(w, 21, 20, { animFrame: 0 }).glyph).toBe(GLYPH_WATER_HIGH);
    expect(cellAt(w, 21, 20, { animFrame: 1 }).glyph).toBe(GLYPH_WATER_HIGH);
    expect(cellAt(w, 21, 20, { animFrame: 0 }).fg).toBe(palette.color('water_3'));
    // Level 7 takes the deepest ramp colour and the full background.
    const deep = w.index(22, 20, Z);
    w.setFluid(deep, 7);
    expect(cellAt(w, 22, 20).fg).toBe(palette.color('water_7'));
    expect(cellAt(w, 22, 20).bg).toBe(palette.color('blue'));
    // Magma uses its own ramp.
    const magma = w.index(23, 20, Z);
    w.setFluid(magma, 3, 'magma');
    expect(cellAt(w, 23, 20).fg).toBe(palette.color('magma_2'));
    expect(cellAt(w, 23, 20).bg).toBe(palette.color('magma_bg'));
    // Frozen water is ice: step 2's terrain, not a fluid glyph.
    const frozen = w.index(24, 20, Z);
    w.setFluid(frozen, 5);
    w.fluids.freezer.freeze(frozen, { terrain: w.game.world.services.terrain, emit: () => {} });
    expect(cellAt(w, 24, 20).glyph).not.toBe(GLYPH_WATER_HIGH);
    expect(cellAt(w, 24, 20).fg).toBe(palette.color('ice_blue'));
  });

  it('mist tints the background and a burning tile alternates ^ and ‼', () => {
    const w = world('render-mist');
    const misty = w.index(30, 30, Z);
    w.fluids.sim.mist.set(misty, w.tick + 1000);
    expect(cellAt(w, 30, 30).bg).toBe(palette.color('mist_bg'));
    const burning = w.index(31, 30, Z);
    w.map.setFlag(burning, TileFlag.Burning, true);
    expect(cellAt(w, 31, 30, { animFrame: 0 }).glyph).toBe(GLYPH_FIRE_A);
    expect(cellAt(w, 31, 30, { animFrame: 0 }).fg).toBe(palette.color('yellow'));
    expect(cellAt(w, 31, 30, { animFrame: 2 }).glyph).toBe(GLYPH_FIRE_B);
    expect(cellAt(w, 31, 30, { animFrame: 2 }).fg).toBe(palette.color('red'));
  });
});

describe('T-M3-08 render: the fluid levels and temperature overlays (step 8)', () => {
  it('fluid levels draws the level digit, never over a creature', () => {
    const w = world('render-overlay');
    const t = w.index(20, 20, Z);
    w.setFluid(t, 5);
    const overlays = ['designations', 'zones', OVERLAY_FLUID_LEVELS];
    expect(cellAt(w, 20, 20, { overlays }).glyph).toBe(48 + 5);
    w.spawnDwarf({ at: t });
    w.step(1);
    expect(cellAt(w, 20, 20, { overlays }).glyph).toBe(1);
    // A dry tile keeps its own glyph.
    expect(cellAt(w, 22, 20, { overlays }).glyph).not.toBe(48);
  });

  it('temperature paints a background from blue to red', () => {
    const w = world('render-temp');
    const cold = cellAt(w, 20, 20, { overlays: [OVERLAY_TEMPERATURE] }).bg;
    const magma = w.index(21, 20, Z);
    w.setFluid(magma, 7, 'magma');
    w.step(20);
    const hot = cellAt(w, 21, 20, { overlays: [OVERLAY_TEMPERATURE] }).bg;
    expect(hot).toBe(palette.color('red'));
    expect(cold).not.toBe(hot);
  });
});

describe('T-M3-08 render: lighting and weather particles (step 9, § Animation)', () => {
  it('night dims outdoor cells only', () => {
    const day = world('render-light-day', 12 * TICKS_PER_HOUR);
    const night = world('render-light-night', 0);
    expect(day.readers.calendar.isDaylight).toBe(true);
    expect(night.readers.calendar.isDaylight).toBe(false);
    const outdoorDay = cellAt(day, 20, 20);
    const outdoorNight = cellAt(night, 20, 20);
    expect(outdoorNight.fg).toBe(palette.dim(outdoorDay.fg, 1));
    // An underground floor is not dimmed: the player sees what the dwarves know.
    for (const w of [day, night]) w.digRoom(20, 24, Z - 4, 1, 1);
    const undergroundDay = cellAt(day, 20, 24, { z: Z - 4 });
    const undergroundNight = cellAt(night, 20, 24, { z: Z - 4 });
    expect(undergroundNight).toEqual(undergroundDay);
  });

  it('rain and snow draw particles on outdoor open cells while they fall', () => {
    const w = world('render-particles', 12 * TICKS_PER_HOUR);
    const sky = { z: Z + 2 };
    const found = (want: number): boolean => {
      for (let x = 20; x < 60; x += 1) if (cellAt(w, x, 20, sky).glyph === want) return true;
      return false;
    };
    expect(found(GLYPH_RAIN)).toBe(false);
    w.forceWeather('rain');
    expect(found(GLYPH_RAIN)).toBe(true);
    w.forceWeather('snow');
    expect(found(GLYPH_SNOW)).toBe(true);
    w.forceWeather('clear');
    expect(found(GLYPH_SNOW)).toBe(false);
  });
});
