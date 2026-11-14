import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import type { RecipeRow, WorkshopsReader } from '@systems/workshops';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();

const WORKSHOP_TYPES = [
  'carpenter', 'mason', 'craftdwarf', 'jeweler', 'mechanic',
  'wood_furnace', 'smelter', 'forge', 'kitchen', 'still',
  'tannery', 'leatherworks', 'loom', 'clothier', 'farmers_workshop', 'bowyer', 'alchemist', 'runeforge',
] as const;

const DEFAULT_MATERIALS: Readonly<Record<string, string>> = Object.freeze({
  log: 'oak',
  leather_piece: 'leather',
  raw_stone: 'granite',
  bone_pile: 'bone',
  stone_block: 'granite',
  shell_piece: 'shell',
  horn: 'horn',
  tusk: 'ivory',
  bar: 'iron',
  skull: 'skull_bone',
  cloth: 'flax_cloth',
  rough_gem: 'quartz',
  thread: 'flax_thread',
  milk: 'milk',
  fiber: 'flax_fiber',
  fat: 'tallow',
  plant_food: 'dimcap',
  raw_hide: 'cow_hide',
  wool_raw: 'wool',
  glowcap: 'glowcap',
  hollow_ichor: 'hollow_ichor',
  wyrmscale: 'wyrmscale',
  spider_venom: 'spider_venom',
  ember_gland: 'ember_gland',
  rune_vial: 'rune',
  cut_gem: 'quartz',
  // The first alternative of a setting's kept input (25 § Setting stones).
  axe: 'iron',
  bracers: 'leather',
  cap: 'leather',
  bolt: 'iron',
  brightleaf: 'oak',
});

const INGREDIENTS = [
  { item: 'plant_food', material: 'dimcap' },
  { item: 'raw_meat', material: 'cow_meat' },
  { item: 'cheese', material: 'cheese' },
  { item: 'egg', material: 'egg' },
] as const;

function runRecipe(workshopType: string, recipe: RecipeRow): { ok: boolean; error?: string } {
  const w = new TestWorld({
    seed: `recipe-${recipe.id}`,
    registry,
    map: buildFlatTestMap(registry, 32, 32),
    embark: 'none',
  });

  const workshop = w.build(workshopType, w.index(12, 12, 32), 'granite');
  w.spawnDwarf({
    at: w.index(16, 16, 32),
    skills: { [recipe.skill]: 10 },
  });

  const dropTile = w.index(16, 14, 32);

  if (recipe.id === 'melt_metal_item') {
    const axe = w.spawnItem('axe', 'iron', dropTile, 1);
    w.submit({ type: 'MeltItem', itemId: axe, on: true });
  } else {
    let ingIndex = 0;
    for (const input of recipe.inputs) {
      if (input.match === 'ingredient') {
        for (let c = 0; c < input.count; c += 1) {
          const ing = INGREDIENTS[ingIndex % INGREDIENTS.length]!;
          ingIndex += 1;
          w.spawnItem(ing.item, ing.material, dropTile, 1);
        }
      } else if (input.match === 'fuel') {
        for (let c = 0; c < input.count; c += 1) {
          w.spawnItem('charcoal_bar', 'charcoal', dropTile, 1);
        }
      } else {
        let item: string;
        if (input.match.includes('|')) {
          item = input.match.split('|')[0]!;
        } else if (registry.table('items').has(input.match)) {
          item = input.match;
        } else {
          throw new Error(`Unexpected input match: ${input.match} for recipe ${recipe.id}`);
        }

        let material: string;
        if (input.material === 'flux') {
          material = 'limestone';
        } else if (input.material === 'fuel') {
          item = 'charcoal_bar';
          material = 'charcoal';
        } else if (recipe.id === 'brew' && item === 'plant_food') {
          material = 'dimcap';
        } else if (recipe.id === 'mill_flour' && item === 'plant_food') {
          material = 'barley';
        } else if (input.material !== undefined && registry.table('materials').has(input.material)) {
          material = input.material;
        } else if (input.materials !== undefined && !input.materials.includes(DEFAULT_MATERIALS[item] ?? '')) {
          material = input.materials[0]!;
        } else if (DEFAULT_MATERIALS[item] !== undefined) {
          material = DEFAULT_MATERIALS[item]!;
        } else if (item === 'ore' && input.material !== undefined) {
          material = input.material;
        } else {
          throw new Error(`No material rule for item ${item} in recipe ${recipe.id}`);
        }

        if (!registry.table('materials').has(material)) {
          throw new Error(`Default material ${material} for item ${item} is missing from registry`);
        }

        w.spawnItem(item, material, dropTile, input.count);
      }
    }
  }

  if (recipe.fuel) {
    w.spawnItem('charcoal_bar', 'charcoal', dropTile, 1);
  }

  if (recipe.container === 'barrel') {
    w.spawnItem('barrel', 'pine', dropTile, 1);
  } else if (recipe.container === 'bag') {
    w.spawnItem('bag', 'flax_cloth', dropTile, 1);
  }

  w.step(1);

  w.game.world.applyCommand({
    type: 'AddWorkOrder',
    workshopId: workshop,
    order: { recipeId: recipe.id, mode: 'once', remaining: 1, priority: 5 },
  });

  let crafted = false;
  for (let ticks = 0; ticks < 1000; ticks += 50) {
    w.step(50);
    // A transform recipe crafts nothing: it sets a stone (25 § Setting stones).
    if (w.events('ItemCrafted').some((e) => e['recipeId'] === recipe.id) ||
      (recipe.transform === true && w.events('StoneSet').length > 0)) {
      crafted = true;
      break;
    }
  }

  if (!crafted) {
    const wsBlocked = w.events('WorkshopBlocked').map((e) => e['reason']).join(', ');
    const jobBlocked = w.events('JobBlocked').map((e) => e['reason']).join(', ');
    return {
      ok: false,
      error: `[${recipe.id} failed: WorkshopBlocked: (${wsBlocked || 'none'}), JobBlocked: (${jobBlocked || 'none'})]`,
    };
  }

  return { ok: true };
}

describe('F-06 every recipe through the real loop', () => {
  const refWorld = new TestWorld({
    seed: 'ref-recipe-list',
    registry,
    map: buildFlatTestMap(registry, 32, 32),
    embark: 'none',
  });
  const reader = refWorld.readers.of<WorkshopsReader>('12');

  it('the recipe count over all types is 211', () => {
    let total = 0;
    for (const type of WORKSHOP_TYPES) {
      total += reader.recipesFor(type).length;
    }
    expect(total).toBe(211);
  });

  for (const workshopType of WORKSHOP_TYPES) {
    it(workshopType, () => {
      const recipes = reader.recipesFor(workshopType);
      const failures: string[] = [];

      for (const recipe of recipes) {
        const result = runRecipe(workshopType, recipe);
        if (!result.ok) {
          failures.push(result.error ?? recipe.id);
        }
      }

      expect(failures).toEqual([]);
    });
  }
});
