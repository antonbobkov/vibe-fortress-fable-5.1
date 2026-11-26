/**
 * The zones tool and panel: `ui-screens/panels.md` § Zones, `14` § Player-facing behavior ("Zones
 * menu (hotkey `z`): type → drag → confirm; the zone panel shows settings and, for rooms, the
 * quality breakdown"), `13` § Player-facing behavior (the stockpile filter editor "with the
 * category tree (checkboxes with tri-state for partial subtrees) …; Presets: Food, Drink, Seeds,
 * Stone, Ore and bars, Wood, Furniture, Weapons and armor, Cloth and leather, Crafts and gems,
 * Refuse, Corpses, Everything").
 *
 * A dragged rectangle submits `CreateZone` with the tiles that qualify and lie in no other zone
 * (D-071: the command refuses a rectangle whole). The panel shows one of two views (T-680): the
 * menu, the kinds of zone to make with their letters and the list of the fortress's zones; or a
 * zone's inspector, its settings, in place of the menu. With no type chosen, a click on a zoned
 * tile selects that zone. `e` makes the next rectangle resize the selected zone; `x` removes it.
 */

import type { Command } from '@core/commands';
import type { StockpileFilter } from '@core/components';
import { TileFlag } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { BuildingsReader, ZoneView } from '@systems/buildings';
import type { PlantsReader } from '@systems/plants';
import { SEASON_NAMES } from '@core/calendar';
import type { PlantRow } from '@systems/plants';
import { ripeningOutlook, seasonAllows } from '@systems/plants/growth';
import { lightMatches } from '@systems/plants/plots';
import type { ItemsReader } from '@systems/items';
import { HOSPITAL_BEDS_PER } from '@systems/health/constants';
import { hospitalWants, noDressingToBeHad, zoneHolds } from '../hospital';
import type { MagicReader } from '@systems/magic';
import type { MaterialsReader } from '@systems/materials';
import { NEAR_SURFACE_DEPTH } from '@systems/materials/constants';
import { ATTUNE_SESSIONS_PER_DAY, SANCTUM_APPRENTICES } from '@systems/magic/constants';
import { TICKS_PER_DAY } from '@core/constants';
import { dropdown, dropdownKey, type DropdownOption, type DropdownState } from '../widgets';
import type { KeyPress } from '@platform/input';
import { C } from '@core/components';
import type { Surface } from '../surface';
import { cutText, drawnCols, keyCells, label, separator, toggleNode, wrapLabel, type TreeNode, type ListState } from '../widgets';
import { acceleratorLabel } from '../keymap';
import { seasonName } from './calendar';
import { accel, buildings, items, type PanelContext } from './context';
import { rectTiles, type TilePoint } from './designate';
import { itemPlace, stockpileName, stockpilePreset, wrapText, zoneEditorMessage, zoneName as zoneTitle } from '../messages';
import { feedDetailText, feedsText, overGrazed, pastureFeed } from '../pasture';
import { drawBuildingLines, ownerPickLines, type BuildingLine } from './building';
import { dwarvesOf, nameOf, professionOf } from './units';
import { drawStockpileEditor, StockpileEditor, PRESET_ORDER } from './stockpile-editor';

/** The zone type kept on `Shift` by default, so that `k` stays Look (`ui-keymap-and-screens.md` § Zones panel). */
const ZONE_TYPE_SHIFT: ReadonlySet<string> = new Set(['k']);

/** The panel's zone types with their accelerators, in the wireframe's order. */
export const ZONE_KINDS: readonly { readonly key: string; readonly id: string }[] = [
  { key: 's', id: 'stockpile' },
  { key: 'f', id: 'farm_plot' },
  { key: 'p', id: 'pasture' },
  { key: 'b', id: 'bedroom' },
  { key: 'd', id: 'dining_hall' },
  { key: 'h', id: 'hearth_hall' },
  { key: 'o', id: 'hospital' },
  { key: 'r', id: 'barracks' },
  { key: 'a', id: 'archery_range' },
  { key: 'm', id: 'meeting_area' },
  { key: 't', id: 'tomb' },
  { key: 'u', id: 'dump' },
  { key: 'i', id: 'fishing' },
  { key: 'g', id: 'gather' },
  { key: 'c', id: 'sanctum' },
  { key: 'k', id: 'compost' },
];

/** The presets in the order 13 lists them. */
export { PRESET_ORDER } from './stockpile-editor';

const MEETING_OVERLAPS = ['hearth_hall', 'dining_hall'];

/** A `[k]` accelerator inside a drawn action line, made clickable at its own cells as drawn. */
function accelerator(s: Surface, col: number, row: number, width: number, text: string, key: string, run: () => void): void {
  const cell = keyCells(s, text, { width }).find((c) => c.key === key);
  if (cell === undefined) return;
  s.hit({ col: col + cell.from, row, cols: cell.cols, rows: 1 }, run);
}

/**
 * 24 § Confirmations: removing "a zone with crops or a stockpile with items" asks first. The
 * confirmation a `RemoveZone` needs, with the `{n}` its text shows, or `null` when it needs none.
 */
export function removalConfirm(ctx: PanelContext, zoneId: EntityId): { id: string; n: number } | null {
  const zone = buildings(ctx)?.zone(zoneId);
  if (zone === undefined) return null;
  if (zone.type === 'farm_plot' && ctx.readers.has('07')) {
    const plants = ctx.readers.of<PlantsReader>('07');
    const crops = zone.tiles.filter((tile) => plants.cropAt(tile) !== 0).length;
    if (crops > 0) return { id: 'c_remove_zone_crops', n: crops };
  }
  if (zone.type === 'stockpile' && ctx.readers.has('13')) {
    const stock = items(ctx);
    const held = zone.tiles.reduce((n, tile) => n + (stock?.at(tile).length ?? 0), 0);
    if (held > 0) return { id: 'c_remove_stockpile_items', n: held };
  }
  return null;
}

export class ZoneTool {
  /** The chosen type, or null (then a click selects a zone). */
  kind: string | null = null;
  /** The zone the settings show. */
  selected: EntityId = 0;
  /**
   * Zones was opened by a click on a zone (24 § Inspection): the map's clicks stay the click
   * ladder's, and `Esc` closes the panel instead of going back to the menu.
   */
  byClick = false;
  /** The menu's zone list: the row `Tab` has focused (-1: none), and the first row in view. */
  listFocus = -1;
  listScroll = 0;
  /** `e`: the next rectangle resizes the selected zone. */
  resizing = false;
  /**
   * After a zone is made the tool stays chosen but idles (`panels.md` § Zones): the inspector takes
   * `Enter`, the arrows and the digits until the pointer is pressed on the map or the type key again.
   */
  idle = false;
  anchor: TilePoint | null = null;
  end: TilePoint | null = null;
  readonly stockpile = new StockpileEditor();
  readonly tree = this.stockpile.tree;
  ownerOpen = false;
  readonly ownerPick: ListState = { selected: 0, scroll: 0 };
  readonly farmMenus: DropdownState[] = Array.from({ length: 4 }, () => ({ open: false, highlighted: 0 }));
  /** The season row the farm plot inspector highlights; it starts on the current season for each plot. */
  farmSeason = 0;
  private farmFor: EntityId = 0;

