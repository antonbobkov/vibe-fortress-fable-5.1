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
/** T-446: tiles from the fortress within which a territorial animal keeps no home chunk (*unmeasured*). */
export const TERRITORY_AVOID_RADIUS = 16;
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
/** T-545: days after a dangerous surface group arrives in which no other dangerous species rolls to spawn (not on `beastwood`). */
export const DANGEROUS_QUIET_DAYS = 28;
/** Tiles from any dwarf. */
export const SPAWN_MIN_DISTANCE = 25;
/** `08` § Wild herds: a herd's spawn chance a day at weight 100, below its cap (*unmeasured*). */
export const HERD_SPAWN_PERMILLE = 30;
/** `08` § Wild herds: the stream the herds draw on, so the ordinary wild spawning draws as before. */
export const HERDS_STREAM = '08.herds';
/** `08` § Products, The camel spits: a milking or shearing of a spitting species ends in a spit this often (*unmeasured*). */
export const SPIT_PERMILLE = 50;
/** `08` § Products, The camel spits: the species that spit. */
export const SPITTING_SPECIES: readonly string[] = ['camel'];
/** Growing-season capacity allowance; winter needs accessible cave moss. */
export const GRASS_PER_GRAZER = 48;
/** `08` § Grazing shrubs: a grazable shrub counts as `1 / SHRUB_GRAZE_WEIGHT` of a grass tile in a pasture's capacity. */
export const SHRUB_GRAZE_WEIGHT = 4;
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

// ---------- a sleeper and noise (`08` § Wild behavior, `sleep`, T-540; all *unmeasured*) ----------

/** Tiles (Chebyshev, the same level) within which a sleeper hears a noise. */
export const NOISE_RADIUS = 4;
/** Wake chance of an attack on the sleeper itself that misses, is parried or is blocked. */
export const NOISE_MISS_PERMILLE = 600;
/** Wake chance of any attack on another creature, one tile away. */
export const NOISE_FIGHT_PERMILLE = 250;
/** Wake chance of a dwarf in metal armour one tile away, at each listen. */
export const NOISE_DWARF_METAL_PERMILLE = 100;
/** Wake chance of a dwarf in leather or no armour one tile away, at each listen. */
export const NOISE_DWARF_PERMILLE = 30;
/** A sleeper listens for dwarves near it once in this many ticks. */
export const NOISE_LISTEN_TICKS = 10;
/** The share of wild animals, in permille, that are heavy sleepers. */
export const HEAVY_SLEEPER_PERMILLE = 200;
/** A heavy sleeper's wake chance from a noise is the ordinary chance divided by this. */
export const HEAVY_SLEEPER_NOISE_DIVISOR = 10;
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
/** `frostmarrow`: "adds `yak` (wild, tameable, group 2–4) and `snow_leopard` cap +2" (T-445). */
export const FROSTMARROW_YAK = 'yak';
/** The wild yak's spawn weight on a `frostmarrow` map, a percentage of the base rate (*unmeasured*). */
export const FROSTMARROW_YAK_WEIGHT = 20;
export const FROSTMARROW_YAK_GROUP: readonly [number, number] = Object.freeze([2, 4]) as readonly [number, number];
export const FROSTMARROW_SNOW_LEOPARD = 'snow_leopard';
export const FROSTMARROW_SNOW_LEOPARD_CAP_BONUS = 2;
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

/** `08` § Tame behavior, the pets' spot (T-482, a fun feature): at most this many idle pets heap on it. */
export const PET_PILE_MAX = 4;
/** `08` § Tame behavior: a tame animal that is no grazer and no larger than this is a pet that heaps (a wolf's 35: dogs, cats, foxes, chickens; not a pig). */
export const PET_PILE_SIZE_MAX = 35;

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
/** `08` § Tame behavior, *Before the hall* (T-675): the chance per think that an idle tame animal sets off on an amble (half for a grazer on grass). */
export const TAME_AMBLE_PERMILLE = 60;
/** `08` § Tame behavior, *Before the hall*: an amble's tiles lie within this many tiles of the wagon. */
export const TAME_AMBLE_RADIUS = 6;
/** `08` § Tame behavior, *Before the hall*: a cat roams farther. */
export const CAT_ROAM_RADIUS = 12;
/** `08` § Tame behavior, *Before the hall*: an amble never ends within this many tiles of a hostile the animal sees. */
export const TAME_AMBLE_SHY_RADIUS = 8;
/**
 * `08` § Tame behavior, *After the hall* (T-683): an unpastured grazer does not go out to the wagon's ground,
 * and one out there comes in, while a hostile, a deep creature or a wild carnivore stands within this many
 * tiles of the wagon (its ground, `TAME_AMBLE_RADIUS`, and the shy distance beyond it, `TAME_AMBLE_SHY_RADIUS`,
 * with two to spare). *Unmeasured*.
 */
export const TAME_GRAZE_WARY_RADIUS = 16;
/** The species that adopt a dwarf each season (`08` § Pets: "each `cat` not already a pet"). */
export const ADOPTING_SPECIES: readonly string[] = Object.freeze(['cat']);
/** The zone type a grazer is kept in (`08` § Pastures and feeding). */
export const PASTURE_ZONE = 'pasture';
/** `NameAnimal`: the same 1-24 characters `RenameDwarf` allows. */
export const ANIMAL_NAME_MAX = 24;

/** `08` § Dung: a pastured tame grazer drops one dung every this many days. */
export const DUNG_DAYS = 7;
/** `08` § Dung: the item (and material) a grazer drops. */
export const DUNG_ITEM = 'dung';
/** `08` § Bat roosts: a roost drops one guano every this many days (*unmeasured*). */
export const ROOST_DAYS = 7;
/** `08` § Bat roosts: how near a fortress dwarf stands to a discovered roost to count the bats (*unmeasured*). */
export const ROOST_NOTICE_RADIUS = 8;
/** `08` § Bat roosts: the item (and material) a roost drops. */
export const GUANO_ITEM = 'guano';

/** `08` § Hives: a hive adds a comb on the day whose number plus its id is a multiple of this. */
export const HIVE_DAYS = 14;
/** `08` § Hives: the flower tiles a hive needs within `HIVE_FLOWER_RADIUS` to make anything. */
export const HIVE_FLOWERS_MIN = 3;
/** `08` § Hives: the reach of a hive's bees, Chebyshev on its level. */
export const HIVE_FLOWER_RADIUS = 6;
/** `08` § Hives: the combs a hive holds at most. */
export const HIVE_CAPACITY = 2;
/** `08` § Hives: the work of `collect_honey`. */
export const COLLECT_HONEY_TICKS = 60;
/** `08` § Hives: the collector is stung this often (permille). */
export const STING_PERMILLE = 100;
/** `08` § Hives: a dwarf this near a hive (Chebyshev, its level) may be stung in summer. */
export const HIVE_STING_RADIUS = 3;
/** `08` § Hives: a passer-by's chance an hour (permille). */
export const HIVE_PASSER_PERMILLE = 20;
/** `08` § Hives: the function tag of a hive building (`buildings-and-furniture.md`). */
export const HIVE_TAG = 'hive';
/** `08` § Hives: the item a hive fills with, of material `honey`. */
export const HONEYCOMB_ITEM = 'honeycomb';
/** `08` § Hives: the material of a comb. */
export const HONEY_MATERIAL = 'honey';
/** `Stung.source` of a bee sting (09's nettle is `nettle`). */
export const STING_SOURCE_BEES = 'bees';
