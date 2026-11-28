/**
 * T-621: food rots where the player can see it (`reports/audits/2026-11-18-t618-first-year-ux.md`,
 * findings 1-3). 13's reader gives a perishable item's stage and the ticks it has left; the stocks
 * panel and Look say them; an alert comes before a day's food rots; the miasma line names what rots
 * and where; and the day's starving dwarves are one line.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { GameEvent } from '@core/events';
import { TileFlag } from '@core/map3d';
import type { TileIndex } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { ItemsReader } from '@systems/items';
import { AnnouncementLog } from '@ui/announcements';
import { drawTileList } from '@ui/panels/look';
import { drawStocksPanel } from '@ui/panels/stocks';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState, fromSaved, toSaved } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

const Z = FLAT_TEST_SURFACE_Z;

function world(seed: string, embark: 'none' | 'default' = 'none'): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark, ...(embark === 'none' ? { surfaceWildlife: 'none' as const } : {}) });
}

function screenOf(w: TestWorld, ui = defaultUiState(Z)): FortressScreen {
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui, submit: (cmd) => w.submit(cmd),
    speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 42, true), precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
    now: () => 1000, confirm: (_id, _params, reply) => reply(true),
  };
  return new FortressScreen(host, keymap, strings);
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

/** A warm tile, so that rot runs at its plain speed (13 § Rot: halved below `ROT_COLD_C`). */
function warm(w: TestWorld, x: number, y: number, indoor = false): TileIndex {
  const tile = w.index(x, y, Z);
  if (indoor) w.map.setFlag(tile, TileFlag.Outdoor, false);
  w.forceTemperature(tile, 20);
  return tile;
}

describe('T-621 the reader says how long food keeps', () => {
  it('a turnip on the ground: fresh, its rot days left; stale at half; null for cured meat; null speed when frozen', () => {
    const w = world('t621-outlook');
    const items = w.readers.of<ItemsReader>('13');
    const turnip = w.spawnItem('plant_food', 'turnip', warm(w, 10, 10), 20);
    const outlook = items.rotOutlook(turnip);
    expect(outlook).toEqual({ stage: 0, toRot: 20 * TICKS_PER_DAY, toGone: 30 * TICKS_PER_DAY });
    w.step(12 * TICKS_PER_DAY);
    const later = items.rotOutlook(turnip);
    expect(later?.stage).toBe(1);
    expect(later?.toRot).toBe(8 * TICKS_PER_DAY);
    expect(items.rotOutlook(w.spawnItem('cured_meat', 'boar_meat', warm(w, 11, 10), 10))).toBeNull();
    const cold = w.index(12, 10, Z);
    w.forceTemperature(cold, -10);
    const frozen = w.spawnItem('raw_meat', 'boar_meat', cold, 10);
    expect(items.rotOutlook(frozen)).toEqual({ stage: 0, toRot: null, toGone: null });
  });

  it('a barrel in a stockpile slows it four times', () => {
    const w = world('t621-barrel');
    const items = w.readers.of<ItemsReader>('13');
    const tile = warm(w, 10, 10);
    w.zone('stockpile', [tile]);
    const barrel = w.spawnItem('barrel', 'oak', tile);
    const meat = w.spawnItem('raw_meat', 'boar_meat', { containerId: barrel }, 10);
    expect(items.rotOutlook(meat)?.toRot).toBe(4 * 6 * TICKS_PER_DAY);
  });
});

