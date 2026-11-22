/**
 * T-332: what the Build, Zones, Stocks, Units, Jobs and Labors panels say for a fixed state.
 *
 * These panels were once compared with a stored cell buffer (T-M2-09). Each assertion below names
 * what a row means instead. The state: the `flat-test` fortress of seed `m2-panels` with the
 * Balanced embark, one stockpile with the Food preset and a dig designation, after two ticks.
 * Each panel draws into its own 36×40 surface through the fortress screen's panel context.
 */

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
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { surface } from './ui-fixture';

type PanelName = 'build' | 'zones' | 'stocks' | 'units' | 'jobs' | 'labors';

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

function render(name: PanelName): string[] {
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
  return s.lines().map((line) => line.trimEnd().replace(/^ /, ''));
}

describe('T-332 panels: Build, Zones, Stocks, Units, Jobs and Labors', () => {
  beforeAll(async () => {
    game = await fixedGame();
  });

  it('Build offers the category keys, lists the chosen category with its cost and stock, and names the keys that place', () => {
    const rows = render('build');
    // The first caption is cut at its column and says so with » (its tooltip has the whole).
    expect(rows[0]).toMatch(/^\[c\] Constructio» +\[f\] Furniture/);
    expect(rows[1]).toMatch(/^\[w\] Workshops +\[m\] Mechanisms/);
    expect(rows[2]).toMatch(/^\[t\] Traps +\[s\] Special/);
    expect(rows[3]).toMatch(/^─+ Workshops ─+$/);
    // The 21 workshops of version 1 and the magma kiln (T-553), by name; the later rows follow.
    const listed = rows.slice(4, 25);
    expect(listed).toHaveLength(21);
    for (const row of listed) expect(row).toMatch(/\(\d+\)$/);
    const names = listed.map((row) => row.replace(/ {2,}.*$/, '').replace(/ 1 .*$/, ''));
    expect(names[0]).toMatch(/^Bowyer's workshop/);
    expect(names[names.length - 1]).toMatch(/^Wood furnace/);
    // The figure in brackets is how many of the first input the fortress holds, every alternative of it named and counted.
    expect(listed.find((row) => row.startsWith('Carpenter'))).toBe("Carpenter's workshop   2 logs (5)");
    expect(listed.find((row) => row.startsWith('Smelter'))).toMatch(/^Smelter +3 stone or block \(\d+\)$/);
    expect(rows[36]).toMatch(/^Material: \[x\] any \(\d+\)$/);
    // The bowyer may be built of blocks (T-549): the line says how it is built, where `[r] rotate` was.
    expect(rows[37]).toBe('Of logs: 2 logs, 200 ticks');
    expect(rows.slice(38).join(' ')).toMatch(/choose, Enter picks the\s+building to place\./);
  });

  it('Zones names the selected stockpile, its preset, one ticked category and the keys that change it', () => {
    const rows = render('zones');
    expect(rows[0]).toBe('[y] zones menu');
    expect(rows[1]).toMatch(/Selected: Stockpile #\d+ \(20 t\)/);
    expect(rows[2]).toBe('[p] Preset [Food ▼]');
    expect(rows[3]).toBe('[g] tree [q] settings');
    expect(rows[4]).toBe('[v] materials');
    expect(rows[5]).toMatch(/^► Food +\[■\]$/);
    const ticked = rows.slice(5, 23).filter((row) => row.includes('[■]'));
    expect(ticked).toHaveLength(1);
    expect(rows[6]).toMatch(/^► Drink +\[ \]$/);
    expect(rows[7]).toMatch(/^ {2}Seed +\[ \]$/);
    // The tree gives a row to the cellar line (13 § Aging in a cellar).
    expect(rows[26]).toMatch(/^Barrels wanted \[-\] +0 \[\+\]$/);
    expect(rows[27]).toMatch(/^Bags wanted {4}\[-\] +0 \[\+\]$/);
    expect(rows[28]).toMatch(/^Bins wanted {4}\[-\] +0 \[\+\]$/);
    expect(rows[29]).toMatch(/^Priority +\[-\] +5 \[\+\]$/);
    expect(rows[30]).toMatch(/^Min quality +\[-\] +0 \[\+\]$/);
    expect(rows[31]).toMatch(/^Max quality +\[-\] +5 \[\+\]$/);
    expect(rows[32]).toBe('Materials [any]  Quality 0-5');
    expect(rows[33]).toBe('Priority 5');
    expect(rows[34]).toBe('Links: none');
    expect(rows[35]).toBe('[i] link [x] unlink');
    expect(rows[36]).toBe('[c] Cellar: off');
    // The Food stockpile takes the wagon's food loose (T-676): four slots reserved by the hauls on their way.
    expect(rows[37]).toBe('Usage 4/20 tiles');
    expect(rows[38]).toBe('↑↓ select  ←→ expand  Space toggle');
    expect(rows[39]).toBe('[Del] remove zone  [e] resize');
  });

  it('Stocks lists the categories with held and wanted counts, and shows the wealth and the item keys', () => {
    const rows = render('stocks');
    expect(rows[0]).toMatch(/^\/filter: \[ _+ \]$/);
    for (const category of ['food', 'drink', 'seed', 'wood', 'bar', 'furniture', 'container', 'weapon', 'ammo', 'clothing', 'tool', 'textile', 'medical']) {
      expect(rows.some((row) => new RegExp(`^[► ] ${category} +\\d+ +\\d+ ☼$`).test(row)), category).toBe(true);
    }
    expect(rows.find((row) => row.includes(' food '))).toBe('► food                60     190 ☼');
    // A category with nothing inside has no arrow; the others can be opened.
    expect(rows.find((row) => row.includes(' ammo '))).toMatch(/^ {2}ammo/);
    expect(rows.find((row) => row.includes(' food '))).toMatch(/^► food/);
    expect(rows[37]).toBe('Wealth 1,691 ☼   (buildings 2 ☼)');
    expect(rows[38]).toBe('[f] forbid  [S-d] dump');
    expect(rows[39]).toBe('[S-m] melt  [t] to depot');
  });

  it('Units lists every dwarf with what each does, marks the cursor, and names the roster keys', () => {
    const rows = render('units');
    const dwarves = game.host.readers.of<{ list(): number[] }>('10').list();
    // T-678: the tab row first.
    expect(rows[0]).toMatch(/^\[1\] Dwarves \(\d+\) {2}\[2\] All \(\d+\)$/);
    expect(rows[1]).toBe('/filter:');
    expect(rows[2]).toMatch(/^Name +Act\.$/);
    const listed = rows.slice(3, 33).filter((row) => row !== '');
    expect(listed).toHaveLength(dwarves.length);
    // The name column is as wide as the longest name needs: whole names, the Thane's with `♦`, the glyphs in one column.
    expect(listed[0]).toMatch(/^► ?\S+ \S+(?: ♦)? +☺ Dig$/);
    for (const row of listed.slice(1)) expect(row).toMatch(/^ \S+ \S+(?: ♦)? +☺ Idle$/);
    expect(listed.filter((row) => row.includes('♦'))).toHaveLength(1);
    expect(new Set(listed.map((row) => row.indexOf('☺'))).size).toBe(1);
    expect(rows[33]).toMatch(/^─+$/);
    expect(rows[34]).toBe('[Enter] inspect  [l] labors');
    // T-424: `c` is the Civilizations letter; the centre accelerator takes Shift.
    expect(rows[35]).toBe('[c] center  [i] idle');
    expect(rows[36]).toMatch(/^\[Space\] mark {2}\[\*\] all {2}0 marked$/);
    expect(rows[37]).toBe('[t] title  [n] rename');
    expect(rows[38]).toBe('[m] squad  [w] hurt');
    expect(rows[39]).toMatch(/^sleep \d+h {2}\[\[\] earlier {2}\[\]\] later$/);
  });

  it('Jobs counts open, claimed and blocked jobs, and lists the dig order with its priority and who has it', () => {
    const rows = render('jobs');
    // The four hauls of the wagon's food to the Food stockpile (T-676) and the dig order.
    expect(rows[0]).toBe('4 open · 1 claimed · 0 blocked');
    expect(rows[1]).toMatch(/^\/filter: \[ _+ \]$/);
    expect(rows[2]).toBe('[l] labor: all');
    expect(rows[3]).toBe('[s] state: all');
    expect(rows[4]).toMatch(/^Pri Job +Who \/ reason$/);
    expect(rows[5]).toMatch(/^ 3 {2}Dig \(60,30,z32\) {2}\S+ \S+$/);
    expect(rows[34]).toBe('[Enter] center  [p] priority');
    expect(rows[35]).toBe('[x] cancel  [o] standing orders');
    expect(rows.slice(36).join(' ')).toMatch(/Labor priorities \(1-9\).*All labors at priority 5: change\s+them in the labor manager \(\[l\],\s+Enter\)\./);
  });

  it('Labors shows a column of labors and a row of marks for every dwarf, with the toggle keys', () => {
    const rows = render('labors');
    const dwarves = game.host.readers.of<{ list(): number[] }>('10').list();
    expect(rows[0]).toMatch(/^ +AnC AnT Bre But Car/);
    const listed = rows.slice(1, 36).filter((row) => row !== '');
    expect(listed).toHaveLength(dwarves.length);
    for (const row of listed) expect(row).toMatch(/^\S+ \S\. +■ +■ +■ +■ +■/);
    expect(rows[37]).toMatch(/click to toggle · shift-click:/);
    expect(rows[38]).toMatch(/whole column · \[a\] all on\/off/);
    expect(rows[39]).toBe('[Enter] labor manager: all labors');
  });

  it('shows the documented rows', () => {
    expect(render('build').join('\n')).toContain("[w] Workshops");
    expect(render('zones').join('\n')).toContain('Preset [Food');
    expect(render('units')[2]).toMatch(/Name +Act./);
    expect(render('jobs')[0]).toMatch(/open · \d+ claimed/);
  });
});
