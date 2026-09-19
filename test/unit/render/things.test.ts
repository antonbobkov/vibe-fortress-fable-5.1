import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import { TileKind } from '@core/map3d';
import { Compositor } from '@render/compositor';
import { Palette } from '@render/palette';
import { patternCell, topItem } from '@render/things';
import { glyphChars } from '@render/atlas';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TestWorld } from '../../scenarios/test-world';
import { DAYLIGHT_TICK } from './terrain-fixture';
import { rect } from '../../scenarios/m1-helpers';

const registry = loadContent();
const palette = new Palette(registry);
const chars = glyphChars(registry);
const Z = FLAT_TEST_SURFACE_Z;

function glyphAt(w: TestWorld, x: number, y: number, overlays?: string[]): { ch: string; fg: number; bg: number } {
  const c = new Compositor({ registry, palette });
  const cells = c.compose(w.readers, { camX: x, camY: y, z: Z, sidebarOpen: false, cursor: null, ...(overlays === undefined ? {} : { overlays }) }, 40, 20);
  const cell = cells.get(0, 0);
  return { ch: chars[cell.glyph] ?? '?', fg: cell.fg, bg: cell.bg };
}

describe('T-M2-10 compositor: items', () => {
  it('top item selection: corpses first, then the highest value, ties by the lowest id', () => {
    expect(topItem([])).toBeNull();
    expect(topItem([{ id: 5, corpse: false, value: 90 }, { id: 3, corpse: true, value: 1 }])?.id).toBe(3);
    expect(topItem([{ id: 5, corpse: false, value: 10 }, { id: 3, corpse: false, value: 20 }])?.id).toBe(3);
    expect(topItem([{ id: 5, corpse: false, value: 20 }, { id: 3, corpse: false, value: 20 }])?.id).toBe(3);
    expect(topItem([{ id: 2, corpse: true, value: 1 }, { id: 9, corpse: true, value: 50 }])?.id).toBe(9);
  });

  it('draws the top item in its glyph and material color; more than one item tints the background', () => {
    const w = new TestWorld({ seed: 'items-draw', world: 'flat-test', startTick: DAYLIGHT_TICK });
    const t = w.index(20, 20, Z);
    w.spawnItem('log', 'oak', t);
    const one = glyphAt(w, 20, 20);
    expect(one.ch).toBe('≡');
    expect(one.fg).toBe(palette.color('oak_brown'));
    w.spawnItem('corpse', 'granite', t);
    const two = glyphAt(w, 20, 20);
    expect(two.ch).toBe('%');
    expect(two.fg).toBe(palette.color('corpse_red'));
    expect(two.bg).not.toBe(one.bg);
  });
});

describe('T-M2-10 compositor: buildings', () => {
  it('pattern cell offsets with rotation (north at top, quarter turns clockwise)', () => {
    const rows = ['abc', 'def'];
    // 0: as drawn.
    expect([0, 1, 2].map((x) => patternCell(rows, 0, x, 0)).join('')).toBe('abc');
    // 1: the 3×2 pattern turned into 2×3; its top row reads the left column bottom-up.
    expect([0, 1].map((x) => patternCell(rows, 1, x, 0)).join('')).toBe('da');
    expect([0, 1].map((x) => patternCell(rows, 1, x, 2)).join('')).toBe('fc');
    // 2: upside down.
    expect([0, 1, 2].map((x) => patternCell(rows, 2, x, 0)).join('')).toBe('fed');
    // 3: the top row reads the right column top-down.
    expect([0, 1].map((x) => patternCell(rows, 3, x, 0)).join('')).toBe('cf');
  });

  it('a workshop draws its pattern cell; a planned building is dim; a door is + closed, / open, red locked', () => {
    const w = new TestWorld({ seed: 'buildings-draw', world: 'flat-test', startTick: DAYLIGHT_TICK });
    w.build('carpenter', w.index(20, 20, Z), 'oak');
    expect([glyphAt(w, 20, 20).ch, glyphAt(w, 21, 20).ch, glyphAt(w, 21, 21).ch]).toEqual(['╥', '≡', '┼']);
    expect(glyphAt(w, 20, 20).fg).toBe(palette.color('oak_brown'));
    w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: w.index(30, 20, Z), materialChoice: 'oak' });
    expect(glyphAt(w, 30, 20)).toMatchObject({ ch: 'Θ', fg: palette.color('text_dim') });
    const granite = registry.table('materials').index('granite');
    w.game.world.services.terrain.setKind(w.index(39, 30, Z), TileKind.Wall, granite);
    w.game.world.services.terrain.setKind(w.index(41, 30, Z), TileKind.Wall, granite);
    const door = w.build('door', w.index(40, 30, Z), 'oak');
    expect(glyphAt(w, 40, 30).ch).toBe('+');
    const cow = w.spawnCreature('cow', w.index(40, 30, Z), 'fortress');
    w.movement.teleport(cow, w.index(40, 30, Z));
    const withCow = new Compositor({ registry, palette }).compose(w.readers, { camX: 40, camY: 30, z: Z, sidebarOpen: false, cursor: null }, 4, 4);
    // The creature is drawn over the (open) door; the reader says the door stands open.
    expect(w.readers.of<{ doorOpen(id: number): boolean }>('14').doorOpen(door)).toBe(true);
    expect(chars[withCow.get(0, 0).glyph]).not.toBe('+');
    w.movement.teleport(cow, w.index(45, 35, Z));
    w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' });
    expect(glyphAt(w, 40, 30)).toMatchObject({ ch: '+', fg: palette.color('red') });
  });

  it('the zones overlay tints by zone type; stockpile usage shows the fullness ramp', () => {
    const w = new TestWorld({ seed: 'zones-draw', world: 'flat-test', startTick: DAYLIGHT_TICK });
    const plain = glyphAt(w, 20, 20);
    const pile = w.zone('stockpile', rect(w, 20, 20, Z, 2, 1));
    w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'stone' });
    w.zone('bedroom', rect(w, 25, 20, Z, 1, 1));
    const tinted = glyphAt(w, 20, 20);
    expect(tinted.ch).toBe(plain.ch);
    expect(tinted.bg).not.toBe(plain.bg);
    expect(glyphAt(w, 25, 20).bg).not.toBe(tinted.bg);
    expect(glyphAt(w, 20, 20, ['designations']).bg).toBe(plain.bg);
    const empty = glyphAt(w, 20, 20, ['stockpile_usage']);
    w.spawnItem('raw_stone', 'granite', w.index(20, 20, Z));
    w.spawnItem('raw_stone', 'granite', w.index(21, 20, Z));
    const full = glyphAt(w, 21, 20, ['stockpile_usage']);
    expect(full.bg).not.toBe(empty.bg);
  });
});
