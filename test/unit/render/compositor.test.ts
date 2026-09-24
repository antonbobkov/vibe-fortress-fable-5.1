import { describe, it, expect } from 'vitest';
import { STATUS_ROWS, SIDEBAR_COLS } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import { LOG_ROWS } from '@render/constants';
import { Compositor } from '@render/compositor';
import { Palette } from '@render/palette';
import { GLYPH_WATER_HIGH } from '@render/environment';
import {
  GLYPH_BOULDER,
  GLYPH_ENGRAVED,
  GLYPH_FORTIFICATION,
  GLYPH_GRASS,
  GLYPH_NONE,
  GLYPH_PAVED_FLOOR,
  GLYPH_RAMP,
  GLYPH_ROUGH_FLOOR,
  GLYPH_ROUGH_WALL,
  GLYPH_SAPLING,
  GLYPH_SMOOTH_FLOOR,
  GLYPH_SOLID_WALL,
  GLYPH_STAIRS_DOWN,
  GLYPH_STAIRS_UP,
  GLYPH_STAIRS_UPDOWN,
  GLYPH_TREE,
} from '@render/glyphs';
import type { Cell } from '@render/cellbuffer';
import { FIXTURE_H, FIXTURE_W, FIXTURE_Z, buildTerrainFixture } from './terrain-fixture';

const COLS = FIXTURE_W;
const ROWS = FIXTURE_H + LOG_ROWS + STATUS_ROWS;

function scene(daylight = true): {
  compositor: Compositor;
  palette: Palette;
  cellAt: (x: number, y: number) => Cell;
  fixture: ReturnType<typeof buildTerrainFixture>;
} {
  const fixture = buildTerrainFixture(daylight);
  const palette = new Palette(fixture.registry);
  const compositor = new Compositor({ registry: fixture.registry, palette });
  const cells = compositor.compose(
    fixture.world.readers,
    { camX: 0, camY: 0, z: FIXTURE_Z, sidebarOpen: false, cursor: null },
    COLS,
    ROWS,
  );
  return { compositor, palette, fixture, cellAt: (x, y) => cells.get(x, y) };
}

describe('T-M0-13 compositor: step 1, undiscovered', () => {
  it('draws an undiscovered tile as nothing on the undiscovered color', () => {
    const { cellAt, palette } = scene();
    const undiscovered = palette.color('undiscovered');
    expect(cellAt(0, 0)).toEqual({ glyph: GLYPH_NONE, fg: undiscovered, bg: undiscovered });
  });
});

