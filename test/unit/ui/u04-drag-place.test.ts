/**
 * U-04: placing many buildings is one gesture (`docs/archive/ui-fixes/README.md` D-U6;
 * `reports/audits/ui-audit.md` M6, S9, § 3 "Build 5 doors / 5 beds"). For a 1×1 type a drag places one
 * per valid tile of the rectangle, the status bar shows the count, blocked tiles are skipped and
 * reported in one message naming the rule; when the input is out of stock the status bar says how
 * many will wait and `o` opens the order picker preset to the item and the count.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import { TileKind } from '@core/map3d';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import { drawBuildPanel } from '@ui/panels/build';
import { helpKeyRows } from '@ui/panels/help';
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
  now: number;
}

/** A fortress screen over a flat world; commands reach the world, which applies them on its next step. */
function setup(seed: string): Fixture {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const sent: Command[] = [];
  const clock = { now: 1000 };
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
    now: () => clock.now,
  };
  const screen = new FortressScreen(host, keymap, strings);
  return { w, screen, sent, get now() { return clock.now; }, set now(value: number) { clock.now = value; } };
}

/** The map cell of a tile. */
function at(f: Fixture, x: number, y: number, button = 0): CellPointer {
  return { col: LAYOUT.map.col + x - f.screen.ui.camX, row: LAYOUT.map.row + y - f.screen.ui.camY, button, shift: false, ctrl: false, alt: false, meta: false };
}

/** Drag the left button from one tile to another. */
function drag(f: Fixture, from: readonly [number, number], to: readonly [number, number]): void {
  f.screen.pointerMove(at(f, from[0], from[1]));
  f.screen.pointerDown(at(f, from[0], from[1]));
  f.screen.pointerMove(at(f, to[0], to[1]));
}

function release(f: Fixture, x: number, y: number): void {
  f.screen.pointerUp(at(f, x, y));
}

/** The build tool on a furniture type, chosen through the panel's keys. */
function choose(f: Fixture, category: string, type: string): void {
  if (f.screen.ui.panel !== 'build') f.screen.key(press('b'));
  f.screen.key(press(category.toUpperCase(), { shift: true }));
  const rows = f.screen.build.rows(f.screen.ctx);
  const index = rows.findIndex((r) => r.id === type);
  expect(index, type).toBeGreaterThanOrEqual(0);
  for (let k = 0; k < index; k += 1) f.screen.key(press('ArrowDown'));
  expect(f.screen.build.current(f.screen.ctx)?.id).toBe(type);
  f.screen.key(press('Enter'));
}

/** Walls north and south of a row of tiles: a doorway each. */
function corridor(f: Fixture, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x += 1) {
    f.w.game.world.services.terrain.setKind(f.w.index(x, y - 1, z), TileKind.Wall, 1);
    f.w.game.world.services.terrain.setKind(f.w.index(x, y + 1, z), TileKind.Wall, 1);
  }
}

function placements(f: Fixture): Command[] {
  return f.sent.filter((c) => c.type === 'PlaceBuilding');
}

function buildPanel(f: Fixture, onOrder: () => void = () => {}): { text: string; click(needle: string): void } {
  const s = surface(36, 40);
  drawBuildPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, f.screen.build, f.screen.ctx, { key: 'o', run: onOrder });
  return {
    text: s.lines().join('\n'),
    click: (needle) => {
      const row = s.lines().findIndex((line) => line.includes(needle));
      expect(row, needle).toBeGreaterThanOrEqual(0);
      const hit = s.hitAt((s.lines()[row] as string).indexOf(needle) + 1, row);
      expect(hit, needle).not.toBeNull();
      hit?.action();
    },
  };
}

