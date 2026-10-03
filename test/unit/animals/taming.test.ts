import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { C } from '@core/components';
import {
  KENNEL_WORKSHOP,
  TRAIN_BASE_PERMILLE,
  TRAIN_PER_SKILL,
  trainingSuccessChance,
} from '@systems/animals';
import { isWarTrained } from '@systems/combat/melee';
import { TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { CombatReader } from '@systems/combat';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const at = (w: TestWorld, x = 15, y = 15): number => w.index(x, y, Z);
const world = (seed: string): TestWorld =>
  new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });

describe('T-M6-15 taming and training', () => {
  it('training success formula computes TRAIN_BASE_PERMILLE + skill * TRAIN_PER_SKILL clamped to 0..1000', () => {
    expect(trainingSuccessChance(0)).toBe(TRAIN_BASE_PERMILLE); // 300
    expect(trainingSuccessChance(10)).toBe(TRAIN_BASE_PERMILLE + 10 * TRAIN_PER_SKILL); // 650
    expect(trainingSuccessChance(20)).toBe(1000); // 300 + 700 = 1000
    expect(trainingSuccessChance(25)).toBe(1000); // clamped at 1000
    expect(trainingSuccessChance(-10)).toBe(0); // clamped at 0
  });

  it('TrainAnimal rejects invalid commands and trains dogs at the kennel on completion', () => {
    const w = world('train-animal-cmd');
    const dog = w.spawnTame('dog', at(w, 10, 10));
    const cow = w.spawnTame('cow', at(w, 12, 10));

    // Rejects if animal not tame or non-existent
    expect(w.game.world.applyCommand({ type: 'TrainAnimal', animalId: 99999, kind: 'war' })).toEqual({
      ok: false,
      reason: 'not_tame',
    });

    // Rejects if invalid kind
    expect(w.game.world.applyCommand({ type: 'TrainAnimal', animalId: dog, kind: 'invalid' as unknown as 'war' })).toEqual({
      ok: false,
      reason: 'precondition_failed',
    });

    // Rejects if species not trainable for kind (cow is not trainable)
    expect(w.game.world.applyCommand({ type: 'TrainAnimal', animalId: cow, kind: 'war' })).toEqual({
      ok: false,
      reason: 'not_trainable',
    });

    // Rejects if no kennel exists
    expect(w.game.world.applyCommand({ type: 'TrainAnimal', animalId: dog, kind: 'war' })).toEqual({
      ok: false,
      reason: 'no_kennel',
    });

    // Build a kennel workshop
    const kennelPos = at(w, 15, 15);
    w.build(KENNEL_WORKSHOP, kennelPos, 'oak');

    // Spawn a trainer dwarf with skill 10 animal_training
    w.spawnDwarf({
      at: at(w, 15, 14),
      skills: { animal_training: 10 },
    });

    // Now TrainAnimal succeeds
    expect(w.game.world.applyCommand({ type: 'TrainAnimal', animalId: dog, kind: 'war' })).toEqual({ ok: true });

    // Step until AnimalTrained is emitted
    w.until((worldLike) => worldLike.events('AnimalTrained').length >= 1, 1500);

    expect(w.events('AnimalTrained').length).toBe(1);
    expect(w.events('AnimalTrained')[0]).toMatchObject({ id: dog, kind: 'war' });
    expect(w.game.world.entities.get(dog, C.Tame)?.trained).toBe('war');
    expect(isWarTrained(w.game.world.entities, dog)).toBe(true);
  });

  it('TameCaged tames a caged wild boar at the kennel and releases it adjacent', () => {
    const w = world('tame-caged-boar');
    const kennelPos = at(w, 16, 16);
    w.build(KENNEL_WORKSHOP, kennelPos, 'oak');

    w.spawnDwarf({
      at: at(w, 15, 15),
      skills: { animal_training: 10 },
    });

    // Cage trap catches a wild boar
    const trapPos = at(w, 10, 10);
    w.build('cage_trap', trapPos, 'iron');
    const boar = w.spawnCreature('boar', trapPos, 'wild');

    w.step(1);
    w.game.world.services.movement?.teleport(boar, trapPos);
    w.step(2);

    expect(w.events('CreatureCaged').length).toBeGreaterThanOrEqual(1);
    const cageItem = w.events('CreatureCaged')[0]!['cageItemId'] as number;

    // Issue TameCaged
    expect(w.game.world.applyCommand({ type: 'TameCaged', cageId: cageItem })).toEqual({ ok: true });

    // Step until AnimalTamed
    w.until((worldLike) => worldLike.events('AnimalTamed').length >= 1, 2000);

    expect(w.events('AnimalTamed').length).toBe(1);
    expect(w.events('AnimalTamed')[0]).toMatchObject({ id: boar });

    const entities = w.game.world.entities;
    expect(entities.has(boar, C.Tame)).toBe(true);
    expect(entities.has(boar, C.Wild)).toBe(false);
    expect(entities.get(boar, C.Creature)?.faction).toBe('fortress');
    expect(entities.get(boar, C.Creature)?.cagedIn).toBe(0);

    // Boar is released near the kennel
    const pos = entities.get(boar, C.Position);
    expect(pos).toBeDefined();
    if (pos) {
      expect(Math.abs(pos.x - 16)).toBeLessThanOrEqual(2);
      expect(Math.abs(pos.y - 16)).toBeLessThanOrEqual(2);
    }
  });

  it('ReleaseCaged releases an occupant from a cage item and from a cage building', () => {
    const w = world('release-caged');

    // Case 1: cage item with occupant on ground
    const itemTile = at(w, 10, 10);
    w.build('cage_trap', itemTile, 'iron');
    const badger = w.spawnCreature('badger', itemTile, 'wild');

    w.step(1);
    w.game.world.services.movement?.teleport(badger, itemTile);
    w.step(2);

    const event = w.events('CreatureCaged')[0]!;
    const cageItem = event['cageItemId'] as number;

    expect(w.game.world.entities.get(badger, C.Creature)?.cagedIn).toBe(cageItem);

    // ReleaseCaged releases badger
    expect(w.game.world.applyCommand({ type: 'ReleaseCaged', cageId: cageItem })).toEqual({ ok: true });
    expect(w.game.world.entities.get(badger, C.Creature)?.cagedIn).toBe(0);
    expect(w.game.world.entities.has(badger, C.Position)).toBe(true);
    expect(w.game.world.entities.get(cageItem, C.Item)?.occupantId).toBe(0);

    // Releasing an empty cage item fails
    expect(w.game.world.applyCommand({ type: 'ReleaseCaged', cageId: cageItem })).toEqual({
      ok: false,
      reason: 'precondition_failed',
    });

    // Case 2: cage building with occupant
    const bldTile = at(w, 20, 20);
    const cageBld = w.build('cage_building', bldTile, 'iron');
    const fox = w.spawnCreature('fox', at(w, 25, 25), 'wild');
    w.game.world.entities.remove(fox, C.Position);
    const foxCr = w.game.world.entities.get(fox, C.Creature)!;
    w.game.world.entities.add(fox, C.Creature, { ...foxCr, cagedIn: cageBld });
    const bld = w.game.world.entities.get(cageBld, C.Building)!;
    w.game.world.entities.add(cageBld, C.Building, { ...bld, settings: { ...bld.settings, occupantId: fox } });

    expect(w.game.world.applyCommand({ type: 'ReleaseCaged', cageId: cageBld })).toEqual({ ok: true });
    expect(w.game.world.entities.get(fox, C.Creature)?.cagedIn).toBe(0);
    expect(w.game.world.entities.has(fox, C.Position)).toBe(true);
    expect(w.game.world.entities.get(cageBld, C.Building)?.settings['occupantId']).toBe(0);
  });

  it('war animals receive naturalArmor + 1 in combat resolution', () => {
    const w = world('war-armor');
    const dog = w.spawnTame('dog', at(w, 10, 10));
    const reader = w.readers.of<CombatReader>('16');

    // Untrained dog has base species natural armor (0 for dog)
    const baseArmor = reader.armorValue(dog, 'torso', 'blunt');

    // Train dog for war
    const t = w.game.world.entities.get(dog, C.Tame)!;
    w.game.world.entities.add(dog, C.Tame, { ...t, trained: 'war' });

    // War-trained dog has naturalArmor + 1
    const warArmor = reader.armorValue(dog, 'torso', 'blunt');
    expect(warArmor).toBeGreaterThan(baseArmor);
    expect(isWarTrained(w.game.world.entities, dog)).toBe(true);
  });

  it('war animal assigned to chain attacks hostiles within WAR_ANIMAL_RADIUS and respects 1-tile constraint', () => {
    const w = world('war-chain-constraint');
    const station = at(w, 15, 15);
    const chain = w.build('chain_post', station, 'iron');
    const dog = w.spawnTame('dog', station);
    const t = w.game.world.entities.get(dog, C.Tame)!;
    w.game.world.entities.add(dog, C.Tame, { ...t, trained: 'war' });

    // Assign dog to chain
    expect(w.game.world.applyCommand({ type: 'AssignAnimal', animalId: dog, chainId: chain })).toEqual({ ok: true });

    // Spawn a hostile trollkin 5 tiles away (within WAR_ANIMAL_RADIUS = 8)
    const hostile = w.spawnCreature('trollkin', at(w, 20, 15), 'hostile:gloam');

    // Run 30 ticks
    for (let i = 0; i < 30; i++) {
      w.step(1);
      const pos = w.game.world.entities.get(dog, C.Position);
      if (pos) {
        const dx = Math.abs(pos.x - 15);
        const dy = Math.abs(pos.y - 15);
        // Dog must NEVER move more than 1 tile away from the chain post!
        expect(Math.max(dx, dy)).toBeLessThanOrEqual(1);
      }
    }

    // Now teleport hostile adjacent to chain post
    w.game.world.services.movement?.teleport(hostile, at(w, 16, 15));
    w.step(5);

    // Dog should attack adjacent hostile in melee
    const attacks = w.events('AttackResolved').filter((e) => e['attackerId'] === dog);
    expect(attacks.length).toBeGreaterThanOrEqual(1);
  });

  it('hunting dog follows assigned hunter and targets hunter combat target', () => {
    const w = world('hunting-dog-follow');
    const hunter = w.spawnDwarf({
      at: at(w, 10, 10),
      skills: { animal_training: 5 },
    });
    const dog = w.spawnTame('dog', at(w, 10, 10));
    const t = w.game.world.entities.get(dog, C.Tame)!;
    w.game.world.entities.add(dog, C.Tame, { ...t, trained: 'hunting' });

    // Assign dog to hunter
    expect(w.game.world.applyCommand({ type: 'AssignAnimal', animalId: dog, dwarfId: hunter })).toEqual({ ok: true });

    // Move hunter 10 tiles away
    w.game.world.services.movement?.teleport(hunter, at(w, 20, 10));

    // Dog should follow hunter within PET_FOLLOW_RADIUS (5)
    w.until(() => {
      const pDog = w.game.world.entities.get(dog, C.Position);
      const pHunter = w.game.world.entities.get(hunter, C.Position);
      if (!pDog || !pHunter) return false;
      return Math.max(Math.abs(pDog.x - pHunter.x), Math.abs(pDog.y - pHunter.y)) <= 5;
    }, 200);

    const pDog = w.game.world.entities.get(dog, C.Position)!;
    expect(Math.abs(pDog.x - 20)).toBeLessThanOrEqual(5);

    // Spawn hostile and set hunter target
    const foe = w.spawnCreature('trollkin', at(w, 22, 10), 'hostile:gloam');
    w.game.world.services.combat?.setTarget(hunter, foe);

    // Dog thinks and targets the hunter's target
    w.step(15);
    const dogTarget = w.readers.of<CombatReader>('16').targetOf(dog);
    expect(dogTarget).toBe(foe);
  });
});

