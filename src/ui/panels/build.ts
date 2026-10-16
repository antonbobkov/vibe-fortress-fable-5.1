/**
 * The build tool and panel: `ui-screens/fortress-screen.md` § Build tool, `14` § Player-facing
 * behavior ("Build menu (hotkey `b`): categories → types; a footprint ghost follows the cursor,
 * green where valid, red where not, with the reason; material choice list showing available
 * counts; orientation with `r`. Placing several of the same type: the menu stays open"), and the
 * map keys `r` ("with a building tool: rotate") and `x` ("cycle material") of
 * `ui-keymap-and-screens.md`.
 *
 * The ghost is centred on the pointer; `PlaceBuilding` takes its north-west tile as the origin
 * (D-073, D-077). Its validity is 14's own check (`readers.of('14').ghost`).
 */

import { C, ItemFlag } from '@core/components';
import type { Command } from '@core/commands';
import { PRIORITY_DEFAULT } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { BuildingRow } from '@systems/buildings';
import type { WorkshopsReader } from '@systems/workshops';
import type { Registry } from '@core/registry';
import { workshopHasWork } from '@core/workshop-use';
import { acceleratorLabel } from '../keymap';
import { blockedText, capitalize, itemName, matchName, whereMade } from '../messages';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { label, list, separator, type ListState } from '../widgets';
import { buildings, items, type PanelContext } from './context';
import { rectTiles, type TilePoint } from './designate';

/** The panel's categories, in the wireframe's order, with their accelerators. */
export const BUILD_CATEGORIES: readonly { readonly key: string; readonly id: BuildingRow['category'] }[] = [
  { key: 'c', id: 'construction' },
  { key: 'f', id: 'furniture' },
  { key: 'w', id: 'workshop' },
  { key: 'm', id: 'mechanism' },
  { key: 't', id: 'trap' },
  { key: 's', id: 'special' },
];

/**
 * The wagon is "placed at embark only": it is not in the menu. A workshop is listed only if a recipe
 * names it or a job is worked at it (`workshopHasWork`), so a workshop reserved for a later version is not offered.
 */
function listed(row: BuildingRow, ctx: PanelContext): boolean {
  if (row.id === 'wagon') return false;
  if (row.category !== 'workshop') return true;
  return ctx.readers.has('12') && workshopHasWork(ctx.registry, row.id, ctx.readers.of<WorkshopsReader>('12').recipesFor(row.id).length);
}

/** The inputs as the menu shows them, by content name and the first alternative: "1 table+1 stone", "n blocks". */
export function inputText(row: BuildingRow, registry: Registry): string {
  if (row.inputs.length === 0) return '';
  return row.inputs.map((i) => {
    const n = i.count === 'tiles' ? 2 : i.count;
    return `${i.count === 'tiles' ? 'n' : i.count} ${itemName(registry, i.match.split('|')[0] ?? '', n)}`;
  }).join('+');
}

/**
 * A row of the build list in `width` cells: the name first and whole where it fits, then the
 * inputs shortened to the room left, then the available count of the first input (D-U7, Q7).
 */
export function buildRowText(name: string, inputs: string, count: string, width: number): string {
  const cells = (text: string): string[] => Array.from(text);
  const nameCells = cells(name);
  let right = `${inputs}${count}`;
  const room = width - nameCells.length - 1;
  if (cells(right).length > room) {
    const keep = room - cells(count).length;
    right = keep >= 4 ? `${cells(inputs).slice(0, keep - 1).join('')}…${count}` : count.trim();
  }
  const rightCells = cells(right);
  const nameText = nameCells.slice(0, Math.max(1, width - rightCells.length - (rightCells.length > 0 ? 1 : 0))).join('');
  const gap = Math.max(rightCells.length > 0 ? 1 : 0, width - cells(nameText).length - rightCells.length);
  return `${nameText}${' '.repeat(gap)}${right}`;
}

export interface MaterialChoice {
  /** 0: any. */
  readonly material: number;
  readonly count: number;
}

/** What a drag would place: one building per valid tile, the rest skipped by rule (D-U6, S9). */
export interface DragPlan {
  readonly ok: TileIndex[];
  readonly blocked: number;
  /** The rules that blocked tiles, as the status bar says them, the most frequent first. */
  readonly rules: string[];
}

