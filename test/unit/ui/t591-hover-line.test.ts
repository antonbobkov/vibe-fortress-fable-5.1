/**
 * T-591: the hover line, the status bar's last row, names the tile under the mouse in every mode
 * (24 § Fortress screen layout); the tile summary and the look panel name the fluid on a tile
 * (24 § Inspection); a `container` building's panel says what it holds and opens Look at its items
 * (`ui-screens/panels.md` § Building).
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import { STATUS_ROWS } from '@core/constants';
import { FLUID_FROZEN_BIT } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { drawLookPanel, itemsAt, tileContents } from '@ui/panels/look';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, strings, surface } from './ui-fixture';

const registry = loadContent();
const Z = FLAT_TEST_SURFACE_Z;

async function fortressGame(): Promise<Game> {
  const game = new Game({ canvas: new MockCanvas(), seed: 't591', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await game.start({ embark: 'default' });
  return game;
}

function key(game: Game, k: string, mods: Partial<{ shift: boolean }> = {}): boolean {
  return game.handleKey(press(k, mods));
}

function hoverCell(game: Game, col: number, row: number): void {
  const c = game.cellCenter(col, row);
  game.pointerMove({ x: c.x, y: c.y, button: 0, shift: false, ctrl: false, alt: false, meta: false });
}

/** The tile under a map cell. */
function tileAt(game: Game, col: number, row: number): TileIndex {
  const map = game.host.readers.map;
  return map.index(game.ui.camX + col, game.ui.camY + row, game.ui.z);
}

function wagonOf(game: Game): EntityId {
  const b = game.host.readers.of<BuildingsReader>('14');
  const id = b.byTag('container').find((x) => b.get(x)?.typeId === 'wagon');
  if (id === undefined) throw new Error('no wagon');
  return id;
}

function look(w: TestWorld, tile: TileIndex, tab: 0 | 1 = 0): string {
  const s = surface(44, 14);
  drawLookPanel(s, { col: 0, row: 0, cols: 44, rows: 14 }, w.readers, w.game.registry, strings, tile, tab);
  return s.lines().join('\n');
}

describe('T-591 the hover line', () => {
  it('is the last row of the status bar, three rows high', () => {
    expect(STATUS_ROWS).toBe(3);
  });

  it('names the tile under the mouse with no tool, and row 2 keeps the hotkey strip alone', async () => {
    const game = await fortressGame();
    hoverCell(game, 5, 6);
    const expected = tileContents(game.host.readers, registry, strings, tileAt(game, 5, 6));
    expect(game.fortress.hoverLine()).toBe(expected);
    expect(game.fortress.statusRow2()).toMatch(/^\[d\] dig {2}\[b\] build/);
    game.render();
    const rows = game.textRows();
    expect(rows[rows.length - 1]?.trim()).toBe(expected);
  });

  it('still names the tile with the dig tool armed, the tool keeping row 2', async () => {
    const game = await fortressGame();
    key(game, 'd');
    expect(game.fortress.tool.active).toBe(true);
    hoverCell(game, 7, 8);
    const expected = tileContents(game.host.readers, registry, strings, tileAt(game, 7, 8));
    expect(game.fortress.statusRow2()).toMatch(/^Dig · priority/);
    expect(game.fortress.hoverLine()).toBe(expected);
    game.render();
    const rows = game.textRows();
    expect(rows[rows.length - 2]).toMatch(/Dig · priority/);
    expect(rows[rows.length - 1]?.trim()).toBe(expected);
  });

  it('names the keyboard cursor\'s tile when the mouse is off the map', async () => {
    const game = await fortressGame();
    key(game, 'd');
    const cursor = game.ui.cursor;
    expect(cursor).not.toBeNull();
    const map = game.host.readers.map;
    const tile = map.index(cursor?.x ?? 0, cursor?.y ?? 0, game.ui.z);
    expect(game.fortress.hoverLine()).toBe(tileContents(game.host.readers, registry, strings, tile));
  });
});

