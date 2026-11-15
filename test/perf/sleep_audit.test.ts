/**
 * T-551 sleep audit probe: the first 112 days of the three-year economy fixture, played as
 * three_years_seeds plays it, journalling every sleep errand (rest at its start, on lying down and
 * at its end, ticks walking and in bed, floor or bed and the bed's rest percent) and the share of
 * dwarf-time spent on a job (the working time). The same measurement as the T-369 audit
 * (reports/audits/2026-10-21-sleep-hours.md), with the working time added.
 *
 * SLEEP_SEEDS (comma list), SLEEP_DAYS, SLEEP_OUT (a directory), SLEEP_DRESSED=1: every day, put a
 * bedding and a pillow in stock for each built wooden bed that wants them (only where the content has
 * them), so the haulers make the beds up: the "with dressed beds" run. Observation only.
 */
import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { TICKS_PER_DAY } from '@core/constants';
import { C } from '@core/components';
import type { ActivityPlan } from '@systems/dwarves/state';
import { playThreeYears, setupThreeYearsFortress, threeYearsWorld, checkFortressWorkOrders, checkFortressRooms,
  checkFortressCaveFarm, checkFortressDefense } from '../scenarios/three_years_fortress';

const SEEDS = (process.env['SLEEP_SEEDS'] ?? 'three-years,three-years-p0-2,three-years-p0-3').split(',');
const OUT = process.env['SLEEP_OUT'] ?? 'out/sleep';
const DAYS = Number(process.env['SLEEP_DAYS'] ?? 112);
const DRESSED = process.env['SLEEP_DRESSED'] === '1';

interface Episode { start: number; rest0: number; use: number; restUse: number; restEnd: number; slept: boolean; onFloor: boolean; restPercent: number; walkTicks: number; bedTicks: number }

const med = (a: number[]): number | null => { if (a.length === 0) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? null; };
const r2 = (x: number): number => Math.round(x * 100) / 100;

