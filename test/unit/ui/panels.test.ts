/**
 * T-M2-09: the build tool, the zones tool and stockpile filter editor, the stocks, units, jobs and
 * labors panels, and the widgets `Tree`, `Toggle`, `Table` (`ui-screens/panels.md`,
 * `fortress-screen.md` § Build tool, 24 § Panels).
 */

import { describe, it, expect, vi } from 'vitest';
import { loadContent } from '@content/loader';
import type { Command } from '@core/commands';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { Game } from '@app/game';
import type { BuildingsReader } from '@systems/buildings';
import { CATEGORY_TREE } from '@systems/items';
import { buildTree, nodeState, toggle, toggleNode, table, stateGlyph } from '@ui/widgets';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, surface } from './ui-fixture';

const registry = loadContent();

async function fortressGame(): Promise<Game> {
  const game = new Game({
    canvas: new MockCanvas(),
    seed: 'panels-ui',
    registry,
    createCanvas: mockCanvasFactory(),
    devicePixelRatio: 1,
    width: 1280,
    height: 800,
  });
  await game.start({ embark: 'default' });
  return game;
}

function key(game: Game, k: string, mods: Partial<{ shift: boolean; ctrl: boolean }> = {}): boolean {
  return game.handleKey(press(k, mods));
}

function cell(game: Game, col: number, row: number, mods: Partial<{ shift: boolean; button: number }> = {}): { x: number; y: number; button: number; shift: boolean; ctrl: boolean; alt: boolean; meta: boolean } {
  const c = game.cellCenter(col, row);
  return { x: c.x, y: c.y, button: mods.button ?? 0, shift: mods.shift ?? false, ctrl: false, alt: false, meta: false };
}

describe('T-M2-09 widgets: the tri-state tree', () => {
  const forest = buildTree(CATEGORY_TREE);

  it('a node is all when it or an ancestor is selected, partial when something below is, none otherwise', () => {
    expect(nodeState(['food'], 'food/meat/raw')).toBe('all');
    expect(nodeState(['food/meat'], 'food')).toBe('partial');
    expect(nodeState(['food/meat'], 'drink')).toBe('none');
    expect([stateGlyph('all'), stateGlyph('partial'), stateGlyph('none')]).toEqual(['■', '▪', '□']);
  });

  it('toggling a partial or empty node selects its subtree; toggling an all node splits the selected ancestor', () => {
    expect(toggleNode(forest, [], 'food/meat')).toEqual(['food/meat']);
    expect(toggleNode(forest, ['food/meat/raw'], 'food/meat')).toEqual(['food/meat']);
    const split = toggleNode(forest, ['food'], 'food/meat/raw');
    expect(split).not.toContain('food');
    expect(split).toContain('food/meat/cooked');
    expect(split).toContain('food/fish');
    expect(split.some((s) => s === 'food/meat/raw' || s === 'food/meat')).toBe(false);
    expect(nodeState(split, 'food')).toBe('partial');
    // Toggling it back collapses the selection to the parent again.
    expect(toggleNode(forest, split, 'food/meat/raw')).toEqual(['food']);
  });

  it('Toggle and Table draw their cells', () => {
    const s = surface(30, 4);
    const clicks: number[] = [];
    toggle(s, 0, 0, true, 'auto-harvest', () => clicks.push(1));
    toggle(s, 0, 1, false, 'collect');
    expect(s.lines()[0]?.startsWith('[■] auto-harvest')).toBe(true);
    expect(s.lines()[1]?.startsWith('[ ] collect')).toBe(true);
    s.hitAt(1, 0)?.action();
    expect(clicks).toEqual([1]);
    const t = surface(30, 4);
    table(t, { col: 0, row: 0, cols: 30, rows: 3 }, [{ title: 'Name', width: 10 }, { title: 'Act.', width: 8 }], [['Ketil', 'Digging'], ['Orm', 'No job']], { selected: 1, scroll: 0 });
    expect(t.lines()[0]?.startsWith('Name      Act.')).toBe(true);
    expect(t.lines()[2]?.startsWith('Orm       No job')).toBe(true);
  });
});

