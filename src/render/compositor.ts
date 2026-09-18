/**
 * The compositor: readers and the viewport in, a cell buffer out.
 *
 * Implements `02-systems/23-rendering.md` § Compositor steps 1, 2 and 10 and the
 * `compose` / `composeMapCell` / `terrainCell` / `fullCell` pseudo-code of
 * `04-implementation/algorithms/compositor.md`, over the glyph and color rows of
 * `03-content/glyphs-and-colors.md` § Glyphs by thing § Terrain.
 *
 * Steps 3 to 9 (fluids, buildings, items, creatures, projectiles, overlays, lighting) are the
 * layers of systems that do not exist yet; each is a named no-op here, called from the documented
 * place in the pipeline, so the milestone that brings the system fills in one function:
 * fluids M3 (T-M3-08), buildings and items M2 (T-M2-10), creatures and the designation and zone
 * overlays M1 and M2 (T-M1-15, T-M2-10), projectiles M6 (T-M6-17), lighting M3 (T-M3-08).
 */

import { LEVELS_VISIBLE_BELOW } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { MapReader, ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { TileIndex } from '@core/types';
import { CellBuffer, computeLayout, type Cell, type Layout } from './cellbuffer';
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
} from './glyphs';
import type { Palette, Rgb } from './palette';

/** The `UiState` fields the compositor reads (`schemas/system-state.md` § UiState). */
export interface ViewState {
  readonly camX: number;
  readonly camY: number;
  readonly z: number;
  /** The sidebar is open when a panel is open (24 § Fortress screen layout). */
  readonly sidebarOpen: boolean;
  /** The look cursor, drawn inverted (23 § Compositor step 10). */
  readonly cursor?: { readonly x: number; readonly y: number } | null;
}

/** One row of the `materials` table, as the compositor reads it. */
interface MaterialColorRow {
  readonly id: string;
  readonly color: string;
}

export interface CompositorOptions {
  readonly registry: Registry;
  readonly palette: Palette;
}

export class Compositor {
  readonly palette: Palette;
  private readonly materialColors: Int32Array;
  private readonly noMaterial: Rgb;
  private readonly undiscovered: Rgb;
  private readonly black: Rgb;
  private readonly skyDay: Rgb;
  private readonly skyNight: Rgb;
  private readonly abyss: Rgb;
  private readonly grass: Rgb;
  private readonly moss: Rgb;
  private readonly mud: Rgb;
  private readonly snowBg: Rgb;
  private readonly snowFg: Rgb;
  private readonly ash: Rgb;
  private buffer: CellBuffer = new CellBuffer(0, 0);
  private lastLayout: Layout = computeLayout(0, 0, false);

  constructor(options: CompositorOptions) {
    const palette = options.palette;
    this.palette = palette;
    const materials = options.registry.table<MaterialColorRow>('materials');
    const ids = materials.ids();
    this.materialColors = new Int32Array(ids.length + 1);
    for (const id of ids) {
      this.materialColors[materials.index(id)] = palette.color(
        (materials.byId(id) as MaterialColorRow).color,
      );
    }
    // Material index 0 is "none" (registry.ts); only tiles with no material reach it.
    this.noMaterial = palette.color('gray');
    this.materialColors[0] = this.noMaterial;
    this.undiscovered = palette.color('undiscovered');
    this.black = palette.color('black');
    this.skyDay = palette.color('sky_day');
    this.skyNight = palette.color('sky_night');
    this.abyss = palette.color('abyss');
    this.grass = palette.color('grass_green');
    this.moss = palette.color('moss_teal');
    this.mud = palette.color('mud_brown');
    this.snowBg = palette.color('snow_white');
    this.snowFg = palette.color('gray');
    this.ash = palette.color('ash_gray');
  }

  /** The layout of the last {@link compose}; the app maps mouse cells through it. */
  get layout(): Layout {
    return this.lastLayout;
  }

  /** `render.compose(readers, uiState) → CellBuffer` (23 § Interfaces). */
  compose(readers: ReaderSet, ui: ViewState, cols: number, rows: number): CellBuffer {
    const layout = computeLayout(cols, rows, ui.sidebarOpen);
    this.lastLayout = layout;
    if (this.buffer.cols !== cols || this.buffer.rows !== rows) {
      this.buffer = new CellBuffer(cols, rows);
    }
    const cells = this.buffer;
    cells.fill(GLYPH_NONE, this.black, this.black);

    const map = readers.map;
    const daylight = readers.calendar.isDaylight;
    const rect = layout.map;
    for (let row = 0; row < rect.rows; row += 1) {
      const y = ui.camY + row;
      for (let col = 0; col < rect.cols; col += 1) {
        const x = ui.camX + col;
        if (!map.inBounds(x, y, ui.z)) {
          cells.set(rect.col + col, rect.row + row, GLYPH_NONE, this.black, this.black);
          continue;
        }
        const cell = this.composeMapCell(readers, map.index(x, y, ui.z), x, y, ui.z, daylight);
        cells.setCell(rect.col + col, rect.row + row, cell);
      }
    }
    this.drawCursor(cells, ui, rect.cols, rect.rows);
    return cells;
  }

