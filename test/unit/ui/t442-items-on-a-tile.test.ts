/**
 * T-442: a stone left by digging is seen where it lies. The look panel's Tile tab, the tab it opens
 * on, lists everything on the tile, and the status row's hover summary says what else is there
 * (24 § Inspection).
 */

import { describe, expect, it } from 'vitest';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { drawLookPanel, tileContents } from '@ui/panels/look';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const Z = 32;

/** Dig a row of granite until stones drop; the dug tiles that hold a stone. */
function dugStones(): { w: TestWorld; stones: TileIndex[]; dwarf: number } {
  const w = new TestWorld({ seed: 't442', world: 'flat-test', embark: 'none' });
  const dwarf = w.spawnDwarf({ at: w.index(20, 21, Z) });
  const granite = w.game.registry.table('materials').index('granite');
  const tiles: TileIndex[] = [];
  for (let x = 20; x < 32; x += 1) {
    const t = w.index(x, 20, Z);
    w.carve(t, TileKind.Wall, granite);
    tiles.push(t);
  }
  w.spawnItem('pick', 'copper', w.index(20, 21, Z));
  w.game.world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor: 'mining', on: true });
  w.game.world.applyCommand({ type: 'Designate', tiles, kind: 'dig' });
  const items = w.readers.of<ItemsReader>('13');
  for (let t = 0; t < 3000; t += 1) w.step(1);
  const stones = tiles.filter((t) => w.map.kindAt(t) === TileKind.Floor && items.at(t).some((id) => items.def(items.get(id)?.type ?? 0)?.id === 'raw_stone'));
  return { w, stones, dwarf };
}

function look(w: TestWorld, tile: TileIndex): string {
  const s = surface(44, 14);
  drawLookPanel(s, { col: 0, row: 0, cols: 44, rows: 14 }, w.readers, w.game.registry, strings, tile, 0);
  return s.lines().join('\n');
}

describe('T-442 every object on a tile can be seen', () => {
  const { w, stones } = dugStones();

  it('a dug-out stone is listed on the Tile tab of its tile, under the floor', () => {
    expect(stones.length).toBeGreaterThan(0);
    const text = look(w, stones[0] as TileIndex);
    expect(text).toContain('Granite floor');
    expect(text).toContain('Here:');
    expect(text).toMatch(/1 granite stone · \d+ ☼/);
  });

  it('the hover summary names the stone after the floor', () => {
    expect(tileContents(w.readers, w.game.registry, strings, stones[0] as TileIndex)).toBe('Granite floor · 1 granite stone');
  });

  it('a creature and an item on one tile: both are listed, and the summary counts what else is there', () => {
    const tile = stones[0] as TileIndex;
    w.spawnDwarf({ at: tile, name: 'Ketil Ironvein' });
    w.spawnItem('log', 'oak', tile);
    const text = look(w, tile);
    expect(text).toMatch(/1 granite stone/);
    expect(text).toMatch(/1 oak log/);
    expect(text).toContain('Ketil Ironvein');
    expect(tileContents(w.readers, w.game.registry, strings, tile)).toMatch(/^Ketil Ironvein.* · 2 more here$/);
  });

  it('a tile with nothing on it shows no Here list', () => {
    const empty = w.index(40, 40, Z);
    expect(look(w, empty)).not.toContain('Here:');
    expect(tileContents(w.readers, w.game.registry, strings, empty)).not.toContain('·');
  });
});
