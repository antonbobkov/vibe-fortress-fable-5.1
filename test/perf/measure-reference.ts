/** T-M8-01: unchanged saved-reference workloads and amortized measurements. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import { ensureScriptedReference, REFERENCE_PATH } from './scripted-reference';
import { ensurePlayedReference, PLAYED_PATH } from './played-reference';

const TICKS = 2_000;
type Fixture = 'played' | 'scripted';

export async function measureReference(fixture: Fixture) {
  const now = (): number => performance.now();
  const game = fixture === 'played' ? await ensurePlayedReference(now) : await ensureScriptedReference(now);
  const entities = game.world.entities;
  const population = entities.with(C.Brain).filter((id) => entities.get(id, C.Creature)?.faction === 'fortress').length;
  const animals = entities.with(C.Tame).length + entities.with(C.Wild).length;
  const items = entities.with(C.Item).length;
  const buildings = entities.with(C.Building).length;
  const zones = entities.with(C.Zone).length;
  expect(game.tick, REFERENCE_PATH).toBeGreaterThanOrEqual(2 * TICKS_PER_YEAR);
  if (fixture === 'scripted') {
    expect(population).toBe(80);
    expect(animals).toBeGreaterThanOrEqual(120);
    expect(items).toBeGreaterThanOrEqual(25_000);
    expect(buildings).toBeGreaterThanOrEqual(600);
    expect(zones).toBeGreaterThanOrEqual(60);
  } else {
    expect(population).toBe(20);
  }

  game.step(200);
  const world = game.world;
  const pass = world.connectivityPass;
  let pathingMs = 0;
  world.connectivityPass = () => {
    const start = now();
    pass?.();
    pathingMs += now() - start;
  };
  world.scheduler.resetStats();
  let worstTickMs = 0;
  const began = now();
  for (let k = 0; k < TICKS; k += 1) {
    const start = now();
    game.step(1);
    worstTickMs = Math.max(worstTickMs, now() - start);
  }
  const averageTickMs = (now() - began) / TICKS;
  world.connectivityPass = pass;
  const systems = Object.fromEntries(world.stats().systems.map((s) => [s.id, s.totalMs / TICKS]));
  const pathing = pathingMs / TICKS;
  const core = averageTickMs - pathing - Object.values(systems).reduce((a, b) => a + b, 0);
  console.log(`perf_reference: ${JSON.stringify({ fixture: fixture === 'played' ? PLAYED_PATH : REFERENCE_PATH,
    population, animals, items, buildings, zones,
    ticks: TICKS, averageTickMs, worstTickMs, pathingMs: pathing, coreMs: core, systems })}`);
  return { systems, pathing, core, averageTickMs, worstTickMs };
}
