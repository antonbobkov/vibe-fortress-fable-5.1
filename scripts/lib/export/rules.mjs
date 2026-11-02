// docs/03-content/{skills-and-professions,jobs,buildings-and-furniture,workshops-and-recipes}.md
// -> skills, labors, jobTypes, buildings, zoneTypes, recipes.

import { join } from 'node:path';
import {
  CONTENT_DIR,
  asObjects,
  bool,
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
  ticked,
  words,
} from '../md-tables.mjs';

const ATTRIBUTE_KEYS = {
  strength: 'str',
  agility: 'agi',
  toughness: 'tou',
  endurance: 'end',
  willpower: 'wil',
  wits: 'wit',
  charm: 'cha',
};

export function exportSkills() {
  const tables = readTables(join(CONTENT_DIR, 'skills-and-professions.md'));
  const table = findTable(tables, 'Skills', 'attributes');
  return byId(
    asObjects(table).map((row) => ({
      id: plain(row.id),
      name: plain(row.name),
      labor: isBlank(row.labor) ? null : plain(row.labor),
      profession: isBlank(row.profession)
        ? null
        : plain(row.profession).replace(/\(|\)/g, '').split(' (')[0],
      military: isBlank(row.military) ? null : plain(row.military),
      attributes: words(row.attributes)
        .map((w) => ATTRIBUTE_KEYS[w.toLowerCase()])
        .filter((a) => a !== undefined),
      ...(/^no$/i.test(plain(row.embark ?? '')) ? { embark: false } : {}),
    })),
  );
}

export function exportLabors() {
  const tables = readTables(join(CONTENT_DIR, 'skills-and-professions.md'));
  const table = findTable(tables, 'Labors', 'default on');
  return byId(
    asObjects(table).map((row) => ({
      id: plain(row.id),
      name: plain(row.name),
      defaultOn: bool(row['default on'], true),
      children: /yes/i.test(plain(row.children)),
    })),
  );
}

const TOOLS = ['pick', 'axe', 'ranged', 'bucket'];

export function exportJobTypes() {
  const tables = readTables(join(CONTENT_DIR, 'jobs.md'));
  const out = [];
  for (const table of tables) {
    const heading = table.headings[table.headings.length - 1] ?? '';
    const producer = /\(producer `([a-z_]+)`\)/.exec(heading);
    if (producer === null) continue;
    for (const row of asObjects(table)) {
      const laborCell = plain(row.labor);
      const labor = /recipe/.test(laborCell)
        ? 'recipe'
        : /by category|as build/.test(laborCell)
          ? 'category'
          : (id(row.labor) ?? plain(row.labor));
      const ticksCell = plain(row.baseTicks);
      const numericTicks = /^(\d+)/.exec(ticksCell);
      const toolCell = plain(row.tool).toLowerCase();
      out.push(
        compact({
          id: plain(row.id),
          name: plain(row.name),
          labor,
          skill: isBlank(row.skill) || /recipe/.test(plain(row.skill)) ? null : id(row.skill),
          target: plain(row.target).split(' (')[0],
          workTile: plain(row.workTile).split(/[ ,(]/)[0],
          // `workshop (butcher)`: the workshop type the job is worked at.
          workshop: /^workshop \(([^)]+)\)/.exec(plain(row.workTile))?.[1],
          baseTicks: numericTicks === null ? (isBlank(ticksCell) ? 0 : ticksCell) : Number(numericTicks[1]),
          tool: TOOLS.find((t) => toolCell.startsWith(t)) ?? null,
          xp: int(row.xp),
          producer: producer[1],
          interruptible: /^yes/i.test(plain(row.interruptible)),
        }),
      );
    }
  }
  return byId(out);
}

// ---------- buildings ----------

