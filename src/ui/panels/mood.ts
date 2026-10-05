/** `ui-screens/panels.md` § Mood; `15` § Player-facing behavior. */
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { MoraleReader } from '@systems/morale';
import type { Surface } from '../surface';
import { label, separator, table, type ListState } from '../widgets';
import { dwarvesOf, nameOf } from './units';
import type { PanelContext } from './context';

export const MOOD_TIER_NAMES = ['Miserable', 'Unhappy', 'Fine', 'Content', 'Ecstatic'] as const;

export class MoodPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };
  sorted = false;
  rows(ctx: PanelContext): EntityId[] {
    const ids = dwarvesOf(ctx);
    if (this.sorted && ctx.readers.has('15')) ids.sort((a, b) => ctx.readers.of<MoraleReader>('15').mood(a) - ctx.readers.of<MoraleReader>('15').mood(b) || a - b);
    return ids;
  }
  selected(ctx: PanelContext): EntityId { return this.rows(ctx)[this.list.selected] ?? 0; }
  move(delta: number, ctx: PanelContext): void { this.list.selected = Math.max(0, Math.min(Math.max(0, this.rows(ctx).length - 1), this.list.selected + delta)); }
}

export function drawMoodPanel(s: Surface, rect: Rect, panel: MoodPanel, ctx: PanelContext): void {
  if (!ctx.readers.has('15')) return;
  const r = ctx.readers.of<MoraleReader>('15'); const col = rect.col + 1; const width = rect.cols - 2;
  label(s, col, rect.row, `Hall spirit ♥ ${MOOD_TIER_NAMES[r.hallSpiritTier()]} (${r.hallSpirit()})`, { fg: s.theme.value, width });
  const rows = panel.rows(ctx); const height = Math.max(2, rect.rows - 5);
  table(s, { col, row: rect.row + 1, cols: width, rows: height }, [{ title: 'Name', width: 13 }, { title: 'Tier', width: 9 }, { title: 'Top thoughts', width: 12 }],
    rows.map((id) => [nameOf(ctx, id), MOOD_TIER_NAMES[r.tier(id)], r.thoughts(id).slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3).map((t) => `${t.value > 0 ? '+' : ''}${t.value} ${t.text}`).join(', ')]), panel.list,
    (i) => { panel.list.selected = i; });
  separator(s, col, rect.row + height + 1, width);
  label(s, col, rect.row + height + 2, ctx.strings.get('ui.mood.actions'), { width });
}
