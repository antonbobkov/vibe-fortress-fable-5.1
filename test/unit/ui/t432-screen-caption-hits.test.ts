/**
 * T-432: the click regions of the screens' captions and of the hospital supply buttons follow the
 * text as drawn, as the panels' captions do (T-428): with a key rebound to a name of another length,
 * a click on the last cell of the caption runs it and a click one cell past does not.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import type { ReaderSet } from '@core/readers';
import type { Command } from '@core/commands';
import type { BuildingsSystem } from '@systems/buildings';
import type { TradeReader } from '@systems/trade';
import { Keymap, type KeySpec } from '@ui/keymap';
import { drawZonesPanel, ZoneTool } from '@ui/panels/zones';
import type { PanelContext } from '@ui/panels/context';
import { DEFAULT_USER_SETTINGS } from '@ui/settings';
import { SettingsScreen } from '@ui/screens/settings';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import type { Surface } from '@ui/surface';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap as defaultKeymap, strings, surface } from './ui-fixture';

function key(k: string, mods: Partial<KeySpec> = {}): KeySpec {
  return { key: k, ctrl: false, shift: false, ...mods };
}

function rebind(keys: Keymap, context: string, spec: KeySpec, defaultKey: string): void {
  const index = keys.bindings.findIndex((b) => b.context === context && b.spec.key === defaultKey);
  expect(index, `${context} ${defaultKey}`).toBeGreaterThanOrEqual(0);
  expect(keys.rebind(index, spec)).toBeNull();
}

/** The cell where `piece` starts on the drawn rows, and its row. */
function find(s: Surface, piece: string): { col: number; row: number } {
  const lines = s.lines();
  const row = lines.findIndex((l) => l.includes(piece));
  expect(row, `not drawn: ${piece}`).toBeGreaterThanOrEqual(0);
  return { col: (lines[row] as string).indexOf(piece), row };
}

/** `piece` is clickable from its first cell to its last, and the cell after it is not part of it. */
function expectClickable(s: Surface, piece: string): void {
  const { col, row } = find(s, piece);
  const first = s.hitAt(col, row);
  expect(first, `${piece}: first cell`).not.toBeNull();
  expect(s.hitAt(col + piece.length - 1, row), `${piece}: last cell`).toBe(first);
  expect(first?.rect.col, `${piece}: starts where it is drawn`).toBe(col);
  expect(first?.rect.cols, `${piece}: ends where it is drawn`).toBe(piece.length);
  const past = s.hitAt(col + piece.length, row);
  expect(past === null || past !== first, `${piece}: one cell past`).toBe(true);
}

describe('T-432 the Settings caption', () => {
  it('[d] Reset to defaults and [Esc] Back are clickable over the cells they are drawn in', () => {
    const calls: string[] = [];
    const screen = new SettingsScreen({ keymap: new Keymap(defaultKeymap.bindings), strings, settings: () => DEFAULT_USER_SETTINGS,
      change: () => {}, bindingsChanged: () => {}, resetDefaults: () => calls.push('reset'), back: () => calls.push('back') });
    const s = surface(90, 42);
    screen.draw(s);
    expect(s.lines().join('\n')).toContain('[d] Reset to defaults    [Esc] Back');
    expectClickable(s, '[d] Reset to defaults');
    expectClickable(s, '[Esc] Back');
    const { col, row } = find(s, '[Esc] Back');
    s.hitAt(col, row)?.action();
    s.hitAt(col + '[Esc] Back'.length - 1, row)?.action();
    expect(calls).toEqual(['back', 'back']);
  });
});

describe('T-432 the trade session quantity buttons', () => {
  let game: Game;
  let screen: TradeSessionScreen;
  let cloth = 0;

  beforeAll(async () => {
    game = new Game({ canvas: new MockCanvas(), seed: 'm7-trade-golden', registry: loadContent(),
      createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const world = game.host.world;
    const registry = game.registry;
    const map = game.host.readers.map;
    const placed = world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: map.index(45, 8, 32), orientation: 0, materialChoice: 'granite' });
    if (!placed.ok) throw new Error(placed.reason);
    const buildings = world.scheduler.byId('14') as BuildingsSystem;
    const depot = buildings.lastPlacedBuilding;
    buildings.completeNow(depot, registry.table('materials').index('granite'), 0);
    const tile = game.host.readers.of<{ get(id: number): { footprint: number[] } | undefined }>('14').get(depot)?.footprint[0] ?? 0;
    cloth = world.services.spawn.item(registry.table('items').index('cloth'), registry.table('materials').index('wool_cloth'), tile, 5, 1);
    const trade = game.host.readers.of<TradeReader>('20');
    const mocked: TradeReader = {
      ...trade,
      activeCaravan: () => ({ civ: 'hillfolk', state: 'atDepot', daysRemaining: 3 }),
      merchantItems: () => [cloth],
      depotItems: () => [],
      reputation: () => 4,
      marginPercent: () => 12,
      price: () => 120,
    };
    const readers = new Proxy(game.host.readers, {
      get(target, k) {
        if (k === 'of') return (id: string) => id === '20' ? mocked : target.of(id);
        return Reflect.get(target, k);
      },
    }) as ReaderSet;
    screen = new TradeSessionScreen({ readers, registry, submit: () => {}, commandTick: () => {}, back: () => {} });
  });

  function drawn(keys: Keymap): Surface {
    const s = surface(80, 28);
    const captions = screen.captionKeys();
    s.keyNames = (text, only) => keys.relabel(text, only ?? captions);
    screen.draw(s);
    return s;
  }

  it('with the default keys the buttons are the drawn [-] and [+]', () => {
    screen.setQuantity('merchant', cloth, 2);
    const s = drawn(new Keymap(defaultKeymap.bindings));
    const { col, row } = find(s, '[-] 2 [+]');
    expect(s.hitAt(col, row)?.rect).toMatchObject({ col, cols: 3 });
    expect(s.hitAt(col + 6, row)?.rect).toMatchObject({ col: col + 6, cols: 3 });
    expect(s.hitAt(col + 9, row)).toBeNull();
  });

  it('with the keys rebound to longer ones, each button is clickable over its drawn name, and the number over its digits', () => {
    const keys = new Keymap(defaultKeymap.bindings);
    rebind(keys, 'trade_session', key('F7', { ctrl: true }), '-');
    rebind(keys, 'trade_session', key('F8'), '+');
    screen.setQuantity('merchant', cloth, 2);
    const s = drawn(keys);
    const line = '[Ctrl+F7] 2 [F8]';
    const { col, row } = find(s, line);
    const plus = col + '[Ctrl+F7] 2 '.length;
    const hit = (c: number): ReturnType<Surface['hitAt']> => s.hitAt(c, row);
    expect(hit(col)?.rect).toMatchObject({ col, cols: '[Ctrl+F7]'.length });
    expect(hit(col + '[Ctrl+F7]'.length - 1)).toBe(hit(col));
    expect(hit(col + '[Ctrl+F7]'.length)).not.toBe(hit(col));
    expect(hit(plus)?.rect).toMatchObject({ col: plus, cols: '[F8]'.length });
    expect(hit(plus + 3)).toBe(hit(plus));
    expect(hit(plus + 4)).toBeNull();
    // The digits are the scrub region, between the two buttons.
    expect(hit(col + '[Ctrl+F7] '.length)?.rect).toMatchObject({ col: col + '[Ctrl+F7] '.length, cols: 1 });
    // A click on the last cell of each runs it.
    hit(col + '[Ctrl+F7]'.length - 1)?.action();
    expect(screen.take.get(cloth)).toBe(1);
    hit(plus + 3)?.action();
    expect(screen.take.get(cloth)).toBe(3);
  });
});

