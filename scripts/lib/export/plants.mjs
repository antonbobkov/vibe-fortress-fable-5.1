// docs/03-content/plants.md -> plants.

import { join } from 'node:path';
import {
  CONTENT_DIR,
  asObjects,
  byId,
  compact,
  findTable,
  glyph,
  id,
  int,
  isBlank,
  plain,
  range,
  readTables,
  seasons,
  ticked,
  weighted,
} from '../md-tables.mjs';

// D-009: plants.md gives no temperature band for wild shrubs and trees; the widest band is used
// so that no plant is blocked by a limit the document does not state.
const NO_TEMPERATURE_LIMIT = [-100, 100];

/** "cavern 1 (60), cavern 2 (40)" -> [{ tier, weight }]. */
function parseCaverns(cell) {
  const out = [];
  for (const m of plain(cell).matchAll(/cavern\s+(\d)\s*\((\d+)\)/g)) {
    out.push({ tier: Number(m[1]), weight: Number(m[2]) });
  }
  return out.length > 0 ? out : undefined;
}

function parseBiomes(cell) {
  const entries = weighted(plain(cell).replace(/cavern\s+\d\s*\(\d+\)/g, ' '))
    .filter((w) => w.key !== 'cavern')
    .map((w) => ({ biome: w.key, weight: w.weight }));
  return entries.length > 0 ? entries : undefined;
}

function cropRow(row, kind) {
  const yieldItemCell = plain(row.yieldItem);
  const marks = ticked(row.yieldItem);
  const secondary = ticked(row.secondary);
  const brewIds = ticked(row.brew);
  return compact({
    id: plain(row.id),
    name: plain(row.name),
    kind,
    stageDays: int(row.stageDays),
    seasons: kind === 'crop' ? (seasons(row.seasons) ?? undefined) : undefined,
    light: isBlank(row.light) ? 'any' : plain(row.light),
    minC: int(row.minC),
    maxC: int(row.maxC),
    yield: range(row.yield) ?? undefined,
    yieldItem: marks[0] ?? (yieldItemCell === '' ? undefined : yieldItemCell),
    yieldMaterial: marks[1],
    value: int(row.value),
    edible: /yes/i.test(plain(row.edible)),
    cookable: /yes/i.test(plain(row.cookable)),
    brew: brewIds[0],
    secondary: secondary.length > 0 ? { item: secondary[0], count: 1 } : undefined,
  });
}

export function exportPlants() {
  const tables = readTables(join(CONTENT_DIR, 'plants.md'));
  const out = [];

  for (const row of asObjects(findTable(tables, 'Surface crops', 'stageDays'))) {
    out.push({ ...cropRow(row, 'crop'), glyph: glyph(row.glyph), fg: id(row.fg) });
  }
  for (const row of asObjects(findTable(tables, 'Cave crops', 'stageDays'))) {
    out.push({ ...cropRow(row, 'cave_crop'), glyph: glyph(row.glyph), fg: id(row.fg) });
  }

  for (const row of asObjects(findTable(tables, 'Wild shrubs', 'regrowDays'))) {
    const product = plain(row.product);
    const marks = ticked(row.product);
    const valueMatch = /value\s+(\d+)/.exec(product);
    const brewMatch = /brew\s+`([a-z_]+)`/.exec(product);
    const caverns = parseCaverns(row['biomes (weight)']);
    out.push(
      compact({
        id: plain(row.id),
        name: plain(row.name),
        kind: 'shrub',
        light: caverns === undefined ? 'sun' : 'dark',
        minC: NO_TEMPERATURE_LIMIT[0],
        maxC: NO_TEMPERATURE_LIMIT[1],
        yield: range(row.count) ?? undefined,
        yieldItem: marks[0],
        yieldMaterial: marks[1],
        value: valueMatch === null ? 0 : Number(valueMatch[1]),
        edible: /edible/.test(product),
        cookable: /cookable/.test(product),
        brew: brewMatch === null ? undefined : brewMatch[1],
        regrowDays: int(row.regrowDays),
        wildSeedPermille: int(row.wildSeedPermille),
        seedOf: id(row['seed of']) ?? undefined,
        biomes: parseBiomes(row['biomes (weight)']),
        caverns,
        glyph: glyph(row.glyph),
        fg: id(row.fg),
      }),
    );
  }

  // Trees: the species value is the value of its wood material (materials.md § Wood).
  // The prose under the tree table adds biome weights the table does not carry: "Tropical forest
  // and savanna use `oak` (as "broadleaf") with weight 40 and `ash` 20; desert and badlands have
  // ... `pine` only" (docs/04-implementation/algorithms/local-map-generation.md). Pine's weight there is 1: it is the only species.
  const PROSE_TREE_BIOMES = {
    oak: [{ biome: 'tropical_forest', weight: 40 }, { biome: 'savanna', weight: 40 }],
    ash: [{ biome: 'tropical_forest', weight: 20 }, { biome: 'savanna', weight: 20 }],
    pine: [{ biome: 'desert', weight: 1 }, { biome: 'badlands', weight: 1 }],
  };
  const woodValues = woodValueById();
  for (const row of asObjects(findTable(tables, 'Trees', 'saplingYears'))) {
    const tid = plain(row.id);
    const caverns = parseCaverns(row['biomes (weight)']);
    const tableBiomes = parseBiomes(row['biomes (weight)']);
    const biomes = tableBiomes === undefined ? undefined : [...tableBiomes, ...(PROSE_TREE_BIOMES[tid] ?? [])];
    out.push(
      compact({
        id: tid,
        name: plain(row.name),
        kind: caverns !== undefined && tableBiomes === undefined ? 'fungus_tree' : 'tree',
        light: caverns !== undefined ? 'dark' : 'sun',
        minC: NO_TEMPERATURE_LIMIT[0],
        maxC: NO_TEMPERATURE_LIMIT[1],
        value: woodValues.get(tid) ?? 0,
        edible: false,
        cookable: false,
        logs: range(row.logs) ?? undefined,
        saplingYears: int(row.saplingYears),
        yieldItem: 'log',
        yieldMaterial: tid,
        biomes,
        caverns,
        glyph: glyph(row.glyph),
        fg: id(row.fg),
      }),
    );
  }
  return byId(out);
}

function woodValueById() {
  const tables = readTables(join(CONTENT_DIR, 'materials.md'));
  const rows = asObjects(findTable(tables, 'Wood (one per tree species'));
  return new Map(rows.map((r) => [plain(r.id), int(r.value)]));
}
