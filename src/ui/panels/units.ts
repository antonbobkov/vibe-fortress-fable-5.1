/**
 * The units panel: `ui-screens/fortress-screen.md` § Sidebar open (units panel) and `10`
 * § Player-facing behavior ("a table of every dwarf with name, profession, activity, mood tier
 * glyph"). Rows: `▶` marks the selection; the activity is `dwarves.activityText`. The profession is
 * the `profession` of the dwarf's highest skill (`skills-and-professions.md`, ties by the skill
 * table's order; "Peasant" with no skill, D-077). The mood glyph waits for 15 (M4); `[t] title`
 * and `[n] rename` open dialogs that arrive with M7's text input, so they are dim.
 */

import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { Surface } from '../surface';
import { label, separator, table, type ListState } from '../widgets';
import type { PanelContext } from './context';

interface DwarvesReaderLike {
  list(): EntityId[];
  activityText(id: EntityId): string;
  skill(id: EntityId, skill: string): number;
}

interface SkillRow {
  readonly id: string;
  readonly profession?: string;
}

export function dwarvesOf(ctx: PanelContext): EntityId[] {
  return ctx.readers.has('10') ? ctx.readers.of<DwarvesReaderLike>('10').list() : [];
}

export function nameOf(ctx: PanelContext, id: EntityId): string {
  return ctx.readers.entities.get(id, C.Creature)?.name ?? '';
}

/** The profession of the highest skill. */
export function professionOf(ctx: PanelContext, id: EntityId): string {
  if (!ctx.readers.has('10')) return '';
  const dwarves = ctx.readers.of<DwarvesReaderLike>('10');
  const skills = ctx.registry.table<SkillRow>('skills');
  let best: SkillRow | null = null;
  let level = 0;
  for (const sid of skills.ids()) {
    const row = skills.byId(sid);
    if (row?.profession === undefined) continue;
    const l = dwarves.skill(id, sid);
    if (l > level) {
      level = l;
      best = row;
    }
  }
  return best?.profession ?? ctx.strings.get('ui.units.peasant');
}

export class UnitsPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };
  filter = '';
  /** `/` focuses the filter; letters then type into it until `Enter` or `Esc`. */
  editing = false;

  rows(ctx: PanelContext): EntityId[] {
    const f = this.filter.toLowerCase();
    return dwarvesOf(ctx).filter((id) => f === '' || nameOf(ctx, id).toLowerCase().includes(f));
  }

  selectedId(ctx: PanelContext): EntityId {
    return this.rows(ctx)[this.list.selected] ?? 0;
  }

  move(delta: number, ctx: PanelContext): void {
    const n = this.rows(ctx).length;
    this.list.selected = Math.max(0, Math.min(Math.max(0, n - 1), this.list.selected + delta));
  }
}

export function drawUnitsPanel(s: Surface, rect: Rect, panel: UnitsPanel, ctx: PanelContext): void {
  const t = s.theme;
  const strings = ctx.strings;
  label(s, rect.col + 1, rect.row, strings.get('ui.units.filter', { filter: panel.filter + (panel.editing ? '_' : '') }), { fg: panel.editing ? t.value : t.text, width: rect.cols - 2 });
  const rows = panel.rows(ctx);
  const dwarves = ctx.readers.has('10') ? ctx.readers.of<DwarvesReaderLike>('10') : null;
  const height = Math.max(2, rect.rows - 4);
  table(
    s,
    { col: rect.col + 1, row: rect.row + 1, cols: rect.cols - 2, rows: height },
    [
      { title: strings.get('ui.units.name'), width: 18 },
      { title: strings.get('ui.units.profession'), width: 10 },
      { title: strings.get('ui.units.activity'), width: 7 },
    ],
    rows.map((id, k) => [`${k === panel.list.selected ? '▶' : ' '}${nameOf(ctx, id)}`, professionOf(ctx, id), dwarves?.activityText(id) || strings.get('ui.units.no_job')]),
    panel.list,
    (index) => {
      panel.list.selected = index;
    },
  );
  const row = rect.row + 1 + height;
  separator(s, rect.col + 1, row, rect.cols - 2);
  label(s, rect.col + 1, row + 1, strings.get('ui.units.actions1'), { width: rect.cols - 2 });
  label(s, rect.col + 1, row + 2, strings.get('ui.units.actions2'), { fg: t.dim, width: rect.cols - 2 });
}
