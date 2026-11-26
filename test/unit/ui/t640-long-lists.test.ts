/**
 * T-640: Animals, Jobs, Stocks and trade requests with many rows (`reports/audits/2026-11-19-t635-midgame-ux.md`,
 * findings 16–19). Animals groups unnamed animals and names its columns; Jobs batches open jobs, wraps
 * its summary, shows how long a job has been open and says why nobody has taken it; Stocks writes its
 * counts with separators and wraps its wealth line; a trade request names its material and merges
 * with its twin, its priority a word and not the money sign.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { CombatReader } from '@systems/combat';
import type { JobsSystem } from '@systems/jobs';
import type { TradeReader } from '@systems/trade';
import { jobWait, jobWaitText } from '@ui/job-wait';
import { drawAnimalsPanel, fedBar } from '@ui/panels/animals';
import { drawCivilizationsPanel, mergedRequests, requestMaterials, requestText, TRADE_CIVILIZATIONS } from '@ui/panels/civilizations';
import type { PanelContext } from '@ui/panels/context';
import { drawJobsPanel } from '@ui/panels/jobs';
import { drawStocksPanel, wealthLines } from '@ui/panels/stocks';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 60 * TICKS_PER_DAY });
  const sent: Command[] = [];
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (cmd) => { sent.push(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 42, true), precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 0,
  };
  const f = new FortressScreen(host, keymap, strings);
  const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
  return { w, f, sent, board };
}

function ctxOf(w: TestWorld): PanelContext {
  return {
    readers: w.readers, registry: w.game.registry, strings,
    submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
}

function draw(f: FortressScreen, which: 'animals' | 'jobs' | 'stocks' | 'civilizations', rows = 40): string[] {
  const s = surface(36, rows);
  const rect = { col: 0, row: 0, cols: 36, rows };
  if (which === 'animals') drawAnimalsPanel(s, rect, f.animals, f.ctx);
  else if (which === 'jobs') drawJobsPanel(s, rect, f.jobs, f.ctx);
  else if (which === 'stocks') drawStocksPanel(s, rect, f.stocks, f.ctx);
  else drawCivilizationsPanel(s, rect, f.civilizations, f.ctx, () => {});
  // The panel's content starts one cell in, as the sidebar draws it.
  return s.lines().map((line) => line.slice(1).trimEnd());
}

describe('T-640 Animals groups unnamed animals and names its columns', () => {
  /** 94 tame animals in spawn order, cow, sheep, chicken, goat, …, a pasture with eight cows, and two named dogs. */
  function herd() {
    const a = setup('t640-animals');
    const { w } = a;
    const pasture = w.zone('pasture', [w.index(30, 30, z), w.index(31, 30, z), w.index(32, 30, z)]);
    const species = ['cow', 'sheep', 'chicken', 'goat'];
    const ids: EntityId[] = [];
    for (let k = 0; k < 92; k += 1) ids.push(w.spawnTame(species[k % 4] as string, w.index(20 + (k % 20), 20 + Math.floor(k / 20), z)));
    const cows = ids.filter((_, k) => k % 4 === 0);
    for (const id of cows.slice(0, 8)) w.game.world.applyCommand({ type: 'AssignPasture', animalId: id, zoneId: pasture });
    // Two of the free cows are starving (condition 100: 08's hunger, 0 fed to 100 starving).
    for (const id of cows.slice(8, 10)) w.game.world.entities.add(id, C.Tame, { ...w.game.world.entities.get(id, C.Tame)!, condition: 100 });
    const bramble = w.spawnTame('dog', w.index(40, 40, z));
    const sooty = w.spawnTame('dog', w.index(41, 40, z));
    w.game.world.entities.get(bramble, C.Creature)!.name = 'Bramble';
    w.game.world.entities.get(sooty, C.Creature)!.name = 'Sooty';
    a.f.openPanel('animals');
    return { ...a, pasture, cows, bramble };
  }

  it('94 animals are a few rows by species, the named ones each a row, under named columns', () => {
    const { f } = herd();
    const rows = draw(f, 'animals');
    expect(rows[0]).toMatch(/^\[1\] Tame \(94\)/);
    expect(rows[1]).toMatch(/^Animal +Pasture Fed Trained$/);
    const listed = rows.slice(2).filter((row) => /^\S/.test(row) && !/^[─[]/.test(row)).slice(0, 7);
    // The glyph set draws `×` as `x`, `—` as `-` and `▓` `░` as themselves.
    expect(listed.map((row) => row.split(/ {2,}/)[0])).toEqual(['chicken x23', 'cow x8', 'cow x13', 'cow x2', 'dog Bramble', 'dog Sooty', 'goat x23']);
    expect(listed[1]).toMatch(/^cow x8 +#1 +▓▓▓/);
    expect(listed[3]).toMatch(/^cow x2 +- +░░░/);
    expect(listed[4]).toMatch(/^dog Bramble +- +- *$/);
    expect(rows.join('\n')).not.toContain('Cond');
  });

  it('the line under the list says what the selected row is: how many, where, how fed', () => {
    const { f } = herd();
    f.animals.list.selected = 1;
    expect(draw(f, 'animals').join('\n')).toContain('8 cows · pasture #1 · fed');
    f.animals.list.selected = 3;
    expect(draw(f, 'animals').join('\n')).toContain('2 cows · no pasture · starving');
    f.animals.list.selected = 4;
    expect(draw(f, 'animals').join('\n')).toContain('Bramble the dog · no pasture');
  });

  it('[p] moves every animal of a group; [s] marks one, which leaves the group for its own row', () => {
    const { f, sent, cows, pasture, w } = herd();
    f.animals.list.selected = 2;
    expect(f.animals.selectedGroup(f.ctx)).toHaveLength(13);
    f.key(press('P', { shift: true }));
    expect(sent).toHaveLength(13);
    expect(sent.every((c) => c.type === 'AssignPasture' && c['zoneId'] === pasture)).toBe(true);
    sent.length = 0;
    f.animals.list.selected = 1;
    const first = f.animals.selected(f.ctx);
    expect(cows.slice(0, 8)).toContain(first);
    w.game.world.applyCommand({ type: 'MarkSlaughter', animalId: first });
    const rows = f.animals.groups(f.ctx).map((ids) => ids.length);
    expect(rows.slice(0, 3)).toEqual([23, 7, 1]);
    f.animals.list.selected = 2;
    // Marked for slaughter, it leaves its pasture (08); the line wraps over two rows.
    expect(draw(f, 'animals').join(' ').replace(/ +/g, ' ')).toContain('1 cow · no pasture · fed · marked for slaughter');
  });

  it('the Fed bar reads three levels of hunger and a dash for an animal that does not graze', () => {
    expect([fedBar(3), fedBar(2), fedBar(1), fedBar(0), fedBar(null)]).toEqual(['▓▓▓', '▓▓░', '▓░░', '░░░', '—']);
  });
});

