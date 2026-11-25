/**
 * T-703: a line of the 36-column sidebar never cuts the fact it is there to give
 * (`reports/data/2026-11-24-playtest.md`, finding 5). Every panel is drawn at 1280 × 800 (80 × 50
 * cells) over a fortress with long facts: a 120-tile stockpile, a farm plot with 120 seeds, 5-digit
 * stock values, long dwarf names and thoughts, a wagon full of goods. A `»` is allowed only where a
 * name is cut, and no text runs past the screen's edge or is clipped without its mark.
 */
import { describe, expect, it, vi } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsSystem } from '@systems/buildings';
import type { MoraleReader, ThoughtView } from '@systems/morale';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import type { Surface } from '@ui/surface';
import { defaultUiState } from '@ui/ui-state';
import { table } from '@ui/widgets';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const COLS = 80;
const ROWS = 50;
/** The sidebar's first column at 80 columns, the rows above the log strip, and the first of the three status rows. */
const SIDE = COLS - 36;
const MAP_ROWS = ROWS - 6;
const STATUS_ROW = ROWS - 3;

/** The dwarves' names: a name cut with `»` is the rule, not a cut fact. */
const NAMES = ['Gunnar Coalhammer', 'Ragnhild Brightvein', 'Torvald Deepshield'];

function thought(text: string, value: number): ThoughtView {
  return { id: text, text, value, remainingHours: null };
}

function setup() {
  const w = new TestWorld({ seed: 't703-fit', world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 10 * TICKS_PER_DAY });
  const dwarves: EntityId[] = NAMES.map((name, k) => w.spawnDwarf({ at: w.index(12 + k, 12, z), name, ageYears: 40 }));
  const layout = computeLayout(COLS, ROWS, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c),
    speed: () => 0, setSpeed: () => {},
    pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  // A 120-tile stockpile, a 120-tile farm plot, a pasture and a hospital.
  const rect = (x0: number, y0: number, cols: number, rows: number): number[] => Array.from({ length: cols * rows }, (_, n) => w.index(x0 + (n % cols), y0 + Math.floor(n / cols), z));
  const stockpile = w.zone('stockpile', rect(30, 30, 12, 10));
  const farm = w.zone('farm_plot', rect(50, 30, 12, 10));
  const pasture = w.zone('pasture', rect(30, 45, 10, 5));
  w.zone('hospital', rect(50, 45, 3, 3));
  w.submit({ type: 'SetPlotCrop', zoneId: farm, season: 0, speciesId: 'cabbage' });
  w.submit({ type: 'SetPlotCrop', zoneId: farm, season: 1, speciesId: 'cabbage' });
  w.step(1);
  // 120 cabbage seeds, gold bars worth five digits, and a carpenter's workshop for the Where row.
  w.spawnItem('seed', 'cabbage', w.index(31, 31, z), 120);
  w.spawnItem('bar', 'gold', w.index(32, 31, z), 99);
  w.spawnItem('bar', 'platinum', w.index(33, 31, z), 99);
  w.build('carpenter', w.index(20, 20, z), 'oak');
  w.build('craftdwarf', w.index(24, 20, z), 'granite');
  // The wagon with its medical goods and tools: lines of several entries.
  const oak = w.game.registry.table('materials').index('oak');
  const wagon = (w.game.world.scheduler.byId('14') as BuildingsSystem).buildings.placeWagon(w.index(16, 16, z), { type: 'log', material: oak, count: 3 });
  for (const [type, material, n] of [['splint', 'oak', 4], ['brightleaf', 'brightleaf', 5], ['crutch', 'oak', 2], ['bandage', 'flax', 9], ['soap', 'tallow', 3],
    ['pick', 'iron', 2], ['axe', 'iron', 1], ['bucket', 'oak', 2], ['rope', 'flax', 3]] as const) w.spawnItem(type, material, { containerId: wagon }, n);
  // Jobs to list: three walls to dig.
  for (let k = 0; k < 3; k += 1) w.carve(w.index(40 + k, 20, z), TileKind.Wall, w.game.registry.table('materials').index('granite'));
  w.submit({ type: 'Designate', kind: 'dig', tiles: [0, 1, 2].map((k) => w.index(40 + k, 20, z)), priority: 4 });
  w.step(1);
  const morale = w.readers.of<MoraleReader>('15');
  vi.spyOn(morale, 'thoughts').mockImplementation(() => [
    thought('I have not talked to anyone in a while.', -1),
    thought('I slept in the open on the cold ground.', -4),
  ]);
  return { w, screen, dwarves, stockpile, farm, pasture, wagon };
}

