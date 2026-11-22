/**
 * T-669: a click opens what it lands on, and a creature's view follows the creature (24 §
 * Inspection, `ui-screens/fortress-screen.md` § Inspection panel). The click ladder: the creature
 * the map shows, else a loose item, else the building, else the zone, else the bare tile, a crowd
 * opening the tile list; the tile list with its digits, `Enter` and the cursor; the creature view
 * that holds its creature and moves the cursor with it; `[h]` and `Backspace`.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { clickRung, creaturesAt, drawCreatureView, drawTileList, tileContents, tileListRows } from '@ui/panels/look';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import type { CellPointer } from '@ui/screen';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);

interface Fixture {
  readonly w: TestWorld;
  readonly screen: FortressScreen;
  readonly sent: Command[];
}

function setup(seed: string): Fixture {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const sent: Command[] = [];
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
    speed: () => 0,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => LAYOUT,
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    confirm: (_id, _params, reply) => reply(true),
  };
  return { w, screen: new FortressScreen(host, keymap, strings), sent };
}

function cellOf(f: Fixture, x: number, y: number, button = 0): CellPointer {
  return { col: LAYOUT.map.col + x - f.screen.ui.camX, row: LAYOUT.map.row + y - f.screen.ui.camY, button, shift: false, ctrl: false, alt: false, meta: false };
}

function click(f: Fixture, x: number, y: number, button = 0): void {
  f.screen.pointerDown(cellOf(f, x, y, button));
  f.screen.pointerUp(cellOf(f, x, y, button));
}

/** The sidebar as text: its title row first. */
function sidebar(f: Fixture): string[] {
  const s = surface(80, 42);
  f.screen.draw(s);
  const bar = LAYOUT.sidebar;
  if (bar === null) return [];
  return s.lines().map((line) => Array.from(line).slice(bar.col + 1).join('').trimEnd());
}

function hostile(w: TestWorld, at: TileIndex, spotted: boolean): EntityId {
  const id = w.spawnCreature('gloam_warrior', at, 'hostile:gloam');
  w.game.world.entities.add(id, C.Hostile, { partyId: 0, role: 'thief', behaviorState: 'sneak', stealthed: true, spotted, breakingDoorId: 0, breakingSince: 0 });
  return id;
}

