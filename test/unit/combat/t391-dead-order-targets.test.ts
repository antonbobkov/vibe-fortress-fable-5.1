/**
 * T-391 (found by the p2-5 rerun): a squad's queued kill order goes with its target the moment the target
 * is gone, wherever it stands in the queue. 16 used to drop a dead target only from the head of the queue,
 * so a wolf that bled out while queued behind another kill order stayed in the list until the orders were
 * given again.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import { TestWorld } from '../../scenarios/test-world';
import { checkInvariants } from '../../scenarios/invariants';

const Z = FLAT_TEST_SURFACE_Z;

function squadWithKills(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const dwarf = w.spawnDwarf({ at: w.index(20, 20, Z) });
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
  const squad = w.game.world.readers.of<CombatReader>('16').squads()[0] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [dwarf] });
  const first = w.spawnCreature('wolf', w.index(60, 60, Z), 'wild');
  const second = w.spawnCreature('wolf', w.index(62, 60, Z), 'wild');
  for (const targetId of [first, second]) {
    expect(w.game.world.applyCommand({ type: 'SquadOrder', squadId: squad.id, order: { kind: 'kill', targetId } }).ok).toBe(true);
  }
  return { w, squad, first, second };
}

describe('T-391 a squad forgets the orders of a target that is gone', () => {
  it('a kill order behind the head leaves the queue when its target dies', () => {
    const { w, squad, first, second } = squadWithKills('t391-queued-kill');
    expect(w.game.world.entities.get(squad.id, C.Squad)!.orders.map((o) => o.kind)).toEqual(['kill', 'kill']);
    w.game.world.entities.destroy(second);
    expect(w.game.world.entities.get(squad.id, C.Squad)!.orders).toEqual([{ kind: 'kill', targetId: first }]);
    expect(checkInvariants(w.game).filter((f) => f.inv === 'squad.kill-order-dead-target')).toEqual([]);
  });

  it('the head order and a follow order go the same way', () => {
    const { w, squad, first, second } = squadWithKills('t391-head-kill');
    w.game.world.entities.destroy(first);
    expect(w.game.world.entities.get(squad.id, C.Squad)!.orders).toEqual([{ kind: 'kill', targetId: second }]);
    const escort = w.spawnDwarf({ at: w.index(22, 20, Z) });
    expect(w.game.world.applyCommand({ type: 'SquadOrder', squadId: squad.id, order: { kind: 'follow', dwarfId: escort } }).ok).toBe(true);
    w.game.world.entities.destroy(escort);
    expect(w.game.world.entities.get(squad.id, C.Squad)!.orders).toEqual([{ kind: 'kill', targetId: second }]);
  });
});