describe('U-04 drag to place many (D-U6, M6, S9)', () => {
  it('5 doors in one drag send 5 placements, and the status bar counts them while dragging', () => {
    const f = setup('u04-five-doors');
    corridor(f, 20, 24, 20);
    f.w.spawnItem('door', 'oak', f.w.index(10, 10, z), 5);
    f.w.step(1);
    choose(f, 'f', 'door');
    f.screen.pointerMove(at(f, 20, 20));
    expect(f.screen.statusRow2()).toMatch(/^Door · click to place, drag to place many/);
    drag(f, [20, 20], [24, 20]);
    expect(f.screen.statusRow2()).toBe('Door ×5');
    expect(f.sent).toEqual([]);
    release(f, 24, 20);
    expect(placements(f).map((c) => c['origin'])).toEqual([20, 21, 22, 23, 24].map((x) => f.w.index(x, 20, z)));
    for (const c of placements(f)) expect(c).toMatchObject({ type: 'PlaceBuilding', buildingType: 'door', orientation: 0, materialChoice: 0, priority: 5 });
    expect(f.screen.statusRow2()).toBe('Door ×5 placed');
    // The tool stays active ("Placing keeps the tool active until Esc"), and the world takes all five.
    expect(f.screen.build.active).toBe(true);
    f.w.step(1);
    expect(f.w.readers.of<BuildingsReader>('14').byType('door')).toHaveLength(5);
    expect(f.w.events('CommandRejected')).toHaveLength(0);
  });

  it('a drag the other way, or over a rectangle, places one per tile of the rectangle', () => {
    const f = setup('u04-rect');
    f.w.spawnItem('bed', 'oak', f.w.index(10, 10, z), 9);
    f.w.step(1);
    choose(f, 'f', 'bed');
    drag(f, [32, 31], [30, 30]);
    expect(f.screen.statusRow2()).toBe('Bed ×6');
    release(f, 30, 30);
    expect(placements(f)).toHaveLength(6);
    expect(new Set(placements(f).map((c) => c['origin'])).size).toBe(6);
  });

  it('a single click still places one', () => {
    const f = setup('u04-click');
    f.w.spawnItem('bed', 'oak', f.w.index(10, 10, z), 2);
    f.w.step(1);
    choose(f, 'f', 'bed');
    f.screen.pointerMove(at(f, 30, 30));
    f.screen.pointerDown(at(f, 30, 30));
    f.screen.pointerUp(at(f, 30, 30));
    expect(placements(f)).toEqual([{ type: 'PlaceBuilding', buildingType: 'bed', origin: f.w.index(30, 30, z), orientation: 0, materialChoice: 0, priority: 5 }]);
    // A click on a blocked tile is still sent: the simulation's refusal names the rule (U-01).
    f.w.step(1);
    f.screen.pointerDown(at(f, 30, 30));
    f.screen.pointerUp(at(f, 30, 30));
    expect(placements(f)).toHaveLength(2);
  });

  it('blocked tiles are skipped and reported in one message naming the rule', () => {
    const f = setup('u04-blocked');
    corridor(f, 20, 22, 20);
    f.w.spawnItem('door', 'oak', f.w.index(10, 10, z), 5);
    f.w.step(1);
    choose(f, 'f', 'door');
    drag(f, [20, 20], [24, 20]);
    expect(f.screen.statusRow2()).toBe('Door ×3, 2 tiles blocked');
    release(f, 24, 20);
    expect(placements(f).map((c) => c['origin'])).toEqual([20, 21, 22].map((x) => f.w.index(x, 20, z)));
    expect(f.screen.statusRow2()).toBe('Door ×3 placed, 2 tiles skipped: needs walls on two opposite sides');
    // Nothing the simulation would refuse was sent.
    f.w.step(1);
    expect(f.w.events('CommandRejected')).toHaveLength(0);
    // One blocked tile reads in the singular; a rectangle with no valid tile sends nothing and says why.
    f.now += 10_000;
    drag(f, [22, 20], [23, 20]);
    expect(f.screen.statusRow2()).toBe('Door ×0, 2 tiles blocked');
    release(f, 23, 20);
    expect(placements(f)).toHaveLength(3);
    expect(f.screen.statusRow2()).toBe('No Door placed: every tile is blocked (2): needs walls on two opposite sides, something is built here');
    f.now += 10_000;
    corridor(f, 30, 31, 20);
    drag(f, [30, 20], [32, 20]);
    expect(f.screen.statusRow2()).toBe('Door ×2, 1 tile blocked');
    release(f, 32, 20);
    expect(f.screen.statusRow2()).toBe('Door ×2 placed, 1 tile skipped: needs walls on two opposite sides');
  });

  it('out of stock: the line says how many will wait, and `o` presets the picker to the item and count', () => {
    const f = setup('u04-out-of-stock');
    corridor(f, 20, 24, 20);
    f.w.build('carpenter', f.w.index(40, 40, z));
    f.w.step(1);
    choose(f, 'f', 'door');
    // Nothing placed yet: the stock line appears with the drag.
    f.screen.pointerMove(at(f, 20, 20));
    expect(f.screen.statusRow2()).toMatch(/^Door · click to place/);
    drag(f, [20, 20], [24, 20]);
    expect(f.screen.statusRow2()).toBe('Door ×5 · 0 doors in stock: 5 will wait · [o] order 5');
    release(f, 24, 20);
    expect(placements(f)).toHaveLength(5);
    expect(f.screen.statusRow2()).toBe('Door ×5 placed · 0 doors in stock: 5 will wait · [o] order 5');
    // The line stays while the tool is on the type, and the panel shows it with the order as a button.
    f.now += 10_000;
    f.screen.pointerMove(at(f, 30, 30));
    expect(f.screen.statusRow2()).toBe('Door · blocked: needs walls on two opposite sides · 0 doors in stock: 5 will wait · [o] order 5');
    const panel = buildPanel(f);
    expect(panel.text).toContain('0 doors in stock: 5 will wait');
    expect(panel.text).toContain('[o] order 5');
    // `o` opens the order picker on the door recipe of the built workshop, quantity 5.
    expect(f.screen.key(press('o'))).toBe(true);
    expect(f.screen.ui.panel).toBe('orders');
    const picker = f.screen.orders.picker;
    expect(picker.open).toBe(true);
    expect(picker.quantity).toBe(5);
    expect(f.screen.orders.pickerRecipe(f.screen.ctx)?.id).toBe('make_door_wood');
    // Enter adds the order: one order for five doors.
    expect(f.screen.key(press('Enter'))).toBe(true);
    const order = f.sent.find((c) => c.type === 'AddWorkOrder');
    expect(order).toMatchObject({ order: { recipeId: 'make_door_wood', mode: 'once', remaining: 5 } });
    expect(f.screen.build.active).toBe(false);
  });

  it('the stock covers some: only the rest waits; clicks add up; the panel\'s button opens the same picker', () => {
    const f = setup('u04-partial');
    f.w.build('carpenter', f.w.index(40, 40, z));
    f.w.spawnItem('bed', 'oak', f.w.index(10, 10, z), 2);
    f.w.step(1);
    choose(f, 'f', 'bed');
    drag(f, [30, 30], [32, 30]);
    expect(f.screen.statusRow2()).toBe('Bed ×3 · 2 beds in stock: 1 will wait · [o] order 1');
    release(f, 32, 30);
    f.now += 10_000;
    // Two more by clicks, on the same paused tick: three wait.
    for (const x of [34, 36]) {
      f.screen.pointerMove(at(f, x, 30));
      f.screen.pointerDown(at(f, x, 30));
      f.screen.pointerUp(at(f, x, 30));
    }
    expect(placements(f)).toHaveLength(5);
    expect(f.screen.statusRow2()).toBe('Bed placed · 2 beds in stock: 3 will wait · [o] order 3');
    let ordered = 0;
    buildPanel(f, () => { ordered += 1; f.screen.orderMissing(); }).click('[o] order 3');
    expect(ordered).toBe(1);
    expect(f.screen.ui.panel).toBe('orders');
    expect(f.screen.orders.picker.quantity).toBe(3);
    expect(f.screen.orders.pickerRecipe(f.screen.ctx)?.id).toBe('make_bed');
  });

  it('no workshop can make it: the line names the workshop to build, and `o` opens Orders as always', () => {
    const f = setup('u04-no-workshop');
    choose(f, 'f', 'bed');
    drag(f, [30, 30], [31, 30]);
    expect(f.screen.statusRow2()).toBe("Bed ×2 · 0 beds in stock: 2 will wait · build a carpenter's workshop to make them");
    release(f, 31, 30);
    expect(buildPanel(f).text).toContain("build a carpenter's workshop to");
    expect(f.screen.key(press('o'))).toBe(true);
    expect(f.screen.ui.panel).toBe('orders');
    expect(f.screen.orders.picker.open).toBe(false);
    // A door is made at more than one workshop: the line names them.
    choose(f, 'f', 'door');
    corridor(f, 20, 20, 20);
    drag(f, [20, 20], [20, 20]);
    release(f, 20, 20);
    f.now += 10_000;
    f.screen.pointerMove(at(f, 21, 20));
    expect(f.screen.statusRow2()).toBe("Door · blocked: needs walls on two opposite sides · 0 doors in stock: 1 will wait · build a carpenter's workshop, a forge or a mason's workshop to make them");
    corridor(f, 21, 21, 20);
    expect(f.screen.statusRow2()).toMatch(/^Door · 0 doors in stock: 1 will wait · build a carpenter's workshop, a forge or a mason's workshop to make them/);
  });

  it('a type with a larger footprint, and the single buildings of a fortress, keep the click', () => {
    const f = setup('u04-single');
    choose(f, 'w', 'carpenter');
    expect(f.screen.build.multi(f.screen.ctx)).toBe(false);
    f.screen.pointerMove(at(f, 30, 30));
    f.screen.pointerDown(at(f, 30, 30));
    expect(placements(f)).toHaveLength(1);
    expect(f.screen.build.anchor).toBeNull();
    f.screen.pointerUp(at(f, 30, 30));
    choose(f, 's', 'hearth');
    expect(f.screen.build.multi(f.screen.ctx)).toBe(false);
    // Shift+Enter (the keyboard's first corner) says so instead of doing nothing.
    expect(f.screen.key(press('Enter', { shift: true }))).toBe(true);
    expect(f.screen.statusRow2()).toBe('Hearth is placed one at a time: [Enter] places it.');
    expect(placements(f)).toHaveLength(1);
  });

  it('by keyboard: Shift+Enter marks a corner, Enter at the other places the lot; Esc drops the corner first', () => {
    const f = setup('u04-keyboard');
    f.w.spawnItem('bed', 'oak', f.w.index(10, 10, z), 9);
    f.w.step(1);
    choose(f, 'f', 'bed');
    f.screen.pointerMove(at(f, 30, 30));
    expect(f.screen.key(press('Enter', { shift: true }))).toBe(true);
    expect(f.screen.build.anchor).toEqual({ x: 30, y: 30, z });
    f.screen.pointerMove(at(f, 32, 30));
    expect(f.screen.statusRow2()).toBe('Bed ×3');
    expect(f.screen.key(press('Esc'))).toBe(true);
    expect(f.screen.build.anchor).toBeNull();
    expect(f.screen.build.active).toBe(true);
    expect(f.sent).toEqual([]);
    f.screen.pointerMove(at(f, 30, 30));
    f.screen.key(press('Enter', { shift: true }));
    f.screen.pointerMove(at(f, 32, 30));
    expect(f.screen.key(press('Enter'))).toBe(true);
    expect(placements(f)).toHaveLength(3);
    expect(f.screen.build.anchor).toBeNull();
    // Plain Enter with no corner places one, as before.
    f.w.step(1);
    f.screen.pointerMove(at(f, 36, 36));
    f.screen.key(press('Enter'));
    expect(placements(f)).toHaveLength(4);
    // A right click during a drag cancels the tool and sends nothing more.
    drag(f, [40, 30], [42, 30]);
    f.screen.pointerDown(at(f, 42, 30, 2));
    f.screen.pointerUp(at(f, 42, 30));
    expect(placements(f)).toHaveLength(4);
    expect(f.screen.build.active).toBe(false);
  });

  it('Help lists the drag, the keyboard corner and the order key', () => {
    const rows = helpKeyRows(keymap, strings).map((r) => r.text);
    expect(rows).toContain('drag  one per valid tile (1×1 types)');
    expect(rows).toContain('Shift+Enter corner, Enter places many');
    expect(rows).toContain('o  order what is out of stock');
  });
});
