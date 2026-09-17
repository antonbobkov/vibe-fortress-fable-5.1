// docs/03-content/{embark-catalog,threat-schedules,caravan-goods}.md ->
// embarkCatalog, embarkPresets, threatSchedules, partyCompositions, gearTiers, cavernSpawns,
// deepThresholds, caravanGoods, preferences, reputationEvents.

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  CONTENT_DIR,
  asObjects,
  byId,
  compact,
  findTable,
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

// ---------- embark ----------

const EMBARK_SECTIONS = [
  'Tools and weapons', 'Food', 'Drink (each entry is a barrel with 20 units)',
  'Seeds (bags of 10)', 'Materials', 'Furniture', 'Animals',
];

export function exportEmbarkCatalog() {
  const tables = readTables(join(CONTENT_DIR, 'embark-catalog.md'));
  const out = [];
  for (const section of EMBARK_SECTIONS) {
    const table = findTable(tables, section, 'price');
    const isSeeds = section.startsWith('Seeds');
    for (const row of asObjects(table)) {
      const itemCell = plain(row.item ?? '');
      const marks = ticked(row.item ?? '');
      const countMatch = /×\s*(\d+)/.exec(itemCell);
      const inContainer = /in `([a-z_]+)`/.exec(itemCell);
      const plusContainer = marks.length > 1 && inContainer === null ? marks[1] : undefined;
      const speciesCell = plain(row.species ?? '');
      const speciesCount = /×\s*(\d+)/.exec(speciesCell);
      const notes = plain(row.notes ?? '');
      out.push(
        compact({
          id: plain(row.id),
          entry: plain(row.entry),
          item: isSeeds ? 'seed' : marks[0],
          material: isSeeds ? plain(row.material) : (plain(row.material).split(',')[0]?.trim() || undefined),
          count: isSeeds ? 10 : countMatch === null ? (speciesCount === null ? undefined : Number(speciesCount[1])) : Number(countMatch[1]),
          container: isSeeds ? 'bag' : (inContainer?.[1] ?? plusContainer),
          species: speciesCell === '' ? undefined : (ticked(row.species)[0] ?? undefined),
          trained: /trained war/.test(speciesCell) ? 'war' : undefined,
          sex: /\(male\)/.test(speciesCell) ? 0 : undefined,
          price: int(row.price),
          max: int(row.max, 1),
          condition: /only when/.test(notes) ? notes : undefined,
        }),
      );
    }
  }
  return byId(out);
}

const COUNT_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

/**
 * The preset skill lines ("two dwarves mining 5 + building 3 + axe 2") parse cleanly; the supply
 * lines name catalog entries in display prose rather than by id, so they are left to T-M1-04,
 * which owns the embark screen. See DECISIONS.md D-014.
 */