describe('T-640 Jobs batches open jobs, wraps its summary and says why an old job waits', () => {
  /** A plot of sixteen seeds to plant, all open, on adjacent tiles; and one farmer. */
  function plot() {
    const a = setup('t640-jobs');
    const { w, board } = a;
    const farmer = w.spawnDwarf({ at: w.index(30, 30, z), name: 'Ketil Ironvein' });
    w.setLabor(farmer, 'farming', true);
    const ids: number[] = [];
    for (let k = 0; k < 16; k += 1) {
      const id = board.create(`t640-plant-${k}`, { type: 'plant', target: { kind: 'tile', ref: w.index(72 + (k % 4), 89 - 60 + Math.floor(k / 4), z) }, workTile: 'at' });
      board.jobs.get(id)!.state = 'open';
      ids.push(id);
    }
    a.f.openPanel('jobs');
    return { ...a, farmer, ids };
  }

  it('sixteen open plantings of one plot are one row "Plant ×16", which Enter opens', () => {
    const { f } = plot();
    const text = draw(f, 'jobs').join('\n');
    expect(text).toMatch(/ 5 {2}Plant\S* x16 /);
    expect(text).not.toContain('(72,29,');
    expect(f.jobs.rows(f.ctx).map((r) => r.jobs.length)).toEqual([16]);
    expect(text).toContain('16 jobs over (72,29)-(75,32)');
    f.key(press('Enter'));
    expect(f.jobs.rows(f.ctx)).toHaveLength(16);
  });

  it('an open job and a blocked one of the same kind side by side are two rows', () => {
    const { f, board, w } = plot();
    const id = board.create('t640-plant-blocked', { type: 'plant', target: { kind: 'tile', ref: w.index(76, 29, z) }, workTile: 'at' });
    const job = board.jobs.get(id)!;
    job.state = 'blocked';
    job.blockedReason = 'unreachable';
    expect(f.jobs.rows(f.ctx).map((r) => r.jobs.length)).toEqual([16, 1]);
  });

  it('a summary too long for the panel wraps instead of ending in »', () => {
    const { f, board, w } = plot();
    for (let k = 0; k < 1000; k += 1) {
      const id = board.create(`t640-dig-${k}`, { type: 'dig', target: { kind: 'tile', ref: w.index(k % 90, 60 + Math.floor(k / 90), z - 3) }, workTile: 'adjacent' });
      const job = board.jobs.get(id)!;
      job.state = 'blocked';
      job.blockedReason = 'unreachable';
    }
    for (let k = 0; k < 10; k += 1) board.jobs.get(board.create(`t640-claimed-${k}`, { type: 'plant', target: { kind: 'tile', ref: w.index(10 + k, 10, z) }, workTile: 'at' }))!.state = 'working';
    const rows = draw(f, 'jobs');
    expect(rows[0]).toBe('16 open · 10 claimed · 1000');
    expect(rows[1]).toBe('blocked');
    expect(rows.slice(0, 8).join('\n')).not.toContain('»');
    expect(rows[2]).toMatch(/^\/filter/);
    expect(rows.some((row) => row.startsWith('Blocked: 1000 no path'))).toBe(true);
  });

  it('a job open more than a day shows its age, and the line under the list says why nobody takes it', () => {
    const { f, board, w, farmer } = plot();
    const now = w.readers.calendar.tick;
    for (const job of board.jobs.values()) job.createdTick = now - 41 * TICKS_PER_DAY - 5;
    // Three more urgent farming jobs come first for the only farmer.
    for (let k = 0; k < 3; k += 1) {
      const id = board.create(`t640-urgent-${k}`, { type: 'plant', priority: 3, target: { kind: 'tile', ref: w.index(10 + k, 12, z) }, workTile: 'at' });
      board.jobs.get(id)!.state = 'open';
    }
    f.jobs.list.selected = f.jobs.rows(f.ctx).findIndex((r) => r.jobs.length === 16);
    const rows = draw(f, 'jobs');
    const batch = rows.find((row) => /Plant\S* x16/.test(row));
    expect(batch).toMatch(/open 41 days$/);
    const text = rows.join(' ').replace(/ +/g, ' ');
    expect(text).toContain('3 more urgent jobs come first for Ketil Ironvein, the only dwarf with the farming labor.');
    void farmer;
  });
});

