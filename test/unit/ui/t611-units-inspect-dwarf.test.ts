/**
 * T-611: inspecting a dwarf from Units (or a unit row's double click, or its name in a log line)
 * opens Look at the Creatures tab with that dwarf first; the tabs line shortens rather than cuts;
 * the Units list keeps each activity in its column; the sleep keys say what they do.
 */
import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { C } from '@core/components';
import type { Position } from '@core/components';
import type { EntityId, TileIndex } from '@core/types';
import { drawUnitsPanel, nameOf } from '@ui/panels/units';
import { drawTooltip } from '@ui/widgets';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, surface } from './ui-fixture';

const registry = loadContent();

async function fortress(seed: string): Promise<Game> {
  const g = new Game({ canvas: new MockCanvas(), seed, registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await g.start({ embark: 'default' });
  return g;
}

function dwarves(g: Game): EntityId[] {
  return g.host.readers.of<{ list(): EntityId[] }>('10').list();
}

function pointOf(g: Game, tile: TileIndex): { x: number; y: number; z: number } {
  const { w, h } = g.host.readers.map;
  return { x: tile % w, y: Math.floor(tile / w) % h, z: Math.floor(tile / (w * h)) };
}

/** Move a creature at once, keeping the spatial index in step. */
function teleport(g: Game, id: EntityId, to: TileIndex): void {
  const headless = g.host.headless;
  const ent = headless.world.entities;
  const from = headless.spatial.tileOf(id);
  const pos = ent.get<Position>(id, C.Position) as Position;
  ent.add(id, C.Position, { ...pos, ...pointOf(g, to) });
  headless.spatial.move(id, from, to);
}

/** Every dwarf on the first dwarf's tile, as at the wagon in the first days. */
function gather(g: Game): TileIndex {
  const map = g.host.readers.map;
  const ids = dwarves(g);
  const p = g.host.readers.entities.get(ids[0] as EntityId, C.Position) as Position;
  const tile = map.index(p.x, p.y, p.z);
  for (const id of ids.slice(1)) teleport(g, id, tile);
  return tile;
}

function cell(g: Game, col: number, row: number, clicks = 1): { x: number; y: number; button: number; shift: boolean; ctrl: boolean; alt: boolean; meta: boolean; clicks: number } {
  const c = g.cellCenter(col, row);
  return { x: c.x, y: c.y, button: 0, shift: false, ctrl: false, alt: false, meta: false, clicks };
}

/** The creature whose view Look shows, by the name its title row carries. */
function firstCreature(g: Game): string {
  g.render();
  const at = g.fortress.lookAt;
  const name = at.kind === 'creature' ? nameOf(g.fortress.ctx, at.id) : '';
  const title = g.textRows().find((r) => r.includes('[x]') && r.includes(name)) ?? '';
  return name !== '' && title !== '' ? name : '';
}

describe('T-611 inspecting a dwarf from Units shows that dwarf', () => {
  it('seven dwarves on one tile: Enter on the fourth in Units opens that dwarf\'s view', async () => {
    const g = await fortress('t611-units');
    const tile = gather(g);
    expect(g.host.readers.entities.at(tile).filter((id) => g.host.readers.entities.has(id, C.Creature)).length).toBeGreaterThanOrEqual(7);
    g.handleKey(press('u'));
    for (let k = 0; k < 3; k += 1) g.handleKey(press('↓'));
    const chosen = g.fortress.units.selectedId(g.fortress.ctx);
    expect(dwarves(g).indexOf(chosen)).toBeGreaterThan(0);
    g.handleKey(press('Enter'));
    expect(g.ui.panel).toBe('look');
    expect(g.fortress.lookAt).toMatchObject({ kind: 'creature', id: chosen });
    expect(firstCreature(g)).toBe(nameOf(g.fortress.ctx, chosen));
    // Look opened by the look key: the tile list of the tile.
    g.handleKey(press('Esc'));
    g.fortress.look(pointOf(g, tile));
    expect(g.fortress.lookAt.kind).toBe('tile');
  });

  it('a double click on a unit row inspects that unit', async () => {
    const g = await fortress('t611-double');
    gather(g);
    g.handleKey(press('u'));
    g.render();
    const rows = g.textRows();
    const ids = g.fortress.units.rows(g.fortress.ctx);
    const target = ids[2] as EntityId;
    const name = nameOf(g.fortress.ctx, target).slice(0, 8);
    const row = rows.findIndex((r) => r.includes(name));
    expect(row).toBeGreaterThan(0);
    const col = (rows[row] as string).indexOf(name);
    g.pointerDown(cell(g, col, row, 1));
    g.pointerUp(cell(g, col, row, 1));
    g.pointerDown(cell(g, col, row, 2));
    g.pointerUp(cell(g, col, row, 2));
    expect(g.ui.panel).toBe('look');
    expect(firstCreature(g)).toBe(nameOf(g.fortress.ctx, target));
  });

  it('a click on a dwarf\'s name in a log line inspects that dwarf', async () => {
    const g = await fortress('t611-log');
    const tile = gather(g);
    const target = dwarves(g)[5] as EntityId;
    const name = nameOf(g.fortress.ctx, target);
    g.fortress.log.append('note', `${name} has had a fine meal.`, g.host.readers.calendar.tick, tile);
    g.handleKey(press('a'));
    g.render();
    const rows = g.textRows();
    const row = rows.findIndex((r) => r.includes(name));
    expect(row).toBeGreaterThan(0);
    const col = (rows[row] as string).indexOf(name) + 1;
    g.pointerDown(cell(g, col, row));
    g.pointerUp(cell(g, col, row));
    expect(g.ui.panel).toBe('look');
    expect(g.fortress.lookAt.kind).toBe('creature');
    expect(firstCreature(g)).toBe(name);
  });

  it('the Units list keeps each activity in its column, and the sleep keys say what they do', async () => {
    const g = await fortress('t611-list');
    g.handleKey(press('u'));
    const s = surface(36, 40);
    drawUnitsPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, g.fortress.units, g.fortress.ctx);
    const before = s.lines();
    expect(before.some((line) => line.includes('sleep ') && line.includes('[[] earlier') && line.includes('[]] later'))).toBe(true);
    // Hovering the mood glyph or the name of the third row draws no box over the second row.
    const third = before.findIndex((line) => line.includes(nameOf(g.fortress.ctx, g.fortress.units.rows(g.fortress.ctx)[2] as EntityId).slice(0, 8)));
    expect(third).toBeGreaterThan(1);
    for (const col of [15, 3]) {
      const hovered = surface(36, 40);
      drawUnitsPanel(hovered, { col: 0, row: 0, cols: 36, rows: 40 }, g.fortress.units, g.fortress.ctx);
      expect(hovered.tooltipAt(col, third)).not.toBeNull();
      drawTooltip(hovered, { col, row: third });
      expect(hovered.lines()[third - 1]).toBe(before[third - 1]);
    }
  });
});