export function exportEmbarkPresets() {
  const text = readFileSync(join(CONTENT_DIR, 'embark-catalog.md'), 'utf8');
  const out = [];
  for (const m of text.matchAll(/### ([^(\n]+)\(([\d,]+)\)\s*\n\s*Skills:\s*([^\n]*)/g)) {
    const name = m[1].trim();
    const pid = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const skills = [];
    let dwarf = 0;
    for (const group of m[3].replace(/\.$/, '').split(';')) {
      const lead = /^\s*([a-z]+)\s+(?:dwarves|dwarf)?\s*/.exec(group);
      const repeat = lead === null ? 1 : (COUNT_WORDS[lead[1]] ?? 1);
      const body = lead === null ? group : group.slice(lead[0].length);
      const entries = Array.from(body.matchAll(/([a-z_]+)\s+(\d+)/g)).map((e) => ({
        skill: e[1],
        level: Number(e[2]),
      }));
      for (let r = 0; r < repeat; r += 1) {
        for (const e of entries) skills.push({ dwarf, skill: e.skill, level: e.level });
        dwarf += 1;
      }
    }
    out.push({ id: pid, name, skills, supplies: [] });
  }
  return byId(out);
}

// ---------- threats ----------

const SCHEDULE_SECTIONS = [
  ['Thieves', 'thief', 0],
  ['Bandits', 'bandits', 0],
  ['Ambushes', 'ambush', 0],
  ['Raids', 'raid', 1],
  ['Sieges', 'siege', 1],
];

/** "year 2 spring" / "year 1 spring day 14" / "—". */
function parseEarliest(cell) {
  if (isBlank(cell)) return null;
  const s = plain(cell);
  const year = /year\s+(\d+)/.exec(s);
  const season = SEASONS.findIndex((x) => s.includes(x));
  if (year === null || season < 0) return null;
  const day = /day\s+(\d+)/.exec(s);
  return compact({
    year: Number(year[1]),
    season,
    day: day === null ? undefined : Number(day[1]),
  });
}

function perilRange(cell) {
  const s = plain(cell);
  const r = range(s);
  if (r === null) return [];
  const out = [];
  for (let p = r[0]; p <= r[1]; p += 1) out.push(p);
  return out;
}

export function exportThreatSchedules() {
  const tables = readTables(join(CONTENT_DIR, 'threat-schedules.md'));
  const out = [];
  for (const [heading, kind, warningDays] of SCHEDULE_SECTIONS) {
    const table = tables.find(
      (t) =>
        (t.headings[t.headings.length - 1] ?? '').startsWith(heading) &&
        plain(t.header[0]) === 'Peril',
    );
    if (table === undefined) throw new Error(`threat-schedules.md: no schedule table for ${heading}`);
    for (const row of asObjects(table)) {
      const earliest = parseEarliest(row.earliest);
      const interval = range(row.interval) ?? [0, 0];
      const sizeRange = range(row.size);
      const extra = isBlank(row.trollkin) ? undefined : { trollkin: plain(row.trollkin) };
      for (const peril of perilRange(row.Peril)) {
        out.push(
          compact({
            kind,
            peril,
            earliest,
            intervalDays: interval,
            base: isBlank(row.base) ? (sizeRange === null ? 0 : sizeRange[0]) : int(row.base),
            perRenown: isBlank(row.perRenown) ? 0 : Math.round(Number(plain(row.perRenown)) * 1000),
            max: isBlank(row.max) ? (sizeRange === null ? 0 : sizeRange[1]) : int(row.max),
            warningDays,
            extra,
          }),
        );
      }
    }
  }
  return out;
}

const COMPOSITION_SPECIES = {
  Warriors: 'gloam_warrior',
  Archers: 'gloam_archer',
  Trollkin: 'trollkin',
};

export function exportPartyCompositions() {
  const tables = readTables(join(CONTENT_DIR, 'threat-schedules.md'));
  const table = findTable(tables, 'Party composition', 'Warriors');
  return asObjects(table).map((row) => {
    const kind = plain(row.Kind);
    const roles = [];
    for (const [column, species] of Object.entries(COMPOSITION_SPECIES)) {
      const cell = plain(row[column] ?? '');
      const pct = /(\d+)\s*%/.exec(cell);
      if (pct === null) continue;
      const override = ticked(row[column] ?? '')[0];
      roles.push({
        role: column.toLowerCase(),
        species: override ?? species,
        fraction: Number(pct[1]) * 10,
      });
    }
    return { kind, roles, captain: /^[1-9]/.test(plain(row.Captain)) };
  });
}

/** Build a display-name -> item id map so the gear kits can name items in prose. */
function itemNameMap(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item.name.toLowerCase(), item.id);
    map.set(item.id.replace(/_/g, ' '), item.id);
  }
  return map;
}

/** "short sword or mace (50/50), cap, leather jerkin, buckler 50%" -> kit entries. */
function parseKit(cell, names) {
  if (isBlank(cell)) return [];
  const out = [];
  for (const chunk of plain(cell).split(',')) {
    const part = chunk.trim();
    if (part.length === 0) continue;
    const split = /\((\d+)\/(\d+)\)/.exec(part);
    const pct = /(\d+)\s*%/.exec(part);
    const count = /^(\d+)\s+/.exec(part);
    const words = part
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\d+\s*%/g, ' ')
      .replace(/^\d+\s+/, '')
      .split(/\s+or\s+|\s+else\s+/);
    const alternatives = words
      .map((w) => matchItem(w.trim(), names))
      .filter((x) => x !== undefined);
    const chance =
      split !== null ? 500 : pct !== null ? Number(pct[1]) * 10 : 1000;
    for (const item of alternatives) {
      out.push(
        compact({
          item,
          chance: alternatives.length > 1 && split === null && pct === null
            ? Math.round(1000 / alternatives.length)
            : chance,
          count: count === null ? undefined : Number(count[1]),
        }),
      );
    }
  }
  return out;
}

function matchItem(phrase, names) {
  const cleaned = phrase.toLowerCase().replace(/\b(wooden|bone|iron|steel|rusted|30)\b/g, '').trim();
  if (cleaned.length === 0) return undefined;
  if (names.has(cleaned)) return names.get(cleaned);
  const singular = cleaned.replace(/s$/, '');
  if (names.has(singular)) return names.get(singular);
  for (const [name, iid] of names) {
    if (cleaned.endsWith(name) || singular.endsWith(name)) return iid;
  }
  return undefined;
}

