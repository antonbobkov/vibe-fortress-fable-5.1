/**
 * Unit tests for T-195: a soldier on duty still eats, drinks and sleeps.
 * Spec rules:
 * - A soldier in `train` with hunger at want threshold (50) walks to food and eats.
 * - A soldier in `active` mode with a hostile in sight and hunger at want threshold keeps fighting.
 * - The same soldier at critical threshold (90) breaks off to eat.
 * - After eating, the soldier is training again within a day.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { CombatReader } from '@systems/combat/reader';
import { TestWorld } from '../../scenarios/test-world';

describe('T-195: soldier needs on duty and training', () => {
  it('a soldier in train with hunger at the want threshold walks to food and eats', () => {
    const w = new TestWorld({ seed: 'soldier-needs-1', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const Z = FLAT_TEST_SURFACE_Z;
    w.zone('barracks', [w.index(20, 20, Z), w.index(21, 20, Z)]);
    w.zone('stockpile', [w.index(25, 20, Z), w.index(26, 20, Z)]);
    w.spawnItem('easy_meal', 'dimcap', w.index(25, 20, Z), 20);

    const dwarf = w.spawnDwarf({ at: w.index(20, 20, Z) });
    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Iron Guard' });
    const combat = w.game.world.readers.of<CombatReader>('16');
    const squad = combat.squads()[0]!;
    w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [dwarf] });
    w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'train' });
    w.step(5);

    expect(combat.onDuty(dwarf)).toBe(true);
    expect(w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('duty');

    // Set hunger to want threshold (50)
    w.setNeed(dwarf, 'hunger', 50);

    // Step until the soldier eats
    w.until(() => w.events('MealEaten').some((e) => e['id'] === dwarf), 300);

    expect(w.events('MealEaten').some((e) => e['id'] === dwarf)).toBe(true);
    expect(w.game.world.entities.get(dwarf, C.Needs)?.hunger).toBe(0);
  });

  it('a soldier in active mode with a hostile in sight and hunger at the want threshold keeps fighting', () => {
    const w = new TestWorld({ seed: 'soldier-needs-2', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const Z = FLAT_TEST_SURFACE_Z;
    w.zone('barracks', [w.index(20, 20, Z)]);
    w.zone('stockpile', [w.index(25, 20, Z)]);
    w.spawnItem('easy_meal', 'dimcap', w.index(25, 20, Z), 20);

    const dwarf = w.spawnDwarf({ at: w.index(20, 20, Z) });
    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Iron Guard' });
    const combat = w.game.world.readers.of<CombatReader>('16');
    const squad = combat.squads()[0]!;
    w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [dwarf] });
    w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' });

    // Spawn a hostile gloam warrior adjacent/near the dwarf
    const hostile = w.spawnCreature('gloam_warrior', w.index(21, 20, Z), 'hostile:gloam');
    w.step(5);

    expect(combat.onDuty(dwarf)).toBe(true);
    expect(combat.targetOf(dwarf)).toBe(hostile);

    // Set hunger to want threshold (50)
    w.setNeed(dwarf, 'hunger', 50);
    w.step(50);

    // The soldier must keep fighting, not break off for food
    expect(combat.targetOf(dwarf)).toBe(hostile);
    expect(w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('duty');
    expect(w.events('MealEaten').some((e) => e['id'] === dwarf)).toBe(false);
  });

  it('the same soldier at the critical threshold breaks off to eat', () => {
    const w = new TestWorld({ seed: 'soldier-needs-3', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const Z = FLAT_TEST_SURFACE_Z;
    w.zone('barracks', [w.index(20, 20, Z)]);
    w.zone('stockpile', [w.index(25, 20, Z)]);
    w.spawnItem('easy_meal', 'dimcap', w.index(25, 20, Z), 20);

    const dwarf = w.spawnDwarf({ at: w.index(20, 20, Z) });
    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Iron Guard' });
    const combat = w.game.world.readers.of<CombatReader>('16');
    const squad = combat.squads()[0]!;
    w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [dwarf] });
    w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' });

    const hostile = w.spawnCreature('gloam_warrior', w.index(21, 20, Z), 'hostile:gloam');
    w.step(5);

    expect(combat.targetOf(dwarf)).toBe(hostile);

    // Want threshold: keeps fighting
    w.setNeed(dwarf, 'hunger', 50);
    w.step(20);
    expect(combat.targetOf(dwarf)).toBe(hostile);

    // Critical threshold: breaks off to eat
    w.setNeed(dwarf, 'hunger', 90);
    w.until(() => w.events('MealEaten').some((e) => e['id'] === dwarf), 300);

    expect(w.events('MealEaten').some((e) => e['id'] === dwarf)).toBe(true);
    expect(w.game.world.entities.get(dwarf, C.Needs)?.hunger).toBe(0);
  });

  it('after eating, the soldier is training again within a day', () => {
    const w = new TestWorld({ seed: 'soldier-needs-4', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const Z = FLAT_TEST_SURFACE_Z;
    w.zone('barracks', [w.index(20, 20, Z), w.index(21, 20, Z)]);
    w.zone('stockpile', [w.index(25, 20, Z)]);
    w.spawnItem('easy_meal', 'dimcap', w.index(25, 20, Z), 20);
    w.spawnItem('training_sword', 'oak', w.index(20, 20, Z), 4);

    const dwarf1 = w.spawnDwarf({ at: w.index(20, 20, Z) });
    const dwarf2 = w.spawnDwarf({ at: w.index(21, 20, Z) });
    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Iron Guard' });
    const combat = w.game.world.readers.of<CombatReader>('16');
    const squad = combat.squads()[0]!;
    w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [dwarf1, dwarf2] });
    w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'train' });

    // Step to begin training
    w.until(() => w.events('TrainingSession').length > 0, 100);
    expect(w.events('TrainingSession').length).toBeGreaterThan(0);

    // Set hunger on dwarf1 to want threshold
    w.setNeed(dwarf1, 'hunger', 50);

    // Dwarf1 goes and eats
    w.until(() => w.events('MealEaten').some((e) => e['id'] === dwarf1), 300);
    expect(w.events('MealEaten').some((e) => e['id'] === dwarf1)).toBe(true);

    // After eating, within a day, training sessions resume
    const sessionsBefore = w.events('TrainingSession').length;
    w.until(() => w.events('TrainingSession').length > sessionsBefore, TICKS_PER_DAY);

    expect(w.events('TrainingSession').length).toBeGreaterThan(sessionsBefore);
    expect(w.game.world.entities.get(dwarf1, C.Brain)?.behavior).toBe('duty');
  });
});