/** Buildings placed while the input was short: what `[o] order N` offers to make (D-U6). */
export interface StockOffer {
  /** The input as the build menu matches it ("door", "block|log"). */
  readonly match: string;
  /** Units of the input in stock now. */
  readonly have: number;
  /** Buildings that wait for it. */
  readonly waiting: number;
  /** The item a workshop order makes, or null when no recipe makes the input. */
  readonly itemId: string | null;
  /** A recipe for it at a workshop that is built, or null: then `workshops` says what to build. */
  readonly recipeId: string | null;
  /** The workshops that make it, as words: "a carpenter's workshop or a mason's workshop". */
  readonly workshops: string;
}

export class BuildTool {
  category: BuildingRow['category'] | null = null;
  /** A building is picked from the open list (`Enter` or a click); until then nothing is placed. */
  private armed = false;
  readonly list: ListState = { selected: 0, scroll: 0 };
  orientation = 0;
  width = 1;
  height = 1;
  /** Index into {@link materials}; 0 is "any". */
  materialIndex = 0;
  priority = PRIORITY_DEFAULT;
  /** A drag in progress for a type placed one per tile (D-U6): its corners. */
  anchor: TilePoint | null = null;
  end: TilePoint | null = null;
  /** Units of the first input that buildings placed with this tool wait for (D-U6). */
  private short: number | null = null;
  /** Successful placement feedback, until the pointer leaves the placed footprint. */
  private placement: { tiles: ReadonlySet<TileIndex>; text: string | null } | null = null;

  clearPlacement(): void { this.placement = null; }

  clearPlacementNotice(): void { if (this.placement !== null) this.placement.text = null; }

  rememberPlacement(tiles: readonly TileIndex[], text: string): void {
    this.placement = tiles.length === 0 ? null : { tiles: new Set(tiles), text };
  }

  private placementContains(ctx: PanelContext, p: TilePoint): boolean {
    const map = ctx.readers.map;
    if (this.placement !== null && map.inBounds(p.x, p.y, p.z) && this.placement.tiles.has(map.index(p.x, p.y, p.z))) return true;
    this.clearPlacement();
    return false;
  }

  placementAt(ctx: PanelContext, p: TilePoint): string | null {
    return this.placementContains(ctx, p) ? this.placement?.text ?? null : null;
  }
  /** Units placed on this tick that the stock covers: the count does not know of them yet. */
  private tally: { tick: number; covered: number } | null = null;
  private cache: { key: string; materials: MaterialChoice[] } | null = null;
  private readonly counts = { tick: -1, byRow: new Map<string, number>() };

  /** A category's list is open, with or without a building picked. */
  get listing(): boolean {
    return this.category !== null;
  }

  /** The tool is armed: a building of the open list is picked and the cursor places it. */
  get active(): boolean {
    return this.category !== null && this.armed;
  }

  cancel(): void {
    this.category = null;
    this.armed = false;
    this.resetRow();
  }

  /** `Enter` or a click on a row of the list: the highlighted building becomes the tool. */
  arm(): boolean {
    if (this.category === null) return false;
    this.armed = true;
    this.resetRow();
    return true;
  }

  /** `Backspace`: back to the list with the tool dropped; the highlight stays. */
  disarm(): boolean {
    if (!this.armed) return false;
    this.armed = false;
    this.resetRow();
    return true;
  }

  /** Another type (or none): the drag, the stock offer and the type's settings start again. */
  resetRow(): void {
    this.clearPlacement();
    this.anchor = null;
    this.end = null;
    this.short = null;
    this.tally = null;
    this.orientation = 0;
    this.width = 1;
    this.height = 1;
    this.materialIndex = 0;
  }

  /** A category accelerator; returns whether it chose one. */
  choose(key: string): boolean {
    const c = BUILD_CATEGORIES.find((k) => k.key === key);
    if (c === undefined) return false;
    this.category = c.id;
    this.armed = false;
    this.list.selected = 0;
    this.list.scroll = 0;
    this.resetRow();
    return true;
  }

  rows(ctx: PanelContext): BuildingRow[] {
    const b = buildings(ctx);
    if (b === null || this.category === null) return [];
    return b.types().filter((r) => r.category === this.category && listed(r, ctx));
  }

