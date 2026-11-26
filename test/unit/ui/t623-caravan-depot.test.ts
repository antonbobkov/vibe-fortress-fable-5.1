/**
 * T-623: a caravan that cannot reach the depot says why; a depot placed where caravans cannot reach
 * it says so; a bridge of floors is planned in one drag; the depot groups its goods; mass nouns
 * have no plural; the trade title names a Broker nobody holds as "none".
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import { C, ItemFlag } from '@core/components';
import { TileKind } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { TileIndex } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import type { JobsReader } from '@systems/jobs';
import type { TradeReader } from '@systems/trade';
import { DEPOT_WARNING_ROWS } from '@ui/constants';
import { itemName, tradeBlocked } from '@ui/messages';
import { drawDepotPanel } from '@ui/panels/depot';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
/** A channel two levels deep across the whole map: the north edge (every caravan's, here) on one side. */
const CHANNEL = [10, 11, 12, 13];

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const terrain = w.game.world.services.terrain;
  for (const y of CHANNEL) for (let x = 0; x < w.map.w; x += 1) {
    terrain.setKind(w.index(x, y, z), TileKind.Open, 0);
    terrain.setKind(w.index(x, y, z - 1), TileKind.Open, 0);
  }
  // The connectivity labels follow the cut at the next step.
  w.step(1);
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

/** The build tool armed with one building type. */
function arm(screen: FortressScreen, category: string, type: string): void {
  screen.openPanel('build');
  screen.build.choose(category);
  screen.build.list.selected = screen.build.rows(screen.ctx).findIndex((row) => row.id === type);
  expect(screen.build.list.selected).toBeGreaterThanOrEqual(0);
  screen.build.arm();
}

/** Readers whose trade reader is `trade` with `over` laid on it. */
function withTrade(readers: ReaderSet, over: Partial<TradeReader>): ReaderSet {
  const trade = { ...readers.of<TradeReader>('20'), ...over };
  return new Proxy(readers, { get: (target, key) => key === 'of' ? (id: string) => id === '20' ? trade : target.of(id) : Reflect.get(target, key) }) as ReaderSet;
}

const UNREACHABLE = 'Hillfolk, Wildwood and Mountainhome caravans from the north edge cannot reach it: a caravan needs a way on foot, with no deep water or drop.';

describe('T-623 a depot no caravan can reach', () => {
  it('placing one across the channel says which caravans cannot reach it, in the status row and the log', () => {
    const { w, screen } = setup('t623-place');
    arm(screen, 's', 'trade_depot');
    screen.place({ x: 45, y: 20, z });
    // The stock line follows, as after any placement.
    expect(screen.statusRow2().startsWith(`Trade depot placed where ${UNREACHABLE}`)).toBe(true);
    const line = screen.log.lines.at(-1);
    expect(line?.severity).toBe('alert');
    expect(line?.text).toBe(`Trade depot placed where ${UNREACHABLE}`);
    w.step(1);
    const depot = w.readers.of<BuildingsReader>('14').byType('trade_depot')[0] ?? 0;
    expect(line?.focus).toBe(w.readers.of<BuildingsReader>('14').get(depot)?.footprint[0]);
    // On the edge's side of the channel it is only placed.
    screen.place({ x: 45, y: 4, z });
    expect(screen.statusRow2()).toMatch(/^Trade depot placed( ·|$)/);
  });

  it('the depot panel keeps the warning, and while the caravan waits it says what the caravan line says', () => {
    const { w, screen } = setup('t623-panel');
    const depot = w.build('trade_depot', w.index(45, 20, z), 'granite');
    screen.depot.select(screen.ctx, depot);
    const draw = (ctx = screen.ctx): string[] => {
      const s = surface(36, 24);
      drawDepotPanel(s, { col: 0, row: 0, cols: 36, rows: 24 }, screen.depot, ctx, () => {});
      return s.lines().map((line) => line.trim());
    };
    // The warning wraps under the title, whole; the goods list follows it.
    const warning = (rows: string[]): string => rows.slice(1, 1 + DEPOT_WARNING_ROWS).filter((row) => row !== '' && !row.startsWith('[m]')).join(' ');
    expect(warning(draw())).toBe(UNREACHABLE);
    const waiting = { ...screen.ctx, readers: withTrade(w.readers, { activeCaravan: () => ({ civ: 'hillfolk', state: 'waiting', daysRemaining: 0 }) }) };
    const said = 'The Hillfolk caravan cannot reach Trade depot #1 from the north edge: its pack animals need a way on foot, with no deep water or drop. Bridge the gap, or build a depot on their side.';
    expect(tradeBlocked(waiting, depot)).toBe(said);
    expect(warning(draw(waiting))).toBe(said);
    // A caravan on its way to a depot it can reach is only on its way.
    const near = w.build('trade_depot', w.index(45, 4, z), 'granite');
    expect(tradeBlocked(waiting, near)).toBe('The Hillfolk caravan has not reached the depot yet.');
    screen.depot.select(screen.ctx, near);
    expect(draw()[1]).not.toMatch(/cannot reach/);
  });

  it('the trade reader tells each civilization whether its edge reaches the tiles', () => {
    const { w } = setup('t623-reach');
    const trade = w.readers.of<TradeReader>('20');
    expect(trade.caravanReach([w.index(45, 20, z)])).toEqual([
      { civ: 'hillfolk', edge: 'n', reaches: false }, { civ: 'wildwood', edge: 'n', reaches: false }, { civ: 'mountainhome', edge: 'n', reaches: false },
    ]);
    expect(trade.caravanReach([w.index(45, 4, z)]).every((r) => r.reaches)).toBe(true);
  });
});