describe('T-551 sleep audit', () => {
  it.each(SEEDS)('journals %s', (seed) => {
    const peril = Number(/-p(\d)-/.exec(seed)?.[1] ?? 0);
    mkdirSync(OUT, { recursive: true });
    const w = threeYearsWorld(seed, peril);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const plans = (w.game.world.scheduler.byId('10') as unknown as { activities: { plans: Map<number, ActivityPlan> } }).activities.plans;
    const open = new Map<number, Episode>();
    const episodes: Episode[] = [];
    const slept = new Map<number, { onFloor: boolean; rest: number }>();
    w.game.world.onEvents((events) => {
      for (const e of events) if (e.type === 'Slept') slept.set(Number(e['id']), { onFloor: e['onFloor'] === true, rest: Number(e['rest'] ?? (e['onFloor'] === true ? 100 : 100)) });
    });
    let dwarfTicks = 0, walkTicks = 0, bedTicks = 0, workTicks = 0;
    const watch = (): void => {
      for (const id of ent.with(C.Labors)) {
        if (ent.get(id, C.Creature)?.faction !== 'fortress') continue;
        dwarfTicks += 1;
        if ((ent.get(id, C.Worker)?.jobId ?? 0) !== 0 && ent.get(id, C.Brain)?.behavior === 'work') workTicks += 1;
        const p = plans.get(id);
        const rest = ent.get(id, C.Needs)?.rest ?? -1;
        let ep = open.get(id);
        if (p !== undefined && p.need === 'rest') {
          if (ep === undefined) {
            ep = { start: w.tick, rest0: rest, use: -1, restUse: -1, restEnd: -1, slept: false, onFloor: false, restPercent: 0, walkTicks: 0, bedTicks: 0 };
            open.set(id, ep);
          }
          if (p.phase === 'use') { if (ep.use < 0) { ep.use = w.tick; ep.restUse = rest; } ep.bedTicks += 1; bedTicks += 1; } else { ep.walkTicks += 1; walkTicks += 1; }
        } else if (ep !== undefined) {
          const s = slept.get(id);
          ep.restEnd = rest; ep.slept = s !== undefined; ep.onFloor = s?.onFloor ?? false; ep.restPercent = s?.rest ?? 0;
          episodes.push(ep); open.delete(id);
        }
      }
      slept.clear();
    };
    const items = w.game.registry.table('items');
    const dress = DRESSED && items.has('bedding') && items.has('pillow');
    const original = w.game.world.step.bind(w.game.world);
    w.game.world.step = () => { original(); watch(); };
    const end = DAYS * TICKS_PER_DAY;
    let dressedDay = -1;
    while (w.tick < end) {
      playThreeYears(w, state, Math.min(300, end - w.tick));
      checkFortressWorkOrders(w, state); checkFortressRooms(w, state); checkFortressCaveFarm(w, state); checkFortressDefense(w, state);
      const today = Math.floor(w.tick / TICKS_PER_DAY);
      if (dress && today !== dressedDay) {
        dressedDay = today;
        // One bedding and one pillow, in linen, by the first dwarf, for each bed not yet made up and
        // not yet sent for: the haulers carry them to the beds.
        const b = w.game.world.readers.of<{ byType(type: string): readonly number[]; get(id: number): { state: string } | undefined;
          wants(id: number): readonly { match: string; count: number; held: number; coming: number }[] }>('14');
        let bedding = 0, pillows = 0;
        for (const id of b.byType('bed')) {
          const row = b.get(id);
          if (row?.state !== 'built') continue;
          for (const want of b.wants(id)) {
            const short = want.count - want.held - want.coming;
            if (short <= 0) continue;
            if (want.match === 'bedding') bedding += short; else if (want.match === 'pillow') pillows += short;
          }
        }
        const someone = ent.with(C.Labors).find((id) => ent.get(id, C.Creature)?.faction === 'fortress');
        const pos = someone === undefined ? undefined : ent.get(someone, C.Position);
        if (pos !== undefined) {
          const at = w.index(pos.x, pos.y, pos.z);
          const have = (type: string): number => w.game.world.readers.of<{ available?(type: string): number }>('13').available?.(type) ?? 0;
          for (let i = have('bedding'); i < bedding; i += 1) w.spawnItem('bedding', 'flax_cloth', at, 1, 1);
          for (let i = have('pillow'); i < pillows; i += 1) w.spawnItem('pillow', 'flax_cloth', at, 1, 1);
        }
      }
    }
    const eps = episodes;
    const done = eps.filter((e) => e.use >= 0);
    const summary = {
      seed, days: DAYS, dressed: dress,
      dwarfDays: r2(dwarfTicks / TICKS_PER_DAY),
      workShare: r2(100 * workTicks / dwarfTicks),
      errandsPerDwarfDay: r2(eps.length / (dwarfTicks / TICKS_PER_DAY)),
      hoursPerDayWalk: r2(24 * walkTicks / dwarfTicks), hoursPerDayBed: r2(24 * bedTicks / dwarfTicks),
      hoursPerDaySleepErrand: r2(24 * (walkTicks + bedTicks) / dwarfTicks),
      errands: eps.length, reachedBed: done.length, onFloor: eps.filter((e) => e.onFloor).length,
      byRest: Object.fromEntries([...new Set(eps.map((e) => e.restPercent))].sort((a, b) => a - b).map((r) => [String(r), eps.filter((e) => e.restPercent === r).length])),
      restAtStartMedian: med(eps.map((e) => e.rest0)), restAtBedMedian: med(done.map((e) => e.restUse)),
      bedTicksMedian: med(done.map((e) => e.bedTicks)), bedTicksMax: done.length > 0 ? Math.max(...done.map((e) => e.bedTicks)) : 0,
      bedTicksMedianFloor: med(done.filter((e) => e.onFloor).map((e) => e.bedTicks)),
      bedTicksMedianBed: med(done.filter((e) => e.slept && !e.onFloor).map((e) => e.bedTicks)),
      bedTicksMedianMadeUp: med(done.filter((e) => e.restPercent > 100).map((e) => e.bedTicks)),
      endedAtRestZero: eps.filter((e) => e.restEnd === 0).length,
    };
    console.log(`SLEEP_AUDIT ${JSON.stringify(summary)}`);
    writeFileSync(`${OUT}/${seed}${dress ? '-dressed' : ''}.json`, `${JSON.stringify({ summary, episodes: eps.length }, null, 1)}\n`);
  });
});
