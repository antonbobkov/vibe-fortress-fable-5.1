/** `21-immigration.md` tuning constants. */
export const IMMIGRATION_SPIRIT_MIN = 65;
export const IMMIGRATION_PERMILLE = 700;
export const REP_PERMILLE_PER_POINT = 2;
export const WEALTH_PER_WAVE = 2000;
export const GUARANTEED_SIZE_MIN = 2;
export const GUARANTEED_SIZE_MAX = 4;
export const IMMIGRANT_BASE = 2;
export const WEALTH_PER_IMMIGRANT = 3000;
export const SPIRIT_SIZE_STEP = 2;
export const REP_PER_IMMIGRANT = 25;
export const WAVE_MAX = 12;
export const COVERAGE_SKILL = 5;
export const UNCOVERED_WEIGHT = 2;
export const PEASANT_PERMILLE = 200;
export const PRIMARY_MIN = 2;
export const PRIMARY_MAX = 7;
export const FAMILY_PERMILLE = 300;
export const CHILDREN_MAX = 2;
export const PET_PERMILLE = 150;
export const TOOL_STOCK_MIN = 2;
export const ARRIVAL_INTERVAL_TICKS = 20;
export const FINE_INDEX = 2;
export const POPULATION_CAP_MIN = 20;
export const POPULATION_CAP_MAX = 200;
/** `21` Composition: related skill 1..3, child age 3..11, equal dog/cat draw. */
export const SECONDARY_MIN = 1;
export const SECONDARY_MAX = 3;
export const CHILD_AGE_MIN = 3;
export const DOG_PERMILLE = 500;

/** Key professions from 21 Composition, using their primary and related skill ids. */
export const KEY_PROFESSIONS = [
  { id: 'miner', primary: 'mining', secondary: 'pick', tool: 'pick' },
  { id: 'farmer', primary: 'farming', secondary: 'herbalism' },
  { id: 'woodcutter_carpenter', primary: 'woodcutting', secondary: 'carpentry', tool: 'axe' },
  { id: 'mason', primary: 'masonry', secondary: 'building' },
  { id: 'brewer', primary: 'brewing', secondary: 'farming' },
  { id: 'cook', primary: 'cooking', secondary: 'butchery' },
  { id: 'smith', primary: 'weaponsmithing', secondary: 'smelting' },
  { id: 'soldier', primary: 'axe', secondary: 'armor_use' },
  { id: 'medic', primary: 'medicine', secondary: 'herbalism' },
  { id: 'hunter', primary: 'hunting', secondary: 'crossbow', tool: 'crossbow' },
  { id: 'mechanic', primary: 'mechanics', secondary: 'building' },
  { id: 'weaver', primary: 'weaving', secondary: 'clothesmaking' },
] as const;
