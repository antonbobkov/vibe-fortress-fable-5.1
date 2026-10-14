/**
 * The jobs panel: `ui-screens/panels.md` § Jobs and `11` § Player-facing behavior (open, claimed
 * and blocked jobs with their reasons; labor priorities 1–9). `[p]` steps the selected job's
 * priority (`SetJobPriority`, wrapping 1–9), `[x]` cancels it (`CancelJob`), `[Enter]` centres on
 * its target; `[o] standing orders` belongs to the orders panel (M4/M5) and is dim.
 */

import { C } from '@core/components';
import type { Command } from '@core/commands';
import { PRIORITY_DEFAULT, PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { JobsReader } from '@systems/jobs';
import type { Surface } from '../surface';
import { acceleratorLabel } from '../keymap';
import { PanelFilter, drawPanelFilter } from './filter';
import { jobBlockText, wrapText } from '../messages';
import { label, separator, table, type ListState } from '../widgets';
import { tileXyz, type PanelContext } from './context';

type JobLike = ReturnType<JobsReader['list']>[number];

export class JobsPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };

  readonly filter = new PanelFilter();
  labor = '';
  state: 'all' | 'open' | 'claimed' | 'blocked' = 'all';

  allJobs(ctx: PanelContext): JobLike[] {
    if (!ctx.readers.has('11')) return [];
    return ctx.readers
      .of<JobsReader>('11')
      .list()
      .filter((j) => j.state !== 'done' && j.state !== 'cancelled')
      .sort((a, b) => a.priority - b.priority || a.id - b.id);
  }

  laborOf(ctx: PanelContext, j: JobLike): string {
    const override = j.data['labor'];
    return typeof override === 'string' ? override : ctx.registry.table<{ id: string; labor: string }>('jobTypes').byIndex(j.type)?.labor ?? '';
  }

  jobs(ctx: PanelContext): JobLike[] {
    const text = this.filter.value.toLowerCase();
    return this.allJobs(ctx).filter(j => (this.labor === '' || this.laborOf(ctx, j) === this.labor)
      && (this.state === 'all' || (this.state === 'claimed' ? !['open', 'blocked'].includes(j.state) : j.state === this.state))
      && (text === '' || jobText(ctx, this, j).toLowerCase().includes(text)
        || (ctx.readers.entities.get(j.workerId, C.Creature)?.name ?? '').toLowerCase().includes(text)));
  }

  resetSelection(): void { this.list.selected = 0; this.list.scroll = 0; }

  cycleLabor(ctx: PanelContext): void {
    const present = new Set(this.allJobs(ctx).map(j => this.laborOf(ctx, j)));
    const choices = ['', ...ctx.registry.table('labors').ids().filter(id => present.has(id))];
    this.labor = choices[(choices.indexOf(this.labor) + 1) % choices.length] ?? '';
    this.resetSelection();
  }

  cycleState(): void {
    const choices = ['all', 'open', 'claimed', 'blocked'] as const;
    this.state = choices[(choices.indexOf(this.state) + 1) % choices.length] ?? 'all';
    this.resetSelection();
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
    const building = ctx.readers.entities.get(j.target.ref as EntityId, C.Building);
    if (building) return building.origin;
    const p = ctx.readers.entities.get(j.target.ref as EntityId, C.Position);
    return p === undefined ? null : ctx.readers.map.index(p.x, p.y, p.z);
  }
}

function jobText(ctx: PanelContext, panel: JobsPanel, j: JobLike): string {
  const type = ctx.readers.of<JobsReader>('11').typeOf(j.id) ?? '';
  const name = ctx.strings.has(`ui.jobs.type.${type}`) ? ctx.strings.get(`ui.jobs.type.${type}`) : type.replace(/_/g, ' ');
  if (j.target.kind !== 'tile') {
    const building = ctx.readers.entities.get(j.target.ref, C.Building);
    const item = ctx.readers.entities.get(j.target.ref, C.Item);
    const target = building ? ctx.registry.table<{ id: string; name: string }>('buildings').byIndex(building.type)?.name
      : item ? ctx.registry.table<{ id: string; name: string }>('items').byIndex(item.type)?.name
        : ctx.readers.entities.get(j.target.ref, C.Creature)?.name;
    return target ? `${name} ${target.toLowerCase()}` : name;
  }
  const tile = panel.tileOf(ctx, j);
  if (tile === null) return name;
  const p = tileXyz(ctx, tile);
  return `${name} (${p.x},${p.y},z${p.z})`;
}

function whoText(ctx: PanelContext, j: JobLike): string {
  if (j.workerId !== 0) return ctx.readers.entities.get(j.workerId, C.Creature)?.name ?? '';
  if (j.state === 'blocked' && j.blockedReason !== null) return jobBlockText(ctx, j).short;
  return '—';
}

/**
 * `11` § Player-facing behavior: the summary names the blocked jobs by reason ("6 blocked (4
 * unreachable, 2 missing materials)"); the second header line when any job is blocked.
 */
export function blockedSummary(ctx: PanelContext, jobs: readonly JobLike[]): string {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    if (j.state !== 'blocked') continue;
    const key = j.blockedReason ?? '';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return '';
  const s = ctx.strings;
  const parts = Array.from(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([reason, n]) =>
    `${n} ${s.has(`ui.jobs.summary.${reason}`) ? s.get(`ui.jobs.summary.${reason}`) : s.get('ui.jobs.summary.other')}`);
  return s.get('ui.jobs.blocked_by', { parts: parts.join(', ') });
}