describe('T-621 Stocks and Look show rot', () => {
  it('Look: a perishable item has its stage and days under it; cured meat says it keeps', () => {
    const w = world('t621-look');
    const tile = warm(w, 10, 10);
    w.spawnItem('plant_food', 'turnip', tile, 20);
    w.step(16 * TICKS_PER_DAY);
    const s = surface(44, 14);
    drawTileList(s, { col: 0, row: 0, cols: 44, rows: 14 }, w.readers, w.game.registry, strings, tile);
    const text = s.lines().join('\n');
    expect(text).toMatch(/turnip +x20/);
    expect(text).toContain('stale, rots in 4 days');
    const cured = warm(w, 11, 10);
    w.spawnItem('cured_meat', 'boar_meat', cured, 10);
    const s2 = surface(44, 14);
    drawTileList(s2, { col: 0, row: 0, cols: 44, rows: 14 }, w.readers, w.game.registry, strings, cured);
    expect(s2.lines().join('\n')).toContain('keeps, never rots');
  });

  it('Stocks: the selected stack reads "turnip ×20 · stale, rots in 4 days"; the food row counts what rots within 3 days', () => {
    const w = world('t621-stocks');
    w.spawnItem('plant_food', 'turnip', warm(w, 10, 10), 20);
    w.spawnItem('cured_meat', 'boar_meat', warm(w, 11, 10), 10);
    w.step(16 * TICKS_PER_DAY);
    const f = screenOf(w);
    const draw = (): string => {
      const s = surface(36, 30);
      drawStocksPanel(s, { col: 0, row: 0, cols: 36, rows: 30 }, f.stocks, f.ctx);
      return s.lines().join('\n');
    };
    expect(f.stocks.selectedNode(f.ctx)).toBe('food');
    expect(draw()).toContain('0 rot within 3 days');
    const turnip = w.game.registry.table('items').index('plant_food');
    for (const id of ['food', 'food/plant', 'food/plant/raw', `type:${turnip}`]) f.stocks.tree.expanded.add(id);
    while (f.stocks.selectedNode(f.ctx) !== `type:${turnip}`) f.stocks.move(1, f.ctx);
    f.stocks.move(1, f.ctx);
    expect(f.stocks.selectedNode(f.ctx)?.startsWith('item:')).toBe(true);
    expect(draw()).toContain('turnip x20 · stale, rots in 4 days');
    w.step(2 * TICKS_PER_DAY);
    f.stocks.tree.selected = 0;
    expect(draw()).toContain('20 rot within 3 days');
  });
});

