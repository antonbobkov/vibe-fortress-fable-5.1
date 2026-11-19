/**
 * T-629: the three-year script's rooms witness asks a fortress for its halls and bedrooms only when
 * it has held ROOMS_WITNESS_POPULATION adults for the last ROOMS_WITNESS_DAYS. `three-years-p2-4` at
 * shift 50 was four dwarves from day 173, six immigrants came on day 309 and it ended on day 336 with
 * ten adults and two of its twelve dug bedrooms furnished: the script furnishes rooms for the dwarves
 * it has, and a remnant that grows again late has not had the time.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import { TestWorld } from '../scenarios/test-world';
import type { EconomyState } from '../scenarios/three_years_economy';
import { fortressWitnesses, noteRoomsPopulation, ROOMS_WITNESS_DAYS, ROOMS_WITNESS_POPULATION, type FortressState } from '../scenarios/three_years_fortress';

const Z = FLAT_TEST_SURFACE_Z;

function fortress(): FortressState {
  return { cx: 20, cy: 20, z: Z, hallZ: Z - 5, placedIds: {}, economy: { phases: new Set<string>(), specialists: {} } as unknown as EconomyState,
    gateDoorId: 0, gateDoorId2: 0, gateWallLostTick: 0, squadId: 0 } as unknown as FortressState;
}

describe('T-629 the rooms witness waits for a regrown fortress', () => {
  it('a fortress seen below its embark size is asked for its rooms only ROOMS_WITNESS_DAYS after', () => {
    const w = new TestWorld({ seed: 't629-witness', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const state = fortress();
    const rooms = (): string[] => fortressWitnesses(w, state, 0).filter((m) => m.includes('hall') || m.includes('bedrooms'));
    for (let k = 1; k < ROOMS_WITNESS_POPULATION; k += 1) w.spawnDwarf({ at: w.index(14 + k, 15, Z) });
    w.step(10);
    noteRoomsPopulation(w, state);
    const short = w.tick;
    expect(state.roomsShortTick).toBe(short);
    // Immigrants bring it back to its embark size: it is not asked at once.
    w.spawnDwarf({ at: w.index(22, 15, Z) });
    w.step(10);
    noteRoomsPopulation(w, state);
    expect(state.roomsShortTick, 'a fortress at its embark size notes nothing').toBe(short);
    expect(rooms()).toEqual([]);
    expect(fortressWitnesses(w, state, 0), 'the gate and the squad are still asked for').toContain('the squad');
    // Two seasons after it was last short, it is asked.
    state.roomsShortTick = w.tick - ROOMS_WITNESS_DAYS * TICKS_PER_DAY + 1;
    expect(rooms()).toEqual([]);
    state.roomsShortTick = w.tick - ROOMS_WITNESS_DAYS * TICKS_PER_DAY;
    expect(rooms()).toEqual(['a hearth hall', 'a dining hall', 'seven bedrooms (0)']);
  });

  it('a fortress never seen short is asked as soon as it has its embark size', () => {
    const w = new TestWorld({ seed: 't629-never-short', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const state = fortress();
    for (let k = 0; k < ROOMS_WITNESS_POPULATION; k += 1) w.spawnDwarf({ at: w.index(14 + k, 15, Z) });
    w.step(10);
    noteRoomsPopulation(w, state);
    expect(state.roomsShortTick).toBeUndefined();
    expect(fortressWitnesses(w, state, 0)).toContain('seven bedrooms (0)');
  });
});
