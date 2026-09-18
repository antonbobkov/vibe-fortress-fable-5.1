// docs/03-content/regions-biomes-and-traits.md -> biomes, biomeLookup, ratingThresholds,
// regionTraits, civilizations, weatherStates, weatherTables.

import { join } from 'node:path';
import {
  CONTENT_DIR,
  asObjects,
  byId,
  compact,
  fixed,
  findTable,
  glyph,
  id,
  int,
  isBlank,
  plain,
  range,
  readTables,
  SEASONS,
  ticked,
  weighted,
} from '../md-tables.mjs';

const DOC = () => readTables(join(CONTENT_DIR, 'regions-biomes-and-traits.md'));

export function exportBiomes() {
  const table = findTable(DOC(), 'Biomes', 'referenceTempC');
  return byId(
    asObjects(table).map((row) => {
      const temps = plain(row.seasonTemp)
        .replace(/−/g, '-')
        .split('/')
        .map((t) => Number(t.trim()))
        .filter((n) => Number.isFinite(n));
      return {
        id: plain(row.id),
        name: plain(row.name),
        referenceTempC: int(row.referenceTempC),
        seasonTemp: temps.length === 4 ? temps : [0, 0, 0, 0],
        soilDepth: int(row['soil depth']),
        soil: weighted(row['soil materials']).map((w) => ({ material: w.key, weight: w.weight })),
        treeDensity: fixed(row.trees),
        shrubDensity: fixed(row.shrubs),
        wildlifeDensity: fixed(row.wildlife),
        embarkable: /yes/i.test(plain(row.embark)),
        color: id(row.color),
        glyph: glyph(row.glyph),
      };
    }),
  );
}

export function exportBiomeLookup() {
  const table = findTable(DOC(), 'Biome lookup', 'arid');
  const rains = table.header.slice(1).map(plain);
  const out = [];
  for (const cells of table.rows) {
    const temp = plain(cells[0]);
    rains.forEach((rain, i) => {
      const biome = id(cells[i + 1]);
      if (biome !== null) out.push({ temp, rain, biome });
    });
  }
  return out;
}

export function exportRatingThresholds() {
  const table = findTable(DOC(), 'Rating thresholds', 'Rating');
  const out = [];
  for (const cells of table.rows) {
    const rating = plain(cells[0]).replace(/\s*score\s*→?\s*$/, '').replace(/→/, '').trim();
    const bands = cells.slice(1).map((c) => {
      const r = range(c);
      const ge = /≥\s*(\d+)/.exec(plain(c));
      if (ge !== null) return [Number(ge[1]), 99];
      return r ?? [0, 0];
    });
    out.push({ rating, bands });
  }
  return out;
}

const BIOME_WORDS = new Set([
  'ocean', 'glacier', 'tundra', 'taiga', 'cold_steppe', 'temperate_grassland', 'temperate_forest',
  'wetland', 'temperate_hills', 'mountain', 'alpine', 'savanna', 'desert', 'badlands',
  'tropical_forest', 'dark_forest',
]);

function parseRequirements(cell) {
  const s = plain(cell);
  // "not `ocean`, `glacier`" is an exclusion list, not a biome list (DECISIONS.md D-040).
  const notClause = /\bnot\s+([`a-z_,\s]+)$/.exec(s);
  const excluded = notClause === null ? [] : notClause[1].split(/[,\s`]+/).filter((t) => BIOME_WORDS.has(t));
  const biomes = ticked(cell).filter((t) => BIOME_WORDS.has(t) && !excluded.includes(t));
  // "frozen or cold band": temperature bands of 01 § Biomes (DECISIONS.md D-040).
  const bandMatch = /\b((?:frozen|cold|temperate|warm|hot)(?:\s+or\s+(?:frozen|cold|temperate|warm|hot))*)\s+band\b/.exec(s);
  const tempBands = bandMatch === null ? undefined : bandMatch[1].split(/\s+or\s+/);
  const bound = (word) => {
    const ge = new RegExp(`${word}\\s*≥\\s*(\\d+)`).exec(s);
    if (ge !== null) return [Number(ge[1]), 999];
    const exact = new RegExp(`${word}\\s+(\\d+)`).exec(s);
    if (exact !== null) return [Number(exact[1]), Number(exact[1])];
    return undefined;
  };
  const geology = /geology\s+([a-z ]+or[a-z ]+|[a-z]+)/.exec(s);
  return compact({
    biomes: biomes.length > 0 ? biomes : undefined,
    notBiomes: excluded.length > 0 ? excluded : undefined,
    tempBands,
    peril: bound('peril'),
    wealth: bound('wealth'),
    temper: bound('temper'),
    deepness: bound('deepness'),
    river: /\briver\b/.test(s) ? true : undefined,
    volcano: /\bvolcano\b/.test(s) ? true : undefined,
    geology:
      geology === null
        ? undefined
        : geology[1].split(/\s+or\s+/).map((g) => g.trim()).filter((g) => g.length > 0),
  });
}

