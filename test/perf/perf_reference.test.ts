/** T-M6-18: gate the played fortress; measure the scripted M8 load baseline. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import { ensureScriptedReference, REFERENCE_PATH } from './scripted-reference';
import { ensurePlayedReference, PLAYED_PATH } from './played-reference';

const TICKS = 2_000;
const ALLOCATION_MS: Readonly<Record<string, number>> = {
  '03': 0.10, '04': 1.50, '05': 0.15, '06': 0.02, '07': 0.15,
  '08': 0.40, '09': 0.05, '10': 0.50, '11': 0.60, '12': 0.10,
  '13': 0.30, '14': 0.10, '15': 0.20, '16': 0.20, '17': 0.10,
  '18': 0.10, '19': 0.05,
};

type Fixture = 'played' | 'scripted';

async function measure(fixture: Fixture) {
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
    return { systems, pathing, core, worstTickMs };
}

describe('T-M6-18 perf: perf_reference', () => {
  it('asserts per-system allocations on the 20-dwarf played fortress', async () => {
    const { systems, pathing, core, worstTickMs } = await measure('played');
    for (const [id, allocation] of Object.entries(ALLOCATION_MS)) {
      if (systems[id] === undefined) continue;
      expect(systems[id], `system ${id}: ${systems[id]?.toFixed(3)} ms > ${allocation.toFixed(3)} ms`).toBeLessThanOrEqual(allocation);
    }
    expect(pathing, 'system 22 pathing').toBeLessThanOrEqual(1.0);
    expect(core, 'core').toBeLessThanOrEqual(0.30);
    expect(worstTickMs).toBeLessThanOrEqual(40);
  }, 600_000);

  it('measures every present system on the 80-dwarf scripted M8 load baseline', async () => {
    const { systems, pathing, core } = await measure('scripted');
    for (const id of Object.keys(ALLOCATION_MS)) expect(systems[id], `missing system ${id}`).toBeDefined();
    expect(Number.isFinite(pathing) && Number.isFinite(core)).toBe(true);
  }, 600_000);
});
