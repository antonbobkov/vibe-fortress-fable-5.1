/**
 * T-610: a designation no dwarf can reach says so when it is made (24 § Input model), and the Jobs
 * panel shows a blocked batch as one row (`panels.md` § Jobs).
 */

import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { computeLayout } from '@render/cellbuffer';
import { JobsSystem } from '@systems/jobs';
import { precondition, TerrainFacts } from '@systems/terrain';
import { drawJobsPanel } from '@ui/panels/jobs';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { dwarves, onlyMiner, rect } from '../../scenarios/m1-helpers';
import { keymap, press, strings, surface } from './ui-fixture';

const Z = FLAT_TEST_SURFACE_Z;

function fixture(embark: 'default' | 'none' = 'default') {
  const w = new TestWorld({ seed: 't610', world: 'flat-test', embark });
  const facts = new TerrainFacts(w.game.registry);
  const sent: Command[] = [];
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(Z),
    submit: (cmd) => { sent.push(cmd); w.game.world.applyCommand(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 42, true), precondition: (i, k) => precondition(w.map, i, k, facts),
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 0,
  };
  const f = new FortressScreen(host, keymap, strings);
  return { w, f, sent };
}

/** The easternmost column a dwarf stands on, so the hill is built clear of the party. */
function eastOfParty(w: TestWorld): { x: number; y: number } {
  const at = dwarves(w).map((id) => w.game.world.entities.get(id, C.Position) as { x: number; y: number });
  return { x: Math.max(...at.map((p) => p.x)) + 4, y: at[0]?.y ?? 48 };
}

/**
 * A hill of granite on the surface, from column x0 east for 14 and 8 rows north and south of y0,
 * with a passage `entry` of floor dug into it from its west face. Every tile is discovered.
 */
function hill(w: TestWorld, x0: number, y0: number, entry: readonly TileIndex[]): void {
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = x0 - 1; x <= x0 + 14; x += 1) {
    for (let y = y0 - 8; y <= y0 + 8; y += 1) {
      const i = w.index(x, y, Z);
      w.discover(i);
      if (x >= x0) w.carve(i, TileKind.Wall, granite);
    }
  }
  for (const i of entry) w.carve(i, TileKind.Floor, granite);
  w.step(1);
}

/** Choose a designate tool by its panel key and make the box between two corners. */
function designate(f: FortressScreen, key: string, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): Command[] {
  f.tool.choose(key);
  return f.commit(a, b);
}