/** "03: soil depth +2; 06: no storm" -> { '03': 'soil depth +2', '06': 'no storm' }. */
function parseHooks(cell) {
  const hooks = {};
  const s = plain(cell);
  const parts = s.split(/;\s*(?=(?:\d\d|minerals)\s*:)/);
  for (const part of parts) {
    const m = /^\s*([0-9a-z]+)\s*:\s*([\s\S]*)$/.exec(part.trim());
    if (m === null) continue;
    hooks[m[1]] = m[2].trim();
  }
  return hooks;
}

export function exportRegionTraits() {
  const table = findTable(DOC(), 'Region traits', 'companion');
  return byId(
    asObjects(table).map((row, order) => ({
      id: plain(row.id),
      name: plain(row.name),
      // 01 § Traits rolls "in table order"; the registry sorts rows by id (D-040).
      order,
      requirements: parseRequirements(row.requirements),
      freq: int(row.freq),
      companion: /yes/i.test(plain(row.companion)),
      hooks: parseHooks(row.hooks),
    })),
  );
}

/** caravan-goods.md names each civ's merchants and pack animals in prose. */
const CIV_PARTIES = {
  mountainhome: { merchantSpecies: 'dwarf', packAnimal: 'mule' },
  hillfolk: { merchantSpecies: 'human', packAnimal: 'mule' },
  wildwood: { merchantSpecies: 'elf', packAnimal: 'wildwood_bearer' },
  gloam: { merchantSpecies: 'gloam_warrior', packAnimal: 'mule' },
};

export function exportCivilizations() {
  const table = findTable(DOC(), 'Civilizations', 'home preference');
  return byId(
    asObjects(table).map((row) => {
      const cid = plain(row.id);
      const seasonCell = plain(row['caravan season']);
      const seasonIndex = SEASONS.findIndex((s) => seasonCell.startsWith(s));
      const fromYear = /from year (\d+)/.exec(seasonCell);
      const raidsCell = plain(row.raids).toLowerCase();
      // "`gloam_*`" is a family; the civ's representative species is the warrior (D-013).
      const species = plain(row.species).includes('*') ? 'gloam_warrior' : (id(row.species) ?? '');
      return {
        id: cid,
        name: plain(row.name),
        species,
        homePreference: plain(row['home preference']),
        caravanSeason: seasonIndex < 0 ? null : seasonIndex,
        caravanFromYear: fromYear === null ? 1 : Number(fromYear[1]),
        raids: raidsCell === 'yes',
        bandits: raidsCell.includes('bandit'),
        color: id(row.color),
        glyph: glyph(row.glyph),
        guardGear: `guard_${cid}`,
        ...CIV_PARTIES[cid],
      };
    }),
  );
}

export function exportWeatherStates() {
  const table = findTable(DOC(), 'State durations (hours)', 'min');
  return asObjects(table).map((row) => ({
    id: id(row.State),
    minHours: int(row.min),
    maxHours: int(row.max),
    // D-009: 03-content gives no per-state temperature delta; 06 weather applies its own.
    tempDelta: 0,
  }));
}

/**
 * The four transition tables sit under bold labels, not headings, so they are told apart by the
 * order the document lists them in: spring, summer, autumn, winter.
 */
export function exportWeatherTables() {
  const transitions = DOC().filter((t) => plain(t.header[0]) === 'from \\ to');
  if (transitions.length !== SEASONS.length) {
    throw new Error(`regions-biomes-and-traits.md: ${transitions.length} weather tables, expected 4`);
  }
  const out = [];
  transitions.forEach((table, season) => {
    const states = table.header.slice(1).map((h) => plain(h));
    for (const cells of table.rows) {
      const from = plain(cells[0]);
      const to = {};
      states.forEach((s, i) => {
        to[s] = int(cells[i + 1]);
      });
      out.push({ season, from, to });
    }
  });
  return out;
}