/** "1×1", "3×3", "1×1 to 5×5 (rotatable; hinge edge chosen)". */
function parseFootprint(cell, fallback = { w: 1, h: 1, rotatable: false }) {
  if (isBlank(cell)) return fallback;
  const s = plain(cell);
  const first = /(\d+)\s*[x×]\s*(\d+)/.exec(s);
  if (first === null) return fallback;
  const all = Array.from(s.matchAll(/(\d+)\s*[x×]\s*(\d+)/g));
  const rotatable = /rotatable/.test(s);
  const out = { w: Number(first[1]), h: Number(first[2]), rotatable };
  if (all.length > 1) out.variable = { max: Number(all[all.length - 1][1]) };
  return out;
}

/** Descriptive phrases in an input cell that name an item tag rather than an item id. */
const INPUT_PHRASE_TAGS = { melee_weapons: 'weapon', blocks: 'block', weapons: 'weapon' };

/**
 * Building and recipe input lists. Alternatives are joined with "|" in the match string, which
 * the loader resolves against item ids and item tags. See docs/04-implementation/schemas/content-rows.md § Buildings.
 */
function parseInputs(cell) {
  if (isBlank(cell)) return [];
  const out = [];
  for (const chunk of String(cell ?? '').split('+')) {
    const part = plain(chunk);
    if (part.length === 0) continue;
    const marks = ticked(chunk);
    const isTiles = /w\s*[x×]\s*h/.test(part);
    if (isTiles) {
      out.push({ match: 'block', count: 'tiles' });
      continue;
    }
    const counts = /(\d+)(?:\s*[–—-]\s*(\d+))?/.exec(part.replace(/\([^)]*\)/g, ' '));
    const names =
      marks.length > 0
        ? marks
        : part
            .replace(/\([^)]*\)/g, ' ')
            .replace(/^\d+(\s*[–—-]\s*\d+)?/, '')
            .split(/,| or /)
            .map((w) => w.trim().toLowerCase().replace(/\s+/g, '_'))
            .filter((w) => /^[a-z_]+$/.test(w) && w !== 'or' && w !== 'and');
    if (names.length === 0) continue;
    const resolved = names.map((n) => INPUT_PHRASE_TAGS[n] ?? n);
    const material = /\(([a-z_ -]*(?:magma-safe|fireproof)[a-z_ -]*)\)/.test(part) ? 'any' : undefined;
    out.push(
      compact({
        match: resolved.join('|'),
        count: counts === null ? 1 : Number(counts[1]),
        material,
      }),
    );
  }
  return out;
}

function parsePassable(cell) {
  if (isBlank(cell)) return true;
  const s = plain(cell).toLowerCase();
  if (s === 'yes') return true;
  if (s === 'no') return false;
  return 'rules';
}

function parseBlocksFluid(cell) {
  if (isBlank(cell)) return false;
  const s = plain(cell).toLowerCase();
  if (s === 'yes') return true;
  if (s === 'no') return false;
  return 'rules';
}

function parseLabor(cell) {
  const s = plain(cell).toLowerCase();
  if (s.startsWith('by material')) return 'by_material';
  // The wagon is placed at embark, not built, so its labor cell is empty.
  if (isBlank(cell)) return 'none';
  return id(cell) ?? s.split(' ')[0];
}

const IMPASSABLE_CORNER_WORKSHOPS = new Set([
  'smelter', 'forge', 'wood_furnace', 'runeforge', 'magma_smelter', 'magma_forge', 'magma_kiln',
]);