  /** The tool takes the map: a type is chosen and not idle, or a resize is armed. */
  get active(): boolean {
    return (this.kind !== null && !this.idle) || this.resizing;
  }

  /** A type is chosen or a resize armed, idle or not: `Esc` and a right click drop it. */
  get chosen(): boolean {
    return this.kind !== null || this.resizing;
  }

  /**
   * The inspector shows, not the menu: a zone is selected and no new zone is being drawn (an idle
   * tool after a zone was made, or a resize, keeps the zone's settings).
   */
  inspects(env: Pick<PanelContext, 'readers'>): boolean {
    if (this.selected === 0 || (this.kind !== null && !this.idle) || !env.readers.has('14')) return false;
    return env.readers.of<BuildingsReader>('14').zone(this.selected) !== undefined;
  }

  /** Back to the menu (`[y]`, `Esc` from a zone's settings): no tool, no zone, the map's clicks pick zones again. */
  menu(): void {
    this.cancel();
    this.selected = 0;
    this.byClick = false;
    this.listFocus = -1;
  }

  /** `Tab` and `Shift+Tab` in the menu: the next or previous zone of the list; false when there is none, so `Tab` keeps its global meaning. */
  cycleList(ctx: PanelContext, step: number): boolean {
    const n = zoneList(ctx).length;
    if (n === 0) { this.listFocus = -1; return false; }
    this.listFocus = this.listFocus < 0 ? (step > 0 ? 0 : n - 1) : (this.listFocus + step + n) % n;
    return true;
  }

  /** The zone the menu's focus is on, or 0. */
  focused(ctx: PanelContext): EntityId {
    return this.listFocus < 0 ? 0 : zoneList(ctx)[this.listFocus] ?? 0;
  }

  /** A zone was made: the tool idles, unless the next rectangle is already being drawn. */
  rest(): void {
    if (this.kind !== null && this.anchor === null) this.idle = true;
  }

  /** A press on the map: an idle tool starts the next rectangle. */
  wake(): void {
    this.idle = false;
  }

  cancel(): void {
    this.kind = null;
    this.idle = false;
    this.resizing = false;
    this.anchor = null;
    this.end = null;
    this.ownerOpen = false;
    this.stockpile.reset();
    for (const menu of this.farmMenus) menu.open = false;
  }

  /** Esc backs out of a chooser before cancelling the tool or panel. */
  cancelEditor(): boolean {
    if (this.ownerOpen) { this.ownerOpen = false; return true; }
    return this.stockpile.cancel();
  }

  startOwner(ctx: PanelContext): void {
    const b = buildings(ctx);
    if (b?.zone(this.selected)?.type === 'sanctum') {
      this.ownerOpen = true;
      this.ownerPick.selected = 0;
      this.ownerPick.scroll = 0;
      return;
    }
    if (b?.zone(this.selected)?.type !== 'bedroom') { ctx.notice?.(zoneEditorMessage(ctx, 'unavailable')); return; }
    if (b.roomDiagnostics(this.selected)?.missing.includes('bed')) { ctx.notice?.(zoneEditorMessage(ctx, 'no_bed')); return; }
    if (b.room(this.selected) === undefined) { ctx.notice?.(zoneEditorMessage(ctx, 'pending_room')); return; }
    this.ownerOpen = true;
    const owner = b.ownerOf(this.selected);
    this.ownerPick.selected = owner === 0 ? 0 : Math.max(0, dwarvesOf(ctx).indexOf(owner) + 1);
    this.ownerPick.scroll = 0;
  }

  ownerLines(ctx: PanelContext): BuildingLine[] {
    const b = buildings(ctx);
    const zone = b?.zone(this.selected);
    if (b === null || zone === undefined) return [];
    const name = zoneName(ctx, zone);
    if (zone.type === 'sanctum') return this.apprenticeLines(ctx, name);
    return ownerPickLines(ctx, name, b.ownerOf(this.selected), (id) => {
      if (b.zone(this.selected) === undefined) { ctx.notice?.(zoneEditorMessage(ctx, 'unavailable')); return; }
      if (b.roomDiagnostics(this.selected)?.missing.includes('bed')) { ctx.notice?.(zoneEditorMessage(ctx, 'no_bed')); return; }
      ctx.submit({ type: 'AssignRoom', zoneId: this.selected, dwarfId: id });
      this.ownerOpen = false;
      ctx.notice?.(ctx.strings.get(id === 0 ? 'ui.building.owner_cleared' : 'ui.building.owner_set', { building: name, dwarf: nameOf(ctx, id) }));
    });
  }

  /**
   * The sanctum's apprentice picker: every adult dwarf, marked when an apprentice; `Enter` or a click
   * adds or removes one through `SetSanctumApprentices`, and the picker stays open.
   */
  private apprenticeLines(ctx: PanelContext, name: string): BuildingLine[] {
    if (!ctx.readers.has('25')) return [];
    const magic = ctx.readers.of<MagicReader>('25');
    const current = magic.apprentices(this.selected);
    const wits = (id: EntityId): number => ctx.readers.entities.get(id, C.Attributes)?.wit ?? 0;
    // 25 § The sanctum: Wits drives attunement, so the picker lists the wittiest first.
    const adults = dwarvesOf(ctx).filter((id) => !(ctx.readers.has('10') && ctx.readers.of<{ isChild(id: EntityId): boolean }>('10').isChild(id)))
      .sort((a, b) => wits(b) - wits(a) || a - b);
    const help = ctx.strings.get('ui.zone.apprentices_help', { n: SANCTUM_APPRENTICES });
    return [
      { id: 'title', text: ctx.strings.get('ui.zone.apprentices_title', { zone: name, n: current.length, max: SANCTUM_APPRENTICES }), tone: 'value' },
      ...adults.map((id) => ({
        id: `apprentice:${id}`,
        text: `${current.includes(id) ? '● ' : '○ '}${ctx.strings.get('ui.zone.apprentice_pick', { name: nameOf(ctx, id), profession: professionOf(ctx, id), wits: wits(id) })}`,
        help,
        run: (): void => {
          const now = magic.apprentices(this.selected);
          const next = now.includes(id) ? now.filter((d) => d !== id) : [...now, id];
          if (next.length > SANCTUM_APPRENTICES) { ctx.notice?.(ctx.strings.get('ui.zone.apprentices_full', { n: SANCTUM_APPRENTICES })); return; }
          ctx.submit({ type: 'SetSanctumApprentices', zoneId: this.selected, dwarfIds: next });
        },
      })),
    ];
  }

