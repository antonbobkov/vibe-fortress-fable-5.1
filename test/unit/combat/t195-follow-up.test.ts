import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { TICKS_PER_DAY } from '@core/constants';
import { TestWorld } from '../../scenarios/test-world';
import type { CombatReader } from '@systems/combat/reader';

function soldier(mode: 'train' | 'active' | 'off', alert: 'calm' | 'watchful', station: boolean) {
  const w = new TestWorld({ seed: 't195-follow-up', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const at = w.index(20, 20, FLAT_TEST_SURFACE_Z);
  const bed = w.index(27, 20, FLAT_TEST_SURFACE_Z);
  w.build('bed', bed, 'oak');
  w.zone('barracks', [at]);
  w.zone('stockpile', [w.index(25, 20, FLAT_TEST_SURFACE_Z)]);
  w.spawnItem('easy_meal', 'dimcap', w.index(25, 20, FLAT_TEST_SURFACE_Z), 20);
  const id = w.spawnDwarf({ at });
  const world = w.game.world;
  expect(world.applyCommand({ type: 'CreateSquad', name: 'Guard', leaderId: id }).ok).toBe(true);
  const combat = w.readers.of<CombatReader>('16');
  const squadId = combat.squads()[0]!.id;
  expect(world.applyCommand({ type: 'SetSquadMode', squadId, mode }).ok).toBe(true);
  if (station) expect(world.applyCommand({ type: 'SetSquadStation', squadId, tile: at }).ok).toBe(true);
  expect(world.applyCommand({ type: 'SetAlert', level: alert }).ok).toBe(true);
  w.step(5);
  expect(combat.onDuty(id)).toBe(true);
  return { w, id, combat, bed, at, squadId };
}

describe('T-134 needs interrupt squad movement in every mode (T-195 follow-up)', () => {
  it.each([
    ['train', 'calm'], ['active', 'calm'], ['off', 'watchful'],
  ] as const)('a critically tired %s soldier under %s reaches a bed and sleeps', (mode, alert) => {
    const { w, id, combat, bed, at } = soldier(mode, alert, true);
    w.setNeed(id, 'rest', 90);
    w.until(() => w.events('Slept').some((e) => e['id'] === id), TICKS_PER_DAY);
    expect(w.events('Slept').filter((e) => e['id'] === id)).toHaveLength(1);
    expect(w.events('Slept').find((e) => e['id'] === id)?.['onFloor']).toBe(false);
    expect(w.map.index(w.game.world.entities.get(id, C.Position)!.x,
      w.game.world.entities.get(id, C.Position)!.y, w.game.world.entities.get(id, C.Position)!.z)).toBe(bed);
    expect(w.game.world.entities.get(id, C.Needs)?.rest).toBe(0);
    expect(combat.targetOf(id)).toBe(0);
    // Military control resumes after completing the need, rather than during the bed walk.
    w.until(() => {
      const p = w.game.world.entities.get(id, C.Position)!;
      return w.map.index(p.x, p.y, p.z) === at;
    }, 200);
    expect(w.game.world.entities.get(id, C.Brain)?.behavior).toBe('duty');
  });

  it.each([
    ['active', 'calm', true], ['active', 'watchful', false], ['train', 'calm', true],
  ] as const)('%s / %s / station=%s lets a want eat without a visible hostile', (mode, alert, station) => {
    const { w, id } = soldier(mode, alert, station);
    w.setNeed(id, 'hunger', 50);
    w.until(() => w.events('MealEaten').some((e) => e['id'] === id), 300);
    expect(w.events('MealEaten').some((e) => e['id'] === id)).toBe(true);
  });

  it.each(['off', 'train', 'active'] as const)('an explicit order during watchful alert holds a %s want, but never a critical need', (mode) => {
    const { w, id } = soldier(mode, 'watchful', true);
    w.setNeed(id, 'hunger', 50);
    w.step(100);
    expect(w.game.world.entities.get(id, C.Brain)?.behavior).toBe('duty');
    expect(w.events('MealEaten').some((e) => e['id'] === id)).toBe(false);
    w.setNeed(id, 'hunger', 90);
    w.until(() => w.events('MealEaten').some((e) => e['id'] === id), 300);
    expect(w.events('MealEaten').some((e) => e['id'] === id)).toBe(true);
  });

  it('a held target behind a wall is not a hostile in sight that holds a want', () => {
    const { w, id, combat } = soldier('active', 'calm', false);
    const hostile = w.spawnCreature('gloam_warrior', w.index(30, 20, FLAT_TEST_SURFACE_Z), 'hostile:gloam');
    w.step(1);
    expect(combat.targetOf(id)).toBe(hostile);
    // Seal a ring round the hostile: the combat target remains held until its normal timeout.
    for (let x = 29; x <= 31; x++) for (let y = 19; y <= 21; y++) {
      if (x !== 30 || y !== 20) w.carve(w.index(x, y, FLAT_TEST_SURFACE_Z), TileKind.Wall);
    }
    expect(combat.lineOfSight(w.index(20, 20, FLAT_TEST_SURFACE_Z), w.index(30, 20, FLAT_TEST_SURFACE_Z))).toBe(false);
    w.setNeed(id, 'hunger', 50);
    w.step(1);
    expect(w.game.world.entities.get(id, C.Brain)?.behavior).toBe('need');
    expect(combat.targetOf(id)).toBe(0);
    w.until(() => w.events('MealEaten').some((e) => e['id'] === id), 300);
    expect(w.events('MealEaten').some((e) => e['id'] === id)).toBe(true);
  });
});

describe('T-134 squad orders and sight under an alert', () => {
  it.each(['train', 'off'] as const)('under a watchful alert a %s squad is treated as active: a hostile in sight holds a want', (mode) => {
    const { w, id, combat } = soldier(mode, 'watchful', false);
    const hostile = w.spawnCreature('gloam_warrior', w.index(30, 20, FLAT_TEST_SURFACE_Z), 'hostile:gloam');
    w.step(1);
    expect(combat.targetOf(id)).toBe(hostile);
    w.setNeed(id, 'hunger', 50);
    w.step(1);
    expect(w.game.world.entities.get(id, C.Brain)?.behavior).toBe('duty');
    expect(combat.targetOf(id)).toBe(hostile);
  });

  it('a calm kill order does not walk a soldier away from a want it serves', () => {
    const { w, id, combat, squadId } = soldier('active', 'calm', false);
    // A peaceful animal out of perception: the kill order walks the soldier toward it.
    const prey = w.spawnCreature('rabbit', w.index(70, 20, FLAT_TEST_SURFACE_Z), 'wild');
    expect(w.game.world.applyCommand({ type: 'SquadOrder', squadId, order: { kind: 'kill', targetId: prey } }).ok).toBe(true);
    w.step(5);
    w.setNeed(id, 'hunger', 50);
    w.step(1);
    expect(w.game.world.entities.get(id, C.Brain)?.behavior).toBe('need');
    w.until(() => w.events('MealEaten').some((e) => e['id'] === id), 300);
    expect(combat.targetOf(id)).toBe(0);
  });

  it('a kill order issued while a soldier walks to bed does not take it from its sleep', () => {
    const { w, id, combat, squadId, bed } = soldier('active', 'watchful', false);
    w.setNeed(id, 'rest', 90);
    w.step(1);
    expect(w.game.world.entities.get(id, C.Brain)?.activity).toBe('sleep');
    const prey = w.spawnCreature('rabbit', w.index(20, 28, FLAT_TEST_SURFACE_Z), 'wild');
    expect(w.game.world.applyCommand({ type: 'SquadOrder', squadId, order: { kind: 'kill', targetId: prey } }).ok).toBe(true);
    expect(combat.targetOf(id)).toBe(0);
    w.until(() => w.events('Slept').some((e) => e['id'] === id), TICKS_PER_DAY);
    expect(w.events('Slept').find((e) => e['id'] === id)?.['onFloor']).toBe(false);
    const p = w.game.world.entities.get(id, C.Position)!;
    expect(w.map.index(p.x, p.y, p.z)).toBe(bed);
  });
});