describe('T-M0-13 compositor: step 2, the terrain base', () => {
  it('draws every wall state with the material color on black', () => {
    const { cellAt, palette } = scene();
    const granite = palette.color('granite_gray');
    const marble = palette.color('marble_white');
    const black = palette.color('black');
    expect(cellAt(1, 0)).toEqual({ glyph: GLYPH_ROUGH_WALL, fg: granite, bg: black });
    expect(cellAt(2, 0)).toEqual({ glyph: GLYPH_SOLID_WALL, fg: granite, bg: black });
    expect(cellAt(3, 0)).toEqual({ glyph: GLYPH_ENGRAVED, fg: granite, bg: black });
    // "Constructed walls use the block glyph regardless."
    expect(cellAt(4, 0)).toEqual({ glyph: GLYPH_SOLID_WALL, fg: marble, bg: black });
  });

  it('draws the other tile kinds', () => {
    const { cellAt, palette } = scene();
    const granite = palette.color('granite_gray');
    const oak = palette.color('oak_brown');
    expect(cellAt(5, 0).glyph).toBe(GLYPH_FORTIFICATION);
    expect(cellAt(5, 0).fg).toBe(granite);
    expect(cellAt(6, 0)).toMatchObject({ glyph: GLYPH_TREE, fg: oak });
    expect(cellAt(7, 0)).toMatchObject({ glyph: GLYPH_SAPLING, fg: oak });
    expect(cellAt(1, 2)).toMatchObject({ glyph: GLYPH_RAMP, fg: granite });
    expect(cellAt(2, 2).glyph).toBe(GLYPH_STAIRS_UP);
    expect(cellAt(3, 2).glyph).toBe(GLYPH_STAIRS_DOWN);
    expect(cellAt(4, 2).glyph).toBe(GLYPH_STAIRS_UPDOWN);
    expect(cellAt(5, 2)).toMatchObject({ glyph: GLYPH_GRASS, fg: palette.color('berry_red') });
    expect(cellAt(6, 2)).toMatchObject({ glyph: GLYPH_BOULDER, fg: granite });
  });

  it('draws every floor state, with moss indoors and grass outdoors', () => {
    const { cellAt, palette } = scene();
    const granite = palette.color('granite_gray');
    const marble = palette.color('marble_white');
    expect(cellAt(0, 1)).toMatchObject({ glyph: GLYPH_ROUGH_FLOOR, fg: granite });
    expect(cellAt(1, 1)).toMatchObject({ glyph: GLYPH_SMOOTH_FLOOR, fg: granite });
    // "engraved floor: ☼, material (dimmed)".
    expect(cellAt(2, 1)).toMatchObject({ glyph: GLYPH_ENGRAVED, fg: palette.dim(marble, 1) });
    expect(cellAt(3, 1)).toMatchObject({ glyph: GLYPH_PAVED_FLOOR, fg: marble });
    expect(cellAt(4, 1)).toMatchObject({ glyph: GLYPH_GRASS, fg: palette.color('grass_green') });
    expect(cellAt(5, 1)).toMatchObject({ glyph: GLYPH_GRASS, fg: palette.color('moss_teal') });
    expect(cellAt(6, 1)).toMatchObject({ glyph: GLYPH_ROUGH_FLOOR, fg: palette.color('mud_brown') });
    expect(cellAt(7, 1)).toEqual({
      glyph: GLYPH_ROUGH_FLOOR,
      fg: palette.color('gray'),
      bg: palette.color('snow_white'),
    });
    expect(cellAt(0, 2)).toMatchObject({ glyph: GLYPH_ROUGH_FLOOR, fg: palette.color('ash_gray') });
  });
});

describe('T-M0-13 compositor: step 2, looking down through open tiles', () => {
  it('dims the cell below by its depth', () => {
    const { cellAt, palette } = scene();
    const granite = palette.color('granite_gray');
    const marble = palette.color('marble_white');
    // One level down: the floor, dimmed once.
    expect(cellAt(7, 2)).toEqual({
      glyph: GLYPH_ROUGH_FLOOR,
      fg: palette.dim(granite, 1),
      bg: palette.dim(palette.color('black'), 1),
    });
    // Two levels down: dimmed twice.
    expect(cellAt(0, 3)).toMatchObject({ glyph: GLYPH_ROUGH_FLOOR, fg: palette.dim(marble, 2) });
  });

  it('shows the abyss under a shaft deeper than LEVELS_VISIBLE_BELOW, and the sky outdoors', () => {
    const day = scene();
    const abyss = day.palette.color('abyss');
    expect(day.cellAt(1, 3)).toEqual({ glyph: GLYPH_NONE, fg: abyss, bg: abyss });
    const skyDay = day.palette.color('sky_day');
    expect(day.cellAt(2, 3)).toEqual({ glyph: GLYPH_NONE, fg: skyDay, bg: skyDay });

    // The same column at night.
    const night = scene(false);
    const skyNight = night.palette.color('sky_night');
    expect(night.fixture.world.readers.calendar.isDaylight).toBe(false);
    expect(night.cellAt(2, 3)).toEqual({ glyph: GLYPH_NONE, fg: skyNight, bg: skyNight });
  });

  it('stops at an open tile that holds a fluid', () => {
    // The tile below (3,3) is open but full of water, so the look-down stops there instead of
    // falling through to the abyss; the fluid layer of M3 paints it.
    const { fixture, palette } = scene();
    const compositor = new Compositor({ registry: fixture.registry, palette });
    const map = fixture.world.readers.map;
    const i = map.index(3, 3, FIXTURE_Z);
    expect(map.fluidLevelAt(map.index(3, 3, FIXTURE_Z - 1))).toBe(7);
    // Since T-M3-08 step 3 paints that water: the full cell below is the water, dimmed one step.
    const cell = compositor.composeMapCell(fixture.world.readers, i, 3, 3, FIXTURE_Z, true);
    expect(cell.glyph).toBe(GLYPH_WATER_HIGH);
    expect(cell.fg).toBe(palette.dim(palette.color('water_7'), 1));
  });

  it('shows the abyss when the column runs out of levels below', () => {
    const { fixture, palette } = scene();
    const compositor = new Compositor({ registry: fixture.registry, palette });
    const readers = fixture.world.readers;
    const i = readers.map.index(4, 3, 0);
    fixture.map.setFlag(i, TileFlag.Discovered, true);
    expect(readers.map.kindAt(i)).toBe(TileKind.Open);
    const abyss = palette.color('abyss');
    expect(compositor.composeMapCell(readers, i, 4, 3, 0, true)).toEqual({
      glyph: GLYPH_NONE,
      fg: abyss,
      bg: abyss,
    });
  });
});

