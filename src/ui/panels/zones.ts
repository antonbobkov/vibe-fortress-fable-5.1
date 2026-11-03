/**
 * The zones tool and panel: `ui-screens/panels.md` § Zones, `14` § Player-facing behavior ("Zones
 * menu (hotkey `z`): type → drag → confirm; the zone panel shows settings and, for rooms, the
 * quality breakdown"), `13` § Player-facing behavior (the stockpile filter editor "with the
 * category tree (checkboxes with tri-state for partial subtrees) …; Presets: Food, Drink, Seeds,
 * Stone, Ore and bars, Wood, Furniture, Weapons and armor, Cloth and leather, Crafts and gems,
 * Refuse, Corpses, Everything").
 *
 * A dragged rectangle submits `CreateZone` with the tiles that qualify and lie in no other zone
 * (D-071: the command refuses a rectangle whole). With no type chosen, a click on a zoned tile
 * selects that zone. `e` makes the next rectangle resize the selected zone; `x` removes it.
 */

import type { Command } from '@core/commands';
import type { StockpileFilter } from '@core/components';
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { ZoneView } from '@systems/buildings';
import type { PlantsReader } from '@systems/plants';
import type { AnimalsReader } from '@systems/animals';
import { GRASS_PER_GRAZER } from '@systems/animals/constants';
import type { PlantRow } from '@systems/plants';
import { seasonAllows } from '@systems/plants/growth';
import { lightMatches } from '@systems/plants/plots';
import type { ItemsReader } from '@systems/items';
import { HOSPITAL_DEFAULT_SUPPLIES } from '@systems/health/constants';
import type { MagicReader } from '@systems/magic';
import type { MaterialsReader } from '@systems/materials';
import { NEAR_SURFACE_DEPTH } from '@systems/materials/constants';
import { ATTUNE_SESSIONS_PER_DAY, SANCTUM_APPRENTICES } from '@systems/magic/constants';
import { TICKS_PER_DAY } from '@core/constants';
import { dropdown, dropdownKey, type DropdownOption, type DropdownState } from '../widgets';
import type { KeyPress } from '@platform/input';
import { C } from '@core/components';
import type { Surface } from '../surface';
import { drawnCols, keyCells, label, separator, toggleNode, type TreeNode, type ListState } from '../widgets';
import { acceleratorLabel } from '../keymap';
import { accel, buildings, items, type PanelContext } from './context';
import { rectTiles, type TilePoint } from './designate';
import { stockpilePreset, wrapText, zoneEditorMessage } from '../messages';
import { drawBuildingLines, ownerPickLines, type BuildingLine } from './building';
import { dwarvesOf, nameOf } from './units';
import { drawStockpileEditor, StockpileEditor, PRESET_ORDER } from './stockpile-editor';

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
  /** `e`: the next rectangle resizes the selected zone. */
  resizing = false;
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

  get active(): boolean {
    return this.kind !== null || this.resizing;
  }

  cancel(): void {
    this.kind = null;
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
    const adults = dwarvesOf(ctx).filter((id) => !(ctx.readers.has('10') && ctx.readers.of<{ isChild(id: EntityId): boolean }>('10').isChild(id)));
    const help = ctx.strings.get('ui.zone.apprentices_help', { n: SANCTUM_APPRENTICES });
    return [
      { id: 'title', text: ctx.strings.get('ui.zone.apprentices_title', { zone: name, n: current.length, max: SANCTUM_APPRENTICES }), tone: 'value' },
      ...adults.map((id) => ({
        id: `apprentice:${id}`,
        text: `${current.includes(id) ? '● ' : '○ '}${nameOf(ctx, id)}`,
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
    if (accel(ctx, key) === 'y') { this.selected = 0; this.cancel(); return true; }
    return false;
  }

  choose(key: string): boolean {
    const k = ZONE_KINDS.find((z) => z.key === key);
    if (k === undefined) return false;
    this.kind = k.id;
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
    return [{ id: '0', label: 'none' }, ...ctx.registry.table<PlantRow>('plants').rows
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
    if (key.shift && accel(ctx, key) === 'a') { this.farmAllSeasons(ctx, season); return true; }
    return false;
  }

  /** The crop set for a season of the selected plot, if any. */
  private cropOf(ctx: PanelContext, season: number): PlantRow | undefined {
    const id = ctx.readers.of<PlantsReader>('07').plotSettings(this.selected)[season] ?? 0;
    return id === 0 ? undefined : ctx.registry.table<PlantRow>('plants').byIndex(id);
  }

  /** `Shift+A`: the crop of a season, for every season in which that crop can grow. */
  farmAllSeasons(ctx: PanelContext, season: number): void {
    const plant = this.cropOf(ctx, season);
    for (let target = 0; target < 4; target += 1) {
      if (target === season || (plant !== undefined && !seasonAllows(plant, plant.kind === 'cave_crop', target))) continue;
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
    if (id !== this.selected) { this.ownerOpen = false; this.stockpile.reset(); }
    this.selected = id;
    return true;
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

/** "Farm plot #3": the zone's ordinal among the zones of its type. */
function zoneName(ctx: PanelContext, zone: ZoneView): string {
  const n = (buildings(ctx)?.zonesOfType(zone.type) ?? []).indexOf(zone.id) + 1;
  return `${ctx.strings.get(`ui.zone.type.${zone.type}`)} #${n}`;
}

/** The panel body (the title row is the sidebar's). */
export function drawZonesPanel(s: Surface, rect: Rect, tool: ZoneTool, ctx: PanelContext, onRemove?: () => void): void {
  const t = s.theme;
  const strings = ctx.strings;
  let row = rect.row;
  if (tool.ownerOpen) { drawBuildingLines(s, rect, tool.ownerLines(ctx), tool.ownerPick); return; }
  const selectedZone = buildings(ctx)?.zone(tool.selected);
  const inspector = !tool.active && selectedZone !== undefined && (selectedZone.type === 'stockpile' || buildings(ctx)?.roomScore(selectedZone.id) !== undefined);
  if (inspector) {
    const text = `${acceleratorLabel('y', ctx.panelLetters)} ${strings.get('ui.zone.types_action')}`;
    label(s, rect.col + 1, row, text, { width: rect.cols - 2 });
    s.hit({ col: rect.col + 1, row, cols: rect.cols - 2, rows: 1 }, () => { tool.selected = 0; tool.cancel(); });
    row += 1;
  } else {
  const colW = Math.floor((rect.cols - 2) / 2);
  for (let k = 0; k < ZONE_KINDS.length; k += 2) {
    for (let j = 0; j < 2; j += 1) {
      const kind = ZONE_KINDS[k + j];
      if (kind === undefined) continue;
      const col = rect.col + 1 + j * colW;
      const n = label(s, col, row, `${acceleratorLabel(kind.key, ctx.panelLetters)} ${strings.get(`ui.zone.short.${kind.id}`)}`, { width: colW - 1 });
      if (tool.kind === kind.id) s.invert({ col, row, cols: n, rows: 1 });
      s.hit({ col, row, cols: n, rows: 1 }, () => void tool.choose(kind.key));
    }
    row += 1;
  }
  label(s, rect.col + 1, row, strings.get('ui.zone.help1'), { fg: t.dim, width: rect.cols - 2 });
  label(s, rect.col + 1, row + 1, strings.get('ui.zone.help2'), { fg: t.dim, width: rect.cols - 2 });
  row += 2;
  }
  const b = buildings(ctx);
  const zone = b?.zone(tool.selected);
  if (b === null || zone === undefined) return;
  separator(s, rect.col + 1, row, rect.cols - 2, strings.get('ui.zone.selected', { name: zoneName(ctx, zone), n: zone.tiles.length }));
  row += 1;
  const bottom = rect.row + rect.rows - 1;
  if (zone.type === 'stockpile') { drawStockpileEditor(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool.stockpile, ctx, zone.id, zone.tiles.length); row = bottom; }
  else if (zone.type === 'farm_plot') row = drawFarmSettings(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool, ctx, zone);
  else if (zone.type === 'pasture') {
    const animals = ctx.readers.has('08') ? ctx.readers.of<AnimalsReader>('08') : null;
    const plants = ctx.readers.has('07') ? ctx.readers.of<PlantsReader>('07') : null;
    const grass = zone.tiles.filter((tile) => plants?.hasGrass(tile)).length;
    const assigned = animals?.tameList().filter((id) => animals.pastureOf(id) === zone.id && animals.def(ctx.readers.entities.get(id, C.Creature)?.species ?? 0)?.diet === 'grazer').length ?? 0;
    label(s, rect.col + 1, row, `Capacity: ${grass} grass / ${assigned} grazers (${Math.floor(grass / GRASS_PER_GRAZER)} supported)`, { fg: assigned > grass / GRASS_PER_GRAZER ? t.bad : t.value, width: rect.cols - 2 });
    row += 1;
  } else if (zone.type === 'hospital') {
    row = drawHospitalSettings(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool, ctx, zone);
  } else if (zone.type === 'sanctum') {
    row = drawSanctumSettings(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool, ctx, zone);
  } else {
    row = drawRoomSettings(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool, ctx, zone);
  }
  if (row <= bottom) {
    const text = strings.get(zone.type === 'stockpile' ? 'ui.zone.stockpile_actions' : 'ui.zone.actions');
    label(s, rect.col + 1, bottom, text, { width: rect.cols - 2 });
    // Keyboard and mouse reach the same actions (24 § Input model): the accelerators are clickable.
    accelerator(s, rect.col + 1, bottom, rect.cols - 2, text, zone.type === 'stockpile' ? 'Del' : 'x', () => onRemove?.());
    accelerator(s, rect.col + 1, bottom, rect.cols - 2, text, 'S-e', () => { tool.resizing = true; });
  }
}

function drawFarmSettings(s: Surface, rect: Rect, tool: ZoneTool, ctx: PanelContext, zone: ZoneView): number {
  const plants = ctx.readers.has('07') ? ctx.readers.of<PlantsReader>('07') : null;
  if (plants === null) return rect.row;
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
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
    label(s, rect.col + 1, row, seasons[season] as string, { width: 8, ...(here ? { fg: t.value } : {}) });
    const menu = tool.farmMenus[season] as DropdownState;
    const used = dropdown(s, rect.col + 9, row, 18, plant?.name ?? 'none', options, menu,
      (choice) => { menu.open = false; ctx.submit({ type: 'SetPlotCrop', zoneId: zone.id, season, speciesId: choice === '0' ? 0 : choice }); },
      () => { for (const m of tool.farmMenus) m.open = false; menu.open = true; menu.highlighted = Math.max(0, options.findIndex((o) => o.id === (plant?.id ?? '0'))); tool.farmSeason = season; },
      Math.max(18, rect.cols - 10));
    if (plant !== undefined) {
      const seed = tool.seedsOf(ctx, plant);
      label(s, rect.col + 27, row, ctx.strings.get('ui.zone.farm_seeds', { n: seed }), { fg: seed === 0 ? t.bad : t.value, width: Math.max(1, rect.cols - 28) });
    }
    row += used;
  }
  const cropIds = plants.crops().filter((id) => plants.cropInfo(id)?.plotZoneId === zone.id);
  const ready = cropIds.filter((id) => (plants.cropInfo(id)?.stage ?? 0) === 3).length;
  if (row < rect.row + rect.rows) label(s, rect.col + 1, row, `Crops: ${cropIds.length - ready} growing, ${ready} ready, ${Math.max(0, zone.tiles.length - cropIds.length)} empty`, { width: rect.cols - 2 });
  row += 1;
  row = drawFarmCold(s, { col: rect.col, row, cols: rect.cols, rows: rect.row + rect.rows - row }, ctx, zone, plants);
  for (const key of ['ui.zone.farm_keys1', 'ui.zone.farm_keys2']) {
    if (row >= rect.row + rect.rows) break;
    const text = ctx.strings.get(key);
    label(s, rect.col + 1, row, text, { fg: t.dim, width: rect.cols - 2 });
    accelerator(s, rect.col + 1, row, rect.cols - 2, text, 'S-a', () => tool.farmAllSeasons(ctx, tool.farmRow(ctx)));
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
  label(s, col, row++, strings.get('ui.zone.room_parts', { tiles: Math.floor(p.tiles), walls: Math.floor(p.walls), furniture: Math.floor(p.furniture), size: p.size }), { width, fg: s.theme.dim });
  label(s, col, row++, strings.get(score.enclosed ? 'ui.zone.enclosed' : 'ui.zone.open', { n: diagnostics.openBorder.length }), { width, fg: score.enclosed ? s.theme.good : s.theme.bad });
  if (diagnostics.missing.length === 0) label(s, col, row++, strings.get('ui.zone.requirements_met'), { width, fg: s.theme.good });
  else for (const missing of diagnostics.missing) label(s, col, row++, strings.get(`ui.zone.needs.${missing}`), { width, fg: s.theme.bad });
  if (zone.type === 'bedroom') {
    const ownerId = b?.ownerOf(zone.id) ?? 0;
    const owner = ownerId === 0 ? strings.get('ui.zone.nobody') : nameOf(ctx, ownerId);
    label(s, col, row++, strings.get('ui.zone.owner', { name: owner }), { width });
    const caption = `${acceleratorLabel('o', ctx.panelLetters)} ${strings.get('ui.building.owner_caption')}`;
    label(s, col, row, caption, { width });
    s.hit({ col, row: row++, cols: width, rows: 1 }, () => tool.startOwner(ctx));
  }
  return row;
}

/** "one session in 17": a per-mille chance in words. */
function oneIn(ctx: PanelContext, permille: number): string {
  return ctx.strings.get('ui.zone.one_in', { n: Math.max(1, Math.round(1000 / Math.max(1, permille))) });
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
  const stock = items(ctx)?.available('glowcap') ?? 0;
  out.push({ text: strings.get('ui.zone.sanctum_glowcap', { n: stock }), tone: stock === 0 ? 'bad' : 'text' });
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
    label(s, col, row++, line.text, { width, fg: tones[line.tone] });
  }
  if (row < bottom) {
    const caption = `${acceleratorLabel('o', ctx.panelLetters)} ${ctx.strings.get('ui.zone.apprentices_caption')}`;
    label(s, col, row, caption, { width });
    s.hit({ col, row: row++, cols: width, rows: 1 }, () => tool.startOwner(ctx));
  }
  return row;
}

function drawHospitalSettings(s: Surface, rect: Rect, tool: ZoneTool, ctx: PanelContext, zone: ZoneView): number {
  const t = s.theme;
  const b = buildings(ctx);
  let row = rect.row;
  const bottom = rect.row + rect.rows;

  if (b !== null) {
    row = drawRoomSettings(s, rect, tool, ctx, zone);

    // Furniture in zone
    const uniqueBuildingIds = Array.from(new Set(zone.tiles.map((tile) => b.at(tile)).filter((id) => id !== 0)));
    let beds = 0;
    let traction = 0;
    let chests = 0;
    for (const bId of uniqueBuildingIds) {
      const bv = b.get(bId);
      if (!bv) continue;
      if (bv.typeId === 'bed') beds += 1;
      else if (bv.typeId === 'traction_bench') traction += 1;
      else if (bv.typeId === 'chest') chests += 1;
    }
    if (row < bottom) {
      label(s, rect.col + 1, row, `Beds: ${beds}  Traction: ${traction}  Chests: ${chests}`, { width: rect.cols - 2 });
      row += 1;
    }
  }

  // Wanted supplies
  const defaultWants = HOSPITAL_DEFAULT_SUPPLIES;
  const currentWants = ((zone.settings?.['desired supplies'] ?? zone.settings?.['wants'] ?? defaultWants) as Record<string, number>) ?? defaultWants;
  const suppliesList: readonly { key: string; item: string; label: string }[] = [
    { key: 'cloth', item: 'cloth', label: 'Cloth' },
    { key: 'thread', item: 'thread', label: 'Thread' },
    { key: 'splints', item: 'splint', label: 'Splints' },
    { key: 'crutches', item: 'crutch', label: 'Crutches' },
    { key: 'brightleaf', item: 'brightleaf', label: 'Brightleaf' },
    { key: 'buckets', item: 'bucket', label: 'Buckets' },
  ];

  if (row < bottom) {
    label(s, rect.col + 1, row, 'Supplies (current / wanted):', { fg: t.key, width: rect.cols - 2 });
    row += 1;
  }

  for (const sup of suppliesList) {
    if (row >= bottom) break;
    const currentCount = countHospitalSupplies(ctx, zone, sup.item);
    const wanted = currentWants[sup.key] ?? currentWants[sup.item] ?? 0;
    const lineText = `${sup.label}: ${currentCount}/${wanted}`;
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

  // Patients
  if (row < bottom) {
    label(s, rect.col + 1, row, 'Patients:', { fg: t.key, width: rect.cols - 2 });
    row += 1;
    const patients = ctx.readers.entities.with(C.Patient).filter((id) => {
      const p = ctx.readers.entities.get(id, C.Patient);
      return p && p.hospitalZoneId === zone.id;
    });
    if (patients.length === 0) {
      label(s, rect.col + 2, row, 'None', { fg: t.dim, width: rect.cols - 3 });
      row += 1;
    } else {
      for (const pId of patients) {
        if (row >= bottom) break;
        const name = ctx.readers.entities.get(pId, C.Creature)?.name ?? 'a patient';
        const p = ctx.readers.entities.get(pId, C.Patient);
        const needs = p && p.needs.length > 0 ? p.needs.join(', ') : 'resting';
        label(s, rect.col + 2, row, `${name}: ${needs}`, { width: rect.cols - 3 });
        row += 1;
      }
    }
  }

  return row;
}

function countHospitalSupplies(ctx: PanelContext, zone: ZoneView, typeName: string): number {
  const it = items(ctx);
  if (!it) return 0;
  const itemIdx = ctx.registry.table<{ id: string }>('items').index(typeName);
  if (itemIdx < 0) return 0;
  const b = buildings(ctx);
  let total = 0;
  for (const t of zone.tiles) {
    for (const itId of it.at(t)) {
      const item = it.get(itId);
      if (item && item.type === itemIdx) total += item.count;
      for (const innerId of it.inContainer(itId)) {
        const inner = it.get(innerId);
        if (inner && inner.type === itemIdx) total += inner.count;
      }
    }
    if (b) {
      const bId = b.at(t);
      if (bId !== 0) {
        const building = ctx.readers.entities.get(bId, C.Building);
        if (building && building.itemId !== 0) {
          for (const innerId of it.inContainer(building.itemId)) {
            const inner = it.get(innerId);
            if (inner && inner.type === itemIdx) total += inner.count;
          }
        }
      }
    }
  }
  return total;
}
