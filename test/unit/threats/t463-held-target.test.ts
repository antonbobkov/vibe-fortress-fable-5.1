/**
 * Found by T-463's twenty-seed run: on p4-1 a gloam ambush stood in a hall's doorway for days, its
 * members switching every think between two dogs at the same distance on two tiles. Each switch
 * restarted their path, so they never stepped, and the party outlived the 10-day invariant.
 * 18 § Engage: a member keeps the target it holds while that one is no farther than the nearest.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import { memberThink } from '@systems/threats/ai';
import { spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

function ctxOf(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick, emit: (e: GameEvent) => w.game.world.emit(e) } as unknown as TickContext;
}

function setup(seed: string): { w: TestWorld; m: number; partyId: number } {
  const w = new TestWorld({ world: 'flat-test', seed, embark: 'none', surfaceWildlife: 'none' });
  const partyId = w.game.world.entities.create('party');
  w.game.world.entities.add(partyId, C.Party, {
    civ: 'gloam', purpose: 'raid', members: [], leaderId: 0, state: 'engage', goalTile: 0, goalEntity: 0,
    arrivedTick: w.tick, stateSince: w.tick, loot: [], edge: 'n', size: 1,
  });
  const m = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'), partyId, 'gloam_warrior', 'warriors', w.index(40, 40, Z), 1, true);
  return { w, m, partyId };
}

function think(w: TestWorld, m: number, partyId: number): void {
  memberThink(m, w.game.world.entities.get(m, C.Hostile)!, w.game.world.entities.get(partyId, C.Party), ctxOf(w));
}

describe('T-463 a party member keeps the target it holds on a tie', () => {
  it('keeps a held dog when another is as near, and switches to one nearer', () => {
    const { w, m, partyId } = setup('t463-held');
    const first = w.spawnTame('dog', w.index(43, 40, Z));
    const second = w.spawnTame('dog', w.index(37, 40, Z));
    w.step(1);
    w.game.world.services.combat?.setTarget(m, second);
    think(w, m, partyId);
    expect(w.game.world.services.combat?.targetOf(m), 'the held dog, at the same distance').toBe(second);
    w.game.world.services.combat?.setTarget(m, first);
    think(w, m, partyId);
    expect(w.game.world.services.combat?.targetOf(m), 'the other held dog, at the same distance').toBe(first);
    const nearer = w.spawnTame('dog', w.index(41, 41, Z));
    w.step(1);
    think(w, m, partyId);
    expect(w.game.world.services.combat?.targetOf(m), 'a nearer dog').toBe(nearer);
  });
});