describe('T-669 the click ladder', () => {
  const w = new TestWorld({ seed: 't669-ladder', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const readers = w.readers;

  it('a creature the map shows comes first: one opens its view, several the tile list', () => {
    const one = w.index(10, 10, z);
    const dwarf = w.spawnDwarf({ at: one });
    w.spawnItem('log', 'oak', one);
    expect(clickRung(readers, one)).toEqual({ kind: 'creature', id: dwarf });
    const two = w.index(12, 10, z);
    w.spawnDwarf({ at: two });
    w.spawnDwarf({ at: two });
    expect(clickRung(readers, two)).toEqual({ kind: 'list' });
  });

  it('then a loose item: one opens it, several the tile list; a barrel counts as one item', () => {
    const one = w.index(14, 10, z);
    const log = w.spawnItem('log', 'oak', one);
    expect(clickRung(readers, one)).toEqual({ kind: 'item', id: log });
    const barrelTile = w.index(16, 10, z);
    const barrel = w.spawnItem('barrel', 'oak', barrelTile);
    w.spawnItem('drink', 'ale', { containerId: barrel }, 20);
    expect(clickRung(readers, barrelTile)).toEqual({ kind: 'item', id: barrel });
    const two = w.index(18, 10, z);
    w.spawnItem('log', 'oak', two);
    w.spawnItem('raw_stone', 'granite', two);
    expect(clickRung(readers, two)).toEqual({ kind: 'list' });
  });

  it('then the building, then the zone, then the bare tile; a dwarf on a building is the dwarf', () => {
    const table = w.index(20, 14, z);
    const id = w.build('table', table, 'oak');
    expect(clickRung(readers, table)).toEqual({ kind: 'building', id });
    const pile = [w.index(24, 14, z), w.index(25, 14, z)];
    const zone = w.zone('stockpile', pile);
    expect(clickRung(readers, pile[0] as TileIndex)).toEqual({ kind: 'zone', id: zone });
    const stone = w.spawnItem('raw_stone', 'granite', pile[1] as TileIndex);
    expect(clickRung(readers, pile[1] as TileIndex)).toEqual({ kind: 'item', id: stone });
    expect(clickRung(readers, w.index(30, 30, z))).toEqual({ kind: 'tile' });
    const worker = w.spawnDwarf({ at: table });
    expect(clickRung(readers, table)).toEqual({ kind: 'creature', id: worker });
  });

  it('an undiscovered tile is bare: what stands on it is not given away', () => {
    const tile = w.index(32, 32, z);
    w.spawnDwarf({ at: tile });
    w.discover(tile, false);
    expect(clickRung(readers, tile)).toEqual({ kind: 'tile' });
    expect(tileListRows(readers, registry, strings, tile)).toEqual([]);
  });

  it('a stealthed hostile no dwarf has spotted is not given away by the ladder, the list, the view or the hover line', () => {
    const tile = w.index(40, 20, z);
    const thief = hostile(w, tile, false);
    expect(clickRung(readers, tile)).toEqual({ kind: 'tile' });
    expect(creaturesAt(readers, tile)).toEqual([]);
    expect(tileListRows(readers, registry, strings, tile)).toEqual([]);
    expect(tileContents(readers, registry, strings, tile)).not.toContain(readers.entities.get(thief, C.Creature)?.name ?? '?');
    const s = surface(36, 20);
    drawCreatureView(s, { col: 0, row: 0, cols: 36, rows: 20 }, readers, registry, strings, thief, z, undefined, tile);
    expect(s.lines().slice(0, 2).map((line) => line.trim()).join(' ')).toBe(`Out of sight. Last seen at (40, 20, z${z})`);
    // Spotted, it is drawn, and opens as any creature does.
    w.game.world.entities.add(thief, C.Hostile, { ...(readers.entities.get(thief, C.Hostile) as NonNullable<ReturnType<typeof readers.entities.get>>), spotted: true } as never);
    expect(clickRung(readers, tile)).toEqual({ kind: 'creature', id: thief });
  });

  it('lists the creatures dwarves first, then animals, then the rest, whatever their ids', () => {
    const tile = w.index(44, 24, z);
    const raider = hostile(w, tile, true);
    const dog = w.spawnTame('dog', tile);
    const dwarf = w.spawnDwarf({ at: tile });
    expect(creaturesAt(readers, tile)).toEqual([dwarf, dog, raider]);
  });
});

describe('T-669 the tile list', () => {
  it('numbers what it can open, writes each thing with its glyph and one fact, and the tile under it', () => {
    const w = new TestWorld({ seed: 't669-list', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const tile = w.index(20, 20, z);
    const a = w.spawnDwarf({ at: tile, name: 'Brida Darkfell' });
    const b = w.spawnDwarf({ at: tile, name: 'Ulf Emberaxe' });
    w.spawnItem('log', 'oak', tile);
    const barrel = w.spawnItem('barrel', 'oak', tile);
    w.spawnItem('drink', 'ale', { containerId: barrel }, 20);
    const pile = w.zone('stockpile', [tile, w.index(21, 20, z)]);
    w.submit({ type: 'Designate', tiles: [w.index(20, 21, z)], kind: 'dig' });
    const s = surface(36, 20);
    const numbered = drawTileList(s, { col: 0, row: 0, cols: 36, rows: 20 }, w.readers, registry, strings, tile, undefined, (t) => t.kind !== 'item');
    const lines = s.lines().map((line) => line.trimEnd());
    expect(lines[0]?.trim()).toMatch(/ floor/);
    expect(lines[1]).toMatch(/─ Here ─/);
    expect(lines[2]).toMatch(/^ 1 ☺ Brida Darkfell/);
    expect(lines[3]).toMatch(/^ 2 ☺ Ulf Emberaxe/);
    expect(lines[4]).toMatch(/^ {3}\S oak log +x1 · \d+ ☼$/);
    expect(lines[5]).toMatch(/^ {3}\S oak barrel/);
    expect(lines[6]).toMatch(/^ {7}20 ale/);
    expect(lines[7]).toMatch(/^ 3 ░ Stockpile #\d+ +2 tiles$/);
    expect(lines.at(-1)?.trim()).toBe('[1]-[9] open  [Enter] the first');
    expect(numbered).toEqual([{ kind: 'creature', id: a }, { kind: 'creature', id: b }, { kind: 'zone', id: pile }]);
  });

  it('on the screen: a crowd opens the list; a digit opens its row, Backspace returns, Enter opens the first', () => {
    const f = setup('t669-list-keys');
    const tile = f.w.index(20, 20, z);
    const a = f.w.spawnDwarf({ at: tile });
    const b = f.w.spawnDwarf({ at: tile });
    click(f, 20, 20);
    expect(f.screen.ui.panel).toBe('look');
    expect(f.screen.lookAt.kind).toBe('tile');
    expect(sidebar(f)[0]).toMatch(new RegExp(`^ Tile \\(20, 20, z${z}\\)`));
    expect(f.screen.key(press('2'))).toBe(true);
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: b });
    expect(f.screen.key(press('Backspace'))).toBe(true);
    expect(f.screen.lookAt.kind).toBe('tile');
    expect(f.screen.ui.cursor).toEqual({ x: 20, y: 20 });
    expect(f.screen.key(press('Enter'))).toBe(true);
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: a });
    // A click on a row opens it too.
    f.screen.key(press('Backspace'));
    const s = surface(80, 42);
    f.screen.draw(s);
    const row = s.lines().findIndex((line) => line.includes(f.w.readers.entities.get(b, C.Creature)?.name ?? '?'));
    s.hits.find((h) => h.rect.row === row && h.rect.col > (LAYOUT.sidebar?.col ?? 0))?.action();
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: b });
  });

  it('the list follows the cursor: the arrows move it, and the list is of the tile under it', () => {
    const f = setup('t669-list-cursor');
    const dwarf = f.w.spawnDwarf({ at: f.w.index(21, 20, z) });
    f.screen.look({ x: 20, y: 20, z });
    expect(f.screen.key(press('→'))).toBe(true);
    expect(f.screen.ui.cursor).toEqual({ x: 21, y: 20 });
    expect(f.screen.lookTile()).toBe(f.w.index(21, 20, z));
    expect(f.screen.key(press('1'))).toBe(true);
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
  });

  it('right click always lists the tile; a second click on an open creature lists it too', () => {
    const f = setup('t669-right');
    const tile = f.w.index(20, 20, z);
    const dwarf = f.w.spawnDwarf({ at: tile });
    click(f, 20, 20, 2);
    expect(f.screen.lookAt.kind).toBe('tile');
    click(f, 20, 20);
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
    expect(sidebar(f)[0]).toContain(f.w.readers.entities.get(dwarf, C.Creature)?.name ?? '?');
    click(f, 20, 20);
    expect(f.screen.lookAt.kind).toBe('tile');
  });

  it('a click on a building opens its panel, and the building row of the list does the same; the lever is pulled there', () => {
    const f = setup('t669-building');
    const leverTile = f.w.index(30, 30, z);
    const lever = f.w.build('lever', leverTile, 'granite');
    click(f, 30, 30);
    expect(f.screen.ui.panel).toBe('building');
    f.screen.look({ x: 30, y: 30, z });
    expect(f.screen.key(press('1'))).toBe(true);
    expect(f.screen.ui.panel).toBe('building');
    expect(f.screen.key(press('y'))).toBe(true);
    expect(f.sent).toContainEqual({ type: 'PullLever', leverId: lever });
  });

  it('a click on an empty stockpile tile opens its settings in Zones; map clicks stay the ladder\'s, z keeps picking zones', () => {
    const f = setup('t669-zone');
    const tiles = [f.w.index(30, 30, z), f.w.index(31, 30, z)];
    const pile = f.w.zone('stockpile', tiles);
    const other = f.w.zone('stockpile', [f.w.index(36, 30, z)]);
    click(f, 30, 30);
    expect(f.screen.ui.panel).toBe('zones');
    expect(f.screen.zones.selected).toBe(pile);
    // Bare ground: the ladder's tile list, not the zone picker's silence.
    click(f, 34, 26);
    expect(f.screen.ui.panel).toBe('look');
    // Zones opened with z: a click selects the zone there, as before.
    f.screen.key(press('Esc'));
    f.screen.key(press('z'));
    expect(f.screen.ui.panel).toBe('zones');
    click(f, 36, 30);
    expect(f.screen.ui.panel).toBe('zones');
    expect(f.screen.zones.selected).toBe(other);
  });
});

