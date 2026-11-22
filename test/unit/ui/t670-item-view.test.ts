/**
 * T-670: an item's view, and names that open what they name (24 § Inspection). The item view holds
 * the item's id and finds its place through `items.tileOf`: picked up, put in a barrel and laid in
 * a stockpile, it is still the same view, its second line saying how it is held. Item rows of the
 * tile list take digits; the names in a creature's and an item's view are links (a click, or `Tab`
 * and `Enter`), and `Backspace` goes back through them.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { stringSpans, wrapSpans } from '@ui/panels/look-links';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import type { CellPointer } from '@ui/screen';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

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

function click(f: Fixture, x: number, y: number): void {
  const at: CellPointer = { col: LAYOUT.map.col + x - f.screen.ui.camX, row: LAYOUT.map.row + y - f.screen.ui.camY, button: 0, shift: false, ctrl: false, alt: false, meta: false };
  f.screen.pointerDown(at);
  f.screen.pointerUp(at);
}

/** The sidebar as text: its title row first. */
function sidebar(f: Fixture): string[] {
  const s = surface(80, 42);
  f.screen.draw(s);
  const bar = LAYOUT.sidebar;
  if (bar === null) return [];
  return s.lines().map((line) => Array.from(line).slice(bar.col + 1).join('').trimEnd());
}

/** A click on the first place the sidebar writes `text`: the region registered under its first cell. */
function clickText(f: Fixture, text: string): void {
  const s = surface(80, 42);
  f.screen.draw(s);
  const left = LAYOUT.sidebar?.col ?? 0;
  const lines = s.lines();
  const row = lines.findIndex((line) => Array.from(line).slice(left).join('').includes(text));
  expect(row, `"${text}" in the sidebar`).toBeGreaterThanOrEqual(0);
  const col = left + Array.from(Array.from(lines[row] as string).slice(left).join('')).join('').indexOf(text);
  const hit = s.hits.find((h) => h.rect.row <= row && row < h.rect.row + h.rect.rows && h.rect.col <= col && col < h.rect.col + h.rect.cols);
  expect(hit, `a link at "${text}"`).toBeDefined();
  hit?.action();
}

const nameOf = (f: Fixture, id: EntityId): string => f.w.readers.entities.get(id, C.Creature)?.name ?? '?';

describe('T-670 the item view', () => {
  it('keeps its item when it is picked up, put in a barrel and laid in a stockpile', () => {
    const f = setup('t670-moves');
    const log = f.w.spawnItem('log', 'oak', f.w.index(20, 20, z));
    click(f, 20, 20);
    expect(f.screen.ui.panel).toBe('look');
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: log });
    let rows = sidebar(f);
    expect(rows[0]).toMatch(/^ oak log/);
    expect(rows[1]).toMatch(/^ Wood · \d+ ☼$/);
    expect(rows[2]).toBe(' Lying on the ground');
    expect(rows[3]).toBe(` At (20, 20, z${z})`);
    expect(rows.some((row) => /^ Type +log$/.test(row))).toBe(true);
    expect(rows.some((row) => /^ Owner +no one$/.test(row))).toBe(true);

    // Picked up: the carrier's tile, and the cursor with it.
    const dwarf = f.w.spawnDwarf({ at: f.w.index(24, 22, z) });
    f.w.items.attachToCarrier(log, dwarf);
    rows = sidebar(f);
    expect(rows[0]).toMatch(/^ oak log/);
    expect(rows[2]).toBe(` Carried by ${nameOf(f, dwarf)}`);
    expect(rows[3]).toBe(` At (24, 22, z${z})`);
    expect(f.screen.ui.cursor).toEqual({ x: 24, y: 22 });

    // In a barrel. A log goes in no barrel, so a barrel's drink is followed instead below; here a bin.
    const bin = f.w.spawnItem('bin', 'oak', f.w.index(26, 22, z));
    expect(f.w.items.putIn(log, bin)).toBe(true);
    rows = sidebar(f);
    expect(rows[2]).toBe(' In oak bin');
    expect(rows[3]).toBe(` At (26, 22, z${z})`);

    // Laid in a stockpile.
    const pile = f.w.zone('stockpile', [f.w.index(30, 30, z), f.w.index(31, 30, z)]);
    f.w.items.dropAt(log, f.w.index(31, 30, z));
    rows = sidebar(f);
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: log });
    expect(rows[2]).toMatch(/^ Lying in Stockpile #\d+/);
    expect(rows[3]).toBe(` At (31, 30, z${z})`);
    expect(f.screen.ui.cursor).toEqual({ x: 31, y: 30 });
    // The stockpile's name opens its settings.
    clickText(f, 'Stockpile #');
    expect(f.screen.ui.panel).toBe('zones');
    expect(f.screen.zones.selected).toBe(pile);
  });

  it('inside a barrel: the barrel is a link, and the barrel\'s view lists what it holds as links', () => {
    const f = setup('t670-barrel');
    const barrel = f.w.spawnItem('barrel', 'oak', f.w.index(20, 20, z));
    const drink = f.w.spawnItem('drink', 'ale', { containerId: barrel }, 20);
    f.screen.look({ x: 20, y: 20, z });
    // The tile list: the barrel's row has a digit; what it holds is read under it.
    expect(sidebar(f).some((row) => /^ 1 \S oak barrel/.test(row))).toBe(true);
    expect(f.screen.key(press('1'))).toBe(true);
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: barrel });
    clickText(f, '20 ale');
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: drink });
    const rows = sidebar(f);
    expect(rows[1]).toMatch(/^ Drink · [×x]20 · \d+ ☼$/);
    expect(rows[2]).toBe(' In oak barrel');
    // Back through the history: the barrel, then the tile list.
    expect(f.screen.key(press('Backspace'))).toBe(true);
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: barrel });
    expect(f.screen.key(press('Backspace'))).toBe(true);
    expect(f.screen.lookAt.kind).toBe('tile');
    // The barrel's name in the drink's view opens the barrel.
    f.screen.key(press('1'));
    clickText(f, '20 ale');
    clickText(f, 'oak barrel');
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: barrel });
  });

  it('a second click on the tile of the open item lists the tile; an item gone says so', () => {
    const f = setup('t670-second');
    const log = f.w.spawnItem('log', 'oak', f.w.index(20, 20, z));
    click(f, 20, 20);
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: log });
    click(f, 20, 20);
    expect(f.screen.lookAt.kind).toBe('tile');
    f.screen.key(press('1'));
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: log });
    sidebar(f);
    f.w.items.destroy(log, 'test');
    const rows = sidebar(f);
    expect(rows[0]).toMatch(/^ oak log/);
    expect(rows[1]).toBe(` Gone; last seen at (20, 20, z${z}).`);
    // [h] lists where it was last seen.
    expect(f.screen.key(press('h'))).toBe(true);
    expect(f.screen.lookAt.kind).toBe('tile');
    expect(f.screen.ui.cursor).toEqual({ x: 20, y: 20 });
  });
});

