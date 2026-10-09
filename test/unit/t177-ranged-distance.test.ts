import { describe, expect, it, vi } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { Registrations, type TickContext } from '@core/system';
import type { CombatSystem } from '@systems/combat';
import { RANGED_KEEP_DISTANCE } from '@systems/combat/constants';
import { TestWorld } from '../scenarios/test-world';

function arena() {
  const w = new TestWorld({ seed: 't177-ranged', world: 'flat-test', embark: 'none' });
  const start = w.index(20, 20, 32);
  const id = w.spawnDwarf({ at: start, ageYears: 30 });
  const bow = w.spawnItem('crossbow', 'iron', start);
  w.spawnItem('quiver', 'leather', start);
  w.spawnItem('bolt', 'iron', start, 20);
  const cmd = w.game.world.applyCommand.bind(w.game.world);
  expect(cmd({ type: 'CreateSquad', name: 'Archers' })).toEqual({ ok: true });
  const squadId = w.game.world.entities.with(C.Squad)[0]!;
  expect(cmd({ type: 'SetSquadEquipment', squadId, equipment: { ranged: true } })).toEqual({ ok: true });
  expect(cmd({ type: 'SetSquadMembers', squadId, members: [id] })).toEqual({ ok: true });
  expect(cmd({ type: 'SetSquadMode', squadId, mode: 'active' })).toEqual({ ok: true });
  expect(w.game.world.entities.get(id, C.Equipment)?.weapon).toBe(bow);
  const target = w.spawnCreature('trollkin', w.index(22, 20, 32), 'hostile:gloam');
  const combat = w.game.world.scheduler.byId('16') as CombatSystem;
  combat.setTarget(id, target);
  const ctx: TickContext = { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('16'), register: new Registrations(), jobs: w.game.world.services.jobs,
    terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn, emit: (e) => w.game.world.emit(e) };
  const walk = vi.spyOn(w.movement, 'walkTo');
  const requested = () => walk.mock.calls.filter(([who]) => who === id).map(([, tile]) => tile);
  return { w, id, target, combat, ctx, walk, requested, start, cmd, squadId };
}
function distance(w: TestWorld, a: number, b: number) {
  return Math.max(Math.abs(w.map.xOf(a) - w.map.xOf(b)), Math.abs(w.map.yOf(a) - w.map.yOf(b)));
}

describe('T-177 on-duty ranged soldiers keep distance from nearby melee threats', () => {
  it('requests the first legal adjacent retreat tile and actually walks there', () => {
    const { w, id, target, combat, ctx, requested, start } = arena();
    combat.tick(ctx);
    expect(requested()).toEqual([w.index(19, 19, 32)]);
    w.step(12);
    expect(w.movement.tileOf(id)).not.toBe(start);
    expect(distance(w, w.movement.tileOf(id), w.movement.tileOf(target))).toBeGreaterThanOrEqual(RANGED_KEEP_DISTANCE);
    expect(w.readers.pathing.lineOfSight(w.movement.tileOf(id), w.movement.tileOf(target))).toBe(true);
  });
  it('also notices a nearby melee threat while already targeting a distant creature', () => {
    const { w, id, combat, ctx, requested } = arena();
    const far = w.spawnCreature('gloam_archer', w.index(28, 20, 32), 'hostile:gloam');
    combat.setTarget(id, far);
    combat.tick(ctx);
    expect(requested()).toEqual([w.index(19, 19, 32)]);
  });
  it('does not retreat where every sufficiently distant adjacent tile is blocked', () => {
    const { w, combat, ctx, requested } = arena();
    for (const y of [19, 20, 21]) w.map.setKind(w.index(19, y, 32), TileKind.Wall, w.game.registry.table('materials').index('granite'));
    combat.tick(ctx);
    expect(requested()).toEqual([]);
  });
  it('does not kite from a melee threat hidden behind a wall', () => {
    const { w, target, combat, ctx, requested } = arena();
    w.map.setKind(w.index(21, 20, 32), TileKind.Wall, w.game.registry.table('materials').index('granite'));
    combat.tick(ctx);
    expect(requested()).toEqual([w.movement.tileOf(target)]);
  });
  it('does not kite from a melee threat more than two tiles away', () => {
    const { w, target, combat, ctx, requested } = arena();
    w.movement.teleport(target, w.index(23, 20, 32));
    combat.tick(ctx);
    expect(requested()).toEqual([]);
  });
  it('does not kite from a creature wielding a launcher', () => {
    const { w, target, combat, ctx, requested } = arena();
    const weapon = w.spawnItem('crossbow', 'iron', w.movement.tileOf(target));
    w.game.world.entities.add(target, C.Equipment, { weapon, shield: 0, quiver: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 }, clothing: { body: 0, legs: 0, feet: 0, over: 0 } });
    combat.tick(ctx);
    expect(requested()).toEqual([]);
  });
  it('does not kite while off duty', () => {
    const { combat, ctx, requested, cmd, squadId } = arena();
    expect(cmd({ type: 'SetSquadMode', squadId, mode: 'off' })).toEqual({ ok: true });
    combat.tick(ctx);
    expect(requested()).toEqual([]);
  });
});