function buildingRow(row, category, extra = {}) {
  const glyphCell = plain(row.glyph ?? '');
  const patternMatch = /pattern\s*`?([a-z_]+)`?/.exec(glyphCell);
  const roomCell = plain(row.room ?? '');
  const valueCell = plain(row.value ?? '');
  const bid = plain(row.id);
  return compact({
    id: bid,
    name: plain(row.name) === '—' ? bid.replace(/_/g, ' ') : plain(row.name),
    category,
    footprint: parseFootprint(row.footprint, extra.footprint),
    on: isBlank(row.on) ? '' : plain(row.on),
    inputs: parseInputs(row.inputs),
    labor: parseLabor(row.labor),
    buildTicks: int(row.ticks ?? row.buildTicks),
    tags: words(row.tags)
      .map((t) => t.replace(/\([^)]*\)/g, '').trim())
      .filter((t) => t !== '—' && t.length > 0),
    // D-012: "item × 2" keeps the item-derived room value at double weight.
    roomValue: roomCell === '' || roomCell === '—' ? 0 : /item/.test(roomCell) ? (/× ?2/.test(roomCell) ? 'item_x2' : 'item') : int(roomCell),
    passable: parsePassable(row.pass),
    blocksFluid: parseBlocksFluid(row.fluid),
    value: /item/.test(valueCell) ? 0 : int(valueCell),
    glyph: patternMatch === null ? (glyph(row.glyph) ?? undefined) : undefined,
    pattern: patternMatch === null ? extra.pattern : patternMatch[1],
    impassableTiles: extra.impassableTiles,
    workTile: extra.workTile,
    outputTile: extra.outputTile,
    magmaVariantOf: extra.magmaVariantOf,
  });
}

export function exportBuildings() {
  const tables = readTables(join(CONTENT_DIR, 'buildings-and-furniture.md'));
  const out = [];
  const sections = [
    ['Constructions', 'construction'],
    ['Furniture placements (consume the item)', 'furniture'],
    ['Mechanisms', 'mechanism'],
    ['Traps', 'trap'],
    ['Special', 'special'],
  ];
  for (const [heading, category] of sections) {
    for (const row of asObjects(findTable(tables, heading, 'inputs'))) {
      if (!/^[a-z][a-z0-9_]*$/.test(plain(row.id))) continue;
      if (/not a building/.test(row.__cells.join(' '))) continue;
      out.push(buildingRow(row, category));
    }
  }

  // Workshops: "All workshops are 3x3 with the work tile at the center and the output tile at the
  // south-center"; the impassable corners are listed in buildings-and-furniture.md § Workshops.
  const wsTables = readTables(join(CONTENT_DIR, 'workshops-and-recipes.md'));
  for (const row of asObjects(findTable(wsTables, 'Workshops', 'glyph pattern'))) {
    const wid = plain(row.id);
    out.push(
      buildingRow({ ...row, pass: 'yes', fluid: 'no', room: '0', value: '0' }, 'workshop', {
        footprint: { w: 3, h: 3, rotatable: false },
        pattern: id(row['glyph pattern']) ?? wid,
        workTile: 4,
        outputTile: 7,
        impassableTiles: IMPASSABLE_CORNER_WORKSHOPS.has(wid) ? [0, 2, 6, 8] : undefined,
      }),
    );
  }
  const magmaTable = wsTables.find((t) => t.header.map(plain).includes('variant of'));
  if (magmaTable !== undefined) {
    for (const row of asObjects(magmaTable)) {
      const wid = plain(row.id);
      const variantOf = id(row['variant of']);
      out.push(
        buildingRow({ ...row, pass: 'yes', fluid: 'no', room: '0', value: '0', tags: 'magma' }, 'workshop', {
          footprint: { w: 3, h: 3, rotatable: false },
          // magma_kiln has no pattern: it is reserved for a later version and hidden.
          pattern: variantOf ?? undefined,
          workTile: 4,
          outputTile: 7,
          impassableTiles: IMPASSABLE_CORNER_WORKSHOPS.has(wid) ? [0, 2, 6, 8] : undefined,
          magmaVariantOf: variantOf ?? undefined,
        }),
      );
    }
  }
  return byId(out);
}

export function exportZoneTypes() {
  const tables = readTables(join(CONTENT_DIR, 'buildings-and-furniture.md'));
  const table = findTable(tables, 'Zone types', 'consumers');
  return byId(
    asObjects(table).map((row) => ({
      id: plain(row.id),
      name: plain(row.name),
      room: /yes/i.test(plain(row.room)),
      requirements: words(row['requirements to count']).filter((w) => w !== '—'),
      settings: words(row.settings).filter((w) => w !== '—'),
      consumers: words(row.consumers).filter((w) => w !== '—'),
    })),
  );
}

