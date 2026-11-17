/**
 * T-570's probe: how long the fixtures' routine jobs wait open, and what holds the raw stone.
 *
 * Plays one three-year seed (at a timeline shift) or the `defence_year` script, and samples the job
 * board every `SAMPLE_TICKS`. A job that is `open` (not claimed, not blocked) at a sample starts an
 * open spell, which ends at the first sample that finds it claimed, blocked or gone. Spells are
 * grouped by job type and the building it targets (`craft@mechanic`, `build@chair`), so a workshop's
 * job that stood open for months shows as one long spell. It also samples the raw stone owned, the
 * raw stone available, and what holds the rest (the depot, a job's reservation, a forbid).
 *
 * Run on GitHub: `gh workflow run measure.yml --ref <branch> -f suite=job_waits` (one job per seed;
 * `PROBE_SEED`, `PROBE_SHIFT`, `PROBE_OUT` set by the job; a seed of `defence` plays `defence_year`).
 * Not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { C } from '@core/components';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import { ItemFlag } from '@core/components';
import type { TestWorld } from '../scenarios/test-world';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
} from '../scenarios/three_years_fortress';
import { playDefenceYear } from '../scenarios/defence_year_fortress';

const SEED = process.env['PROBE_SEED'] ?? 'three-years-p2-6';
const SHIFT = Number(process.env['PROBE_SHIFT'] ?? '0');
const OUT = process.env['PROBE_OUT'];
const DAYS = Number(process.env['PROBE_DAYS'] ?? String(3 * DAYS_PER_YEAR));
/** Ticks between two looks at the board: a twelfth of a day. */
const SAMPLE_TICKS = 100;

interface Spell { readonly cat: string; readonly start: number; readonly end: number; readonly how: string; readonly prio: number }

export interface CategoryFigures {
  readonly spells: number;
  /** Days, one decimal. */
  readonly meanWait: number;
  readonly p90Wait: number;
  readonly maxWait: number;
  /** Job-days open over the run. */
  readonly openDays: number;
  /** Spells that lasted 10 days or more. */
  readonly over10: number;
  /** Effective priority of the longest spell's job (job + labor shift). */
  readonly prio: number;
}

export class JobWaitWatch {
  private readonly since = new Map<number, { start: number; cat: string; prio: number }>();
  readonly spells: Spell[] = [];
  readonly stone: { day: number; owned: number; available: number; depot: number; depotHaul: number; reserved: Record<string, number>; forbidden: number }[] = [];

  constructor(readonly w: TestWorld) {}

  private category(job: { type: number; target: { kind: string; ref: number } }): string {
    const type = this.w.game.registry.table<{ id: string }>('jobTypes').byIndex(job.type)?.id ?? String(job.type);
    if (job.target.kind === 'building') {
      const b = this.w.readers.of<BuildingsReader>('14').get(job.target.ref);
      if (b) return `${type}@${b.typeId}`;
    }
    return type;
  }

  private lastSample = -Infinity;
  private lastStoneDay = -1;

  /** Looks at the board when SAMPLE_TICKS have passed since the last look. */
  maybeSample(): void {
    if (this.w.tick - this.lastSample >= SAMPLE_TICKS) this.sample();
  }

  sample(): void {
    this.lastSample = this.w.tick;
    const jobs = this.w.readers.of<JobsReader>('11');
    const labors = this.w.game.registry.table<{ id: string }>('labors');
    const jobTypes = this.w.game.registry.table<{ id: string; labor: string }>('jobTypes');
    const open = new Set<number>();
    for (const job of jobs.list('open')) {
      open.add(job.id);
      if (!this.since.has(job.id)) {
        const labor = typeof job.data['labor'] === 'string' ? job.data['labor'] : jobTypes.byIndex(job.type)?.labor;
        const shift = labor && labors.index(labor) > 0 ? jobs.laborPriority(labor) - 5 : 0;
        this.since.set(job.id, { start: this.w.tick, cat: this.category(job), prio: job.priority + shift });
      }
    }
    for (const [id, s] of this.since) {
      if (open.has(id)) continue;
      const job = jobs.get(id);
      this.spells.push({ cat: s.cat, start: s.start, end: this.w.tick, how: job ? job.state : 'gone', prio: s.prio });
      this.since.delete(id);
    }
    const day = Math.floor(this.w.tick / TICKS_PER_DAY);
    if (day !== this.lastStoneDay) { this.lastStoneDay = day; this.sampleStone(); }
  }

