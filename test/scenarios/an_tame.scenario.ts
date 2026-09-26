import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Scenario } from './runner';

const Z = FLAT_TEST_SURFACE_Z;

const scenario: Scenario = {
  id: 'an_tame',
  milestone: 6,
  seed: 'an-tame',
  world: 'flat-test',
  embark: 'none',
  setup: (w) => {
    // Build a kennel workshop at (40, 40)
    w.build('kennel', w.index(40, 40, Z), 'oak');

    // Spawn a trainer dwarf with skill 10 animal_training near the kennel
    w.spawnDwarf({
      at: w.index(39, 39, Z),
      skills: { animal_training: 10 },
    });

    // Set up a cage trap to catch a wild boar
    const trapTile = w.index(35, 40, Z);
    w.build('cage_trap', trapTile, 'iron');
    const boar = w.spawnCreature('boar', trapTile, 'wild');

    // Arm and spring the cage trap
    w.step(1);
    w.game.world.services.movement?.teleport(boar, trapTile);
    w.step(2);

    expect(w.events('CreatureCaged').length).toBeGreaterThanOrEqual(1);
    const cageEvent = w.events('CreatureCaged')[0];
    const cageItemId = cageEvent?.['cageItemId'] as number;

    // Issue TameCaged command
    const res = w.game.world.applyCommand({ type: 'TameCaged', cageId: cageItemId });
    expect(res).toEqual({ ok: true });
  },
  run: (w) => {
    // Wait until AnimalTamed event fires (within 5 attempts; each attempt is ~400 ticks with skill time bonus)
    w.until((world) => world.events('AnimalTamed').length >= 1, 4000);

    expect(w.events('AnimalTamed').length).toBeGreaterThanOrEqual(1);
    const tamedEvent = w.events('AnimalTamed')[0];
    const boarId = tamedEvent?.['id'] as number;
    expect(boarId).toBeDefined();

    // Verify boar is tame, no longer wild, no longer caged, and belongs to fortress
    const entities = w.game.world.entities;
    expect(entities.has(boarId, C.Tame)).toBe(true);
    expect(entities.has(boarId, C.Wild)).toBe(false);
    const creature = entities.get(boarId, C.Creature);
    expect(creature?.cagedIn).toBe(0);
    expect(creature?.faction).toBe('fortress');
  },
};

export default scenario;
