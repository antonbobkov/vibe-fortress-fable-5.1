/**
 * `02-systems/12-workshops-and-professions.md` § Substitutes: a recipe that stands in for a
 * regular one stays worse than it. Per unit of its first output, a substitute takes at least as
 * many input units (the job's own fuel counted as one) and at least as many ticks, or its output is
 * worth less (the output item's `mult` × its material's value); it is never better on all three.
 *
 * Every substitute recipe adds its pair to {@link SUBSTITUTES} when its row lands. The two make the
 * same item, or containers of one class (a pot of 10 stands in for a barrel of 20).
 */

import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { loadContent } from '@content/loader';
import type { ItemTypeDef, MaterialDef, RecipeDef } from '@content/generate';

/** [substitute, the regular recipe it stands in for, the material its output is judged in when it takes an input's]. */
const SUBSTITUTES: readonly (readonly [string, string, string?])[] = [
  ['make_steel_shell', 'alloy_steel'],
  ['make_steel_bone_ash', 'alloy_steel'],
  ['fire_bricks', 'make_stone_block', 'granite'],
  ['make_pot', 'make_barrel', 'oak'],
  ['make_jug', 'make_bucket', 'oak'],
  ['make_mugs_clay', 'make_mug_stone', 'granite'],
  ['spin_coarse_thread', 'spin_thread', 'flax_thread'],
  ['weave_basket', 'make_bin', 'oak'],
  ['twist_reed_rope', 'make_rope', 'flax_thread'],
  ['cut_leather_rope', 'make_rope', 'flax_thread'],
  ['weave_wicker_shield', 'make_buckler_wood', 'oak'],
  ['make_splint_bone', 'make_splint', 'oak'],
  ['make_crutch_bone', 'make_crutch', 'oak'],
  ['forge_crutch', 'make_crutch', 'oak'],
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
      // The two make the same thing: the comparison is per unit of the same output item, or of a
      // container of the same class.
      const kind = (r: RecipeDef | undefined): string => {
        const item = items.byId(r?.outputs[0]?.item ?? '');
        return item?.containerClass ?? item?.id ?? '';
      };
      expect(kind(sub)).toBe(kind(regular));
    });
  }

  it('make_steel_shell takes 6 units to the alloy\'s 4, in the same 200 ticks, for the same steel', () => {
    const shell = cost(recipes.byId('make_steel_shell') as RecipeDef);
    const alloy = cost(recipes.byId('alloy_steel') as RecipeDef);
    expect(shell).toEqual({ ...alloy, units: 6 });
    expect(alloy.units).toBe(4);
    expect(alloy.ticks).toBe(200);
  });

  // A substitute with an item of its own (T-551): the stone bed stands in for the wooden bed. It is
  // judged by what a bed is for, its rest (14 § Beds), and by its worth: it rests less and is worth less.
  for (const subId of ['make_stone_bed', 'make_stone_bed_straw']) {
    it(`${subId} makes a bed that rests less and is worth less than make_bed's`, () => {
      const buildings = registry.table<{ id: string; rest?: number }>('buildings');
      // In the commonest stone and wood: granite against pine.
      const sub = cost(recipes.byId(subId) as RecipeDef, 'granite');
      const regular = cost(recipes.byId('make_bed') as RecipeDef, 'pine');
      expect(recipes.byId(subId)?.outputs[0]?.item).toBe('stone_bed');
      expect(buildings.byId('stone_bed')?.rest ?? 0).toBeLessThan(buildings.byId('bed')?.rest ?? 0);
      expect(sub.value).toBeLessThan(regular.value);
      // And it takes more units of input than the wooden bed's one log.
      expect(sub.units).toBeGreaterThan(regular.units);
    });
  }

  it('bone ash takes the 4 units of the flux stone, in the same 200 ticks, for the same steel', () => {
    const ash = cost(recipes.byId('make_steel_bone_ash') as RecipeDef);
    expect(ash).toEqual(cost(recipes.byId('alloy_steel') as RecipeDef));
  });

  it('a brick takes a clay load and a fuel for one block, the mason one stone for two', () => {
    const brick = cost(recipes.byId('fire_bricks') as RecipeDef);
    const block = cost(recipes.byId('make_stone_block') as RecipeDef, 'granite');
    expect(brick).toMatchObject({ units: 2, per: 1 });
    expect(block).toMatchObject({ units: 1, per: 2 });
    expect(brick.value).toBeLessThan(block.value);
  });

  it("T-549: a reed rope is worth a third of a linen one; a leather rope takes the thread's 2 units in 120 ticks against 100", () => {
    const reed = cost(recipes.byId('twist_reed_rope') as RecipeDef, 'flax_thread');
    const leather = cost(recipes.byId('cut_leather_rope') as RecipeDef, 'flax_thread');
    const linen = cost(recipes.byId('make_rope') as RecipeDef, 'flax_thread');
    expect(reed).toMatchObject({ units: 3, ticks: 80 });
    expect(reed.value * 3).toBe(linen.value);
    expect(leather).toMatchObject({ units: linen.units, ticks: 120 });
    expect(linen).toMatchObject({ units: 2, ticks: 100 });
  });

  it("T-549: a bone pile splints two legs to a log's four", () => {
    expect(cost(recipes.byId('make_splint_bone') as RecipeDef, 'oak')).toMatchObject({ units: 1, per: 2 });
    expect(cost(recipes.byId('make_splint') as RecipeDef, 'oak')).toMatchObject({ units: 1, per: 4 });
  });

  // T-552: the half fuels stand in for charcoal. They are dried on a rack (`items.md` § Drying), not
  // made at a workshop, and a job burns two of them in place of one bar (12 § Fuel). Per fuel burned,
  // each takes at least the log charcoal takes and longer than the wood furnace's job, and smokes.
  const HALF_FUELS: readonly (readonly [string, string])[] = [['dry_peat', 'peat_brick'], ['dry_dung', 'dung_cake']];
  for (const [rowId, fuel] of HALF_FUELS) {
    it(`${rowId} (${fuel}, a half fuel) is worse than make_charcoal per fuel burned`, () => {
      const drying = registry.table<{ id: string; count: number; output: { item: string; count: number }; days: number }>('drying');
      const row = drying.byId(rowId);
      const charcoal = recipes.byId('make_charcoal') as RecipeDef;
      expect(row?.output.item).toBe(fuel);
      expect(items.byId(fuel)?.tags).toEqual(expect.arrayContaining(['fuel_half', 'smoky']));
      expect(items.byId('charcoal_bar')?.tags).toContain('fuel');
      const halves = 2; // HALF_FUELS_PER_JOB: two half fuels burn as one bar
      const sub: Cost = { units: (row?.count ?? 0) * halves, ticks: (row?.days ?? 0) * TICKS_PER_DAY * halves, value: 0, per: (row?.output.count ?? 0) };
      const regular: Cost = { units: charcoal.inputs.reduce((n, input) => n + input.count, 0), ticks: charcoal.baseTicks, value: 0, per: charcoal.outputs[0]?.count ?? 0 };
      expect(atLeast(sub.units, sub.per, regular.units, regular.per), `${rowId} ${JSON.stringify(sub)} against ${JSON.stringify(regular)}`).toBe(true);
      expect(atLeast(sub.ticks, sub.per, regular.ticks, regular.per)).toBe(true);
      expect(substituteIsWorse(sub, regular)).toBe(true);
    });
  }

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
