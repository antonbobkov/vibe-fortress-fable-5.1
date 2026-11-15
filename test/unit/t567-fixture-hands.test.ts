/**
 * T-567: two of the fixtures' hands. The three-year script gives the mason's workshop the builder
 * as its worker, so its routine orders (the halls' chairs and tables among them) are not left open
 * for months behind the food work and the smoothing; and the defence year's script takes mining and
 * woodcutting from a squad on duty, so that the picks and the axe its soldiers held go to the dwarves
 * outside it.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { CombatReader, SquadWithId } from '@systems/combat';
import type { JobsReader } from '@systems/jobs';
import { keepMasonAtWork, type EconomyState } from '../scenarios/three_years_economy';
import { Z, type FortressState } from '../scenarios/three_years_fortress';
import { keepToolLaborsOffTheSquad, type DefenceYearState } from '../scenarios/defence_year_fortress';
import { scriptRecord } from '../scenarios/script-commands';
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

function fortress(specialists: Record<string, number>, phases: string[] = []): FortressState {
  return { cx: 20, cy: 20, z: Z, hallZ: Z - 5, placedIds: {},
    economy: { phases: new Set<string>(phases), specialists } as unknown as EconomyState,
    gateDoorId: 0, gateDoorId2: 0, gateWallLostTick: 0, squadId: 0 } as unknown as FortressState;
}

function dwarves(w: TestWorld, n: number): number[] {
  return Array.from({ length: n }, (_, k) => w.spawnDwarf({ at: w.index(12 + k, 12, Z) }));
}

describe('T-567 the mason has a worker', () => {
  it('the builder is the mason\'s workshop\'s worker, and the command is sent once', () => {
    const w = ground('t567-mason');
    const [builder] = dwarves(w, 2);
    const mason = w.build('mason', w.index(20, 20, Z), 'granite');
    w.step(1);
    const state = fortress({ builder: builder! });
    state.placedIds['mason'] = mason;
    keepMasonAtWork(w, state);
    expect(w.game.world.entities.get(mason, C.Workshop)?.assignedWorker).toBe(builder);
    const sent = scriptRecord(w).accepted.get('SetWorkshopWorker') ?? 0;
    keepMasonAtWork(w, state);
    expect(scriptRecord(w).accepted.get('SetWorkshopWorker') ?? 0).toBe(sent);
  });

  it('not while the squad\'s kit is owed, and not without a builder', () => {
    const w = ground('t567-mason-arming');
    const [builder] = dwarves(w, 1);
    const mason = w.build('mason', w.index(20, 20, Z), 'granite');
    w.step(1);
    const arming = fortress({ builder: builder! }, ['arming']);
    arming.placedIds['mason'] = mason;
    keepMasonAtWork(w, arming);
    const none = fortress({});
    none.placedIds['mason'] = mason;
    keepMasonAtWork(w, none);
    expect(w.game.world.entities.get(mason, C.Workshop)?.assignedWorker).toBe(0);
  });
});

describe('T-567 a squad on duty leaves its picks and axe to the dwarves outside it', () => {
  function squadOf(w: TestWorld, members: readonly number[]): SquadWithId {
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' }).ok).toBe(true);
    const squad = w.readers.of<CombatReader>('16').squads()[0] as SquadWithId;
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [...members] }).ok).toBe(true);
    return squad;
  }

  /** Seven founders (the two miners, the woodcutter, the mason, the farmer, the cook, the smith) and `immigrants` more. */
  function fort(w: TestWorld, immigrants: number): { founders: number[]; arrived: number[] } {
    const all = dwarves(w, 7 + immigrants);
    const founders = all.slice(0, 7);
    (w.game as unknown as { arrival: { dwarves: number[] } }).arrival = { dwarves: founders };
    for (const id of all) for (const labor of ['mining', 'woodcutting']) w.setLabor(id, labor, false);
    w.setLabor(founders[0]!, 'mining', true);
    w.setLabor(founders[1]!, 'mining', true);
    w.setLabor(founders[2]!, 'woodcutting', true);
    return { founders, arrived: all.slice(7) };
  }

  it('the soldiers lose mining and woodcutting, and an immigrant outside the squad takes each up', () => {
    const w = ground('t567-tool-labors');
    const { founders, arrived } = fort(w, 2);
    const [f0, f1, f2, mason, farmer] = founders;
    const [smith, hand] = arrived;
    const soldiers = [f2!, mason!, f0!, f1!];
    squadOf(w, soldiers);
    w.step(1);
    const state = { fortress: fortress({ forge: smith! }) } as unknown as DefenceYearState;
    keepToolLaborsOffTheSquad(w, state, soldiers);
    const jobs = w.readers.of<JobsReader>('11');
    for (const id of soldiers) {
      expect(jobs.laborEnabled(id, 'mining'), `soldier ${id} mining`).toBe(false);
      expect(jobs.laborEnabled(id, 'woodcutting'), `soldier ${id} woodcutting`).toBe(false);
    }
    expect([jobs.laborEnabled(hand!, 'mining'), jobs.laborEnabled(hand!, 'woodcutting')], 'the immigrant no specialist role holds').toEqual([true, true]);
    expect([smith, farmer].map((id) => jobs.laborEnabled(id!, 'mining')), 'not a specialist, not a founder at its trade').toEqual([false, false]);
    // A second look sends nothing.
    const sent = scriptRecord(w).accepted.get('SetLabor') ?? 0;
    keepToolLaborsOffTheSquad(w, state, soldiers);
    expect(scriptRecord(w).accepted.get('SetLabor') ?? 0).toBe(sent);
  });

  it('a dwarf outside the squad that mines already is enough', () => {
    const w = ground('t567-tool-labors-kept');
    const { founders, arrived } = fort(w, 2);
    const [f0, f1, f2] = founders;
    const [miner, other] = arrived;
    w.setLabor(miner!, 'mining', true);
    w.setLabor(f2!, 'woodcutting', false);
    w.setLabor(other!, 'woodcutting', true);
    const soldiers = [f0!, f1!];
    squadOf(w, soldiers);
    w.step(1);
    keepToolLaborsOffTheSquad(w, { fortress: fortress({}) } as unknown as DefenceYearState, soldiers);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.workersWithLabor('mining')).toEqual([miner]);
    expect(jobs.workersWithLabor('woodcutting')).toEqual([other]);
  });
});

