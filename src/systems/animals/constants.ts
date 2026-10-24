/**
 * 08 Animals & domestication tuning constants: every row of
 * `02-systems/08-animals-and-domestication.md` § Tuning constants, verbatim, plus the literals the
 * rules of § Perception and brains, § Wild behavior and § Wild spawning name in prose and the
 * trait hooks of `03-content/regions-biomes-and-traits.md`.
 */

/** Think interval when far from dwarves. */
export const WILD_THINK_TICKS = 10;
/** performance-budget.md § Load shedding rules; only far wild brains (D-210). */
export const WILD_LOAD_SHEDDING_THINK_TICKS = 20;
export const NEAR_DWARF_RADIUS = 20;
export const WANDER_RADIUS = 16;
export const GRAZE_TICKS = 60;
export const TERRITORY_RADIUS = 5;
export const FLEE_TICKS = 200;
/** Default flee threshold; defined in 16; species override it with their `flee` column. */
export const FLEE_BLOOD_PERCENT = 50;
export const PREDATOR_HUNGER_DAYS = 3;
export const EAT_CORPSE_TICKS = 300;
/** Consecutive unseen ticks before a held wild attack ends. */
export const ATTACK_PERCEPTION_GRACE_TICKS = 50;
export const WILD_LIFETIME_DAYS = 42;
/** Per species per day when below cap. */
export const SPAWN_PERMILLE = 150;
/** Tiles from any dwarf. */
export const SPAWN_MIN_DISTANCE = 25;
/** Growing-season capacity allowance; winter needs accessible cave moss. */
export const GRASS_PER_GRAZER = 48;
export const CONDITION_PER_HOUR = 2;
export const CONDITION_PER_GRASS = 25;
/** Days at condition 100 before a grazer dies. */
export const ANIMAL_STARVE_DAYS = 10;
/** Per species. */
export const BREEDING_CAP_DEFAULT = 12;
export const BREED_RADIUS = 10;
/** Per eligible female per day. */
export const BREED_PERMILLE = 60;
export const HATCH_DAYS = 12;
export const TRAIN_TICKS = 400;
export const TRAIN_BASE_PERMILLE = 300;
/** Per skill level. */
export const TRAIN_PER_SKILL = 35;
export const WAR_ANIMAL_RADIUS = 8;
/** Per cat per season. */
export const ADOPT_PERMILLE = 250;

/** The workshop tag/type used for training and taming animals (`08` § Taming and training). */
export const KENNEL_WORKSHOP = 'kennel';

/**
 * Success probability for training or taming an animal (permille: 0..1000).
 * `08` § Taming: `TRAIN_BASE_PERMILLE + skill × TRAIN_PER_SKILL`.
 */
export function trainingSuccessChance(skill: number): number {
  return Math.max(0, Math.min(1000, TRAIN_BASE_PERMILLE + skill * TRAIN_PER_SKILL));
}

// ---------- literals the rules name in prose ----------

/** `08` § Wild behavior: "`idle` → after a random 20–100 ticks". */
export const IDLE_MIN_TICKS = 20;
export const IDLE_MAX_TICKS = 100;
/** `creature-brains.md` § Animal brain: `sleep` holds for `W.stateUntil = tick + 600`. */
export const SLEEP_TICKS = 600;
/** "`graze` (grazers, if grass in radius 6)". */
export const GRAZE_SEARCH_RADIUS = 6;
/** Ticks a grazer passes over a grass tile whose walk came back unreachable (unmeasured). */
export const GRAZE_SKIP_TICKS = 600;
/** "prey (species with `size < own size × 0.8` …)", in permille of the hunter's size. */
export const PREY_SIZE_PERMILLE = 800;
/** Maximum nearby living pack members contributing to the animal-prey size limit. */
export const PREY_PACK_MAX_MEMBERS = 3;
/** "ignores dwarves unless approached within 3 tiles". */
export const APPROACH_RADIUS = 3;
/** `creature-brains.md` `flee`: "sampled 8 directions × 6 steps". */
export const FLEE_SAMPLE_DIRECTIONS = 8;
export const FLEE_SAMPLE_STEPS = 6;
/** `08` § Perception and brains: "a radius by species (`perception`, default 12)". */
export const DEFAULT_PERCEPTION = 12;
/** `creatures.md`: "Per-species caps per biome are `cap = weight / 5` (rounded up, minimum 2)". */
export const CAP_PER_WEIGHT = 5;
export const CAP_MIN = 2;

// ---------- region trait hooks (`regions-biomes-and-traits.md` § Traits, the `08` hooks) ----------

/** `beastwood`: "wolf and bear groups ×2, caps ×2; all wildlife caps ×1.5". */
export const BEASTWOOD_SPECIES: readonly string[] = Object.freeze(['wolf', 'bear']);
export const BEASTWOOD_SPECIES_FACTOR_PERCENT = 200;
export const BEASTWOOD_ALL_FACTOR_PERCENT = 150;
/** `serene_vale`: "herbivore caps ×2, no wolves, bears, snow leopards". */
export const SERENE_VALE_BANNED: readonly string[] = Object.freeze(['wolf', 'bear', 'snow_leopard']);
export const SERENE_VALE_HERBIVORE_FACTOR_PERCENT = 200;
/** `fungal_depths`: "08 and 18: cavern caps ×1.5". */
export const FUNGAL_DEPTHS_CAVERN_FACTOR_PERCENT = 150;

/** `tick-order.md`: "08 animals — every tick (think intervals inside)". */
export const ANIMALS_CADENCE = 1;
export const ANIMALS_PHASE = 0;

/**
 * The `wander` state's safety timeout. `08` § Wild behavior ends a wander "on arrival or timeout"
 * but names no length; `FLEE_TICKS` is the only per-state duration the document gives, and the
 * same value keeps a wandering animal from holding a stale path for ever. docs/02-systems/08-animals-and-domestication.md § Perception and brains.
 */
export const WANDER_TIMEOUT_TICKS = 200;

/**
 * `08` § Pets: "A pet follows its dwarf loosely (within 5 tiles)"; `creature-brains.md` uses the
 * same 5 for `T.petOf and dist(owner) > 5`.
 */
export const PET_FOLLOW_RADIUS = 5;

/** `08` § Products: eggs are laid as this item type into a `nest_box` building. */
export const EGG_ITEM = 'egg';
/** The function tag of the nest box building (`buildings-and-furniture.md`). */
export const NEST_BOX_TAG = 'nest_box';
/**
 * A tame animal's think interval. `08` § Perception and brains gives one only for wild animals;
 * a tame animal is never fleeing a threat it must react to every tick, so it uses the far interval
 * `WILD_THINK_TICKS`. docs/02-systems/08-animals-and-domestication.md § Perception and brains.
 */
export const TAME_THINK_TICKS = WILD_THINK_TICKS;
/** The species that adopt a dwarf each season (`08` § Pets: "each `cat` not already a pet"). */
export const ADOPTING_SPECIES: readonly string[] = Object.freeze(['cat']);
/** The zone type a grazer is kept in (`08` § Pastures and feeding). */
export const PASTURE_ZONE = 'pasture';
/** `NameAnimal`: the same 1-24 characters `RenameDwarf` allows. */
export const ANIMAL_NAME_MAX = 24;
