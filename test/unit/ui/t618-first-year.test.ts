/**
 * T-618: the small fixes of the first-year audit (`reports/audits/2026-11-18-t618-first-year-ux.md`):
 * announcements name species and civilizations rather than their content ids, the Civilizations
 * panel names what the last caravan brought, the trade footer's margin is a whole number, a wounded
 * dwarf's note names no hospital, a removed order is forgotten for the finished row, the picker
 * highlights what a workshop can make, a new fortress keeps nothing of the last one, the Look
 * panel writes whole hit points, and two first-time hints: food going stale and a cavern breach.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Game } from '@app/game';
import type { Command } from '@core/commands';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import type { ReaderSet } from '@core/readers';
import { contentRegistry } from '@content/loader';
import { computeLayout } from '@render/cellbuffer';
import type { TradeReader } from '@systems/trade';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { itemName, materialItemName } from '@ui/messages';
import { lastBroughtText } from '@ui/panels/civilizations';
import { drawOrdersPanel } from '@ui/panels/orders';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import { defaultUiState } from '@ui/ui-state';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const sent: Command[] = [];
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
    speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 42, true), precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
    now: () => 1000, confirm: (_id, _params, reply) => reply(true),
  };
  const screen = new FortressScreen(host, keymap, strings);
  return { w, screen, sent };
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

describe('T-618 announcements name things, not content ids', () => {
  it('a species by its name, and a civilization as the panels name it', () => {
    const { w } = setup('t618-names');
    const log = announcer(w);
    expect(log.announce({ type: 'AnimalSpawned', id: 1, species: 'glow_beetle' } as GameEvent, w.readers, 1)?.line.text).toBe('A glow beetle has arrived.');
    expect(log.announce({ type: 'CaravanArrived', civ: 'hillfolk', merchants: [], guards: [], animals: [] } as GameEvent, w.readers, 2)?.line.text)
      .toBe('A caravan has arrived from the Hillfolk.');
    expect(log.announce({ type: 'CaravanWaiting', civ: 'hillfolk' } as GameEvent, w.readers, 3)?.line.text)
      .toBe('The Hillfolk caravan waits at the edge for a trade depot.');
    expect(log.announce({ type: 'TradeCompleted', civ: 'mountainhome', givenValue: 1, receivedValue: 1 } as GameEvent, w.readers, 4)?.line.text)
      .toBe('A trade with the Mountainhome is complete.');
  });

  it('a wounded dwarf needs care, and the note names no hospital', () => {
    const { w } = setup('t618-patient');
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, z), name: 'Ivar Coaleye' });
    const text = announcer(w).announce({ type: 'PatientAdmitted', id: dwarf } as GameEvent, w.readers, 1)?.line.text;
    expect(text).toBe('Ivar Coaleye is wounded and needs care.');
    expect(text).not.toContain('hospital');
  });
});

describe('T-618 names in panels', () => {
  it('Last brought names each kind once, with its count, and an animal by its species', () => {
    const registry = contentRegistry();
    expect(lastBroughtText(registry, ['leather_piece', 'goat', 'dung', 'leather_piece', 'boots'])).toBe(`${itemName(registry, 'leather_piece')} ×2, goat, dung, boots`);
    expect(lastBroughtText(registry, [])).toBe('');
  });

  it('a name that ends in s is its own plural', () => {
    expect(materialItemName('leather', { name: 'boots' }, 3)).toBe('leather boots');
    expect(materialItemName('', { name: 'boots' }, 3)).toBe('boots');
    expect(materialItemName('', { name: 'table' }, 3)).toBe('tables');
  });

  it('the trade footer writes the margin as a whole number', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 't618-margin', registry: contentRegistry(),
      createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const trade = game.host.readers.of<TradeReader>('20');
    const mocked: TradeReader = {
      ...trade,
      activeCaravan: () => ({ civ: 'hillfolk', state: 'atDepot', daysRemaining: 3 }),
      merchantItems: () => [], depotItems: () => [], reputation: () => 1, marginPercent: () => 14.95,
    };
    const readers = new Proxy(game.host.readers, {
      get(target, key) {
        if (key === 'of') return (id: string) => id === '20' ? mocked : target.of(id);
        return Reflect.get(target, key);
      },
    }) as ReaderSet;
    const screen = new TradeSessionScreen({ readers, registry: game.registry, submit: () => {}, commandTick: () => {}, back: () => {} });
    const s = surface(80, 28);
    screen.draw(s);
    const footer = s.lines().find((line) => line.includes('We take')) ?? '';
    expect(footer).toContain('+15%');
    expect(footer).not.toContain('14.95');
  });
});

describe('T-618 orders', () => {
  it('a removed order is forgotten: the next one of its recipe finishes with its own count', () => {
    const f = setup('t618-forget');
    const shop = f.w.build('carpenter', f.w.index(15, 15, z));
    f.w.step(1);
    f.screen.openPanel('orders');
    const add = (count: string): void => {
      f.screen.key(press('N', { shift: true }));
      for (const ch of 'door') f.screen.key(press(ch));
      f.screen.key(press(count));
      f.screen.key(press('Enter'));
      f.w.step(1);
    };
    add('9');
    f.screen.orders.list.selected = 0;
    f.screen.key(press('x'));
    f.w.step(1);
    expect(f.sent.some((cmd) => cmd.type === 'RemoveWorkOrder')).toBe(true);
    add('2');
    f.w.spawnItem('log', 'oak', f.w.index(18, 18, z), 4);
    f.w.spawnDwarf({ at: f.w.index(17, 19, z), skills: { carpentry: 6 } });
    f.w.until(() => f.w.events('WorkOrderCompleted').length > 0, 6000);
    f.screen.onEvents(f.w.events('WorkOrderCompleted'));
    const s = surface(36, 40);
    drawOrdersPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, f.screen.orders, f.screen.ctx);
    const text = s.lines().join('\n');
    expect(text).toContain('x2 Door · done');
    expect(text).not.toContain('x9 Door');
    expect(shop).toBeGreaterThan(0);
  });

  it('a filter highlights a recipe a workshop can make before one with no workshop', () => {
    const f = setup('t618-highlight');
    f.w.build('carpenter', f.w.index(15, 15, z));
    f.w.spawnItem('log', 'oak', f.w.index(18, 18, z), 4);
    f.w.step(1);
    f.screen.openPanel('orders');
    f.screen.key(press('N', { shift: true }));
    for (const ch of 'blo') f.screen.key(press(ch));
    const recipes = f.screen.orders.pickerRecipes(f.screen.ctx).map((r) => r.id);
    // The alchemist's draught sorts first by its category, and no laboratory is built.
    expect(recipes[0]).toBe('brew_wyrmblood_draught');
    expect(f.screen.orders.pickerRecipe(f.screen.ctx)?.id).toBe('make_wood_block');
    // A shorter filter ("bl") keeps the highlight on something the carpenter can make now.
    f.screen.key(press('Backspace'));
    const picked = f.screen.orders.pickerRecipe(f.screen.ctx);
    expect(picked === undefined ? -1 : f.screen.orders.rank(f.screen.ctx, picked)).toBe(0);
  });
});

describe('T-618 a new fortress keeps nothing of the last', () => {
  it('starts with its own first hint and no line or finished order of the fortress before', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 't618-session', registry: contentRegistry(),
      createCanvas: mockCanvasFactory(), width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    game.fortress.log.append('danger', 'Ivar Coaleye has died.', 1);
    game.fortress.orders.finished = [{ workshopId: 0, recipeId: 'make_door_wood', count: 12, materialFilter: null }];
    game.fortress.orders.recent = ['make_door_wood'];
    await game.start({ embark: 'default' });
    const texts = game.fortress.log.lines.map((line) => line.text);
    expect(texts.some((text) => text.includes('Ivar Coaleye'))).toBe(false);
    expect(texts.filter((text) => text.includes('Designate a place to dig'))).toHaveLength(1);
    expect(game.fortress.orders.finished).toEqual([]);
    expect(game.fortress.orders.recent).toEqual([]);
  });
});

describe('T-618 Look writes whole hit points', () => {
  it('a part that wasting took fractions from', () => {
    const f = setup('t618-hp');
    const dwarf = f.w.spawnDwarf({ at: f.w.index(10, 10, z), name: 'Ulrik Coalshield' });
    const body = f.w.readers.entities.get(dwarf, C.Body);
    if (body === undefined) throw new Error('no body');
    f.w.game.world.entities.add(dwarf, C.Body, { ...body, parts: body.parts.map((part, index) => index === 1 ? { ...part, hp: 40.80000000000001 } : part) });
    f.screen.inspectCreature(dwarf);
    const s = surface(80, 42);
    f.screen.draw(s);
    const text = s.lines().join('\n');
    expect(text).toMatch(/torso [▓░]+ 41\/60 hp/);
    expect(text).not.toContain('40.8');
  });
});

describe('T-618 first-time hints', () => {
  it('hint_rot follows the first food item that turns stale, and not a corpse or a later one', () => {
    const f = setup('t618-rot');
    const ui = defaultUiState(z);
    const hints = new HintEngine(f.w.game.registry, ui, f.screen.log);
    const stone = f.w.spawnItem('raw_stone', 'granite', f.w.index(12, 12, z));
    hints.onEvents([{ type: 'ItemRotStage', id: stone, stage: 1 } as GameEvent, { type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).not.toContain('hint_rot');
    const turnip = f.w.spawnItem('plant_food', 'turnip', f.w.index(12, 13, z), 20);
    hints.onEvents([{ type: 'ItemRotStage', id: turnip, stage: 1 } as GameEvent, { type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).toContain('hint_rot');
    expect(f.screen.log.lines.filter((line) => line.text.startsWith('☼ Food rots'))).toHaveLength(1);
  });

  it('hint_breach follows the first cavern breach', () => {
    const f = setup('t618-breach');
    const ui = defaultUiState(z);
    const hints = new HintEngine(f.w.game.registry, ui, f.screen.log);
    hints.onEvents([{ type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).not.toContain('hint_breach');
    hints.onEvents([{ type: 'CavernBreached', cavern: 1, tile: 0 } as GameEvent, { type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).toContain('hint_breach');
    expect(f.screen.log.lines.some((line) => line.text.includes('A cavern lies open to the fortress'))).toBe(true);
  });
});