describe('T-591 the fluid on a tile', () => {
  const w = new TestWorld({ seed: 't591', world: 'flat-test', embark: 'none' });
  const water = w.index(20, 20, Z);
  const magma = w.index(24, 20, Z);
  const ice = w.index(28, 20, Z);
  w.setFluid(water, 5);
  w.setFluid(magma, 2, 'magma');
  w.setFluid(ice, 6);
  w.map.fluid[ice] = (w.map.fluid[ice] as number) | FLUID_FROZEN_BIT;

  it('the tile summary names the water, the magma and the ice with their levels of 7', () => {
    expect(tileContents(w.readers, w.game.registry, strings, water)).toMatch(/ · water 5\/7$/);
    expect(tileContents(w.readers, w.game.registry, strings, magma)).toMatch(/ · magma 2\/7$/);
    expect(tileContents(w.readers, w.game.registry, strings, ice)).toMatch(/ · ice 6\/7$/);
    expect(tileContents(w.readers, w.game.registry, strings, w.index(32, 20, Z))).not.toMatch(/water|magma|ice \d/);
  });

  it('the fluid comes after a creature and before what else is there', () => {
    w.spawnDwarf({ at: water, name: 'Ketil Ironvein' });
    w.spawnItem('pick', 'copper', water);
    expect(tileContents(w.readers, w.game.registry, strings, water)).toMatch(/^Ketil Ironvein.* · water 5\/7 · 1 copper pick$/);
  });

  it('the look panel\'s Tile tab has the fluid line under the terrain', () => {
    const lines = look(w, magma).split('\n').map((l) => l.trim());
    expect(lines[3]).toBe('Magma 2/7');
    expect(look(w, ice)).toContain('Ice 6/7');
  });
});

describe('T-591 what a container building holds', () => {
  it('the wagon\'s panel counts its goods by category and type, barrels\' and bags\' contents included', async () => {
    const game = await fortressGame();
    const wagon = wagonOf(game);
    game.fortress.openBuilding(wagon);
    const lines = game.fortress.building.lines(game.fortress.ctx);
    const ids = lines.map((l) => l.id);
    expect(ids).toContain('contents');
    expect(lines.find((l) => l.id === 'contents')?.text).toBe('Holds:');
    // The default embark's drink comes in barrels, its seeds in bags: counted with the containers.
    expect(lines.find((l) => l.id === 'contents:drink')?.text).toMatch(/^drink \d+$/);
    expect(lines.find((l) => l.id === 'contents:seed')?.text).toMatch(/^seed \d+$/);
    expect(lines.find((l) => l.id === 'contents:food')?.text).toMatch(/^food \d+: .*easy meal ×10/);
    expect(lines.find((l) => l.id === 'contents:container')?.text).toMatch(/^container \d+: .*bag ×\d+.*barrel ×\d+/);
    // In the stocks tree's order: food before drink before seed before container.
    const order = ids.filter((id) => id.startsWith('contents:'));
    expect(order.indexOf('contents:food')).toBeLessThan(order.indexOf('contents:drink'));
    expect(order.indexOf('contents:drink')).toBeLessThan(order.indexOf('contents:seed'));
    expect(order.indexOf('contents:seed')).toBeLessThan(order.indexOf('contents:container'));
    // The counts are units: the drink line is the barrels' drink.
    const it = game.host.readers.of<ItemsReader>('13');
    let drink = 0;
    for (const barrel of it.inContainer(wagon)) for (const id of it.inContainer(barrel)) if (it.itemCategory(id).startsWith('drink')) drink += it.get(id)?.count ?? 0;
    expect(drink).toBeGreaterThan(0);
    expect(lines.find((l) => l.id === 'contents:drink')?.text).toBe(`drink ${drink}`);
    game.render();
    expect(game.textRows().join('\n')).toContain('[v] see the items');
  });

  it('[v] opens Look on the tile where the goods lie, at the Items tab, and it lists them', async () => {
    const game = await fortressGame();
    const wagon = wagonOf(game);
    game.fortress.openBuilding(wagon);
    const it = game.host.readers.of<ItemsReader>('13');
    const inside = it.inContainer(wagon);
    const centre = it.tileOf(inside[0] as EntityId);
    expect(key(game, 'v')).toBe(true);
    expect(game.ui.panel).toBe('look');
    expect(game.fortress.lookTab).toBe(1);
    const map = game.host.readers.map;
    expect(game.ui.cursor).toEqual({ x: centre % map.w, y: Math.floor(centre / map.w) % map.h });
    // Every item in the wagon, and in its barrels and bags, is among the tile's items.
    const listed = itemsAt(game.host.readers, centre);
    for (const id of inside) {
      expect(listed).toContain(id);
      for (const inner of it.inContainer(id)) expect(listed).toContain(inner);
    }
    game.render();
    expect(game.textRows().join('\n')).toMatch(/Items\(\d+\)/);
    expect(game.textRows().join('\n')).toMatch(/1 pine barrel \(common\) · \d+ ☼/);
  });
});
