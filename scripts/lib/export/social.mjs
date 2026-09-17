// docs/03-content/personality-and-thoughts.md and names.md -> personality, thoughts, names.

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
  readTables,
} from '../md-tables.mjs';

/** "negatives ×0.5", "social ×2, `lonely` ×2", "room thoughts ×0.5 both ways". */
function parseScales(cell) {
  const out = [];
  for (const part of plain(cell).split(',')) {
    const m = /([a-z_ ]+?)\s*[×x]\s*([\d.]+)/.exec(part.trim());
    if (m === null) continue;
    out.push({
      group: m[1].trim().replace(/\s+thoughts$/, '').replace(/\s+/g, '_'),
      mult: Math.round(Number(m[2]) * 1000),
    });
  }
  return out;
}

export function exportPersonality() {
  const tables = readTables(join(CONTENT_DIR, 'personality-and-thoughts.md'));
  const table = findTable(tables, 'Personality traits', 'pair');
  return byId(
    asObjects(table).map((row) => ({
      id: plain(row.id),
      name: plain(row.name),
      pair: plain(row.pair),
      freq: int(row.freq),
      base: int(row.base),
      scales: parseScales(row['groups scaled']),
      description: unquote(row['description shown']),
    })),
  );
}

function unquote(cell) {
  const s = String(cell ?? '').trim();
  const m = /^"([\s\S]*)"$/.exec(s);
  return m === null ? plain(s) : m[1];
}

const THOUGHT_SECTIONS = [
  ['Standing needs (group `need`)', 'need'],
  ['Standing conditions', null],
  ['Food and drink', null],
  ['Sleep', null],
  ['Social and comfort', null],
  ['Work and skill', null],
  ['Weather', null],
  ['Loss and fear', null],
  ['Pride and relief', null],
];

/** personality-and-thoughts.md § Announcement flags. */
const ANNOUNCED = new Set(['made_masterwork', 'legendary', 'hearth_lit', 'raid_repelled', 'argued']);

/**
 * A trigger cell is either an event name with a qualifier ("`MealEaten` easy") or a condition in
 * words ("hunger >= 50"). Both shapes of `ThoughtDef.trigger` in content-rows.md are produced.
 */
function parseTrigger(cell) {
  const raw = plain(cell);
  const event = /\b([A-Z][A-Za-z]+)\b/.exec(raw);
  if (event === null) return { condition: raw };
  const rest = raw.slice((event.index ?? 0) + event[1].length).trim();
  return compact({ event: event[1], target: rest.length > 0 ? rest : 'self' });
}

export function exportThoughts() {
  const tables = readTables(join(CONTENT_DIR, 'personality-and-thoughts.md'));
  const out = [];
  for (const [heading, defaultGroup] of THOUGHT_SECTIONS) {
    const table = findTable(tables, heading, 'trigger');
    for (const row of asObjects(table)) {
      const tid = plain(row.id);
      if (!/^[a-z][a-z0-9_]*$/.test(tid)) continue;
      const valueCell = plain(row.value);
      const numeric = /^[+-]?\d+$/.test(valueCell.replace(/\s/g, ''));
      const hoursCell = plain(row.hours ?? '');
      out.push(
        compact({
          id: tid,
          name: tid.replace(/_/g, ' '),
          text: unquote(row.text),
          value: numeric ? int(valueCell) : { formula: valueCell },
          hours: hoursCell === '' || hoursCell === '—' || hoursCell === 'standing' ? null : int(hoursCell),
          decay: isBlank(row.decay) ? 'standing' : plain(row.decay),
          cap: isBlank(row.cap) ? 1 : int(row.cap, 1),
          group: isBlank(row.group) ? (defaultGroup ?? 'none') : plain(row.group),
          trigger: parseTrigger(row.trigger),
          announce: ANNOUNCED.has(tid),
        }),
      );
    }
  }
  return byId(out);
}

// ---------- names ----------

function listAfter(text, label) {
  const re = new RegExp(`\\*\\*${label}[^*]*\\*\\*\\s*([^\\n]*)`);
  const m = re.exec(text);
  if (m === null) throw new Error(`names.md: no list for "${label}"`);
  return m[1]
    .replace(/\.$/, '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function exportNames() {
  const text = readFileSync(join(CONTENT_DIR, 'names.md'), 'utf8');
  const tables = readTables(join(CONTENT_DIR, 'names.md'));

  const regionFlavor = {};
  for (const row of asObjects(findTable(tables, 'Region names', 'Flavor words'))) {
    regionFlavor[plain(row['Biome group']).replace(/,\s*/g, '|')] = plain(row['Flavor words'])
      .split(',')
      .map((s) => s.trim());
  }
  const landform = {};
  for (const row of asObjects(findTable(tables, 'Region names', 'Landform'))) {
    landform[plain(row.Landform)] = plain(row.Words)
      .split(',')
      .map((s) => s.trim());
  }

  const animals = /## Animal names\s*\n\s*[^:]*:\s*([^\n]*)/.exec(text);
  const squads = /## Squad names \(defaults\)\s*\n\s*([^\n]*)/.exec(text);
  const gloam = /Gloam prefix \(([^)]*)\)/.exec(text);
  const needsSpace = /"needs space":\s*([^)]*)\)/.exec(text);

  return {
    givenA: listAfter(text, 'List A'),
    givenB: listAfter(text, 'List B'),
    shared: listAfter(text, 'Shared'),
    hallFirst: listAfter(text, 'First'),
    hallSecond: listAfter(text, 'Second'),
    fortressPrefix: listAfter(text, 'Prefix'),
    fortressSuffix: listAfter(text, 'Suffix'),
    needsSpace:
      needsSpace === null
        ? []
        : needsSpace[1].split(',').map((s) => s.trim().replace(/\s*→.*$/, '')).filter(Boolean),
    regionFlavor,
    landform,
    animals: animals === null ? [] : animals[1].replace(/\.$/, '').split(',').map((s) => s.trim()),
    dishes: {
      easy: ['stew', 'mash', 'broth', 'fry'],
      fine: ['roast', 'pie', 'pottage', 'hash'],
      lavish: ['feast', 'banquet', 'glory', 'delight'],
    },
    squads:
      squads === null
        ? []
        : squads[1]
            .replace(/\.\s*The player renames freely\.?/, '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    gloamPrefix: gloam === null ? [] : gloam[1].split(',').map((s) => s.trim()),
  };
}

export { id, isBlank };
