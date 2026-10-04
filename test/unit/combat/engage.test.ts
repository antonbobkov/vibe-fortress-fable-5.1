import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { TARGET_LOSE_TICKS } from '@systems/combat/constants';
import { TestWorld } from '../../scenarios/test-world';
import { roundTrip } from '@app/game-save';
import { spawnHostileMember } from '@systems/threats/parties';
import { ENGAGE_IDLE_TICKS } from '@systems/threats/constants';

function emptyArcher(distance: number, ammo = 0) {
  const w = new TestWorld({ world: 'flat-test', embark: 'none', seed: 'engage-empty-launcher' });
  const at = w.index(36, distance, 32);
  const archer = w.spawnCreature('gloam_archer', at, 'hostile:gloam');
  // A stationary target has the normal creature components, without a civilian brain.
  const target = w.spawnCreature('dwarf', w.index(36, 0, 32), 'fortress');
  const bow = w.spawnItem('bow', 'oak', at);
  w.game.world.services.items!.attachToCarrier(bow, archer);
  w.game.world.entities.add(archer, C.Equipment, {
    weapon: bow, shield: 0, quiver: 0,
    armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
    clothing: { body: 0, legs: 0, feet: 0, over: 0 },
  });
  if (ammo > 0) w.game.world.services.items!.attachToCarrier(w.spawnItem('arrow', 'iron', at, ammo), archer);
  w.game.world.services.combat!.setTarget(archer, target);
  return { w, archer, target, at };
}

describe('T-M8-06 engage: closing, attack priority and unreachable targets', () => {
  it('D-218: an occluded target remains engaged while the member paths around a wall and attacks', () => {
    const w = new TestWorld({ world: 'flat-test', embark: 'none', seed: 'engage-occluded' });
    for (let y = 0; y <= 20; y += 1) w.carve(w.index(13, y, 32), TileKind.Wall);
    const at = w.index(10, 10, 32);
    const targetAt = w.index(16, 10, 32);
    const partyId = w.game.world.entities.create('party');
    w.game.world.entities.add(partyId, C.Party, {
      civ: 'gloam', purpose: 'raid', members: [], leaderId: 0, state: 'engage',
      goalTile: at, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 's', size: 1,
    });
    const member = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
      partyId, 'gloam_warrior', 'warriors', at, 2, false);
    const target = w.spawnCreature('dwarf', targetAt, 'fortress');
    w.pathing.connectivity.rebuildDirty();
    expect(w.readers.pathing.lineOfSight(at, targetAt)).toBe(false);
    expect(w.readers.pathing.reachable(at, targetAt, 'walker')).toBe(true);
    const combat = w.game.world.services.combat!;
    combat.setTarget(member, target);
    w.step(1);
    expect(combat.targetOf(member)).toBe(target);
    w.step(ENGAGE_IDLE_TICKS + 50);
    expect(w.game.world.entities.get(partyId, C.Party)?.state).toBe('engage');
    w.until(() => w.events('AttackResolved').some((e) => e['attackerId'] === member && e['defenderId'] === target), 400);
  });

  it('an empty launcher closes to a stationary edge target and attacks in melee', () => {
    const { w, archer, target, at } = emptyArcher(8);
    expect(w.readers.pathing.reachable(at, w.index(36, 0, 32), 'walker')).toBe(true);
    w.until(() => w.events('AttackResolved').some((e) => e['attackerId'] === archer), 180);
    expect(w.game.world.services.movement!.tileOf(archer)).not.toBe(at);
    expect(w.events('AttackResolved').some((e) => e['defenderId'] === target)).toBe(true);
    expect(w.events('ProjectileFired')).toHaveLength(0);
  });

  it('adjacency takes melee priority even with a loaded launcher', () => {
    const { w, archer } = emptyArcher(1, 30);
    w.step(1);
    expect(w.events('AttackResolved').some((e) => e['attackerId'] === archer)).toBe(true);
    expect(w.events('ProjectileFired')).toHaveLength(0);
  });

  it('a loaded launcher drops a target outside perception instead of firing at it', () => {
    const { w, archer } = emptyArcher(15, 30);
    w.step(1);
    expect(w.game.world.services.combat!.targetOf(archer)).toBe(0);
    expect(w.events('ProjectileFired')).toHaveLength(0);
  });

  it('failed paths through a walker-labelled door lose the target after 200 ticks, including pending retries', () => {
    const w = new TestWorld({ world: 'flat-test', embark: 'none', seed: 'engage-path-failure' });
    for (let x = 0; x < w.map.w; x += 1) if (x !== 36) w.carve(w.index(x, 2, 32), TileKind.Wall);
    w.build('door', w.index(36, 2, 32), 'oak');
    const at = w.index(36, 0, 32);
    const targetAt = w.index(36, 6, 32);
    const attacker = w.spawnCreature('trollkin', at, 'hostile:gloam');
    const target = w.spawnCreature('dwarf', targetAt, 'fortress');
    w.pathing.connectivity.rebuildDirty();
    expect(w.readers.pathing.reachable(at, targetAt, 'walker')).toBe(true);
    expect(w.readers.pathing.reachable(at, targetAt, 'large')).toBe(false);
    const combat = w.game.world.services.combat!;
    combat.setTarget(attacker, target);
    w.step(80);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    for (let tick = 80; tick < TARGET_LOSE_TICKS; tick += 1) {
      w.step(1);
      loaded.step(1);
      expect(loaded.hash()).toBe(w.hash());
    }
    expect(combat.targetOf(attacker)).toBe(target);
    w.step(1);
    loaded.step(1);
    expect(loaded.hash()).toBe(w.hash());
    expect(combat.targetOf(attacker)).toBe(0);
    expect(w.events('AttackResolved')).toHaveLength(0);
  });
});