describe('T-610 a designation no dwarf can reach says so', () => {
  it('a dig box that meets the passage only at a corner: one tile can be dug, the status row and the log say the rest cannot', () => {
    const { w, f } = fixture();
    const { x, y } = eastOfParty(w);
    // The passage runs east along row y and ends at (x+4, y); the box starts diagonally beyond it.
    hill(w, x, y - 1, rect(w, x, y, Z, 5, 1));
    designate(f, 'd', { x: x + 5, y: y + 1, z: Z }, { x: x + 9, y: y + 4, z: Z });
    const text = 'Dig: 20 designated · 19 out of reach: open a side (not a corner) or a stair.';
    expect(f.statusRow2()).toBe(text);
    const note = f.log.lines.at(-1);
    expect(note?.text).toBe(text);
    expect(note?.severity).toBe('note');
    expect(note?.focus).toBe(w.index(x + 6, y + 1, Z));
  });

  it('the corner stall is the rules: the miner digs the corner from the diagonal and stops there', () => {
    const { w, f } = fixture();
    onlyMiner(w);
    const { x, y } = eastOfParty(w);
    hill(w, x, y - 1, rect(w, x, y, Z, 5, 1));
    designate(f, 'd', { x: x + 5, y: y + 1, z: Z }, { x: x + 9, y: y + 4, z: Z });
    const box = rect(w, x + 5, y + 1, Z, 5, 4);
    w.step(3000);
    expect(box.filter((t) => w.map.kindAt(t) === TileKind.Floor)).toEqual([w.index(x + 5, y + 1, Z)]);
  });

  it('a box the passage meets at a side says nothing more, and is dug out whole', () => {
    const { w, f } = fixture();
    onlyMiner(w);
    const { x, y } = eastOfParty(w);
    hill(w, x, y - 1, rect(w, x, y + 1, Z, 5, 1));
    designate(f, 'd', { x: x + 5, y: y + 1, z: Z }, { x: x + 9, y: y + 4, z: Z });
    expect(f.statusRow2()).not.toContain('reach');
    expect(f.log.lines.some((l) => l.text.includes('reach'))).toBe(false);
    const box = rect(w, x + 5, y + 1, Z, 5, 4);
    w.until(() => box.every((t) => w.map.kindAt(t) === TileKind.Floor), 8000);
    expect(box.every((t) => w.map.kindAt(t) === TileKind.Floor)).toBe(true);
  });

  it('a box sealed in rock: no dwarf can reach any of it', () => {
    const { w, f } = fixture();
    const { x, y } = eastOfParty(w);
    hill(w, x, y - 1, []);
    designate(f, 'd', { x: x + 5, y: y + 1, z: Z }, { x: x + 9, y: y + 4, z: Z });
    expect(f.statusRow2()).toBe('Dig: 20 designated · no dwarf can reach it yet: open a side or a stair above.');
  });

  it('a stair box topped by a ramp: the status row names the ramp in place of the bare count', () => {
    const { w, f } = fixture();
    const { x, y } = eastOfParty(w);
    const granite = w.game.registry.table('materials').index('granite');
    const ramp = w.index(x, y, Z);
    w.carve(ramp, TileKind.Ramp, granite);
    w.carve(w.index(x + 1, y, Z), TileKind.Wall, granite);
    for (let z = Z - 5; z <= Z + 1; z += 1) for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) w.discover(w.index(x + dx, y + dy, z));
    w.step(1);
    const sent = designate(f, 'w', { x, y, z: Z }, { x, y, z: Z - 5 });
    expect(sent.flatMap((c) => c['tiles'] as TileIndex[])).toHaveLength(5);
    const text = 'Stairs: 5 designated · the top is a ramp: start the column on a floor beside it.';
    expect(f.statusRow2()).toBe(text);
    expect(f.log.lines.at(-1)?.focus).toBe(w.index(x, y, Z - 5));
  });

  it('a room under a shaft designated but not yet carved is in reach; under no shaft it is not', () => {
    const { w, f } = fixture();
    const { x, y } = eastOfParty(w);
    for (let z = Z - 3; z <= Z; z += 1) for (let dx = 0; dx <= 3; dx += 1) for (let dy = 0; dy <= 2; dy += 1) w.discover(w.index(x + dx, y + dy, z));
    const room = (): Command[] => designate(f, 'd', { x: x + 1, y, z: Z - 3 }, { x: x + 3, y: y + 2, z: Z - 3 });
    room();
    expect(f.statusRow2()).toBe('Dig: 9 designated · no dwarf can reach it yet: open a side or a stair above.');
    const undo = f.tool.undo();
    if (undo !== null) w.game.world.applyCommand(undo);
    f.clearNotice();
    designate(f, 'w', { x, y, z: Z }, { x, y, z: Z - 3 });
    expect(f.statusRow2()).not.toContain('reach');
    f.clearNotice();
    room();
    expect(f.statusRow2()).not.toContain('reach');
  });

  it('a shaft from a floor beside the ramp reaches every level and says only what it skipped', () => {
    const { w, f } = fixture();
    const { x, y } = eastOfParty(w);
    for (let z = Z - 5; z <= Z; z += 1) w.discover(w.index(x, y, z));
    designate(f, 'w', { x, y, z: Z }, { x, y, z: Z - 5 });
    expect(f.statusRow2()).not.toContain('reach');
    expect(f.statusRow2()).not.toContain('ramp');
  });
});

describe('T-610 the Jobs panel shows a blocked batch as one row', () => {
  function blockedDigs() {
    const { w, f } = fixture('none');
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const ids: number[] = [];
    for (const t of rect(w, 59, 51, Z - 2, 5, 4)) {
      const id = board.create(`t610-${t}`, { type: 'dig', target: { kind: 'tile', ref: t }, workTile: 'adjacent' });
      const job = board.jobs.get(id)!;
      job.state = 'blocked';
      job.blockedReason = 'unreachable';
      ids.push(id);
    }
    const open = board.create('t610-open', { type: 'dig', target: { kind: 'tile', ref: w.index(70, 51, Z - 2) }, workTile: 'adjacent' });
    board.jobs.get(open)!.state = 'open';
    f.openPanel('jobs');
    return { w, f, ids };
  }
  const draw = (f: FortressScreen): string => {
    const s = surface(36, 32);
    drawJobsPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, f.jobs, f.ctx);
    return s.lines().join('\n');
  };

  it('twenty unreachable digs are one line "Dig ×20 … no path", and the line under it gives their box', () => {
    const { f } = blockedDigs();
    // The glyph set draws `×` as `x` and `–` as `-`.
    const text = draw(f);
    expect(text).toMatch(/ 5 {2}Dig x20 +no path/);
    expect(text).not.toContain('Dig (59,51');
    expect(text).toContain(`20 jobs over (59,51)-(63,54), z${Z - 2}.`);
    expect(text).toContain('[Enter] list them.');
    expect(f.jobs.rows(f.ctx).map((r) => r.jobs.length)).toEqual([20, 1]);
  });

  it('Enter opens the batch to its rows; x on the batch cancels every job of it', () => {
    const { f, ids } = blockedDigs();
    f.key(press('Enter'));
    expect(f.jobs.rows(f.ctx)).toHaveLength(21);
    expect(draw(f)).toContain('Dig (59,51,');
    const again = blockedDigs();
    expect(again.f.jobs.cancel(again.f.ctx)?.map((c) => c['jobId'] as EntityId)).toEqual(ids);
  });
});