export function exportRoomTiers() {
  const tables = readTables(join(CONTENT_DIR, 'buildings-and-furniture.md'));
  const table = findTable(tables, 'Room quality tiers', 'Score');
  return asObjects(table).map((row, i) => ({
    tier: i,
    id: plain(row.Tier),
    score: int(row.Score),
  }));
}

// ---------- recipes ----------

// [heading, workshop id, default skill, fuel, default quality]
// workshops-and-recipes.md § Forge: "all `Q` yes unless noted; `fuel` yes", and the forge table
// carries no Q column of its own.
const RECIPE_SECTIONS = [
  ['Carpenter', 'carpenter', 'carpentry', false, false],
  ['Mason', 'mason', 'masonry', false, false],
  ['Craftsdwarf', 'craftdwarf', 'crafting', false, false],
  ['Jeweler', 'jeweler', 'gem_cutting', false, false],
  ['Mechanic', 'mechanic', 'mechanics', false, false],
  ['Wood furnace', 'wood_furnace', 'smelting', false, false],
  ['Forge', 'forge', 'metalcrafting', true, true],
  ['Kitchen', 'kitchen', 'cooking', false, false],
  ['Still', 'still', 'brewing', false, false],
  // 25 § Draughts: the laboratory's draughts, a table of their own under § Laboratory.
  ['Draughts', 'alchemist', 'alchemy', false, true],
  ['Tannery', 'tannery', 'tanning', false, false],
  ['Leatherworks', 'leatherworks', 'leatherworking', false, false],
  ['Loom', 'loom', 'weaving', false, false],
  ['Clothier', 'clothier', 'clothesmaking', false, false],
  ["Farmer's workshop", 'farmers_workshop', 'farming', false, false],
  ['Bowyer', 'bowyer', 'carpentry', false, false],
  ['Laboratory', 'alchemist', 'alchemy', false, false],
];

/** Material classes; an output note naming one is a class hint, not a fixed material. */
const MATERIAL_CLASS_WORDS = new Set([
  'stone', 'soil', 'ore', 'gem', 'metal', 'wood', 'plant', 'leather_class', 'cloth', 'bone',
  'shell', 'glass', 'ice', 'meat', 'liquid', 'obsidian',
]);

/**
 * "1 bed (from_input)", "1 leather_piece (`leather`)", "20 drink (species' drink material)",
 * "2 stone_block (metal; used as `block`)".
 * workshops-and-recipes.md: "`from_input` means the output takes the material of the first
 * input", which is also the default when the note says nothing about the material.
 */
function parseOutputs(cell) {
  if (isBlank(cell)) return [];
  const out = [];
  for (const chunk of String(cell ?? '').split(' + ')) {
    const part = chunk.trim();
    const paren = /\(([\s\S]*)\)/.exec(part);
    const bare = plain(part).replace(/\([^)]*\)/g, ' ');
    const m = /(\d+)\s+([a-z_]+)/.exec(bare);
    if (m === null) continue;
    const note = paren === null ? '' : paren[1];
    const head = note.split(';')[0].trim();
    const tick = /^`([a-z_]+)`$/.exec(head);
    let material = { from: 'input', index: 0 };
    if (m[2] === 'charcoal_bar') {
      material = { fixed: 'charcoal' };
    } else if (/matching\s+.*material/.test(note)) {
      material = { from: 'input', index: 0, stage: 'next' };
    } else if (/drink material/.test(note)) {
      material = { plantDrink: true };
    } else if (tick !== null) {
      material = { fixed: tick[1] };
    } else if (/^[a-z_]+$/.test(head) && head !== 'from_input' && !MATERIAL_CLASS_WORDS.has(head)) {
      material = { fixed: head };
    }
    out.push({ item: m[2], count: Number(m[1]), material });
  }
  return out;
}

