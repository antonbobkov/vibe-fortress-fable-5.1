/**
 * T-648's sweep, seed `three-years-p2-7` at shift 0: an off-duty soldier, Melkorka, held a maple
 * training sword and fought a wild badger beside her for over two days. Her 152 blows did 0 damage,
 * the badger's bites did 0 through her steel, and being in reach kept her fight's deadline moving, so
 * nothing ended it (`dwarf.frozen-2d`). 16 § Targeting now counts a fight that harms no one: after
 * `HARMLESS_FIGHT_TICKS` with no blow by or on a creature doing damage, the animal lets go and wanders
 * (08 § Wild behavior) and the dwarf leaves the fight (10 § Behavior selection).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Attributes } from '@core/components';
import type { EntityId } from '@core/types';
import type { CombatReader, SquadWithId } from '@systems/combat';
import { HARMLESS_FIGHT_TICKS } from '@systems/combat/constants';
import { TargetManager } from '@systems/combat/targets';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

/** An off-duty soldier in steel from head to foot, holding only a maple training sword, and a badger beside her. */
function duel(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const at = w.index(30, 30, Z);
  const dwarf = w.spawnDwarf({ at, name: 'Melkorka Raventongue', skills: { sword: 4 } });
  for (const labor of w.game.registry.table('labors').ids()) w.game.world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor, on: false });
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Swords' });
  const combat = w.readers.of<CombatReader>('16');
  const squad = combat.squads()[0] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [dwarf] });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'off' });
  w.step(1);
  const e = w.game.world.entities;
  const piece = (type: string): EntityId => {
    const id = w.spawnItem(type, 'steel', at);
    e.add(id, C.Item, { ...e.get(id, C.Item)!, carriedBy: dwarf });
    return id;
  };
  const sword = w.spawnItem('training_sword', 'maple', at);
  e.add(sword, C.Item, { ...e.get(sword, C.Item)!, carriedBy: dwarf });
  const equip = e.get(dwarf, C.Equipment);
  e.add(dwarf, C.Equipment, {
    weapon: sword, shield: 0, quiver: 0,
    clothing: equip?.clothing ?? { body: 0, legs: 0, feet: 0, over: 0 },
    armor: { head: piece('helm'), body: piece('breastplate'), arms: piece('gauntlets'), legs: piece('greaves'), feet: piece('metal_boots') },
  });
  const badger = w.spawnCreature('badger', w.index(31, 31, Z), 'wild');
  // A weak badger, whose bite (6 at strength 50) cannot get through steel at any roll.
  e.add(badger, C.Attributes, { ...(e.get(dwarf, C.Attributes) as Attributes), str: 0 });
  const blows: { attacker: EntityId; amount: number }[] = [];
  w.game.world.onEvents((events) => {
    for (const ev of events) {
      if (ev.type === 'AttackResolved' && (ev['attackerId'] === dwarf || ev['attackerId'] === badger)) blows.push({ attacker: ev['attackerId'] as EntityId, amount: Number(ev['amount'] ?? 0) });
    }
  });
  return { w, dwarf, badger, combat, blows };
}

describe('T-648 a fight in which no one can be hurt ends', () => {
  it('the badger lets go and wanders, and the soldier leaves the fight', () => {
    const { w, dwarf, badger, combat, blows } = duel('t648-badger');
    w.until(() => combat.targetOf(badger) === dwarf, 200);
    const began = w.tick;
    w.until(() => combat.targetOf(badger) !== dwarf, HARMLESS_FIGHT_TICKS + 200);
    const ended = w.tick;
    expect(blows.filter((b) => b.attacker === badger).length, 'the badger bit').toBeGreaterThan(5);
    expect(blows.filter((b) => b.attacker === dwarf).length, 'and the soldier struck back').toBeGreaterThan(5);
    expect(blows.every((b) => b.amount === 0), 'every blow did no harm').toBe(true);
    expect(ended - began, 'the fight went on until it had harmed no one for the span').toBeGreaterThanOrEqual(HARMLESS_FIGHT_TICKS - 20);
    expect(w.game.world.entities.get(badger, C.Wild)?.state).toBe('wander');
    w.step(20);
    expect(combat.targetOf(dwarf), 'the soldier holds no target').toBe(0);
    expect(w.game.world.entities.get(dwarf, C.Brain)?.activity).not.toBe('Fighting');
    // The wandering badger ignores her: the fight does not start again at once.
    w.step(300);
    expect(combat.targetOf(badger)).toBe(0);
  }, 60_000);

  it('a blow that does damage starts the count again', () => {
    const w = new TestWorld({ seed: 't648-count', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const a = w.spawnDwarf({ at: w.index(30, 30, Z) });
    const b = w.spawnCreature('badger', w.index(31, 30, Z), 'wild');
    const targets = new TargetManager(w.game.world.entities);
    expect(targets.harmlessFor(a, 100)).toBe(0);
    targets.setTarget(a, b);
    targets.refreshHarmless(100);
    expect(targets.harmlessFor(a, 400)).toBe(300);
    targets.refreshHarmless(400);
    expect(targets.harmlessFor(a, 400), 'the same target keeps its count').toBe(300);
    targets.harmed(a, 450);
    expect(targets.harmlessFor(a, 500)).toBe(50);
    targets.setTarget(a, 0);
    targets.refreshHarmless(500);
    expect(targets.harmlessFor(a, 600)).toBe(0);
    expect(targets.harmless.has(a)).toBe(false);
  });
});
