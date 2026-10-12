/** T-245: zone validity and room openings have glyphs in both palettes. */
import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { TileKind } from '@core/map3d';
import { CellBuffer } from '@render/cellbuffer';
import { Palette } from '@render/palette';
import type { BuildingsReader } from '@systems/buildings';
import { Surface, themeOf } from '@ui/surface';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { glyphs, registry } from './ui-fixture';

async function fixture(colorblind: boolean) {
  const g = new Game({ canvas: new MockCanvas(), registry, seed: 't245-zone-glyphs', createCanvas: mockCanvasFactory(), width: 1280, height: 800, devicePixelRatio: 1 });
  await g.start(); g.ui.camX = 0; g.ui.camY = 0; g.fortress.openPanel('zones');
  const palette = new Palette(registry, { colorblind });
  const s = new Surface(new CellBuffer(80, 50), glyphs, themeOf(palette), palette);
  const rect = g.compositor.layout.map;
  const cell = (x: number, y: number) => s.cells.get(rect.col + x, rect.row + y);
  return { g, s, cell };
}

describe('T-245 zone and room state is not colour alone', () => {
  it.each([false, true])('uses different glyphs for valid and blocked zone tiles, colorblind=%s', async colorblind => {
    const { g, s, cell } = await fixture(colorblind);
    const map = g.host.world.map, z = g.ui.z;
    map.setKind(map.index(5, 4, z), TileKind.Wall, registry.table('materials').index('granite'));
    g.fortress.zones.kind = 'bedroom'; g.fortress.zones.anchor = { x: 4, y: 4, z }; g.fortress.zones.end = { x: 5, y: 4, z };
    g.fortress.draw(s);
    expect(cell(4, 4).bg).toBe(s.theme.good); expect(cell(5, 4).bg).toBe(s.theme.bad);
    expect(cell(4, 4).glyph).toBe(glyphs.index('▒')); expect(cell(5, 4).glyph).toBe(glyphs.index('x'));
  });
  it.each([false, true])('marks every visible room opening with x, colorblind=%s', async colorblind => {
    const { g, s, cell } = await fixture(colorblind);
    const map = g.host.world.map, z = g.ui.z, tile = map.index(10, 10, z);
    g.host.submit({ type: 'CreateZone', zoneType: 'bedroom', tiles: [tile] }); g.host.step(1);
    const reader = g.host.readers.of<BuildingsReader>('14'), zone = reader.zoneAt(tile);
    expect(zone).toBeGreaterThan(0); g.fortress.zones.selected = zone;
    const openings = reader.roomDiagnostics(zone)!.openBorder; expect(openings.length).toBeGreaterThan(0);
    g.fortress.draw(s);
    for (const open of openings) {
      const c = cell(map.xOf(open), map.yOf(open)); expect(c.bg).toBe(s.theme.bad); expect(c.glyph).toBe(glyphs.index('x'));
    }
  });
});
