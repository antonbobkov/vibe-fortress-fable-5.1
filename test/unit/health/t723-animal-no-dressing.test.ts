/**
 * T-723: in the second playtest of 2026-11-24 five dogs, two of them the Warband's war dogs, bled out
 * in a fortress with no cloth and the log said only that each had died. A fortress animal that
 * `bandage_animal` would treat now raises T-716's `NoDressing` alert too, once a wound, as one line a
 * day for all of them (17 § Player-facing behavior).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import { BODY_SLOTS } from '@core/types';
import { AnnouncementLog } from '@ui/announcements';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

/** An animal keeper and nothing to bandage with, unless `cloth` cloth lies on the floor. */
function kennel(seed: string, cloth: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const keeper = w.spawnDwarf({ at: w.index(14, 10, Z), skills: { animal_care: 20 } });
  w.setLabor(keeper, 'medicine', false);
  if (cloth > 0) w.spawnItem('cloth', 'flax_cloth', w.index(14, 12, Z), cloth);
  const wounds = (id: EntityId) => world.entities.get(id, C.Body)!.parts.flatMap((p) => p.wounds);
  /** A serious cut to the torso: 30% of its hit points, edge. */
  const cut = (id: EntityId): void => {
    const torso = world.entities.get(id, C.Body)!.parts[BODY_SLOTS.indexOf('torso')]!;
    world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'edge', amount: Math.ceil(torso.maxHp * 0.3) });
  };
  const alerts = (id: EntityId): number => w.events('NoDressing').filter((e) => e['id'] === id).length;
  const name = (id: EntityId, text: string): void => {
    world.entities.add(id, C.Creature, { ...world.entities.get(id, C.Creature)!, name: text });
  };
  return { w, world, wounds, cut, alerts, name };
}

describe('T-723 a fortress animal bleeding with no bandage or cloth is an alert', () => {
  it('a war dog\'s serious cut with no dressing raises the alert once, at the cut', () => {
    const k = kennel('t723-dog', 0);
    const dog = k.w.spawnTame('dog', k.w.index(10, 10, Z), { trained: 'war' });
    k.w.step(2);
    k.cut(dog);
    k.w.step(2);
    expect(k.wounds(dog).some((x) => x.type === 'cut' && x.severity !== 'light' && x.bleed > 0 && !x.bandaged)).toBe(true);
    expect(k.alerts(dog)).toBe(1);
    expect(k.world.entities.get(dog, C.Tame)?.noDressingAlerted).toBeDefined();
    k.w.step(TICKS_PER_DAY / 12);
    expect(k.alerts(dog)).toBe(1);

    const log = new AnnouncementLog(new Strings(k.w.game.registry), k.w.game.registry);
    log.register(k.world.registrations.announcements);
    const shown = log.announce(k.w.events('NoDressing')[0]!, k.w.readers, k.w.tick);
    expect(shown?.severity).toBe('alert');
    expect(shown?.line.text).toBe('The war dog is bleeding and there is no bandage or cloth: buy them from a caravan, or weave cloth at a loom.');
    expect(shown?.line.subject).toBe(dog);
  });

  it('a wild animal raises nothing, nor does a light cut, which clots', () => {
    const k = kennel('t723-wild', 0);
    const wolf = k.w.spawnCreature('wolf', k.w.index(10, 10, Z), 'wild');
    const dog = k.w.spawnTame('dog', k.w.index(10, 14, Z));
    k.w.step(2);
    k.cut(wolf);
    k.world.emit({ type: 'DamageDealt', defenderId: dog, attackerId: 0, part: 'torso', damageType: 'edge', amount: 1 });
    k.w.step(20);
    expect(k.wounds(wolf).some((x) => x.severity !== 'light' && x.bleed > 0)).toBe(true);
    expect(k.wounds(dog).every((x) => x.severity === 'light')).toBe(true);
    expect(k.w.events('NoDressing')).toHaveLength(0);
  });

  it('with cloth in stock nothing is raised, and the keeper bandages the dog', () => {
    const k = kennel('t723-cloth', 2);
    const dog = k.w.spawnTame('dog', k.w.index(10, 10, Z), { trained: 'war' });
    k.w.step(2);
    k.cut(dog);
    k.w.until(() => k.wounds(dog).some((x) => x.bandaged), TICKS_PER_DAY / 2);
    expect(k.wounds(dog).some((x) => x.bandaged)).toBe(true);
    expect(k.w.events('NoDressing')).toHaveLength(0);
  });

  it('the day\'s bleeding animals are one line: the first is the alert, the later ones change it in place', () => {
    const k = kennel('t723-merge', 0);
    const bramble = k.w.spawnTame('dog', k.w.index(10, 10, Z));
    k.name(bramble, 'Bramble');
    const war = k.w.spawnTame('dog', k.w.index(10, 12, Z), { trained: 'war' });
    const goats = [0, 1, 2].map((i) => k.w.spawnTame('goat', k.w.index(8, 10 + i * 2, Z)));
    const log = new AnnouncementLog(new Strings(k.w.game.registry), k.w.game.registry);
    log.register(k.world.registrations.announcements);
    k.w.step(2);
    for (const id of [bramble, war]) k.cut(id);
    k.w.step(2);
    const events = k.w.events('NoDressing');
    expect(events.map((e) => e['id'])).toEqual([bramble, war]);
    const first = log.announce(events[0]!, k.w.readers, k.w.tick);
    expect(first?.line.text).toBe('Bramble is bleeding and there is no bandage or cloth: buy them from a caravan, or weave cloth at a loom.');
    expect(log.announce(events[1]!, k.w.readers, k.w.tick)).toBeNull();
    expect(first?.line.text).toBe('Bramble and the war dog are bleeding and there is no bandage or cloth: buy them from a caravan, or weave cloth at a loom.');
    expect(first?.line.subject).toBe(war);
    for (const id of goats) k.cut(id);
    k.w.step(2);
    for (const e of k.w.events('NoDressing').slice(2)) expect(log.announce(e, k.w.readers, k.w.tick)).toBeNull();
    expect(first?.line.text).toBe('5 animals are bleeding and there is no bandage or cloth: buy them from a caravan, or weave cloth at a loom.');
    expect(log.lines.filter((l) => l.text.includes('no bandage or cloth'))).toHaveLength(1);
  });

  it('a save keeps the alert\'s tick; an animal of an older save, without it, is warned at its next update', () => {
    const k = kennel('t723-save', 0);
    const dog = k.w.spawnTame('dog', k.w.index(10, 10, Z), { trained: 'war' });
    k.w.step(2);
    k.cut(dog);
    k.w.step(3);
    const at = k.world.entities.get(dog, C.Tame)?.noDressingAlerted;
    expect(at).toBeDefined();
    const loaded = roundTrip(k.w.game).game;
    expect(loaded.world.entities.get(dog, C.Tame)?.noDressingAlerted).toBe(at);
    k.w.replaceGame(loaded);
    k.w.step(5);
    expect(k.alerts(dog)).toBe(1);
    const older = roundTrip(k.w.game).game;
    const { noDressingAlerted: _dropped, ...tame } = older.world.entities.get(dog, C.Tame)!;
    older.world.entities.add(dog, C.Tame, tame);
    k.w.replaceGame(older);
    k.w.step(5);
    expect(k.alerts(dog)).toBe(2);
  });
});
