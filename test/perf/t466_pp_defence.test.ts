/**
 * T-483 probe (not committed as a test; a copy is filed under reports/data): pp_defence as the
 * scenario plays it, on its seed and three more (`pp-defence-2` … `-4`), recording whether it passes,
 * its end tick, the state of every rng stream, a digest of every combat event, and what every
 * launcher shot hit. Output: T483_OUT (JSON lines); the combat events of each seed go to
 * T483_EVENTS_DIR for a diff.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { it, vi } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import type { TestWorld } from '../scenarios/test-world';

const OUT = process.env['T483_OUT'] ?? 'out/pp-defence.jsonl';
mkdirSync('out', { recursive: true });
const DIR = process.env['T483_EVENTS_DIR'] ?? 'out';
const SEEDS = (process.env['T483_SEEDS'] ?? 'pp-defence,pp-defence-2,pp-defence-3,pp-defence-4').split(',');
const g = globalThis as unknown as { t483Seed: string; t483World: TestWorld | null };

vi.mock('../scenarios/player-path', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../scenarios/player-path')>();
  return {
    ...mod,
    pathWorld: (seed: string, ...rest: unknown[]) => {
      const w = (mod.pathWorld as (...a: unknown[]) => TestWorld)(g.t483Seed ?? seed, ...rest);
      g.t483World = w;
      return w;
    },
  };
});

const COMBAT = new Set(['AttackResolved', 'DamageDealt', 'ProjectileFired', 'CreatureDied', 'KillRecorded', 'CreatureFled']);

for (const seed of SEEDS) {
  it(`T-483 probe: pp_defence on ${seed}`, async () => {
    g.t483Seed = seed;
    g.t483World = null;
    const scenario = (await import('../scenarios/pp_defence.scenario')).default;
    let error = '';
    let summary = '';
    const log = console.log;
    console.log = (...a: unknown[]): void => { summary = a.map(String).join(' '); };
    try {
      if (typeof scenario.run === 'function') scenario.run(null as unknown as TestWorld);
    } catch (e) {
      error = String((e as Error).message ?? e).split('\n')[0]!.slice(0, 200);
    } finally {
      console.log = log;
    }
    const w = g.t483World as unknown as TestWorld;
    const ent = w.game.world.entities;
    const species = (id: number): string => w.game.registry.table<{ id: string }>('creatures').byIndex(Number(id))?.id ?? '?';
    const all = w.allEvents();
    const combat = all.filter((e) => COMBAT.has(e.type)).map((e) => JSON.stringify(e));
    writeFileSync(`${DIR}/t483-pp-${seed}-${process.env['T483_STATE'] ?? 'x'}.txt`, combat.join('\n'));
    const shots = all.filter((e) => e.type === 'ProjectileFired');
    const shooters = [...new Set(shots.map((e) => Number(e['shooterId'])))];
    appendFileSync(OUT, JSON.stringify({
      state: process.env['T483_STATE'] ?? '?', seed, passed: error === '', error,
      tick: w.tick, day: Math.floor(w.tick / TICKS_PER_DAY) + 1,
      combatEvents: combat.length,
      combatDigest: createHash('sha256').update(combat.join('\n')).digest('hex').slice(0, 16),
      rngDigest: createHash('sha256').update(JSON.stringify(w.game.world.rngState())).digest('hex').slice(0, 16),
      allEvents: all.length,
      shots: shots.length, shooters: shooters.map((s) => `${s}:${ent.alive(s) ? 'alive' : 'gone'}`),
      huntsStarted: all.filter((e) => e.type === 'HuntStarted').length,
      huntKills: all.filter((e) => e.type === 'HuntKill').map((e) => String(e['species'] ?? '')),
      kills: all.filter((e) => e.type === 'KillRecorded').map((e) => `${String(e['killerSpecies'])}>${String(e['victimSpecies'])}`),
      fortressDeaths: all.filter((e) => e.type === 'CreatureDied' && e['faction'] === 'fortress').map((e) => species(Number(e['species']))),
      summary: summary.slice(-400),
    }) + '\n');
  }, 1_800_000);
}
