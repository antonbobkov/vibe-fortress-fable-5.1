/** T-213: attack perception grace and the physical meal after a predator kill. */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { TickContext } from '@core/system';
import { EAT_CORPSE_TICKS, thinkWild } from '@systems/animals';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

function hunter(species = 'dwarf') {
  const w = new TestWorld({ seed: 't213-predator-rules', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const wolf = w.spawnCreature('wolf', w.index(20, 20, Z), 'wild');
  const target = species === 'dwarf' ? w.spawnDwarf({ at: w.index(21, 20, Z) }) : w.spawnCreature(species, w.index(21, 20, Z), 'wild');
  const e = w.game.world.entities;
  e.add(wolf, C.Wild, { ...e.get(wolf, C.Wild)!, state: 'attack', hungry: true, lastThinkTick: -100 });
  w.animals.brain.setTarget(wolf, target);
  const think = (tick: number) => {
    const ctx = { tick, world: w.game.world, emit: () => {} } as unknown as TickContext;
    const next = thinkWild(w.animals.brain, ctx, wolf, e.get(wolf, C.Wild)!);
    e.add(wolf, C.Wild, next); return next.state;
  };
  return { w, wolf, target, e, think };
}

function kill(species = 'rabbit') {
  const a = hunter(species);
  const body = a.e.get(a.target, C.Body)!;
  a.w.game.world.emit({ type: 'DamageDealt', attackerId: a.wolf, defenderId: a.target,
    part: 'torso', damageType: 'edge', amount: body.parts[1]!.maxHp * 2 });
  a.w.until(() => a.w.events('CorpseCreated').some(e => e['creatureId'] === a.target), 20);
  const event = a.w.events('CorpseCreated').find(e => e['creatureId'] === a.target)!;
  expect(event).toBeDefined();
  const corpse = event['itemId'] as number;
  expect(a.e.alive(a.target)).toBe(false); expect(a.e.alive(corpse)).toBe(true);
  expect(a.e.get(a.wolf, C.Wild)?.hungry).toBe(false);
  return { ...a, corpse };
}

describe('T-213 the animal brain owns a saved fifty-tick attack grace', () => {
  it('holds a living target for 49 unseen ticks, dropping it at 50', () => {
    const a = hunter(); a.e.add(a.target, C.Position, { x: 40, y: 20, z: Z });
    expect(a.think(100)).toBe('attack');
    expect(a.think(149)).toBe('attack'); expect(a.w.animals.brain.targetOf?.(a.wolf)).toBe(a.target);
    expect(a.think(150)).toBe('idle'); expect(a.w.animals.brain.targetOf?.(a.wolf)).toBe(0);
  });

  it('loses perception through a wall and resets the grace when sight returns', () => {
    const a = hunter(); a.e.add(a.target, C.Position, { x: 24, y: 20, z: Z });
    a.w.map.setKind(a.w.index(22, 20, Z), TileKind.Wall, 1);
    expect(a.think(100)).toBe('attack');
    a.w.map.setKind(a.w.index(22, 20, Z), TileKind.Floor, 1); expect(a.think(140)).toBe('attack');
    a.w.map.setKind(a.w.index(22, 20, Z), TileKind.Wall, 1);
    expect(a.think(160)).toBe('attack'); expect(a.think(209)).toBe('attack');
    expect(a.think(210)).toBe('idle');
  });

  it('combat does not discard a wild attack outside its generic perception radius', () => {
    const a = hunter(); a.e.add(a.target, C.Position, { x: 40, y: 20, z: Z });
    a.w.step(1);
    expect(a.w.game.world.services.combat!.targetOf(a.wolf)).toBe(a.target);
    expect(a.e.get(a.wolf, C.Wild)?.state).toBe('attack');
    const loaded = roundTrip(a.w.game).game; expect(loaded.hash()).toBe(a.w.hash());
    for (let tick = 0; tick < 50; tick += 1) { a.w.step(1); loaded.step(1); expect(loaded.hash()).toBe(a.w.hash()); }
  });

  it('still ends a defending attack immediately when the target leaves its defended ground', () => {
    const a = hunter(); a.e.add(a.wolf, C.Wild, { ...a.e.get(a.wolf, C.Wild)!, defendFrom: a.w.index(20, 20, Z) });
    a.e.add(a.target, C.Position, { x: 24, y: 20, z: Z });
    expect(a.think(100)).toBe('wander'); expect(a.w.animals.brain.targetOf?.(a.wolf)).toBe(0);
  });
});

describe('T-213 a predator walks to and eats the corpse of its kill', () => {
  it('ends hunger at the kill, then spends EAT_CORPSE_TICKS at the corpse before consuming it', () => {
    const a = kill(); expect(a.e.get(a.wolf, C.Wild)?.state).toBe('eat');
    a.w.until(() => a.e.get(a.wolf, C.Wild)?.state === 'eat' && a.e.get(a.wolf, C.Wild)!.stateUntil > a.w.tick, 200);
    const until = a.e.get(a.wolf, C.Wild)!.stateUntil;
    // Calendar advances after the brain tick that starts the meal.
    expect(until - (a.w.tick - 1)).toBe(EAT_CORPSE_TICKS);
    expect(a.w.game.world.services.movement!.tileOf(a.wolf)).toBe(a.w.readers.of<ItemsReader>('13').tileOf(a.corpse));
    a.w.step(EAT_CORPSE_TICKS - 1); expect(a.e.alive(a.corpse)).toBe(true);
    a.w.step(1); expect(a.e.alive(a.corpse)).toBe(false);
    expect(a.e.get(a.wolf, C.Wild)?.hungry).toBe(false);
    expect(a.w.events('ItemDestroyed').filter(e => e['id'] === a.corpse)).toHaveLength(1);
  });

  it('preserves a half-eaten meal and every next continuation hash across save/load', () => {
    const a = kill(); expect(a.e.get(a.wolf, C.Wild)?.state).toBe('eat');
    a.w.until(() => a.e.get(a.wolf, C.Wild)!.stateUntil > a.w.tick, 200); a.w.step(EAT_CORPSE_TICKS / 2);
    const loaded = roundTrip(a.w.game).game; expect(loaded.hash()).toBe(a.w.hash());
    for (let tick = 0; tick < EAT_CORPSE_TICKS / 2 + 1; tick += 1) { a.w.step(1); loaded.step(1); expect(loaded.hash()).toBe(a.w.hash()); }
    expect(a.e.alive(a.corpse)).toBe(false);
  });

  it('saves between the death message and its following corpse delivery', () => {
    const a = hunter('rabbit');
    a.w.game.world.emit({ type: 'DamageDealt', attackerId: a.wolf, defenderId: a.target,
      part: 'torso', damageType: 'edge', amount: a.e.get(a.target, C.Body)!.parts[1]!.maxHp * 2 });
    a.w.until(() => a.w.events('CreatureDied').some(e => e['id'] === a.target), 10);
    expect(a.e.get(a.wolf, C.Wild)?.pendingMeal).toBe(a.target);
    expect(a.w.events('CorpseCreated')).toHaveLength(0);
    const loaded = roundTrip(a.w.game).game; expect(loaded.hash()).toBe(a.w.hash());
    for (let tick = 0; tick < 50; tick += 1) { a.w.step(1); loaded.step(1); expect(loaded.hash()).toBe(a.w.hash()); }
    expect(a.e.get(a.wolf, C.Wild)?.pendingMeal).toBeUndefined();
    expect(a.e.get(a.wolf, C.Wild)?.state).toBe('eat');
  });

  it('finishes on the saved deadline when its near/far think interval changes', () => {
    const a = kill();
    a.w.until(() => a.e.get(a.wolf, C.Wild)!.stateUntil > a.w.tick, 200);
    const until = a.e.get(a.wolf, C.Wild)!.stateUntil;
    const visitor = a.w.spawnDwarf({ at: a.w.index(24, 20, Z) });
    a.w.step(3); a.w.movement.teleport(visitor, a.w.index(60, 20, Z));
    a.w.step(until - a.w.tick); expect(a.e.alive(a.corpse)).toBe(true);
    a.w.step(1); expect(a.e.alive(a.corpse)).toBe(false);
  });

  it('makes eaten dwarf remains unavailable for burial without emitting burial relief', () => {
    const a = kill('dwarf');
    expect(a.e.get(a.corpse, C.Corpse)?.dwarfName).not.toBeNull();
    a.w.until(() => !a.e.alive(a.corpse), EAT_CORPSE_TICKS + 200);
    expect(a.e.has(a.corpse, C.Corpse)).toBe(false);
    expect(a.w.events('Buried')).toHaveLength(0);
  });

  it('leaves carried-away remains with their living carrier', () => {
    const a = kill();
    const carrier = a.w.spawnDwarf({ at: a.w.index(30, 20, Z) });
    a.w.game.world.services.items!.attachToCarrier(a.corpse, carrier);
    a.w.step(20);
    expect(a.e.get(a.wolf, C.Wild)?.state).not.toBe('eat');
    expect(a.e.alive(a.corpse)).toBe(true);
    expect(a.e.get(a.corpse, C.Item)?.carriedBy).toBe(carrier);
  });

  it('abandons a meal that another item path removes without consuming it twice', () => {
    const a = kill(); expect(a.e.get(a.wolf, C.Wild)?.state).toBe('eat');
    a.w.game.world.services.items!.destroy(a.corpse, 'test_disposed');
    a.w.step(20);
    expect(a.e.get(a.wolf, C.Wild)?.state).not.toBe('eat');
    expect(a.w.events('ItemDestroyed').filter(e => e['id'] === a.corpse)).toHaveLength(1);
  });
});