describe('T-623 a bridge planned in one drag', () => {
  it('a drag across the channel plans every floor, each after the one beside it that holds it', () => {
    const { w, screen } = setup('t623-span');
    arm(screen, 'c', 'floor');
    const plan = screen.build.plan(screen.ctx, { x: 45, y: 10, z }, { x: 45, y: 13, z });
    expect(plan.blocked).toBe(0);
    expect(plan.ok.map((t) => w.map.yOf(t)).sort()).toEqual(CHANNEL);
    // Each tile is supported, or beside one placed before it.
    plan.ok.forEach((tile, k) => {
      const y = w.map.yOf(tile);
      expect(y === 10 || y === 13 || plan.ok.slice(0, k).some((t) => Math.abs(w.map.yOf(t) - y) === 1)).toBe(true);
    });
    // A box spans too, and every command it sends is accepted.
    const commands = screen.placeMany({ x: 44, y: 10, z }, { x: 46, y: 13, z });
    expect(commands).toHaveLength(12);
    expect(screen.statusRow2()).toMatch(/^Floor ×12 placed( ·|$)/);
    w.step(1);
    expect(w.events('CommandRejected')).toHaveLength(0);
    expect(w.readers.of<BuildingsReader>('14').byType('floor')).toHaveLength(12);
  });

  it('a floor nothing holds yet waits for its build job; the held ends get theirs', () => {
    const { w } = setup('t623-jobs');
    const world = w.game.world;
    // Out of order the middle is refused: nothing holds it.
    expect(world.applyCommand({ type: 'PlaceBuilding', buildingType: 'floor', origin: w.index(45, 11, z), materialChoice: 'granite' })).toMatchObject({ ok: false, reason: 'bad_placement' });
    const ids: number[] = [];
    const buildings = w.readers.of<BuildingsReader>('14');
    for (const y of CHANNEL) {
      expect(world.applyCommand({ type: 'PlaceBuilding', buildingType: 'floor', origin: w.index(45, y, z), materialChoice: 'granite' }).ok).toBe(true);
      ids.push(buildings.byType('floor').at(-1) as number);
    }
    w.step(2);
    const jobs = w.readers.of<JobsReader>('11');
    expect(ids.map((id) => jobs.byKey(`build:${id}`) !== undefined)).toEqual([true, false, false, true]);
    // Once the south end is built, the floor beside it gets its job.
    world.services.terrain.setKind(w.index(45, 13, z), TileKind.Floor, w.game.registry.table('materials').index('granite'));
    w.step(2);
    expect(jobs.byKey(`build:${ids[2]}`)).toBeDefined();
    expect(jobs.byKey(`build:${ids[1]}`)).toBeUndefined();
  });
});

