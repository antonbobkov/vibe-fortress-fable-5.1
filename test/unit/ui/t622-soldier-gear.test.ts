/**
 * T-622: what a soldier carries. The military panel says how many members are armed and who is
 * not, and what to do when the stock has no weapon of the squad's choice; the weapon and armor
 * lists count what is free in stock; the add list names each dwarf's best combat skill and the
 * remove list each member's weapon. Look's dwarf view has the identity line, the needs as bars, the
 * skill bars, the equipment and clothing, the relations and the title.
 *
 * The fortress: seed `t622-gear`, the default embark (its axe and picks are tools, its crossbow a
 * launcher, its one iron spear forbidden), a squad of three on Train preferring spears, every
 * member's hands emptied.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat';
import { cumulativeXp, xpToNext } from '@systems/dwarves';
import { drawMilitaryPanel } from '@ui/panels/military';
import { drawCreatureView } from '@ui/panels/look';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import type { Surface } from '@ui/surface';
import { fgOfText, hexOf, surface, theme } from './ui-fixture';

let game: Game;
let squadId = 0;
let members: EntityId[] = [];

const ROWS = 48;

function drawMilitary(): Surface {
  const s = surface(36, ROWS);
  drawMilitaryPanel(s, { col: 0, row: 0, cols: 36, rows: ROWS }, game.fortress.military, game.fortress.ctx);
  return s;
}

function drawLook(id: EntityId): Surface {
  const s = surface(36, ROWS);
  const pos = game.host.readers.entities.get(id, C.Position);
  const ctx = game.fortress.ctx;
  drawCreatureView(s, { col: 0, row: 0, cols: 36, rows: ROWS }, ctx.readers, ctx.registry, ctx.strings, id, pos?.z ?? 0);
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

function nameOf(id: EntityId): string {
  return game.host.readers.entities.get(id, C.Creature)?.name ?? '';
}

function short(id: EntityId): string {
  const [first, last] = nameOf(id).split(' ');
  return `${first} ${(last ?? '').charAt(0)}.`;
}

const index = (table: string, id: string): number => game.fortress.ctx.registry.table(table).index(id);

/** An iron item made on the first member's tile. */
function spawn(type: string): EntityId {
  const pos = game.host.readers.entities.get(members[0] as EntityId, C.Position);
  if (pos === undefined) throw new Error('no position');
  return game.host.world.services.spawn.item(index('items', type), index('materials', 'iron'), game.host.readers.map.index(pos.x, pos.y, pos.z), 1, 1);
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

function openList(kind: 'weapon' | 'armor' | 'add' | 'remove'): string[] {
  game.fortress.military.openChoice(game.fortress.ctx, kind);
  const lines = rows(drawMilitary());
  game.fortress.military.memberChoice = null;
  return lines.map((line) => line.trim());
}

describe('T-622 the armed line, the stock counts and the dwarf inspector', () => {
  beforeAll(async () => {
    game = new Game({ canvas: new MockCanvas(), seed: 't622-gear', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    game.host.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    game.host.step(1);
    squadId = game.host.readers.of<CombatReader>('16').squads()[0]?.id ?? 0;
    members = game.host.readers.of<{ list(): number[] }>('10').list().slice(0, 3);
    game.host.submit({ type: 'SetSquadMembers', squadId, members });
    game.host.submit({ type: 'SetSquadMode', squadId, mode: 'train' });
    const squad = game.host.readers.of<CombatReader>('16').squad(squadId);
    game.host.submit({ type: 'SetSquadEquipment', squadId, equipment: { ...squad?.equipment, weaponClass: 'spear' } });
    game.host.submit({ type: 'AssignTitle', dwarfId: members[0], title: 'thane' });
    // The wagon's iron spear is forbidden, so the stock begins with no spear to claim.
    const wagonSpears = game.host.readers.entities.with(C.Item).filter((id) => game.host.readers.entities.get(id, C.Item)?.type === index('items', 'spear'));
    expect(wagonSpears.length).toBe(1);
    for (const itemId of wagonSpears) game.host.submit({ type: 'ForbidItem', itemId, on: true });
    game.host.step(1);
    // Nothing in hand: no weapon, and no tool to fight with. The test steps no further, so no claim follows.
    for (const id of members) {
      const equip = game.host.world.entities.get(id, C.Equipment);
      if (equip !== undefined) equip.weapon = 0;
      const worker = game.host.world.entities.get(id, C.Worker);
      if (worker !== undefined) worker.toolId = 0;
    }
  });

  it('an unarmed squad says so in the alert colour, and what to do when no spear is in stock', () => {
    const s = drawMilitary();
    const lines = rows(s);
    const armed = wrapped(lines, 'Armed');
    expect(armed.text).toBe(`Armed 0 of 3 · unarmed: ${members.map(short).join(', ')}`);
    expect(fgOfText(s, armed.row, 'Armed')).toBe(hexOf(theme.alert));
    // The line sits under the members, their keys and what they are doing now (T-771).
    const now = wrapped(lines, 'Now:');
    expect(lines[now.row - 1]?.trim()).toBe('[a] add  [r] remove');
    let end = now.row + 1;
    while (/^ {2,}\S/.test(lines[end] ?? '')) end += 1;
    expect(armed.row).toBe(end);
    const stock = wrapped(lines, 'No spear');
    expect(stock.text).toBe('No spear in stock: order one at a forge [o] or buy one.');
    expect(fgOfText(s, stock.row, 'No spear')).toBe(hexOf(theme.alert));
  });

  it('the weapon and armor lists count what is free in stock, and say which of it is a tool', () => {
    const weapons = openList('weapon');
    // The embark brings an axe and two picks, all tools a worker takes first, and the hunter's crossbow.
    expect(weapons).toContain('any (3, all tools)');
    expect(weapons).toContain('axe (1, a tool)');
    expect(weapons).toContain('pick (2, all tools)');
    expect(weapons).toContain('crossbow (1)');
    expect(weapons).toContain('spear (0, current)');
    expect(openList('armor')).toEqual(expect.arrayContaining(['any (0, current)', 'metal (0)', 'leather (0)']));
    spawn('helm');
    spawn('spear');
    spawn('spear');
    expect(openList('weapon')).toContain('spear (2, current)');
    expect(openList('armor')).toEqual(expect.arrayContaining(['any (1, current)', 'metal (1)', 'leather (0)']));
  });

  it('with spears in stock the stock line goes; a member with another class is named', () => {
    const [a, b, c] = members as [EntityId, EntityId, EntityId];
    let lines = rows(drawMilitary());
    expect(wrapped(lines, 'Armed').text).toBe(`Armed 0 of 3 · unarmed: ${short(a)}, ${short(b)}, ${short(c)}`);
    expect(lines.some((line) => line.startsWith('No spear'))).toBe(false);
    const spears = game.host.readers.entities.at(game.host.readers.map.index(
      game.host.readers.entities.get(a, C.Position)?.x ?? 0, game.host.readers.entities.get(a, C.Position)?.y ?? 0, game.host.readers.entities.get(a, C.Position)?.z ?? 0,
    )).filter((id) => game.host.readers.entities.get(id, C.Item)?.type === index('items', 'spear'));
    expect(spears.length).toBe(2);
    arm(a, spears[0] as EntityId);
    arm(b, spawn('axe'));
    lines = rows(drawMilitary());
    expect(wrapped(lines, 'Armed').text).toBe(`Armed 2 of 3 · unarmed: ${short(c)} · no spear: ${short(b)}`);
    expect(openList('remove')).toEqual(expect.arrayContaining([`${nameOf(a)}  iron spear`, `${nameOf(b)}  iron axe`, `${nameOf(c)}  unarmed`]));
    arm(b, spawn('spear'));
    arm(c, spears[1] as EntityId);
    const s = drawMilitary();
    lines = rows(s);
    const armed = wrapped(lines, 'Armed');
    expect(armed.text).toBe('Armed 3 of 3');
    expect(fgOfText(s, armed.row, 'Armed')).toBe(hexOf(theme.text));
  });

  it('the add list gives each free dwarf its best combat skill', () => {
    const free = game.host.readers.of<{ list(): number[] }>('10').list().filter((id) => !members.includes(id));
    const recruit = free[0] as EntityId;
    const skills = game.host.world.entities.get(recruit, C.Skills);
    if (skills === undefined) throw new Error('no skills');
    skills.level.fill(0);
    skills.level[index('skills', 'crossbow')] = 3;
    skills.level[index('skills', 'mining')] = 9;
    const listed = openList('add');
    expect(listed).toContain(`${nameOf(recruit)}  Crossbow 3`);
  });

  it('Look gives a dwarf its identity, needs, skill bars, equipment, clothing, relations and title, in that order', () => {
    const [a, b, c] = members as [EntityId, EntityId, EntityId];
    const needs = game.host.world.entities.get(a, C.Needs);
    if (needs === undefined) throw new Error('no needs');
    Object.assign(needs, { hunger: 90, thirst: 55, rest: 10, social: 0, comfort: 0, purpose: 0, joy: 0 });
    const skills = game.host.world.entities.get(a, C.Skills);
    if (skills === undefined) throw new Error('no skills');
    const mining = index('skills', 'mining');
    const level = skills.level[mining] ?? 0;
    skills.xp[mining] = cumulativeXp(level) + Math.floor(xpToNext(level) / 2);
    const relations = game.host.world.entities.get(a, C.Relationships);
    if (relations === undefined) throw new Error('no relationships');
    relations.friends = [b];
    relations.grudges = [{ id: c, untilTick: game.host.readers.calendar.tick + 1000 }];

    const s = drawLook(a);
    const lines = rows(s);
    const at = (head: string): number => lines.findIndex((line) => line.startsWith(head));
    expect(lines[0]).toBe('Miner · adult · The Hearthguard');
    expect(lines[1]).toMatch(/^Activity: /);
    expect(lines[2]).toMatch(/^At \(\d+, \d+, z\d+\)/);
    expect(lines[4]).toBe('Needs');
    expect(lines[5]).toBe('hunger  ▓▓▓░  90 thirst  ▓▓░░  55');
    // Critical in the warning colour, wanted in the alert colour, the rest plain.
    expect(fgOfText(s, 5, 'hunger')).toBe(hexOf(theme.bad));
    expect(fgOfText(s, 5, 'thirst')).toBe(hexOf(theme.alert));
    expect(lines[6]).toBe('rest    ░░░░  10 social  ░░░░   0');
    expect(fgOfText(s, 6, 'rest')).toBe(hexOf(theme.text));
    expect(lines[8]).toBe('joy     ░░░░   0');
    expect(lines[9]).toBe('Skills');
    expect(lines.find((line) => line.startsWith('  Mining'))).toMatch(/^ {2}Mining \d+ \(\w+\) ▓▓░░░$/);
    expect(wrapped(lines, 'Equipment').text).toBe('Equipment iron spear');
    expect(wrapped(lines, 'Wearing').text).toMatch(/^Wearing \S/);
    expect(wrapped(lines, 'Relations').text.replace(/ +/g, ' ')).toBe(`Relations friends: ${nameOf(b)}; grudges: ${nameOf(c)}`);
    expect(lines[at('Title')]).toBe('Title Thane');
    const order = ['Miner', 'Activity', 'Needs', 'Skills', 'Mood', 'Health', 'Equipment', 'Wearing', 'Relations', 'Title'].map(at);
    expect(order.every((row) => row >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it('a dwarf with nothing in hand says so', () => {
    const recruit = game.host.readers.of<{ list(): number[] }>('10').list().find((id) => !members.includes(id)) as EntityId;
    const equip = game.host.world.entities.get(recruit, C.Equipment);
    if (equip !== undefined) equip.weapon = 0;
    const worker = game.host.world.entities.get(recruit, C.Worker);
    if (worker !== undefined) worker.toolId = 0;
    const lines = rows(drawLook(recruit));
    expect(lines).toContain('Equipment none');
    expect(lines.some((line) => line.startsWith('Title'))).toBe(false);
    expect(lines[0]).toMatch(/ · adult$/);
  });
});
