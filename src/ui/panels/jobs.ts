/**
 * The jobs panel: `ui-screens/panels.md` § Jobs and `11` § Player-facing behavior (open, claimed
 * and blocked jobs with their reasons; labor priorities 1–9). `[p]` steps the selected job's
 * priority (`SetJobPriority`, wrapping 1–9), `[x]` cancels it (`CancelJob`), `[Enter]` centres on
 * its target; `[o] standing orders` belongs to the orders panel (M4/M5) and is dim.
 */

import { C } from '@core/components';
import type { Command } from '@core/commands';
import { PRIORITY_DEFAULT, PRIORITY_MAX, PRIORITY_MIN, TICKS_PER_DAY } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { JobsReader } from '@systems/jobs';
import type { Surface } from '../surface';
import { acceleratorLabel } from '../keymap';
import { PanelFilter, drawPanelFilter } from './filter';
import { jobBlockText, keepCounts, wrapHang, wrapText } from '../messages';
import { jobWait } from '../job-wait';
import { clampList, label, separator, table, wrapLabel, type ListState } from '../widgets';
import { buildings, tileXyz, type PanelContext } from './context';

type JobLike = ReturnType<JobsReader['list']>[number];

/**
 * A row of the job list: one job, or a batch (`panels.md` § Jobs): two or more jobs of one type and
 * priority, all open or all blocked for the same reason, on bare tiles or on targets of one kind (a
 * building type, an item type), standing as one row in the place of the first of them.
 */
export interface JobRow {
  readonly jobs: readonly JobLike[];
}

/**
 * What a job batches by: its type, priority, state, its reason when blocked (the words its row
 * shows) and its target's kind (a bare tile, or the target's name: "bed", "straw"); null for a job
 * that never batches, claimed or on a creature (its worker, or its creature, is its fact).
 */
