/** 12 Workshops & Professions, Tuning constants. */
export const MAGMA_POWER_LEVEL = 4;
export const SILVER_FROM_GALENA_PERMILLE = 500;
export const MELT_RETURN_PERCENT = 60;
export const CHARCOAL_PER_LOG = 1;
export const COAL_PER_ORE = 2;
export const BARS_PER_ORE = 2;

/** Recipe availability follows the workshop milestones; content rows are loaded from M0. */
export const ACTIVE_RECIPE_WORKSHOPS: ReadonlySet<string> = new Set([
  'carpenter', 'mason', 'craftdwarf', 'kitchen', 'still', 'farmers_workshop',
  'tannery', 'leatherworks', 'loom', 'clothier', 'bowyer', 'wood_furnace', 'forge',
  'mechanic', 'jeweler',
]);

export function recipeActive(recipe: { readonly id: string; readonly workshop: string }): boolean {
  return ACTIVE_RECIPE_WORKSHOPS.has(recipe.workshop) ||
    (recipe.workshop === 'smelter' && (recipe.id.startsWith('smelt_') || recipe.id.startsWith('alloy_')));
}
