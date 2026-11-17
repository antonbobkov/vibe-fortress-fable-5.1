/**
 * T-580's probe of the surface work an ambush finds: plays three-year seeds (`T580_SEEDS`,
 * comma-separated, default `three-years-p4-1`) at `THREE_YEARS_SHIFT` to day `T580_DAYS` (default
 * a year) with the sweep's loop, and from the first day ambushes are possible (year 1 autumn) notes
 * every `WATCH_EVERY` ticks each fortress dwarf on an outdoor tile: what it is doing and how far it
 * stands from the gate stair. It prints the dwarf-samples by activity, near the gate (under
 * `NEAR` tiles) and far, and the ambush census rows of the run. Local diagnosis only; not part of
 * `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import { TICKS_PER_DAY, DAYS_PER_YEAR } from '@core/constants';
import type { JobsReader } from '@systems/jobs';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
} from '../scenarios/three_years_fortress';

const SEEDS = (process.env['T580_SEEDS'] ?? 'three-years-p4-1').split(',');
const DAYS = Number(process.env['T580_DAYS'] ?? String(DAYS_PER_YEAR));
const SHIFT = Number(process.env['THREE_YEARS_SHIFT'] ?? '0');
const FROM_DAY = DAYS_PER_YEAR / 2;
const NEAR = 8;
const peril = (seed: string): number => Number(/-p(\d)-/.exec(seed)?.[1] ?? '4');

describe('T-580 probe: who works outdoors once ambushes are possible', () => {
  it.each(SEEDS)('%s', (seed) => {
    const w = threeYearsWorld(seed, peril(seed));
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const jobs = w.readers.of<JobsReader>('11');
    const gate = { x: state.cx + 6, y: state.cy + 6 };
    const near = new Map<string, number>();
    const far = new Map<string, number>();
    const farBand = new Map<number, number>();
    let samples = 0;
    const census: string[] = [];
    const log = console.log;
    console.log = (...a: unknown[]): void => {
      const s = a.map(String).join(' ');
      if (s.startsWith('[three_years_ambush]')) census.push(s.replace(/^\[three_years_ambush\] \S+ /, ''));
    };
    const moves: Record<string, number> = {};
    const sample = (): void => {
      for (const [k, id] of Object.entries(state.placedIds)) {
        const b = w.readers.of<BuildingsReader>('14').get(id);
        if (moves[k] === undefined && b !== undefined && b.state === 'built' && !w.map.hasFlag(b.footprint[0]!, TileFlag.Outdoor)) moves[k] = Math.floor(w.tick / TICKS_PER_DAY);
      }
      if (w.tick < FROM_DAY * TICKS_PER_DAY) return;
      samples += 1;
      for (const id of ent.with(C.Labors)) {
        if (!ent.alive(id) || ent.get(id, C.Creature)?.faction !== 'fortress') continue;
        const q = ent.get(id, C.Position);
        if (!q || !w.map.hasFlag(w.index(q.x, q.y, q.z), TileFlag.Outdoor)) continue;
        const jid = ent.get(id, C.Worker)?.jobId ?? 0;
        const what = (jid !== 0 ? jobs.typeOf(jid) : null) ?? `${ent.get(id, C.Brain)?.behavior ?? '?'}:${ent.get(id, C.Brain)?.activity ?? '?'}`;
        const d = Math.max(Math.abs(q.x - gate.x), Math.abs(q.y - gate.y));
        const m = d < NEAR ? near : far;
        m.set(what, (m.get(what) ?? 0) + 1);
        if (d >= NEAR) farBand.set(Math.floor(d / 4) * 4, (farBand.get(Math.floor(d / 4) * 4) ?? 0) + 1);
      }
    };
    try {
      while (w.tick < DAYS * TICKS_PER_DAY) {
        playThreeYears(w, state, Math.min(300, DAYS * TICKS_PER_DAY - w.tick), sample);
        checkFortressWorkOrders(w, state);
        checkFortressRooms(w, state);
        checkFortressCaveFarm(w, state);
        checkFortressDefense(w, state);
      }
    } finally {
      console.log = log;
    }
    const fmt = (m: Map<string, number>): string => [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / Math.max(1, samples)).toFixed(2)}`).join(', ');
    const sum = (m: Map<string, number>): number => [...m.values()].reduce((s, v) => s + v, 0) / Math.max(1, samples);
    const living = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;
    const deaths = census.reduce((s, c) => s + Number((JSON.parse(c) as { deaths: number }).deaths), 0);
    const buildings = w.readers.of<BuildingsReader>('14');
    const shops = Object.entries(state.placedIds).map(([k, id]) => {
      const b = buildings.get(id);
      return `${k}:${b === undefined ? 'gone' : `${b.state === 'built' ? '' : b.state + '@'}${w.map.hasFlag(b.footprint[0]!, TileFlag.Outdoor) ? 'S' : 'B'}`}`;
    });
    const hall = state.economy.workHall?.tiles ?? [];
    const out = [
      `[t580] ${seed} shift ${SHIFT} day ${DAYS} living ${living} ambushes ${census.length} ambush deaths ${deaths}`,
      `  hall dug ${hall.filter((t) => w.map.kindAt(t) === TileKind.Floor).length}/${hall.length}, moved on days ${JSON.stringify(moves)}; shops ${shops.join(' ')}`,
      `  outdoors per sample: near ${sum(near).toFixed(2)} far ${sum(far).toFixed(2)}`,
      `  far by band: ${[...farBand].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}+ ${(v / Math.max(1, samples)).toFixed(2)}`).join(', ')}`,
      `  far: ${fmt(far)}`,
      `  near: ${fmt(near)}`,
      ...census.map((c) => `  ${c}`),
    ];
    log(out.join('\n'));
    expect(samples).toBeGreaterThan(0);
  }, 7_200_000);
});