/** Orders with no job and why, with a way to open Orders on one (the "Orders waiting" section). */
export interface WaitingOrders {
  list(): readonly { readonly index: number; readonly text: string }[];
  open(index: number): void;
}

export function drawJobsPanel(s: Surface, rect: Rect, panel: JobsPanel, ctx: PanelContext, orders?: WaitingOrders): void {
  const t = s.theme;
  const strings = ctx.strings;
  if (!ctx.readers.has('11')) return;
  const reader = ctx.readers.of<JobsReader>('11');
  const c = reader.counts();
  drawPanelFilter(s, rect.col + 1, rect.row + 1, rect.cols - 2, panel.filter, ctx);
  const labors = ctx.registry.table<{ id: string; name: string }>('labors');
  const labor = panel.labor === '' ? strings.get('ui.jobs.filter.all') : labors.byId(panel.labor)?.name ?? panel.labor;
  const cycle = (row: number, text: string, run: () => void): void => {
    label(s, rect.col + 1, row, text, { width: rect.cols - 2 });
    s.hit({ col: rect.col + 1, row, cols: rect.cols - 2, rows: 1 }, run);
  };
  cycle(rect.row + 2, strings.get('ui.jobs.filter.labor', { key: acceleratorLabel('l', ctx.panelLetters), labor }), () => panel.cycleLabor(ctx));
  cycle(rect.row + 3, strings.get('ui.jobs.filter.state', { key: acceleratorLabel('s', ctx.panelLetters), state: strings.get(`ui.jobs.filter.${panel.state}`) }), () => panel.cycleState());
  label(s, rect.col + 1, rect.row, strings.get('ui.jobs.counts', { open: c.open, claimed: c.claimed, blocked: c.blocked }), { fg: t.value, width: rect.cols - 2 });
  const jobs = panel.jobs(ctx);
  const summary = blockedSummary(ctx, jobs);
  const top = summary === '' ? 4 : 5;
  if (summary !== '') label(s, rect.col + 1, rect.row + 4, summary, { fg: t.dim, width: rect.cols - 2 });
  const changed = labors.ids().filter(id => reader.laborPriority(id) !== PRIORITY_DEFAULT)
    .map(id => `${labors.byId(id)?.name ?? id} ${reader.laborPriority(id)}`);
  const priorities = wrapText(changed.length ? changed.join(' \u00b7 ') : strings.get('ui.jobs.priorities_default', { priority: PRIORITY_DEFAULT }), rect.cols - 2, rect.rows);
  const chosen = panel.selected(ctx);
  const detail = chosen !== undefined && chosen.state === 'blocked' && chosen.blockedReason !== null ? wrapText(jobBlockText(ctx, chosen).long, rect.cols - 2, 2) : [];
  const needle = panel.filter.value.toLowerCase();
  const waiting = (orders?.list() ?? []).filter((o) => needle === '' || o.text.toLowerCase().includes(needle));
  const waitingRows = waiting.length === 0 ? 0 : Math.min(3, waiting.length) + 1;
  const height = Math.max(2, rect.rows - top - 4 - priorities.length - detail.length - waitingRows);
  table(
    s,
    { col: rect.col + 1, row: rect.row + top, cols: rect.cols - 2, rows: height },
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
  if (jobs.length === 0) label(s, rect.col + 1, rect.row + top + 1, strings.get('ui.jobs.empty'), { fg: t.dim, width: rect.cols - 2 });
  for (let r = 0; r < height - 1; r += 1) {
    const index = panel.list.scroll + r;
    const job = jobs[index];
    if (!job) break;
    s.hit({ col: rect.col + 5, row: rect.row + top + 1 + r, cols: 17, rows: 1 }, () => {
      panel.list.selected = index;
      const tile = panel.tileOf(ctx, job);
      if (tile !== null) ctx.focusOn(tile);
    });
  }
  let row = rect.row + top + height;
  for (const line of detail) {
    label(s, rect.col + 1, row, line, { fg: t.alert, width: rect.cols - 2, keys: false });
    row += 1;
  }
  if (waiting.length > 0 && orders !== undefined) {
    separator(s, rect.col + 1, row, rect.cols - 2, strings.get('ui.jobs.orders_waiting', { n: waiting.length }));
    row += 1;
    for (const o of waiting.slice(0, 3)) {
      label(s, rect.col + 1, row, o.text, { fg: t.alert, width: rect.cols - 2, keys: false });
      s.hit({ col: rect.col + 1, row, cols: rect.cols - 2, rows: 1 }, () => orders.open(o.index));
      row += 1;
    }
  }
  separator(s, rect.col + 1, row, rect.cols - 2);
  label(s, rect.col + 1, row + 1, strings.get('ui.jobs.actions1'), { width: rect.cols - 2 });
  label(s, rect.col + 1, row + 2, strings.get('ui.jobs.actions2'), { width: rect.cols - 2 });
  row += 3;
  separator(s, rect.col + 1, row, rect.cols - 2, strings.get('ui.jobs.labor_priorities'));
  row += 1;
  for (const line of priorities) {
    if (row >= rect.row + rect.rows) break;
    label(s, rect.col + 1, row, line, { width: rect.cols - 2 });
    row += 1;
  }
}
