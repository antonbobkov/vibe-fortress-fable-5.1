import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import type { TickContext } from '@core/system';
import { ItemsSystem } from '@systems/items';
import { claimItemForSoldier, dropItemAtBarracks } from '@systems/combat/equipment';
import { stepTraining } from '@systems/combat/training';
import { fireRanged } from '@systems/combat/ranged';
import { TestWorld } from '../scenarios/test-world';

function setup() {
  const w = new TestWorld({ seed: 't162-accounting', world: 'flat-test', embark: 'none' });
  const at = w.index(30, 30, 32);
  const soldier = w.spawnDwarf({ at, ageYears: 30 });
  const ctx: TickContext = { world: w.game.world, registry: w.game.registry, rng: w.game.world.rngFor('16'),
    terrain: w.game.world.services.terrain, jobs: w.game.world.services.jobs, spawn: w.game.world.services.spawn,
    tick: w.tick, readers: w.readers, emit: (event) => w.game.world.emit(event), register: {} as never };
  const items = w.game.world.services.items!;
  const core = (w.game.world.scheduler.byId('13') as ItemsSystem).core;
  return { w, at, soldier, ctx, items, core };
}

function checkCounts(w: TestWorld) {
  const core = (w.game.world.scheduler.byId('13') as ItemsSystem).core;
  const rows = core.counts.serialize().map(([type, count]) => [type, count.total, count.available]);
  expect(rows).toEqual(core.recount().rows);
  for (const holder of w.game.world.entities.with(C.Container)) {
    const named = w.game.world.entities.with(C.Item).filter((id) => w.game.world.entities.get(id, C.Item)?.containerId === holder).sort((a, b) => a - b);
    expect(w.game.world.entities.get(holder, C.Container)?.contents).toEqual(named);
  }
}

describe('T-162 squad item accounting', () => {
  it.each([false, true])('claiming a weapon from a container=%s keeps stock counts and contents exact', (contained) => {
    const { w, at, soldier, items } = setup();
    const sword = w.spawnItem('short_sword', 'iron', at);
    const barrel = w.spawnItem('barrel', 'oak', at);
    if (contained) expect(items.putIn(sword, barrel)).toBe(true);
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' })).toEqual({ ok: true });
    const squadId = w.game.world.entities.with(C.Squad)[0]!;
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: [soldier] })).toEqual({ ok: true });
    expect(w.game.world.entities.get(soldier, C.Equipment)?.weapon).toBe(sword);
    checkCounts(w);
    expect(w.game.world.entities.get(barrel, C.Container)?.contents).not.toContain(sword);
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });
  it('dropping a claimed weapon returns its availability through the API', () => {
    const { w, at, soldier, ctx, items } = setup();
    const sword = w.spawnItem('short_sword', 'iron', at);
    items.attachToCarrier(sword, soldier);
    items.setOwner(sword, soldier);
    dropItemAtBarracks(ctx, sword, 0, soldier);
    expect(w.game.world.entities.get(sword, C.Item)).toMatchObject({ carriedBy: 0, ownerId: 0 });
    checkCounts(w);
  });
  it('heals saved stock counts once on load without changing a valid save', () => {
    const { w, at, soldier, core, items } = setup();
    const sword = w.spawnItem('short_sword', 'iron', at);
    items.attachToCarrier(sword, soldier);
    items.setOwner(sword, soldier);
    const correct = core.counts.serialize();
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
    const corrupt = correct.map(([type, count]) => [type, { ...count, available: count.available + 1, total: count.total + 2 }] as typeof correct[number]);
    core.counts.deserialize(corrupt);
    const loaded = roundTrip(w.game).game;
    expect((loaded.world.scheduler.byId('13') as ItemsSystem).core.counts.serialize()).toEqual(correct);
  });
  it('archery practice consumes and drops ammunition with exact counts', () => {
    const { w, at, soldier, ctx } = setup();
    const targetTile = w.index(31, 30, 32);
    w.build('archery_target', targetTile, 'oak');
    const barracks = w.zone('barracks', [at, targetTile]);
    w.spawnItem('crossbow', 'oak', at);
    w.spawnItem('quiver', 'leather', at);
    w.spawnItem('bolt', 'iron', at, 25);
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Archers' })).toEqual({ ok: true });
    const squadId = w.game.world.entities.with(C.Squad)[0]!;
    expect(w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId, equipment: { ranged: true } })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: [soldier] })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: barracks, key: 'squad', value: squadId })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'SetSquadMode', squadId, mode: 'train' })).toEqual({ ok: true });
    const before = (w.game.world.scheduler.byId('13') as ItemsSystem).core.recount().rows;
    stepTraining(ctx, w.game.world.rngFor('16'), new Map(), 'calm');
    expect((w.game.world.scheduler.byId('13') as ItemsSystem).core.recount().rows).not.toEqual(before);
    checkCounts(w);
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });
  it('firing a last carried bolt clears its holder through the item API', () => {
    const { w, at, soldier, ctx, items } = setup();
    const crossbow = w.spawnItem('crossbow', 'iron', at);
    const bolt = w.spawnItem('bolt', 'iron', at);
    claimItemForSoldier(w.game.world.entities, crossbow, soldier, items);
    claimItemForSoldier(w.game.world.entities, bolt, soldier, items);
    w.game.world.entities.add(soldier, C.Equipment, { weapon: crossbow, shield: 0, quiver: bolt,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 }, clothing: { body: 0, legs: 0, feet: 0, over: 0 } });
    const target = w.game.spawn.creature(w.game.registry.table('creatures').index('deer'), w.index(35, 30, 32), 'wild');
    expect(fireRanged(ctx, soldier, target, new Map())).toBe(true);
    const projectile = w.game.world.entities.with(C.Projectile)[0]!;
    expect(w.game.world.entities.get(bolt, C.Item)?.carriedBy).toBe(projectile);
    expect(w.game.world.entities.has(bolt, C.Position)).toBe(false);
    checkCounts(w);
  });
});
