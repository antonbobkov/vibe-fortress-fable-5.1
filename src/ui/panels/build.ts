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
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { label, list, separator, type ListState } from '../widgets';
import { buildings, items, type PanelContext } from './context';
import type { TilePoint } from './designate';

/** The panel's categories, in the wireframe's order, with their accelerators. */
export const BUILD_CATEGORIES: readonly { readonly key: string; readonly id: BuildingRow['category'] }[] = [
  { key: 'c', id: 'construction' },
  { key: 'f', id: 'furniture' },
  { key: 'w', id: 'workshop' },
  { key: 'm', id: 'mechanism' },
  { key: 't', id: 'trap' },
  { key: 's', id: 'special' },
];

/** The wagon is "placed at embark only": it is not in the menu. */
function listed(row: BuildingRow): boolean {
  return row.id !== 'wagon';
}

/** One input as the menu shows it: "2 log", "1 block|log". */
function inputText(row: BuildingRow): string {
  if (row.inputs.length === 0) return '';
  return row.inputs.map((i) => `${i.count === 'tiles' ? 'n' : i.count} ${i.match.split('|')[0]}`).join('+');
}

export interface MaterialChoice {
  /** 0: any. */
  readonly material: number;
  readonly count: number;
}

export class BuildTool {
  category: BuildingRow['category'] | null = null;
  readonly list: ListState = { selected: 0, scroll: 0 };
  orientation = 0;
  /** Index into {@link materials}; 0 is "any". */
  materialIndex = 0;
  priority = PRIORITY_DEFAULT;
  private cache: { key: string; materials: MaterialChoice[] } | null = null;
  private readonly counts = { tick: -1, byRow: new Map<string, number>() };

  get active(): boolean {
    return this.category !== null;
  }

  cancel(): void {
    this.category = null;
    this.orientation = 0;
    this.materialIndex = 0;
  }

  /** A category accelerator; returns whether it chose one. */
  choose(key: string): boolean {
    const c = BUILD_CATEGORIES.find((k) => k.key === key);
    if (c === undefined) return false;
    this.category = c.id;
    this.list.selected = 0;
    this.list.scroll = 0;
    this.orientation = 0;
    this.materialIndex = 0;
    return true;
  }

  rows(ctx: PanelContext): BuildingRow[] {
    const b = buildings(ctx);
    if (b === null || this.category === null) return [];
    return b.types().filter((r) => r.category === this.category && listed(r));
  }

  current(ctx: PanelContext): BuildingRow | undefined {
    return this.rows(ctx)[this.list.selected];
  }

  move(delta: number, ctx: PanelContext): void {
    const n = this.rows(ctx).length;
    if (n === 0) return;
    this.list.selected = Math.max(0, Math.min(n - 1, this.list.selected + delta));
    this.materialIndex = 0;
    this.orientation = 0;
  }

  /** `r`: rotate a rotatable type. */
  rotate(ctx: PanelContext): void {
    const row = this.current(ctx);
    if (row?.footprint.rotatable === true) this.orientation = (this.orientation + 1) % 4;
  }

  /** `x`: the next material with available items (after "any"). */
  cycleMaterial(ctx: PanelContext): void {
    const n = this.materials(ctx).length;
    this.materialIndex = n === 0 ? 0 : (this.materialIndex + 1) % n;
  }

  /** The first input's item types. */
  private inputTypes(ctx: PanelContext, row: BuildingRow): number[] {
    const b = buildings(ctx);
    const first = row.inputs[0];
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
    const w = turned ? row.footprint.h : row.footprint.w;
    const h = turned ? row.footprint.w : row.footprint.h;
    const x = p.x - Math.floor(w / 2);
    const y = p.y - Math.floor(h / 2);
    return map.inBounds(x, y, p.z) ? map.index(x, y, p.z) : null;
  }

  /** The ghost at a point: the footprint, the failing tiles and the reason. */
  ghost(ctx: PanelContext, p: TilePoint): { tiles: TileIndex[]; bad: TileIndex[]; reason: string | null; rule: string } | null {
    const row = this.current(ctx);
    const b = buildings(ctx);
    const origin = this.origin(ctx, p);
    if (row === undefined || b === null) return null;
    if (origin === null) return { tiles: [], bad: [], reason: 'out_of_bounds', rule: '' };
    return b.ghost(row.id, origin, this.orientation);
  }

  /** The `PlaceBuilding` for a point, or null with nothing to place. */
  command(ctx: PanelContext, p: TilePoint): Command | null {
    const row = this.current(ctx);
    const origin = this.origin(ctx, p);
    if (row === undefined || origin === null) return null;
    return { type: 'PlaceBuilding', buildingType: row.id, origin, orientation: this.orientation, materialChoice: this.material(ctx), priority: this.priority };
  }

  /** The reason as the status bar says it ("needs a floor"). */
  reasonText(strings: Strings, reason: string, rule: string): string {
    if (reason === 'bad_placement' && strings.has(`ui.build.rule.${rule}`)) return strings.get(`ui.build.rule.${rule}`);
    return strings.has(`ui.build.reason.${reason}`) ? strings.get(`ui.build.reason.${reason}`) : reason.replace(/_/g, ' ');
  }
}

/** The panel body (the title row is the sidebar's). */
export function drawBuildPanel(s: Surface, rect: Rect, tool: BuildTool, ctx: PanelContext): void {
  const t = s.theme;
  const strings = ctx.strings;
  let row = rect.row;
  const colW = Math.floor((rect.cols - 2) / 2);
  for (let k = 0; k < BUILD_CATEGORIES.length; k += 2) {
    for (let j = 0; j < 2; j += 1) {
      const c = BUILD_CATEGORIES[k + j];
      if (c === undefined) continue;
      const col = rect.col + 1 + j * colW;
      const n = label(s, col, row, `[${c.key}] ${strings.get(`ui.build.category.${c.id}`)}`, { width: colW });
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
  const height = Math.max(1, rect.rows - (row - rect.row) - 4);
  list(
    s,
    { col: rect.col + 1, row, cols: rect.cols - 2, rows: height },
    rows.map((r) => {
      const name = r.name.charAt(0).toUpperCase() + r.name.slice(1);
      const inputs = inputText(r);
      const count = r.inputs.length === 0 ? '' : ` (${tool.available(ctx, r)})`;
      const right = `${inputs}${count}`;
      const width = rect.cols - 3;
      const rightText = Array.from(right).slice(0, Math.max(0, width - 9)).join('');
      const nameText = Array.from(name).slice(0, Math.max(1, width - Array.from(rightText).length - 1)).join('');
      const gap = Math.max(1, width - Array.from(nameText).length - Array.from(rightText).length);
      return `${nameText}${' '.repeat(gap)}${rightText}`;
    }),
    tool.list,
    (index) => {
      tool.list.selected = index;
      tool.materialIndex = 0;
      tool.orientation = 0;
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
  const rotate = current?.footprint.rotatable === true ? strings.get('ui.build.rotate', { n: tool.orientation }) : strings.get('ui.build.no_rotate');
  label(s, rect.col + 1, row, rotate, { fg: current?.footprint.rotatable === true ? t.text : t.dim, width: rect.cols - 2 });
  row += 1;
  label(s, rect.col + 1, row, strings.get('ui.build.help1'), { fg: t.dim, width: rect.cols - 2 });
  label(s, rect.col + 1, row + 1, strings.get('ui.build.help2'), { fg: t.dim, width: rect.cols - 2 });
}
