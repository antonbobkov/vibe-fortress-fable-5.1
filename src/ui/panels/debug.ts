/**
 * The debug panel (`F12`): `ui-screens/panels.md` § Debug — "Per-system timing table (avg, worst),
 * entity counts by kind, active fluid tiles, path requests served and pending, jobs by state, seed
 * and tick, and buttons: `dump save`, `replay season log`, `hash world`." 24 § Panels lists `debug`
 * among the panels and `ui-keymap-and-screens.md` § Fortress panels gives it the hotkey `F12`.
 *
 * The timings are `host.stats()`, which `performance-budget.md` § Measurement defines as the
 * per-system "moving average and last worst case"; `tooling.md` § Debug and replay says the season
 * log is exported here and replayed headless. Every figure is read through a counting reader, never
 * by walking a collection per frame (D-199).
 */

import { ENTITY_KINDS } from '@core/entities';
import type { HostStats } from '@core/world';
import type { Rect } from '@render/cellbuffer';
import type { FluidsReader } from '@systems/fluids';
import type { JobsReader } from '@systems/jobs';
import type { Surface } from '../surface';
import { button, label, separator, tableRow, type Column } from '../widgets';
import type { PanelContext } from './context';

/** What the debug panel needs beyond the readers: the host's timings and its three actions. */
export interface DebugHost {
  stats(): HostStats;
  /** The world seed (`simulation-core.md` § Random numbers). */
  seed(): string;
  /** § Debug: `dump save`. */
  dumpSave(): void;
  /** § Debug: `replay season log` — `tooling.md` exports it for `scripts/replay.mjs`. */
  replaySeasonLog(): void;
  /** § Debug: `hash world`. */
  hashWorld(): void;
}

/** The timing table's columns (avg and worst in milliseconds, three decimals). */
export const TIMING_COLUMNS: readonly Column[] = [
  { title: 'System', width: 12 },
  { title: 'avg ms', width: 9, align: 'right' },
  { title: 'worst ms', width: 9, align: 'right' },
];

export interface TimingRow {
  readonly id: string;
  readonly avgMs: number;
  readonly worstMs: number;
  readonly runs: number;
}

/** One row per registered system, in scheduler order, with the averaged and worst tick cost. */
export function timingRows(stats: HostStats): TimingRow[] {
  return stats.systems.map((s) => ({
    id: s.id,
    avgMs: s.movingAverageMs,
    worstMs: s.rollingWorstMs,
    runs: s.runs,
  }));
}

function ms(value: number): string {
  return value.toFixed(3);
}

export class DebugPanel {
  scroll = 0;

  move(delta: number): void {
    this.scroll = Math.max(0, this.scroll + delta);
  }
}

export function drawDebugPanel(s: Surface, rect: Rect, panel: DebugPanel, ctx: PanelContext, host: DebugHost): void {
  if (rect.rows <= 0) return;
  const t = s.theme;
  const col = rect.col + 1;
  const width = rect.cols - 2;
  const rows = debugLines(ctx, host);
  const visible = Math.max(0, rect.rows - DEBUG_BUTTONS.length);
  panel.scroll = Math.max(0, Math.min(Math.max(0, rows.length - visible), panel.scroll));
  for (let k = 0; k < visible; k += 1) {
    const line = rows[panel.scroll + k];
    s.fill({ col, row: rect.row + k, cols: width, rows: 1 }, t.black);
    if (line === undefined) continue;
    if (line.rule === true) separator(s, col, rect.row + k, width, line.text);
    else label(s, col, rect.row + k, line.text, { fg: line.head === true ? t.key : t.text, width, keys: false });
  }
  // The three buttons take the last rows, one each: the sidebar is `SIDEBAR_COLS` wide.
  DEBUG_BUTTONS.forEach((spec, k) => {
    const row = rect.row + rect.rows - DEBUG_BUTTONS.length + k;
    if (row < rect.row) return;
    s.fill({ col, row, cols: width, rows: 1 }, t.black);
    button(s, col, row, spec.key, spec.text, () => spec.run(host));
  });
}

/** § Debug: the panel's three buttons, with the accelerators the panel keys use. */
export const DEBUG_BUTTONS: readonly { readonly key: string; readonly text: string; readonly run: (host: DebugHost) => void }[] = [
  { key: 'S-d', text: 'dump save', run: (host) => host.dumpSave() },
  { key: 'r', text: 'replay season log', run: (host) => host.replaySeasonLog() },
  { key: 'h', text: 'hash world', run: (host) => host.hashWorld() },
];

interface DebugLine {
  readonly text: string;
  readonly head?: true;
  readonly rule?: true;
}

/** Every line of the panel body, in the order § Debug lists them. */
export function debugLines(ctx: PanelContext, host: DebugHost): DebugLine[] {
  const readers = ctx.readers;
  const stats = host.stats();
  const out: DebugLine[] = [];
  out.push({ text: `seed ${host.seed()}  tick ${stats.tick}`, head: true });
  out.push({ text: `last tick ${ms(stats.lastTickMs)} ms`, head: true });
  out.push({ text: 'Timings', rule: true });
  out.push({ text: tableRow(TIMING_COLUMNS, TIMING_COLUMNS.map((c) => c.title), 32), head: true });
  for (const row of timingRows(stats)) {
    out.push({ text: tableRow(TIMING_COLUMNS, [row.id, ms(row.avgMs), ms(row.worstMs)], 32) });
  }
  out.push({ text: 'Counts', rule: true });
  for (const kind of ENTITY_KINDS) out.push({ text: `${kind} ${readers.entities.countOfKind(kind)}` });
  out.push({ text: `active fluid tiles ${readers.has('04') ? readers.of<FluidsReader>('04').activeCount() : 0}` });
  const pending = readers.has('pathing') ? readers.pathing.requestsPending() : 0;
  const served = readers.has('pathing') ? readers.pathing.requestsServed() : 0;
  out.push({ text: `path requests served ${served}, pending ${pending}` });
  out.push({ text: 'Jobs', rule: true });
  if (readers.has('11')) {
    const counts = readers.of<JobsReader>('11').counts();
    out.push({ text: `open ${counts.open}  claimed ${counts.claimed}  blocked ${counts.blocked}` });
    for (const reason of Object.keys(counts.byReason).sort()) {
      out.push({ text: `  ${reason.replaceAll('_', ' ')} ${counts.byReason[reason] ?? 0}` });
    }
  }
  return out;
}
