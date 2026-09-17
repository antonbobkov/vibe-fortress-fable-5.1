// docs/03-content/materials.md and minerals-and-metals.md -> materials, minerals, gems, metals,
// geologyTemplates, wealthMultipliers.

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  CONTENT_DIR,
  asObjects,
  bool,
  byId,
  compact,
  fixed,
  findTable,
  id,
  idList,
  int,
  isBlank,
  percent,
  plain,
  range,
  readTables,
  ticked,
} from '../md-tables.mjs';

/**
 * Fields the tables do not carry, per DECISIONS.md D-009.
 * `density` 100 is the water baseline of materials.md § Columns; `hardness` 100 is one
 * `DIG_BASE_TICKS`; melting points fall back to the value the document repeats for its class.
 */
const DEFAULT_DENSITY = 100;
const DEFAULT_HARDNESS = 100;
const MINERAL_CLASSES = new Set(['stone', 'soil', 'ore', 'gem', 'metal', 'ice', 'obsidian', 'glass']);
const ORGANIC_MELTS_AT_C = 300; // materials.md: wood and cloth burn at 300 C
const MINERAL_MELTS_AT_C = 1300; // the value shared by all but four stones

function defaultMelts(cls) {
  return MINERAL_CLASSES.has(cls) ? MINERAL_MELTS_AT_C : ORGANIC_MELTS_AT_C;
}

/** minerals-and-metals.md: wood 0.40, bone 0.50, obsidian 0.70 as weapon multipliers. */
const SHARPNESS_BY_CLASS = { wood: 400, bone: 500, obsidian: 700 };

function tagsFromNotes(cell) {
  return ticked(cell).filter((t) => /^[a-z_]+$/.test(t));
}

function material(row, extra) {
  const cls = plain(row.class ?? extra.class);
  const base = {
    id: plain(row.id),
    name: plain(row.name),
    class: cls,
    value: int(row.value),
    density: isBlank(row.density) ? DEFAULT_DENSITY : int(row.density),
    hardness: isBlank(row.hardness) ? DEFAULT_HARDNESS : int(row.hardness),
    color: id(row.color),
    meltsAtC: isBlank(row.meltsAtC) ? defaultMelts(cls) : int(row.meltsAtC),
    burnable: false,
    burnTicks: 0,
  };
  const merged = { ...base, ...extra };
  if (SHARPNESS_BY_CLASS[merged.class] !== undefined) merged.sharpness = SHARPNESS_BY_CLASS[merged.class];
  const tags = tagsFromNotes(row.notes);
  if (tags.length > 0) merged.tags = tags;
  return compact(merged);
}

