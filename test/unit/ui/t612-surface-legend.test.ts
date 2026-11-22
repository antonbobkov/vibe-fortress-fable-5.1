/**
 * T-612: Help's Legend explains the first screen of a site (a row per tree glyph with its species,
 * the outdoor grass glyphs, the flower `*` beside the web `*`), and the hover line and Look's
 * terrain line name what grows on a floor: "Loam floor, grass", "Loam floor, flowers", and cave
 * "moss" (`ui-screens/panels.md` § Help, 24 § Inspection).
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { Game } from '@app/game';
import { TileFlag, TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { PlantsReader } from '@systems/plants';
import { helpGlyphRows } from '@ui/panels/help';
import { creaturesAt, drawTileList, itemsAt, tileSummary } from '@ui/panels/look';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { glyphs, registry, strings, surface } from './ui-fixture';

interface PlantRow { readonly id: string; readonly name?: string; readonly kind: string; readonly glyph?: string; readonly fg?: string }

function terrainRows(): { text: string; fg?: string }[] {
  return helpGlyphRows(registry, (g) => glyphs.char(g), strings).filter((r) => r.category === 'Terrain' && r.heading !== true);
}

function look(w: TestWorld, tile: TileIndex): string {
  const s = surface(44, 14);
  drawTileList(s, { col: 0, row: 0, cols: 44, rows: 14 }, w.readers, w.game.registry, strings, tile);
  return s.lines().join('\n');
}

function setGrass(map: { flags: Uint32Array | Uint16Array | Uint8Array | number[] }, i: TileIndex): void {
  map.flags[i] = (map.flags[i] ?? 0) | TileFlag.Grass;
}

describe('T-612 the legend and the hover line explain the surface', () => {
  it('lists every tree glyph of the plants table once, with each species drawn with it, in its colour', () => {
    const rows = terrainRows();
    const plants = registry.table<PlantRow>('plants');
    const trees = plants.ids().map((id) => plants.byId(id) as PlantRow).filter((p) => p.kind === 'tree' || p.kind === 'fungus_tree');
    const treeGlyphs = new Set(trees.map((p) => Array.from(p.glyph as string)[0] as string));
    expect([...treeGlyphs].sort()).toEqual(['↑', '♠', '♣'].sort());
    for (const glyph of treeGlyphs) {
      const row = rows.filter((r) => r.text.startsWith(`${glyph}  tree: `));
      expect(row, glyph).toHaveLength(1);
      const species = trees.filter((p) => Array.from(p.glyph as string)[0] === glyph);
      for (const p of species) expect(row[0]?.text, p.id).toContain(p.name ?? p.id);
      expect(row[0]?.fg).toBe(species[0]?.fg);
    }
    expect(rows.find((r) => r.text.includes('birch'))?.text).toBe('↑  tree: ash, birch, stalk fern');
    expect(rows.find((r) => r.text.includes('yew'))?.text).toBe('♠  tree: pine, tower shroom, yew');
  });

  it("lists the outdoor grass `'` and `` ` `` beside `\"`, and the flower `*` just before the web `*`", () => {
    const text = terrainRows().map((r) => r.text);
    const grass = text.indexOf('"  grass, moss, shrub');
    expect(grass).toBeGreaterThanOrEqual(0);
    expect(text[grass + 1]).toBe("' `  grass (outdoors)");
    const flowers = text.indexOf('*  flowers on grass (outdoors)');
    expect(flowers).toBeGreaterThan(grass);
    expect(text[flowers + 1]).toBe('*  web (white)');
    const all = helpGlyphRows(registry, (g) => glyphs.char(g), strings).map((r) => r.text);
    expect(all.filter((t) => t === '*  web')).toHaveLength(0);
    const fg = Object.fromEntries(terrainRows().map((r) => [r.text, r.fg]));
    expect(fg["' `  grass (outdoors)"]).toBe('grass_green');
    expect(fg['*  flowers on grass (outdoors)']).toBe('flower_yellow');
    expect(fg['*  web (white)']).toBe('silk_white');
  });

  it('the hover line over a grass tile says "grass"', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 't612', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const readers = game.host.readers;
    const plants = readers.of<PlantsReader>('07');
    let found = false;
    for (let row = 4; row < 20 && !found; row += 1) for (let col = 4; col < 30 && !found; col += 1) {
      const tile = readers.map.index(game.ui.camX + col, game.ui.camY + row, game.ui.z);
      if (readers.map.kindAt(tile) !== TileKind.Floor || !readers.map.isOutdoor(tile)) continue;
      if (creaturesAt(readers, tile).length > 0 || itemsAt(readers, tile).length > 0) continue;
      setGrass(game.host.world.map, tile);
      if (plants.flowerAt(tile)) continue;
      const c = game.cellCenter(col, row);
      game.pointerMove({ x: c.x, y: c.y, button: 0, shift: false, ctrl: false, alt: false, meta: false });
      expect(game.fortress.hoverLine()).toMatch(/^\w[\w ]* floor, grass$/);
      found = true;
    }
    expect(found).toBe(true);
  });

  it('names a flower tile "flowers" and cave moss "moss", in the hover summary and on Look\'s Tile tab', () => {
    const w = new TestWorld({ seed: 't612-meadow', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const plants = w.readers.of<PlantsReader>('07');
    const bare = w.index(20, 20, Z);
    expect(tileSummary(w.readers, strings, bare)).not.toContain(',');
    let flower: TileIndex = -1;
    let grass: TileIndex = -1;
    for (let y = 20; y < 40; y += 1) for (let x = 20; x < 40; x += 1) {
      const i = w.index(x, y, Z);
      if (w.map.kindAt(i) !== TileKind.Floor) continue;
      setGrass(w.map, i);
      if (plants.flowerAt(i) && flower < 0) flower = i;
      else if (!plants.flowerAt(i) && grass < 0 && i !== bare) grass = i;
    }
    expect(flower).toBeGreaterThanOrEqual(0);
    expect(tileSummary(w.readers, strings, flower)).toMatch(/ floor, flowers$/);
    expect(tileSummary(w.readers, strings, grass)).toMatch(/ floor, grass$/);
    expect(look(w, flower)).toContain(tileSummary(w.readers, strings, flower));

    // A floor below ground with the same flag is cave moss.
    const cave = w.index(25, 25, Z - 3);
    w.game.world.services.terrain.setKind(cave, TileKind.Floor, w.map.materialAt(cave));
    setGrass(w.map, cave);
    w.map.setFlag(cave, TileFlag.Discovered, true);
    expect(w.readers.map.isOutdoor(cave)).toBe(false);
    expect(tileSummary(w.readers, strings, cave)).toMatch(/ floor, moss$/);
  });
});