describe('T-432 the hospital supply buttons', () => {
  function setup(): { w: TestWorld; tool: ZoneTool; ctx: PanelContext; sent: Command[] } {
    const w = new TestWorld({ seed: 'm6-hospital-zone', world: 'flat-test', embark: 'none' });
    const zoneId = w.zone('hospital', [w.index(10, 10, 32), w.index(11, 10, 32), w.index(12, 10, 32)]);
    w.step(1);
    const tool = new ZoneTool();
    tool.selected = zoneId;
    const sent: Command[] = [];
    const ctx: PanelContext = {
      readers: w.readers,
      registry: w.game.registry,
      strings,
      submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
      focusOn: () => {},
      look: () => {},
      openPanel: () => {},
      shiftClick: () => false,
    };
    return { w, tool, ctx, sent };
  }

  function drawn(f: ReturnType<typeof setup>, keys: Keymap, cols: number): Surface {
    const s = surface(cols, 32);
    s.keyNames = (text, only) => keys.relabel(text, only ?? ['zone_inspector']);
    drawZonesPanel(s, { col: 0, row: 0, cols, rows: 32 }, f.tool, f.ctx);
    return s;
  }

  it('with the default keys the two buttons are the drawn [-] and [+] at the right edge', () => {
    const f = setup();
    const s = drawn(f, new Keymap(defaultKeymap.bindings), 36);
    const { col, row } = find(s, 'Cloth: 0/10');
    expect(s.lines()[row]).toMatch(/Cloth: 0\/10 +\[-\]\[\+\]\s*$/);
    const end = (s.lines()[row] as string).trimEnd().length;
    expect(s.hitAt(end - 6, row)?.rect).toMatchObject({ col: end - 6, cols: 3 });
    expect(s.hitAt(end - 3, row)?.rect).toMatchObject({ col: end - 3, cols: 3 });
    expect(col).toBe(1);
  });

  it('with longer key names the two captions do not overlap and each is clickable over its drawn cells', () => {
    const f = setup();
    const keys = new Keymap(defaultKeymap.bindings);
    rebind(keys, 'zone_inspector', key('F7', { ctrl: true }), '-');
    rebind(keys, 'zone_inspector', key('F8', { ctrl: true }), '+');
    const s = drawn(f, keys, 36);
    const row = s.lines().findIndex((l) => l.includes('Cloth: 0/10'));
    expect(s.lines()[row]).toMatch(/Cloth: 0\/10 +\[Ctrl\+F7\]\[Ctrl\+F8\]\s*$/);
    const at = (s.lines()[row] as string).indexOf('[Ctrl+F7]');
    const minus = s.hitAt(at, row);
    const plus = s.hitAt(at + '[Ctrl+F7]'.length, row);
    expect(minus?.rect).toMatchObject({ col: at, cols: '[Ctrl+F7]'.length });
    expect(plus?.rect).toMatchObject({ col: at + '[Ctrl+F7]'.length, cols: '[Ctrl+F8]'.length });
    expect(s.hitAt(at + '[Ctrl+F7]'.length - 1, row)).toBe(minus);
    expect(s.hitAt(at + '[Ctrl+F7][Ctrl+F8]'.length - 1, row)).toBe(plus);
    expect(s.hitAt(at + '[Ctrl+F7][Ctrl+F8]'.length, row)).toBeNull();
    // The last cell of each runs its own button.
    plus?.action();
    expect(f.sent.map((c) => c.type)).toEqual(['SetHospitalSupplies']);
    expect((f.sent[0] as unknown as { wants: Record<string, number> }).wants.cloth).toBe(11);
    minus?.action();
    expect((f.sent[1] as unknown as { wants: Record<string, number> }).wants.cloth).toBe(9);
  });
});
