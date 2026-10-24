// docs/03-content/deep-intro.md -> deepIntro (colors, cycles, inks, parts, scenes, layers, camera,
// effects, captions, art); the captions' texts go to strings.json as `deep_intro.<id>`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_DIR, asObjects, findTable, id, int, isBlank, plain, readTables, ticked } from '../md-tables.mjs';

const FILE = () => join(CONTENT_DIR, 'deep-intro.md');

/** "8,11" or "-2,11" into [8, 11]. */
function cell(text, where) {
  const m = /^(-?\d+)\s*,\s*(-?\d+)$/.exec(plain(text));
  if (m === null) throw new Error(`deep-intro.md: "${text}" is not a cell (${where})`);
  return [Number(m[1]), Number(m[2])];
}

/** A number, whole or decimal. */
function num(text, where) {
  const s = plain(text);
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`deep-intro.md: "${text}" is not a number (${where})`);
  return Number(s);
}

/** The one character written between backticks. */
function one(text, where) {
  const t = ticked(text);
  if (t.length !== 1) throw new Error(`deep-intro.md: "${text}" is not one ticked character (${where})`);
  return t[0];
}

function textOf(value) {
  const s = String(value ?? '').trim();
  const q = /^"([\s\S]*)"$/.exec(s);
  return q === null ? plain(s) : q[1];
}

/** Each `### \`id\`` of § Art with the rows of the fenced block under it. */
function exportArt() {
  const text = readFileSync(FILE(), 'utf8').replace(/\r\n/g, '\n');
  const at = text.indexOf('\n## Art');
  if (at < 0) throw new Error('deep-intro.md: no Art section');
  const out = [];
  for (const m of text.slice(at).matchAll(/^### `([a-z0-9_]+)`\n\n```\n([\s\S]*?)```/gm)) {
    const rows = m[2].split('\n');
    rows.pop(); // the newline before the closing fence
    out.push({ id: m[1], rows: rows.map((row) => row.trimEnd()) });
  }
  if (out.length === 0) throw new Error('deep-intro.md: no art parsed');
  return out;
}

export function exportDeepIntroCaptions() {
  const table = findTable(readTables(FILE()), 'Captions', 'Text');
  return asObjects(table).map((row) => {
    const caption = { id: id(row.id), scene: id(row.Scene), from: int(row.From), until: int(row.Until) };
    caption.text = textOf(row.Text);
    return caption;
  });
}

export function exportDeepIntro() {
  const tables = readTables(FILE());
  const colors = asObjects(findTable(tables, 'Colors', 'Hex')).map((row) => ({ id: id(row.id), hex: plain(row.Hex) }));
  const cycles = asObjects(findTable(tables, 'Cycles', 'Drift')).map((row, n) => ({
    id: id(row.id),
    colors: ticked(row.Colors),
    step: int(row['Step (ms)']),
    drift: cell(row.Drift, `cycle ${n + 1}`),
  }));
  const inks = asObjects(findTable(tables, 'Inks', 'Glyph')).map((row, n) => {
    const where = `ink ${n + 1}`;
    const ink = { ink: one(row.Ink, where), glyph: one(row.Glyph, where), fg: id(row.Fg), bg: id(row.Bg) };
    if (!isBlank(row['Density (%)'])) ink.density = int(row['Density (%)']);
    return ink;
  });
  const parts = asObjects(findTable(tables, 'Parts', 'Inks')).map((row) => ({ part: id(row.Part), inks: ticked(row.Inks) }));
  const scenes = asObjects(findTable(tables, 'Scenes', 'Fill')).map((row, n) => ({
    id: id(row.id),
    ms: int(row.ms),
    fill: one(row.Fill, `scene ${n + 1}`),
  }));
  const layers = asObjects(findTable(tables, 'Layers', 'Depth')).map((row, n) => {
    const where = `layer ${n + 1}`;
    const layer = { scene: id(row.Scene), sprite: ticked(row.Art), at: cell(row.At, where), from: int(row.From) };
    if (!isBlank(row.To)) layer.to = cell(row.To, where);
    if (!isBlank(row.Arrive)) layer.arrive = int(row.Arrive);
    if (!isBlank(row.Until)) layer.until = int(row.Until);
    if (!isBlank(row.Step)) layer.step = int(row.Step);
    layer.depth = isBlank(row.Depth) ? 1 : num(row.Depth, where);
    if (!isBlank(row.Tile)) layer.tile = plain(row.Tile);
    return layer;
  });
  const camera = asObjects(findTable(tables, 'Camera', 'Move')).map((row, n) => {
    const where = `camera ${n + 1}`;
    return { scene: id(row.Scene), at: int(row.At), x: num(row.X, where), y: num(row.Y, where), move: plain(row.Move) };
  });
  const effects = asObjects(findTable(tables, 'Effects', 'Effect')).map((row) => {
    const effect = { scene: id(row.Scene), effect: id(row.Effect), from: int(row.From), until: int(row.Until) };
    if (!isBlank(row.Value)) effect.value = int(row.Value);
    return effect;
  });
  const captions = exportDeepIntroCaptions().map(({ text: _text, ...rest }) => rest);
  return { colors, cycles, inks, parts, scenes, layers, camera, effects, captions, art: exportArt() };
}
