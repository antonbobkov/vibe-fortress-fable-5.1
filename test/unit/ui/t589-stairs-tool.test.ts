/**
 * T-589: one Stairs tool that chooses each tile's stairs, best-effort designation boxes that say
 * what they skipped and why (24 § Input model), and 03's stairs cut into a floor or re-carved from
 * a stair (03 § Tile transitions).
 */

import { describe, expect, it, vi } from 'vitest';
import { loadContent } from '@content/loader';
import type { Command } from '@core/commands';
import { Designation, Map3D, TileFlag, TileKind } from '@core/map3d';
import type { MapReader } from '@core/readers';
import type { TileIndex } from '@core/types';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Game } from '@app/game';
import { precondition, TerrainFacts, transition, type TransitionRolls } from '@systems/terrain';
import { DESIGNATE_KINDS, DesignateTool, drawDesignatePanel, type DesignatePlan, type TilePoint } from '@ui/panels/designate';

import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { TestWorld } from '../../scenarios/test-world';
import { onlyMiner, stairShaft } from '../../scenarios/m1-helpers';
import { press, strings, surface } from './ui-fixture';


const registry = loadContent();
const facts = new TerrainFacts(registry);
const GRANITE = registry.table('materials').index('granite');
const HEMATITE = registry.table('materials').index('hematite');
const D = TileFlag.Discovered;

/** A 3×3×8 map of discovered granite wall. */
function rock(): Map3D {
  const map = new Map3D(3, 3, 8);
  for (let i = 0; i < map.kind.length; i += 1) {
    map.kind[i] = TileKind.Wall;
    map.material[i] = GRANITE;
    map.flags[i] = D;
  }
  return map;
}

function put(map: Map3D, z: number, kind: TileKind, flags: number = D, x = 1, y = 1): TileIndex {
  const i = map.index(x, y, z);
  map.kind[i] = kind;
  map.flags[i] = flags;
  return i;
}

/** The map as the designate tool reads it (the tool reads only kinds, flags and indices). */
const reader = (map: Map3D): MapReader => map as unknown as MapReader;

function stairs(map: Map3D, a: TilePoint, b: TilePoint): DesignatePlan {
  const tool = new DesignateTool();
  tool.choose('w');
  return tool.plan({ map: reader(map), precondition: (i, k) => precondition(map, i, k, facts) }, a, b);
}

/** Each designated tile's level and stairs, from the top down. */
function designated(map: Map3D, plan: DesignatePlan): [number, string][] {
  return plan.commands.flatMap((c) => (c['tiles'] as TileIndex[]).map((t) => [map.unpack(t).z, c['kind'] as string] as [number, string]))
    .sort((p, q) => q[0] - p[0]);
}

const at = (z: number): TilePoint => ({ x: 1, y: 1, z });