describe('T-669 the creature view', () => {
  it('holds its creature: after it walks off, the view is still its own, the At line and the cursor follow it', () => {
    const f = setup('t669-follow');
    const tile = f.w.index(20, 20, z);
    const dwarf = f.w.spawnDwarf({ at: tile });
    f.w.spawnDwarf({ at: tile });
    click(f, 20, 20);
    f.screen.key(press('1'));
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
    let rows = sidebar(f);
    expect(rows.find((row) => row.startsWith(' At '))).toBe(` At (20, 20, z${z}) · 1 more here`);
    f.w.movement.teleport(dwarf, f.w.index(26, 23, z));
    rows = sidebar(f);
    expect(rows[0]).toContain(f.w.readers.entities.get(dwarf, C.Creature)?.name ?? '?');
    expect(rows.find((row) => row.startsWith(' At '))).toBe(` At (26, 23, z${z})`);
    expect(f.screen.ui.cursor).toEqual({ x: 26, y: 23 });
    expect(f.screen.lookTile()).toBe(f.w.index(26, 23, z));
    // The arrows pan the map in the view; they do not move the cursor off the creature.
    f.screen.key(press('←'));
    expect(f.screen.ui.cursor).toEqual({ x: 26, y: 23 });
    // A level apart, the line says how far.
    const below = f.w.index(26, 23, z - 1);
    f.w.carve(below, TileKind.Floor);
    f.w.discover(below);
    f.w.movement.teleport(dwarf, below);
    expect(sidebar(f).find((row) => row.startsWith(' At '))).toBe(` At (26, 23, z${z - 1}) · 1 level down`);
  });

  it('[h] lists the tile it stands on now; Backspace returns to it; another panel drops the history', () => {
    const f = setup('t669-here');
    const dwarf = f.w.spawnDwarf({ at: f.w.index(20, 20, z) });
    click(f, 20, 20);
    f.w.movement.teleport(dwarf, f.w.index(22, 21, z));
    sidebar(f);
    expect(f.screen.key(press('h'))).toBe(true);
    expect(f.screen.lookAt.kind).toBe('tile');
    expect(f.screen.ui.cursor).toEqual({ x: 22, y: 21 });
    expect(f.screen.key(press('Backspace'))).toBe(true);
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
    expect(f.screen.lookBack).toEqual([]);
    expect(f.screen.key(press('Backspace'))).toBe(false);
    f.screen.key(press('h'));
    f.screen.key(press('u'));
    expect(f.screen.lookBack).toEqual([]);
    expect(f.screen.lookAt.kind).toBe('tile');
  });

  it('Units Enter opens the dwarf\'s view at once, not its tile', () => {
    const f = setup('t669-units');
    const dwarf = f.w.spawnDwarf({ at: f.w.index(20, 20, z) });
    f.w.spawnDwarf({ at: f.w.index(20, 20, z) });
    f.screen.inspectCreature(dwarf);
    expect(f.screen.ui.panel).toBe('look');
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
    expect(f.screen.lookBack).toEqual([]);
  });

  it('a creature gone from the map keeps its title and says it left the map, and where it was last', () => {
    const f = setup('t669-gone');
    const dwarf = f.w.spawnDwarf({ at: f.w.index(20, 20, z) });
    const name = f.w.readers.entities.get(dwarf, C.Creature)?.name ?? '?';
    click(f, 20, 20);
    sidebar(f);
    f.w.game.world.entities.destroy(dwarf);
    const rows = sidebar(f);
    expect(rows[0]).toContain(name);
    expect(rows[2]).toBe(' Left the map.');
    expect(rows[3]).toBe(` Last at (20, 20, z${z})`);
  });
});