describe('T-M2-09 build tool', () => {
  it('ghost validity: green on a floor, red with the reason on undiscovered or unsuitable ground; a click places and the tool stays', async () => {
    const game = await fortressGame();
    const spy = vi.spyOn(game.host, 'submit');
    key(game, 'b');
    expect(game.ui.panel).toBe('build');
    key(game, 'w');
    expect(game.fortress.build.current(game.fortress.ctx)?.id).toBe('bowyer');
    key(game, '↓');
    expect(game.fortress.build.current(game.fortress.ctx)?.id).toBe('butcher');
    const map = game.host.readers.map;
    const z = game.ui.z;
    const floor = { x: 20, y: 20, z };
    const ok = game.fortress.build.ghost(game.fortress.ctx, floor);
    expect(ok?.reason).toBeNull();
    expect(ok?.tiles).toHaveLength(9);
    // Rock: a wall face on the surface.
    game.host.headless.world.services.terrain.setKind(map.index(30, 30, z), TileKind.Wall, 1);
    const rock = game.fortress.build.ghost(game.fortress.ctx, { x: 30, y: 30, z });
    expect(rock?.reason).toBe('bad_placement');
    expect(rock?.bad).toEqual([map.index(30, 30, z)]);
    expect(game.fortress.build.reasonText(game.fortress.ctx.strings, 'bad_placement', 'floor')).toBe('needs a floor');
    const deep = game.fortress.build.ghost(game.fortress.ctx, { x: 20, y: 20, z: z - 3 });
    expect(deep?.reason).toBe('not_discovered');
    // Place at a cell.
    game.pointerMove(cell(game, 12, 12));
    expect(game.fortress.statusRow2()).toMatch(/^Butcher's shop · click to place/);
    game.pointerDown(cell(game, 12, 12));
    game.pointerUp(cell(game, 12, 12));
    const cmd = spy.mock.calls[0]?.[0] as Command;
    expect(cmd).toMatchObject({ type: 'PlaceBuilding', buildingType: 'butcher', orientation: 0, materialChoice: 0, priority: 5 });
    expect(game.fortress.build.active).toBe(true);
    // x cycles the material, r rotates only rotatable types, Esc leaves the tool, then the panel.
    key(game, 'x');
    key(game, 'r');
    expect(game.fortress.build.orientation).toBe(0);
    key(game, 'Esc');
    expect(game.fortress.build.active).toBe(false);
    expect(game.ui.panel).toBe('build');
    key(game, 'Esc');
    expect(game.ui.panel).toBeNull();
  });
});

describe('T-M2-09 zones tool and the stockpile editor', () => {
  it('a drag submits CreateZone with the qualifying tiles; a click selects; presets and tree toggles submit filters; x removes', async () => {
    const game = await fortressGame();
    const spy = vi.spyOn(game.host, 'submit');
    key(game, 'z');
    // U-03 (D-U2): `s` opens Stocks, so the stockpile accelerator is `[S-s]`.
    key(game, 's', { shift: true });
    expect(game.fortress.zones.kind).toBe('stockpile');
    const map = game.host.readers.map;
    const z = game.ui.z;
    // One wall inside the rectangle: it does not qualify.
    const wx = game.ui.camX + 11;
    const wy = game.ui.camY + 11;
    game.host.headless.world.services.terrain.setKind(map.index(wx, wy, z), TileKind.Wall, 1);
    game.pointerDown(cell(game, 10, 10));
    game.pointerMove(cell(game, 13, 12));
    expect(game.fortress.statusRow2()).toBe('Stockpile 4×3 (12 tiles, 11 qualify)');
    game.pointerUp(cell(game, 13, 12));
    const create = spy.mock.calls[0]?.[0] as Command;
    expect(create['type']).toBe('CreateZone');
    expect(create['zoneType']).toBe('stockpile');
    expect(create['tiles']).toHaveLength(11);
    expect(create['tiles']).not.toContain(map.index(wx, wy, z));
    game.host.step(1);
    const zoneId = game.host.readers.of<BuildingsReader>('14').zoneAt(map.index(wx - 1, wy, z));
    expect(zoneId).not.toBe(0);
    // Esc leaves the tool; a click on the zone selects it.
    key(game, 'Esc');
    game.pointerDown(cell(game, 10, 10));
    expect(game.fortress.zones.selected).toBe(zoneId);
    const preset = game.fortress.zones.nextPreset(game.fortress.ctx);
    expect(preset).toEqual({ type: 'SetStockpileFilter', zoneId, filter: 'food' });
    game.host.submit(preset as Command);
    game.host.step(1);
    expect(game.fortress.zones.presetOf(game.fortress.ctx)).toBe('food');
    const toggled = game.fortress.zones.toggleCategory(game.fortress.ctx, 'food/meat') as Command;
    expect((toggled['filter'] as { categories: string[] }).categories).not.toContain('food');
    expect((toggled['filter'] as { categories: string[] }).categories).toContain('food/fish');
    game.render();
    expect(game.textRows().join('\n')).toContain('Preset [Food');
    expect(game.textRows().join('\n')).toContain('Usage 0/11 tiles');
    // T-247: x unlinks sources; Delete removes the stockpile with the same confirmation.
    key(game, 'Delete');
    expect(game.screen).toBe('confirm');
    expect(spy.mock.calls.at(-1)?.[0]).not.toMatchObject({ type: 'RemoveZone' });
    key(game, 'y');
    expect(spy.mock.calls.at(-1)?.[0]).toEqual({ type: 'RemoveZone', zoneId });
  });
});

describe('T-M2-09 stocks, units, jobs and labors panels', () => {
  it('every registered hotkey opens its panel and Esc closes it; Tab toggles the sidebar', async () => {
    const game = await fortressGame();
    const ids = game.fortress.panels().map((p) => [p.hotkey, p.id]);
    expect(ids).toEqual(expect.arrayContaining([['b', 'build'], ['z', 'zones'], ['s', 'stocks'], ['u', 'units'], ['j', 'jobs'], ['l', 'labors']]));
    for (const [hotkey, id] of ids) {
      key(game, hotkey as string);
      expect(game.ui.panel).toBe(id);
      game.render();
      // U-03 (D-241): Designate opens with Dig chosen, and Esc cancels a tool before the panel.
      if (id === 'designate') key(game, 'Esc');
      key(game, 'Esc');
      expect(game.ui.panel).toBeNull();
    }
    key(game, 'u');
    key(game, 'Tab');
    expect(game.ui.sidebar).toBe(false);
    key(game, 'Tab');
    expect(game.ui.sidebar).toBe(true);
  });

  it('stocks: the tree counts what the wagon brought; forbid submits ForbidItem by type', async () => {
    const game = await fortressGame();
    const spy = vi.spyOn(game.host, 'submit');
    key(game, 's');
    game.render();
    const text = game.textRows().join('\n');
    expect(text).toMatch(/tool\s+\d+/);
    expect(text).toContain('Wealth');
    // Select `tool` (the rows are in category order) and forbid it.
    const rows = game.fortress.stocks.visibleForest(game.fortress.ctx).map((n) => n.id);
    game.fortress.stocks.tree.selected = rows.indexOf('tool');
    // U-03 (D-U2): `f` opens Overlays; forbid is `[S-f]`.
    key(game, 'f', { shift: true });
    const cmds = spy.mock.calls.map((c) => c[0] as Command);
    expect(cmds.length).toBeGreaterThan(0);
    expect(cmds.every((c) => c.type === 'ForbidItem' && c['on'] === true)).toBe(true);
  });

  it('units: a table of every dwarf with profession and activity; the filter narrows it', async () => {
    const game = await fortressGame();
    key(game, 'u');
    const all = game.fortress.units.rows(game.fortress.ctx);
    expect(all).toHaveLength(7);
    const first = game.host.readers.entities.get(all[0] as EntityId, C.Creature)?.name ?? '';
    key(game, '/');
    for (const ch of first.slice(0, 4)) key(game, ch);
    key(game, 'Enter');
    expect(game.fortress.units.rows(game.fortress.ctx).length).toBeGreaterThanOrEqual(1);
    expect(game.fortress.units.rows(game.fortress.ctx).length).toBeLessThan(7);
    game.render();
    expect(game.textRows().join('\n')).toContain(first);
    key(game, 'l');
    expect(game.ui.panel).toBe('labors');
  });

  it('U-02 labors: a click toggles immediately; shift-click toggles the whole column; [a] the row', async () => {
    const game = await fortressGame();
    const spy = vi.spyOn(game.host, 'submit');
    key(game, 'l');
    game.render();
    const rows = game.textRows();
    const dwarves = game.fortress.units.rows(game.fortress.ctx);
    const short = (game.host.readers.entities.get(dwarves[0] as EntityId, C.Creature)?.name ?? '').split(' ')[0] as string;
    const rowIndex = rows.findIndex((r) => r.includes(short));
    expect(rowIndex).toBeGreaterThan(0);
    const colIndex = rows[rowIndex]?.indexOf('■', rows[rowIndex]?.indexOf(short) ?? 0) ?? -1;
    expect(colIndex).toBeGreaterThan(0);
    game.pointerDown(cell(game, colIndex, rowIndex));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ type: 'SetLabor', dwarfId: dwarves[0], on: false });
    game.pointerDown(cell(game, colIndex, rowIndex, { shift: true }));
    expect(spy).toHaveBeenCalledTimes(1 + dwarves.length);
    const column = spy.mock.calls.slice(1).map((c) => c[0] as Command);
    expect(new Set(column.map((c) => c['dwarfId']))).toEqual(new Set(dwarves));
    // U-02: the first paused click has already disabled one cell, so "not all enabled" now
    // makes the following column toggle turn every cell on.
    expect(column.every((c) => c['on'] === true && c['labor'] === column[0]?.['labor'])).toBe(true);
    // U-03 (D-U2): `a` opens the Log; the row toggle is `[S-a]`.
    key(game, 'a', { shift: true });
    expect(spy.mock.calls.length).toBe(1 + dwarves.length + registry.table('labors').ids().length);
  });

  it('jobs: counts, rows with who or why, priority and cancel', async () => {
    const game = await fortressGame();
    const spy = vi.spyOn(game.host, 'submit');
    const map = game.host.readers.map;
    const z = game.ui.z;
    const t = map.index(game.ui.camX + 5, game.ui.camY + 5, z);
    game.host.headless.world.services.terrain.setKind(t, TileKind.Wall, 1);
    game.host.submit({ type: 'Designate', tiles: [t], kind: 'dig', priority: 3 });
    game.host.step(2);
    key(game, 'j');
    game.render();
    expect(game.textRows().join('\n')).toMatch(/\d+ open · \d+ claimed · \d+ blocked/);
    expect(game.textRows().join('\n')).toContain('Dig (');
    // U-03 (D-U2): `p` opens Population; the job priority is `[S-p]`.
    key(game, 'p', { shift: true });
    expect(spy.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'SetJobPriority', priority: 4 });
    key(game, 'x');
    expect(spy.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'CancelJob' });
  });
});