describe('T-640 why nobody has taken an open job', () => {
  function oneJob(labor = 'masonry') {
    const a = setup('t640-wait');
    const { w, board } = a;
    const ctx = ctxOf(w);
    const job = (key: string, at: TileIndex, priority = 5): number => {
      const id = board.create(key, { type: 'plant', priority, target: { kind: 'tile', ref: at }, workTile: 'at', data: { labor } });
      const j = board.jobs.get(id)!;
      j.state = 'open';
      j.blockedReason = null;
      return id;
    };
    const wait = (id: number) => jobWait(ctx, w.readers.of<{ get(id: number): never }>('11').get(id));
    return { ...a, ctx, job, wait };
  }

  it('no dwarf has the labor', () => {
    const { job, wait, w } = oneJob();
    const id = job('k', w.index(30, 30, z));
    expect(wait(id)).toEqual({ reason: 'no_labor', text: 'Nobody takes it: no dwarf has the masonry labor. Turn it on in Labors [l].' });
  });

  it('the only mason is busy with another job', () => {
    const { job, wait, w, board } = oneJob();
    const mason = w.spawnDwarf({ at: w.index(30, 31, z), name: 'Orm Ashbrow' });
    w.setLabor(mason, 'masonry', true);
    const other = job('other', w.index(31, 31, z));
    board.jobs.get(other)!.state = 'working';
    board.jobs.get(other)!.workerId = mason;
    board.setWorker(mason, { jobId: other });
    const id = job('k', w.index(30, 30, z));
    expect(wait(id)?.reason).toBe('busy');
    expect(wait(id)?.text).toBe('Nobody takes it yet: Orm Ashbrow, the only dwarf with the masonry labor, is busy with another job. It comes next.');
  });

  it('every mason is on duty with a squad', () => {
    const { job, wait, w } = oneJob();
    const a = w.spawnDwarf({ at: w.index(30, 31, z), name: 'Orm Ashbrow' });
    const b = w.spawnDwarf({ at: w.index(31, 31, z), name: 'Liv Hammerfall' });
    for (const d of [a, b]) w.setLabor(d, 'masonry', true);
    const command = w.game.world.applyCommand.bind(w.game.world);
    expect(command({ type: 'CreateSquad', name: 'Gate Guard' })).toEqual({ ok: true });
    const squad = w.readers.of<CombatReader>('16').squads()[0]!;
    expect(command({ type: 'SetSquadMembers', squadId: squad.id, members: [a, b] })).toEqual({ ok: true });
    expect(command({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' })).toEqual({ ok: true });
    const id = job('k', w.index(30, 30, z));
    expect(wait(id)?.reason).toBe('on_duty');
    expect(wait(id)?.text).toContain('All 2 dwarves with the masonry labor are on duty with squads.');
  });

  it('a free mason who cannot reach it, and one who can but has not taken it', () => {
    const { job, wait, w } = oneJob();
    const mason = w.spawnDwarf({ at: w.index(30, 31, z), name: 'Orm Ashbrow' });
    w.setLabor(mason, 'masonry', true);
    const deep = job('deep', w.index(50, 50, z - 6));
    expect(wait(deep)?.reason).toBe('unreachable');
    const near = job('near', w.index(30, 30, z));
    expect(wait(near)?.reason).toBe('not_taken');
    expect(wait(near)?.text).toContain('Orm Ashbrow has the masonry labor and is free');
  });

  it('a job for one dwarf names that dwarf; a blocked job gives its block reason; a held job none', () => {
    const { job, wait, w, board, ctx } = oneJob();
    const mason = w.spawnDwarf({ at: w.index(30, 31, z), name: 'Orm Ashbrow' });
    const other = w.spawnDwarf({ at: w.index(31, 31, z), name: 'Liv Hammerfall' });
    for (const d of [mason, other]) w.setLabor(d, 'masonry', true);
    const id = job('k', w.index(30, 30, z));
    board.jobs.get(id)!.data['assignedWorker'] = other;
    const held = job('held', w.index(32, 31, z));
    board.jobs.get(held)!.state = 'working';
    board.jobs.get(held)!.workerId = other;
    board.setWorker(other, { jobId: held });
    expect(wait(id)?.text).toBe('Nobody takes it yet: Liv Hammerfall, whom it is for, is busy with another job. It comes next.');
    const jobs = w.readers.of<{ get(id: number): never }>('11');
    expect(jobWaitText(ctx, jobs.get(held))).toBeNull();
    const blocked = board.jobs.get(job('blocked', w.index(33, 31, z)))!;
    blocked.state = 'blocked';
    blocked.blockedReason = 'unreachable';
    expect(jobWaitText(ctx, jobs.get(blocked.id))).toBe('No path: blocked by water, a locked door or undug rock.');
  });
});

describe('T-640 Stocks writes counts with separators and wraps the wealth line', () => {
  it('a stock of thousands reads "8,570", as its value does', () => {
    const { w, f } = setup('t640-stocks');
    for (let k = 0; k < 9; k += 1) w.spawnItem('drink', 'ale', w.index(20 + k, 20, z), 950);
    f.openPanel('stocks');
    const row = draw(f, 'stocks').find((line) => / drink /.test(line));
    expect(row).toMatch(/drink +8,550 +[\d,]+ ☼$/);
  });

  it('a wealth line wider than the panel puts the buildings on a second row', () => {
    const { w } = setup('t640-wealth');
    const ctx = ctxOf(w);
    w.spawnItem('drink', 'ale', w.index(20, 20, z), 50);
    const wide = wealthLines(ctx, 80);
    expect(wide).toHaveLength(1);
    expect(wide[0]).toMatch(/^Wealth [\d,]+ ☼ {3}\(buildings [\d,]+ ☼\)$/);
    const narrow = wealthLines(ctx, 20);
    expect(narrow).toHaveLength(2);
    expect(narrow[0]).toMatch(/^Wealth [\d,]+ ☼$/);
    expect(narrow[1]).toMatch(/^ {2}\(buildings [\d,]+ ☼\)$/);
  });
});

describe('T-640 a trade request names its material, merges with its twin, and its priority is a word', () => {
  it('names a request by item and material, an animal by its species', () => {
    const { w } = setup('t640-request-names');
    const registry = w.game.registry;
    expect(requestText(registry, strings, { itemType: 'seed', material: 'dimcap' })).toBe('seed: dimcap');
    expect(requestText(registry, strings, { itemType: 'bar', material: 'iron' })).toBe('bar: iron');
    expect(requestText(registry, strings, { itemType: 'bar' })).toBe('bar');
    expect(requestText(registry, strings, { itemType: 'cow' })).toBe('cow');
    expect(requestText(registry, strings, { itemType: 'cloth', material: 'wool_cloth' })).toBe('wool cloth');
  });

  it('two requests of one item and material are one row at the higher priority', () => {
    expect(mergedRequests([
      { itemType: 'seed', material: 'dimcap', priority: 2 }, { itemType: 'seed', material: 'cavewheat', priority: 2 },
      { itemType: 'seed', material: 'dimcap', priority: 3 }, { itemType: 'bar', priority: 1 },
    ])).toEqual([{ itemType: 'seed', material: 'dimcap', priority: 3 }, { itemType: 'seed', material: 'cavewheat', priority: 2 }, { itemType: 'bar', priority: 1 }]);
  });

  it('the panel lists "seed: dimcap  high" once, and never the money sign', () => {
    const { w, f } = setup('t640-request-panel');
    w.game.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome', entries: [
      { itemType: 'seed', material: 'dimcap', priority: 3 }, { itemType: 'seed', material: 'cavewheat', priority: 2 },
      { itemType: 'seed', material: 'dimcap', priority: 2 }, { itemType: 'mail_shirt', material: 'steel', priority: 2 }, { itemType: 'bar', material: 'iron', priority: 1 },
    ] });
    f.openPanel('civilizations');
    f.civilizations.selected = TRADE_CIVILIZATIONS.indexOf('mountainhome');
    const rows = draw(f, 'civilizations');
    const at = rows.findIndex((row) => row.startsWith('Requests'));
    const requests = rows.slice(at + 1, at + 5).map((row) => row.replace(/ {2,}/g, '  '));
    expect(requests).toEqual(['> seed: dimcap  high', '  seed: cavewheat  medium', '  mail shirt: steel  medium', '  bar: iron  low'].map((row) => row.replace('>', rows[at + 1]!.charAt(0))));
    expect(rows.slice(at, at + 6).join('\n')).not.toContain('☼');
  });

  it('the editor asks for an item in a material the civilization brings: "bar: iron"', () => {
    const { w, f, sent } = setup('t640-request-editor');
    const trade = w.readers.of<TradeReader>('20');
    expect(requestMaterials(w.game.registry, 'mountainhome', trade.reputation('mountainhome'), 'bar')).toEqual([undefined, 'copper', 'bronze', 'iron', 'steel', 'silver']);
    f.openPanel('civilizations');
    f.civilizations.selected = TRADE_CIVILIZATIONS.indexOf('mountainhome');
    f.civilizations.key(f.ctx, press('a', { shift: true }), () => {});
    f.civilizations.candidate = f.civilizations.candidates(f.ctx).indexOf('bar');
    expect(draw(f, 'civilizations').join('\n')).toContain('Add: bar: any');
    for (let k = 0; k < 3; k += 1) f.civilizations.key(f.ctx, press('ArrowRight'), () => {});
    expect(draw(f, 'civilizations').join('\n')).toContain('Add: bar: iron');
    f.civilizations.key(f.ctx, press('Enter'), () => {});
    expect(sent).toEqual([{ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'bar', material: 'iron', priority: 1 }] }]);
  });
});