function batchKey(ctx: PanelContext, panel: JobsPanel, j: JobLike): string | null {
  if (j.state !== 'open' && !(j.state === 'blocked' && j.blockedReason !== null)) return null;
  if (j.target.kind !== 'tile' && ctx.readers.entities.get(j.target.ref, C.Creature) !== undefined) return null;
  const reason = j.state === 'blocked' ? `${j.blockedReason ?? ''}:${jobBlockText(ctx, j).short}` : '';
  const target = j.target.kind === 'tile' ? '' : jobText(ctx, panel, j);
  return `${j.type}|${j.priority}|${j.state}|${reason}|${j.target.kind}|${target}`;
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
  /** Jobs whose batch `Enter` has opened to its rows. Presentation state, not saved. */
  private readonly opened = new Set<number>();
  /**
   * The line under the list for a job open more than a day: why nobody has taken it
   * ({@link jobWait}); '' for any other job. Read each frame, so a labor turned on while paused
   * shows at once.
   */
  waitLine(ctx: PanelContext, j: JobLike): string {
    if (j.state !== 'open' || ctx.readers.calendar.tick - j.createdTick <= TICKS_PER_DAY) return '';
    return jobWait(ctx, j)?.text ?? '';
  }

  /**
   * The live jobs, by priority. Each call copies the whole board (`JobsReader.list()` copies every
   * job with its inputs), so a frame reads it once and passes it to {@link jobs} and {@link rows}.
   */
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

  /** The jobs the filters let through, of `all` when the caller has read them this frame. */
  jobs(ctx: PanelContext, all: readonly JobLike[] = this.allJobs(ctx)): JobLike[] {
    const text = this.filter.value.toLowerCase();
    return all.filter(j => (this.labor === '' || this.laborOf(ctx, j) === this.labor)
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

  /**
   * The list's rows: each batch one row until `Enter` opens it, in the place of its first job; of
   * `jobs` (by priority) when the caller has them.
   */
  rows(ctx: PanelContext, jobs: readonly JobLike[] = this.jobs(ctx)): JobRow[] {
    const runs: JobLike[][] = [];
    // The batches of the priority being read, by key: a later job of one joins it, wherever it stands.
    const batches = new Map<string, JobLike[]>();
    let priority: number | null = null;
    for (const j of jobs) {
      if (j.priority !== priority) { batches.clear(); priority = j.priority; }
      // A job of an opened batch is a row of its own, in its own place, while it lasts.
      const key = this.opened.has(j.id) ? null : batchKey(ctx, this, j);
      const run = key === null ? undefined : batches.get(key);
      if (run !== undefined) { run.push(j); continue; }
      const fresh = [j];
      runs.push(fresh);
      if (key !== null) batches.set(key, fresh);
    }
    return runs.map((jobs) => ({ jobs }));
  }

  selectedRow(ctx: PanelContext): JobRow | undefined {
    return this.rows(ctx)[this.list.selected];
  }

  /** The selected row's job, or a batch's first. */
  selected(ctx: PanelContext): JobLike | undefined {
    return this.selectedRow(ctx)?.jobs[0];
  }

  /** `Enter` on a batch opens it to its rows; false on a row of one job. */
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

  /** `[p]`: the next priority, wrapping; for every job of a batch. */
  priority(ctx: PanelContext): Command[] | null {
    const row = this.selectedRow(ctx);
    const j = row?.jobs[0];
    if (row === undefined || j === undefined) return null;
    const next = j.priority >= PRIORITY_MAX ? PRIORITY_MIN : j.priority + 1;
    return row.jobs.map((job) => ({ type: 'SetJobPriority', jobId: job.id, priority: next }));
  }

  /** `[x]`: cancel the job, or every job of a batch. */
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
  const name = jobTypeName(ctx, type);
  if (j.target.kind !== 'tile') {
    // A trade names its depot by the depot's number, to fit the column: "Trade, depot #1".
    const depot = type === 'trade' ? buildings(ctx)?.get(j.target.ref) : undefined;
    if (depot !== undefined) return ctx.strings.get('ui.jobs.trade_at', { n: (buildings(ctx)?.byType(depot.typeId).indexOf(j.target.ref) ?? 0) + 1 });
    const building = ctx.readers.entities.get(j.target.ref, C.Building);
    const item = ctx.readers.entities.get(j.target.ref, C.Item);
    const target = building ? ctx.registry.table<{ id: string; name: string }>('buildings').byIndex(building.type)?.name.toLowerCase()
      : item ? ctx.registry.table<{ id: string; name: string }>('items').byIndex(item.type)?.name.toLowerCase()
        : creatureTargetName(ctx, j.target.ref);
    return target ? `${name} ${target}` : name;
  }
  const tile = panel.tileOf(ctx, j);
  if (tile === null) return name;
  const p = tileXyz(ctx, tile);
  return `${name} (${p.x},${p.y},z${p.z})`;
}

/** A batch's row: the job's name and how many (`Dig ×19`, `Build bed ×9`, `Haul straw ×18`). */
function batchText(ctx: PanelContext, panel: JobsPanel, row: JobRow): string {
  const first = row.jobs[0] as JobLike;
  const type = ctx.readers.of<JobsReader>('11').typeOf(first.id) ?? '';
  const name = first.target.kind === 'tile' ? jobTypeName(ctx, type) : jobText(ctx, panel, first);
  return ctx.strings.get('ui.jobs.batch', { name, n: row.jobs.length });
}

/**
 * A batch's cell: whole when it fits, else its kind and count (`Haul ×18`), else the kind cut with
 * `»` before the count: the count is the fact, the name may be cut.
 */
function batchCell(ctx: PanelContext, text: string, kind: string, n: number, room: number): string {
  const short = ctx.strings.get('ui.jobs.batch', { name: kind, n });
  const fit = fitCell(text, short, room);
  if (Array.from(fit).length <= room) return fit;
  const count = Array.from(short).length - Array.from(kind).length;
  return ctx.strings.get('ui.jobs.batch', { name: `${Array.from(kind).slice(0, Math.max(0, room - count - 1)).join('')}»`, n });
}

/** A job type's name: its string ("Haul"), else its id in words with a capital ("Plant", "Carry patient"). */
export function jobTypeName(ctx: PanelContext, type: string): string {
  if (ctx.strings.has(`ui.jobs.type.${type}`)) return ctx.strings.get(`ui.jobs.type.${type}`);
  const words = type.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A creature a job targets: a dwarf or a named animal by its name, any other by its species ("Hunt wild horse"). */
export function creatureTargetName(ctx: PanelContext, id: EntityId): string | undefined {
  const creature = ctx.readers.entities.get(id, C.Creature);
  if (creature === undefined) return undefined;
  const species = ctx.registry.table<{ id: string; name: string }>('creatures').byIndex(creature.species);
  const own = creature.name !== '' && creature.name !== species?.id && creature.name !== species?.name;
  return own ? creature.name : species?.name ?? creature.name;
}

/**
 * The line under the list for a selected batch: the box its tiles span, and `Enter` to open it
 * (`19 jobs over (59,51)–(63,53), z27. [Enter] list them.`).
 */
export function batchDetail(ctx: PanelContext, panel: JobsPanel, row: JobRow): string {
  const at = row.jobs.flatMap((j) => {
    const tile = panel.tileOf(ctx, j);
    return tile === null ? [] : [tileXyz(ctx, tile)];
  });
  if (at.length === 0) return ctx.strings.get('ui.jobs.batch_count', { n: row.jobs.length });
  const lo = (k: 'x' | 'y' | 'z'): number => Math.min(...at.map((p) => p[k]));
  const hi = (k: 'x' | 'y' | 'z'): number => Math.max(...at.map((p) => p[k]));
  const z = lo('z') === hi('z') ? `z${lo('z')}` : `z${hi('z')}–${lo('z')}`;
  const box = lo('x') === hi('x') && lo('y') === hi('y') ? `(${lo('x')},${lo('y')})` : `(${lo('x')},${lo('y')})–(${hi('x')},${hi('y')})`;
  return ctx.strings.get('ui.jobs.batch_detail', { n: row.jobs.length, box, z });
}

/** Who holds the job, why it is blocked, or how long it has been open when that is more than a day ("open 41 days"). */
function whoText(ctx: PanelContext, row: JobRow): string {
  const j = row.jobs[0] as JobLike;
  if (j.workerId !== 0) return ctx.readers.entities.get(j.workerId, C.Creature)?.name ?? '';
  if (j.state === 'blocked' && j.blockedReason !== null) return jobBlockText(ctx, j).short;
  if (j.state === 'open') {
    const since = Math.min(...row.jobs.map((job) => job.createdTick));
    const age = ctx.readers.calendar.tick - since;
    if (age > TICKS_PER_DAY) {
      const days = Math.floor(age / TICKS_PER_DAY);
      return ctx.strings.get(`ui.jobs.open_days.${days === 1 ? 'one' : 'many'}`, { n: days });
    }
  }
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
/** The Jobs table's priority and job columns, each with its blank; the reason column takes the rest. */
const PRI_COLS = 4;
const JOB_COLS = 16;

/** A cell's text: whole when it fits `room`, else its shorter form when that fits, else the text (cut by the table as a name). */
function fitCell(text: string, shorter: string, room: number): string {
  if (Array.from(text).length <= room) return text;
  return Array.from(shorter).length <= room ? shorter : text;
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
  const width = rect.cols - 2;
  // The counts and the blocked summary wrap: a large fortress's do not fit one row.
  const counts = wrapText(strings.get('ui.jobs.counts', { open: c.open, claimed: c.claimed, blocked: c.blocked }), width, 2);
  counts.forEach((line, k) => label(s, rect.col + 1, rect.row + k, line, { fg: t.value, width }));
  const filterRow = rect.row + counts.length;
  drawPanelFilter(s, rect.col + 1, filterRow, width, panel.filter, ctx);
  const labors = ctx.registry.table<{ id: string; name: string }>('labors');
  const labor = panel.labor === '' ? strings.get('ui.jobs.filter.all') : labors.byId(panel.labor)?.name ?? panel.labor;
  const cycle = (row: number, text: string, run: () => void): void => {
    label(s, rect.col + 1, row, text, { width });
    s.hit({ col: rect.col + 1, row, cols: width, rows: 1 }, run);
  };
  cycle(filterRow + 1, strings.get('ui.jobs.filter.labor', { key: acceleratorLabel('l', ctx.shiftLetters), labor }), () => panel.cycleLabor(ctx));
  cycle(filterRow + 2, strings.get('ui.jobs.filter.state', { key: acceleratorLabel('s', ctx.shiftLetters), state: strings.get(`ui.jobs.filter.${panel.state}`) }), () => panel.cycleState());
  // The job list is read once a frame: every read copies the whole board.
  const jobs = panel.jobs(ctx);
  const summary = blockedSummary(ctx, jobs);
  const summaryLines = summary === '' ? [] : wrapText(summary, width, 2);
  summaryLines.forEach((line, k) => label(s, rect.col + 1, filterRow + 3 + k, line, { fg: t.dim, width }));
  const top = counts.length + 3 + summaryLines.length;
  const changed = labors.ids().filter(id => reader.laborPriority(id) !== PRIORITY_DEFAULT)
    .map(id => `${labors.byId(id)?.name ?? id} ${reader.laborPriority(id)}`);
  const priorities = wrapText(changed.length ? changed.join(' \u00b7 ') : strings.get('ui.jobs.priorities_default', { priority: PRIORITY_DEFAULT }), width, rect.rows);
  const rows = panel.rows(ctx, jobs);
  const chosenRow = rows[panel.list.selected];
  const chosen = chosenRow?.jobs[0];
  const blockText = chosen !== undefined && chosen.state === 'blocked' && chosen.blockedReason !== null ? jobBlockText(ctx, chosen).long : '';
  // A job open more than a day: why nobody has taken it.
  const waitText = chosen === undefined ? '' : panel.waitLine(ctx, chosen);
  const reason = blockText !== '' ? blockText : waitText;
  const batch = chosenRow !== undefined && chosenRow.jobs.length > 1;
  const detailText = batch ? `${batchDetail(ctx, panel, chosenRow)} ${reason}`.trim() : reason;
  const waiting = panel.waitingOf(orders);
  // Three orders show at a time, each wrapped under itself ("×1 Brew drink · waiting for" / "plant (0)").
  const list = panel.waitingList;
  if (waiting.length === 0) panel.focusWaiting = false;
  clampList(list, waiting.length, WAITING_ROWS);
  const waitingShown = waiting.slice(list.scroll, list.scroll + WAITING_ROWS).map((o) => ({ ...o, lines: wrapHang(keepCounts(o.text), width, 2) }));
  const waitingRows = waiting.length === 0 ? 0 : waitingShown.reduce((n, o) => n + o.lines.length, 0) + 1;
  // The reason wraps over as many rows as it needs, the list giving them up down to its header and one row.
  const detail = detailText === '' ? [] : wrapText(detailText, width, Math.max(2, rect.rows - top - 4 - priorities.length - waitingRows - 2));
  const detailColor = waitText !== '' ? t.value : t.alert;
  const height = Math.max(2, rect.rows - top - 4 - priorities.length - detail.length - waitingRows);
  // The columns keep their widths and cut names only: a job too long for its column is named by its
  // kind ("Haul to depot"), a reason too long by its first word ("waiting"), the whole in the cell's
  // tooltip and, for the selected job, on the line under the list.
  const scrolls = rows.length > height - 1;
  const jobRoom = JOB_COLS - 1;
  const whoRoom = width - PRI_COLS - JOB_COLS - (scrolls ? 1 : 0);
  const cells = rows.map((r) => {
    const j = r.jobs[0] as JobLike;
    const job = r.jobs.length > 1 ? batchText(ctx, panel, r) : jobText(ctx, panel, j);
    const who = whoText(ctx, r);
    const kind = jobTypeName(ctx, ctx.readers.of<JobsReader>('11').typeOf(j.id) ?? '');
    const shownJob = r.jobs.length > 1 ? batchCell(ctx, job, kind, r.jobs.length, jobRoom) : fitCell(job, kind, jobRoom);
    return { job, who, shownJob, shownWho: fitCell(who, who.split(/[:,]/)[0] ?? who, whoRoom) };
  });
  table(
    s,
    { col: rect.col + 1, row: rect.row + top, cols: width, rows: height },
    [
      { title: strings.get('ui.jobs.pri'), width: PRI_COLS },
      { title: strings.get('ui.jobs.job'), width: JOB_COLS },
      { title: strings.get('ui.jobs.who'), width: width - PRI_COLS - JOB_COLS },
    ],
    rows.map((r, k) => [` ${(r.jobs[0] as JobLike).priority}`, cells[k]?.shownJob ?? '', cells[k]?.shownWho ?? '']),
    panel.list,
    (index) => {
      panel.list.selected = index;
    },
  );
  if (jobs.length === 0) wrapLabel(s, rect.col + 1, rect.row + top + 1, strings.get('ui.jobs.empty'), { fg: t.dim, width: rect.cols - 2, maxRows: Math.max(1, height - 1) });
  for (let r = 0; r < height - 1; r += 1) {
    const index = panel.list.scroll + r;
    const job = rows[index]?.jobs[0];
    const cell = cells[index];
    if (!job || cell === undefined) break;
    const at = rect.row + top + 1 + r;
    if (cell.shownJob !== cell.job) s.tooltip({ col: rect.col + 1 + PRI_COLS, row: at, cols: JOB_COLS, rows: 1 }, cell.job);
    if (cell.shownWho !== cell.who) s.tooltip({ col: rect.col + 1 + PRI_COLS + JOB_COLS, row: at, cols: whoRoom, rows: 1 }, cell.who);
    s.hit({ col: rect.col + 1 + PRI_COLS, row: at, cols: JOB_COLS, rows: 1 }, () => {
      panel.list.selected = index;
      const tile = panel.tileOf(ctx, job);
      if (tile !== null) ctx.focusOn(tile);
    });
  }
  let row = rect.row + top + height;
  for (const line of detail) {
    label(s, rect.col + 1, row, line, { fg: detailColor, width: rect.cols - 2, keys: false });
    row += 1;
  }
  if (waiting.length > 0 && orders !== undefined) {
    separator(s, rect.col + 1, row, rect.cols - 2, strings.get('ui.jobs.orders_waiting', { n: waiting.length }));
    row += 1;
    // Three orders show at a time; the cursor (Tab, then up and down) scrolls the rest into view.
    waitingShown.forEach((o, k) => {
      const cells = { col: rect.col + 1, row, cols: rect.cols - 2, rows: o.lines.length };
      o.lines.forEach((line, n) => label(s, cells.col, row + n, line, { fg: t.alert, width: cells.cols, keys: false }));
      if (panel.focusWaiting && list.scroll + k === list.selected) {
        s.invert(cells);
        s.text(rect.col, row, '►', t.value);
      }
      s.hit(cells, () => { list.selected = list.scroll + k; orders.open(o.index); });
      row += o.lines.length;
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