  current(ctx: PanelContext): BuildingRow | undefined {
    return this.rows(ctx)[this.list.selected];
  }

  move(delta: number, ctx: PanelContext): void {
    const n = this.rows(ctx).length;
    if (n === 0) return;
    this.list.selected = Math.max(0, Math.min(n - 1, this.list.selected + delta));
    this.resetRow();
  }

  /** `r`: rotate a rotatable type. */
  rotate(ctx: PanelContext): void {
    const row = this.current(ctx);
    if (row?.footprint.rotatable === true) this.orientation = (this.orientation + 1) % 4;
  }

  /** The drawbridge's variable dimensions, each bounded by its content row. */
  cycleSize(ctx: PanelContext, side: 'width' | 'height'): void {
    const max = this.current(ctx)?.footprint.variable?.max;
    if (max === undefined) return;
    this[side] = this[side] >= max ? 1 : this[side] + 1;
  }

  /** `x`: the next material with available items (after "any"). */
  cycleMaterial(ctx: PanelContext): void {
    const n = this.materials(ctx).length;
    this.materialIndex = n === 0 ? 0 : (this.materialIndex + 1) % n;
  }

  /** The first input's item types. */
  private inputTypes(ctx: PanelContext, row: BuildingRow): number[] {
    const b = buildings(ctx);
    const first = row.id === 'magma_forge' ? row.inputs.find((input) => input.match === 'stone_block') : row.inputs[0];
    return b === null || first === undefined ? [] : b.inputTypes(first.match);
  }

  /** Units of the first input available now (the menu's "(14)"). */
  available(ctx: PanelContext, row: BuildingRow): number {
    const tick = ctx.readers.calendar.tick;
    if (this.counts.tick !== tick) {
      this.counts.tick = tick;
      this.counts.byRow.clear();
    }
    const known = this.counts.byRow.get(row.id);
    if (known !== undefined) return known;
    const it = items(ctx);
    const types = this.inputTypes(ctx, row);
    const n = it === null || types.length === 0 ? 0 : it.countAvailable({ types });
    this.counts.byRow.set(row.id, n);
    return n;
  }

  /** "Material: [x] any wood ▸ oak (9)": any, then each material of the first input's available items, most first. */
  materials(ctx: PanelContext): MaterialChoice[] {
    const row = this.current(ctx);
    const it = items(ctx);
    if (row === undefined || it === null) return [{ material: 0, count: 0 }];
    const key = `${row.id}:${ctx.readers.calendar.tick}`;
    if (this.cache?.key === key) return this.cache.materials;
    const types = new Set(this.inputTypes(ctx, row));
    const per = new Map<number, number>();
    let total = 0;
    for (const id of ctx.readers.entities.with(C.Item)) {
      const rec = it.get(id as EntityId);
      if (rec === undefined || !types.has(rec.type)) continue;
      if ((rec.flags & (ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Merchant | ItemFlag.Installed)) !== 0) continue;
      per.set(rec.material, (per.get(rec.material) ?? 0) + rec.count);
      total += rec.count;
    }
    const out: MaterialChoice[] = [{ material: 0, count: total }];
    for (const m of Array.from(per.keys()).sort((a, b) => (per.get(b) as number) - (per.get(a) as number) || a - b)) {
      out.push({ material: m, count: per.get(m) as number });
    }
    this.cache = { key, materials: out };
    return out;
  }

  material(ctx: PanelContext): number {
    return this.materials(ctx)[this.materialIndex]?.material ?? 0;
  }

  /** The origin of the footprint centred on a point. */
  origin(ctx: PanelContext, p: TilePoint): TileIndex | null {
    const row = this.current(ctx);
    const map = ctx.readers.map;
    if (row === undefined) return null;
    const turned = row.footprint.rotatable && this.orientation % 2 === 1;
    const width = row.footprint.variable === undefined ? row.footprint.w : this.width;
    const height = row.footprint.variable === undefined ? row.footprint.h : this.height;
    const w = turned ? height : width;
    const h = turned ? width : height;
    const x = p.x - Math.floor(w / 2);
    const y = p.y - Math.floor(h / 2);
    return map.inBounds(x, y, p.z) ? map.index(x, y, p.z) : null;
  }

