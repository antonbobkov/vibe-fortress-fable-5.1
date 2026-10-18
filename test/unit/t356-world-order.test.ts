/**
 * T-356: a seed's run does not depend on what ran before it in the same process. The sweep runs its
 * seeds one after another in one process; any state that outlived a world (a module cache, the shared
 * content registry, a counter) would bias every later seed. The first run in this file is a fresh
 * process's run (vitest isolates test files).
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { playThreeYears, setupThreeYearsFortress, threeYearsWorld, checkFortressWorkOrders, checkFortressRooms,
  checkFortressCaveFarm, checkFortressDefense } from '../scenarios/three_years_fortress';
import { watchInvariants } from '../scenarios/invariants';

// Two days: the run is three-years' opening only. It does not reach the first season turn or the first caravan (about
// day 34), so state that outlives a world and shows only there (a caravan's counters, a season's caches) is guarded by
// the sweep itself, which runs seeds one after another in one process and prints each final hash.
const DAYS = 2;

function hashes(seed: string, peril: number): string[] {
  const w = threeYearsWorld(seed, peril);
  const stop = watchInvariants(w.game, () => {});
  const state = setupThreeYearsFortress(w);
  const out = [w.game.hash()];
  while (w.tick < DAYS * TICKS_PER_DAY) {
    playThreeYears(w, state, 100);
    checkFortressWorkOrders(w, state); checkFortressRooms(w, state); checkFortressCaveFarm(w, state); checkFortressDefense(w, state);
    if (w.tick % 600 === 0) out.push(w.game.hash());
  }
  stop();
  return out;
}

describe('T-356 two worlds in one process', () => {
  it('a sweep seed played after another seed equals its fresh run, hash for hash', () => {
    const fresh = hashes('three-years-p2-6', 2);
    hashes('three-years-p4-4', 4);
    expect(hashes('three-years-p2-6', 2)).toEqual(fresh);
  }, 120_000);
});
