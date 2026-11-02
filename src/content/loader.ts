/**
 * The content loader.
 *
 * Implements `01-architecture/content-pipeline.md` § Loading, in order: parse, validate, resolve
 * references, assign indices (older rows sorted by id, then `rowOrder`), build the derived structures,
 * generate the smelting, alloy and melt recipes of `03-content/minerals-and-metals.md`
 * § Generated recipes and the per-species and per-plant materials of `03-content/materials.md`
 * § Generated per species, compute the content hash, freeze.
 */

import {
  Registry,
  makeTable,
  contentHashOf,
  type RegistryTable,
  type Row,
} from '../core/registry';
import { ContentError, SCHEMAS, validateAll } from './schema';
import {
  MAGMA_C,
  applyGenerated,
  generatedMaterials,
  generatedRecipes,
  type ItemTypeDef,
  type MaterialClass,
  type MaterialDef,
  type MetalDef,
  type MineralDef,
  type PlantDef,
  type RecipeDef,
  type RecipeInput,
  type RecipeOutput,
  type RowBase,
  type SpeciesDef,
  type ThoughtDef,
} from './generate';

export {
  MAGMA_C,
  generatedMaterials,
  generatedRecipes,
  type ItemTypeDef,
  type MaterialClass,
  type MaterialDef,
  type MetalDef,
  type MineralDef,
  type PlantDef,
  type RecipeDef,
  type RecipeInput,
  type RecipeOutput,
  type RowBase,
  type SpeciesDef,
  type ThoughtDef,
};

import ammoJson from './ammo.json';
import armorJson from './armor.json';
import bodyPlansJson from './bodyPlans.json';
import biomeLookupJson from './biomeLookup.json';
import biomesJson from './biomes.json';
import buildingsJson from './buildings.json';
import caravanGoodsJson from './caravanGoods.json';
import cavernSpawnsJson from './cavernSpawns.json';
import civilizationsJson from './civilizations.json';
import confirmationsJson from './confirmations.json';
import creaturesJson from './creatures.json';
import damageVsLayerJson from './damageVsLayer.json';
import deepIntroJson from './deepIntro.json';
import deepThresholdsJson from './deepThresholds.json';
import embarkCatalogJson from './embarkCatalog.json';
import embarkPresetsJson from './embarkPresets.json';
import fluxStonesJson from './fluxStones.json';
import gearTiersJson from './gearTiers.json';
import gemsJson from './gems.json';
import geologyTemplatesJson from './geologyTemplates.json';
import glyphsJson from './glyphs.json';
import hintsJson from './hints.json';
import instrumentsJson from './instruments.json';
import introJson from './intro.json';
import itemsJson from './items.json';
import jobTypesJson from './jobTypes.json';
import keymapJson from './keymap.json';
import laborsJson from './labors.json';
import materialsJson from './materials.json';
import metalsJson from './metals.json';
import milestonesJson from './milestones.json';
import mineralsJson from './minerals.json';
import namesJson from './names.json';
import paletteJson from './palette.json';
import partyCompositionsJson from './partyCompositions.json';
import patternsJson from './patterns.json';
import personalityJson from './personality.json';
import plantsJson from './plants.json';
import preferencesJson from './preferences.json';
import ratingThresholdsJson from './ratingThresholds.json';
import recipesJson from './recipes.json';
import regionTraitsJson from './regionTraits.json';
import reputationEventsJson from './reputationEvents.json';
import roomTiersJson from './roomTiers.json';
import rowOrderJson from './rowOrder.json';
import skillsJson from './skills.json';
import stringsJson from './strings.json';
import thoughtsJson from './thoughts.json';
import tunesJson from './tunes.json';
import tutorialJson from './tutorial.json';
import threatSchedulesJson from './threatSchedules.json';
import wealthMultipliersJson from './wealthMultipliers.json';
import weaponsJson from './weapons.json';
import weatherStatesJson from './weatherStates.json';
import weatherTablesJson from './weatherTables.json';
import zoneTypesJson from './zoneTypes.json';

// ---------- loading ----------

type Json = Record<string, unknown>;

/** One row of `03-content/row-order.md`. */
interface RowOrderEntry {
  readonly table: string;
  readonly id: string;
}

