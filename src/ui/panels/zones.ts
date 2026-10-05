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
import { CATEGORY_TREE, STOCKPILE_PRESETS } from '@systems/items';
import type { ZoneView } from '@systems/buildings';
import type { PlantsReader } from '@systems/plants';
import type { AnimalsReader } from '@systems/animals';
import { GRASS_PER_GRAZER } from '@systems/animals/constants';
import type { PlantRow } from '@systems/plants';
import { HOSPITAL_DEFAULT_SUPPLIES } from '@systems/health/constants';
import { dropdown, dropdownKey, type DropdownOption, type DropdownState } from '../widgets';
import type { KeyPress } from '@platform/input';
import { C } from '@core/components';
import type { Surface } from '../surface';
import { buildTree, label, nodeState, separator, toggleNode, tree, type TreeNode, type TreeState } from '../widgets';
import { buildings, items, type PanelContext } from './context';
import { rectTiles, type TilePoint } from './designate';

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
];

/** The presets in the order 13 lists them. */
export const PRESET_ORDER: readonly string[] = Object.keys(STOCKPILE_PRESETS);

const MEETING_OVERLAPS = ['hearth_hall', 'dining_hall'];

/** A `[k]` accelerator inside a drawn action line, made clickable at its own cells. */
function accelerator(s: Surface, col: number, row: number, text: string, key: string, run: () => void): void {
  const at = text.indexOf(`[${key}]`);
  if (at < 0) return;
  s.hit({ col: col + at, row, cols: 3, rows: 1 }, run);
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
  readonly tree: TreeState = { selected: 0, scroll: 0, expanded: new Set<string>() };
  private forest: TreeNode[] | null = null;
  readonly farmMenus: DropdownState[] = Array.from({ length: 4 }, () => ({ open: false, highlighted: 0 }));
  farmSeason = 0;

  get active(): boolean {
    return this.kind !== null || this.resizing;
  }

  cancel(): void {
    this.kind = null;
    this.resizing = false;
    this.anchor = null;
    this.end = null;
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

  farmOptions(ctx: PanelContext): DropdownOption[] {
    const plants = ctx.readers.has('07') ? ctx.readers.of<PlantsReader>('07') : null;
    const kind = plants?.plotKind(this.selected);
    if (kind === undefined || kind === 'none' || kind === 'mixed') return [];
    return [{ id: '0', label: 'none' }, ...ctx.registry.table<PlantRow>('plants').rows
      .filter((p) => (p.kind === 'crop' || p.kind === 'cave_crop') && (p.light === 'any' || (kind === 'surface' ? p.light === 'sun' : p.light === 'dark')))
      .map((p) => ({ id: p.id, label: p.name }))];
  }

  farmKey(ctx: PanelContext, key: KeyPress): boolean {
    const menu = this.farmMenus[this.farmSeason] as DropdownState;
    if (!menu.open) return false;
    const result = dropdownKey(menu, this.farmOptions(ctx), key);
    if (result === null) return false;
    if (result !== 'handled') ctx.submit({ type: 'SetPlotCrop', zoneId: this.selected, season: this.farmSeason, speciesId: result === '0' ? 0 : result });
    return true;
  }

  categories(): TreeNode[] {
    if (this.forest === null) this.forest = buildTree(CATEGORY_TREE);
    return this.forest;
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
    for (const name of PRESET_ORDER) {
      const p = STOCKPILE_PRESETS[name] as { categories: readonly string[]; allowRot: boolean };
      const cats = [...p.categories].sort();
      const have = [...f.categories].sort();
      if (cats.length === have.length && cats.every((c, k) => have[k] === c) && p.allowRot === f.allowRot) return name;
    }
    return null;
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
  const colW = Math.floor((rect.cols - 2) / 2);
  for (let k = 0; k < ZONE_KINDS.length; k += 2) {
    for (let j = 0; j < 2; j += 1) {
      const kind = ZONE_KINDS[k + j];
      if (kind === undefined) continue;
      const col = rect.col + 1 + j * colW;
      const n = label(s, col, row, `[${kind.key}] ${strings.get(`ui.zone.type.${kind.id}`)}`, { width: colW });
      if (tool.kind === kind.id) s.invert({ col, row, cols: n, rows: 1 });
      s.hit({ col, row, cols: n, rows: 1 }, () => void tool.choose(kind.key));
    }
    row += 1;
  }
  label(s, rect.col + 1, row, strings.get('ui.zone.help1'), { fg: t.dim, width: rect.cols - 2 });
  label(s, rect.col + 1, row + 1, strings.get('ui.zone.help2'), { fg: t.dim, width: rect.cols - 2 });
  row += 2;
  const b = buildings(ctx);
  const zone = b?.zone(tool.selected);
  if (b === null || zone === undefined) return;
  separator(s, rect.col + 1, row, rect.cols - 2, strings.get('ui.zone.selected', { name: zoneName(ctx, zone), n: zone.tiles.length }));
  row += 1;
  const bottom = rect.row + rect.rows - 1;
  if (zone.type === 'stockpile') row = drawStockpileSettings(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool, ctx, zone);
  else if (zone.type === 'farm_plot') row = drawFarmSettings(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, tool, ctx, zone);
  else if (zone.type === 'pasture') {
    const animals = ctx.readers.has('08') ? ctx.readers.of<AnimalsReader>('08') : null;
    const plants = ctx.readers.has('07') ? ctx.readers.of<PlantsReader>('07') : null;
    const grass = zone.tiles.filter((tile) => plants?.hasGrass(tile)).length;
    const assigned = animals?.tameList().filter((id) => animals.pastureOf(id) === zone.id && animals.def(ctx.readers.entities.get(id, C.Creature)?.species ?? 0)?.diet === 'grazer').length ?? 0;
    label(s, rect.col + 1, row, `Capacity: ${grass} grass / ${assigned} grazers (${Math.floor(grass / GRASS_PER_GRAZER)} supported)`, { fg: assigned > grass / GRASS_PER_GRAZER ? t.bad : t.value, width: rect.cols - 2 });
    row += 1;
  } else if (zone.type === 'hospital') {
    row = drawHospitalSettings(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, ctx, zone);
  } else {
    const room = b.room(zone.id);
    if (room !== undefined) {
      const score = b.roomScore(zone.id);
      const tier = ctx.registry.table<{ id: string; tier: number }>('roomTiers').ids().find((id) => ctx.registry.table<{ id: string; tier: number }>('roomTiers').byId(id)?.tier === room.tier) ?? '';
      label(s, rect.col + 1, row, strings.get('ui.zone.room', { tier, score: Math.floor(room.score) }), { width: rect.cols - 2 });
      row += 1;
      if (score !== undefined) {
        const p = score.parts;
        label(s, rect.col + 1, row, strings.get('ui.zone.room_parts', { tiles: Math.floor(p.tiles), walls: Math.floor(p.walls), furniture: Math.floor(p.furniture), size: p.size }), { fg: t.dim, width: rect.cols - 2 });
        row += 1;
      }
      label(s, rect.col + 1, row, strings.get(room.enclosed ? 'ui.zone.enclosed' : 'ui.zone.open'), { fg: room.enclosed ? t.good : t.bad, width: rect.cols - 2 });
      row += 1;
      label(s, rect.col + 1, row, strings.get(room.requirementsMet ? 'ui.zone.requirements_met' : 'ui.zone.requirements_unmet'), { fg: room.requirementsMet ? t.good : t.bad, width: rect.cols - 2 });
      row += 1;
      if (zone.type === 'bedroom') {
        const owner = room.ownerId === 0 ? strings.get('ui.zone.nobody') : (ctx.readers.entities.get(room.ownerId, C.Creature)?.name ?? '');
        label(s, rect.col + 1, row, strings.get('ui.zone.owner', { name: owner }), { width: rect.cols - 2 });
        row += 1;
      }
    }
  }
  if (row <= bottom) {
    const text = strings.get('ui.zone.actions');
    label(s, rect.col + 1, bottom, text, { width: rect.cols - 2 });
    // Keyboard and mouse reach the same actions (24 § Input model): the accelerators are clickable.
    accelerator(s, rect.col + 1, bottom, text, 'x', () => onRemove?.());
    accelerator(s, rect.col + 1, bottom, text, 'e', () => { tool.resizing = true; });
  }
}

function drawFarmSettings(s: Surface, rect: Rect, tool: ZoneTool, ctx: PanelContext, zone: ZoneView): number {
  const plants = ctx.readers.has('07') ? ctx.readers.of<PlantsReader>('07') : null;
  if (plants === null) return rect.row;
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const settings = plants.plotSettings(zone.id);
  const options = tool.farmOptions(ctx);
  let row = rect.row;
  for (let season = 0; season < 4; season += 1) {
    if (row >= rect.row + rect.rows) break;
    const id = settings[season] ?? 0;
    const plant = id === 0 ? undefined : ctx.registry.table<PlantRow>('plants').byIndex(id);
    label(s, rect.col + 1, row, seasons[season] as string, { width: 8 });
    const menu = tool.farmMenus[season] as DropdownState;
    const used = dropdown(s, rect.col + 9, row, 18, plant?.name ?? 'none', options, menu,
      (choice) => { menu.open = false; ctx.submit({ type: 'SetPlotCrop', zoneId: zone.id, season, speciesId: choice === '0' ? 0 : choice }); },
      () => { for (const m of tool.farmMenus) m.open = false; menu.open = true; menu.highlighted = Math.max(0, options.findIndex((o) => o.id === (plant?.id ?? '0'))); tool.farmSeason = season; });
    if (plant !== undefined) {
      const seed = ctx.readers.has('13') ? ctx.readers.of<import('@systems/items').ItemsReader>('13').countMatching({ type: ctx.registry.table<{ id: string }>('items').index('seed'), materialId: ctx.registry.table<{ id: string }>('materials').index(plant.id) }) : 0;
      label(s, rect.col + 28, row, `${seed}${seed === 0 ? ' !' : ''}`, { fg: seed === 0 ? s.theme.bad : s.theme.value, width: 6 });
    }
    row += used;
  }
  const cropIds = plants.crops().filter((id) => plants.cropInfo(id)?.plotZoneId === zone.id);
  const ready = cropIds.filter((id) => (plants.cropInfo(id)?.stage ?? 0) === 3).length;
  if (row < rect.row + rect.rows) label(s, rect.col + 1, row, `Crops: ${cropIds.length - ready} growing, ${ready} ready, ${Math.max(0, zone.tiles.length - cropIds.length)} empty`, { width: rect.cols - 2 });
  return row + 1;
}

function drawStockpileSettings(s: Surface, rect: Rect, tool: ZoneTool, ctx: PanelContext, zone: ZoneView): number {
  const strings = ctx.strings;
  const it = items(ctx);
  const sp = it?.stockpile(zone.id);
  let row = rect.row;
  const preset = tool.presetOf(ctx);
  label(s, rect.col + 1, row, strings.get('ui.stockpile.preset', { preset: preset === null ? strings.get('ui.stockpile.custom') : strings.get(`ui.stockpile.preset.${preset}`) }), { width: rect.cols - 2 });
  s.hit({ col: rect.col + 1, row, cols: rect.cols - 2, rows: 1 }, () => {
    const cmd = tool.nextPreset(ctx);
    if (cmd !== null) ctx.submit(cmd);
  });
  row += 1;
  const f = tool.filterOf(ctx);
  const treeRows = Math.max(1, rect.rows - 5);
  tree(
    s,
    { col: rect.col + 1, row, cols: rect.cols - 2, rows: treeRows },
    tool.categories(),
    tool.tree,
    (n) => nodeState(f?.categories ?? [], n.id),
    {
      toggle: (n) => {
        const cmd = tool.toggleCategory(ctx, n.id);
        if (cmd !== null) ctx.submit(cmd);
      },
    },
  );
  row += treeRows;
  if (sp !== undefined && f !== null) {
    const classes = f.materialClasses === 'any' ? strings.get('ui.build.any') : f.materialClasses.join(',');
    label(s, rect.col + 1, row, strings.get('ui.stockpile.materials', { classes, min: f.minQuality, max: f.maxQuality }), { width: rect.cols - 2 });
    row += 1;
    const w = sp.containersWanted;
    label(s, rect.col + 1, row, strings.get('ui.stockpile.containers', { barrels: w.barrel, bags: w.bag, bins: w.bin }), { width: rect.cols - 2 });
    row += 1;
    const links = sp.linkedSources.length === 0 ? strings.get('ui.stockpile.no_links') : String(sp.linkedSources.length);
    label(s, rect.col + 1, row, strings.get('ui.stockpile.priority', { n: sp.priority, links }), { width: rect.cols - 2 });
    row += 1;
    const free = it?.freeSlots(zone.id) ?? 0;
    label(s, rect.col + 1, row, strings.get('ui.stockpile.usage', { used: zone.tiles.length - free, n: zone.tiles.length }), { width: rect.cols - 2 });
    row += 1;
  }
  return row;
}

function drawHospitalSettings(s: Surface, rect: Rect, ctx: PanelContext, zone: ZoneView): number {
  const t = s.theme;
  const strings = ctx.strings;
  const b = buildings(ctx);
  let row = rect.row;
  const bottom = rect.row + rect.rows;

  if (b !== null) {
    const room = b.room(zone.id);
    if (room !== undefined) {
      const score = b.roomScore(zone.id);
      const tier = ctx.registry.table<{ id: string; tier: number }>('roomTiers').ids().find((id) => ctx.registry.table<{ id: string; tier: number }>('roomTiers').byId(id)?.tier === room.tier) ?? '';
      label(s, rect.col + 1, row, strings.get('ui.zone.room', { tier, score: Math.floor(room.score) }), { width: rect.cols - 2 });
      row += 1;
      if (score !== undefined) {
        const p = score.parts;
        label(s, rect.col + 1, row, strings.get('ui.zone.room_parts', { tiles: Math.floor(p.tiles), walls: Math.floor(p.walls), furniture: Math.floor(p.furniture), size: p.size }), { fg: t.dim, width: rect.cols - 2 });
        row += 1;
      }
      label(s, rect.col + 1, row, strings.get(room.enclosed ? 'ui.zone.enclosed' : 'ui.zone.open'), { fg: room.enclosed ? t.good : t.bad, width: rect.cols - 2 });
      row += 1;
      label(s, rect.col + 1, row, strings.get(room.requirementsMet ? 'ui.zone.requirements_met' : 'ui.zone.requirements_unmet'), { fg: room.requirementsMet ? t.good : t.bad, width: rect.cols - 2 });
      row += 1;
    }

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
    label(s, rect.col + 1, row, lineText, { width: rect.cols - 8 });
    // Minus button [-]
    const minusCol = rect.col + rect.cols - 7;
    label(s, minusCol, row, '[-]');
    s.hit({ col: minusCol, row, cols: 3, rows: 1 }, () => {
      const nextWants = { ...currentWants, [sup.key]: Math.max(0, wanted - 1) };
      ctx.submit({ type: 'SetHospitalSupplies', zoneId: zone.id, wants: nextWants });
    });
    // Plus button [+]
    const plusCol = rect.col + rect.cols - 4;
    label(s, plusCol, row, '[+]');
    s.hit({ col: plusCol, row, cols: 3, rows: 1 }, () => {
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