describe('T-M0-13 compositor: the viewport', () => {
  it('fills cells outside the map with black and leaves the log and status rows blank', () => {
    const fixture = buildTerrainFixture();
    const palette = new Palette(fixture.registry);
    const compositor = new Compositor({ registry: fixture.registry, palette });
    const cells = compositor.compose(
      fixture.world.readers,
      { camX: 4, camY: 4, z: FIXTURE_Z, sidebarOpen: false, cursor: null },
      COLS,
      ROWS,
    );
    const black = palette.color('black');
    // (4 + 4, 4 + 0) is off the east edge of an 8-wide map.
    expect(cells.get(4, 0)).toEqual({ glyph: GLYPH_NONE, fg: black, bg: black });
    for (let row = FIXTURE_H; row < ROWS; row += 1) {
      expect(cells.get(0, row)).toEqual({ glyph: GLYPH_NONE, fg: black, bg: black });
    }
  });

  it('gives the map rectangle less width when the sidebar is open', () => {
    const fixture = buildTerrainFixture();
    const palette = new Palette(fixture.registry);
    const compositor = new Compositor({ registry: fixture.registry, palette });
    compositor.compose(
      fixture.world.readers,
      { camX: 0, camY: 0, z: FIXTURE_Z, sidebarOpen: true, cursor: null },
      100,
      ROWS,
    );
    expect(compositor.layout.map.cols).toBe(100 - SIDEBAR_COLS);
    expect(compositor.layout.sidebar?.cols).toBe(SIDEBAR_COLS);
  });

  it('draws the look cursor as an inverted cell', () => {
    const fixture = buildTerrainFixture();
    const palette = new Palette(fixture.registry);
    const compositor = new Compositor({ registry: fixture.registry, palette });
    const plain = compositor
      .compose(
        fixture.world.readers,
        { camX: 0, camY: 0, z: FIXTURE_Z, sidebarOpen: false, cursor: null },
        COLS,
        ROWS,
      )
      .get(1, 0);
    const inverted = compositor
      .compose(
        fixture.world.readers,
        { camX: 0, camY: 0, z: FIXTURE_Z, sidebarOpen: false, cursor: { x: 1, y: 0 } },
        COLS,
        ROWS,
      )
      .get(1, 0);
    expect(inverted).toEqual({ glyph: plain.glyph, fg: plain.bg, bg: plain.fg });

    // A cursor outside the viewport changes nothing.
    const off = compositor
      .compose(
        fixture.world.readers,
        { camX: 0, camY: 0, z: FIXTURE_Z, sidebarOpen: false, cursor: { x: 99, y: 99 } },
        COLS,
        ROWS,
      )
      .get(1, 0);
    expect(off).toEqual(plain);
  });
});
