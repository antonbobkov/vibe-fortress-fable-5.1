import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { giftReputation, marginPercent, preferencePercent, requiredValue, tradeReputation } from '@systems/trade/valuation';

describe('T-M7-02 trade valuation', () => {
  const registry = contentRegistry();

  it('resolves deepsilver, category, material class, then default', () => {
    expect(preferencePercent(registry, 'mountainhome', 'bar/metal', 'deepsilver', 'metal')).toBe(300);
    expect(preferencePercent(registry, 'hillfolk', 'bar/metal', 'iron', 'metal')).toBe(150);
    expect(preferencePercent(registry, 'mountainhome', 'stone/gem_cut', 'granite', 'stone')).toBe(140);
    expect(preferencePercent(registry, 'wildwood', 'furniture/chair', 'pine', 'wood')).toBe(20);
    expect(preferencePercent(registry, 'wildwood', 'stone/raw', 'granite', 'stone')).toBe(80);
    expect(preferencePercent(registry, 'hillfolk', 'misc/other', 'iron', 'metal')).toBe(100);
  });

  it('bounds the skill and reputation margin', () => {
    expect(marginPercent(0, 0)).toBe(15);
    expect(marginPercent(10, 20)).toBe(9);
    expect(marginPercent(30, 100)).toBe(3);
    expect(marginPercent(0, -50)).toBe(17.5);
  });

  it('caps gift reputation over the whole caravan', () => {
    expect(giftReputation(400, 0)).toBe(4);
    expect(giftReputation(900, 4)).toBe(6);
    expect(giftReputation(100, 10)).toBe(0);
  });

  it('uses the amended worked example with an unrounded margin and a rounded requirement', () => {
    const margin = marginPercent(4, 10);
    const crafts = 30 * 9;
    const meals = 42 * 60 * 0.8;
    const required = requiredValue(2000, margin);
    expect(margin).toBe(12.5);
    expect(required).toBe(2250);
    expect(crafts + meals).toBeGreaterThanOrEqual(required);
    expect(required - (crafts + 41 * 60 * 0.8)).toBe(12);
    expect(tradeReputation(2000)).toBe(4);
  });
});
