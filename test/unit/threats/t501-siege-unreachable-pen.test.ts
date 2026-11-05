/**
 * T-501: after a fortress fell, a siege stayed engaged for days with two fortress dogs its captain
 * could see but never reach. The connectivity labels joined the dogs to it, so the party found a
 * reachable target at every think and set its `stateSince` again; the walk to them failed, 16
 * dropped the held dog after TARGET_LOSE_TICKS, and the member took it again at once. Neither the
 * engage limit nor loiter's ever ran out. 18 § Engage: a party that strikes no blow for
 * ENGAGE_STALL_TICKS has stalled; it loiters and goes home.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Party } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { ENGAGE_STALL_TICKS, LOITER_DAYS_SIEGE } from '@systems/threats/constants';
import { arriveParty, spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

/**
 * A pen of fortifications 31..35 × 30..34 around a 3 × 3 floor, seen into through the ring. Its
 * only way in is a stair in its middle down to a tunnel one level below, which runs round the map
 * to a stair at 10,10: the labels join the dogs to the surface, and no search within its node
 * limit finds the way. A `no_pets` door in the tunnel keeps the dogs in. The hearth stands just
 * north of the pen.
 */
function penWorld(seed: string): { w: TestWorld; dogs: EntityId[] } {
  const w = new TestWorld({ world: 'flat-test', seed, embark: 'none', surfaceWildlife: 'none' });
  for (let x = 31; x <= 35; x += 1) {
    for (let y = 30; y <= 34; y += 1) {
      if (x === 31 || x === 35 || y === 30 || y === 34) w.carve(w.index(x, y, Z), TileKind.Fortification);
    }
  }
  const below = Z - 1;
  const tunnel: [number, number][] = [];
  for (let y = 10; y <= 90; y += 1) tunnel.push([10, y]);
  for (let x = 11; x <= 33; x += 1) tunnel.push([x, 90]);
  for (let y = 89; y >= 33; y -= 1) tunnel.push([33, y]);
  for (const [x, y] of tunnel) {
    w.carve(w.index(x, y, below), TileKind.Floor);
    w.discover(w.index(x, y, below));
  }
  w.carve(w.index(10, 10, Z), TileKind.StairsDown);
  w.carve(w.index(10, 10, below), TileKind.StairsUp);
  w.carve(w.index(33, 32, Z), TileKind.StairsDown);
  w.carve(w.index(33, 32, below), TileKind.StairsUp);
  const doorId = w.build('door', w.index(33, 40, below), 'granite');
  w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: doorId, mode: 'no_pets' });
  w.build('hearth', w.index(33, 27, Z), 'granite');
  const dogs = [w.spawnTame('dog', w.index(32, 31, Z)), w.spawnTame('dog', w.index(34, 31, Z))];
  w.step(1);
  return { w, dogs };
}

describe('T-501 a party with no target it can strike goes on to loiter and retreat', () => {
  it('a siege whose only fortress creatures are dogs in a pen it can see but not enter leaves within LOITER_DAYS_SIEGE', () => {
    const { w, dogs } = penWorld('t501-pen');
    expect(w.reachable(w.index(33, 26, Z), w.index(32, 31, Z)), 'the labels join the dogs to the surface').toBe(true);
    const reg = w.game.registry;
    const rng = w.game.world.rngFor('t501');
    const { partyId, pendingSpawns } = arriveParty(w.game.world as never, reg, rng, 'siege', 'gloam', 4, 'n', w.tick, 15, 4, false);
    // Its melee members only: a siege's archers would shoot the dogs through the ring.
    for (const s of pendingSpawns.filter((p) => p.role === 'warriors' || p.role === 'captain')) {
      spawnHostileMember(w.game.world as never, reg, rng, s.partyId, s.species, s.role, s.tile, s.gearTier, s.isCaptain);
    }
    const P = (): Party => w.game.world.entities.get(partyId, C.Party)!;
    const start = w.tick;
    const states: string[] = [];
    let heldDog = false;
    let stalledAt = -1;
    const limit = (LOITER_DAYS_SIEGE + 3) * TICKS_PER_DAY;
    w.until(() => {
      const p = P();
      if (states[states.length - 1] !== p.state) states.push(p.state);
      if (p.members.some((m) => dogs.includes(w.game.world.services.combat?.targetOf(m) ?? 0))) heldDog = true;
      if (stalledAt < 0 && p.stalled === true) stalledAt = w.tick;
      return w.events('RaidEnded').some((e) => e['partyId'] === partyId);
    }, limit);
    expect(heldDog, 'a member saw and held a dog').toBe(true);
    expect(states.slice(0, 3), 'it engaged the dogs').toContain('engage');
    expect(stalledAt, `it stalled; states ${states.join(' > ')}`).toBeGreaterThan(0);
    // It engages within a day of arriving and stalls ENGAGE_STALL_TICKS later (a think's slack).
    expect(stalledAt - start).toBeLessThan(TICKS_PER_DAY + ENGAGE_STALL_TICKS + 100);
    const ended = w.events('RaidEnded').find((e) => e['partyId'] === partyId);
    expect(ended, `the siege ended; states ${states.join(' > ')}`).toBeDefined();
    expect(ended?.['outcome']).toBe('withdrew');
    expect(states.slice(states.indexOf('loiter')), 'once stalled, sight never brought it back to engage').toEqual(['loiter', 'retreat', 'gone']);
    for (const d of dogs) expect(w.game.world.entities.alive(d), 'the dogs are alive in their pen').toBe(true);
  });
});