  /** The ghost at a point: the footprint, the failing tiles and the reason. */
  ghost(ctx: PanelContext, p: TilePoint): { tiles: TileIndex[]; bad: TileIndex[]; reason: string | null; rule: string } | null {
    if (this.placementContains(ctx, p)) return null;
    const row = this.current(ctx);
    const b = buildings(ctx);
    const origin = this.origin(ctx, p);
    if (row === undefined || b === null) return null;
    if (origin === null) return { tiles: [], bad: [], reason: 'out_of_bounds', rule: '' };
    return b.ghost(row.id, origin, this.orientation, row.footprint.variable === undefined ? undefined : this.width,
      row.footprint.variable === undefined ? undefined : this.height);
  }

  /** The `PlaceBuilding` for a point, or null with nothing to place. */
  command(ctx: PanelContext, p: TilePoint): Command | null {
    const row = this.current(ctx);
    const origin = this.origin(ctx, p);
    if (row === undefined || origin === null) return null;
    return { type: 'PlaceBuilding', buildingType: row.id, origin, orientation: this.orientation, materialChoice: this.material(ctx), priority: this.priority,
      ...(row.footprint.variable === undefined ? {} : { width: this.width, height: this.height }) };
  }

  /**
   * Whether a drag places one per tile (D-U6: "for 1×1 buildings and constructions"). The hearth
   * and the well are single buildings of a fortress and keep the click.
   */
  multi(ctx: PanelContext): boolean {
    const row = this.current(ctx);
    return row !== undefined && row.footprint.w === 1 && row.footprint.h === 1 && row.footprint.variable === undefined && row.category !== 'special';
  }

  /** The tiles of a drag: the valid ones, ascending, and why the others are skipped. */
  plan(ctx: PanelContext, a: TilePoint, b: TilePoint): DragPlan {
    const row = this.current(ctx);
    const reader = buildings(ctx);
    const ok: TileIndex[] = [];
    const rules = new Map<string, number>();
    let blocked = 0;
    if (row === undefined || reader === null) return { ok, blocked, rules: [] };
    for (const tile of rectTiles(ctx.readers.map, a, b)) {
      const text = blockedText(ctx, row.id, reader.ghost(row.id, tile, this.orientation));
      if (text === null) ok.push(tile);
      else {
        blocked += 1;
        rules.set(text, (rules.get(text) ?? 0) + 1);
      }
    }
    return { ok, blocked, rules: Array.from(rules.keys()).sort((x, y) => (rules.get(y) as number) - (rules.get(x) as number) || (x < y ? -1 : 1)) };
  }

  /** The `PlaceBuilding` of one tile of a drag. */
  commandAt(ctx: PanelContext, origin: TileIndex): Command | null {
    const row = this.current(ctx);
    if (row === undefined) return null;
    return { type: 'PlaceBuilding', buildingType: row.id, origin, orientation: this.orientation, materialChoice: this.material(ctx), priority: this.priority };
  }

  /** Units of the first input one building takes; 0 when it has none or takes one per tile. */
  private perBuilding(row: BuildingRow): number {
    const first = row.inputs[0];
    return first === undefined || first.count === 'tiles' ? 0 : first.count;
  }

  /** Units placed on this tick that the stock covers. */
  private covered(ctx: PanelContext): number {
    return this.tally !== null && this.tally.tick === ctx.readers.calendar.tick ? this.tally.covered : 0;
  }

  /** Units of the first input the stock cannot give `n` more buildings of the current type. */
  private shortFor(ctx: PanelContext, row: BuildingRow, n: number): number {
    const per = this.perBuilding(row);
    if (per === 0 || n <= 0) return 0;
    return Math.max(0, n * per - Math.max(0, this.available(ctx, row) - this.covered(ctx)));
  }

  /** Record `n` buildings of the current type as placed: those the stock cannot supply wait (D-U6). */
  placed(ctx: PanelContext, n: number): void {
    const row = this.current(ctx);
    if (row === undefined || n <= 0) return;
    const per = this.perBuilding(row);
    if (per === 0) return;
    const short = this.shortFor(ctx, row, n);
    this.tally = { tick: ctx.readers.calendar.tick, covered: this.covered(ctx) + n * per - short };
    if (short > 0) this.short = (this.short ?? 0) + short;
  }

