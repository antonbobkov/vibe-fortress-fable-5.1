/**
 * The compositor's layers for things (T-M2-10): `02-systems/23-rendering.md` § Compositor step 4
 * (buildings), step 5 (items) and the step 8 overlays `zones` and `stockpile usage`, following
 * `algorithms/compositor.md` (`buildingOver`, `itemOver`, `overlays`) and the rows of
 * `03-content/glyphs-and-colors.md` § Items, § Buildings, § Workshop patterns, § Designation and
 * zone tints.
 *
 * ```
 * buildingOver(c, i): b = buildingAt.get(i); if not b: return c; glyph = pattern? pattern[tileOffset]
 *   : stateGlyph(b); fg = planned ? text_dim : colorOf(b); bg = c.bg (hearth: pulse)
 * itemOver(c, i): items = spatial.at(i).items (excluding those inside containers on the tile);
 *   top = corpses first, then max value; { glyphOf(top), colorOf(top), items.length > 1 ? tint(c.bg) : c.bg }
 * ```
 *
 * A built construction is terrain (step 2 draws it); only a planned one is drawn here. The hearth's
 * pulse needs the animation clock of T-M3-08 and is drawn steady for now (D-078).
 */

import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { Cell } from './cellbuffer';
import { ZONE_TINT_ALPHA } from './constants';
import { blend, type Palette, type Rgb } from './palette';

interface BuildingRowLike {
  readonly id: string;
  readonly category: string;
  readonly glyph?: string;
  readonly pattern?: string;
  readonly tags: readonly string[];
  readonly magmaVariantOf?: string;
}

interface PatternRow {
  readonly id: string;
  readonly rows: readonly string[];
}

interface ItemRowLike {
  readonly id: string;
  readonly glyph?: string;
  readonly category: string;
}

interface MaterialRowLike {
  readonly id: string;
  readonly color: string;
}

/** `glyphs-and-colors.md` § Designation and zone tints: the palette id of each zone type. */
export const ZONE_TINTS: Readonly<Record<string, string>> = Object.freeze({
  stockpile: 'zone_stockpile',
  farm_plot: 'zone_farm',
  pasture: 'zone_pasture',
  bedroom: 'zone_bedroom',
  dining_hall: 'zone_dining',
  hearth_hall: 'zone_hearth',
  hospital: 'zone_hospital',
  barracks: 'zone_barracks',
  archery_range: 'zone_range',
  meeting_area: 'zone_meeting',
  tomb: 'zone_tomb',
  dump: 'zone_dump',
  fishing: 'zone_fishing',
  gather: 'zone_gather',
});

/**
 * The glyph of a footprint tile in a pattern drawn "north at top" and turned by `orientation`
 * quarter turns clockwise: `(dx, dy)` is the tile's offset in the turned footprint.
 */
export function patternCell(rows: readonly string[], orientation: number, dx: number, dy: number): string {
  const h = rows.length;
  const w = Array.from(rows[0] ?? '').length;
  const turns = ((orientation % 4) + 4) % 4;
  let x = dx;
  let y = dy;
  if (turns === 1) {
    x = dy;
    y = h - 1 - dx;
  } else if (turns === 2) {
    x = w - 1 - dx;
    y = h - 1 - dy;
  } else if (turns === 3) {
    x = w - 1 - dy;
    y = dx;
  }
  return Array.from(rows[y] ?? '')[x] ?? ' ';
}

/** One item as step 5 ranks it. */
export interface ItemCandidate {
  readonly id: EntityId;
  readonly corpse: boolean;
  readonly value: number;
}

/** "the top item (highest value; corpses win over other items …)", ties by the lowest id. */
export function topItem(items: readonly ItemCandidate[]): ItemCandidate | null {
  let best: ItemCandidate | null = null;
  for (const it of items) {
    if (best === null) {
      best = it;
      continue;
    }
    if (it.corpse !== best.corpse) {
      if (it.corpse) best = it;
      continue;
    }
    if (it.value > best.value || (it.value === best.value && it.id < best.id)) best = it;
  }
  return best;
}

export class ThingLayers {
  private readonly glyphOf: (ch: string) => number;
  private readonly palette: Palette;
  private readonly buildingRows = new Map<string, BuildingRowLike>();
  private readonly patterns = new Map<string, readonly string[]>();
  private readonly itemRows: (ItemRowLike | undefined)[] = [];
  private readonly materialColors: Rgb[] = [];
  private readonly colors: Readonly<Record<string, Rgb>>;
  private readonly zoneTints = new Map<string, Rgb>();

  constructor(registry: Registry, palette: Palette, glyphOf: (ch: string) => number) {
    this.glyphOf = glyphOf;
    this.palette = palette;
    const buildings = registry.table<BuildingRowLike>('buildings');
    for (const id of buildings.ids()) this.buildingRows.set(id, buildings.byId(id) as BuildingRowLike);
    const patterns = registry.table<PatternRow>('patterns');
    for (const id of patterns.ids()) this.patterns.set(id, (patterns.byId(id) as PatternRow).rows);
    const items = registry.table<ItemRowLike>('items');
    for (const id of items.ids()) this.itemRows[items.index(id)] = items.byId(id);
    const materials = registry.table<MaterialRowLike>('materials');
    for (const id of materials.ids()) {
      const row = materials.byId(id) as MaterialRowLike;
      this.materialColors[materials.index(id)] = palette.has(row.color) ? palette.color(row.color) : palette.color('gray');
    }
    const c = (id: string): Rgb => palette.color(id);
    this.colors = {
      dim: c('text_dim'),
      locked: c('red'),
      trap: c('trap_gray'),
      lever: c('lever_gray'),
      hearth: c('hearth_orange'),
      well: c('well_blue'),
      magma: c('magma_2'),
      corpse: c('corpse_red'),
      bone: c('bone_white'),
      rot: c('rot_green'),
      gray: c('gray'),
      good: c('green'),
      half: c('yellow'),
      full: c('red'),
    };
    for (const [type, id] of Object.entries(ZONE_TINTS)) this.zoneTints.set(type, c(id));
  }

