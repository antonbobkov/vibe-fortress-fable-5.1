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
import { clampList, label, separator, table, type ListState } from '../widgets';
import { tileXyz, type PanelContext } from './context';

type JobLike = ReturnType<JobsReader['list']>[number];

/**
 * A row of the job list: one job, or a blocked batch (`panels.md` § Jobs): two or more jobs next to
 * each other in the list, blocked for the same reason, of one type and priority, each on a bare tile.
 */
export interface JobRow {
  readonly jobs: readonly JobLike[];
}

/** The jobs of a blocked batch belong together: same type, priority and reason, each on a bare tile. */
function batchable(j: JobLike): boolean {
  return j.state === 'blocked' && j.blockedReason !== null && j.target.kind === 'tile';
}

export class JobsPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };

  readonly filter = new PanelFilter();
  /** The cursor is on the "Orders waiting" rows (Tab), not on the job list. */
  focusWaiting = false;
  /** The cursor and window of the "Orders waiting" rows. */
  readonly waitingList: ListState = { selected: 0, scroll: 0 };
  labor = '';
  state: 'all' | 'open' | 'claimed' | 'blocked' = 'all';
  /** Jobs whose blocked batch `Enter` has opened to its rows. Presentation state, not saved. */
  private readonly opened = new Set<number>();

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

  /** The waiting orders the Jobs text filter lets through. */
  waitingOf(orders: WaitingOrders | undefined): { readonly index: number; readonly text: string }[] {
    const needle = this.filter.value.toLowerCase();
    return (orders?.list() ?? []).filter((o) => needle === '' || o.text.toLowerCase().includes(needle));
  }

  /** `Tab`: the cursor goes to the waiting rows and back; false when there are none. */
  toggleWaiting(orders: WaitingOrders | undefined): boolean {
    const count = this.waitingOf(orders).length;
    if (count === 0) { this.focusWaiting = false; return false; }
    this.focusWaiting = !this.focusWaiting;
    this.waitingList.selected = Math.max(0, Math.min(count - 1, this.waitingList.selected));
    return true;
  }

  /** `↑` `↓` on the waiting rows. */
  moveWaiting(delta: number, orders: WaitingOrders | undefined): void {
    const count = this.waitingOf(orders).length;
    this.waitingList.selected = Math.max(0, Math.min(count - 1, this.waitingList.selected + delta));
  }

  /** `Enter` on a waiting row: Orders opens with that order selected, as the click does. */
  openWaiting(orders: WaitingOrders | undefined): boolean {
    const row = this.waitingOf(orders)[this.waitingList.selected];
    if (row === undefined || orders === undefined) return false;
    orders.open(row.index);
    return true;
  }

  resetSelection(): void {
    this.waitingList.selected = 0;
    this.waitingList.scroll = 0;
    this.list.selected = 0;
    this.list.scroll = 0;
  }

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

  /** The list's rows: each blocked batch one row until `Enter` opens it. */
  rows(ctx: PanelContext): JobRow[] {
    const rows: JobLike[][] = [];
    for (const j of this.jobs(ctx)) {
      const run = rows.at(-1);
      const head = run?.[0];
      if (run !== undefined && head !== undefined && batchable(j) && batchable(head) && j.type === head.type &&
        j.priority === head.priority && j.blockedReason === head.blockedReason) run.push(j);
      else rows.push([j]);
    }
    return rows.flatMap((run) => (run.length > 1 && run.some((j) => this.opened.has(j.id)) ? run.map((j) => [j]) : [run]))
      .map((jobs) => ({ jobs }));
  }

  selectedRow(ctx: PanelContext): JobRow | undefined {
    return this.rows(ctx)[this.list.selected];
  }

  /** The selected row's job, or a batch's first. */
  selected(ctx: PanelContext): JobLike | undefined {
    return this.selectedRow(ctx)?.jobs[0];
  }

  /** `Enter` on a blocked batch opens it to its rows; false on a row of one job. */
  openBatch(ctx: PanelContext): boolean {
    const row = this.selectedRow(ctx);
    if (row === undefined || row.jobs.length < 2) return false;
    for (const j of row.jobs) this.opened.add(j.id);
    return true;
  }

  move(delta: number, ctx: PanelContext): void {
    const n = this.rows(ctx).length;
    this.list.selected = Math.max(0, Math.min(Math.max(0, n - 1), this.list.selected + delta));
  }

  /** `[p]`: the next priority, wrapping; for every job of a blocked batch. */
  priority(ctx: PanelContext): Command[] | null {
    const row = this.selectedRow(ctx);
    const j = row?.jobs[0];
    if (row === undefined || j === undefined) return null;
    const next = j.priority >= PRIORITY_MAX ? PRIORITY_MIN : j.priority + 1;
    return row.jobs.map((job) => ({ type: 'SetJobPriority', jobId: job.id, priority: next }));
  }

  /** `[x]`: cancel the job, or every job of a blocked batch. */
  cancel(ctx: PanelContext): Command[] | null {
    const row = this.selectedRow(ctx);
    return row === undefined ? null : row.jobs.map((job) => ({ type: 'CancelJob', jobId: job.id }));
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

/** A blocked batch's row: the job's name and how many (`Dig ×19`). */
function batchText(ctx: PanelContext, row: JobRow): string {
  const first = row.jobs[0] as JobLike;
  const type = ctx.readers.of<JobsReader>('11').typeOf(first.id) ?? '';
  const name = ctx.strings.has(`ui.jobs.type.${type}`) ? ctx.strings.get(`ui.jobs.type.${type}`) : type.replace(/_/g, ' ');
  return ctx.strings.get('ui.jobs.batch', { name, n: row.jobs.length });
}

/**
 * The line under the list for a selected blocked batch: the box its tiles span, and `Enter` to open
 * it (`19 jobs over (59,51)–(63,53), z27. [Enter] list them.`).
 */
export function batchDetail(ctx: PanelContext, panel: JobsPanel, row: JobRow): string {
  const at = row.jobs.map((j) => tileXyz(ctx, panel.tileOf(ctx, j) ?? 0));
  const lo = (k: 'x' | 'y' | 'z'): number => Math.min(...at.map((p) => p[k]));
  const hi = (k: 'x' | 'y' | 'z'): number => Math.max(...at.map((p) => p[k]));
  const z = lo('z') === hi('z') ? `z${lo('z')}` : `z${hi('z')}–${lo('z')}`;
  const box = lo('x') === hi('x') && lo('y') === hi('y') ? `(${lo('x')},${lo('y')})` : `(${lo('x')},${lo('y')})–(${hi('x')},${hi('y')})`;
  return ctx.strings.get('ui.jobs.batch_detail', { n: row.jobs.length, box, z });
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

/** How many "Orders waiting" rows show at once. */
const WAITING_ROWS = 3;

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
  const rows = panel.rows(ctx);
  const chosenRow = rows[panel.list.selected];
  const chosen = chosenRow?.jobs[0];
  const blockText = chosen !== undefined && chosen.state === 'blocked' && chosen.blockedReason !== null ? jobBlockText(ctx, chosen).long : '';
  const detailText = chosenRow !== undefined && chosenRow.jobs.length > 1 ? `${batchDetail(ctx, panel, chosenRow)} ${blockText}` : blockText;
  const detail = detailText === '' ? [] : wrapText(detailText, rect.cols - 2, chosenRow !== undefined && chosenRow.jobs.length > 1 ? 3 : 2);
  const needle = panel.filter.value.toLowerCase();
  const waiting = panel.waitingOf(orders);
  void needle;
  const waitingRows = waiting.length === 0 ? 0 : Math.min(WAITING_ROWS, waiting.length) + 1;
  const height = Math.max(2, rect.rows - top - 4 - priorities.length - detail.length - waitingRows);
  table(
    s,
    { col: rect.col + 1, row: rect.row + top, cols: rect.cols - 2, rows: height },
    [
      { title: strings.get('ui.jobs.pri'), width: 4 },
      { title: strings.get('ui.jobs.job'), width: 17 },
      { title: strings.get('ui.jobs.who'), width: 13 },
    ],
    rows.map((r) => {
      const j = r.jobs[0] as JobLike;
      return [` ${j.priority}`, r.jobs.length > 1 ? batchText(ctx, r) : jobText(ctx, panel, j), whoText(ctx, j)];
    }),
    panel.list,
    (index) => {
      panel.list.selected = index;
    },
  );
  if (jobs.length === 0) label(s, rect.col + 1, rect.row + top + 1, strings.get('ui.jobs.empty'), { fg: t.dim, width: rect.cols - 2 });
  for (let r = 0; r < height - 1; r += 1) {
    const index = panel.list.scroll + r;
    const job = rows[index]?.jobs[0];
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
    // Three rows show at a time; the cursor (Tab, then up and down) scrolls the rest into view.
    const list = panel.waitingList;
    if (waiting.length === 0) panel.focusWaiting = false;
    clampList(list, waiting.length, WAITING_ROWS);
    waiting.slice(list.scroll, list.scroll + WAITING_ROWS).forEach((o, k) => {
      const cells = { col: rect.col + 1, row, cols: rect.cols - 2, rows: 1 };
      label(s, cells.col, row, o.text, { fg: t.alert, width: cells.cols, keys: false });
      if (panel.focusWaiting && list.scroll + k === list.selected) {
        s.invert(cells);
        s.text(rect.col, row, '►', t.value);
      }
      s.hit(cells, () => { list.selected = list.scroll + k; orders.open(o.index); });
      row += 1;
    });
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