  /** Only presentation state changes until an existing setting command is submitted. */
  editorKey(ctx: PanelContext, key: KeyPress): boolean {
    if (this.active || key.ctrl || key.alt || key.meta) return false;
    const zone = buildings(ctx)?.zone(this.selected);
    if (zone === undefined) return false;
    if (this.ownerOpen) {
      const rows = this.ownerLines(ctx).filter((line) => line.run !== undefined);
      const up = key.key === '↑' || key.key === 'ArrowUp';
      const down = key.key === '↓' || key.key === 'ArrowDown';
      if (up || down) { this.ownerPick.selected = Math.max(0, Math.min(rows.length - 1, this.ownerPick.selected + (up ? -1 : 1))); return true; }
      if (key.key === 'Enter') { rows[this.ownerPick.selected]?.run?.(); return true; }
      return false;
    }
    if (zone.type === 'stockpile' && this.stockpile.key(ctx, zone.id, key)) return true;
    if ((zone.type === 'bedroom' || zone.type === 'sanctum') && accel(ctx, key) === 'o') { this.startOwner(ctx); return true; }
    if (accel(ctx, key) === 'y') { this.menu(); return true; }
    return false;
  }

  choose(key: string): boolean {
    const k = ZONE_KINDS.find((z) => z.key === key);
    if (k === undefined) return false;
    this.kind = k.id;
    this.idle = false;
    this.resizing = false;
    this.anchor = null;
    this.end = null;
    return true;
  }

  /** The highlighted season row of the selected farm plot: the current season when the plot is first shown. */
  farmRow(ctx: PanelContext): number {
    if (this.farmFor !== this.selected) {
      this.farmFor = this.selected;
      this.farmSeason = ctx.readers.calendar.season;
      for (const menu of this.farmMenus) menu.open = false;
    }
    return this.farmSeason;
  }

  /** The seeds of a crop in stock. */
  seedsOf(ctx: PanelContext, plant: PlantRow): number {
    if (!ctx.readers.has('13')) return 0;
    const stock = ctx.readers.of<ItemsReader>('13');
    return stock.countMatching({ type: ctx.registry.table<{ id: string }>('items').index('seed'), materialId: ctx.registry.table<{ id: string }>('materials').index(plant.id) });
  }

  farmOptions(ctx: PanelContext): DropdownOption[] {
    const plants = ctx.readers.has('07') ? ctx.readers.of<PlantsReader>('07') : null;
    const kind = plants?.plotKind(this.selected);
    if (kind === undefined || kind === 'none' || kind === 'mixed') return [];
    return [{ id: '0', label: ctx.strings.get('ui.zone.farm_none') }, ...ctx.registry.table<PlantRow>('plants').rows
      .filter((p) => (p.kind === 'crop' || p.kind === 'cave_crop') && lightMatches(p, kind))
      .map((p) => ({ id: p.id, label: this.seedsOf(ctx, p) === 0 ? ctx.strings.get('ui.zone.farm_no_seeds', { name: p.name }) : p.name }))];
  }

  /**
   * The farm plot inspector's keys (`panels.md` § Zones): `↑` `↓` move over the four season rows,
   * `Enter` opens the row's crop list (where `↑` `↓` `Enter` choose and `Esc` closes it), and
   * `Shift+A` gives the row's crop to every season in which it can grow.
   */
  farmKey(ctx: PanelContext, key: KeyPress): boolean {
    const zone = buildings(ctx)?.zone(this.selected);
    if (zone?.type !== 'farm_plot' || this.active) return false;
    const season = this.farmRow(ctx);
    const menu = this.farmMenus[season] as DropdownState;
    if (menu.open) {
      const result = dropdownKey(menu, this.farmOptions(ctx), key);
      if (result === null) return false;
      if (result !== 'handled') ctx.submit({ type: 'SetPlotCrop', zoneId: this.selected, season, speciesId: result === '0' ? 0 : result });
      return true;
    }
    if (key.ctrl || key.alt || key.meta) return false;
    const up = key.key === '↑' || key.key === 'ArrowUp';
    const down = key.key === '↓' || key.key === 'ArrowDown';
    if ((up || down) && !key.shift) { this.farmSeason = Math.max(0, Math.min(3, season + (up ? -1 : 1))); return true; }
    if (key.key === 'Enter' && !key.shift) {
      const options = this.farmOptions(ctx);
      const plant = this.cropOf(ctx, season);
      menu.open = true;
      menu.highlighted = Math.max(0, options.findIndex((o) => o.id === (plant?.id ?? '0')));
      return true;
    }
    if (accel(ctx, key) === 'a') { this.farmAllSeasons(ctx, season); return true; }
    if (accel(ctx, key) === 'w') { this.farmFertilize(ctx); return true; }
    return false;
  }

  /** `[w]`: `07` § Fertilizer, the plot's `fertilize` setting on or off (`SetZoneSetting`). */
  farmFertilize(ctx: PanelContext): void {
    const on = ctx.readers.has('07') && ctx.readers.of<PlantsReader>('07').plotFertilize(this.selected);
    ctx.submit({ type: 'SetZoneSetting', zoneId: this.selected, key: 'fertilize', value: !on });
  }

  /** The crop set for a season of the selected plot, if any. */
  private cropOf(ctx: PanelContext, season: number): PlantRow | undefined {
    const id = ctx.readers.of<PlantsReader>('07').plotSettings(this.selected)[season] ?? 0;
    return id === 0 ? undefined : ctx.registry.table<PlantRow>('plants').byIndex(id);
  }

  /** `Shift+A`: the crop of a season, for every season in which that crop can grow. */
  farmAllSeasons(ctx: PanelContext, season: number): void {
    const plant = this.cropOf(ctx, season);
    const zone = buildings(ctx)?.zone(this.selected);
    const covered = zone !== undefined && allSkylit(ctx.readers.map, zone.tiles);
    for (let target = 0; target < 4; target += 1) {
      if (target === season || (plant !== undefined && !seasonAllows(plant, plant.kind === 'cave_crop' || covered, target))) continue;
      ctx.submit({ type: 'SetPlotCrop', zoneId: this.selected, season: target, speciesId: plant === undefined ? 0 : plant.id });
    }
  }

  categories(): TreeNode[] {
    return this.stockpile.categories();
  }

  /** Whether a tile may join a new zone of the tool's type: it qualifies and no other zone holds it. */
  tileOk(ctx: PanelContext, type: string, i: TileIndex, except: EntityId = 0): boolean {
    const b = buildings(ctx);
    if (b === null || !b.zoneTileQualifies(type, i)) return false;
    const other = b.zoneAt(i);
    if (other === 0 || other === except) return true;
    const otherType = b.zone(other)?.type ?? '';
    return (type === 'meeting_area' && MEETING_OVERLAPS.includes(otherType)) || (otherType === 'meeting_area' && MEETING_OVERLAPS.includes(type));
  }

  /** The command a finished rectangle submits (none when no tile qualifies). */
  commands(ctx: PanelContext, a: TilePoint, b: TilePoint): Command[] {
    const rect = rectTiles(ctx.readers.map, a, b);
    const bl = buildings(ctx);
    if (this.resizing) {
      const zone = bl?.zone(this.selected);
      if (zone === undefined) return [];
      const tiles = rect.filter((i) => this.tileOk(ctx, zone.type, i, this.selected));
      this.resizing = false;
      return tiles.length === 0 ? [] : [{ type: 'ResizeZone', zoneId: this.selected, tiles }];
    }
    if (this.kind === null) return [];
    const type = this.kind;
    const tiles = rect.filter((i) => this.tileOk(ctx, type, i));
    return tiles.length === 0 ? [] : [{ type: 'CreateZone', zoneType: type, tiles }];
  }

