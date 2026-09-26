/**
 * Unit tests for System 17 Health:
 * - severity thresholds
 * - wound table values
 * - unconscious/death thresholds with Toughness and Willpower
 * - badly_healed on unsplinted fracture
 * - speed and productivity modifiers
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import {
  BLEED_TABLE,
  PAIN_TABLE,
  PRODUCTIVITY_FLOOR,
  SEVERITY_MULTIPLIER,
  createWound,
  severityFor,
  woundTypeFor,
  type HealthReader,
} from '@systems/health';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M6-01 health unit tests', () => {
  describe('severity thresholds', () => {
    it('ratio < LIGHT_MAX is light, < SERIOUS_MAX is serious, else grievous', () => {
      const maxHp = 60;
      expect(severityFor(11, maxHp)).toBe('light'); // 11/60 = 0.183 < 0.2
      expect(severityFor(12, maxHp)).toBe('serious'); // 12/60 = 0.2
      expect(severityFor(29, maxHp)).toBe('serious'); // 29/60 = 0.483 < 0.5
      expect(severityFor(30, maxHp)).toBe('grievous'); // 30/60 = 0.5
      expect(severityFor(60, maxHp)).toBe('grievous');
    });

    it('damage type mapping', () => {
      const maxHp = 60;
      expect(woundTypeFor('edge', 10, maxHp)).toBe('cut');
      expect(woundTypeFor('pierce', 10, maxHp)).toBe('puncture');
      // Blunt below 30% is bruise, 30% or above is fracture
      expect(woundTypeFor('blunt', 17, maxHp)).toBe('bruise'); // 17 < 18
      expect(woundTypeFor('blunt', 18, maxHp)).toBe('fracture'); // 18 >= 18
      expect(woundTypeFor('burn', 10, maxHp)).toBe('burn');
      expect(woundTypeFor('frost', 10, maxHp)).toBe('frost');
      expect(woundTypeFor('wasting', 10, maxHp)).toBe('wasting');
    });
  });

  describe('wound table values', () => {
    it('bleed and pain match documented tables', () => {
      // Cut
      expect(BLEED_TABLE.cut).toEqual({ light: 1, serious: 3, grievous: 6 });
      expect(PAIN_TABLE.cut).toEqual({ light: 5, serious: 15, grievous: 30 });
      // Puncture
      expect(BLEED_TABLE.puncture).toEqual({ light: 2, serious: 4, grievous: 8 });
      expect(PAIN_TABLE.puncture).toEqual({ light: 4, serious: 12, grievous: 25 });
      // Bruise
      expect(BLEED_TABLE.bruise).toEqual({ light: 0, serious: 0, grievous: 0 });
      expect(PAIN_TABLE.bruise).toEqual({ light: 4, serious: 10, grievous: 20 });
      // Fracture
      expect(BLEED_TABLE.fracture).toEqual({ light: 0, serious: 1, grievous: 2 });
      expect(PAIN_TABLE.fracture).toEqual({ light: 15, serious: 30, grievous: 45 });
      // Burn
      expect(BLEED_TABLE.burn).toEqual({ light: 0, serious: 1, grievous: 3 });
      expect(PAIN_TABLE.burn).toEqual({ light: 8, serious: 20, grievous: 40 });
      // Frost
      expect(BLEED_TABLE.frost).toEqual({ light: 0, serious: 0, grievous: 1 });
      expect(PAIN_TABLE.frost).toEqual({ light: 5, serious: 12, grievous: 25 });
      // Wasting
      expect(BLEED_TABLE.wasting).toEqual({ light: 0, serious: 0, grievous: 0 });
      expect(PAIN_TABLE.wasting).toEqual({ light: 5, serious: 10, grievous: 15 });
    });

    it('severity multipliers for healing', () => {
      expect(SEVERITY_MULTIPLIER).toEqual({ light: 1, serious: 3, grievous: 6 });
    });
  });

  describe('consciousness and death thresholds with Toughness and Willpower', () => {
    it('Toughness scales maxBlood: size * 10 * (50 + tou) / 100', () => {
      const w = new TestWorld({ seed: 'health-tou', world: 'flat-test', embark: 'none' });
      const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
      const b = w.game.world.entities.get(id, C.Body);
      const attrs = w.game.world.entities.get(id, C.Attributes);
      expect(b).toBeDefined();
      expect(attrs).toBeDefined();
      if (b && attrs) {
        const expectedMaxBlood = Math.floor((60 * 10 * (50 + attrs.tou)) / 100);
        expect(b.maxBlood).toBe(expectedMaxBlood);
        expect(b.blood).toBe(expectedMaxBlood);
      }
    });

    it('Willpower scales pain: rawPain * (100 - wil / 2) / 100', () => {
      const w = new TestWorld({ seed: 'health-wil', world: 'flat-test', embark: 'none' });
      const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
      const attrs = w.game.world.entities.get(id, C.Attributes);
      if (attrs) w.game.world.entities.add(id, C.Attributes, { ...attrs, wil: 40 });
      // Deal 15 damage cut (serious cut, pain 15)
      w.game.world.emit({
        type: 'DamageDealt',
        defenderId: id,
        part: 'torso',
        damageType: 'edge',
        amount: 15,
        attackerId: 0,
      });
      w.step(5); // Health tick
      const b = w.game.world.entities.get(id, C.Body);
      // wil = 40 -> factor = (100 - 20) / 100 = 0.8. 15 * 0.8 = 12
      expect(b?.pain).toBe(12);
    });
  });

  describe('badly_healed permanent injury on unsplinted fracture', () => {
    it('an unsplinted fracture that completes healing leaves badly_healed permanent', () => {
      const w = new TestWorld({ seed: 'health-badly-healed', world: 'flat-test', embark: 'none' });
      const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
      const b = w.game.world.entities.get(id, C.Body);
      expect(b).toBeDefined();
      if (!b) return;

      // Add a fracture with very low healRemaining to left_leg (slot 4)
      const testFracture = createWound('fracture', 'light', 10, w.tick);
      testFracture.healRemaining = 10;
      testFracture.splinted = false;
      b.parts[4]?.wounds.push(testFracture);
      b.parts[4]!.hp -= 10;

      // Register dwarf in wounded set of health system
      w.game.world.emit({
        type: 'DamageDealt',
        defenderId: id,
        part: 'left_leg',
        damageType: 'blunt',
        amount: 1,
        attackerId: 0,
      });

      // Step until healed (untreated fracture heals at 25% speed: 5 * 0.25 = 1.25 per health tick)
      // Needs ~8 health ticks = 40 ticks
      w.step(50);

      const health = w.readers.of<HealthReader>('17');
      expect(health.permanent(id)).toContain('badly_healed_left_leg');
      // Speed is reduced by 15% (multiplier 85%)
      expect(health.speedModifier(id)).toBe(85);
    });
  });

  describe('speed and productivity modifiers', () => {
    it('speedModifier reflects lost legs and crutch', () => {
      const w = new TestWorld({ seed: 'health-speed', world: 'flat-test', embark: 'none' });
      const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
      const b = w.game.world.entities.get(id, C.Body);
      const health = w.readers.of<HealthReader>('17');

      expect(health.speedModifier(id)).toBe(100);

      // One lost leg: 50%
      b?.permanent.push('lost_left_leg');
      expect(health.speedModifier(id)).toBe(50);

      // Both lost legs: 0% (bedridden)
      b?.permanent.push('lost_right_leg');
      expect(health.speedModifier(id)).toBe(0);
      expect(health.canWork(id)).toBe(false);
    });

    it('productivityModifier reflects pain, blood loss, and arm penalties', () => {
      const w = new TestWorld({ seed: 'health-prod', world: 'flat-test', embark: 'none' });
      const id = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
      const b = w.game.world.entities.get(id, C.Body);
      const health = w.readers.of<HealthReader>('17');

      expect(health.productivityModifier(id)).toBe(100);

      if (b) {
        // Pain 20 -> -10% productivity
        b.pain = 20;
        expect(health.productivityModifier(id)).toBe(90);

        // Blood loss: blood at 80% (max 600, blood 480) -> (100 - 80)/2 = 10% penalty
        b.blood = Math.floor(b.maxBlood * 0.8);
        expect(health.productivityModifier(id)).toBe(80); // 100 - 10 - 10 = 80

        // One lost arm: -25%
        b.permanent.push('lost_left_arm');
        expect(health.productivityModifier(id)).toBe(55); // 80 - 25 = 55

        // Cannot drop below PRODUCTIVITY_FLOOR (30)
        b.pain = 70; // -35%
        // 100 - 35 - 10 - 25 = 30
        expect(health.productivityModifier(id)).toBe(30);
        b.pain = 78; // -39% -> 100 - 39 - 10 - 25 = 26 < 30
        expect(health.productivityModifier(id)).toBe(PRODUCTIVITY_FLOOR);
      }
    });
  });
});
