/**
 * Golden render: the T-M2-09 panels drawn for a fixed state.
 *
 * `05-plan/M2-things.md` T-M2-09: "each panel renders a golden cell buffer for a fixed state".
 * The state: the `flat-test` fortress of seed `m2-panels` with the Balanced embark, one stockpile
 * with the Food preset and a dig designation, after one tick. Each panel draws into its own 36×40
 * surface through the fortress screen's panel context. Rewritten only by
 * `npm run golden:update -- render/m2-panels`.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { loadContent } from '@content/loader';
import { TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import { Game } from '@app/game';
import { drawBuildPanel } from '@ui/panels/build';
import { drawJobsPanel } from '@ui/panels/jobs';
import { drawLaborsPanel } from '@ui/panels/labors';
import { drawStocksPanel } from '@ui/panels/stocks';
import { drawUnitsPanel } from '@ui/panels/units';
import { drawZonesPanel } from '@ui/panels/zones';
import type { Surface } from '@ui/surface';
import { MockCanvas, mockCanvasFactory } from '../../unit/render/canvas-mock';
import { cellRows, surface } from '../../unit/ui/ui-fixture';

const GOLDEN_NAME = 'render/m2-panels';
const file = fileURLToPath(new URL('./m2-panels.json', import.meta.url));
const update = process.env['DEEPHOLM_GOLDEN_UPDATE'] === GOLDEN_NAME || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';

interface PanelGolden {
  text: string[];
  cells: string[][];
}

const PANELS = ['build', 'zones', 'stocks', 'units', 'jobs', 'labors'] as const;

let game: Game;

async function fixedGame(): Promise<Game> {
  const g = new Game({ canvas: new MockCanvas(), seed: 'm2-panels', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await g.start({ embark: 'default' });
  const map = g.host.readers.map;
  const z = g.ui.z;
  const tiles: number[] = [];
  for (let y = 30; y < 34; y += 1) for (let x = 40; x < 45; x += 1) tiles.push(map.index(x, y, z));
  g.host.submit({ type: 'CreateZone', zoneType: 'stockpile', tiles });
  const wall = map.index(60, 30, z);
  g.host.headless.world.services.terrain.setKind(wall, TileKind.Wall, 1);
  g.host.submit({ type: 'Designate', tiles: [wall], kind: 'dig', priority: 3 });
  g.host.step(1);
  const zoneId = g.host.readers.of<BuildingsReader>('14').zoneAt(tiles[0] as number);
  g.host.submit({ type: 'SetStockpileFilter', zoneId, filter: 'food' });
  g.host.step(1);
  g.fortress.zones.selected = zoneId;
  g.fortress.build.choose('w');
  return g;
}

function render(name: (typeof PANELS)[number]): PanelGolden {
  const s: Surface = surface(36, 40);
  const rect = { col: 0, row: 0, cols: 36, rows: 40 };
  const f = game.fortress;
  const ctx = f.ctx;
  if (name === 'build') drawBuildPanel(s, rect, f.build, ctx);
  else if (name === 'zones') drawZonesPanel(s, rect, f.zones, ctx);
  else if (name === 'stocks') drawStocksPanel(s, rect, f.stocks, ctx);
  else if (name === 'units') drawUnitsPanel(s, rect, f.units, ctx);
  else if (name === 'jobs') drawJobsPanel(s, rect, f.jobs, ctx);
  else drawLaborsPanel(s, rect, f.labors, ctx);
  return { text: s.lines(), cells: cellRows(s) };
}

const golden: Record<string, PanelGolden> = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { panels: Record<string, PanelGolden> }).panels : {};

describe('T-M2-09 golden: the panels in cells for a fixed state', () => {
  beforeAll(async () => {
    game = await fixedGame();
    if (update) {
      const next: Record<string, PanelGolden> = {};
      for (const name of PANELS) next[name] = render(name);
      writeFileSync(file, `${JSON.stringify({ $note: 'npm run golden:update -- render/m2-panels', panels: next }, null, 2)}\n`, 'utf8');
      Object.assign(golden, next);
    }
  });
  for (const name of PANELS) {
    it(`${name} matches test/golden/render/m2-panels.json`, () => {
      expect(golden[name]).toBeDefined();
      expect(render(name)).toEqual(golden[name]);
    });
  }
  it('shows the documented rows', () => {
    expect(render('build').text.join('\n')).toContain("[w] Workshops");
    expect(render('zones').text.join('\n')).toContain('Preset [Food');
    expect(render('units').text[1]).toMatch(/Name +Prof. +Act./);
    expect(render('jobs').text[0]).toMatch(/open · \d+ claimed/);
  });
});
