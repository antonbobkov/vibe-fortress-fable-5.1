/**
 * T-761: the fortress map cursor is drawn as the world map's is, the tile's glyph in `black` on
 * `world_cursor`, on any tile, blinking with the designation blink and steady with Reduced motion
 * (23 § Compositor step 10, § Animation; 24 § Input model). A box drawn over the map keeps its
 * own colours; only the cursor's cell changes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '@app/game';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { Cell } from '@render/cellbuffer';
import { FLUID_ANIM_MS } from '@render/constants';
import { Palette } from '@render/palette';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { registry } from './ui-fixture';

const palette = new Palette(registry);
const BLACK = palette.color('black');
const CURSOR = palette.color('world_cursor');

async function game(reducedMotion: boolean, party = false): Promise<Game> {
  const g = new Game({ canvas: new MockCanvas(), registry, seed: 't761-map-cursor', createCanvas: mockCanvasFactory(), width: 1280, height: 800, devicePixelRatio: 1, reducedMotion });
  await g.start(party ? { embark: 'default' } : undefined);
  return g;
}

/** The drawn cell of a map tile on the current level. */
function cellAt(g: Game, x: number, y: number): Cell {
  const cells = g.cellBuffer();
  if (cells === null) throw new Error('no frame');
  const rect = g.compositor.layout.map;
  return cells.get(rect.col + x - g.ui.camX, rect.row + y - g.ui.camY);
}

/** Three tiles in view made grass, rock and open air. */
function terrain(g: Game): { grass: { x: number; y: number }; rock: { x: number; y: number }; air: { x: number; y: number } } {
  const map = g.host.world.map;
  const z = g.ui.z;
  const x0 = g.ui.camX + 10;
  const y0 = g.ui.camY + 10;
  const granite = registry.table('materials').index('granite');
  const soil = registry.table('materials').index('loam');
  const grass = { x: x0, y: y0 };
  const rock = { x: x0 + 4, y: y0 };
  const air = { x: x0 + 8, y: y0 };
  const g1 = map.index(grass.x, grass.y, z);
  map.setKind(g1, TileKind.Floor, soil);
  map.setFlag(g1, TileFlag.Grass, true);
  map.setFlag(g1, TileFlag.Discovered, true);
  const r1 = map.index(rock.x, rock.y, z);
  map.setKind(r1, TileKind.Wall, granite);
  map.setFlag(r1, TileFlag.Discovered, true);
  const a1 = map.index(air.x, air.y, z);
  map.setKind(a1, TileKind.Open, 0);
  map.setFlag(a1, TileFlag.Discovered, true);
  return { grass, rock, air };
}

describe('T-761 the map cursor stands out on any tile', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('with a tool armed, the cursor cell is its glyph in black on world_cursor on grass, rock and open air', async () => {
    const g = await game(true);
    g.fortress.tool.choose('d');
    g.render();
    const tiles = terrain(g);
    for (const [name, at] of Object.entries(tiles)) {
      g.ui.cursor = null;
      g.render();
      const plain = cellAt(g, at.x, at.y);
      g.ui.cursor = { ...at };
      g.render();
      g.render();
      expect(g.ui.cursor, name).toEqual(at);
      expect(cellAt(g, at.x, at.y), name).toEqual({ glyph: plain.glyph, fg: BLACK, bg: CURSOR });
    }
  });

  it('blinks as the designations do: the cursor on phase 0, the tile on phase 1; steady with Reduced motion', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    for (const reduced of [false, true]) {
      const g = await game(reduced);
      g.fortress.tool.choose('d');
      g.render();
      const { grass } = terrain(g);
      g.ui.cursor = null;
      vi.setSystemTime(FLUID_ANIM_MS * 3);
      g.render();
      const plain = cellAt(g, grass.x, grass.y);
      g.ui.cursor = { ...grass };
      vi.setSystemTime(FLUID_ANIM_MS * 2);
      g.render();
      g.render();
      expect(cellAt(g, grass.x, grass.y), `reduced=${reduced} phase 0`).toEqual({ glyph: plain.glyph, fg: BLACK, bg: CURSOR });
      vi.setSystemTime(FLUID_ANIM_MS * 3);
      g.render();
      expect(cellAt(g, grass.x, grass.y), `reduced=${reduced} phase 1`).toEqual(reduced ? { glyph: plain.glyph, fg: BLACK, bg: CURSOR } : plain);
    }
  });

  it('a box being drawn keeps its own colours; the cursor cell alone changes', async () => {
    const g = await game(true);
    g.fortress.tool.choose('d');
    g.render();
    const { grass, rock } = terrain(g);
    g.ui.cursor = null;
    g.render();
    const plainRock = cellAt(g, rock.x, rock.y);
    g.fortress.tool.anchor = { x: rock.x, y: rock.y, z: g.ui.z };
    g.ui.cursor = { x: grass.x, y: grass.y };
    g.render();
    g.render();
    // The box from the rock to the grass: the rock corner inverted, the cursor's corner the cursor.
    expect(cellAt(g, rock.x, rock.y)).toEqual({ glyph: plainRock.glyph, fg: plainRock.bg, bg: plainRock.fg });
    const at = cellAt(g, grass.x, grass.y);
    expect(at.fg).toBe(BLACK);
    expect(at.bg).toBe(CURSOR);
  });

  it("Look's creature view puts the same cell on the creature", async () => {
    const g = await game(true, true);
    const dwarf = g.host.readers.of<{ list(): number[] }>('10').list()[0] as number;
    const p = g.host.readers.entities.get(dwarf, C.Position);
    expect(p).toBeDefined();
    g.fortress.inspectCreature(dwarf);
    g.render();
    g.render();
    expect(g.ui.cursor).toEqual({ x: p!.x, y: p!.y });
    // The dwarf's ☺ (glyph 1) in black on the cursor colour.
    expect(cellAt(g, p!.x, p!.y)).toEqual({ glyph: 1, fg: BLACK, bg: CURSOR });
  });
});
