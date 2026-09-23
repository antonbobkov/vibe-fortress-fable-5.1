/** 12 Workshops & Professions, Tuning constants. */
export const MAGMA_POWER_LEVEL = 4;
export const SILVER_FROM_GALENA_PERMILLE = 500;
export const MELT_RETURN_PERCENT = 60;
export const CHARCOAL_PER_LOG = 1;
export const COAL_PER_ORE = 2;
export const BARS_PER_ORE = 2;

/** The recipes this M4 block activates. T-M5-01, T-M5-03 and T-M5-05 lift this seam. */
export const M4_RECIPE_WORKSHOPS: ReadonlySet<string> = new Set([
  'carpenter', 'mason', 'craftdwarf', 'kitchen', 'still', 'farmers_workshop',
  'tannery', 'leatherworks', 'loom', 'clothier', 'bowyer',
]);