function recipeInputs(cell) {
  if (isBlank(cell)) return { inputs: [], container: undefined };
  let container;
  const parts = [];
  for (const chunk of plain(cell).split('+')) {
    const part = chunk.trim();
    if (part.length === 0) continue;
    const cm = /container\s+([a-z_]+)/.exec(part);
    if (cm !== null) {
      container = cm[1];
      continue;
    }
    const bare = part.replace(/\([^)]*\)/g, ' ').trim();
    const alt = /(\d+)\s+([a-z_]+)\s+or\s+(?:(\d+)\s+)?([a-z_]+)/.exec(bare);
    let count = 1;
    let match = '';
    if (alt !== null) {
      count = Number(alt[1]);
      match = `${alt[2]}|${alt[4]}`;
    } else {
      const m = /(\d+)\s+([a-z_]+)/.exec(bare);
      if (m === null) continue;
      count = Number(m[1]);
      match = m[2];
    }
    const paren = /\(([^)]*)\)/.exec(part);
    const note = paren === null ? '' : paren[1].trim();

    const distinct = /distinct/.test(note) ? true : undefined;
    const sameMaterial = /same material/.test(note) ? true : undefined;
    let materialProperty;
    if (/brewable species/.test(note)) materialProperty = 'brewable';
    else if (/magma-safe metal/.test(note)) materialProperty = 'magma_safe';

    let material;
    let materials;
    if (materialProperty === undefined && !sameMaterial) {
      const materialIds = Array.from(note.matchAll(/`?\b([a-z][a-z_]{2,})\b`?/g)).map((x) => x[1]);
      const filtered = materialIds.filter(
        (x) => !['distinct', 'stacks', 'species', 'brewable', 'metal', 'safe', 'magma', 'or', 'same', 'material'].includes(x),
      );
      if (filtered.length === 1) {
        material = filtered[0];
      } else if (filtered.length > 1) {
        materials = filtered;
      }
    }

    parts.push(
      compact({
        match,
        count,
        material,
        materials,
        materialProperty,
        sameMaterial,
        distinct,
      }),
    );
  }
  return { inputs: parts, container };
}

export function exportRecipes() {
  const tables = readTables(join(CONTENT_DIR, 'workshops-and-recipes.md'));
  const out = [];
  for (const [heading, workshop, defaultSkill, fuel, defaultQuality] of RECIPE_SECTIONS) {
    const table = tables.find(
      (t) =>
        (t.headings[t.headings.length - 1] ?? '').startsWith(heading) &&
        t.header.map(plain).includes('outputs'),
    );
    if (table === undefined) throw new Error(`workshops-and-recipes.md: no recipe table for ${heading}`);
    for (const row of asObjects(table)) {
      const rid = id(row.id);
      if (rid === null || !/^[a-z][a-z0-9_]*$/.test(rid)) continue;
      if (/not a recipe/.test(plain(row.name) + plain(row.inputs))) continue;
      const ticksCell = plain(row.ticks);
      const skillOverride = /skill\s*`?([a-z_]+)`?/.exec(ticksCell);
      const { inputs, container } = recipeInputs(row.inputs);
      const outputs = parseOutputs(row.outputs);
      if (outputs.length === 0) continue;
      const outContainer = /in the ([a-z_]+)/.exec(plain(row.outputs));
      out.push(
        compact({
          id: rid,
          name: plain(row.name),
          workshop,
          skill: id(row.skill) ?? skillOverride?.[1] ?? defaultSkill,
          inputs,
          outputs,
          baseTicks: int(ticksCell),
          fuel,
          quality: isBlank(row.Q) ? defaultQuality : /^yes/i.test(plain(row.Q)),
          spoilable: /^yes/i.test(plain(row.spoilable ?? '')) ? true : undefined,
          container: container ?? outContainer?.[1],
          xp: int(row.xp),
        }),
      );
    }
  }
  return byId(out);
}
