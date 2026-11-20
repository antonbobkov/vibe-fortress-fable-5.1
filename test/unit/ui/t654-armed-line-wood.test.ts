/**
 * T-654: the Military panel's armed line counts the training weapons apart from the real ones at
 * all times ("Armed 3 of 3 (3 wooden)"). It is in the alert colour only when no real weapon is free
 * for the members holding wood, for then they could not take one up in a fight (16 § Training), and
 * the stock line under it then says what to order. The stock line leaves out free training weapons:
 * a spare wooden sword does not hide "No sword in stock".
 *
 * The fortress: seed `t654-wood`, the default embark (its axe and picks are tools that the workers
 * lacking them claim first, its crossbow a launcher), a squad of three on Train preferring swords,
 * each member holding an oak training sword, with a spare one in stock.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat';
import { drawMilitaryPanel } from '@ui/panels/military';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import type { Surface } from '@ui/surface';
import { fgOfText, hexOf, surface, theme } from './ui-fixture';

let game: Game;
let members: EntityId[] = [];

const ROWS = 48;

function drawMilitary(): Surface {
  const s = surface(36, ROWS);
  drawMilitaryPanel(s, { col: 0, row: 0, cols: 36, rows: ROWS }, game.fortress.military, game.fortress.ctx);
  return s;
}

function rows(s: Surface): string[] {
  return s.lines().map((line) => line.trimEnd().replace(/^ /, ''));
}

/** A wrapped line read whole: the row that starts with `head` and its indented continuation rows. */
function wrapped(lines: readonly string[], head: string): { row: number; text: string } {
  const row = lines.findIndex((line) => line.startsWith(head));
  if (row < 0) return { row, text: '' };
  let text = lines[row] as string;
  for (let k = row + 1; k < lines.length && /^ {2,}\S/.test(lines[k] as string); k += 1) text += ` ${(lines[k] as string).trim()}`;
  return { row, text };
}

const index = (table: string, id: string): number => game.fortress.ctx.registry.table(table).index(id);

/** An item made on the first member's tile. */
function spawn(type: string, material: string): EntityId {
  const pos = game.host.readers.entities.get(members[0] as EntityId, C.Position);
  if (pos === undefined) throw new Error('no position');
  return game.host.world.services.spawn.item(index('items', type), index('materials', material), game.host.readers.map.index(pos.x, pos.y, pos.z), 1, 1);
}

/** The soldier takes a weapon as the military's claim does: carried, owned and held. */
function arm(soldier: EntityId, item: EntityId): void {
  const items = game.host.world.services.items;
  if (items === null) throw new Error('no item API');
  items.attachToCarrier(item, soldier);
  items.setOwner(item, soldier);
  const equip = game.host.world.entities.get(soldier, C.Equipment);
  if (equip === undefined) throw new Error('no equipment');
  equip.weapon = item;
}

function openWeapons(): string[] {
  game.fortress.military.openChoice(game.fortress.ctx, 'weapon');
  const lines = rows(drawMilitary());
  game.fortress.military.memberChoice = null;
  return lines.map((line) => line.trim());
}

describe('T-654 the armed line counts wooden weapons', () => {
  beforeAll(async () => {
    game = new Game({ canvas: new MockCanvas(), seed: 't654-wood', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    game.host.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    game.host.step(1);
    const squadId = game.host.readers.of<CombatReader>('16').squads()[0]?.id ?? 0;
    members = game.host.readers.of<{ list(): number[] }>('10').list().slice(0, 3);
    game.host.submit({ type: 'SetSquadMembers', squadId, members });
    game.host.submit({ type: 'SetSquadMode', squadId, mode: 'train' });
    const squad = game.host.readers.of<CombatReader>('16').squad(squadId);
    game.host.submit({ type: 'SetSquadEquipment', squadId, equipment: { ...squad?.equipment, weaponClass: 'sword' } });
    game.host.step(1);
    // Each member holds a training sword and no tool. The test steps no further, so no claim follows.
    for (const id of members) {
      const worker = game.host.world.entities.get(id, C.Worker);
      if (worker !== undefined) worker.toolId = 0;
      arm(id, spawn('training_sword', 'oak'));
    }
    spawn('training_sword', 'oak');
  });

  it('with no real weapon free, the wooden count is in the alert colour and the stock line says to order a sword', () => {
    // The only real weapons in stock are the embark's tools, which the workers lacking them take first, and a crossbow.
    expect(openWeapons()).toEqual(expect.arrayContaining(['axe (1, a tool)', 'pick (2, all tools)', 'crossbow (1)', 'sword (1, wooden, current)']));
    const s = drawMilitary();
    const lines = rows(s);
    const armed = wrapped(lines, 'Armed');
    expect(armed.text).toBe('Armed 3 of 3 (3 wooden)');
    expect(fgOfText(s, armed.row, 'Armed')).toBe(hexOf(theme.alert));
    // The spare wooden sword in stock does not count: there is no sword to fight with.
    const stock = wrapped(lines, 'No sword');
    expect(stock.text).toBe("No sword in stock: order one at a craftsdwarf's workshop or a forge [o] or buy one.");
    expect(fgOfText(s, stock.row, 'No sword')).toBe(hexOf(theme.alert));
  });

  it('with an iron spear free, the line keeps the count in the normal colour and the stock line goes', () => {
    spawn('spear', 'iron');
    const s = drawMilitary();
    const lines = rows(s);
    const armed = wrapped(lines, 'Armed');
    expect(armed.text).toBe('Armed 3 of 3 (3 wooden)');
    expect(fgOfText(s, armed.row, 'Armed')).toBe(hexOf(theme.text));
    expect(lines.some((line) => line.startsWith('No sword'))).toBe(false);
  });
});