export function exportGearTiers(items) {
  const tables = readTables(join(CONTENT_DIR, 'threat-schedules.md'));
  const table = findTable(tables, 'Hostile gear by tier', 'Warrior kit');
  const names = itemNameMap(items);
  const METALS = ['copper', 'bronze', 'iron', 'steel'];
  return asObjects(table).map((row) => ({
    tier: int(row.Tier),
    // Tier 0 is "wood/rusted iron (poor)": no metal tier of its own.
    metal: METALS.includes(id(row.Metal) ?? '') ? id(row.Metal) : null,
    kits: {
      warrior: parseKit(row['Warrior kit'], names),
      archer: parseKit(row['Archer kit'], names),
      captain: parseKit(row['Captain extra'], names),
    },
  }));
}

export function exportCavernSpawns() {
  const tables = readTables(join(CONTENT_DIR, 'threat-schedules.md'));
  const table = findTable(tables, 'Cavern monsters', 'Daily respawn ‰');
  return asObjects(table).map((row) => ({
    tier: int(row.Cavern),
    species: id(row.Species),
    initial: plain(row.Initial),
    cap: int(row.Cap),
    respawnPermille: int(row['Daily respawn ‰']),
  }));
}

export function exportDeepThresholds() {
  const tables = readTables(join(CONTENT_DIR, 'threat-schedules.md'));
  const table = findTable(tables, 'The Deep', 'Emergence');
  const out = [];
  for (const row of asObjects(table)) {
    const level = int(row.Level);
    const pressure = int(row.Pressure);
    const emergence = [];
    for (const part of plain(row.Emergence).split('+')) {
      const species = ticked(part)[0];
      const count = /(\d+)/.exec(part.replace(/`[^`]*`/g, ' '));
      if (species !== undefined) {
        emergence.push({ species, count: count === null ? 1 : Number(count[1]) });
      }
    }
    out.push({
      level,
      pressure,
      emergence,
      text: plain(row.Announcement).replace(/^"|"$/g, ''),
    });
  }
  return out;
}

// ---------- caravans ----------

const CARAVAN_CIVS = ['mountainhome', 'hillfolk', 'wildwood'];

export function exportCaravanGoods() {
  const tables = readTables(join(CONTENT_DIR, 'caravan-goods.md'));
  return CARAVAN_CIVS.map((civ) => {
    const heading = civ.charAt(0).toUpperCase() + civ.slice(1);
    const table = tables.find(
      (t) => (t.headings[t.headings.length - 1] ?? '').toLowerCase().startsWith(civ) &&
        plain(t.header[0]) === 'Entry',
    );
    if (table === undefined) throw new Error(`caravan-goods.md: no goods table for ${heading}`);
    const entries = asObjects(table).map((row) => {
      const itemCell = plain(row.Item);
      // Parenthesised asides may quote ids that are not part of the entry.
      const marks = ticked(String(row.Item ?? '').replace(/\([^)]*\)/g, ' '));
      const count = /×\s*(\d+)/.exec(itemCell);
      const inContainer = /in `([a-z_]+)`/.exec(itemCell);
      const pool = weighted(row['Material pool']).map((w) => ({
        material: w.key,
        weight: w.weight,
      }));
      const rareCell = plain(row['Rare (reputation ≥ 50)']);
      const rareAdds = ticked(row['Rare (reputation ≥ 50)']);
      const items = inContainer === null ? marks : marks.slice(0, -1);
      return compact({
        item: items.length === 1 ? items[0] : items,
        materials: pool,
        count: range(row.Count) ?? [1, 1],
        weight: int(row.Weight),
        container: inContainer?.[1],
        rare: rareCell.length > 0 ? true : undefined,
        rareAdds: rareAdds.length > 0 ? rareAdds : undefined,
      });
    });
    return { civ, entries };
  });
}

export function exportPreferences() {
  const tables = readTables(join(CONTENT_DIR, 'caravan-goods.md'));
  const table = findTable(tables, 'Preferences', 'Mountainhome');
  const out = [];
  for (const row of asObjects(table)) {
    const key = plain(row['Category or material class']);
    for (const civ of CARAVAN_CIVS) {
      const cell = plain(row[civ.charAt(0).toUpperCase() + civ.slice(1)]);
      out.push(
        compact({
          civ,
          key,
          percent: int(cell),
          reputationPenalty: /−2 reputation|-2 reputation/.test(cell) ? 2 : undefined,
        }),
      );
    }
  }
  return out;
}

export function exportReputationEvents() {
  const tables = readTables(join(CONTENT_DIR, 'caravan-goods.md'));
  const table = findTable(tables, 'Reputation events', 'Delta');
  return asObjects(table).map((row) => ({
    event: plain(row.Event),
    delta: plain(row.Delta),
    civ: plain(row.Civ),
  }));
}
