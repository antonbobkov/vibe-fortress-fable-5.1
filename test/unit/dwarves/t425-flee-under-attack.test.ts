/**
 * T-425: a dwarf under attack flees even with a critical need (10 § Behavior selection, step 1),
 * and a patient does not rest within the reach of a hostile that attacks it (step 3). Before, a
 * wounded, critically thirsty dwarf alternated between fleeing and resting beside the boar.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat/reader';
import { THREAT_RADIUS } from '@systems/dwarves/constants';
import { TestWorld } from '../../scenarios/test-world';

/** A boar defending its ground at (19, 21), attacking a dwarf at (20, 21) whose thirst is critical. */
function attacked(seed: string, wounded: boolean): { w: TestWorld; dwarf: EntityId; boar: EntityId } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const bedTile = w.index(20, 20, Z);
  w.build('bed', bedTile, 'oak');
  w.build('chest', w.index(21, 20, Z), 'oak');
  w.zone('hospital', [bedTile, w.index(21, 20, Z)]);
  const dwarf = w.spawnDwarf({ at: w.index(20, 21, Z) });
  for (const need of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(dwarf, need, 0);
  // Critically thirsty, and nothing to drink: the need finds no target.
  w.setNeed(dwarf, 'thirst', 90);
  const boar = w.spawnCreature('boar', w.index(19, 21, Z), 'wild');
  const e = w.game.world.entities;
  if (wounded) w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, attackerId: boar, part: 'left_leg', damageType: 'pierce', amount: 11, weaponId: 0 });
  e.add(boar, C.Wild, { ...e.get(boar, C.Wild)!, state: 'attack', hungry: false, defendFrom: w.index(19, 21, Z), lastThinkTick: -100 });
  w.game.world.services.combat?.setTarget(boar, dwarf);
  return { w, dwarf, boar };
}

/** Ticks after the first flight on which the boar attacks the dwarf within THREAT_RADIUS and the dwarf is not fleeing. */
function standsUnderAttack(w: TestWorld, dwarf: EntityId, boar: EntityId, ticks: number): { fled: number; stood: number; rested: number } {
  const e = w.game.world.entities;
  const combat = w.readers.of<CombatReader>('16');
  let fled = 0; let stood = 0; let rested = 0;
  for (let t = 0; t < ticks && e.alive(dwarf) && e.alive(boar); t += 1) {
    w.step(1);
    const b = e.get(dwarf, C.Brain);
    const p = e.get(dwarf, C.Position); const q = e.get(boar, C.Position);
    if (!b || !p || !q) continue;
    if (b.behavior === 'flee') fled += 1;
    const near = p.z === q.z && Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) <= THREAT_RADIUS;
    const attacking = e.get(boar, C.Wild)?.state === 'attack' && combat.targetOf(boar) === dwarf;
    if (fled > 0 && near && attacking && b.behavior !== 'flee') stood += 1;
    if (near && attacking && b.behavior === 'patient') rested += 1;
  }
  return { fled, stood, rested };
}

describe('T-425 a dwarf under attack flees even with a critical need', () => {
  it('a wounded patient never rests beside the boar that attacks it', () => {
    const { w, dwarf, boar } = attacked('t425-patient', true);
    const r = standsUnderAttack(w, dwarf, boar, 300);
    expect(r.fled, 'the dwarf fled').toBeGreaterThan(0);
    expect(r.rested, 'ticks resting as a patient within reach of the boar attacking it').toBe(0);
    expect(r.stood, 'ticks not fleeing while the boar attacks it within THREAT_RADIUS').toBe(0);
  });

  it('a critically thirsty civilian keeps fleeing while the boar attacks it', () => {
    const { w, dwarf, boar } = attacked('t425-civilian', false);
    const r = standsUnderAttack(w, dwarf, boar, 300);
    expect(r.fled, 'the dwarf fled').toBeGreaterThan(0);
    expect(r.stood, 'ticks not fleeing while the boar attacks it within THREAT_RADIUS').toBe(0);
  });
});
