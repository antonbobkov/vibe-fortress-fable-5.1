/**
 * T-464: one cave crawler killed 43 dwarves and took no blow. A hunting cavern monster now catches a
 * fleeing civilian as a hunting wild animal does, and a soldier off duty who is hit fights with its gear.
 */
import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SPEC, FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { C } from '@core/components';
import type { EntityId, TileIndex } from '@core/types';
import type { CombatReader } from '@systems/combat/reader';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 96, 96), embark: 'none', surfaceWildlife: 'none', spec: { ...FLAT_TEST_SPEC, traits: [] } });
}

function monster(w: TestWorld, tile: TileIndex, target: EntityId): EntityId {
  const id = w.spawnCreature('cave_crawler', tile, 'hostile:cavern');
  w.game.world.entities.add(id, C.Hostile, { partyId: 0, role: 'cavern_monster', behaviorState: 'attack', stealthed: false, spotted: false, breakingDoorId: 0, breakingSince: 0 });
  w.game.world.services.combat?.setTarget(id, target);
  return id;
}

function struck(w: TestWorld, by: EntityId, at: EntityId): number {
  return w.events('AttackResolved').filter((e) => e['attackerId'] === by && e['defenderId'] === at).length;
}

describe('T-464 what is caught and fights back', () => {
  it('a cave crawler no slower than a civilian catches it, and the civilian strikes back', () => {
    const w = world('t464-civilian');
    const dwarf = w.spawnDwarf({ at: w.index(41, 40, Z) });
    const crawler = monster(w, w.index(40, 40, Z), dwarf);
    expect(w.game.world.entities.get(crawler, C.Motion)!.speed).toBeGreaterThanOrEqual(w.game.world.entities.get(dwarf, C.Motion)!.speed);
    for (let t = 0; t < 900 && w.game.world.entities.alive(dwarf) && w.game.world.entities.alive(crawler) && struck(w, dwarf, crawler) === 0; t += 1) {
      if (t % 10 === 0) w.game.world.services.combat?.setTarget(crawler, dwarf);
      w.step(1);
    }
    expect(struck(w, crawler, dwarf), 'the crawler hit').toBeGreaterThan(0);
    expect(struck(w, dwarf, crawler), 'the civilian struck back').toBeGreaterThan(0);
  });

  it('a soldier off duty hit by a hostile of a party fights it, though a civilian would keep running', () => {
    const w = world('t464-soldier');
    const dwarf = w.spawnDwarf({ at: w.index(41, 40, Z) });
    w.spawnDwarf({ at: w.index(60, 60, Z) });
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' }).ok).toBe(true);
    const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
    expect(w.game.world.applyCommand({ type: 'SetSquadMode', squadId, mode: 'off' }).ok).toBe(true);
    const mace = w.spawnItem('mace', 'iron', w.index(42, 40, Z), 1);
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: [dwarf] }).ok).toBe(true);
    w.step(1);
    expect(w.game.world.entities.get(dwarf, C.Equipment)!.weapon).toBe(mace);
    expect(w.game.world.entities.get(dwarf, C.Soldier)!.onDuty).toBe(false);
    const goblin = w.spawnCreature('hillfolk_bandit', w.index(40, 40, Z), 'hostile:hillfolk');
    w.game.world.services.combat?.setTarget(goblin, dwarf);
    for (let t = 0; t < 900 && w.game.world.entities.alive(dwarf) && w.game.world.entities.alive(goblin) && struck(w, dwarf, goblin) === 0; t += 1) {
      if (t % 10 === 0) w.game.world.services.combat?.setTarget(goblin, dwarf);
      w.step(1);
    }
    expect(struck(w, goblin, dwarf), 'the goblin hit').toBeGreaterThan(0);
    expect(struck(w, dwarf, goblin), 'the soldier struck back').toBeGreaterThan(0);
  });
});
