#!/usr/bin/env node
// Converts the Markdown tables of docs/03-content into the JSON tables of src/content.
//
// `content-pipeline.md` § Principle: the Markdown is the source of truth and the JSON mirrors it
// one to one with identical field names. `tooling.md` § Content authoring loop runs this script
// after a table changes; the JSON is committed.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib/md-tables.mjs';
import {
  exportGems,
  exportGeologyTemplates,
  exportMaterials,
  exportMetals,
  exportMinerals,
  exportWealthMultipliers,
  exportFluxStones,
} from './lib/export/materials.mjs';
import {
  exportAmmo,
  exportArmor,
  exportDamageVsLayer,
  exportItems,
  exportSpells,
  exportWeapons,
} from './lib/export/items.mjs';
import { exportBodyPlans, exportCreatures } from './lib/export/creatures.mjs';
import { exportDraughts } from './lib/export/items.mjs';
import { exportPlants } from './lib/export/plants.mjs';
import {
  exportBuildings,
  exportJobTypes,
  exportLabors,
  exportRecipes,
  exportRoomTiers,
  exportSkills,
  exportZoneTypes,
} from './lib/export/rules.mjs';
import {
  exportBiomeLookup,
  exportBiomes,
  exportCivilizations,
  exportRatingThresholds,
  exportRegionTraits,
  exportWeatherStates,
  exportWeatherTables,
} from './lib/export/world.mjs';
import { exportNames, exportPersonality, exportThoughts } from './lib/export/social.mjs';
import {
  exportCaravanGoods,
  exportCavernSpawns,
  exportDeepThresholds,
  exportEmbarkCatalog,
  exportEmbarkPresets,
  exportGearTiers,
  exportPartyCompositions,
  exportPreferences,
  exportReputationEvents,
  exportThreatSchedules,
} from './lib/export/meta.mjs';
import {
  exportConfirmations,
  exportGlyphs,
  exportHints,
  exportTutorial,
  exportKeymap,
  exportMilestones,
  exportPalette,
  exportPatterns,
  exportStrings,
} from './lib/export/ui.mjs';
import { exportInstruments, exportTunes } from './lib/export/music.mjs';
import { exportIntro } from './lib/export/intro.mjs';
import { exportDeepIntro } from './lib/export/deep-intro.mjs';
import { exportRowOrder } from './lib/export/row-order.mjs';

const OUT_DIR = join(ROOT, 'src/content');

function build() {
  const items = exportItems();
  const recipes = exportRecipes();
  const thoughts = exportThoughts();

  // workshops-and-recipes.md marks quality-bearing recipes with `Q`; an item type is
  // quality-bearing when a recipe that produces it is. An output names either an item id or an
  // item tag (the symbolic `craft` of the craft recipes stands for every item tagged `craft`),
  // so every item a Q-marked recipe can output is quality-bearing (F-17a).
  const qualityOutputs = new Set();
  for (const recipe of recipes) {
    if (!recipe.quality) continue;
    for (const output of recipe.outputs) qualityOutputs.add(output.item);
  }
  for (const item of items) {
    if (qualityOutputs.has(item.id)) item.quality = true;
    if (item.tags?.some((tag) => qualityOutputs.has(tag))) item.quality = true;
    // items.md marks the three meals "quality-bearing" in its notes column.
    if (item.category.startsWith('food/meal/')) item.quality = true;
  }

  return {
    rowOrder: exportRowOrder(),
    palette: exportPalette(),
    glyphs: exportGlyphs(),
    patterns: exportPatterns(),
    materials: exportMaterials(),
    minerals: exportMinerals(),
    gems: exportGems(),
    metals: exportMetals(),
    geologyTemplates: exportGeologyTemplates(),
    wealthMultipliers: exportWealthMultipliers(),
    fluxStones: exportFluxStones(),
    items,
    weapons: exportWeapons(),
    ammo: exportAmmo(),
    armor: exportArmor(),
    damageVsLayer: exportDamageVsLayer(),
    spells: exportSpells(),
    bodyPlans: exportBodyPlans(),
    creatures: exportCreatures(),
    plants: exportPlants(),
    skills: exportSkills(),
    labors: exportLabors(),
    jobTypes: exportJobTypes(),
    buildings: exportBuildings(),
    zoneTypes: exportZoneTypes(),
    roomTiers: exportRoomTiers(),
    recipes,
    draughts: exportDraughts(),
    biomes: exportBiomes(),
    biomeLookup: exportBiomeLookup(),
    ratingThresholds: exportRatingThresholds(),
    regionTraits: exportRegionTraits(),
    civilizations: exportCivilizations(),
    weatherStates: exportWeatherStates(),
    weatherTables: exportWeatherTables(),
    personality: exportPersonality(),
    thoughts,
    names: exportNames(),
    embarkCatalog: exportEmbarkCatalog(),
    embarkPresets: exportEmbarkPresets(),
    threatSchedules: exportThreatSchedules(),
    partyCompositions: exportPartyCompositions(),
    gearTiers: exportGearTiers(items),
    cavernSpawns: exportCavernSpawns(),
    deepThresholds: exportDeepThresholds(),
    caravanGoods: exportCaravanGoods(),
    preferences: exportPreferences(),
    reputationEvents: exportReputationEvents(),
    hints: exportHints(),
    tutorial: exportTutorial(),
    milestones: exportMilestones(),
    confirmations: exportConfirmations(),
    keymap: exportKeymap(),
    instruments: exportInstruments(),
    tunes: exportTunes(),
    intro: exportIntro(),
    deepIntro: exportDeepIntro(),
    strings: exportStrings(thoughts),
  };
}

export function exportTables(outDir = OUT_DIR, { quiet = false } = {}) {
  const tables = build();
  mkdirSync(outDir, { recursive: true });
  let changed = 0;
  for (const [name, value] of Object.entries(tables)) {
    const file = join(outDir, `${name}.json`);
    const text = `${JSON.stringify(value, null, 2)}\n`;
    const before = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (before !== text) {
      writeFileSync(file, text, 'utf8');
      changed += 1;
    }
    const count = Array.isArray(value) ? value.length : Object.keys(value).length;
    if (!quiet) console.log(`${name.padEnd(20)} ${String(count).padStart(5)} rows`);
  }
  if (!quiet) console.log(`${Object.keys(tables).length} tables, ${changed} written`);
  return Object.keys(tables).length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) exportTables();
