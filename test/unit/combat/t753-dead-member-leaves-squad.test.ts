/**
 * T-753 (the sweep's follow-up): a squad member killed after 16's squad step stayed listed until the
 * next step, so an invariant sample on the tick after its death read a dead member (seed p4-1 at
 * shift 50). A member, or the leader, that dies leaves its squad when its `CreatureDied` is handled
 * (16 § Squads), so no squad lists a dead member at the end of any tick.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { CombatReader } from '@systems/combat/reader';
import { killCreature } from '@systems/health/tick';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

function context(w: TestWorld): TickContext {
  const world = w.game.world;
  return {
    world, registry: world.registry, rng: world.rngFor('17'), readers: world.readers, register: world.registrations,
    tick: world.calendar.tick, emit: (event: GameEvent) => world.emit(event),
    terrain: world.services.terrain, jobs: world.services.jobs, spawn: world.services.spawn,
  };
}

describe('T-753 a dead squad member leaves its squad on the tick it dies', () => {
  it('drops the member and the leader when the death is handled, before 16 steps its squads again', () => {
    const w = new TestWorld({ seed: 't753-squad-death', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const leader = w.spawnDwarf({ at: w.index(30, 30, Z) });
    const member = w.spawnDwarf({ at: w.index(32, 30, Z) });
    const other = w.spawnDwarf({ at: w.index(34, 30, Z) });
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' }).ok).toBe(true);
    const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: [leader, member, other] }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetSquadLeader', squadId, leaderId: leader }).ok).toBe(true);
    w.step(1);
    const squad = () => w.game.world.entities.get(squadId, C.Squad)!;
    expect(squad().leaderId).toBe(leader);

    // Killed between ticks: 16's squad step of the next tick runs before the death is handled.
    killCreature(context(w), member, 'killed');
    killCreature(context(w), leader, 'killed');
    w.step(1);
    expect(w.game.world.entities.alive(member)).toBe(false);
    expect(squad().members).toEqual([other]);
    expect(squad().leaderId).toBe(0);
  });
});
