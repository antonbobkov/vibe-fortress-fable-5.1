/**
 * The compositor: readers and the viewport in, a cell buffer out.
 *
 * Implements `02-systems/23-rendering.md` § Compositor steps 1, 2 and 10 and the
 * `compose` / `composeMapCell` / `terrainCell` / `fullCell` pseudo-code of
 * `04-implementation/algorithms/compositor.md`, over the glyph and color rows of
 * `03-content/glyphs-and-colors.md` § Glyphs by thing § Terrain.
 *
 * Steps 3 to 9 (fluids, buildings, items, creatures, projectiles, overlays, lighting) are the
 * layers of systems that arrive over the milestones; each is a named function called from the
 * documented place in the pipeline. Step 6 (creatures, with the dwarves' state colors) and the
 * designation overlay of step 8 are T-M1-15; buildings, items and the zone and stockpile-usage
 * overlays are T-M2-10 (`things.ts`); fluids, fire, mist, rain and snow, the `fluid levels` and
 * `temperature` overlays, lighting and the animation phases are T-M3-08 (`environment.ts`, D-103);
 * projectiles M6 (T-M6-17).
 */

import { C } from '@core/components';
import { LEVELS_VISIBLE_BELOW } from '@core/constants';
import { Designation, TileFlag, TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { MapReader, ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import { glyphChars } from './atlas';
import { CellBuffer, computeLayout, type Cell, type Layout } from './cellbuffer';
import {
  GLYPH_BOULDER,
  GLYPH_DESIGNATION_OUTLINE,
  GLYPH_DIGIT_0,
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
import { ThingLayers } from './things';
import { EnvironmentLayers, OVERLAY_FLUID_LEVELS, OVERLAY_TEMPERATURE } from './environment';
import {
  DebugOverlayLayers,
  OVERLAY_CHUNKS,
  OVERLAY_CONNECTIVITY,
  OVERLAY_JOBS,
  OVERLAY_PATHS,
} from './debug-overlays';
import type { ItemsReader } from '@systems/items';
import type { BuildingsReader } from '@systems/buildings';
import type { PlantsReader } from '@systems/plants';
import type { CombatReader } from '@systems/combat';
import { blend } from './palette';
import { ZONE_TINT_ALPHA } from './constants';

interface PlantGlyphRow {
  readonly id: string;
  readonly glyph: string;
  readonly fg: string;
}

/** The `UiState` fields the compositor reads (`schemas/system-state.md` § UiState). */
export interface ViewState {
  readonly camX: number;
  readonly camY: number;
  readonly z: number;
  /** The sidebar is open when a panel is open (24 § Fortress screen layout). */
  readonly sidebarOpen: boolean;
  /** The look cursor, drawn inverted (23 § Compositor step 10). */
  readonly cursor?: { readonly x: number; readonly y: number } | null;
  /**
   * The overlays switched on (`ui-keymap-and-screens.md` § Overlays: `designations` and `zones`
   * on by default, `priority digits` off). Omitted means the defaults.
   */
  readonly overlays?: readonly string[];
  /**
   * The presentation clock in `FLUID_ANIM_MS` periods (23 § Animation): fluids alternate on its
   * parity, fire, blink and the hearth pulse on the 1000 ms clock (`animFrame >> 1`). Omitted is 0.
   */
  readonly animFrame?: number;
}

/** `ui-keymap-and-screens.md` § Overlays: the ones on by default. */
export const DEFAULT_OVERLAYS: readonly string[] = ['designations', 'zones'];

/** The overlay id of `stockpile usage` (off by default; `ui-keymap-and-screens.md` § Overlays). */
export const OVERLAY_STOCKPILE_USAGE = 'stockpile_usage';

/** The overlay id of the "priority digits" sub-toggle. */
export const OVERLAY_PRIORITY_DIGITS = 'priority_digits';
export const OVERLAY_SQUAD_STATIONS = 'squad_stations';

// The overlay ids the other layer modules own, so the overlay menu reads one list (T-M7-08).
export { OVERLAY_FLUID_LEVELS, OVERLAY_TEMPERATURE } from './environment';
export { OVERLAY_CHUNKS, OVERLAY_CONNECTIVITY, OVERLAY_JOBS, OVERLAY_PATHS } from './debug-overlays';

/**
 * 23 § Compositor step 6: "topmost by priority: dwarves > hostiles > tame > wild > vermin".
 * Lower draws first.
 */
export enum CreatureRank {
  Dwarf = 0,
  Hostile = 1,
  Tame = 2,
  Wild = 3,
  Vermin = 4,
}

/** 23 § Compositor step 8: the designation tint of each kind (`glyphs-and-colors.md` § Designation tints). */
export const DESIGNATION_TINTS: Readonly<Partial<Record<Designation, string>>> = Object.freeze({
  [Designation.Dig]: 'des_dig',
  [Designation.Channel]: 'des_channel',
  [Designation.StairsUp]: 'des_stairs',
  [Designation.StairsDown]: 'des_stairs',
  [Designation.StairsUpDown]: 'des_stairs',
  [Designation.Ramp]: 'des_ramp',
  [Designation.Smooth]: 'des_smooth',
  [Designation.Engrave]: 'des_engrave',
  [Designation.Remove]: 'des_remove',
  [Designation.Chop]: 'des_chop',
  [Designation.Gather]: 'des_gather',
  [Designation.Harvest]: 'des_gather',
});

interface SpeciesRow {
  readonly id: string;
  readonly glyph: string;
  readonly fg: string;
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
  private readonly speciesGlyph: number[] = [];
  private readonly speciesFg: Rgb[] = [];
  private readonly plantGlyphs = new Map<string, { glyph: number; fg: Rgb }>();
  private readonly plantByMaterial = new Map<number, string>();
  private readonly cropGreen: Rgb;
  private readonly cropFlash: Rgb;
  private readonly grassDry: Rgb;
  private readonly dwarfSpecies: number;
  private readonly stateColors: Readonly<Record<'normal' | 'need' | 'child', Rgb>>;
  private readonly combatColors: Readonly<Record<'wounded' | 'asleep' | 'soldier' | 'hostile' | 'flash' | 'web' | 'station' | 'patrol' | 'projectile', Rgb>>;
  private readonly glyphOf: (ch: string) => number;
  private readonly attackedPairs = new Set<string>();
  private readonly flashUntil = new Map<EntityId, number>();
  private readonly stations = new Set<TileIndex>();
  private readonly patrols = new Set<TileIndex>();
  private readonly projectiles = new Map<TileIndex, EntityId>();
  private readonly tints = new Map<Designation, Rgb>();
  /** The frame's readers and overlays, set by {@link compose} for the layer functions. */
  private frameReaders: ReaderSet | null = null;
  private frameOverlays: readonly string[] = DEFAULT_OVERLAYS;
  private buffer: CellBuffer = new CellBuffer(0, 0);
  /** Steps 4, 5 and the zone and stockpile-usage overlays (T-M2-10). */
  private readonly things: ThingLayers;
  /** Steps 3 and 9, the M3 overlays and the weather particles (T-M3-08). */
  private readonly env: EnvironmentLayers;
  /** The `jobs` overlay and the three debug overlays of step 8 (T-M7-08). */
  private readonly debug: DebugOverlayLayers;
  /** Each stockpile's fullness this frame (the `stockpile usage` overlay). */
  private readonly usage = new Map<EntityId, number>();
  private animFrame = 0;
  private lastLayout: Layout = computeLayout(0, 0, false);
  /** The look-down of the cell being composed found nothing but sky (step 9 leaves it alone). */
  private skyCell = false;

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
    this.grassDry = palette.color('grass_dry');
    this.cropGreen = palette.color('grass_green');
    this.cropFlash = palette.color('green');
    this.moss = palette.color('moss_teal');
    this.mud = palette.color('mud_brown');
    this.snowBg = palette.color('snow_white');
    this.snowFg = palette.color('gray');
    this.ash = palette.color('ash_gray');

    // Step 6: each species' glyph and color (`creatures.md`), by registry index.
    const chars = glyphChars(options.registry);
    const indexOf = (ch: string): number => {
      const at = chars.indexOf(ch);
      return at < 0 ? chars.indexOf('?') : at;
    };
    this.glyphOf = indexOf;
    const species = options.registry.table<SpeciesRow>('creatures');
    for (const id of species.ids()) {
      const row = species.byId(id) as SpeciesRow;
      const k = species.index(id);
      this.speciesGlyph[k] = indexOf(Array.from(row.glyph)[0] ?? '?');
      this.speciesFg[k] = palette.has(row.fg) ? palette.color(row.fg) : this.noMaterial;
    }
    this.dwarfSpecies = species.has('dwarf') ? species.index('dwarf') : -1;
    const plants = options.registry.table<PlantGlyphRow>('plants');
    for (const id of plants.ids()) {
      const row = plants.byId(id) as PlantGlyphRow;
      this.plantGlyphs.set(id, { glyph: indexOf(Array.from(row.glyph)[0] ?? '?'), fg: palette.color(row.fg) });
      if (materials.has(id)) this.plantByMaterial.set(materials.index(id), id);
    }
    this.stateColors = {
      normal: palette.color('dwarf_normal'),
      need: palette.color('dwarf_need'),
      child: palette.color('dwarf_child'),
    };
    this.combatColors = {
      wounded: palette.color('dwarf_wounded'), asleep: palette.color('dwarf_asleep'),
      soldier: palette.color('dwarf_soldier'), hostile: palette.color('hostile'),
      flash: palette.color('red'), web: palette.color('silk_white'),
      station: palette.color('zone_barracks'), patrol: palette.color('zone_range'),
      projectile: palette.color('white'),
    };
    for (const [kind, id] of Object.entries(DESIGNATION_TINTS)) this.tints.set(Number(kind) as Designation, palette.color(id as string));
    this.things = new ThingLayers(options.registry, palette, indexOf);
    this.env = new EnvironmentLayers(palette, indexOf);
    this.debug = new DebugOverlayLayers(palette);
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
    this.frameReaders = readers;
    this.frameOverlays = ui.overlays ?? DEFAULT_OVERLAYS;
    this.usage.clear();
    this.env.beginFrame(readers, ui.animFrame ?? 0);
    this.debug.beginFrame(readers, this.frameOverlays);
    this.animFrame = ui.animFrame ?? 0;
    this.stations.clear();
    this.patrols.clear();
    this.indexProjectiles(readers);
    if (this.frameOverlays.includes(OVERLAY_SQUAD_STATIONS) && readers.has('16')) {
      for (const squad of readers.of<CombatReader>('16').squads()) {
        if (squad.station !== null) this.stations.add(squad.station);
        for (const tile of squad.patrol ?? []) this.patrols.add(tile);
      }
    }
    this.things.pulse = this.env.slowPhase;

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
    // A caller that composes one cell (the tests and the inspector) gets the frame's readers set
    // up here; `compose` has done it already for a whole frame.
    if (this.frameReaders !== readers) {
      this.frameReaders = readers;
      this.env.beginFrame(readers, 0);
      this.debug.beginFrame(readers, this.frameOverlays);
      this.animFrame = 0;
      this.indexProjectiles(readers);
    }
    // Step 1: undiscovered tiles show nothing but the overlays the player placed.
    if ((map.flagsAt(i) & TileFlag.Discovered) === 0) {
      return this.overlays({ glyph: GLYPH_NONE, fg: this.undiscovered, bg: this.undiscovered }, i, x, y, true, false);
    }

    // Step 2: the terrain base, and the look-down through open tiles.
    let cell = this.cropOver(this.terrainCell(map, i), i);
    let sky = false;
    if (map.kindAt(i) === TileKind.Open) {
      const before = this.skyCell;
      this.skyCell = false;
      cell = this.lookDown(map, i, x, y, z, daylight);
      sky = this.skyCell;
      this.skyCell = before;
    }

    // Steps 3 to 7, each the layer of a system that arrives later.
    cell = this.fluidOver(cell, i);
    cell = this.buildingOver(cell, i);
    cell = this.itemOver(cell, i);
    const creature = this.topCreature(i);
    cell = this.creatureOver(cell, i);
    cell = this.projectileOver(cell, i);
    if (creature === null) cell = this.env.particleOver(cell, i, x, y);

    // Steps 8 and 9. An empty sky cell already carries the night colour of step 2, so step 9
    // does not dim it a second time (D-103).
    cell = this.overlays(cell, i, x, y, false, creature !== null);
    if (!sky) cell = this.lighting(cell, i);
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
    this.skyCell = true;
    return { glyph: GLYPH_NONE, fg: bg, bg };
  }

  /**
   * `fullCell(j) = creatureOver(itemOver(buildingOver(fluidOver(terrainCell(j), j), j), j), j)`:
   * levels below show everything, dimmed.
   */
  private fullCell(map: MapReader, j: TileIndex): Cell {
    let cell = this.cropOver(this.terrainCell(map, j), j);
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
    if ((flags & TileFlag.Web) !== 0) return { glyph: this.glyphOf('*'), fg: this.combatColors.web, bg: this.black };
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
        return this.wildPlantCell(map, i, GLYPH_TREE, material);
      case TileKind.Sapling:
        return this.wildPlantCell(map, i, GLYPH_SAPLING, material, true);
      case TileKind.Shrub:
        return this.wildPlantCell(map, i, GLYPH_GRASS, material);
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

  /** 07 § Player-facing behavior: wild plants take their species' authored glyph and color. */
  private wildPlantCell(map: MapReader, i: TileIndex, fallbackGlyph: number, fallbackFg: Rgb, sapling = false): Cell {
    const id = this.plantByMaterial.get(map.materialAt(i));
    const plant = id === undefined ? undefined : this.plantGlyphs.get(id);
    return { glyph: sapling ? GLYPH_SAPLING : (plant?.glyph ?? fallbackGlyph), fg: plant?.fg ?? fallbackFg, bg: this.black };
  }

  /** 07 § Player-facing behavior: crops brighten by stage and flash at maturity. */
  private cropOver(cell: Cell, i: TileIndex): Cell {
    const readers = this.frameReaders;
    if (readers === null || !readers.has('07')) return cell;
    const plants = readers.of<PlantsReader>('07');
    const id = plants.cropAt(i);
    if (id === 0) return cell;
    const crop = plants.cropInfo(id);
    const glyph = crop === undefined ? undefined : this.plantGlyphs.get(crop.species)?.glyph;
    if (crop === undefined || glyph === undefined) return cell;
    const phase = this.animFrame % 4;
    const fg = plants.cropReady(i) && phase === 0
      ? this.cropFlash
      : this.palette.dim(this.cropGreen, 3 - Math.min(3, crop.stage));
    return { glyph, fg, bg: cell.bg };
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
      const plants = this.frameReaders?.has('07') === true ? this.frameReaders.of<PlantsReader>('07') : null;
      fg = map.isOutdoor(i) ? (plants?.grassIsDry() === true ? this.grassDry : this.grass) : this.moss;
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

  /** Step 3, fluids (04), mist and fire (05): T-M3-08. */
  private fluidOver(cell: Cell, i: TileIndex): Cell {
    return this.env.fluidOver(cell, i);
  }

  /** Step 4, buildings (14; T-M2-10). */
  private buildingOver(cell: Cell, i: TileIndex): Cell {
    const readers = this.frameReaders;
    return readers === null ? cell : this.things.buildingOver(cell, i, readers);
  }

  /** Step 5, items (13; T-M2-10). */
  private itemOver(cell: Cell, i: TileIndex): Cell {
    const readers = this.frameReaders;
    return readers === null ? cell : this.things.itemOver(cell, i, readers);
  }

  /** How a creature ranks for step 6: dwarves, hostiles, tame, wild (vermin has no rows yet). */
  rankOf(readers: ReaderSet, id: EntityId): CreatureRank {
    const c = readers.entities.get(id, C.Creature);
    if (c === undefined) return CreatureRank.Vermin;
    if (c.species === this.dwarfSpecies && c.faction === 'fortress') return CreatureRank.Dwarf;
    if (c.faction.startsWith('hostile') || c.faction === 'deep') return CreatureRank.Hostile;
    if (readers.entities.has(id, C.Tame)) return CreatureRank.Tame;
    if (readers.entities.has(id, C.Wild) || c.faction === 'wild') return CreatureRank.Wild;
    return c.faction === 'fortress' ? CreatureRank.Tame : CreatureRank.Wild;
  }

  /**
   * The creature step 6 draws on a tile: "topmost by priority: dwarves > hostiles > tame > wild >
   * vermin", ties to the lowest id; "stealthed hostiles are not drawn" (no stealth state exists
   * before 18, M6).
   */
  topCreature(i: TileIndex): EntityId | null {
    const readers = this.frameReaders;
    if (readers === null) return null;
    let best: EntityId | null = null;
    let bestRank = Infinity;
    for (const id of readers.entities.at(i)) {
      if (!readers.entities.has(id, C.Creature)) continue;
      const hostile = readers.entities.get(id, C.Hostile);
      if (hostile?.stealthed === true && hostile.spotted !== true) continue;
      const rank = this.rankOf(readers, id);
      if (rank < bestRank || (rank === bestRank && best !== null && id < best)) {
        best = id;
        bestRank = rank;
      }
    }
    return best;
  }

  /**
   * A dwarf's state color (23 § Palette › State colors): `dwarf_child` for a child, `dwarf_need`
   * while a need drives it (behavior `need`), else `dwarf_normal`. Wounded, asleep and soldier
   * colors need 17, 10's sleep and 16 (docs/archive/decisions-archive.md D-067).
   */
  stateColor(readers: ReaderSet, id: EntityId): Rgb {
    const body = readers.entities.get(id, C.Body);
    if (body !== undefined && (!body.conscious || body.parts.some((part) => part.wounds.length > 0))) return this.combatColors.wounded;
    if (readers.entities.get(id, C.Brain)?.activity === 'sleep') return this.combatColors.asleep;
    if (readers.has('16') && readers.of<CombatReader>('16').onDuty(id)) return this.combatColors.soldier;
    if (readers.has('10') && readers.of<{ isChild(id: EntityId): boolean }>('10').isChild(id)) return this.stateColors.child;
    if (readers.entities.get(id, C.Brain)?.behavior === 'need') return this.stateColors.need;
    return this.stateColors.normal;
  }

  /** Step 6, creatures (10, 08, 18): "species glyph, color by state". */
  private creatureOver(cell: Cell, i: TileIndex): Cell {
    const readers = this.frameReaders;
    const id = this.topCreature(i);
    if (readers === null || id === null) return cell;
    const c = readers.entities.get(id, C.Creature);
    if (c === undefined) return cell;
    const dwarf = this.rankOf(readers, id) === CreatureRank.Dwarf;
    const unconscious = readers.entities.get(id, C.Body)?.conscious === false;
    const glyph = unconscious && ((this.animFrame >> 1) & 1) === 1 ? this.glyphOf('_') : (this.speciesGlyph[c.species] ?? GLYPH_NONE);
    const hostile = this.rankOf(readers, id) === CreatureRank.Hostile;
    const fg = dwarf ? this.stateColor(readers, id) : hostile ? this.combatColors.hostile : (this.speciesFg[c.species] ?? this.noMaterial);
    return { glyph, fg, bg: (this.flashUntil.get(id) ?? -1) > this.animFrame ? this.combatColors.flash : cell.bg };
  }

  /** Step 7: a projectile's current tile and direction from the last ray segment. */
  private projectileOver(cell: Cell, i: TileIndex): Cell {
    const readers = this.frameReaders;
    if (readers === null) return cell;
    const id = this.projectiles.get(i);
    if (id !== undefined) {
      const projectile = readers.entities.get(id, C.Projectile);
      if (projectile === undefined) return cell;
      const previous = projectile.progress <= 1 ? projectile.from : (projectile.line[Math.floor(projectile.progress) - 2] ?? projectile.from);
      const a = readers.map.unpack(previous);
      const b = readers.map.unpack(i);
      const dx = Math.sign(b.x - a.x);
      const dy = Math.sign(b.y - a.y);
      const glyph = dx === 0 ? '|' : dy === 0 ? '-' : dx === dy ? '\\' : '/';
      return { glyph: this.glyphOf(glyph), fg: this.combatColors.projectile, bg: cell.bg };
    }
    return cell;
  }

  private indexProjectiles(readers: ReaderSet): void {
    this.projectiles.clear();
    for (const id of readers.entities.with(C.Projectile)) {
      const pos = readers.entities.get(id, C.Position);
      if (pos === undefined || !readers.map.inBounds(pos.x, pos.y, pos.z)) continue;
      const tile = readers.map.index(pos.x, pos.y, pos.z);
      const previous = this.projectiles.get(tile);
      if (previous === undefined || id < previous) this.projectiles.set(tile, id);
    }
  }

  /** Presentation event subscription: one flash for the first attack of an attacker/defender pair. */
  onEvents(events: readonly GameEvent[], animFrame: number): void {
    for (const event of events) {
      if (event.type !== 'AttackResolved') continue;
      if (typeof event.attackerId !== 'number' || typeof event.defenderId !== 'number') continue;
      const pair = `${event.attackerId}:${event.defenderId}`;
      if (this.attackedPairs.has(pair)) continue;
      this.attackedPairs.add(pair);
      this.flashUntil.set(event.defenderId, animFrame + 2);
    }
  }

  /**
   * Step 8, the overlay stack in its fixed order: designations (03), zones (14, T-M2-10), the rest
   * later. "Overlays alter `bg` or replace the glyph but never hide a creature".
   */
  private overlays(cell: Cell, i: TileIndex, x: number, y: number, undiscovered: boolean, creature: boolean): Cell {
    let c = cell;
    if (this.frameOverlays.includes('designations')) c = this.designationOver(c, i, undiscovered, creature);
    if (this.frameOverlays.includes('zones')) c = this.zoneOver(c, i);
    if (!undiscovered && this.frameOverlays.includes(OVERLAY_SQUAD_STATIONS)) c = this.stationOver(c, i);
    if (this.frameOverlays.includes(OVERLAY_STOCKPILE_USAGE)) c = this.usageOver(c, i);
    if (!undiscovered && this.frameOverlays.includes(OVERLAY_FLUID_LEVELS)) c = this.env.fluidLevelsOver(c, i, creature);
    if (!undiscovered && this.frameOverlays.includes(OVERLAY_TEMPERATURE)) c = this.env.temperatureOver(c, i);
    if (!undiscovered && this.frameOverlays.includes(OVERLAY_JOBS)) c = this.debug.jobsOver(c, i);
    if (this.frameOverlays.includes(OVERLAY_CONNECTIVITY)) c = this.debug.connectivityOver(c, i);
    if (this.frameOverlays.includes(OVERLAY_PATHS)) c = this.debug.pathsOver(c, i);
    if (this.frameOverlays.includes(OVERLAY_CHUNKS)) c = this.debug.chunksOver(c, x, y);
    return c;
  }

  private stationOver(cell: Cell, i: TileIndex): Cell {
    const tint = this.stations.has(i) ? this.combatColors.station : this.patrols.has(i) ? this.combatColors.patrol : null;
    return tint === null ? cell : { ...cell, bg: blend(cell.bg, tint, ZONE_TINT_ALPHA) };
  }

  /**
   * `designations` (default on): "`bg` tinted by designation kind …, priority digit as glyph when
   * the `priority digits` sub-toggle is on"; on an undiscovered tile the designation is drawn "as an
   * outline": `░` in the tint over the undiscovered background (D-067). Digits "replace glyph only
   * if no creature".
   */
  private designationOver(cell: Cell, i: TileIndex, undiscovered: boolean, creature: boolean): Cell {
    const map = this.frameReaders?.map;
    if (map === undefined) return cell;
    const kind = map.designationAt(i);
    if (kind === Designation.None) return cell;
    const tint = this.tints.get(kind);
    if (tint === undefined) return cell;
    if (undiscovered) return { glyph: GLYPH_DESIGNATION_OUTLINE, fg: tint, bg: cell.bg };
    const digits = this.frameOverlays.includes(OVERLAY_PRIORITY_DIGITS) && !creature;
    return { glyph: digits ? GLYPH_DIGIT_0 + map.designationPriorityAt(i) : cell.glyph, fg: cell.fg, bg: tint };
  }

  /** `zones` (default on): "`bg` tinted by zone type at low alpha" (T-M2-10). */
  private zoneOver(cell: Cell, i: TileIndex): Cell {
    const readers = this.frameReaders;
    return readers === null ? cell : this.things.zoneOver(cell, i, readers);
  }

  /** `stockpile usage` (off by default): the fullness ramp (13; T-M2-10). */
  private usageOver(cell: Cell, i: TileIndex): Cell {
    const readers = this.frameReaders;
    if (readers === null || !readers.has('13')) return cell;
    return this.things.usageOver(cell, i, readers, (zone) => {
      const known = this.usage.get(zone);
      if (known !== undefined) return known;
      const tiles = readers.of<BuildingsReader>('14').zone(zone)?.tiles.length ?? 0;
      const free = readers.of<ItemsReader>('13').freeSlots(zone);
      const f = tiles === 0 ? 0 : (tiles - free) / tiles;
      this.usage.set(zone, f);
      return f;
    });
  }

  /** Step 9, night, storm and fog dimming (06 weather): T-M3-08. */
  private lighting(cell: Cell, i: TileIndex): Cell {
    const k = this.env.dimSteps(i);
    return k === 0 ? cell : this.dim(cell, k);
  }
}
