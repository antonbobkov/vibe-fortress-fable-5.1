/** M4 life render: 07 § Player-facing behavior, 23 § Compositor and Animation. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { STATUS_ROWS } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { LOG_ROWS } from '@render/constants';
import { Compositor } from '@render/compositor';
import { Palette } from '@render/palette';
import { HEARTH_PULSE_HEX } from '@render/things';
import { parseHex } from '@render/palette';
import { stageLength } from '@systems/plants';
import { TestWorld } from '../../scenarios/test-world';
import { asRows, readGolden, updating, writeGolden } from './render-fixtures';

const NAME = 'm4-farm';
const Z = FLAT_TEST_SURFACE_Z;
const COLS = 14;
const ROWS = 5 + LOG_ROWS + STATUS_ROWS;

function scene(): TestWorld {
  const w = new TestWorld({ seed: NAME, world: 'flat-test', embark: 'none', startTick: 8 * 50 });
  const mats = w.game.registry.table('materials');
  for (let stage = 0; stage < 4; stage += 1) {
    const tile = w.index(20 + stage, 20, Z);
    const id = w.plantCrop(tile, 'barley', stage);
    if (stage === 3) {
      const crop = w.game.world.entities.get(id, C.Crop);
      if (crop === undefined) throw new Error('crop missing');
      const row = w.plants.facts.row(crop.plant);
      if (row === undefined) throw new Error('plant row missing');
      w.game.world.entities.add(id, C.Crop, { ...crop, growth: stageLength(row) });
    }
  }
  w.map.setKind(w.index(24, 20, Z), TileKind.Tree, mats.index('pine'));
  w.map.setKind(w.index(25, 20, Z), TileKind.Sapling, mats.index('oak'));
  w.map.setKind(w.index(26, 20, Z), TileKind.Shrub, mats.index('brightleaf'));
  w.map.setFlag(w.index(27, 20, Z), TileFlag.Grass, true);
  w.spawnCreature('sheep', w.index(28, 20, Z), 'fortress');
  w.spawnCreature('deer', w.index(29, 20, Z), 'wild');
  return w;
}

function view(w: TestWorld, frame: number): ReturnType<Compositor['compose']> {
  const compositor = new Compositor({ registry: w.game.registry, palette: new Palette(w.game.registry) });
  return compositor.compose(w.readers, { camX: 18, camY: 18, z: Z, sidebarOpen: false, cursor: null, animFrame: frame }, COLS, ROWS);
}

describe('T-M4-18 golden: m4-farm', () => {
  it('uses species glyphs and stage colors, with a mature crop flashing every two seconds', () => {
    const w = scene();
    const palette = new Palette(w.game.registry);
    const cells = view(w, 0);
    const crop = [2, 3, 4, 5].map((col) => cells.get(col, 2));
    expect(crop.map((c) => c.glyph)).toEqual([34, 34, 34, 34]);
    expect(crop.slice(0, 3).map((c) => c.fg)).toEqual([3, 2, 1].map((n) => palette.dim(palette.color('grass_green'), n)));
    expect(crop[3]?.fg).toBe(palette.color('green'));
    expect(view(w, 1).get(5, 2).fg).toBe(palette.color('grass_green'));
    expect(view(w, 4).get(5, 2).fg).toBe(palette.color('green'));
    expect(cells.get(6, 2)).toMatchObject({ glyph: 6, fg: palette.color('pine_green') });
    expect(cells.get(7, 2)).toMatchObject({ glyph: 274, fg: palette.color('oak_brown') });
    expect(cells.get(8, 2)).toMatchObject({ glyph: 5, fg: palette.color('bright_green') });
    expect(cells.get(10, 2)).toMatchObject({ glyph: 115, fg: palette.color('sheep_cream') });
    expect(cells.get(11, 2)).toMatchObject({ glyph: 100, fg: palette.color('deer_tan') });
  });

  it('matches the saved farm cell buffers at both animation phases', () => {
    const w = scene();
    const cells = [...asRows(view(w, 0)), ...asRows(view(w, 1))];
    if (updating(NAME)) writeGolden(NAME, { $note: 'npm run golden:update -- render/m4-farm; farm crops, wild plants, grass and animals at two animation phases', view: { seed: NAME, camX: 18, camY: 18, z: Z, cols: COLS, rows: ROWS }, cells });
    expect(cells).toEqual(readGolden(NAME)?.cells);
  });

  it('pulses the built hearth background on the shared animation clock', () => {
    const w = scene();
    const z = Z - 7;
    w.digRoom(40, 40, z, 7, 7);
    for (let y = 40; y < 47; y += 1) for (let x = 40; x < 47; x += 1) w.discover(w.index(x, y, z));
    w.build('hearth', w.index(43, 43, z), 'granite');
    const compositor = new Compositor({ registry: w.game.registry, palette: new Palette(w.game.registry) });
    const cell = (animFrame: number) => compositor.compose(w.readers, { camX: 40, camY: 40, z, sidebarOpen: false, cursor: null, animFrame }, 7, ROWS).get(3, 3);
    expect(cell(0).bg).toBe(new Palette(w.game.registry).color('black'));
    expect(cell(2).bg).toBe(parseHex(HEARTH_PULSE_HEX));
    expect(cell(4).bg).toBe(cell(0).bg);
  });
});
