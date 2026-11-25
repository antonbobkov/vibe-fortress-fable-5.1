/**
 * T-757: a paused fortress says so. Status row 1 reads `║ paused` in the key colour when it has
 * room, hovering the speed field says what it does, the first work ordered before the fortress has
 * run shows `hint_paused`, and an order for a workshop that is only placed says it is a plan
 * (`ui-screens/fortress-screen.md` § Sidebar closed, 24 § Hints, `ui-screens/panels.md` § Add order).
 */
import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Game } from '@app/game';
import type { BuildingsReader } from '@systems/buildings';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { statusFields } from '@ui/status';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, press, strings, surface } from './ui-fixture';

const registry = loadContent();
const z = FLAT_TEST_SURFACE_Z;
const PAUSED_TIP = 'Paused: [Space] or a click runs the fortress; a right click changes the speed.';
const HINT = 'Time is paused, so nothing happens yet.';

async function fortressGame(seed: string): Promise<Game> {
  const game = new Game({ canvas: new MockCanvas(), seed, registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await game.start();
  game.render();
  return game;
}

/** Hover the cell in the middle of the speed field of status row 1. */
function hoverSpeed(game: Game): void {
  const speed = game.fortress.landmarks.get('speed');
  if (speed === undefined) throw new Error('no speed field');
  const at = game.cellCenter(speed.col, speed.row);
  game.pointerMove({ x: at.x, y: at.y, button: 0, shift: false, ctrl: false, alt: false, meta: false });
  game.render();
}

function hintLines(game: Game): number {
  return game.fortress.log.lines.filter((line) => line.text.includes(HINT)).length;
}

function dig(game: Game, x: number): void {
  game.fortress.ctx.submit({ type: 'Designate', tiles: [game.host.readers.map.index(x, 20, z - 1)], kind: 'dig', priority: 5 });
}

describe('T-757 status row 1 names the pause', () => {
  it('a paused fortress at 80 columns shows `║ paused` in the key colour, and hovering it gives the paused text', async () => {
    const game = await fortressGame('t757-row');
    expect(game.viewCols).toBe(80);
    const rows = game.textRows();
    const row1 = rows[rows.length - 3] as string;
    expect(row1).toContain('║ paused');
    expect(row1).toContain('[?] help');
    const speed = game.fortress.landmarks.get('speed');
    expect(speed?.cols).toBe(Array.from('║ paused').length);
    expect(game.cellBuffer()?.get((speed?.col ?? 0) + 2, speed?.row ?? 0).fg).toEqual(game.theme.key);
    hoverSpeed(game);
    expect(game.fortress.statusRow2()).toBe(PAUSED_TIP);
  });

  it('a running fortress gives the running text', async () => {
    const game = await fortressGame('t757-running');
    game.host.setSpeed(2);
    game.render();
    hoverSpeed(game);
    expect(game.fortress.statusRow2()).toBe('Running at 2×: [Space] or a click pauses; a right click changes the speed.');
    expect(game.textRows().join('\n')).not.toContain('paused');
  });

  it('keeps `║` alone when the row has no room for the word', async () => {
    const game = await fortressGame('t757-narrow');
    const readers = game.host.readers;
    expect(statusFields(readers, strings, 32, 0, false, false, 80).at(-1)).toBe('║ paused');
    expect(statusFields(readers, strings, 32, 0, false, false, 60).at(-1)).toBe('║');
    expect(statusFields(readers, strings, 32, 1, false, false, 80).at(-1)).toBe('► 1×');
  });
});

describe('T-757 hint_paused', () => {
  it('the first dig designated before the fortress has run shows the hint once', async () => {
    const game = await fortressGame('t757-hint');
    expect(hintLines(game)).toBe(0);
    dig(game, 20);
    expect(hintLines(game)).toBe(1);
    dig(game, 21);
    expect(hintLines(game)).toBe(1);
    expect(game.ui.hintsShown).toContain('hint_paused');
  });

  it('after Space and a tick, a dig does not show it', async () => {
    const game = await fortressGame('t757-ran');
    game.handleKey(press(' '));
    expect(game.host.speed()).not.toBe(0);
    game.host.step(1);
    game.handleKey(press(' '));
    expect(game.host.speed()).toBe(0);
    dig(game, 20);
    expect(hintLines(game)).toBe(0);
    expect(game.ui.hintsShown).not.toContain('hint_paused');
  });

  it('a building, a zone and a work order trigger it too; an unrelated command does not', async () => {
    const game = await fortressGame('t757-kinds');
    game.fortress.ctx.submit({ type: 'RenameFortress', name: 'Quiet hall' });
    expect(hintLines(game)).toBe(0);
    game.fortress.ctx.submit({ type: 'CreateZone', zoneType: 'stockpile', tiles: [game.host.readers.map.index(30, 20, z)] });
    expect(hintLines(game)).toBe(1);
  });

  it('does not show while the tutorial runs', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 't757-tutorial', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.startTutorial();
    expect(game.tutorialState()).not.toBeNull();
    expect(game.host.speed()).toBe(0);
    const map = game.host.readers.map;
    game.fortress.ctx.submit({ type: 'Designate', tiles: [map.index(game.ui.camX + 5, game.ui.camY + 5, game.ui.z - 1)], kind: 'dig', priority: 5 });
    expect(hintLines(game)).toBe(0);
    expect(game.ui.hintsShown).not.toContain('hint_paused');
  });
});

describe('T-757 an order for a workshop that is only placed', () => {
  function setup(seed: string) {
    const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    w.step(1);
    let speed: 0 | 1 = 0;
    const layout = computeLayout(80, 60, true);
    const host: FortressHost = {
      readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c), speed: () => speed, setSpeed: () => {},
      pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
      registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
      prompt: () => {}, laborManager: () => {},
    };
    const screen = new FortressScreen(host, keymap, strings);
    const order = (text: string): string => {
      screen.openPanel('orders');
      screen.key(press('N', { shift: true }));
      for (const ch of text) screen.key(press(ch));
      screen.key(press('Enter'));
      const line = screen.statusRow2();
      screen.draw(surface(80, 60));
      return line;
    };
    return { w, screen, order, run: (s: 0 | 1) => { speed = s; } };
  }

  it('says the workshop is placed and will be built once time runs, or waits for a builder while running', () => {
    const f = setup('t757-planned');
    f.w.submit({ type: 'PlaceBuilding', buildingType: 'carpenter', origin: f.w.index(15, 15, z), orientation: 0 });
    f.w.step(1);
    const placed = f.w.readers.of<BuildingsReader>('14').byType('carpenter');
    expect(placed).toHaveLength(1);
    expect(f.w.readers.of<BuildingsReader>('14').get(placed[0] as number)?.state).not.toBe('built');
    expect(f.order('bed')).toBe("Ordered: ×1 Bed. The carpenter's workshop is placed and will be built once time runs.");
    f.run(1);
    expect(f.order('bed')).toBe("Ordered: ×1 Bed. The carpenter's workshop is placed and waits for a builder.");
  });

  it('keeps the Build line when no workshop of the type exists', () => {
    const f = setup('t757-none');
    expect(f.order('bed')).toBe("Ordered: ×1 Bed. No carpenter's workshop is built yet: [b] Build > Workshops.");
  });
});
