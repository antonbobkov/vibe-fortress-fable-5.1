import { describe, expect, it } from 'vitest';
import { drinkStock } from '../scenarios/three_years_economy';
import { command, UnexpectedRejection } from '../scenarios/script-commands';
import { TestWorld } from '../scenarios/test-world';

describe('T-402 the three-year script keeps the stills within what an order can hold', () => {
  it('a population of 69 asked for 1,116 drinks, which a keep >= order refuses; the script now asks for 999', () => {
    // The old formula: ceil(population * 0.77 * 21 days) = 1116 at 69 dwarves (p2-7, tick 337,200).
    expect(Math.ceil(69 * 0.77 * 21)).toBe(1116);
    expect(drinkStock(69)).toBe(999);
    expect(drinkStock(10)).toBe(162);
    expect(drinkStock(1)).toBe(80);
    for (let population = 1; population <= 200; population += 1) {
      expect(drinkStock(population)).toBeGreaterThanOrEqual(1);
      expect(drinkStock(population)).toBeLessThanOrEqual(999);
    }
  });

  it('the game refuses a keep >= stock over 999 and accepts the script\'s stock', () => {
    const w = new TestWorld({ seed: 't402', world: 'flat-test', embark: 'none' });
    const still = w.build('still', w.index(15, 22, 32), 'granite');
    w.step(1);
    command(w, { type: 'AddWorkOrder', workshopId: still, order: { recipeId: 'brew', mode: 'maintain', threshold: 80 } });
    const over = { type: 'EditWorkOrder', workshopId: still, index: 0, patch: { threshold: 1116 } } as const;
    expect(w.game.world.applyCommand(over)).toEqual({ ok: false, reason: 'precondition_failed' });
    expect(() => command(w, over)).toThrow(UnexpectedRejection);
    expect(command(w, { ...over, patch: { threshold: drinkStock(69) } })).toEqual({ ok: true });
  });
});