  /**
   * The out-of-stock offer, with `extra` more buildings about to be placed (a drag in progress), or
   * null while the stock covers everything placed with this tool.
   */
  offer(ctx: PanelContext, extra = 0): StockOffer | null {
    const row = this.current(ctx);
    const reader = buildings(ctx);
    if (row === undefined || reader === null) return null;
    const per = this.perBuilding(row);
    const first = row.inputs[0];
    if (per === 0 || first === undefined) return null;
    const units = (this.short ?? 0) + this.shortFor(ctx, row, extra);
    if (units <= 0) return null;
    // The item an order makes: the first alternative of the input that some recipe produces.
    const items = ctx.registry.table<{ id: string }>('items');
    const recipes = ctx.registry.table<{ id: string; workshop: string; outputs: readonly { item: string }[] }>('recipes');
    const rows = recipes.ids().map((id) => recipes.byId(id)).filter((r): r is NonNullable<typeof r> => r !== undefined);
    const built = (type: string): boolean => reader.byType(type).some((id) => reader.get(id)?.state === 'built');
    let itemId: string | null = null;
    let recipeId: string | null = null;
    for (const part of first.match.split('|')) {
      for (const index of reader.inputTypes(part)) {
        const id = items.byIndex(index)?.id;
        const makers = id === undefined ? [] : rows.filter((r) => r.outputs.some((o) => o.item === id));
        if (id === undefined || makers.length === 0) continue;
        const ready = makers.find((r) => built(r.workshop));
        // The first alternative some recipe makes; one a built workshop makes is better still.
        if (itemId === null || (recipeId === null && ready !== undefined)) {
          itemId = id;
          recipeId = ready?.id ?? null;
        }
      }
    }
    const workshops = itemId === null ? '' : whereMade(ctx.registry, [itemId]) || ctx.strings.get('ui.build.stock.a_workshop');
    return { match: first.match, have: this.available(ctx, row), waiting: Math.ceil(units / per), itemId, recipeId, workshops };
  }

  /** The offer was taken (`[o] order N`): nothing placed so far waits for an order any more. */
  clearOffer(): void {
    this.short = null;
  }

  /** "0 doors in stock: 5 will wait", then "[o] order 5" or the workshop to build first; `key` is the Orders key. */
  offerText(ctx: PanelContext, offer: StockOffer, key: string): { stock: string; action: string } {
    const s = ctx.strings;
    const stock = s.get('ui.build.stock.short', { have: offer.have, items: matchName(ctx.registry, offer.match.split('|')[0] ?? '', offer.have), n: offer.waiting });
    if (offer.itemId === null) return { stock, action: '' };
    if (offer.recipeId !== null) return { stock, action: s.get('ui.build.stock.order', { key, n: offer.waiting }) };
    return { stock, action: s.get('ui.build.stock.needs_workshop', { workshop: offer.workshops }) };
  }

  /** The building's name as the status bar says it ("Door"). */
  name(ctx: PanelContext): string {
    const row = this.current(ctx);
    return row === undefined ? '' : capitalize(row.name);
  }

  /** The reason as the status bar says it ("needs a floor"). */
  reasonText(strings: Strings, reason: string, rule: string): string {
    if (reason === 'bad_placement' && strings.has(`ui.build.rule.${rule}`)) return strings.get(`ui.build.rule.${rule}`);
    return strings.has(`ui.build.reason.${reason}`) ? strings.get(`ui.build.reason.${reason}`) : reason.replace(/_/g, ' ');
  }
}

