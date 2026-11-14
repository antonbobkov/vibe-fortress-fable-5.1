/**
 * T-545: dangerous wildlife comes rarely (08 § Wild spawning). After a dangerous group arrives, no
 * dangerous species rolls to spawn for `DANGEROUS_QUIET_DAYS`, except on a `beastwood` map; the
 * other species roll as ever, and the quiet spell is saved.
 */

import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SPEC, buildFlatTestMap } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { DAYS_PER_SEASON, DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import { DANGEROUS_QUIET_DAYS, WILD_LIFETIME_DAYS } from '@systems/animals/constants';
import { dailySpawn, dangerousQuiet, regionSurfaceSpecies, surfaceCap, type AnimalsSystem, type SpawnHost } from '@systems/animals';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();

function newWorld(seed: string, biome: string, traits: string[]): TestWorld {
  const spec = { ...FLAT_TEST_SPEC, traits, biome };
  const w = new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 64, 64), embark: 'none', spec });
  w.step(1);
  return w;
}

interface Arrival {
  readonly day: number;
  readonly species: string;
  readonly dangerous: boolean;
}

/**
 * Spawning alone, day by day, over the system's own host and stream: the wild animals are a ledger
 * that leaves at `WILD_LIFETIME_DAYS` or over its cap, and nothing is killed.
 */
function arrivals(w: TestWorld, years: number): Arrival[] {
  const base = w.animals.spawner;
  const live: { species: number; day: number }[] = [];
  let today = 0;
  let next = 1_000_000;
  const host = Object.create(base) as SpawnHost;
  Object.assign(host, {
    countWild: (s: number) => live.filter((a) => a.species === s).length,
    creatureCount: () => live.length,
    dwarfTiles: () => [],
    spawn: (s: number) => {
      live.push({ species: s, day: today });
      return next++ as EntityId;
    },
  });
  const out: Arrival[] = [];
  for (let day = 0; day < years * DAYS_PER_YEAR; day += 1) {
    today = day;
    const season = Math.floor(day / DAYS_PER_SEASON) % 4;
    for (const g of dailySpawn(host, season, day * TICKS_PER_DAY)) {
      out.push({ day, species: host.facts.idOf(g.species), dangerous: host.facts.isDangerous(g.species) });
    }
    const caps = new Map<number, number>();
    for (const [s, weight] of regionSurfaceSpecies(host, season)) caps.set(s, surfaceCap(host, s, weight));
    const seen = new Map<number, number>();
    for (let i = 0; i < live.length;) {
      const a = live[i] as { species: number; day: number };
      const n = (seen.get(a.species) ?? 0) + 1;
      seen.set(a.species, n);
      if (day - a.day > WILD_LIFETIME_DAYS || n > (caps.get(a.species) ?? 0)) live.splice(i, 1);
      else i += 1;
    }
  }
  return out;
}

function gaps(list: readonly Arrival[]): number[] {
  const days = list.filter((a) => a.dangerous).map((a) => a.day);
  return days.slice(1).map((d, k) => d - (days[k] as number));
}

describe('T-545 dangerous wildlife comes rarely', () => {
  it('after a dangerous group arrives, no dangerous group spawns for DANGEROUS_QUIET_DAYS; the rest keep coming', () => {
    for (const seed of ['t545-a', 't545-b', 't545-c']) {
      const list = arrivals(newWorld(seed, 'temperate_forest', []), 3);
      const dangerous = list.filter((a) => a.dangerous);
      expect(dangerous.length).toBeGreaterThanOrEqual(3);
      for (const gap of gaps(list)) expect(gap).toBeGreaterThanOrEqual(DANGEROUS_QUIET_DAYS);
      // The harmless species do not keep quiet: some arrive within a quiet spell.
      const inQuiet = list.filter((a) => !a.dangerous && dangerous.some((d) => a.day > d.day && a.day - d.day < DANGEROUS_QUIET_DAYS));
      expect(inQuiet.length).toBeGreaterThan(0);
    }
  });

  it('an ordinary temperate forest sees about one dangerous group a season; beastwood sees them far more often', () => {
    let ordinary = 0;
    let beastwood = 0;
    const seeds = ['t545-1', 't545-2', 't545-3', 't545-4', 't545-5'];
    for (const seed of seeds) {
      ordinary += arrivals(newWorld(seed, 'temperate_forest', []), 2).filter((a) => a.dangerous).length;
      const wild = arrivals(newWorld(seed, 'temperate_forest', ['beastwood']), 2);
      beastwood += wild.filter((a) => a.dangerous).length;
      expect(gaps(wild).some((gap) => gap < DANGEROUS_QUIET_DAYS)).toBe(true);
    }
    const perYear = (n: number): number => n / (seeds.length * 2);
    expect(perYear(ordinary)).toBeLessThanOrEqual(DAYS_PER_YEAR / DANGEROUS_QUIET_DAYS);
    expect(perYear(ordinary)).toBeGreaterThanOrEqual(2);
    expect(perYear(beastwood)).toBeGreaterThan(2 * perYear(ordinary));
  });

  it('serene_vale never sees a wolf or a bear, and its boars, badgers and lynxes keep the quiet spell', () => {
    const list = arrivals(newWorld('t545-vale', 'temperate_forest', ['serene_vale']), 3);
    expect(list.some((a) => a.species === 'wolf' || a.species === 'bear')).toBe(false);
    expect(list.some((a) => a.dangerous)).toBe(true);
    for (const gap of gaps(list)) expect(gap).toBeGreaterThanOrEqual(DANGEROUS_QUIET_DAYS);
  });

  it('a dangerous species draws nothing from the stream during the quiet spell', () => {
    // The desert's only surface species is the giant lizard, a dangerous one.
    const w = newWorld('t545-desert', 'desert', []);
    const host = w.animals.spawner;
    expect(regionSurfaceSpecies(host, 0).every(([s]) => host.facts.isDangerous(s))).toBe(true);
    const tick = 100 * TICKS_PER_DAY;
    host.lastDangerousTick = tick - (DANGEROUS_QUIET_DAYS * TICKS_PER_DAY - 1);
    expect(dangerousQuiet(host, tick)).toBe(true);
    const before = JSON.stringify(host.rng.state());
    expect(dailySpawn(host, 0, tick)).toEqual([]);
    expect(JSON.stringify(host.rng.state())).toBe(before);
    // The spell ends DANGEROUS_QUIET_DAYS after the arrival.
    expect(dangerousQuiet(host, host.lastDangerousTick + DANGEROUS_QUIET_DAYS * TICKS_PER_DAY)).toBe(false);
    // No arrival yet: no spell; beastwood: never a spell.
    expect(dangerousQuiet({ traits: [], lastDangerousTick: -1 }, tick)).toBe(false);
    expect(dangerousQuiet({ traits: ['beastwood'], lastDangerousTick: tick }, tick)).toBe(false);
  });

  it('the arrival that starts the spell is saved and loaded; an older save has no spell', () => {
    const w = newWorld('t545-save', 'temperate_forest', []);
    expect(w.animals.serialize().lastDangerousTick).toBeUndefined();
    w.animals.spawner.lastDangerousTick = 1234;
    expect(w.animals.serialize().lastDangerousTick).toBe(1234);
    const loaded = roundTrip(w.game).game;
    const system = loaded.world.scheduler.byId('08') as AnimalsSystem;
    expect(system.spawner.lastDangerousTick).toBe(1234);
    expect(loaded.hash()).toBe(w.hash());
  });
});