  /** `composeMapCell(i, x, y, z)`. */
  composeMapCell(
    readers: ReaderSet,
    i: TileIndex,
    x: number,
    y: number,
    z: number,
    daylight: boolean,
  ): Cell {
    const map = readers.map;
    // Step 1: undiscovered tiles show nothing but the overlays the player placed.
    if ((map.flagsAt(i) & TileFlag.Discovered) === 0) {
      return this.overlays({ glyph: GLYPH_NONE, fg: this.undiscovered, bg: this.undiscovered }, i, true);
    }

    // Step 2: the terrain base, and the look-down through open tiles.
    let cell = this.terrainCell(map, i);
    if (map.kindAt(i) === TileKind.Open) {
      cell = this.lookDown(map, i, x, y, z, daylight);
    }

    // Steps 3 to 7, each the layer of a system that arrives later.
    cell = this.fluidOver(cell, i);
    cell = this.buildingOver(cell, i);
    cell = this.itemOver(cell, i);
    cell = this.creatureOver(cell, i);
    cell = this.projectileOver(cell, i);

    // Steps 8 and 9.
    cell = this.overlays(cell, i, false);
    cell = this.lighting(cell, i);
    return cell;
  }

  /**
   * `for k in 1..LEVELS_VISIBLE_BELOW: ... if kind[j] != Open or level(fluid[j]) > 0:
   * c = dim(fullCell(j), k); break; else: c = { ' ', -, outdoor(i) ? sky : abyss }`.
   *
   * A column that runs out of levels before it finds anything shows the same empty cell as one
   * that is open all the way down: there is nothing below to draw either way.
   */
  private lookDown(map: MapReader, i: TileIndex, x: number, y: number, z: number, daylight: boolean): Cell {
    for (let k = 1; k <= LEVELS_VISIBLE_BELOW; k += 1) {
      if (z - k < 0) break;
      const j = map.index(x, y, z - k);
      if (map.kindAt(j) !== TileKind.Open || map.fluidLevelAt(j) > 0) {
        return this.dim(this.fullCell(map, j), k);
      }
    }
    const outdoor = map.isOutdoor(i);
    const bg = outdoor ? (daylight ? this.skyDay : this.skyNight) : this.abyss;
    return { glyph: GLYPH_NONE, fg: bg, bg };
  }

  /**
   * `fullCell(j) = creatureOver(itemOver(buildingOver(fluidOver(terrainCell(j), j), j), j), j)`:
   * levels below show everything, dimmed.
   */
  private fullCell(map: MapReader, j: TileIndex): Cell {
    let cell = this.terrainCell(map, j);
    cell = this.fluidOver(cell, j);
    cell = this.buildingOver(cell, j);
    cell = this.itemOver(cell, j);
    cell = this.creatureOver(cell, j);
    return cell;
  }

  /** `terrainCell(i)`: kind, flags, material color, moss versus grass by outdoor. */
  terrainCell(map: MapReader, i: TileIndex): Cell {
    const flags = map.flagsAt(i);
    const material = this.materialColor(map.materialAt(i));
    const kind = map.kindAt(i);
    switch (kind) {
      case TileKind.Wall:
        // "Constructed walls use the block glyph regardless" (23 § Compositor step 2).
        if ((flags & TileFlag.Constructed) !== 0) {
          return { glyph: GLYPH_SOLID_WALL, fg: material, bg: this.black };
        }
        if ((flags & TileFlag.Engraved) !== 0) {
          return { glyph: GLYPH_ENGRAVED, fg: material, bg: this.black };
        }
        if ((flags & TileFlag.Smoothed) !== 0) {
          return { glyph: GLYPH_SOLID_WALL, fg: material, bg: this.black };
        }
        return { glyph: GLYPH_ROUGH_WALL, fg: material, bg: this.black };
      case TileKind.Floor:
        return this.floorCell(map, i, flags, material);
      case TileKind.Ramp:
        return { glyph: GLYPH_RAMP, fg: material, bg: this.black };
      case TileKind.StairsUp:
        return { glyph: GLYPH_STAIRS_UP, fg: material, bg: this.black };
      case TileKind.StairsDown:
        return { glyph: GLYPH_STAIRS_DOWN, fg: material, bg: this.black };
      case TileKind.StairsUpDown:
        return { glyph: GLYPH_STAIRS_UPDOWN, fg: material, bg: this.black };
      case TileKind.Fortification:
        return { glyph: GLYPH_FORTIFICATION, fg: material, bg: this.black };
      case TileKind.Tree:
        return { glyph: GLYPH_TREE, fg: material, bg: this.black };
      case TileKind.Sapling:
        return { glyph: GLYPH_SAPLING, fg: material, bg: this.black };
      case TileKind.Shrub:
        return { glyph: GLYPH_GRASS, fg: material, bg: this.black };
      case TileKind.Boulder:
        return { glyph: GLYPH_BOULDER, fg: material, bg: this.black };
      case TileKind.Open:
        // Reached through `fullCell` for an open tile that holds a fluid; the fluid layer (M3)
        // paints over it. On its own an open tile has no terrain of its own to draw.
        return { glyph: GLYPH_NONE, fg: this.abyss, bg: this.abyss };
      default:
        return { glyph: GLYPH_NONE, fg: this.black, bg: this.black };
    }
  }