  /** With no type chosen, a click on a zoned tile selects that zone. */
  select(ctx: PanelContext, i: TileIndex): boolean {
    const id = buildings(ctx)?.zoneAt(i) ?? 0;
    if (id === 0) return false;
    this.selectZone(id);
    return true;
  }

  /** Show a zone's settings: its inspector starts afresh for another zone. */
  selectZone(id: EntityId): void {
    if (id !== this.selected) { this.ownerOpen = false; this.stockpile.reset(); }
    this.selected = id;
    this.listFocus = -1;
  }

  /** The stockpile's current filter (13's `Stockpile` component). */
  filterOf(ctx: PanelContext): StockpileFilter | null {
    return items(ctx)?.stockpile(this.selected)?.filter ?? null;
  }

  /** `p`: the next preset. */
  nextPreset(ctx: PanelContext): Command | null {
    const zone = buildings(ctx)?.zone(this.selected);
    if (zone?.type !== 'stockpile') return null;
    const current = this.presetOf(ctx);
    const at = current === null ? -1 : PRESET_ORDER.indexOf(current);
    const next = PRESET_ORDER[(at + 1) % PRESET_ORDER.length] as string;
    return { type: 'SetStockpileFilter', zoneId: this.selected, filter: next };
  }

  /** The preset the filter equals, or null ("custom"). */
  presetOf(ctx: PanelContext): string | null {
    const f = this.filterOf(ctx);
    if (f === null) return null;
    return stockpilePreset(f);
  }

  /** Toggle a category node of the selected stockpile's filter (tri-state semantics). */
  toggleCategory(ctx: PanelContext, node: string): Command | null {
    const f = this.filterOf(ctx);
    if (f === null) return null;
    const categories = toggleNode(this.categories(), f.categories, node);
    return { type: 'SetStockpileFilter', zoneId: this.selected, filter: { ...f, categories } };
  }
}

/** 13 § The compost heap: the items lying on a heap that will turn to compost. */
function compostWaiting(ctx: PanelContext, zone: ZoneView): number {
  if (!ctx.readers.has('13')) return 0;
  const items = ctx.readers.of<ItemsReader>('13');
  let n = 0;
  for (const tile of zone.tiles) {
    for (const id of items.at(tile)) {
      const cat = items.itemCategory(id);
      if (cat.startsWith('refuse/rotten') || cat.startsWith('farm/dung')) n += 1;
    }
  }
  return n;
}

/** "Farm plot #3": the zone's ordinal among the zones of its type. */
function zoneName(ctx: PanelContext, zone: ZoneView): string {
  const n = (buildings(ctx)?.zonesOfType(zone.type) ?? []).indexOf(zone.id) + 1;
  return `${ctx.strings.get(`ui.zone.type.${zone.type}`)} #${n}`;
}

/** The fortress's zones as the menu lists them: by kind in the menu's order, each kind by its ordinal. */
export function zoneList(ctx: PanelContext): EntityId[] {
  const b = buildings(ctx);
  return b === null ? [] : ZONE_KINDS.flatMap((kind) => b.zonesOfType(kind.id));
}

/**
 * The menu (T-680): the kinds of zone to make, each with its letter, then the fortress's zones, a
 * row each with its size; a click on a row, or `Tab` to it and `Enter`, opens its settings.
 */
function drawZoneMenu(s: Surface, rect: Rect, tool: ZoneTool, ctx: PanelContext, onOpen: (id: EntityId) => void): void {
  const t = s.theme;
  const strings = ctx.strings;
  const col = rect.col + 1;
  const width = rect.cols - 2;
  const bottom = rect.row + rect.rows;
  let row = rect.row;
  const colW = Math.floor(width / 2);
  for (let k = 0; k < ZONE_KINDS.length; k += 2) {
    for (let j = 0; j < 2; j += 1) {
      const kind = ZONE_KINDS[k + j];
      if (kind === undefined) continue;
      const at = col + j * colW;
      const n = label(s, at, row, `${acceleratorLabel(kind.key, ZONE_TYPE_SHIFT)} ${strings.get(`ui.zone.short.${kind.id}`)}`, { width: colW - 1 });
      if (tool.kind === kind.id) s.invert({ col: at, row, cols: n, rows: 1 });
      s.hit({ col: at, row, cols: n, rows: 1 }, () => void tool.choose(kind.key));
    }
    row += 1;
  }
  const drawing = tool.kind !== null;
  label(s, col, row, strings.get(drawing ? 'ui.zone.help1' : 'ui.zone.menu_help1'), { fg: t.dim, width });
  label(s, col, row + 1, strings.get(drawing ? 'ui.zone.help2' : 'ui.zone.menu_help2'), { fg: t.dim, width });
  row += 2;
  if (row >= bottom) return;
  const list = zoneList(ctx);
  separator(s, col, row, width, strings.get('ui.zone.list', { n: list.length }));
  row += 1;
  if (list.length === 0) {
    if (row < bottom) label(s, col, row, strings.get('ui.zone.list_none'), { fg: t.dim, width });
    return;
  }
  // The last row says how to reach a zone by keyboard; the rows above it scroll to keep the focus in view.
  const rows = Math.max(1, bottom - row - 1);
  if (tool.listFocus >= list.length) tool.listFocus = list.length - 1;
  if (tool.listFocus >= 0) {
    if (tool.listFocus < tool.listScroll) tool.listScroll = tool.listFocus;
    if (tool.listFocus >= tool.listScroll + rows) tool.listScroll = tool.listFocus - rows + 1;
  }
  tool.listScroll = Math.max(0, Math.min(tool.listScroll, list.length - rows));
  const env = { readers: ctx.readers, strings };
  const b = buildings(ctx);
  for (let k = tool.listScroll; k < list.length && k < tool.listScroll + rows; k += 1) {
    const id = list[k] as EntityId;
    const zone = b?.zone(id);
    const size = strings.get('ui.zone.list_size', { n: zone?.tiles.length ?? 0 });
    const sizeCols = drawnCols(s, size);
    const name = zone?.type === 'stockpile' ? stockpileName(env, id) : zoneTitle(env, id);
    label(s, col, row, name, { width: Math.max(1, width - sizeCols - 1) });
    label(s, col + width - sizeCols, row, size, { fg: t.dim, width: sizeCols });
    if (k === tool.listFocus) s.invert({ col, row, cols: width, rows: 1 });
    s.hit({ col, row, cols: width, rows: 1 }, () => onOpen(id));
    row += 1;
  }
  if (row < bottom) label(s, col, bottom - 1, strings.get('ui.zone.list_keys'), { fg: t.dim, width });
}

/**
 * The panel body (the title row is the sidebar's): the menu, or a selected zone's inspector in its
 * place (T-680). `onOpen` opens a zone of the menu's list; by default it selects the zone.
 */
