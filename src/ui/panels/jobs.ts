/**
 * The jobs panel: `ui-screens/panels.md` § Jobs and `11` § Player-facing behavior (open, claimed
 * and blocked jobs with their reasons; labor priorities 1–9). `[p]` steps the selected job's
 * priority (`SetJobPriority`, wrapping 1–9), `[x]` cancels it (`CancelJob`), `[Enter]` centres on
 * its target; `[o] standing orders` belongs to the orders panel (M4/M5) and is dim.
 */

import { C } from '@core/components';
import type { Command } from '@core/commands';
import { PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { JobsReader } from '@systems/jobs';
import type { Surface } from '../surface';
import { label, separator, table, type ListState } from '../widgets';
import { tileXyz, type PanelContext } from './context';

type JobLike = ReturnType<JobsReader['list']>[number];

const REASON_KEYS: Readonly<Record<string, string>> = Object.freeze({
  unreachable: 'ui.jobs.reason.unreachable',
  missing_input: 'ui.jobs.reason.missing_input',
  no_tool: 'ui.jobs.reason.no_tool',
  no_worker: 'ui.jobs.reason.no_worker',
});

export class JobsPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };

  jobs(ctx: PanelContext): JobLike[] {
    if (!ctx.readers.has('11')) return [];
    return ctx.readers
      .of<JobsReader>('11')
      .list()
      .filter((j) => j.state !== 'done' && j.state !== 'cancelled')
      .sort((a, b) => a.priority - b.priority || a.id - b.id);
  }

  selected(ctx: PanelContext): JobLike | undefined {
    return this.jobs(ctx)[this.list.selected];
  }

  move(delta: number, ctx: PanelContext): void {
    const n = this.jobs(ctx).length;
    this.list.selected = Math.max(0, Math.min(Math.max(0, n - 1), this.list.selected + delta));
  }

  /** `[p]`: the next priority, wrapping. */
  priority(ctx: PanelContext): Command | null {
    const j = this.selected(ctx);
    if (j === undefined) return null;
    const next = j.priority >= PRIORITY_MAX ? PRIORITY_MIN : j.priority + 1;
    return { type: 'SetJobPriority', jobId: j.id, priority: next };
  }

  cancel(ctx: PanelContext): Command | null {
    const j = this.selected(ctx);
    return j === undefined ? null : { type: 'CancelJob', jobId: j.id };
  }

  /** The tile a job is at: its target tile, or its target entity's tile. */
  tileOf(ctx: PanelContext, j: JobLike): TileIndex | null {
    if (j.target.kind === 'tile') return j.target.ref;
    const anchor = j.data['anchorTile'];
    if (typeof anchor === 'number') return anchor;
    const p = ctx.readers.entities.get(j.target.ref as EntityId, C.Position);
    return p === undefined ? null : ctx.readers.map.index(p.x, p.y, p.z);
  }
}

function jobText(ctx: PanelContext, panel: JobsPanel, j: JobLike): string {
  const type = ctx.readers.of<JobsReader>('11').typeOf(j.id) ?? '';
  const name = ctx.strings.has(`ui.jobs.type.${type}`) ? ctx.strings.get(`ui.jobs.type.${type}`) : type.replace(/_/g, ' ');
  const tile = panel.tileOf(ctx, j);
  if (tile === null) return name;
  const p = tileXyz(ctx, tile);
  return `${name} (${p.x},${p.y},z${p.z})`;
}

function whoText(ctx: PanelContext, j: JobLike): string {
  if (j.workerId !== 0) return ctx.readers.entities.get(j.workerId, C.Creature)?.name ?? '';
  if (j.state === 'blocked' && j.blockedReason !== null) {
    const key = REASON_KEYS[j.blockedReason];
    return key === undefined ? j.blockedReason.replace(/_/g, ' ') : ctx.strings.get(key);
  }
  return '—';
}

export function drawJobsPanel(s: Surface, rect: Rect, panel: JobsPanel, ctx: PanelContext): void {
  const t = s.theme;
  const strings = ctx.strings;
  if (!ctx.readers.has('11')) return;
  const reader = ctx.readers.of<JobsReader>('11');
  const c = reader.counts();
  label(s, rect.col + 1, rect.row, strings.get('ui.jobs.counts', { open: c.open, claimed: c.claimed, blocked: c.blocked }), { fg: t.value, width: rect.cols - 2 });
  const jobs = panel.jobs(ctx);
  const height = Math.max(2, rect.rows - 7);
  table(
    s,
    { col: rect.col + 1, row: rect.row + 1, cols: rect.cols - 2, rows: height },
    [
      { title: strings.get('ui.jobs.pri'), width: 4 },
      { title: strings.get('ui.jobs.job'), width: 17 },
      { title: strings.get('ui.jobs.who'), width: 13 },
    ],
    jobs.map((j) => [` ${j.priority}`, jobText(ctx, panel, j), whoText(ctx, j)]),
    panel.list,
    (index) => {
      panel.list.selected = index;
    },
  );
  let row = rect.row + 1 + height;
  separator(s, rect.col + 1, row, rect.cols - 2);
  label(s, rect.col + 1, row + 1, strings.get('ui.jobs.actions1'), { width: rect.cols - 2 });
  label(s, rect.col + 1, row + 2, strings.get('ui.jobs.actions2'), { width: rect.cols - 2 });
  row += 3;
  separator(s, rect.col + 1, row, rect.cols - 2, strings.get('ui.jobs.labor_priorities'));
  row += 1;
  const labors = ctx.registry.table<{ id: string; name: string }>('labors');
  const parts = labors.ids().map((id) => `${(labors.byId(id)?.name ?? id).slice(0, 4)} ${reader.laborPriority(id)}`);
  let line = '';
  for (const p of parts) {
    if (row >= rect.row + rect.rows) break;
    if (Array.from(line).length + p.length + 1 > rect.cols - 2) {
      label(s, rect.col + 1, row, line, { width: rect.cols - 2 });
      row += 1;
      line = '';
    }
    line = line === '' ? p : `${line} ${p}`;
  }
  if (line !== '' && row < rect.row + rect.rows) label(s, rect.col + 1, row, line, { width: rect.cols - 2 });
}
