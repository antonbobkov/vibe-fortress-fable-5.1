/** T-211: admission interrupts military duty; discharge restores normal selection. */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { CombatReader } from '@systems/combat';
import { TestWorld } from '../../scenarios/test-world';

function woundedSoldier(mode: 'train' | 'active' | 'off', alert: 'calm' | 'watchful', badgerDies = true) {
  const w = new TestWorld({ seed: 't211-patient-duty', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const station = w.index(20, 20, Z), bedTile = w.index(27, 20, Z), chestTile = w.index(27, 21, Z);
  const bed = w.build('bed', bedTile, 'oak'); w.build('chest', chestTile, 'oak');
  w.zone('hospital', [bedTile, chestTile]); w.zone('barracks', [station]);
  const id = w.spawnDwarf({ at: station });
  for (const need of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(id, need, 0);
  const world = w.game.world;
  expect(world.applyCommand({ type: 'CreateSquad', name: 'Guard', leaderId: id }).ok).toBe(true);
  const combat = w.readers.of<CombatReader>('16'), squadId = combat.squads()[0]!.id;
  expect(world.applyCommand({ type: 'SetSquadMode', squadId, mode }).ok).toBe(true);
  expect(world.applyCommand({ type: 'SetSquadStation', squadId, tile: station }).ok).toBe(true);
  expect(world.applyCommand({ type: 'SetAlert', level: alert }).ok).toBe(true);
  w.step(5);
  expect(combat.onDuty(id)).toBe(true); expect(world.entities.get(id, C.Brain)?.behavior).toBe('duty');
  // Stage the audit's post-fight boundary through the real damage and death event paths.
  const badger = w.spawnCreature('badger', w.index(20, 21, Z), 'wild');
  expect(world.applyCommand({ type: 'SquadOrder', squadId, order: { kind: 'kill', targetId: badger } }).ok).toBe(true);
  world.emit({ type: 'DamageDealt', defenderId: id, attackerId: badger, part: 'torso', damageType: 'edge', amount: 15 });
  const kill = (): void => world.emit({ type: 'DamageDealt', defenderId: badger, attackerId: id, part: 'torso', damageType: 'edge',
    amount: world.entities.get(badger, C.Body)!.parts[1]!.maxHp * 2 });
  if (!badgerDies) {
    w.step(3);
    return { w, world, id, combat, station, bedTile, badger, kill };
  }
  kill();
  w.step(3);
  expect(world.entities.alive(badger)).toBe(false);
  expect(world.entities.has(id, C.Patient)).toBe(true); expect(combat.targetOf(id)).toBe(0);
  expect(world.entities.get(id, C.Patient)?.bedId).toBe(bed);
  return { w, world, id, combat, station, bedTile, badger, kill };
}

describe('T-211 an admitted soldier leaves duty for its hospital bed', () => {
  it.each([['train', 'calm'], ['active', 'calm'], ['off', 'watchful']] as const)(
    '%s / %s takes patient behavior within three ticks and returns to duty on discharge', (mode, alert) => {
      const a = woundedSoldier(mode, alert);
      expect(a.world.entities.get(a.id, C.Brain)?.behavior).toBe('patient');
      expect(a.world.entities.get(a.id, C.Brain)?.targetTile).toBe(a.bedTile);
      a.w.until(() => { const p = a.world.entities.get(a.id, C.Position)!; return a.w.index(p.x, p.y, p.z) === a.bedTile; }, 200);
      expect(a.world.entities.get(a.id, C.Brain)?.behavior).toBe('patient');
      expect(a.combat.onDuty(a.id)).toBe(true);
      // The medic has finished bandaging; the health tick decides discharge, not the test.
      const cut = a.world.entities.get(a.id, C.Body)!.parts[1]!.wounds[0]!;
      cut.bandaged = true; cut.bleed = 0;
      a.w.until(() => !a.world.entities.has(a.id, C.Patient), 5); a.w.step(2);
      expect(a.w.events('PatientDischarged')).toContainEqual(expect.objectContaining({ id: a.id }));
      expect(a.world.entities.get(a.id, C.Brain)?.behavior).toBe('duty');
      a.w.until(() => { const p = a.world.entities.get(a.id, C.Position)!; return a.w.index(p.x, p.y, p.z) === a.station; }, 200);
    });

  it('fights on while the badger is in sight, and goes to its bed when the badger is dead', () => {
    const a = woundedSoldier('active', 'calm', false);
    expect(a.world.entities.alive(a.badger)).toBe(true);
    expect(a.world.entities.has(a.id, C.Patient)).toBe(true);
    // Admitted, with its kill target beside it: the soldier does not turn its back on the fight.
    expect(a.world.entities.get(a.id, C.Brain)?.behavior).toBe('duty');
    expect(a.combat.targetOf(a.id)).toBe(a.badger);
    a.kill();
    a.w.step(3);
    expect(a.world.entities.alive(a.badger)).toBe(false);
    expect(a.world.entities.get(a.id, C.Brain)?.behavior).toBe('patient');
    expect(a.world.entities.get(a.id, C.Brain)?.targetTile).toBe(a.bedTile);
  });

  it('saves the hospital walk and preserves its next 50 continuation hashes', () => {
    const a = woundedSoldier('active', 'calm');
    expect(a.world.entities.get(a.id, C.Brain)?.behavior).toBe('patient');
    const loaded = roundTrip(a.w.game).game; expect(loaded.hash()).toBe(a.w.hash());
    for (let tick = 0; tick < 50; tick += 1) { a.w.step(1); loaded.step(1); expect(loaded.hash()).toBe(a.w.hash()); }
  });
});
