import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { AnnouncementLog } from '@ui/announcements';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

describe('T-515 a lost limb is announced by name, even when the creature dies that tick', () => {
  function cutAndKill(w: TestWorld, id: number): void {
    // An arm (maxHp 36) is cut off and the torso is destroyed in the same tick.
    w.game.world.emit({ type: 'DamageDealt', defenderId: id, part: 'left_arm', damageType: 'edge', amount: 60, attackerId: 0 });
    w.game.world.emit({ type: 'DamageDealt', defenderId: id, part: 'torso', damageType: 'edge', amount: 999, attackerId: 0 });
    w.step(5);
  }

  it('a dwarf that loses an arm and dies in one tick is logged by its name', () => {
    const w = new TestWorld({ seed: 't515-dwarf', world: 'flat-test', embark: 'none' });
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const id = w.spawnDwarf({ at: w.index(40, 40, FLAT_TEST_SURFACE_Z) });
    const name = w.game.world.entities.get(id, C.Creature)?.name ?? '';
    expect(name.length).toBeGreaterThan(0);

    cutAndKill(w, id);
    expect(w.events('CreatureDied').some((e) => e['id'] === id)).toBe(true);
    expect(w.game.world.entities.alive(id)).toBe(false);
    const lost = w.events('LimbLost').find((e) => e['id'] === id);
    expect(lost).toBeDefined();

    const line = log.announce(lost!, w.readers, w.tick);
    expect(line?.line.text).toBe(`${name} has lost a limb.`);
    expect(line?.line.text).not.toContain('{');
  });

  it('an animal that loses a limb and dies in one tick is named by its species', () => {
    const w = new TestWorld({ seed: 't515-cat', world: 'flat-test', embark: 'none' });
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const id = w.spawnCreature('cat', w.index(40, 40, FLAT_TEST_SURFACE_Z), 'wild');

    cutAndKill(w, id);
    expect(w.game.world.entities.alive(id)).toBe(false);
    const lost = w.events('LimbLost').find((e) => e['id'] === id);
    expect(lost).toBeDefined();

    const line = log.announce(lost!, w.readers, w.tick);
    expect(line?.line.text).toBe('A cat has lost a limb.');
  });
});