  /**
   * The floor rows of § Terrain, applied in the order the document lists them: the worked state
   * chooses the glyph, then grass, mud, snow and ash override the colors.
   */
  private floorCell(map: MapReader, i: TileIndex, flags: number, material: Rgb): Cell {
    let glyph = GLYPH_ROUGH_FLOOR;
    let fg = material;
    let bg = this.black;
    if ((flags & TileFlag.Constructed) !== 0) glyph = GLYPH_PAVED_FLOOR;
    else if ((flags & TileFlag.Engraved) !== 0) {
      glyph = GLYPH_ENGRAVED;
      // "engraved floor: ☼, material (dimmed)".
      fg = this.palette.dim(material, 1);
    } else if ((flags & TileFlag.Smoothed) !== 0) glyph = GLYPH_SMOOTH_FLOOR;

    if ((flags & TileFlag.Grass) !== 0) {
      glyph = GLYPH_GRASS;
      fg = map.isOutdoor(i) ? this.grass : this.moss;
    }
    if ((flags & TileFlag.Mud) !== 0) fg = this.mud;
    if ((flags & TileFlag.Snow) !== 0) {
      fg = this.snowFg;
      bg = this.snowBg;
    }
    if ((flags & TileFlag.Ash) !== 0) fg = this.ash;
    return { glyph, fg, bg };
  }

  private materialColor(index: number): Rgb {
    const color = this.materialColors[index];
    return color === undefined ? this.noMaterial : color;
  }

  /** `dim(c, k)`: the cell's colors through the palette's cached dimming. */
  dim(cell: Cell, level: number): Cell {
    return {
      glyph: cell.glyph,
      fg: this.palette.dim(cell.fg, level),
      bg: this.palette.dim(cell.bg, level),
    };
  }

  /** Step 10: "the look cursor is drawn as an inverted cell (`fg`/`bg` swapped)". */
  private drawCursor(cells: CellBuffer, ui: ViewState, cols: number, rows: number): void {
    const cursor = ui.cursor;
    if (cursor === undefined || cursor === null) return;
    const col = cursor.x - ui.camX;
    const row = cursor.y - ui.camY;
    if (col < 0 || row < 0 || col >= cols || row >= rows) return;
    const cell = cells.get(col, row);
    cells.set(col, row, cell.glyph, cell.bg, cell.fg);
  }

  // ---------- the layers of systems that are not built yet ----------

  /** Step 3, fluids (04): T-M3-08. */
  private fluidOver(cell: Cell, _i: TileIndex): Cell {
    return cell;
  }

  /** Step 4, buildings (14): T-M2-10. */
  private buildingOver(cell: Cell, _i: TileIndex): Cell {
    return cell;
  }

  /** Step 5, items (13): T-M2-10. */
  private itemOver(cell: Cell, _i: TileIndex): Cell {
    return cell;
  }

  /** Step 6, creatures (10, 08, 18): T-M1-15. */
  private creatureOver(cell: Cell, _i: TileIndex): Cell {
    return cell;
  }

  /** Step 7, projectiles (16): T-M6-17. */
  private projectileOver(cell: Cell, _i: TileIndex): Cell {
    return cell;
  }

  /** Step 8, the overlay stack: designations and zones T-M1-15 and T-M2-10, debug T-M7-08. */
  private overlays(cell: Cell, _i: TileIndex, _undiscoveredOnly: boolean): Cell {
    return cell;
  }

  /** Step 9, night, storm and fog dimming (06 weather): T-M3-08. */
  private lighting(cell: Cell, _i: TileIndex): Cell {
    return cell;
  }
}