describe('T-589 the Stairs tool chooses each tile\'s stairs', () => {
  it('is the only stair tool in the panel', () => {
    const ids = DESIGNATE_KINDS.map((k) => k.id);
    expect(ids).toContain('stairs');
    for (const old of ['stairs_up', 'stairs_down', 'stairs_updown', 'stairwell']) expect(ids).not.toContain(old);
    expect(DESIGNATE_KINDS.find((k) => k.id === 'stairs')?.key).toBe('w');
  });

  it('a shaft through rock from a floor: down stairs on top, up/down between, up stairs at the bottom', () => {
    const map = rock();
    put(map, 6, TileKind.Floor);
    const plan = stairs(map, at(6), at(3));
    expect(designated(map, plan)).toEqual([[6, 'stairs_down'], [5, 'stairs_updown'], [4, 'stairs_updown'], [3, 'stairs_up']]);
    expect(plan.commands.every((c) => c.type === 'Designate')).toBe(true);
    expect(plan.skipped).toEqual([]);
  });

  it('a top in rock is carved up/down rather than dropping the column', () => {
    const map = rock();
    const plan = stairs(map, at(6), at(4));
    expect(designated(map, plan)).toEqual([[6, 'stairs_updown'], [5, 'stairs_updown'], [4, 'stairs_up']]);
  });

  it('the shaft continues through a level already dug out, and skips only an open level', () => {
    const map = rock();
    put(map, 6, TileKind.Floor);
    put(map, 5, TileKind.Floor);
    put(map, 4, TileKind.Open, D);
    put(map, 2, TileKind.Floor);
    const plan = stairs(map, at(6), at(2));
    expect(designated(map, plan)).toEqual([[6, 'stairs_down'], [5, 'stairs_updown'], [3, 'stairs_updown'], [2, 'stairs_up']]);
    expect(plan.designated).toBe(4);
    expect(plan.skipped).toEqual([{ reason: 'ui.status.skip.open', n: 1 }]);
  });

  it('extending a shaft: an up stair above the top becomes up/down, and the top leads up to it', () => {
    const map = rock();
    put(map, 6, TileKind.StairsUp);
    put(map, 5, TileKind.Floor);
    const plan = stairs(map, at(5), at(3));
    expect(designated(map, plan)).toEqual([[6, 'stairs_updown'], [5, 'stairs_updown'], [4, 'stairs_updown'], [3, 'stairs_up']]);
  });

  it('a down stair below the bottom becomes up/down; a stair that already leads the way needed is left alone', () => {
    const map = rock();
    put(map, 6, TileKind.Floor);
    put(map, 3, TileKind.StairsDown);
    const plan = stairs(map, at(6), at(4));
    expect(designated(map, plan)).toEqual([[6, 'stairs_down'], [5, 'stairs_updown'], [4, 'stairs_updown'], [3, 'stairs_updown']]);
    const map2 = rock();
    put(map2, 6, TileKind.Floor);
    put(map2, 3, TileKind.StairsUpDown);
    const plan2 = stairs(map2, at(6), at(4));
    expect(designated(map2, plan2)).toEqual([[6, 'stairs_down'], [5, 'stairs_updown'], [4, 'stairs_updown']]);
    expect(plan2.already).toBe(1);
  });

  it('a built stair is not re-carved: it is skipped and named', () => {
    const map = rock();
    put(map, 6, TileKind.Floor);
    put(map, 3, TileKind.StairsDown, D | TileFlag.Constructed);
    const plan = stairs(map, at(6), at(4));
    expect(plan.skipped).toEqual([{ reason: 'ui.status.skip.built_stairs', n: 1 }]);
    expect(plan.designated).toBe(3);
  });

  it('on one level: a floor takes down stairs and up stairs beneath; with an up stair beneath, only the down stair', () => {
    const map = rock();
    put(map, 6, TileKind.Floor);
    expect(designated(map, stairs(map, at(6), at(6)))).toEqual([[6, 'stairs_down'], [5, 'stairs_up']]);
    put(map, 5, TileKind.StairsUp);
    const plan = stairs(map, at(6), at(6));
    expect(designated(map, plan)).toEqual([[6, 'stairs_down']]);
    expect(plan.already).toBe(1);
  });

  it('on one level: a wall takes up/down stairs, and the stairs directly above and below it are made to lead to it', () => {
    const map = rock();
    put(map, 6, TileKind.StairsUp);
    put(map, 4, TileKind.StairsDown);
    expect(designated(map, stairs(map, at(5), at(5)))).toEqual([[6, 'stairs_updown'], [5, 'stairs_updown'], [4, 'stairs_updown']]);
    const lone = rock();
    expect(designated(lone, stairs(lone, at(5), at(5)))).toEqual([[5, 'stairs_updown']]);
  });

  it('an undiscovered tile is taken as rock; open space on one level is skipped', () => {
    const map = rock();
    put(map, 6, TileKind.Floor);
    put(map, 5, TileKind.Wall, 0);
    put(map, 4, TileKind.Open, 0);
    expect(designated(map, stairs(map, at(6), at(4)))).toEqual([[6, 'stairs_down'], [5, 'stairs_updown'], [4, 'stairs_up']]);
    const air = rock();
    put(air, 6, TileKind.Open);
    const plan = stairs(air, at(6), at(6));
    expect(plan.commands).toEqual([]);
    expect(plan.skipped).toEqual([{ reason: 'ui.status.skip.open', n: 1 }]);
  });
});