export function drawZonesPanel(s: Surface, rect: Rect, tool: ZoneTool, ctx: PanelContext, onRemove?: () => void, onOpen?: (id: EntityId) => void): void {
  const t = s.theme;
  const strings = ctx.strings;
  let row = rect.row;
  if (tool.ownerOpen) { drawBuildingLines(s, rect, tool.ownerLines(ctx), tool.ownerPick); return; }
  if (!tool.inspects(ctx)) { drawZoneMenu(s, rect, tool, ctx, onOpen ?? ((id) => tool.selectZone(id))); return; }
  const text = `${acceleratorLabel('y', ctx.shiftLetters)} ${strings.get('ui.zone.types_action')}`;
  label(s, rect.col + 1, row, text, { width: rect.cols - 2 });
  s.hit({ col: rect.col + 1, row, cols: rect.cols - 2, rows: 1 }, () => tool.menu());
  row += 1;
  const b = buildings(ctx);
  const zone = b?.zone(tool.selected);
  if (b === null || zone === undefined) return;
  // The rule names the zone and its size: a name too long for it is cut, never the size.
  const size = strings.get('ui.zone.selected', { name: '', n: zone.tiles.length });
  separator(s, rect.col + 1, row, rect.cols - 2, strings.get('ui.zone.selected', { name: cutText(zoneName(ctx, zone), rect.cols - 7 - Array.from(size).length), n: zone.tiles.length }));
  row += 1;
  const bottom = rect.row + rect.rows - 1;
  if (zone.type === 'stockpile') { drawStockpileEditor(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool.stockpile, ctx, zone.id, zone.tiles.length); row = bottom; }
  else if (zone.type === 'farm_plot') row = drawFarmSettings(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool, ctx, zone);
  else if (zone.type === 'pasture') {
    // 08 § Pastures and feeding: the verdict first, so the sidebar never cuts it; then what it rests on.
    const feed = pastureFeed(ctx.readers, zone.id);
    if (feed !== null) {
      label(s, rect.col + 1, row, feedsText(strings, feed), { fg: overGrazed(feed) ? t.alert : t.value, width: rect.cols - 2 });
      row += 1;
      for (const line of wrapText(feedDetailText(strings, feed), rect.cols - 2, 2)) {
        if (row < bottom) label(s, rect.col + 1, row, line, { fg: t.dim, width: rect.cols - 2 });
        row += 1;
      }
      if (feed.animals === 0 && row < bottom) {
        label(s, rect.col + 1, row, strings.get('ui.zone.pasture.put_here'), { fg: t.dim, width: rect.cols - 2 });
        row += 1;
      }
    }
  } else if (zone.type === 'hospital') {
    row = drawHospitalSettings(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool, ctx, zone);
  } else if (zone.type === 'sanctum') {
    row = drawSanctumSettings(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool, ctx, zone);
  } else if (zone.type === 'compost') {
    // 13 § The compost heap: what lies on it waiting to turn.
    if (row <= bottom) label(s, rect.col + 1, row, strings.get('ui.zone.compost_turning', { n: compostWaiting(ctx, zone) }), { fg: t.value, width: rect.cols - 2 });
    row += 1;
  } else {
    row = drawRoomSettings(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool, ctx, zone);
  }
  if (row <= bottom) {
    const text = strings.get(zone.type === 'stockpile' ? 'ui.zone.stockpile_actions' : 'ui.zone.actions');
    label(s, rect.col + 1, bottom, text, { width: rect.cols - 2 });
    // Keyboard and mouse reach the same actions (24 § Input model): the accelerators are clickable.
    accelerator(s, rect.col + 1, bottom, rect.cols - 2, text, zone.type === 'stockpile' ? 'Del' : 'x', () => onRemove?.());
    accelerator(s, rect.col + 1, bottom, rect.cols - 2, text, 'e', () => { tool.resizing = true; });
  }
}

function drawFarmSettings(s: Surface, rect: Rect, tool: ZoneTool, ctx: PanelContext, zone: ZoneView): number {
  const plants = ctx.readers.has('07') ? ctx.readers.of<PlantsReader>('07') : null;
  if (plants === null) return rect.row;
  const settings = plants.plotSettings(zone.id);
  const options = tool.farmOptions(ctx);
  const highlighted = tool.farmRow(ctx);
  const t = s.theme;
  let row = rect.row;
  for (let season = 0; season < 4; season += 1) {
    if (row >= rect.row + rect.rows) break;
    const id = settings[season] ?? 0;
    const plant = id === 0 ? undefined : ctx.registry.table<PlantRow>('plants').byIndex(id);
    const here = season === highlighted;
    if (here) s.text(rect.col, row, '►', t.value);
    label(s, rect.col + 1, row, seasonName(ctx.strings, SEASON_NAMES[season] ?? ''), { width: 8, ...(here ? { fg: t.value } : {}) });
    const menu = tool.farmMenus[season] as DropdownState;
    const used = dropdown(s, rect.col + 9, row, 18, plant?.name ?? 'none', options, menu,
      (choice) => { menu.open = false; ctx.submit({ type: 'SetPlotCrop', zoneId: zone.id, season, speciesId: choice === '0' ? 0 : choice }); },
      () => { for (const m of tool.farmMenus) m.open = false; menu.open = true; menu.highlighted = Math.max(0, options.findIndex((o) => o.id === (plant?.id ?? '0'))); tool.farmSeason = season; },
      Math.max(18, rect.cols - 10));
    if (plant !== undefined) {
      const seed = tool.seedsOf(ctx, plant);
      // The seeds in stock, after the crop and clear of its field: a count only, its meaning in the tooltip.
      const n = label(s, rect.col + 28, row, ctx.strings.get('ui.zone.farm_seeds', { n: seed }), { fg: seed === 0 ? t.bad : t.value, width: Math.max(1, rect.cols - 29) });
      s.tooltip({ col: rect.col + 28, row, cols: n, rows: 1 }, ctx.strings.get('ui.zone.farm_seeds_tip', { n: seed }));
    }
    row += used;
  }
  const cropIds = plants.crops().filter((id) => plants.cropInfo(id)?.plotZoneId === zone.id);
  const ready = cropIds.filter((id) => (plants.cropInfo(id)?.stage ?? 0) === 3).length;
  if (row < rect.row + rect.rows) {
    const crops = ctx.strings.get('ui.zone.farm_crops', { growing: cropIds.length - ready, ripe: ready, empty: Math.max(0, zone.tiles.length - cropIds.length) });
    row += wrapLabel(s, rect.col + 1, row, crops, { width: rect.cols - 2, indent: 2, maxRows: Math.max(1, rect.row + rect.rows - row) });
  } else row += 1;
  // `07` § Fertilizer: the plot's setting and the fertilizer in stock; a click turns it on or off.
  if (row < rect.row + rect.rows) {
    const on = plants.plotFertilize(zone.id);
    const stock = ctx.readers.has('13') ? ctx.readers.of<ItemsReader>('13').countMatching({ tag: 'fertilizer' }) : 0;
    const n = label(s, rect.col + 1, row, ctx.strings.get(on ? 'ui.zone.farm_fertilize_on' : 'ui.zone.farm_fertilize_off', { n: stock }), { fg: on ? t.value : t.dim, width: rect.cols - 2 });
    s.hit({ col: rect.col + 1, row, cols: n, rows: 1 }, () => tool.farmFertilize(ctx));
  }
  row += 1;
  row = drawFarmCold(s, { col: rect.col, row, cols: rect.cols, rows: rect.row + rect.rows - row }, ctx, zone, plants);
  row = drawFarmLate(s, { col: rect.col, row, cols: rect.cols, rows: rect.row + rect.rows - row }, ctx, zone, plants);
  for (const key of ['ui.zone.farm_keys1', 'ui.zone.farm_keys2', 'ui.zone.farm_keys3']) {
    if (row >= rect.row + rect.rows) break;
    const text = ctx.strings.get(key);
    label(s, rect.col + 1, row, text, { fg: t.dim, width: rect.cols - 2 });
    accelerator(s, rect.col + 1, row, rect.cols - 2, text, 'a', () => tool.farmAllSeasons(ctx, tool.farmRow(ctx)));
    accelerator(s, rect.col + 1, row, rect.cols - 2, text, 'w', () => tool.farmFertilize(ctx));
    row += 1;
  }
  return row;
}

