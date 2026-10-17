/** T-M8-01: unchanged saved-reference workloads and amortized measurements. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import type { JobBoard } from '@systems/jobs';
import { ensureScriptedReference, REFERENCE_PATH } from './scripted-reference';
import { ensureScriptedFurniture, FURNITURE_PATH } from './scripted-furniture';
import { ensurePlayedReference, PLAYED_PATH } from './played-reference';

const TICKS = 2_000;
/** `furniture` is the first 80-dwarf fixture (no workshop, farm, squad, depot or gate); `scripted` is the reference fortress (T-283). */
type Fixture = 'played' | 'furniture' | 'scripted';

export async function measureReference(fixture: Fixture) {
  const now = (): number => performance.now();
  const game = fixture === 'played' ? await ensurePlayedReference(now) : fixture === 'furniture' ? await ensureScriptedFurniture(now) : await ensureScriptedReference(now);
  const entities = game.world.entities;
  const population = entities.with(C.Brain).filter((id) => entities.get(id, C.Creature)?.faction === 'fortress').length;
  const animals = entities.with(C.Tame).length + entities.with(C.Wild).length;
  const items = entities.with(C.Item).length;
  const buildings = entities.with(C.Building).length;
  const zones = entities.with(C.Zone).length;
  expect(game.tick, REFERENCE_PATH).toBeGreaterThanOrEqual(2 * TICKS_PER_YEAR);
  if (fixture !== 'played') {
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
  // T-345: the cost of each job producer, which system 11's figure holds but does not split.
  const board = world.services.jobs as JobBoard;
  const producerMs: Record<string, number> = {};
  const produced = board.producers.map((p) => p.produce);
  board.producers.forEach((p, k) => {
    const produce = produced[k] as typeof p.produce;
    (p as { produce: typeof p.produce }).produce = (ctx, sink) => {
      const start = now();
      produce.call(p, ctx, sink);
      producerMs[p.id] = (producerMs[p.id] ?? 0) + now() - start;
    };
  });
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
  board.producers.forEach((p, k) => { (p as { produce: typeof p.produce }).produce = produced[k] as typeof p.produce; });
  const producers = Object.fromEntries(Object.entries(producerMs).map(([id, ms]) => [id, ms / TICKS]));
  const systems = Object.fromEntries(world.stats().systems.map((s) => [s.id, s.totalMs / TICKS]));
  const pathing = pathingMs / TICKS;
  const core = averageTickMs - pathing - Object.values(systems).reduce((a, b) => a + b, 0);
  console.log(`perf_reference: ${JSON.stringify({ fixture: fixture === 'played' ? PLAYED_PATH : fixture === 'furniture' ? FURNITURE_PATH : REFERENCE_PATH,
    population, animals, items, buildings, zones,
    ticks: TICKS, averageTickMs, worstTickMs, pathingMs: pathing, coreMs: core, systems, producers })}`);
  return { systems, pathing, core, averageTickMs, worstTickMs, producers };
}
