// docs/03-content/intro.md -> intro (scenes, cues, captions, colors, art); the captions' texts
// go to strings.json as `intro.<id>`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_DIR, asObjects, findTable, id, int, isBlank, plain, readTables, ticked } from '../md-tables.mjs';

const FILE = () => join(CONTENT_DIR, 'intro.md');

/** "8,11" or "-2,11" into [8, 11]. */
function cell(text, where) {
  const m = /^(-?\d+)\s*,\s*(-?\d+)$/.exec(plain(text));
  if (m === null) throw new Error(`intro.md: "${text}" is not a cell (${where})`);
  return [Number(m[1]), Number(m[2])];
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
  if (at < 0) throw new Error('intro.md: no Art section');
  const out = [];
  for (const m of text.slice(at).matchAll(/^### `([a-z0-9_]+)`\n\n```\n([\s\S]*?)```/gm)) {
    const rows = m[2].split('\n');
    rows.pop(); // the newline before the closing fence
    out.push({ id: m[1], rows: rows.map((row) => row.trimEnd()) });
  }
  if (out.length === 0) throw new Error('intro.md: no art parsed');
  return out;
}

export function exportIntroCaptions() {
  const table = findTable(readTables(FILE()), 'Captions', 'Text');
  return asObjects(table).map((row) => ({
    id: id(row.id),
    scene: id(row.Scene),
    from: int(row.From),
    until: int(row.Until),
    text: textOf(row.Text),
  }));
}

export function exportIntro() {
  const tables = readTables(FILE());
  const scenes = asObjects(findTable(tables, 'Scenes', 'Backdrop')).map((row) => ({
    id: id(row.id),
    ms: int(row.ms),
    backdrop: id(row.Backdrop),
  }));
  const cues = asObjects(findTable(tables, 'Cues', 'Sprite')).map((row, n) => {
    const where = `cue ${n + 1}`;
    const cue = { scene: id(row.Scene), sprite: ticked(row.Sprite), at: cell(row.At, where), from: int(row.From) };
    if (!isBlank(row.Color)) cue.color = id(row.Color);
    if (!isBlank(row.To)) cue.to = cell(row.To, where);
    if (!isBlank(row.Arrive)) cue.arrive = int(row.Arrive);
    if (!isBlank(row.Until)) cue.until = int(row.Until);
    if (!isBlank(row.Step)) cue.step = int(row.Step);
    if (!isBlank(row.Effect)) cue.effect = id(row.Effect);
    return cue;
  });
  const captions = exportIntroCaptions().map(({ id: captionId, scene, from, until }) => ({ id: captionId, scene, from, until }));
  const colors = asObjects(findTable(tables, 'Colors', 'Glyph')).map((row) => ({
    glyph: ticked(row.Glyph)[0] ?? plain(row.Glyph),
    color: id(row.Color),
  }));
  return { scenes, cues, captions, colors, art: exportArt() };
}
