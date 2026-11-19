import { describe, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { CombatReader } from '@systems/combat/reader';
import { weaponOf } from '@systems/combat/melee';
import type { BuildingsReader } from '@systems/buildings/reader';
import {
  checkFortressCaveFarm, checkFortressRooms, checkFortressWorkOrders, playThreeYears, setupThreeYearsFortress, threeYearsWorld,
} from '../scenarios/three_years_fortress';

/**
 * T-606: the training pace in a fortress. Plays one three-year seed to `T606_DAYS` and, for every
 * member of a squad in `train` mode, counts its training sessions and weapon experience, and where its
 * time goes (sampled every 20 ticks): at the barracks on duty, on duty elsewhere (walking there),
 * sleeping, eating or drinking, other needs, in hospital, fleeing or sheltering, and under an alert
 * (no training). A measurement, not a gate: it runs only with `T606_PROBE=1`, e.g.
 *   T606_PROBE=1 T606_SEED=three-years-p2-1 T606_PERIL=2 T606_DAYS=250 npx vitest run -c vitest.perf.config.ts test/perf/t606_pace_probe.test.ts
 */
const RUN = process.env['T606_PROBE'] === '1';
const SEED = process.env['T606_SEED'] ?? 'three-years-p2-1';
const PERIL = Number(process.env['T606_PERIL'] ?? '2');
const DAYS = Number(process.env['T606_DAYS'] ?? '250');
const TRACE = Number(process.env['T606_TRACE'] ?? '0');

interface Tally {
  samples: number; sessions: number; xp: number; buckets: Record<string, number>; firstDay: number; lastLevel: number; reached10: number;
  /** T-615: need errands begun, by need; sleeps on the floor and in a bed; and sums of speed, armour, health speed and mood over the samples. */
  errands: Record<string, number>; last: string; floor: number; bed: number; talks: number; speed: number; armor: number; health: number; mood: number;
}

describe.skipIf(!RUN)('T-606 pace probe', () => {
  it(`plays ${SEED} to day ${DAYS} and prints the training pace`, () => {
    const w = threeYearsWorld(SEED, PERIL);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const reg = w.game.registry;
    const combat = w.readers.of<CombatReader>('16');
    const buildings = w.readers.of<BuildingsReader>('14');
    const skills = reg.table('skills');
    const tallies = new Map<number, Tally>();
    const training = new Set<number>();
    const lastXp = new Map<number, number>();
    w.game.world.onEvents((batch) => {
      for (const e of batch) {
        if (e.type === 'Slept') {
          const t = tallies.get(Number(e['id']));
          if (t !== undefined && training.has(Number(e['id']))) { if (e['onFloor'] === true) t.floor += 1; else t.bed += 1; }
        }
        if (e.type === 'Talked') for (const k of ['a', 'b']) { const t = tallies.get(Number(e[k])); if (t !== undefined && training.has(Number(e[k]))) t.talks += 1; }
        if (e.type !== 'TrainingSession') continue;
        for (const m of e['members'] as number[]) {
          const t = tallies.get(m);
          if (t !== undefined) t.sessions += 1;
        }
      }
    });
    const sample = (): void => {
      const day = w.tick / TICKS_PER_DAY;
      const calm = w.game.world.fortress.alert === 'calm';
      training.clear();
      for (const sq of combat.squads()) {
        if (sq.mode !== 'train') continue;
        const zone = buildings.zone((sq as { barracksZoneId?: number }).barracksZoneId ?? 0);
        for (const m of sq.members) {
          if (!ent.alive(m)) continue;
          training.add(m);
          let t = tallies.get(m);
          if (t === undefined) { t = { samples: 0, sessions: 0, xp: 0, buckets: {}, firstDay: day, lastLevel: 0, reached10: -1, errands: {}, last: '', floor: 0, bed: 0, talks: 0, speed: 0, armor: 0, health: 0, mood: 0 }; tallies.set(m, t); }
          t.samples += 1;
          const wp = weaponOf(ent, reg, m);
          const sk = ent.get(m, C.Skills);
          if (wp !== null && wp !== undefined && sk !== undefined) {
            const s = skills.index(wp.weaponDef.skill);
            const x = sk.xp[s] ?? 0;
            const prev = lastXp.get(m * 100 + s);
            if (prev !== undefined && x > prev) t.xp += x - prev;
            lastXp.set(m * 100 + s, x);
            t.lastLevel = sk.level[s] ?? 0;
            if (t.lastLevel >= 10 && t.reached10 < 0) t.reached10 = day;
          }
          const brain = ent.get(m, C.Brain);
          const p = ent.get(m, C.Position);
          const tile = p === undefined ? -1 : w.map.index(p.x, p.y, p.z);
          let b: string;
          if (!calm) b = 'alert';
          else if (brain === undefined) b = 'none';
          else if (brain.behavior === 'need') {
            const a = brain.activity.toLowerCase();
            b = a.includes('sleep') || a.includes('bed') || a.includes('rest') ? 'sleep' : a.includes('eat') || a.includes('food') || a.includes('meal') ? 'eat' : a.includes('drink') ? 'drink' : `need:${a.split(' ').slice(0, 2).join(' ')}`;
          } else if (brain.behavior === 'duty') b = zone?.tiles.includes(tile) ? 'barracks' : 'duty-away';
          else b = brain.behavior;
          t.buckets[b] = (t.buckets[b] ?? 0) + 1;
          if (b !== t.last && b !== 'barracks' && b !== 'duty-away' && b !== 'alert') t.errands[b] = (t.errands[b] ?? 0) + 1;
          t.last = b;
          t.speed += ent.get(m, C.Motion)?.speed ?? 0;
          t.armor += combat.armorSpeedModifier(m);
          t.health += w.readers.has('17') ? w.readers.of<{ speedModifier(id: number): number }>('17').speedModifier(m) : 100;
          t.mood += ent.get(m, C.Mood)?.value ?? 0;
          if (TRACE > 0 && day >= TRACE && day < TRACE + 1) {
            const mv = ent.get(m, C.Motion);
            console.log(`[t606trace] ${w.tick} ${m} ${b} ${brain?.activity ?? ''} at ${p ? `${p.x},${p.y},${p.z}` : '-'} path ${mv?.pathId ?? '-'}:${mv?.stepIndex ?? '-'} wait ${mv?.waitUntil ?? '-'} zone0 ${zone?.tiles[0] ?? '-'}`);
          }
        }
      }
    };
    while (w.tick < DAYS * TICKS_PER_DAY) {
      playThreeYears(w, state, 300, sample);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
    }
    const all: Tally = { samples: 0, sessions: 0, xp: 0, buckets: {}, firstDay: 0, lastLevel: 0, reached10: 0, errands: {}, last: '', floor: 0, bed: 0, talks: 0, speed: 0, armor: 0, health: 0, mood: 0 };
    for (const [id, t] of tallies) {
      const days = (t.samples * 20) / TICKS_PER_DAY;
      const frac = Object.fromEntries(Object.entries(t.buckets).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round((1000 * v) / t.samples) / 10]));
      const attrs = ent.get(id, C.Attributes);
      const per = (n: number): number => Math.round((10 * n) / days) / 10;
      console.log(`[t615] ${SEED} ${JSON.stringify({ id, agi: attrs?.agi, end: attrs?.end, speed: Math.round(t.speed / t.samples), armor: Math.round(t.armor / t.samples), health: Math.round(t.health / t.samples),
        mood: Math.round(t.mood / t.samples), floorSleeps: t.floor, bedSleeps: t.bed, talksPerDay: per(t.talks), errandsPerDay: Object.fromEntries(Object.entries(t.errands).map(([k, v]) => [k, per(v)])) })}`);
      console.log(`[t606] ${SEED} ${JSON.stringify({ id, weapon: weaponOf(ent, reg, id)?.weaponDef.id ?? null, from: Math.floor(t.firstDay), daysTraining: Math.round(days), sessionsPerDay: Math.round((100 * t.sessions) / days) / 100, xpPerDay: Math.round((10 * t.xp) / days) / 10, level: t.lastLevel, reached10: Math.floor(t.reached10), frac })}`);
      all.samples += t.samples; all.sessions += t.sessions; all.xp += t.xp;
      for (const [k, v] of Object.entries(t.buckets)) all.buckets[k] = (all.buckets[k] ?? 0) + v;
    }
    const days = (all.samples * 20) / TICKS_PER_DAY;
    const frac = Object.fromEntries(Object.entries(all.buckets).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round((1000 * v) / all.samples) / 10]));
    console.log(`[t606] ${SEED} ALL ${JSON.stringify({ soldierDays: Math.round(days), sessionsPerDay: Math.round((100 * all.sessions) / Math.max(1, days)) / 100, xpPerDay: Math.round((10 * all.xp) / Math.max(1, days)) / 10, frac })}`);
  }, 3_600_000);
});
