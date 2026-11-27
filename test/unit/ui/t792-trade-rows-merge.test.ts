/**
 * T-792: in playtest 7 trading at scale took about a hundred keys an offer. Our column listed every
 * stack on a row of its own ("8 turnip lavish meals" five times), and a "food" pick for the depot sent
 * the rot with the meals. Both columns now merge like stacks (type, material, quality, state), `[a]`
 * takes all of a row or none, the offer still names each stack, and a category's pick for the depot
 * leaves rotten and rotting goods behind unless its row names them (`trade-session.md`, `panels.md` § Stocks).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import type { Command } from '@core/commands';
import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { TradeReader } from '@systems/trade';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

/** A trade session over five stacks of 8 easy meals and one of finer meals at the depot, against 5 wool cloth. */
function session() {
  const w = new TestWorld({ seed: 't792-trade', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.step(1);
  const meals = [0, 1, 2, 3, 4].map((k) => w.spawnItem('easy_meal', 'meal', w.index(10 + 2 * k, 10, Z), 8, 1));
  const fine = w.spawnItem('easy_meal', 'meal', w.index(10, 14, Z), 8, 3);
  const cloth = w.spawnItem('cloth', 'wool_cloth', w.index(20, 14, Z), 5, 1);
  const trade = w.readers.of<TradeReader>('20');
  const mocked: TradeReader = {
    ...trade,
    activeCaravan: () => ({ civ: 'hillfolk', state: 'atDepot', daysRemaining: 3 }),
    merchantItems: () => [cloth],
    depotItems: () => [...meals, fine],
    reputation: () => 0,
    marginPercent: () => 10,
    price: () => 100,
    valuation: (_civ, id) => (id === fine ? 40 : 16),
    depotHauls: () => 0,
  };
  const readers = new Proxy(w.readers, {
    get(target, key) {
      if (key === 'of') return (id: string) => (id === '20' ? mocked : target.of(id));
      return Reflect.get(target, key);
    },
  }) as ReaderSet;
  const sent: Command[] = [];
  const screen = new TradeSessionScreen({ readers, registry: w.game.registry, submit: (c) => sent.push(c), commandTick: () => {}, back: () => {} });
  screen.side = 'fortress';
  const rows = (): string[] => { const s = surface(80, 28); screen.draw(s); return s.lines().map((l) => l.trimEnd()); };
  return { w, screen, meals, fine, sent, rows };
}

describe('T-792 the trade session merges like stacks', () => {
  it('five stacks of one meal are one row of 40 with their summed value; another quality is a row of its own', () => {
    const f = session();
    const lines = f.rows();
    // Our column has the focus: its first row carries the cursor.
    expect(lines[4]).toMatch(/ 5 wool cloth +100 +► 40 easy meals +80$/);
    expect(lines[6]).toMatch(/ 8 easy meals +40$/);
    expect(lines.filter((l) => /easy meals? /.test(l))).toHaveLength(2);
  });

  it('+ takes one unit and Shift ten, from the row\'s stacks in their order; [a] takes all of the row, then none', () => {
    const f = session();
    expect(f.screen.key(press('+'))).toBe(true);
    expect(f.screen.give.get(f.meals[0]!)).toBe(1);
    expect(f.screen.key(press('+', { shift: true }))).toBe(true);
    expect(f.screen.quantity('fortress', f.meals[0]!)).toBe(11);
    expect(f.screen.give.get(f.meals[0]!)).toBe(8);
    expect(f.screen.give.get(f.meals[1]!)).toBe(3);
    expect(f.screen.key(press('a'))).toBe(true);
    expect(f.screen.quantity('fortress', f.meals[0]!)).toBe(40);
    expect(f.meals.every((id) => f.screen.give.get(id) === 8)).toBe(true);
    expect(f.screen.give.has(f.fine)).toBe(false);
    expect(f.screen.key(press('a'))).toBe(true);
    expect(f.screen.quantity('fortress', f.meals[0]!)).toBe(0);
    expect(f.screen.give.size).toBe(0);
  });

  it('the offer still names each stack, and the keys line shows [a]', () => {
    const f = session();
    f.screen.key(press('a'));
    f.screen.key(press('Enter'));
    const offer = f.sent.find((c) => c.type === 'TradeOffer') as { give: { itemId: EntityId; count: number }[] } | undefined;
    expect(offer?.give).toEqual(f.meals.map((itemId) => ({ itemId, count: 8 })));
    expect(f.rows()[25]).toMatch(/\[Tab\] side \[\+\]\/\[-\] qty \[a\] all \[Enter\] Offer \[g\] Gift \[x\] Done \[Esc\] Hide$/);
  });
});

describe('T-792 a category picked for the depot leaves the rot behind', () => {
  function stocks() {
    const w = new TestWorld({ seed: 't792-depot', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const depot = w.build('trade_depot', w.index(30, 30, Z));
    const meal = w.spawnItem('easy_meal', 'meal', w.index(10, 10, Z), 10, 1);
    const stale = w.spawnItem('easy_meal', 'meal', w.index(12, 10, Z), 6, 1);
    const rotten = w.spawnItem('rotten', 'meal', w.index(14, 10, Z), 4, 1);
    const stack = w.game.world.entities.get(stale, C.Item);
    if (stack !== undefined) w.game.world.entities.add(stale, C.Item, { ...stack, rotStage: 1 });
    w.step(1);
    const host: FortressHost = {
      readers: w.readers, registry: w.game.registry, ui: defaultUiState(Z), submit: (cmd) => { w.submit(cmd); }, speed: () => 1,
      setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => computeLayout(80, 42, true), precondition: () => true,
      registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
      now: () => 1000, confirm: (_id, _params, reply) => reply(true),
    };
    const screen = new FortressScreen(host, keymap, strings);
    screen.openPanel('stocks');
    screen.stocks.startDepot(depot);
    const select = (node: string): void => {
      for (let n = 0; n < 60 && screen.stocks.selectedNode(screen.ctx) !== node; n += 1) screen.stocks.move(1, screen.ctx);
      expect(screen.stocks.selectedNode(screen.ctx)).toBe(node);
    };
    return { w, screen, meal, stale, rotten, select };
  }

  it('a "food" pick takes the meals and leaves the stale stack, and its count says so; the refuse row takes the rotten food', () => {
    const f = stocks();
    f.select('food');
    f.screen.stocks.toggleDepot(f.screen.ctx);
    expect([...f.screen.stocks.depotChosen]).toEqual([f.meal]);
    expect(f.screen.stocks.depotUnits(f.screen.ctx)).toEqual({ n: 10, left: 6 });
    f.select('refuse');
    f.screen.stocks.toggleDepot(f.screen.ctx);
    expect(f.screen.stocks.depotChosen.has(f.rotten)).toBe(true);
    expect(strings.get('ui.stocks.depot_pick_left', { n: 10, left: 6 })).toBe('[Space] pick  [t] move 10 (6 rotten left)  [Esc]');
  });

  it('a type\'s row names its goods: the meal type takes the stale stack too', () => {
    const f = stocks();
    const type = `type:${f.w.game.registry.table('items').index('easy_meal')}`;
    f.screen.stocks.tree.expanded.add('food');
    f.screen.stocks.tree.expanded.add('food/meal');
    f.screen.stocks.tree.expanded.add('food/meal/easy');
    f.select(type);
    f.screen.stocks.toggleDepot(f.screen.ctx);
    expect(new Set(f.screen.stocks.depotChosen)).toEqual(new Set([f.meal, f.stale]));
    expect(f.screen.stocks.depotUnits(f.screen.ctx).left).toBe(0);
  });
});