type Fixture = ReturnType<typeof setup>;

/** A cut found in the sidebar: the state's name and the whole text the cut row stands for. */
function scan(f: Fixture, state: string): string[] {
  const s = surface(COLS, ROWS);
  const cuts: string[] = [];
  // Text a widget writes past its width, or past the screen's edge, that it did not mark.
  const text = s.text.bind(s);
  s.text = (col, row, value, fg, bg, width = Infinity) => {
    const chars = Array.from(value);
    const kept = chars.slice(0, Math.min(width, COLS - col)).join('');
    const lost = chars.slice(kept.length).join('');
    if (col >= SIDE && row < MAP_ROWS && lost.trim() !== '' && !kept.endsWith('»')) cuts.push(`${state}: clipped "${value.trim()}"`);
    return text(col, row, value, fg, bg, width);
  };
  const put = s.put.bind(s);
  s.put = (col, row, glyph, fg, bg) => {
    if (col >= COLS && row < MAP_ROWS && glyph !== 32 && glyph !== 0) cuts.push(`${state}: past the edge at row ${row}`);
    put(col, row, glyph, fg, bg);
  };
  f.screen.draw(s);
  s.lines().forEach((line, row) => {
    // The status rows under the log strip (T-719): a message there wraps, it is never cut with `…` or `»`.
    if (row >= STATUS_ROW) {
      if (/[…»]/.test(line)) cuts.push(`${state}: status "${line.trim()}"`);
      return;
    }
    if (row >= MAP_ROWS) return;
    const side = Array.from(line).slice(SIDE);
    side.forEach((ch, k) => {
      if (ch !== '»') return;
      const tip = s.tooltipAt(SIDE + k, row);
      if (tip !== null && NAMES.includes(tip.text)) return;
      cuts.push(`${state}: ${tip === null ? side.join('').trim() : tip.text}`);
    });
  });
  return [...new Set(cuts)];
}

/**
 * The states the second playtest found cut (T-719): a room not enclosed, a planned building, a still
 * with a brewing order waiting for its plants, an alert whose reason is its last words among many log
 * lines, a dwarf hauling to the depot, long thoughts in Mood.
 */
function setup719() {
  const f = setup();
  const { w } = f;
  const rect = (x0: number, y0: number, cols: number, rows: number): number[] => Array.from({ length: cols * rows }, (_, n) => w.index(x0 + (n % cols), y0 + Math.floor(n / cols), z));
  const dining = w.zone('dining_hall', rect(10, 30, 12, 10));
  w.build('still', w.index(28, 20, z), 'oak');
  w.submit({ type: 'PlaceBuilding', buildingType: 'still', origin: w.index(32, 24, z), orientation: 0, materialChoice: 0 });
  w.submit({ type: 'AddWorkOrder', workshopId: 0, order: { recipeId: 'brew', mode: 'once', remaining: 1, threshold: 0, priority: 5 } });
  w.step(2);
  const planned = w.readers.of<import('@systems/buildings').BuildingsReader>('14').byType('still').find((id) => w.readers.of<import('@systems/buildings').BuildingsReader>('14').get(id)?.state === 'planned') ?? 0;
  // Forty-odd log lines, the missed trade among the oldest that show, an ambush among them.
  const tick = w.tick;
  const lines = f.screen.log.lines;
  lines.push({ tick, severity: 'alert', text: `The Hillfolk caravan is leaving without trading. ${strings.get('ui.trade.wait.late_any')}`, count: 1 });
  lines.push({ tick, severity: 'note', text: 'The ambush has withdrawn: 5 raiders left empty-handed.', count: 1 });
  // 39 one-row alerts above it in the Alerts tab: the missed trade starts on the list's last row.
  for (let k = 0; k < 41; k += 1) lines.push({ tick, severity: k < 39 ? 'alert' : 'note', text: k < 39 ? 'The restless dead rise.' : 'Gunnar Coalhammer is miserable.', count: 1 });
  return { ...f, dining, planned };
}