  private material(m: number): Rgb {
    return this.materialColors[m] ?? (this.colors['gray'] as Rgb);
  }

  // ---------- step 4 ----------

  buildingOver(cell: Cell, i: TileIndex, readers: ReaderSet): Cell {
    const id = readers.map.buildingAt(i);
    if (id === 0 || !readers.has('14')) return cell;
    const reader = readers.of<BuildingsReader>('14');
    const b = reader.get(id);
    if (b === undefined) return cell;
    const row = this.buildingRows.get(b.typeId);
    if (row === undefined) return cell;
    const planned = b.state !== 'built';
    // A built construction is terrain: step 2 has drawn it.
    if (!planned && row.category === 'construction') return cell;
    const col = this.colors;
    let glyph = row.glyph ?? '?';
    let fg = this.material(b.material);
    const pattern = row.pattern === undefined ? undefined : this.patterns.get(row.pattern);
    if (pattern !== undefined) {
      const map = readers.map;
      const at = map.unpack(i);
      const cells = b.footprint.map((t) => map.unpack(t));
      glyph = patternCell(pattern, b.orientation, at.x - Math.min(...cells.map((c) => c.x)), at.y - Math.min(...cells.map((c) => c.y)));
      if (row.magmaVariantOf !== undefined || row.tags.includes('magma')) fg = col['magma'] as Rgb;
    } else if (row.tags.includes('door')) {
      glyph = reader.doorOpen(id) ? '/' : '+';
      if (reader.mechanismState(id) === 'locked') fg = col['locked'] as Rgb;
    } else if (row.tags.includes('lever')) {
      glyph = b.toggled ? '\\' : '/';
      fg = col['lever'] as Rgb;
    } else if (row.tags.includes('plate')) {
      fg = col['lever'] as Rgb;
    } else if (row.tags.includes('bridge')) {
      glyph = b.toggled ? '▓' : '═';
    } else if (row.category === 'trap') {
      glyph = '^';
      fg = col['trap'] as Rgb;
    } else if (row.tags.includes('hearth')) {
      fg = col['hearth'] as Rgb;
    } else if (row.tags.includes('well')) {
      fg = col['well'] as Rgb;
    }
    if (planned) fg = col['dim'] as Rgb;
    return { glyph: this.glyphOf(glyph), fg, bg: cell.bg };
  }

  // ---------- step 5 ----------

  itemOver(cell: Cell, i: TileIndex, readers: ReaderSet): Cell {
    if (!readers.has('13')) return cell;
    const reader = readers.of<ItemsReader>('13');
    const here: ItemCandidate[] = [];
    for (const id of readers.entities.at(i)) {
      if (!readers.entities.has(id, C.Item)) continue;
      const it = reader.get(id);
      if (it === undefined) continue;
      const category = this.itemRows[it.type]?.category ?? '';
      here.push({ id, corpse: category === 'refuse/corpse', value: reader.value(id) });
    }
    const top = topItem(here);
    if (top === null) return cell;
    const it = reader.get(top.id);
    if (it === undefined) return cell;
    const row = this.itemRows[it.type];
    const category = row?.category ?? '';
    let fg = this.material(it.material);
    if (category === 'refuse/corpse' || category === 'refuse/part') fg = this.colors['corpse'] as Rgb;
    else if (category === 'refuse/skeleton') fg = this.colors['bone'] as Rgb;
    else if (category === 'refuse/rotten') fg = this.colors['rot'] as Rgb;
    const bg = here.length > 1 ? blend(cell.bg, this.colors['gray'] as Rgb, ZONE_TINT_ALPHA) : cell.bg;
    return { glyph: this.glyphOf(Array.from(row?.glyph ?? '?')[0] ?? '?'), fg, bg };
  }

  // ---------- step 8 ----------

  /** `zones`: "`bg` tinted by zone type at low alpha". */
  zoneOver(cell: Cell, i: TileIndex, readers: ReaderSet): Cell {
    if (!readers.has('14')) return cell;
    const reader = readers.of<BuildingsReader>('14');
    const zone = reader.zoneAt(i);
    if (zone === 0) return cell;
    const tint = this.zoneTints.get(reader.zone(zone)?.type ?? '');
    return tint === undefined ? cell : { glyph: cell.glyph, fg: cell.fg, bg: blend(cell.bg, tint, ZONE_TINT_ALPHA) };
  }

  /**
   * `stockpile usage`: "fullness ramp" over each stockpile's tiles: green while under half full,
   * yellow up to full, red when full (D-078).
   */
  usageOver(cell: Cell, i: TileIndex, readers: ReaderSet, usage: (zoneId: EntityId) => number): Cell {
    if (!readers.has('14')) return cell;
    const reader = readers.of<BuildingsReader>('14');
    const zone = reader.zoneAt(i);
    if (zone === 0 || reader.zone(zone)?.type !== 'stockpile') return cell;
    const f = usage(zone);
    const color = (f >= 1 ? this.colors['full'] : f >= 0.5 ? this.colors['half'] : this.colors['good']) as Rgb;
    return { glyph: cell.glyph, fg: cell.fg, bg: blend(cell.bg, color, ZONE_TINT_ALPHA) };
  }

  get paletteRef(): Palette {
    return this.palette;
  }
}
