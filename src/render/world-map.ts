/**
 * The world-map compositor.
 *
 * `02-systems/01-world-generation.md` § Player-facing behavior: "the map drawn with biome glyphs
 * and colors; rivers as blue lines; civilization homes as their glyphs; the cursor moves by
 * keyboard or mouse … the filter panel highlights matching regions". The biome glyph and color
 * are the `glyph`/`color` columns of `regions-biomes-and-traits.md` ("`glyph`/`color` for the
 * world map"); a home is its civilization row's `glyph`/`color`; the wireframe of
 * `ui-screens/menus-and-world.md` § World map draws rivers "in blue" and the cursor on its region.
 *
 * A river region draws `~` in `blue` over its biome; the cursor is an inverted cell (the look
 * cursor's style, 23 § Compositor step 10); a region the filter rejects is dimmed one step.
 * DECISIONS.md D-062.
 */

import type { Registry } from '@core/registry';
import type { WorldMap } from '@systems/worldgen';
import { glyphChars } from './atlas';
import type { Cell, CellBuffer, Rect } from './cellbuffer';
import type { Palette, Rgb } from './palette';

interface BiomeRow {
  readonly id: string;
  readonly glyph: string;
  readonly color: string;
}

interface CivRow {
  readonly id: string;
  readonly glyph: string;
  readonly color: string;
}

export interface WorldMapView {
  /** The region at the rectangle's top-left cell. */
  readonly camX: number;
  readonly camY: number;
  readonly cursor: { readonly x: number; readonly y: number } | null;
  /** When given, regions it rejects are dimmed. */
  readonly matches?: (regionId: number) => boolean;
}

/** The river glyph and color. */
export const WORLD_RIVER_CHAR = '~';
export const WORLD_RIVER_COLOR = 'blue';

export class WorldMapCompositor {
  private readonly biomes = new Map<string, { glyph: number; fg: Rgb }>();
  private readonly civs: { id: string; glyph: number; fg: Rgb }[] = [];
  private readonly black: Rgb;
  private readonly river: { glyph: number; fg: Rgb };
  private readonly fallback: Rgb;

  constructor(
    registry: Registry,
    private readonly palette: Palette,
  ) {
    const chars = glyphChars(registry);
    const index = (ch: string): number => {
      const at = chars.indexOf(ch);
      return at < 0 ? chars.indexOf('?') : at;
    };
    this.fallback = palette.color('gray');
    const color = (id: string): Rgb => (palette.has(id) ? palette.color(id) : this.fallback);
    const biomes = registry.table<BiomeRow>('biomes');
    for (const id of biomes.ids()) {
      const row = biomes.byId(id) as BiomeRow;
      this.biomes.set(id, { glyph: index(row.glyph), fg: color(row.color) });
    }
    const civs = registry.table<CivRow>('civilizations');
    for (const id of civs.ids()) {
      const row = civs.byId(id) as CivRow;
      this.civs.push({ id, glyph: index(row.glyph), fg: color(row.color) });
    }
    this.black = palette.color('black');
    this.river = { glyph: index(WORLD_RIVER_CHAR), fg: color(WORLD_RIVER_COLOR) };
  }

  /** A biome's glyph and color, for the legend. */
  biomeCell(biome: string): Cell {
    const b = this.biomes.get(biome);
    return b === undefined ? { glyph: 0, fg: this.fallback, bg: this.black } : { glyph: b.glyph, fg: b.fg, bg: this.black };
  }

  /** The river's glyph and color, for the legend. */
  riverCell(): Cell {
    return { glyph: this.river.glyph, fg: this.river.fg, bg: this.black };
  }

  /** The cell of one region, before the cursor and the filter. */
  regionCell(world: WorldMap, id: number): Cell {
    const region = world.regions[id];
    if (region === undefined) return { glyph: 0, fg: this.black, bg: this.black };
    for (const civ of this.civs) {
      if (world.civHomes[civ.id as keyof WorldMap['civHomes']] === id) return { glyph: civ.glyph, fg: civ.fg, bg: this.black };
    }
    if (region.river !== null) return { glyph: this.river.glyph, fg: this.river.fg, bg: this.black };
    const biome = this.biomes.get(region.biome);
    if (biome === undefined) return { glyph: 0, fg: this.fallback, bg: this.black };
    return { glyph: biome.glyph, fg: biome.fg, bg: this.black };
  }

  compose(cells: CellBuffer, rect: Rect, world: WorldMap, view: WorldMapView): void {
    for (let row = 0; row < rect.rows; row += 1) {
      for (let col = 0; col < rect.cols; col += 1) {
        const x = view.camX + col;
        const y = view.camY + row;
        if (x < 0 || y < 0 || x >= world.size || y >= world.size) {
          cells.set(rect.col + col, rect.row + row, 0, this.black, this.black);
          continue;
        }
        const id = y * world.size + x;
        let cell = this.regionCell(world, id);
        if (view.matches !== undefined && !view.matches(id)) {
          cell = { glyph: cell.glyph, fg: this.palette.dim(cell.fg, 1), bg: this.palette.dim(cell.bg, 1) };
        }
        if (view.cursor !== null && view.cursor.x === x && view.cursor.y === y) {
          cell = { glyph: cell.glyph, fg: cell.bg, bg: cell.fg };
        }
        cells.setCell(rect.col + col, rect.row + row, cell);
      }
    }
  }
}