/**
 * `07` § Player-facing behavior: the tiles of the plot below the minimum temperature of the crop
 * standing on them, or of the current season's choice when a tile is empty, with the species that
 * has most of them. Draws nothing when no tile is too cold.
 */
function drawFarmCold(s: Surface, rect: Rect, ctx: PanelContext, zone: ZoneView, plants: PlantsReader): number {
  if (!ctx.readers.has('05')) return rect.row;
  const materials = ctx.readers.of<MaterialsReader>('05');
  const chosen = plants.plotSettings(zone.id)[ctx.readers.calendar.season] ?? 0;
  const cold = new Map<string, { row: PlantRow; n: number }>();
  for (const tile of zone.tiles) {
    const crop = plants.cropAt(tile);
    const info = crop === 0 ? undefined : plants.cropInfo(crop);
    const plant = info === undefined ? (chosen === 0 ? undefined : plants.def(chosen)) : plants.def(info.species);
    if (plant === undefined || materials.temperatureAt(tile) >= plant.minC) continue;
    const entry = cold.get(plant.id);
    if (entry === undefined) cold.set(plant.id, { row: plant, n: 1 });
    else entry.n += 1;
  }
  let worst: { row: PlantRow; n: number } | undefined;
  for (const entry of cold.values()) if (worst === undefined || entry.n > worst.n) worst = entry;
  if (worst === undefined) return rect.row;
  const t = s.theme;
  const text = ctx.strings.get('ui.zone.farm_cold', { n: worst.n, m: zone.tiles.length, min: worst.row.minC, name: worst.row.name });
  const help = ctx.strings.get('ui.zone.farm_cold_help', { depth: NEAR_SURFACE_DEPTH });
  const lines = [...wrapText(text, rect.cols - 2, 2).map((line) => ({ line, fg: t.bad })), ...wrapText(help, rect.cols - 2, 2).map((line) => ({ line, fg: t.dim }))];
  let row = rect.row;
  for (const { line, fg } of lines) {
    if (row >= rect.row + rect.rows) break;
    label(s, rect.col + 1, row, line, { fg, width: rect.cols - 2 });
    row += 1;
  }
  return row;
}

/**
 * `07` § Player-facing behavior (T-516): on a surface plot, a red note for each season whose crop
 * cannot ripen before its growing seasons end (`ripeningOutlook`, the reckoning the three-year
 * script sows by): the current season's crop sown today, and every other season's crop sown on that
 * season's first day, so a `Shift+A` that gives summer strawberries or autumn turnips says so.
 * Draws nothing when every chosen crop ripens.
 */
/** 07 § Under a skylight: every tile of the plot is skylit, so its crops keep no seasons. */
function allSkylit(map: { flagsAt(i: TileIndex): number }, tiles: readonly TileIndex[]): boolean {
  return tiles.length > 0 && tiles.every((t) => (map.flagsAt(t) & TileFlag.Skylit) !== 0);
}

function drawFarmLate(s: Surface, rect: Rect, ctx: PanelContext, zone: ZoneView, plants: PlantsReader): number {
  if (plants.plotKind(zone.id) !== 'surface') return rect.row;
  // 07 § Under a skylight: a plot all under glass keeps no seasons, so nothing is late.
  const map = ctx.readers.map;
  if (allSkylit(map, zone.tiles)) return rect.row;
  const settings = plants.plotSettings(zone.id);
  const calendar = ctx.readers.calendar;
  const seasonNames = ['spring', 'summer', 'autumn', 'winter'];
  const order = [calendar.season, ...[0, 1, 2, 3].filter((season) => season !== calendar.season)];
  const texts: string[] = [];
  for (const season of order) {
    const id = settings[season] ?? 0;
    const plant = id === 0 ? undefined : plants.def(id);
    if (plant === undefined || plant.kind !== 'crop') continue;
    const now = season === calendar.season;
    const outlook = ripeningOutlook(plant, season, now ? calendar.dayOfSeason : 1);
    if (outlook.ripens) continue;
    const params = { name: plant.name, need: outlook.needDays, left: outlook.leftDays, season: seasonNames[season] as string };
    texts.push(ctx.strings.get(now ? 'ui.zone.farm_late' : 'ui.zone.farm_late_season', params));
  }
  const t = s.theme;
  let row = rect.row;
  for (const line of texts.flatMap((text) => wrapText(text, rect.cols - 2, 4))) {
    if (row >= rect.row + rect.rows) break;
    label(s, rect.col + 1, row, line, { fg: t.bad, width: rect.cols - 2 });
    row += 1;
  }
  return row;
}

/** Current room facts, including furniture names and the same border as the room score. */
function drawRoomSettings(s: Surface, rect: Rect, tool: ZoneTool, ctx: PanelContext, zone: ZoneView): number {
  const b = buildings(ctx);
  const score = b?.roomScore(zone.id);
  const diagnostics = b?.roomDiagnostics(zone.id);
  if (score === undefined || diagnostics === undefined) return rect.row;
  const strings = ctx.strings;
  const col = rect.col + 1;
  const width = rect.cols - 2;
  let row = rect.row;
  const tiers = ctx.registry.table<{ id: string; tier: number }>('roomTiers');
  const tierId = tiers.ids().find((id) => tiers.byId(id)?.tier === score.tier) ?? '';
  label(s, col, row++, strings.get('ui.zone.room', { tier: strings.get(`ui.room_tier.${tierId}`), score: Math.floor(score.score) }), { width });
  const p = score.parts;
  // Each line gives a fact: one too long for the panel wraps under itself (a count kept with its word).
  row += wrapLabel(s, col, row, strings.get('ui.zone.room_parts', { tiles: Math.floor(p.tiles), walls: Math.floor(p.walls), furniture: Math.floor(p.furniture), size: p.size }), { width, indent: 2, fg: s.theme.dim });
  row += wrapLabel(s, col, row, strings.get(score.enclosed ? 'ui.zone.enclosed' : 'ui.zone.open', { n: diagnostics.openBorder.length }), { width, indent: 2, fg: score.enclosed ? s.theme.good : s.theme.bad });
  // 25 § The sanctum: a sanctum with no glowcap says what it lacks in place of "Requirements met" (`sanctumLines`).
  if (diagnostics.missing.length === 0 && !(zone.type === 'sanctum' && sanctumGlowcap(ctx) === 0)) label(s, col, row++, strings.get('ui.zone.requirements_met'), { width, fg: s.theme.good });
  else for (const missing of diagnostics.missing) row += wrapLabel(s, col, row, strings.get(`ui.zone.needs.${missing}`), { width, indent: 2, fg: s.theme.bad });
  if (zone.type === 'bedroom') {
    const ownerId = b?.ownerOf(zone.id) ?? 0;
    const owner = ownerId === 0 ? strings.get('ui.zone.nobody') : nameOf(ctx, ownerId);
    label(s, col, row++, strings.get('ui.zone.owner', { name: owner }), { width });
    const caption = `${acceleratorLabel('o', ctx.shiftLetters)} ${strings.get('ui.building.owner_caption')}`;
    label(s, col, row, caption, { width });
    s.hit({ col, row: row++, cols: width, rows: 1 }, () => tool.startOwner(ctx));
  }
  return row;
}

