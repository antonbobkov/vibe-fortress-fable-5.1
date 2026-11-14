/**
 * `02-systems/12-workshops-and-professions.md` § Substitutes: a recipe that stands in for a
 * regular one stays worse than it. Per unit of its first output, a substitute takes at least as
 * many input units (the job's own fuel counted as one) and at least as many ticks, or its output is
 * worth less (the output item's `mult` × its material's value); it is never better on all three.
 *
 * Every substitute recipe adds its pair to {@link SUBSTITUTES} when its row lands.
 */

import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import type { ItemTypeDef, MaterialDef, RecipeDef } from '@content/generate';

/** [substitute, the regular recipe it stands in for, the material its output is judged in when it takes an input's]. */
const SUBSTITUTES: readonly (readonly [string, string, string?])[] = [
  ['make_steel_shell', 'alloy_steel'],
];

interface Cost {
  /** Input units, the job's fuel counted as one. */
  readonly units: number;
  readonly ticks: number;
  /** The first output's value per unit, in thousandths (the item's `mult` is a `Fixed`). */
  readonly value: number;
  /** Units of the first output. */
  readonly per: number;
}

const registry = loadContent();
const recipes = registry.table<RecipeDef>('recipes');
const items = registry.table<ItemTypeDef>('items');
const materials = registry.table<MaterialDef>('materials');

function outputMaterial(recipe: RecipeDef, judgedIn?: string): string {
  const out = recipe.outputs[0];
  if (out === undefined) throw new Error(`${recipe.id} has no output`);
  const m = out.material;
  if ('fixed' in m) return m.fixed;
  if ('alloy' in m) return m.alloy;
  if ('from' in m) {
    const input = recipe.inputs[m.index];
    if (input?.material !== undefined && materials.has(input.material)) return input.material;
  }
  if (judgedIn !== undefined) return judgedIn;
  throw new Error(`${recipe.id}: give the material its output is judged in`);
}

function cost(recipe: RecipeDef, judgedIn?: string): Cost {
  const out = recipe.outputs[0];
  if (out === undefined) throw new Error(`${recipe.id} has no output`);
  const units = recipe.inputs.reduce((sum, input) => sum + input.count, 0) + (recipe.fuel ? 1 : 0);
  const item = items.byId(out.item);
  const mult = item?.mult ?? 1000;
  const material = materials.byId(outputMaterial(recipe, judgedIn));
  return { units, ticks: recipe.baseTicks, value: mult * (material?.value ?? 0), per: out.count };
}

/** Per unit of output, `a` is at least `b` (cross-multiplied, so no fractions). */
function atLeast(a: number, aPer: number, b: number, bPer: number): boolean {
  return a * bPer >= b * aPer;
}

/** The rule of § Substitutes for one pair. */
function substituteIsWorse(sub: Cost, regular: Cost): boolean {
  const moreInputs = atLeast(sub.units, sub.per, regular.units, regular.per);
  const moreTicks = atLeast(sub.ticks, sub.per, regular.ticks, regular.per);
  const worthLess = sub.value < regular.value;
  const betterOnAll = !moreInputs && !moreTicks && !worthLess;
  return !betterOnAll && ((moreInputs && moreTicks) || worthLess);
}

describe('12 § Substitutes: a substitute recipe stays worse than the recipe it stands in for', () => {
  for (const [subId, regularId, judgedIn] of SUBSTITUTES) {
    it(`${subId} is worse than ${regularId}`, () => {
      const sub = recipes.byId(subId);
      const regular = recipes.byId(regularId);
      expect(sub, subId).toBeDefined();
      expect(regular, regularId).toBeDefined();
      const a = cost(sub as RecipeDef, judgedIn);
      const b = cost(regular as RecipeDef, judgedIn);
      expect(substituteIsWorse(a, b), `${subId} ${JSON.stringify(a)} against ${regularId} ${JSON.stringify(b)}`).toBe(true);
      // The two make the same thing: the comparison is per unit of the same output item.
      expect(sub?.outputs[0]?.item).toBe(regular?.outputs[0]?.item);
    });
  }

  it('make_steel_shell takes 6 units to the alloy\'s 4, in the same 200 ticks, for the same steel', () => {
    const shell = cost(recipes.byId('make_steel_shell') as RecipeDef);
    const alloy = cost(recipes.byId('alloy_steel') as RecipeDef);
    expect(shell).toEqual({ ...alloy, units: 6 });
    expect(alloy.units).toBe(4);
    expect(alloy.ticks).toBe(200);
  });

  it('the rule fails a substitute that is better on every count and passes one that is worse on any of its terms', () => {
    const regular: Cost = { units: 4, ticks: 200, value: 40_000, per: 1 };
    expect(substituteIsWorse({ units: 3, ticks: 150, value: 40_000, per: 1 }, regular)).toBe(false);
    expect(substituteIsWorse({ units: 2, ticks: 100, value: 50_000, per: 1 }, regular)).toBe(false);
    // Fewer inputs but slower: not "at least as many" on both, and worth the same: not worse.
    expect(substituteIsWorse({ units: 3, ticks: 300, value: 40_000, per: 1 }, regular)).toBe(false);
    expect(substituteIsWorse({ units: 4, ticks: 200, value: 40_000, per: 1 }, regular)).toBe(true);
    expect(substituteIsWorse({ units: 6, ticks: 200, value: 40_000, per: 1 }, regular)).toBe(true);
    expect(substituteIsWorse({ units: 1, ticks: 50, value: 10_000, per: 1 }, regular)).toBe(true);
    // Per unit of output: 8 units for 2 is 4 for 1.
    expect(substituteIsWorse({ units: 8, ticks: 400, value: 40_000, per: 2 }, regular)).toBe(true);
  });
});
