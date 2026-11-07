/**
 * T-524: in `three-years-p2-4` at shift 50 raids cut the fortress from 11 dwarves to 2 by day 164,
 * and one of the two survivors was the fuel worker, kept on smelting alone with hauling off: it
 * did nothing for the last 180 days. The three-year script now gives every specialist the general
 * labors back when the fortress falls below SPECIALIST_RELEASE_POPULATION adults (below the nine
 * that choose them, so a fortress hovering at nine keeps them), frees their workshops, and keeps
 * the brewer and the fuel worker different dwarves.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { JobsReader } from '@systems/jobs';
import { releaseSpecialists, specialistCandidates, SPECIALIST_RELEASE_POPULATION, type EconomyState } from '../scenarios/three_years_economy';
import { Z, type FortressState } from '../scenarios/three_years_fortress';
import { command, scriptRecord } from '../scenarios/script-commands';
import { TestWorld } from '../scenarios/test-world';

function ground(seed: string): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let y = 10; y <= 30; y += 1) for (let x = 10; x <= 30; x += 1) {
    const t = w.index(x, y, Z);
    w.carve(t, TileKind.Floor, granite);
    w.map.setFlag(t, TileFlag.Grass, false);
  }
  return w;
}

function fortress(specialists: Record<string, number>, brewer?: number, phases: string[] = []): FortressState {
  return { cx: 20, cy: 20, z: Z, hallZ: Z - 5, placedIds: {},
    economy: { phases: new Set<string>(phases), specialists, ...(brewer !== undefined ? { brewer } : {}) } as unknown as EconomyState,
    gateDoorId: 0, gateDoorId2: 0, gateWallLostTick: 0, squadId: 0 } as unknown as FortressState;
}

/** As the script dedicates them: each on its craft, the fuel worker with hauling off too. */
function dedicateAll(w: TestWorld, on: Record<number, readonly string[]>, noHaul: readonly number[]): void {
  const labors = w.game.registry.table<{ id: string }>('labors').rows.slice(1).map((r) => r.id);
  for (const [id, keep] of Object.entries(on)) {
    for (const labor of labors) w.setLabor(Number(id), labor, keep.includes(labor) || (labor === 'hauling' && !noHaul.includes(Number(id))));
  }
}

function dwarves(w: TestWorld, n: number): number[] {
  return Array.from({ length: n }, (_, k) => w.spawnDwarf({ at: w.index(12 + k, 12, Z) }));
}

describe('T-524 a decimated fortress gives its specialists the general labors back', () => {
  it('below the floor the fuel worker, the builder, a bench specialist and the brewer take the general labors, and the furnace is freed', () => {
    const w = ground('t524-release');
    const [fuel, builder, crafter, brewer, other] = dwarves(w, SPECIALIST_RELEASE_POPULATION - 1);
    dedicateAll(w, { [fuel!]: ['smelting'], [builder!]: ['masonry', 'construction', 'smelting'], [crafter!]: ['crafts'], [brewer!]: ['brewing'] }, [fuel!]);
    const furnace = w.build('wood_furnace', w.index(20, 20, Z), 'granite');
    w.step(1);
    const state = fortress({ fuel: fuel!, builder: builder!, craftdwarf: crafter! }, brewer);
    state.placedIds['wood_furnace'] = furnace;
    expect(command(w, { type: 'SetWorkshopWorker', workshopId: furnace, dwarfId: fuel! }).ok).toBe(true);
    const jobs = w.readers.of<JobsReader>('11');
    const miningBefore = [fuel, builder, crafter, brewer].map((id) => jobs.laborEnabled(id!, 'mining'));
    const otherBefore = scriptRecord(w).accepted.get('SetLabor') ?? 0;

    releaseSpecialists(w, state);
    for (const id of [fuel!, builder!, crafter!, brewer!]) {
      for (const labor of ['hauling', 'cooking', 'farming', 'brewing', 'smelting', 'crafts', 'masonry', 'construction']) {
        expect(jobs.laborEnabled(id, labor), `${id} ${labor}`).toBe(true);
      }
    }
    expect([fuel, builder, crafter, brewer].map((id) => jobs.laborEnabled(id!, 'mining')), 'mining is keepAMiner\'s').toEqual(miningBefore);
    expect(state.economy.specialists).toEqual({});
    expect(state.economy.brewer).toBeUndefined();
    expect(w.game.world.entities.get(furnace, C.Workshop)?.assignedWorker, 'anyone may stoke the furnace').toBe(0);
    expect(jobs.laborEnabled(other!, 'hauling')).toBe(true);

    // Released once: the next day sends nothing more.
    const sent = scriptRecord(w).accepted.get('SetLabor') ?? 0;
    expect(sent).toBeGreaterThan(otherBefore);
    releaseSpecialists(w, state);
    expect(scriptRecord(w).accepted.get('SetLabor') ?? 0).toBe(sent);
  });

  it('at the floor the specialists keep their crafts', () => {
    const w = ground('t524-floor');
    const [fuel, , , brewer] = dwarves(w, SPECIALIST_RELEASE_POPULATION);
    dedicateAll(w, { [fuel!]: ['smelting'], [brewer!]: ['brewing'] }, [fuel!]);
    const state = fortress({ fuel: fuel! }, brewer);
    releaseSpecialists(w, state);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.laborEnabled(fuel!, 'hauling')).toBe(false);
    expect(jobs.laborEnabled(brewer!, 'cooking')).toBe(false);
    expect(state.economy.specialists).toEqual({ fuel });
    expect(state.economy.brewer).toBe(brewer);
  });

  it("while the squad's kit is owed, its smith and smelter stay on the metal chain", () => {
    const w = ground('t524-arming');
    const [smith, smelter, builder] = dwarves(w, 3);
    dedicateAll(w, { [smith!]: ['smithing', 'smelting'], [smelter!]: ['masonry', 'smelting', 'construction'], [builder!]: ['masonry', 'construction', 'smelting'] }, []);
    const state = fortress({ forge: smith!, smelter: smelter!, builder: builder! }, undefined, ['arming']);
    releaseSpecialists(w, state);
    const jobs = w.readers.of<JobsReader>('11');
    expect(state.economy.specialists).toEqual({ forge: smith, smelter });
    expect(jobs.laborEnabled(smith!, 'cooking')).toBe(false);
    expect(jobs.laborEnabled(builder!, 'cooking')).toBe(true);
  });

  it('the brewer is never chosen as the builder or the fuel worker', () => {
    const w = ground('t524-brewer');
    const [a, b, c] = dwarves(w, 3);
    const state = fortress({ builder: a! }, b);
    expect(specialistCandidates(w, state)).toEqual([c]);
  });
});