/** "one session in 17": a per-mille chance in words. */
function oneIn(ctx: PanelContext, permille: number): string {
  return ctx.strings.get('ui.zone.one_in', { n: Math.max(1, Math.round(1000 / Math.max(1, permille))) });
}

/** The glowcap the apprentices can eat (13's available stock of `glowcap`). */
function sanctumGlowcap(ctx: PanelContext): number {
  return items(ctx)?.available('glowcap') ?? 0;
}

/** A glowcap crop stands on some plot (07): the sanctum's stock is being grown. */
function glowcapGrowing(ctx: PanelContext): boolean {
  if (!ctx.readers.has('07')) return false;
  const plants = ctx.readers.of<PlantsReader>('07');
  return plants.crops().some((id) => plants.cropInfo(id)?.species === 'glowcap');
}

export interface SanctumLine {
  readonly text: string;
  readonly tone: 'text' | 'dim' | 'value' | 'bad';
}

/**
 * 25's sanctum panel (`ui-screens/panels.md` § Zones): the glowcap in stock, the chance of a
 * mishap here, each apprentice's level, rune and sessions left today with its own chance, and the
 * last mishap. The room's tier and requirements come first, as in every room.
 */
export function sanctumLines(ctx: PanelContext, zone: ZoneView): SanctumLine[] {
  if (!ctx.readers.has('25')) return [];
  const magic = ctx.readers.of<MagicReader>('25');
  const strings = ctx.strings;
  const out: SanctumLine[] = [];
  const stock = sanctumGlowcap(ctx);
  // No glowcap: where it comes from. Glowcap that no plot grows: how long it lasts.
  if (stock === 0) out.push({ text: strings.get('ui.zone.sanctum_no_glowcap'), tone: 'bad' });
  else if (!glowcapGrowing(ctx)) out.push({ text: strings.get('ui.zone.sanctum_glowcap_lasts', { n: stock }), tone: 'text' });
  else out.push({ text: strings.get('ui.zone.sanctum_glowcap', { n: stock }), tone: 'text' });
  out.push({ text: strings.get('ui.zone.sanctum_chance', { chance: oneIn(ctx, magic.mishapPermille(zone.id, 0)) }), tone: 'dim' });
  const apprentices = magic.apprentices(zone.id);
  if (apprentices.length === 0) out.push({ text: strings.get('ui.zone.no_apprentices'), tone: 'dim' });
  const skill = ctx.registry.table('skills').index('runecraft');
  for (const id of apprentices) {
    const level = (ctx.readers.entities.get(id, C.Skills)?.level[skill] ?? 0) as number;
    const rune = magic.rune(id);
    out.push({ text: strings.get('ui.zone.apprentice', { name: nameOf(ctx, id), level, current: Math.floor((rune?.current ?? 0) / 1000), max: Math.floor((rune?.max ?? 0) / 1000) }), tone: 'value' });
    out.push({ text: strings.get('ui.zone.apprentice_sessions', { n: Math.max(0, ATTUNE_SESSIONS_PER_DAY - magic.sessionsToday(id)), chance: oneIn(ctx, magic.mishapPermille(zone.id, id)) }), tone: 'dim' });
  }
  const last = magic.lastMishap(zone.id);
  if (last === undefined) out.push({ text: strings.get('ui.zone.no_mishap'), tone: 'dim' });
  else {
    const days = Math.floor((ctx.readers.calendar.tick - last.tick) / TICKS_PER_DAY);
    const when = days === 0 ? strings.get('ui.zone.today') : strings.get('ui.zone.days_ago', { n: days });
    out.push({ text: strings.get('ui.zone.last_mishap', { kind: strings.get(`ui.zone.mishap.${last.kind}`), name: nameOf(ctx, last.dwarfId), when }), tone: 'text' });
  }
  return out;
}

function drawSanctumSettings(s: Surface, rect: Rect, tool: ZoneTool, ctx: PanelContext, zone: ZoneView): number {
  let row = drawRoomSettings(s, rect, tool, ctx, zone);
  const bottom = rect.row + rect.rows;
  const col = rect.col + 1;
  const width = rect.cols - 2;
  const tones = { text: s.theme.text, dim: s.theme.dim, value: s.theme.value, bad: s.theme.bad };
  for (const line of sanctumLines(ctx, zone)) {
    if (row >= bottom) return row;
    // A line too long for the panel wraps under itself.
    row += wrapLabel(s, col, row, line.text, { width, indent: 2, fg: tones[line.tone], maxRows: bottom - row });
  }
  if (row < bottom) {
    const caption = `${acceleratorLabel('o', ctx.shiftLetters)} ${ctx.strings.get('ui.zone.apprentices_caption')}`;
    label(s, col, row, caption, { width });
    s.hit({ col, row: row++, cols: width, rows: 1 }, () => tool.startOwner(ctx));
  }
  return row;
}

/** The built beds (any `sleep` building) standing on a zone's tiles. */
function bedsIn(b: BuildingsReader, tiles: readonly TileIndex[]): number {
  const sleep = new Set(b.types().filter((row) => row.tags.includes('sleep')).map((row) => row.id));
  const ids = new Set(tiles.map((tile) => b.at(tile)).filter((id) => id !== 0));
  let n = 0;
  for (const id of ids) {
    const view = b.get(id);
    if (view !== undefined && view.state === 'built' && sleep.has(view.typeId)) n += 1;
  }
  return n;
}

/**
 * 17 § Player-facing behavior: the hospital's Beds line against the living dwarves, "Beds: 1 for 80
 * dwarves (aim for 1 in 10)", counting every hospital's beds when there are several; `short` while
 * the beds × `HOSPITAL_BEDS_PER` are fewer than the dwarves.
 */
export function hospitalBedsLine(ctx: PanelContext, zone: ZoneView): { readonly text: string; readonly short: boolean } {
  const b = buildings(ctx);
  if (b === null) return { text: '', short: false };
  const here = bedsIn(b, zone.tiles);
  const hospitals = b.zonesOfType('hospital');
  const all = hospitals.reduce((n, id) => n + (id === zone.id ? here : bedsIn(b, b.zone(id)?.tiles ?? [])), 0);
  const n = dwarvesOf(ctx).length;
  const params = { beds: here, all, n, per: HOSPITAL_BEDS_PER };
  const text = ctx.strings.get(hospitals.length > 1 ? 'ui.zone.hospital.beds_all' : 'ui.zone.hospital.beds', params);
  return { text, short: all * HOSPITAL_BEDS_PER < n };
}