describe('T-670 names that open what they name', () => {
  it('a creature\'s carried item and its friend are links; Backspace returns; the carrier in the item view opens the dwarf', () => {
    const f = setup('t670-links');
    const dwarf = f.w.spawnDwarf({ at: f.w.index(20, 20, z) });
    const friend = f.w.spawnDwarf({ at: f.w.index(25, 25, z) });
    const rel = f.w.readers.entities.get(dwarf, C.Relationships);
    if (rel !== undefined) f.w.game.world.entities.add(dwarf, C.Relationships, { ...rel, friends: [friend] });
    const pick = f.w.spawnItem('pick', 'iron', f.w.index(20, 20, z));
    f.w.items.attachToCarrier(pick, dwarf);
    f.w.game.world.entities.add(dwarf, C.Worker, { ...(f.w.readers.entities.get(dwarf, C.Worker) as object), toolId: pick } as never);
    f.screen.inspectCreature(dwarf);
    // Scroll to the foot, where the equipment and relations lines are.
    for (let k = 0; k < 6; k += 1) f.screen.key(press('PageDown'));
    clickText(f, 'iron pick');
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: pick });
    expect(sidebar(f)[2]).toBe(` Carried by ${nameOf(f, dwarf)}`);
    expect(f.screen.key(press('Backspace'))).toBe(true);
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
    for (let k = 0; k < 6; k += 1) f.screen.key(press('PageDown'));
    clickText(f, nameOf(f, friend).split(' ')[0] ?? '?');
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: friend });
    expect(f.screen.key(press('Backspace'))).toBe(true);
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
    // From the item's view, its carrier's name opens the carrier.
    for (let k = 0; k < 6; k += 1) f.screen.key(press('PageDown'));
    clickText(f, 'iron pick');
    clickText(f, nameOf(f, dwarf));
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
    expect(f.screen.lookBack.map((v) => v.kind)).toEqual(['creature', 'item']);
  });

  it('Tab focuses the links in view one by one and Enter opens the focused one', () => {
    const f = setup('t670-tab');
    const dwarf = f.w.spawnDwarf({ at: f.w.index(20, 20, z) });
    const log = f.w.spawnItem('log', 'oak', f.w.index(20, 20, z));
    f.w.items.attachToCarrier(log, dwarf);
    f.w.items.setCrafter?.(log, dwarf);
    f.screen.inspectCreature(dwarf);
    f.screen.openTarget({ kind: 'item', id: log });
    sidebar(f);
    expect(f.screen.key(press('Enter'))).toBe(false);
    expect(f.screen.key(press('Tab'))).toBe(true);
    expect(f.screen.lookView.focus).toBe(0);
    expect(f.screen.key(press('Tab'))).toBe(true);
    expect(f.screen.lookView.focus).toBe(1);
    sidebar(f);
    expect(f.screen.lookView.links).toEqual([{ kind: 'creature', id: dwarf }, { kind: 'creature', id: dwarf }]);
    expect(f.screen.key(press('Enter'))).toBe(true);
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: dwarf });
    expect(f.screen.key(press('Backspace'))).toBe(true);
    expect(f.screen.lookAt).toMatchObject({ kind: 'item', id: log });
    sidebar(f);
    expect(f.screen.lookView.focus).toBe(-1);
  });

  it('spans wrap as the view\'s lines hang, a link broken over two rows staying one link', () => {
    const spans = stringSpans(strings, 'ui.look.dwarf.equipment', { list: [{ text: 'iron battle axe', target: { kind: 'item', id: 7 } }] });
    const rows = wrapSpans(spans, 18);
    expect(rows.map((r) => ' '.repeat(r.indent) + r.runs.map((run) => run.text).join(''))).toEqual(['Equipment iron', '          battle', '          axe']);
    expect(rows.every((r, n) => n === 0 || r.runs.every((run) => run.span.target?.id === 7))).toBe(true);
  });
});