  private sampleStone(): void {
    const ent = this.w.game.world.entities;
    const items = this.w.readers.of<ItemsReader>('13');
    const jobs = this.w.readers.of<JobsReader>('11');
    const rawStone = this.w.game.registry.table('items').index('raw_stone');
    let owned = 0; let depot = 0; let depotHaul = 0; let forbidden = 0;
    const reserved: Record<string, number> = {};
    for (const id of ent.with(C.Item)) {
      const it = ent.get(id, C.Item)!;
      if (it.type !== rawStone || (it.flags & (ItemFlag.Merchant | ItemFlag.Foreign)) !== 0) continue;
      owned += it.count;
      if ((it.flags & ItemFlag.AtDepot) !== 0) depot += it.count;
      else if (jobs.byKey(`depot:${id}`)) depotHaul += it.count;
      else if (it.reservedBy !== 0) {
        const job = jobs.get(it.reservedBy);
        const cat = job ? this.category(job) : 'unknown';
        reserved[cat] = (reserved[cat] ?? 0) + it.count;
      } else if ((it.flags & ItemFlag.Forbidden) !== 0) forbidden += it.count;
    }
    this.stone.push({ day: Math.floor(this.w.tick / TICKS_PER_DAY) + 1, owned, available: items.available('raw_stone'), depot, depotHaul, reserved, forbidden });
  }

  /** Closes every spell still open at the end, as `open`. */
  finish(): void {
    for (const [id, s] of this.since) this.spells.push({ cat: s.cat, start: s.start, end: this.w.tick, how: `still open (job ${id})`, prio: s.prio });
    this.since.clear();
  }

  figures(): Record<string, CategoryFigures> {
    const by = new Map<string, Spell[]>();
    for (const s of this.spells) by.set(s.cat, [...(by.get(s.cat) ?? []), s]);
    const out: Record<string, CategoryFigures> = {};
    const d = (t: number): number => Math.round((t / TICKS_PER_DAY) * 10) / 10;
    for (const [cat, list] of [...by].sort(([a], [b]) => a.localeCompare(b))) {
      const waits = list.map((s) => s.end - s.start).sort((a, b) => a - b);
      const longest = list.reduce((m, s) => (s.end - s.start > m.end - m.start ? s : m), list[0]!);
      out[cat] = {
        spells: list.length,
        meanWait: d(waits.reduce((a, b) => a + b, 0) / waits.length),
        p90Wait: d(waits[Math.min(waits.length - 1, Math.floor(waits.length * 0.9))]!),
        maxWait: d(waits[waits.length - 1]!),
        openDays: d(waits.reduce((a, b) => a + b, 0)),
        over10: waits.filter((t) => t >= 10 * TICKS_PER_DAY).length,
        prio: longest.prio,
      };
    }
    return out;
  }
}

function playSeed(seed: string, shift: number, days: number): { w: TestWorld; watch: JobWaitWatch } {
  const ticks = days * TICKS_PER_DAY;
  if (seed === 'defence') {
    let watch: JobWaitWatch | undefined;
    const { w } = playDefenceYear({
      ticks: Math.min(ticks, 2 * DAYS_PER_YEAR * TICKS_PER_DAY),
      observe: (tw) => { watch = new JobWaitWatch(tw); },
      watch: () => watch?.maybeSample(),
    });
    watch!.finish();
    return { w, watch: watch! };
  }
  const peril = Number(/-p(\d)-/.exec(seed)?.[1] ?? '0');
  const w = threeYearsWorld(seed, peril);
  if (shift > 0) w.step(shift);
  const state = setupThreeYearsFortress(w);
  const watch = new JobWaitWatch(w);
  while (w.tick < ticks) {
    playThreeYears(w, state, Math.min(w.tick < 20 * TICKS_PER_DAY ? 100 : 300, ticks - w.tick), () => watch.maybeSample());
    checkFortressWorkOrders(w, state);
    checkFortressRooms(w, state);
    checkFortressCaveFarm(w, state);
    checkFortressDefense(w, state);
  }
  watch.finish();
  return { w, watch };
}

describe('T-570 probe: how long routine jobs wait', () => {
  it(`${SEED} shift ${SHIFT}`, () => {
    const { w, watch } = playSeed(SEED, SHIFT, DAYS);
    const figures = watch.figures();
    const ent = w.game.world.entities;
    const population = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;
    const longest = watch.spells.filter((s) => s.end - s.start >= 20 * TICKS_PER_DAY)
      .map((s) => ({ cat: s.cat, fromDay: Math.floor(s.start / TICKS_PER_DAY) + 1, days: Math.round((s.end - s.start) / TICKS_PER_DAY), how: s.how, prio: s.prio }))
      .sort((a, b) => b.days - a.days).slice(0, 40);
    const result = { seed: SEED, shift: SHIFT, days: DAYS, population, figures, longest, stone: watch.stone.filter((s) => s.day % 7 === 0) };
    const table = Object.entries(figures).filter(([, f]) => f.maxWait >= 5)
      .map(([cat, f]) => `${cat.padEnd(34)} n=${f.spells} mean=${f.meanWait} p90=${f.p90Wait} max=${f.maxWait} >10d=${f.over10} prio=${f.prio}`).join('\n');
    console.log(`[t570] ${SEED} shift ${SHIFT}, population ${population}\n${table}\nlongest: ${JSON.stringify(longest)}`);
    console.log(`[t570 stone] ${JSON.stringify(result.stone)}`);
    if (OUT) {
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
    }
    expect(watch.spells.length).toBeGreaterThan(0);
  });
});