describe('F-13 door pet behavior', () => {
  it('F-13: a pet whose owner walks through a doorway and stops two tiles beyond ends on a non-door tile; a dwarf walking the other way is never blocked', () => {
    const w = world('f13-door-pets');
    const moveCtx = { tick: w.tick, emit: (e: GameEvent) => w.game.world.events.emit(e) };

    // Wall off across y = 15 except x = 16
    for (let x = 0; x < w.map.w; x++) {
      if (x !== 16) {
        w.carve(at(w, x, 15), TileKind.Wall);
      }
    }
    const doorTile = at(w, 16, 15);
    w.build('door', doorTile, 'granite');
    w.step(1);

    // Owner dwarf starts at (16, 13) (north of the door)
    const owner = w.spawnDwarf({ at: at(w, 16, 13) });
    // Pet dog assigned to owner starts at (16, 12)
    const dog = w.spawnTame('dog', at(w, 16, 12));
    w.game.world.applyCommand({ type: 'AssignAnimal', animalId: dog, dwarfId: owner });

    // Owner walks through the doorway to (16, 17) (2 tiles beyond the door at y = 15)
    w.until(() => {
      w.game.world.services.movement?.walkTo(owner, at(w, 16, 17), 'job', moveCtx);
      const pOwner = w.game.world.entities.get(owner, C.Position);
      return pOwner?.x === 16 && pOwner?.y === 17;
    }, 200);

    // Run additional steps for pet to follow and step off the door
    w.step(30);

    // Assert: dog does NOT end on the door tile
    const pDog = w.game.world.entities.get(dog, C.Position)!;
    const dogTile = at(w, pDog.x, pDog.y);
    expect(dogTile).not.toBe(doorTile);

    // Dwarf 2 starts on the south side at (16, 19) and walks north to (16, 13) through the door
    const dwarf2 = w.spawnDwarf({ at: at(w, 16, 19) });

    // Dwarf 2 should reach (16, 13) through the door without being blocked by the dog
    w.until(() => {
      w.game.world.services.movement?.walkTo(dwarf2, at(w, 16, 13), 'job', moveCtx);
      const p2 = w.game.world.entities.get(dwarf2, C.Position);
      return p2?.x === 16 && p2?.y === 13;
    }, 200);

    const p2 = w.game.world.entities.get(dwarf2, C.Position)!;
    expect(p2.x).toBe(16);
    expect(p2.y).toBe(13);
  });
});