export function exportMaterials() {
  const tables = readTables(join(CONTENT_DIR, 'materials.md'));
  const out = [];

  for (const row of asObjects(findTable(tables, 'Stone (natural layers)'))) {
    out.push(material(row, {}));
  }
  for (const row of asObjects(findTable(tables, 'Soil'))) {
    const isPeat = plain(row.id) === 'peat';
    out.push(
      material(row, isPeat ? { burnable: true, burnTicks: 200, meltsAtC: ORGANIC_MELTS_AT_C } : {}),
    );
  }
  for (const row of asObjects(findTable(tables, 'Ice'))) out.push(material(row, {}));
  for (const row of asObjects(findTable(tables, 'Wood (one per tree species'))) {
    // materials.md: "All wood is burnable and melts (burns) at 300 C".
    out.push(material(row, { burnable: true, burnTicks: int(row.burnTicks), meltsAtC: 300 }));
  }
  for (const row of asObjects(findTable(tables, 'Animal products'))) out.push(material(row, {}));
  for (const row of asObjects(findTable(tables, 'Cloth and fiber'))) {
    // materials.md: "Cloth burns (300 ticks) and melts at 300 C."
    out.push(material(row, { burnable: true, burnTicks: 300, meltsAtC: 300 }));
  }
  for (const row of asObjects(findTable(tables, 'Gems (rough and cut'))) {
    // materials.md: "Gems melt at 1600 C or above (magma-safe)."
    out.push(material(row, { meltsAtC: 1600 }));
  }

  // Prose rows of materials.md § Ores and metals, § Meal, drink and plant materials.
  const fuels = [
    { id: 'coal', name: 'coal', value: 5, density: 130, color: 'coal_black' },
    { id: 'charcoal', name: 'charcoal', value: 3, density: 60, color: 'charcoal_gray' },
  ];
  for (const f of fuels) {
    out.push(
      compact({
        id: f.id,
        name: f.name,
        class: 'metal',
        value: f.value,
        density: f.density,
        hardness: DEFAULT_HARDNESS,
        color: f.color,
        meltsAtC: MINERAL_MELTS_AT_C,
        burnable: true,
        burnTicks: 0,
        tags: ['fuel'],
      }),
    );
  }
  out.push(
    compact({
      id: 'meal',
      name: 'meal',
      class: 'meat',
      value: 1,
      density: DEFAULT_DENSITY,
      hardness: DEFAULT_HARDNESS,
      color: 'meal_brown',
      meltsAtC: ORGANIC_MELTS_AT_C,
      burnable: false,
      burnTicks: 0,
      tags: ['edible'],
    }),
  );
  // materials.md § Meal, drink and plant materials gives the values; the colour of each drink is
  // the colour of the plant it is brewed from, per plants.md § Brewing summary (D-009).
  const drinks = [
    ['ale', 'ale', 2, 'barley_gold'],
    ['dimcap_ale', 'dimcap ale', 2, 'dimcap_violet'],
    ['cavewheat_beer', 'cavewheat beer', 2, 'cavewheat_pale'],
    ['bellwine', 'bellwine', 4, 'bell_white'],
    ['rootwine', 'rootwine', 3, 'root_amber'],
    ['strawberry_wine', 'strawberry wine', 4, 'berry_red'],
    ['hopped_ale', 'hopped ale', 3, 'hops_green'],
  ];
  const WINES = new Set(['bellwine', 'rootwine', 'strawberry_wine']);
  for (const [did, dname, dvalue, dcolor] of drinks) {
    out.push(
      compact({
        id: did,
        name: dname,
        class: 'liquid',
        value: dvalue,
        density: DEFAULT_DENSITY,
        hardness: DEFAULT_HARDNESS,
        color: dcolor,
        meltsAtC: ORGANIC_MELTS_AT_C,
        burnable: false,
        burnTicks: 0,
        tags: ['drink', WINES.has(did) ? 'wine' : 'ale'],
      }),
    );
  }
  out.push(
    compact({
      id: 'flour',
      name: 'flour',
      class: 'plant',
      value: 2,
      density: DEFAULT_DENSITY,
      hardness: DEFAULT_HARDNESS,
      color: 'flour_white',
      meltsAtC: ORGANIC_MELTS_AT_C,
      burnable: false,
      burnTicks: 0,
    }),
  );

  // Ores and metals are materials too; their extended rows live in minerals.json / metals.json.
  for (const m of exportMinerals()) {
    out.push(
      compact({
        id: m.id,
        name: m.name,
        class: 'ore',
        value: m.value,
        density: DEFAULT_DENSITY,
        hardness: DEFAULT_HARDNESS,
        color: m.color,
        meltsAtC: MINERAL_MELTS_AT_C,
        burnable: m.tags?.includes('fuel') === true,
        burnTicks: 0,
        tags: m.tags,
      }),
    );
  }
  for (const m of exportMetals()) {
    out.push(
      compact({
        id: m.id,
        name: m.name,
        class: 'metal',
        value: m.value,
        density: m.density,
        hardness: DEFAULT_HARDNESS,
        color: m.color,
        meltsAtC: m.meltsAtC,
        burnable: false,
        burnTicks: 0,
        tags: m.tags,
      }),
    );
  }
  return byId(out);
}

function parseYields(cell) {
  // "2 `iron`" | "1 `lead` + 50% 1 `silver`". Split the raw cell: `plain` strips the backticks
  // the metal ids are written in.
  const parts = String(cell ?? '').split('+');
  const out = [];
  for (const part of parts) {
    const metal = id(part);
    if (metal === null) continue;
    const pm = /(\d+)\s*%/.exec(part);
    const counts = part.replace(/\d+\s*%/, ' ').match(/\d+/);
    const entry = { metal, count: counts === null ? 1 : Number(counts[0]) };
    if (pm !== null) entry.permille = Number(pm[1]) * 10;
    out.push(entry);
  }
  return out;
}