describe('T-621 an alert before food rots', () => {
  it('fires when the food rotting within 3 days would feed the fortress a day, naming the largest stack and its place', () => {
    const w = world('t621-alert');
    const log = announcer(w);
    const items = w.readers.of<ItemsReader>('13');
    for (let k = 0; k < 7; k += 1) w.spawnDwarf({ at: w.index(20 + k, 20, Z) });
    // Forbidden, so that nobody eats it: it still rots, and it is still the fortress's food.
    const meat = (x: number, n: number): number => {
      const id = w.spawnItem('raw_meat', 'boar_meat', warm(w, x, 10), n);
      w.submit({ type: 'ForbidItem', itemId: id, on: true });
      return id;
    };
    const one = meat(10, 1);
    w.step(2 * TICKS_PER_DAY);
    const two = meat(11, 2);
    w.step(2 * TICKS_PER_DAY);
    // Raw meat keeps 6 days: the one unit rots in 2, the two in 4. One unit is a quarter of a day's
    // food for seven dwarves: no alert.
    expect(items.rotOutlook(one)?.toRot).toBe(2 * TICKS_PER_DAY);
    expect(log.rotAlert(w.readers, w.tick)).toBeNull();
    // A day and a half later both rot within 3 days: three units feed seven dwarves for a day.
    w.step(TICKS_PER_DAY + TICKS_PER_DAY / 2);
    for (const id of [one, two]) expect(items.get(id)?.count).toBeGreaterThan(0);
    const done = log.rotAlert(w.readers, w.tick);
    expect(done?.line.text).toBe('3 food will rot within 3 days; the largest stack is 2 boar meat in the open.');
    expect(done?.severity).toBe('alert');
    expect(done?.focus).toBe(w.index(11, 10, Z));
  });

  it('the Balanced loadout left unattended: the alert comes, once a day, before its first food rots', () => {
    const w = world('t621-balanced', 'default');
    const f = screenOf(w);
    let firstRot = -1;
    w.game.world.onEvents((batch) => {
      for (const e of batch) {
        if (firstRot < 0 && e.type === 'ItemRotted') firstRot = w.tick;
      }
      f.onEvents(batch);
    });
    // Its food keeps 14 days (the meals) and 20 (the plants), so the first rots by day 21.
    for (let day = 0; day < 22 && firstRot < 0; day += 1) w.step(TICKS_PER_DAY);
    expect(firstRot).toBeGreaterThan(0);
    const alerts = f.log.lines.filter((l) => l.text.includes('food will rot within 3 days'));
    expect(alerts.length).toBeGreaterThan(0);
    const first = alerts[0]!;
    expect(first.severity).toBe('alert');
    expect(first.tick).toBeLessThan(firstRot < 0 ? Infinity : firstRot);
    expect(first.text).toMatch(/^\d+ food will rot within 3 days; the largest stack is \d+ [a-z ]+ in [A-Za-z #()0-9]+\.$/);
    expect(first.focus).toBeGreaterThanOrEqual(0);
    // At most one a day: no two alert lines share a day.
    const days = alerts.map((l) => Math.floor(l.tick / TICKS_PER_DAY));
    expect(new Set(days).size).toBe(days.length);
  });
});

describe('T-621 the miasma line names its cause', () => {
  it('"Miasma spreads from 20 rotten turnip in Stockpile #1 ...", with the advice only the first time', () => {
    const w = world('t621-miasma');
    const tile = warm(w, 12, 12, true);
    w.zone('stockpile', [tile]);
    w.spawnItem('plant_food', 'turnip', tile, 20);
    const ui = defaultUiState(Z);
    const f = screenOf(w, ui);
    w.game.world.onEvents((batch) => f.onEvents(batch));
    w.step(20 * TICKS_PER_DAY + TICKS_PER_HOUR);
    const lines = f.log.lines.filter((l) => l.text.startsWith('Miasma spreads'));
    expect(lines.length).toBeGreaterThan(0);
    const first = lines[0]!;
    expect(first.text).toMatch(/^Miasma spreads from 20 rotten turnip in Stockpile #1( \([A-Za-z]+\))?\. A refuse stockpile outdoors, or a dump, takes rotten food away\.$/);
    expect(first.focus).toBe(tile);
    expect(ui.miasmaAdvised).toBe(true);
    // The flag is saved with the UI state, and an older save has it off.
    const loaded = defaultUiState(Z);
    fromSaved(loaded, toSaved(ui, []));
    expect(loaded.miasmaAdvised).toBe(true);
    fromSaved(loaded, toSaved(defaultUiState(Z), []));
    expect(loaded.miasmaAdvised).toBe(false);
    // Later lines name the cause without the advice.
    const log = new AnnouncementLog(strings, w.game.registry, { workshopIdleNotes: [], miasmaAdvised: true });
    log.register(w.game.world.registrations.announcements);
    const again = log.announce({ type: 'MiasmaSpread', tiles: [tile] } as GameEvent, w.readers, w.tick);
    expect(again?.line.text).toMatch(/^Miasma spreads from 20 rotten turnip in Stockpile #1( \([A-Za-z]+\))?\.$/);
    // With nothing rotting there, the plain line.
    const bare = log.announce({ type: 'MiasmaSpread', tiles: [w.index(30, 30, Z)] } as GameEvent, w.readers, w.tick + TICKS_PER_DAY);
    expect(bare?.line.text).toBe('Miasma spreads.');
  });
});

describe('T-621 the day\'s starving dwarves are one line', () => {
  it('"3 dwarves are starving: Asa, Njal, Liv." in place of three lines; a new day starts a new line', () => {
    const w = world('t621-starving');
    const names = ['Asa Forgehall', 'Njal Asheye', 'Liv Stonehand'];
    const ids = names.map((name, k) => w.spawnDwarf({ at: w.index(10 + k, 10, Z), name }));
    for (const [k, id] of ids.entries()) w.game.world.entities.get(id, C.Creature)!.name = names[k]!;
    const log = announcer(w);
    const day = 5 * TICKS_PER_DAY;
    const starve = (id: number, tick: number) => log.announce({ type: 'Starving', id, need: 'hunger' } as GameEvent, w.readers, tick);
    expect(starve(ids[0]!, day + 10)?.line.text).toBe('Asa Forgehall is starving.');
    starve(ids[1]!, day + 400);
    starve(ids[0]!, day + 500);
    const third = starve(ids[2]!, day + 900);
    expect(third?.line.text).toBe('3 dwarves are starving: Asa, Njal, Liv.');
    expect(log.lines.filter((l) => l.text.includes('starving'))).toHaveLength(1);
    expect(third?.focus).toBe(w.index(10, 10, Z));
    expect(starve(ids[1]!, day + TICKS_PER_DAY + 10)?.line.text).toBe('Njal Asheye is starving.');
    expect(log.lines.filter((l) => l.text.includes('starving'))).toHaveLength(2);
  });
});