/**
 * 17 § Player-facing behavior: every dwarf under care, wherever it lies, this hospital's own first:
 * "Kari Veinspark · in a bed in Bedroom #3 (14,17,z28) · stop_bleeding". Ascending id within each.
 */
export function hospitalPatientLines(ctx: PanelContext, zone: ZoneView): string[] {
  const s = ctx.strings;
  const entities = ctx.readers.entities;
  const env = { readers: ctx.readers, registry: ctx.registry, strings: s };
  const map = ctx.readers.map;
  const b = buildings(ctx);
  const patients = entities.with(C.Patient).filter((id) => entities.get(id, C.Creature)?.faction === 'fortress');
  const here = (id: EntityId): boolean => entities.get(id, C.Patient)?.hospitalZoneId === zone.id;
  const ordered = [...patients.filter(here), ...patients.filter((id) => !here(id))];
  return ordered.map((id) => {
    const p = entities.get(id, C.Patient);
    const name = entities.get(id, C.Creature)?.name ?? s.get('ui.zone.hospital.a_patient');
    const needs = p !== undefined && p.needs.length > 0 ? p.needs.join(', ') : s.get('ui.zone.hospital.resting');
    if (here(id)) return s.get('ui.zone.hospital.patient', { name, needs });
    const pos = entities.get(id, C.Position);
    const coords = pos === undefined ? { x: 0, y: 0, z: 0 } : { x: pos.x, y: pos.y, z: pos.z };
    const tile = pos === undefined ? -1 : map.index(pos.x, pos.y, pos.z);
    const place = itemPlace(env, tile);
    const inBed = p !== undefined && p.bedId !== 0 && b?.get(p.bedId)?.state === 'built';
    const where = s.get(inBed ? 'ui.zone.hospital.where.bed' : 'ui.zone.hospital.where.lying', { place, ...coords });
    return s.get('ui.zone.hospital.patient_at', { name, where, needs });
  });
}

function drawHospitalSettings(s: Surface, rect: Rect, tool: ZoneTool, ctx: PanelContext, zone: ZoneView): number {
  const t = s.theme;
  const b = buildings(ctx);
  let row = rect.row;
  const bottom = rect.row + rect.rows;

  if (b !== null) {
    row = drawRoomSettings(s, rect, tool, ctx, zone);

    // The beds against the living dwarves, then the other furniture.
    const beds = hospitalBedsLine(ctx, zone);
    row += wrapLabel(s, rect.col + 1, row, beds.text, { width: rect.cols - 2, indent: 2, fg: beds.short ? t.alert : t.text, maxRows: Math.max(1, bottom - row) });
    const uniqueBuildingIds = Array.from(new Set(zone.tiles.map((tile) => b.at(tile)).filter((id) => id !== 0)));
    let traction = 0;
    let chests = 0;
    for (const bId of uniqueBuildingIds) {
      const bv = b.get(bId);
      if (!bv) continue;
      if (bv.typeId === 'traction_bench') traction += 1;
      else if (bv.typeId === 'chest') chests += 1;
    }
    if (row < bottom) {
      label(s, rect.col + 1, row, ctx.strings.get('ui.zone.hospital.furniture', { traction, chests }), { width: rect.cols - 2 });
      row += 1;
    }
  }

  // Wanted supplies
  const currentWants = hospitalWants(ctx, zone.id);
  // Each supply's setting key and item; its name is `ui.zone.hospital.supply.<key>`.
  const suppliesList: readonly { key: string; item: string }[] = [
    { key: 'cloth', item: 'cloth' },
    { key: 'bandages', item: 'bandage' },
    { key: 'thread', item: 'thread' },
    { key: 'splints', item: 'splint' },
    { key: 'crutches', item: 'crutch' },
    { key: 'brightleaf', item: 'brightleaf' },
    { key: 'buckets', item: 'bucket' },
    { key: 'honey', item: 'honey' },
    { key: 'soap', item: 'soap' },
  ];

  // 17: with no bandage or cloth to be had anywhere in the fortress, no bleeding wound can be bandaged.
  if (noDressingToBeHad(ctx)) {
    for (const line of wrapText(ctx.strings.get('ui.zone.hospital.no_dressing'), rect.cols - 2, 2)) {
      if (row >= bottom) break;
      label(s, rect.col + 1, row, line, { fg: t.alert, width: rect.cols - 2 });
      row += 1;
    }
  }

  if (row < bottom) {
    label(s, rect.col + 1, row, ctx.strings.get('ui.zone.hospital.supplies'), { fg: t.key, width: rect.cols - 2 });
    row += 1;
  }

  for (const sup of suppliesList) {
    if (row >= bottom) break;
    const currentCount = zoneHolds(ctx, zone.tiles, sup.item);
    const wanted = currentWants[sup.key] ?? currentWants[sup.item] ?? 0;
    const lineText = ctx.strings.get('ui.zone.hospital.supply', { supply: ctx.strings.get(`ui.zone.hospital.supply.${sup.key}`), current: currentCount, wanted });
    // The two buttons end at the right edge and take the cells their names are drawn in.
    const plusCol = rect.col + rect.cols - 1 - drawnCols(s, '[+]');
    const minusCol = plusCol - drawnCols(s, '[-]');
    label(s, rect.col + 1, row, lineText, { width: minusCol - rect.col - 1 });
    // Minus button [-]
    const minusWidth = label(s, minusCol, row, '[-]');
    s.hit({ col: minusCol, row, cols: minusWidth, rows: 1 }, () => {
      const nextWants = { ...currentWants, [sup.key]: Math.max(0, wanted - 1) };
      ctx.submit({ type: 'SetHospitalSupplies', zoneId: zone.id, wants: nextWants });
    });
    // Plus button [+]
    const plusWidth = label(s, plusCol, row, '[+]');
    s.hit({ col: plusCol, row, cols: plusWidth, rows: 1 }, () => {
      const nextWants = { ...currentWants, [sup.key]: wanted + 1 };
      ctx.submit({ type: 'SetHospitalSupplies', zoneId: zone.id, wants: nextWants });
    });
    row += 1;
  }

  // Patients: every dwarf under care, wherever it lies, this hospital's first.
  if (row < bottom) {
    label(s, rect.col + 1, row, ctx.strings.get('ui.zone.hospital.patients'), { fg: t.key, width: rect.cols - 2 });
    row += 1;
    const lines = hospitalPatientLines(ctx, zone);
    if (lines.length === 0) {
      label(s, rect.col + 2, row, ctx.strings.get('ui.zone.hospital.no_patients'), { fg: t.dim, width: rect.cols - 3 });
      row += 1;
    } else {
      for (const line of lines) {
        if (row >= bottom) break;
        row += wrapLabel(s, rect.col + 2, row, line, { width: rect.cols - 3, indent: 2, maxRows: Math.max(1, bottom - row) });
      }
    }
  }

  return row;
}