export function exportMinerals() {
  const tables = readTables(join(CONTENT_DIR, 'minerals-and-metals.md'));
  const rows = asObjects(findTable(tables, 'Ores', 'yields'));
  return byId(
    rows.map((row) => {
      const shape = plain(row.shape) === 'cluster' ? 'cluster' : 'vein';
      const size = int(row['length / radius']);
      const isDeepsilver = plain(row.id) === 'deepsilver_ore';
      const notes = plain(row.notes);
      const tags = [];
      if (notes.includes('fuel')) tags.push('fuel');
      return compact({
        id: plain(row.id),
        name: plain(row.name),
        class: 'ore',
        hosts: isDeepsilver ? [] : idList(row.hosts),
        shape,
        // content-rows.md: count is the expected number per standard map at wealth 2, x100.
        count: Math.round((isBlank(row.count) || /see below/.test(plain(row.count)) ? 0 : Number(plain(row.count))) * 100),
        length: shape === 'vein' ? size : undefined,
        radius: shape === 'cluster' ? size : undefined,
        yields: parseYields(row.yields),
        value: int(row.value),
        color: id(row.color),
        deepsilver: isDeepsilver ? true : undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
    }),
  );
}

export function exportGems() {
  const tables = readTables(join(CONTENT_DIR, 'minerals-and-metals.md'));
  const rows = asObjects(findTable(tables, 'Gems', 'hosts'));
  const materialRows = readTables(join(CONTENT_DIR, 'materials.md'));
  const base = new Map(
    asObjects(findTable(materialRows, 'Gems (rough and cut')).map((r) => [plain(r.id), r]),
  );
  return byId(
    rows.map((row) => {
      const gid = plain(row.id);
      const b = base.get(gid) ?? {};
      const cavernOnly = /cavern/i.test(plain(row.hosts));
      return compact({
        id: gid,
        name: plain(b.name ?? gid),
        class: 'gem',
        hosts: cavernOnly ? [] : idList(row.hosts),
        count: Math.round(Number(plain(row.count)) * 100),
        cavernOnly: cavernOnly ? true : undefined,
        value: int(b.value),
        color: id(b.color),
      });
    }),
  );
}

function parseAlloy(cell) {
  if (isBlank(cell)) return undefined;
  const s = String(cell ?? '');
  const arrow = s.split('→');
  if (arrow.length < 2) return undefined;
  const inputs = arrow[0]
    .split('+')
    .map((part) => part.trim())
    .filter((p) => p.length > 0)
    .map((part) => {
      const count = int(part, 1);
      const named = id(part);
      if (named !== null && !/flux|fuel/.test(part)) {
        return { material: named, count, kind: 'bar' };
      }
      if (/flux/.test(part)) return { material: 'flux', count, kind: 'stone' };
      return { material: 'fuel', count, kind: 'fuel' };
    });
  return { inputs, output: int(arrow[1], 1) };
}

export function exportMetals() {
  const tables = readTables(join(CONTENT_DIR, 'minerals-and-metals.md'));
  const rows = asObjects(findTable(tables, 'Metals', 'tier'));
  return byId(
    rows.map((row) => {
      const notes = plain(row.notes);
      const tags = [];
      if (/magma-safe/.test(notes)) tags.push('magma_safe');
      if (/alloy input/.test(notes)) tags.push('alloy_input');
      return compact({
        id: plain(row.id),
        name: plain(row.name),
        class: 'metal',
        tier: int(row.tier),
        value: int(row['value (bar)']),
        density: int(row.density),
        weaponMult: fixed(row.weaponMult),
        armorMult: fixed(row.armorMult),
        bluntBonus: percent(row.bluntBonus),
        meltsAtC: int(row.meltsAtC),
        color: id(row.color),
        alloy: parseAlloy(row['alloy inputs (→ output)']),
        armorWeightMult: /armor weight halved/.test(notes) ? 500 : undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
    }),
  );
}

export function exportGeologyTemplates() {
  const tables = readTables(join(CONTENT_DIR, 'minerals-and-metals.md'));
  const out = [];
  for (const name of ['Sedimentary', 'Igneous', 'Metamorphic']) {
    const table = findTable(tables, name, 'Order');
    const layers = asObjects(table).map((row) => {
      const [min, max] = range(row.Thickness) ?? [1, 1];
      return { material: id(row.Material), min, max };
    });
    out.push({ id: name.toLowerCase(), layers });
  }
  // "Mixed" is prose: "Alternates: `sandstone` 2-3, `slate` 2-3, ..."
  const text = readFileSync(join(CONTENT_DIR, 'minerals-and-metals.md'), 'utf8');
  const mixed = /### Mixed\s*\n\s*Alternates:\s*([^\n]*)/.exec(text);
  if (mixed === null) throw new Error('minerals-and-metals.md: no "Alternates:" line under ### Mixed');
  const layers = mixed[1]
    .split(',')
    .map((part) => part.trim())
    .filter((p) => p.length > 0)
    .map((part) => {
      const [min, max] = range(part) ?? [1, 1];
      return { material: id(part), min, max };
    })
    .filter((l) => l.material !== null);
  out.push({ id: 'mixed', layers });
  return out;
}

export function exportWealthMultipliers() {
  const tables = readTables(join(CONTENT_DIR, 'minerals-and-metals.md'));
  const rows = asObjects(findTable(tables, 'Wealth multiplier', 'Wealth'));
  return rows.map((row) => ({
    wealth: int(row.Wealth),
    ore: fixed(row['Ore count multiplier']),
    gem: fixed(row['Gem count multiplier']),
    deepsilverVeins: int(row['Deepsilver veins']),
  }));
}

export function exportFluxStones() {
  // minerals-and-metals.md § Flux: "Stones tagged `flux`: `limestone`, `dolomite`, `marble`, `chalk`."
  const text = readFileSync(join(CONTENT_DIR, 'minerals-and-metals.md'), 'utf8');
  const m = /## Flux\s*\n\s*Stones tagged `flux`:\s*([^\n.]*)/.exec(text);
  if (m === null) throw new Error('minerals-and-metals.md: no flux stone list');
  return ticked(m[1]);
}

export { bool };