/** The raw tables exactly as they sit in `src/content/*.json`. */
export function rawTables(): Record<string, unknown> {
  return {
    ammo: ammoJson,
    armor: armorJson,
    biomeLookup: biomeLookupJson,
    biomes: biomesJson,
    bodyPlans: bodyPlansJson,
    buildings: buildingsJson,
    caravanGoods: caravanGoodsJson,
    cavernSpawns: cavernSpawnsJson,
    civilizations: civilizationsJson,
    confirmations: confirmationsJson,
    creatures: creaturesJson,
    damageVsLayer: damageVsLayerJson,
    deepIntro: deepIntroJson,
    deepThresholds: deepThresholdsJson,
    embarkCatalog: embarkCatalogJson,
    embarkPresets: embarkPresetsJson,
    fluxStones: fluxStonesJson,
    gearTiers: gearTiersJson,
    gems: gemsJson,
    geologyTemplates: geologyTemplatesJson,
    glyphs: glyphsJson,
    hints: hintsJson,
    instruments: instrumentsJson,
    intro: introJson,
    items: itemsJson,
    jobTypes: jobTypesJson,
    keymap: keymapJson,
    labors: laborsJson,
    materials: materialsJson,
    metals: metalsJson,
    milestones: milestonesJson,
    minerals: mineralsJson,
    names: namesJson,
    palette: paletteJson,
    partyCompositions: partyCompositionsJson,
    patterns: patternsJson,
    personality: personalityJson,
    plants: plantsJson,
    preferences: preferencesJson,
    ratingThresholds: ratingThresholdsJson,
    recipes: recipesJson,
    regionTraits: regionTraitsJson,
    reputationEvents: reputationEventsJson,
    roomTiers: roomTiersJson,
    rowOrder: rowOrderJson,
    skills: skillsJson,
    strings: stringsJson,
    thoughts: thoughtsJson,
    tunes: tunesJson,
    tutorial: tutorialJson,
    threatSchedules: threatSchedulesJson,
    wealthMultipliers: wealthMultipliersJson,
    weapons: weaponsJson,
    weatherStates: weatherStatesJson,
    weatherTables: weatherTablesJson,
    zoneTypes: zoneTypesJson,
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Step 5 of `content-pipeline.md` § Loading. */
export interface Derived {
  materialsByClass: ReadonlyMap<string, readonly MaterialDef[]>;
  recipesByWorkshop: ReadonlyMap<string, readonly RecipeDef[]>;
  thoughtsByEvent: ReadonlyMap<string, readonly ThoughtDef[]>;
  speciesByBiome: ReadonlyMap<string, readonly { species: string; weight: number }[]>;
  itemsByCategory: ReadonlyMap<string, readonly ItemTypeDef[]>;
  itemsByTag: ReadonlyMap<string, readonly ItemTypeDef[]>;
  fluxStones: readonly string[];
}

export interface LoadOptions {
  /** Replace or add tables; used by tests to feed a broken fixture. */
  overrides?: Readonly<Record<string, unknown>>;
}

function push<K, T>(map: Map<K, T[]>, key: K, value: T): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

function freezeMap<K, T>(map: Map<K, T[]>): ReadonlyMap<K, readonly T[]> {
  const out = new Map<K, readonly T[]>();
  for (const key of Array.from(map.keys())) out.set(key, Object.freeze(map.get(key) as T[]));
  return out;
}

/**
 * Load, validate and freeze the content. Throws {@link ContentError} naming the table, row and
 * field of every problem.
 */
export function loadContent(options: LoadOptions = {}): Registry {
  const data: Json = { ...deepClone(rawTables()), ...deepClone(options.overrides ?? {}) };

  // Steps 2, 3 and the generated rows, which authored rows reference.
  applyGenerated(data);
  const issues = validateAll(data);
  if (issues.length > 0) throw new ContentError(issues);

  // Step 4: indices numbered from 1, the rows of `rowOrder` after all the others.
  const appended = new Map<string, string[]>();
  for (const { table, id } of data['rowOrder'] as RowOrderEntry[]) push(appended, table, id);
  const tables = new Map<string, RegistryTable<Row>>();
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    if (schema.shape !== 'rows') continue;
    tables.set(name, makeTable(name, data[name] as Row[], appended.get(name)));
  }

  // Step 5: derived structures.
  const materialsByClass = new Map<string, MaterialDef[]>();
  for (const m of tables.get('materials')?.ids() ?? []) {
    const row = tables.get('materials')?.byId(m) as MaterialDef;
    push(materialsByClass, row.class, row);
  }
  const recipesByWorkshop = new Map<string, RecipeDef[]>();
  for (const rid of tables.get('recipes')?.ids() ?? []) {
    const row = tables.get('recipes')?.byId(rid) as RecipeDef;
    push(recipesByWorkshop, row.workshop, row);
  }
  const thoughtsByEvent = new Map<string, ThoughtDef[]>();
  for (const tid of tables.get('thoughts')?.ids() ?? []) {
    const row = tables.get('thoughts')?.byId(tid) as ThoughtDef;
    const event = row.trigger.event;
    if (typeof event === 'string') push(thoughtsByEvent, event, row);
  }
  const speciesByBiome = new Map<string, { species: string; weight: number }[]>();
  for (const sid of tables.get('creatures')?.ids() ?? []) {
    const row = tables.get('creatures')?.byId(sid) as SpeciesDef;
    for (const entry of row.biomes ?? []) {
      push(speciesByBiome, entry.biome, { species: row.id, weight: entry.weight });
    }
  }
  const itemsByCategory = new Map<string, ItemTypeDef[]>();
  const itemsByTag = new Map<string, ItemTypeDef[]>();
  for (const iid of tables.get('items')?.ids() ?? []) {
    const row = tables.get('items')?.byId(iid) as ItemTypeDef;
    const segments = row.category.split('/');
    for (let n = 1; n <= segments.length; n += 1) {
      push(itemsByCategory, segments.slice(0, n).join('/'), row);
    }
    for (const tag of row.tags ?? []) push(itemsByTag, tag, row);
  }

  const derived = new Map<string, unknown>([
    ['materialsByClass', freezeMap(materialsByClass)],
    ['recipesByWorkshop', freezeMap(recipesByWorkshop)],
    ['thoughtsByEvent', freezeMap(thoughtsByEvent)],
    ['speciesByBiome', freezeMap(speciesByBiome)],
    ['itemsByCategory', freezeMap(itemsByCategory)],
    ['itemsByTag', freezeMap(itemsByTag)],
    ['fluxStones', Object.freeze((data['fluxStones'] ?? []) as string[])],
    ['glyphs', Object.freeze(data['glyphs'])],
    ['names', Object.freeze(data['names'])],
    ['strings', Object.freeze(data['strings'])],
    ['keymap', Object.freeze(data['keymap'])],
    ['tutorial', Object.freeze(data['tutorial'])],
    ['intro', Object.freeze(data['intro'])],
    ['deepIntro', Object.freeze(data['deepIntro'])],
    ['biomeLookup', Object.freeze(data['biomeLookup'])],
    ['ratingThresholds', Object.freeze(data['ratingThresholds'])],
    ['damageVsLayer', Object.freeze(data['damageVsLayer'])],
    ['wealthMultipliers', Object.freeze(data['wealthMultipliers'])],
    ['weatherTables', Object.freeze(data['weatherTables'])],
    ['threatSchedules', Object.freeze(data['threatSchedules'])],
    ['partyCompositions', Object.freeze(data['partyCompositions'])],
    ['gearTiers', Object.freeze(data['gearTiers'])],
    ['cavernSpawns', Object.freeze(data['cavernSpawns'])],
    ['deepThresholds', Object.freeze(data['deepThresholds'])],
    ['caravanGoods', Object.freeze(data['caravanGoods'])],
    ['preferences', Object.freeze(data['preferences'])],
    ['reputationEvents', Object.freeze(data['reputationEvents'])],
  ]);

  // Steps 6 and 7: "a stable hash over the sorted JSON", so the row order in the files does not
  // change it. Row-shaped tables are hashed in index order; the rest as they are. `rowOrder` is
  // not hashed: its only effect is that index order, which is already in the hash.
  const hashable: Record<string, unknown> = {};
  for (const name of Object.keys(data)) {
    if (name === 'rowOrder') continue;
    const table = tables.get(name);
    hashable[name] = table === undefined ? data[name] : table.ids().map((id) => table.byId(id));
  }
  const hash = contentHashOf(hashable);
  return new Registry(tables, derived, hash);
}

/** A convenience singleton: the game loads content once at startup. */
let cached: Registry | null = null;

export function contentRegistry(): Registry {
  if (cached === null) cached = loadContent();
  return cached;
}

/** Testing helper: drop the singleton so the next call reloads. */
export function resetContentRegistry(): void {
  cached = null;
}