/** The panel body (the title row is the sidebar's). */
export function drawBuildPanel(s: Surface, rect: Rect, tool: BuildTool, ctx: PanelContext, order?: { readonly key: string; run(): void }): void {
  const t = s.theme;
  const strings = ctx.strings;
  let row = rect.row;
  const colW = Math.floor((rect.cols - 2) / 2);
  for (let k = 0; k < BUILD_CATEGORIES.length; k += 2) {
    for (let j = 0; j < 2; j += 1) {
      const c = BUILD_CATEGORIES[k + j];
      if (c === undefined) continue;
      const col = rect.col + 1 + j * colW;
      const n = label(s, col, row, `${acceleratorLabel(c.key, ctx.panelLetters)} ${strings.get(`ui.build.category.${c.id}`)}`, { width: colW - 1 });
      if (tool.category === c.id) s.invert({ col, row, cols: n, rows: 1 });
      s.hit({ col, row, cols: n, rows: 1 }, () => void tool.choose(c.key));
    }
    row += 1;
  }
  if (tool.category === null) {
    label(s, rect.col + 1, row + 1, strings.get('ui.build.pick_category'), { fg: t.dim, width: rect.cols - 2 });
    return;
  }
  separator(s, rect.col + 1, row, rect.cols - 2, strings.get(`ui.build.category.${tool.category}`));
  row += 1;
  const rows = tool.rows(ctx);
  const height = Math.max(1, rect.rows - (row - rect.row) - (tool.current(ctx)?.footprint.variable === undefined ? 4 : 5));
  list(
    s,
    { col: rect.col + 1, row, cols: rect.cols - 2, rows: height },
    rows.map((r) => {
      const name = r.name.charAt(0).toUpperCase() + r.name.slice(1);
      const count = r.inputs.length === 0 ? '' : ` (${tool.available(ctx, r)})`;
      return buildRowText(name, inputText(r, ctx.registry), count, rect.cols - 3);
    }),
    tool.list,
    (index) => {
      tool.list.selected = index;
      tool.arm();
    },
  );
  row += height;
  const mats = tool.materials(ctx);
  const choice = mats[tool.materialIndex] ?? mats[0];
  const matName = choice === undefined || choice.material === 0 ? strings.get('ui.build.any') : ctx.registry.table<{ id: string; name: string }>('materials').byIndex(choice.material)?.name ?? '';
  label(s, rect.col + 1, row, strings.get('ui.build.material', { material: matName, n: choice?.count ?? 0 }), { width: rect.cols - 2 });
  s.hit({ col: rect.col + 1, row, cols: rect.cols - 2, rows: 1 }, () => tool.cycleMaterial(ctx));
  row += 1;
  const current = tool.current(ctx);
  if (current?.footprint.variable !== undefined) {
    label(s, rect.col + 1, row, `Size: ${tool.width} × ${tool.height}  [width] [height]`, { width: rect.cols - 2 });
    s.hit({ col: rect.col + 1, row, cols: 12, rows: 1 }, () => tool.cycleSize(ctx, 'width'));
    s.hit({ col: rect.col + 13, row, cols: rect.cols - 14, rows: 1 }, () => tool.cycleSize(ctx, 'height'));
    row += 1;
  }
  const rotate = current?.footprint.rotatable === true ? strings.get('ui.build.rotate', { n: tool.orientation }) : strings.get('ui.build.no_rotate');
  label(s, rect.col + 1, row, rotate, { fg: current?.footprint.rotatable === true ? t.text : t.dim, width: rect.cols - 2 });
  row += 1;
  // D-U6: what the stock cannot supply takes the help rows, with the order as a button.
  const offer = tool.offer(ctx);
  if (offer !== null) {
    const text = tool.offerText(ctx, offer, order?.key ?? '');
    label(s, rect.col + 1, row, text.stock, { fg: t.alert, width: rect.cols - 2 });
    if (text.action !== '') {
      label(s, rect.col + 1, row + 1, text.action, { fg: offer.recipeId !== null ? t.key : t.dim, width: rect.cols - 2 });
      if (offer.recipeId !== null && order !== undefined) s.hit({ col: rect.col + 1, row: row + 1, cols: rect.cols - 2, rows: 1 }, () => order.run());
    }
    return;
  }
  // Nothing is picked yet: Enter picks the highlighted row; once picked, Enter places.
  if (!tool.active) {
    label(s, rect.col + 1, row, strings.get('ui.build.help_list1'), { fg: t.dim, width: rect.cols - 2 });
    label(s, rect.col + 1, row + 1, strings.get('ui.build.help_list2'), { fg: t.dim, width: rect.cols - 2 });
    return;
  }
  label(s, rect.col + 1, row, strings.get('ui.build.help1'), { fg: t.dim, width: rect.cols - 2 });
  label(s, rect.col + 1, row + 1, strings.get(tool.multi(ctx) ? 'ui.build.help2_drag' : 'ui.build.help2'), { fg: t.dim, width: rect.cols - 2 });
}