/** The status rows (under the map and the log strip) as drawn, without trailing blanks. */
function statusRows(f: Fixture): string[] {
  const s = surface(COLS, ROWS);
  f.screen.draw(s);
  return s.lines().slice(STATUS_ROW).map((line) => line.trimEnd());
}

describe('T-703 no panel at the sidebar width cuts a fact', () => {
  it('scans every panel, and the zones, build, stocks, orders, creature and building views the playtest read', () => {
    const f = setup();
    const cuts: string[] = [];
    for (const panel of f.screen.panels()) {
      f.screen.openPanel(panel.id);
      cuts.push(...scan(f, panel.id));
    }
    f.screen.openPanel('zones');
    for (const [name, id] of [['stockpile', f.stockpile], ['farm', f.farm], ['pasture', f.pasture]] as const) {
      f.screen.zones.selectZone(id);
      cuts.push(...scan(f, `zones ${name}`));
    }
    f.screen.openPanel('build');
    for (const key of ['c', 'f', 'w', 'm', 't', 's']) {
      f.screen.build.choose(key);
      cuts.push(...scan(f, `build ${key}`));
    }
    f.screen.openPanel('stocks');
    cuts.push(...scan(f, 'stocks'));
    f.screen.openPanel('jobs');
    f.screen.jobs.waitLine = () => strings.get('ui.job_wait.tool_held.one', { tool: 'pick', name: 'Ragnhild Brightvein', where: 'in the hospital' });
    cuts.push(...scan(f, 'jobs reason'));
    f.screen.openPanel('orders');
    const recipes = f.w.game.registry.table<{ id: string; workshop: string }>('recipes');
    for (const workshop of ['carpenter', 'craftdwarf']) {
      f.screen.orders.openPicker(f.screen.ctx, { recipeId: recipes.ids().find((id) => recipes.byId(id)?.workshop === workshop) as string });
      cuts.push(...scan(f, `add order ${workshop}`));
    }
    f.screen.inspectCreature(f.dwarves[0] as EntityId);
    cuts.push(...scan(f, 'creature'));
    f.screen.openBuilding(f.wagon);
    cuts.push(...scan(f, 'wagon'));
    // What may end with `»`: a name, and the labor grid's mark that more columns lie to the right.
    expect(cuts).toEqual([
      'labors: │            AnC AnT Bre But Car »',
    ]);
  });
});

/** The sidebar's rows as drawn, from the panel's first column in, without trailing blanks. */
function side(f: Fixture): { s: Surface; rows: string[] } {
  const s = surface(COLS, ROWS);
  f.screen.draw(s);
  return { s, rows: s.lines().slice(0, MAP_ROWS).map((line) => Array.from(line).slice(SIDE + 2).join('').trimEnd()) };
}