describe('T-623 the depot groups its goods', () => {
  it('eleven stacks of barley straw are one row of eleven, and remove takes them all', () => {
    const { w, screen, sent } = setup('t623-group');
    const depot = w.build('trade_depot', w.index(45, 4, z), 'granite');
    const tile = w.readers.of<BuildingsReader>('14').get(depot)?.footprint[0] as TileIndex;
    w.game.world.entities.add(depot, C.Container, { contents: [], capacity: Number.MAX_SAFE_INTEGER, classId: 'wagon' });
    const stacks: number[] = [];
    for (let n = 0; n < 11; n += 1) {
      const id = w.spawnItem('straw', 'barley', tile, 1);
      w.items.putIn(id, depot);
      w.items.setFlag(id, ItemFlag.AtDepot, true);
      stacks.push(id);
    }
    screen.depot.select(screen.ctx, depot);
    const rows = screen.depot.rows(screen.ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(11);
    const s = surface(36, 24);
    drawDepotPanel(s, { col: 0, row: 0, cols: 36, rows: 24 }, screen.depot, screen.ctx, () => {});
    expect(s.lines().filter((line) => line.includes('barley straw'))).toHaveLength(1);
    expect(s.lines()[1]).toMatch(/► 11 barley straw +\d+ ☼/);
    screen.depot.remove(screen.ctx);
    expect(sent.at(-1)).toEqual({ type: 'RemoveFromDepot', depotId: depot, itemIds: stacks });
  });
});

describe('T-623 names', () => {
  it('a mass noun is its own plural, and a draught puts the s on the draught', () => {
    const { w } = setup('t623-plurals');
    const registry = w.game.registry;
    expect(itemName(registry, strings, 'dung', 40)).toBe('dung');
    expect(itemName(registry, strings, 'flour', 50)).toBe('flour');
    expect(itemName(registry, strings, 'salt', 70)).toBe('salt');
    expect(itemName(registry, strings, 'tallow', 3)).toBe('tallow');
    expect(itemName(registry, strings, 'mending_draught', 2)).toBe('draughts of mending');
    expect(itemName(registry, strings, 'boots', 3)).toBe('boots');
    expect(itemName(registry, strings, 'easy_meal', 2)).toBe('easy meals');
  });

  it('the trade title names the Broker as none when the dwarf who trades holds no title', () => {
    const { w } = setup('t623-broker');
    const dwarf = w.spawnDwarf({ at: w.index(45, 4, z), name: 'Torgeir Grimfoot' });
    const session = { depotId: 0, traderId: dwarf, merchantId: 0, give: [], take: [], woodOffered: [], woodWarning: false };
    const title = (holder: number): string => {
      const traded = withTrade(w.readers, { activeCaravan: () => ({ civ: 'hillfolk', state: 'atDepot', daysRemaining: 3 }), session: () => session, merchantItems: () => [], depotItems: () => [] });
      const dwarves = { ...w.readers.of<DwarvesReader>('10'), holder: () => holder };
      const readers = new Proxy(traded, { get: (target, key) => key === 'of' ? (id: string) => id === '10' ? dwarves : target.of(id) : Reflect.get(target, key) }) as ReaderSet;
      const screen = new TradeSessionScreen({ readers, registry: w.game.registry, strings, submit: () => {}, commandTick: () => {}, back: () => {} });
      const s = surface(120, 28);
      screen.draw(s);
      return s.lines()[1]?.trim() ?? '';
    };
    expect(title(0)).toBe('Trading with the Hillfolk · Broker: none (Torgeir Grimfoot trades, skill 0) · Reputation +0');
    expect(title(dwarf)).toBe('Trading with the Hillfolk · Broker: Torgeir Grimfoot (Trading 0) · Reputation +0');
  });
});