describe('T-589 best-effort boxes', () => {
  it('a dig box designates what it can and counts the rest per tile kind', () => {
    const map = rock();
    put(map, 6, TileKind.Floor, D, 0, 0);
    put(map, 6, TileKind.Floor, D, 1, 0);
    put(map, 6, TileKind.Open, D, 2, 0);
    const tool = new DesignateTool();
    tool.choose('d');
    const plan = tool.plan({ map: reader(map), precondition: (i, k) => precondition(map, i, k, facts) }, { x: 0, y: 0, z: 6 }, { x: 2, y: 2, z: 6 });
    expect(plan.designated).toBe(6);
    expect(plan.skipped).toEqual([{ reason: 'ui.kind.2', n: 2 }, { reason: 'ui.kind.0', n: 1 }]);
  });

  it('Ctrl+Z undoes every Designate of a stairs batch', () => {
    const tool = new DesignateTool();
    tool.remember([
      { type: 'Designate', tiles: [1, 2], kind: 'stairs_down', priority: 5 },
      { type: 'Designate', tiles: [3], kind: 'stairs_up', priority: 5 },
    ]);
    expect(tool.undo()).toEqual({ type: 'UndoDesignation', tiles: [1, 2, 3] });
  });
});

describe('T-589 the status row', () => {
  const Z = FLAT_TEST_SURFACE_Z;

  async function fortress(): Promise<{ game: Game; sent: Command[] }> {
    const game = new Game({ canvas: new MockCanvas(), seed: 't589', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start();
    const sent: Command[] = [];
    const submit = game.host.submit.bind(game.host);
    vi.spyOn(game.host, 'submit').mockImplementation((cmd: Command) => { sent.push(cmd); return submit(cmd); });
    return { game, sent };
  }
  const key = (game: Game, k: string, shift = false): boolean => game.handleKey(press(k, { shift }));
  const cellOf = (game: Game, col: number, row: number): { x: number; y: number; button: number; shift: boolean; ctrl: boolean; alt: boolean; meta: boolean } => {
    const c = game.cellCenter(col, row);
    return { x: c.x, y: c.y, button: 0, shift: false, ctrl: false, alt: false, meta: false };
  };

  it('a dig box over the surface and the rock below it says how many it designated and skipped, and why', async () => {
    const { game, sent } = await fortress();
    key(game, 'd');
    key(game, 'Enter');
    key(game, '→');
    key(game, '<');
    key(game, 'Enter');
    expect(sent.filter((c) => c.type === 'Designate')[0]?.['tiles']).toHaveLength(2);
    expect(game.fortress.statusRow2()).toContain('Dig: 2 designated, 2 skipped (2 floor).');
  });

  it('a stairs shaft through an open level says it skipped that level as already open', async () => {
    const { game, sent } = await fortress();
    key(game, 'd');
    key(game, 'w');
    const c = game.ui.cursor as { x: number; y: number };
    const map = game.host.headless.map;
    const open = map.index(c.x, c.y, Z - 2);
    map.kind[open] = TileKind.Open;
    map.flags[open] = (map.flags[open] ?? 0) | TileFlag.Discovered;
    key(game, 'Enter');
    for (let k = 0; k < 4; k += 1) key(game, '<');
    key(game, 'Enter');
    expect(sent.filter((cmd) => cmd.type === 'Designate').flatMap((cmd) => cmd['tiles'] as number[])).toHaveLength(4);
    expect(game.fortress.statusRow2()).toContain('Stairs: 4 designated, 1 skipped (1 already open).');
    expect(map.designationAt(open)).toBe(Designation.None);
  });

  it('a drag on one level with the stairs tool designates at once; a click waits with the shaft prompt', async () => {
    const { game, sent } = await fortress();
    key(game, 'd');
    key(game, 'w');
    game.pointerDown(cellOf(game, 10, 10));
    game.pointerUp(cellOf(game, 10, 10));
    expect(sent).toEqual([]);
    expect(game.fortress.statusRow2()).toContain(`Stairs from z ${Z}: click again, or change level`);
    key(game, 'Esc');
    game.pointerDown(cellOf(game, 10, 10));
    game.pointerMove(cellOf(game, 11, 10));
    game.pointerUp(cellOf(game, 11, 10));
    expect(sent.map((cmd) => [cmd.type, cmd['kind'], (cmd['tiles'] as number[]).length])).toEqual([['Designate', 'stairs_down', 2], ['Designate', 'stairs_up', 2]]);
  });

  it('hovering the Stairs caption explains the tool', () => {

    const s = surface(36, 20);
    const tool = new DesignateTool();
    drawDesignatePanel(s, { col: 0, row: 0, cols: 36, rows: 20 }, tool, strings);
    const row = s.lines().findIndex((line) => line.includes('[w] Stairs'));
    const col = (s.lines()[row] ?? '').indexOf('[w] Stairs');
    expect(s.tooltipAt(col + 4, row)?.text).toBe('Stairs: click a floor for a down stair and the stair beneath it, or a wall for up/down; change level between the two clicks for a whole shaft.');
  });
});

describe('T-589 03: stairs cut into a floor or re-carved from a stair', () => {
  const rolls: TransitionRolls = { stoneDrops: () => true, logs: () => 0, gather: () => null, logMaterial: () => 'oak' };

  it('up and up/down stairs from a floor or a stair drop nothing; from a wall they drop as dug', () => {
    for (const [from, kind, result, drops] of [
      [TileKind.Floor, Designation.StairsUp, TileKind.StairsUp, 0],
      [TileKind.Floor, Designation.StairsUpDown, TileKind.StairsUpDown, 0],
      [TileKind.StairsUp, Designation.StairsUpDown, TileKind.StairsUpDown, 0],
      [TileKind.StairsDown, Designation.StairsUpDown, TileKind.StairsUpDown, 0],
      [TileKind.Wall, Designation.StairsUpDown, TileKind.StairsUpDown, 1],
    ] as const) {
      const map = rock();
      const i = put(map, 4, from);
      const r = transition(map, i, kind, facts, rolls);
      expect(r.changes).toEqual([{ tile: i, kind: result, material: GRANITE }]);
      expect(r.drops).toHaveLength(drops);
    }
  });

  it('a miner cuts up stairs into an ore floor and re-carves a shaft\'s foot to up/down, mining nothing', () => {
    const w = new TestWorld({ seed: 't589-carve', world: 'flat-test', embark: 'default' });
    stairShaft(w, 48, 12, 32, 29);
    onlyMiner(w);
    const floor = w.index(49, 12, 29);
    w.carve(floor, TileKind.Floor, HEMATITE);
    w.discover(floor);
    const foot = w.index(48, 12, 29);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [floor], kind: 'stairs_up', priority: 5 }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [foot], kind: 'stairs_updown', priority: 5 }).ok).toBe(true);
    w.until((world) => world.map.kindAt(floor) === TileKind.StairsUp && world.map.kindAt(foot) === TileKind.StairsUpDown, 3000);
    expect(w.map.kindAt(floor)).toBe(TileKind.StairsUp);
    expect(w.map.kindAt(foot)).toBe(TileKind.StairsUpDown);
    expect(w.events('MineralMined')).toEqual([]);
  });
});