describe('T-703 the lines the playtest found cut', () => {
  it('Zones: the selected rule and the list give the tile count whole; the help and the list keys fit', () => {
    const f = setup();
    f.screen.openPanel('zones');
    let { rows } = side(f);
    expect(rows).toContain('Tab next zone · Enter settings');
    expect(rows.find((row) => row.includes('120 tiles'))).toMatch(/^Stockpile #1 .* 120 tiles$/);
    f.screen.zones.selectZone(f.stockpile);
    rows = side(f).rows;
    expect(rows.find((row) => row.includes('Stockpile #1'))).toMatch(/^─+ Stockpile #1 · 120 tiles ─+$/);
    expect(rows).toContain('↑↓ select  ←→ open  Space toggle');
  });

  it('Farm plot: the seeds in stock follow the crop as a count with its meaning in the tooltip; the crops line is whole', () => {
    const f = setup();
    f.screen.openPanel('zones');
    f.screen.zones.selectZone(f.farm);
    const { s, rows } = side(f);
    const at = rows.findIndex((row) => row.startsWith('Spring'));
    expect(rows[at]).toMatch(/^Spring +\[ cabbage +▼ \] \(120\)$/);
    const col = SIDE + 2 + (rows[at] as string).indexOf('(120)');
    expect(s.tooltipAt(col, at)?.text).toBe('120 seeds of it in stock');
    expect(rows).toContain('0 growing · 0 ripe · 120 empty');
  });

  it('Jobs: the selected job\'s reason wraps over as many rows as it needs, the holder\'s name whole', () => {
    const f = setup();
    f.screen.openPanel('jobs');
    const reason = strings.get('ui.job_wait.tool_held.one', { tool: 'pick', name: 'Ragnhild Brightvein', where: 'in the hospital' });
    f.screen.jobs.waitLine = () => reason;
    const { rows } = side(f);
    // The batch's span comes first, then the reason, whole, over five rows.
    const at = rows.findIndex((row) => row.startsWith('3 jobs over'));
    expect(at).toBeGreaterThan(0);
    const lines = rows.slice(at, at + 6);
    expect(lines.join(' ')).toBe(`3 jobs over (40,20)-(42,20), z${z}. [Enter] list them. ${reason}`);
    expect(lines.some((line) => line.includes('Ragnhild Brightvein'))).toBe(true);
    expect(rows.join('\n')).not.toContain('»');
  });

  it('Build: each category whole on its row; a workshop whose inputs do not fit wraps them under its name', () => {
    const f = setup();
    f.screen.openPanel('build');
    f.screen.build.choose('w');
    // The list is longer than the sidebar since a figure may read "(no stone)" (T-717): its scroll bar is left off.
    const rows = side(f).rows.map((row) => row.replace(/ *[│█]$/, ''));
    expect(rows[1]).toMatch(/^\[c\] Constructions +\[f\] Furniture$/);
    expect(rows[2]).toMatch(/^\[w\] Workshops +\[m\] Mechanisms$/);
    const at = rows.findIndex((row) => row.startsWith("Butcher's shop"));
    expect(`${rows[at] as string} ${(rows[at + 1] as string).trim()}`).toMatch(/^Butcher's shop 1 table\+1 stone .*\((\d+|no [a-z ]+)\)$/);
    expect(rows.join('\n')).not.toContain('»');
    // A row that fits keeps its one row, the count at the right.
    expect(rows.find((row) => row.startsWith('Loom'))).toMatch(/^Loom +2 logs \((\d+|no log)\)$/);
  });

  it('Stocks: a five-digit value and its ☼ fit the value column', () => {
    const f = setup();
    f.screen.openPanel('stocks');
    const { rows } = side(f);
    expect(rows.find((row) => /^. Bar/i.test(row.trim()))).toMatch(/198 +\d{2},\d{3} ☼$/);
  });

  it('Add order: a workshop too long for the Where row wraps under itself', () => {
    const f = setup();
    f.screen.openPanel('orders');
    const recipes = f.w.game.registry.table<{ id: string; workshop: string }>('recipes');
    f.screen.orders.openPicker(f.screen.ctx, { recipeId: recipes.ids().find((id) => recipes.byId(id)?.workshop === 'craftdwarf') as string });
    const { rows } = side(f);
    const at = rows.findIndex((row) => row.includes('Where'));
    expect(rows[at]).toBe("  Where    any craftsdwarf's");
    expect(rows[at + 1]).toBe(`${' '.repeat(11)}workshop`);
  });

  it('The creature view: a thought too long for its row wraps under itself', () => {
    const f = setup();
    f.screen.inspectCreature(f.dwarves[0] as EntityId);
    const text = side(f).rows.join('\n');
    expect(text).toMatch(/\n {2}-1 I have not talked to anyone\n {4}in a while\.\n/);
    expect(text).not.toContain('»');
  });

  it('The building panel: a line of goods breaks between entries, never inside "splint ×4"', () => {
    const f = setup();
    f.screen.openBuilding(f.wagon);
    const { rows } = side(f);
    expect(rows.some((row) => row.startsWith('medical'))).toBe(true);
    // The glyph set draws `×` as `x`. Every entry is whole on its row; no row starts with a count.
    for (const entry of ['splint x4', 'brightleaf x5', 'crutch x2', 'bandage x9', 'soap x3']) expect(rows.some((row) => row.includes(entry)), entry).toBe(true);
    expect(rows.filter((row) => /^x\d/.test(row))).toEqual([]);
    expect(rows.join('\n')).not.toContain('»');
  });
});

describe('T-719 the second pass: rooms, a planned building, the log, Mood, orders, the creature view, the status bar', () => {
  it('scans the states the second playtest found cut, and the status rows under them', () => {
    const f = setup719();
    const cuts: string[] = [];
    f.screen.openPanel('zones');
    f.screen.zones.selectZone(f.dining);
    cuts.push(...scan(f, 'zones dining hall'));
    f.screen.openBuilding(f.planned);
    cuts.push(...scan(f, 'planned still'));
    f.screen.openPanel('log');
    cuts.push(...scan(f, 'log'));
    f.screen.logFilter = 1;
    cuts.push(...scan(f, 'log alerts'));
    f.screen.logFilter = 0;
    f.screen.logView.filter.value = 'ambush';
    cuts.push(...scan(f, 'log filtered'));
    f.screen.logView.filter.value = '';
    for (const panel of ['mood', 'orders', 'jobs']) {
      f.screen.openPanel(panel);
      cuts.push(...scan(f, panel));
    }
    haul(f);
    f.screen.inspectCreature(f.dwarves[0] as EntityId);
    cuts.push(...scan(f, 'creature hauling'));
    f.screen.notice(LONG_NOTICE);
    cuts.push(...scan(f, 'status notice'));
    expect(cuts).toEqual([]);
  });
});

/** A 120-character notice: the placement advice the playtest saw cut. */
const LONG_NOTICE = "Mason's workshop placed · 0 stone or block in stock: 1 will wait · build a forge, a mason's workshop or a kiln to make blocks.";

/** The first dwarf hauls to the depot at priority 3. */
function haul(f: Fixture): void {
  const dwarves = f.w.readers.of<{ activityText(id: EntityId): string }>('10');
  vi.spyOn(dwarves, 'activityText').mockImplementation(() => 'Haul to depot');
  const jobs = f.w.readers.of<{ forWorker(id: EntityId): unknown }>('11');
  const real = jobs.forWorker.bind(jobs);
  vi.spyOn(jobs, 'forWorker').mockImplementation((id) => (id === f.dwarves[0] ? { priority: 3, data: {} } : real(id)));
}

describe('T-719 the lines the second playtest found cut', () => {
  it('Zones: a room not enclosed gives its count of open border tiles whole, wrapped under itself', () => {
    const f = setup719();
    f.screen.openPanel('zones');
    f.screen.zones.selectZone(f.dining);
    const { rows } = side(f);
    const at = rows.findIndex((row) => row.startsWith('Not enclosed'));
    expect(`${rows[at] as string} ${(rows[at + 1] as string).trim()}`).toMatch(/^Not enclosed: \d{2} open border tiles$/);
  });

  it('Building: a planned building\'s priority row gives every digit, 1 to 9', () => {
    const f = setup719();
    f.screen.openBuilding(f.planned);
    const { rows } = side(f);
    expect(rows).toContain('Priority 5 · 1 2 3 4 5 6 7 8 9');
  });

  it('Log: a filtered title gives its count first; an entry the panel cannot hold whole is left for the scroll, never cut', () => {
    const f = setup719();
    f.screen.openPanel('log');
    f.screen.logView.filter.value = 'ambush';
    expect(side(f).rows[0]).toMatch(/^Log · 1 of 43 · filter: ambush *\[x\]$/);
    f.screen.logView.filter.value = '';
    f.screen.logFilter = 1;
    const text = side(f).rows.join('\n');
    expect(text).not.toContain('»');
    // Scrolled to the oldest, the missed trade shows whole with its reason.
    f.screen.logView.move(999);
    const all = side(f).rows.map((row) => row.replace(/[│█]$/, '')).join(' ').replace(/ +/g, ' ');
    expect(all).toContain(`leaving without trading. ${strings.get('ui.trade.wait.late_any')}`);
  });

  it('Mood: each dwarf\'s thoughts one to a row, each whole, wrapped under itself', () => {
    const f = setup719();
    f.screen.openPanel('mood');
    const text = side(f).rows.join('\n');
    expect(text).toMatch(/\nGunnar Coalhammer +\S+\n {2}-4 I slept in the open on the\n {4}cold ground\.\n {2}-1 I have not talked to anyone\n {4}in a while\.\n/);
    expect(text).not.toContain('»');
  });

  it('Orders: a waiting order\'s reason wraps to a second row, in Orders and under Jobs', () => {
    const f = setup719();
    f.screen.openPanel('orders');
    // The glyph set draws `×` as `x`.
    let text = side(f).rows.join('\n');
    expect(text).toMatch(/x1 Brew drink · waiting for\n +plant \(0\)/);
    f.screen.openPanel('jobs');
    text = side(f).rows.join('\n');
    expect(text).toMatch(/x1 Brew drink · waiting for\n +plant \(0\)/);
  });

  it('Jobs: the table keeps its columns; a job too long for its column is named by its kind, the whole in its tooltip', () => {
    const f = setup719();
    f.screen.openPanel('jobs');
    const { s, rows } = side(f);
    const at = rows.findIndex((row) => /^ \d +Plant +/.test(row));
    expect(at).toBeGreaterThan(0);
    const col = SIDE + 2 + (rows[at] as string).indexOf('Plant');
    expect(s.tooltipAt(col, at)?.text).toMatch(/^Plant \(\d+,\d+,z\d+\)$/);
  });

  it('Jobs: a reason that fits the last column beside the scrollbar is not marked cut', () => {
    const s = surface(40, 6);
    const columns = [{ title: 'Pri', width: 4 }, { title: 'Job', width: 16 }, { title: 'Who / reason', width: 13 }];
    const rows = Array.from({ length: 9 }, () => [' 3', 'Haul to depot', 'open 2 days']);
    table(s, { col: 0, row: 0, cols: 33, rows: 6 }, columns, rows, { selected: 0, scroll: 0 });
    const lines = s.lines().slice(1).map((line) => line.trimEnd());
    expect(lines[1]).toMatch(/^ 3 {2}Haul to depot {3}open 2 days\s*│$/);
    expect(lines.join('\n')).not.toContain('»');
  });

  it('The log strip: the newest hint wraps over as many of the strip\'s rows as it needs; an older line is the one cut', () => {
    const f = setup719();
    const tick = f.w.tick;
    const hint = 'Wild beasts will come. Dig a hall into rock, put a door on it, click the door and choose Lock on alert. Make a squad in Military and arm it with iron spears: clubs lose to boars. Order a kill when a beast comes.';
    f.screen.log.lines.push({ tick, severity: 'note', text: `☼ ${hint}`, count: 1, category: 'hint' });
    const s = surface(COLS, ROWS);
    f.screen.draw(s);
    const strip = s.lines().slice(MAP_ROWS, STATUS_ROW).map((line) => line.trim());
    expect(strip.join(' ')).toBe(`☼ ${hint}`);
  });

  it('The creature view: the activity and its priority wrap under the line', () => {
    const f = setup719();
    haul(f);
    f.screen.inspectCreature(f.dwarves[0] as EntityId);
    const text = side(f).rows.join('\n');
    expect(text).toMatch(/Activity: Haul to depot\n +\(priority 3\)/);
  });

  it('The status bar: a 120-character message shows whole over its two rows, the hover line giving way', () => {
    const f = setup719();
    f.screen.notice(LONG_NOTICE);
    const rows = statusRows(f);
    expect(Array.from(LONG_NOTICE).length).toBeGreaterThanOrEqual(120);
    expect(`${(rows[1] as string).trim()} ${(rows[2] as string).trim()}`).toBe(LONG_NOTICE);
    expect(rows.join('\n')).not.toMatch(/[…»]/);
  });
});
