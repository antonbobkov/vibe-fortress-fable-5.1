/**
 * T-628: where a caravan's way to the depot breaks. The trade reader finds the gap (the caravan's
 * last tile toward the depot and the depot's side across from it); the depot panel marks both on
 * the map while it is open, and a click on its warning centres the map on the caravan's side.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TileKind } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import type { TradeReader } from '@systems/trade';
import { wayGap } from '@systems/trade/caravan';
import { depotGaps, drawDepotPanel } from '@ui/panels/depot';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { glyphs, keymap, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
/** A channel two levels deep across the whole map, between the north edge and the depot. */
const CHANNEL = [10, 11, 12, 13];

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const terrain = w.game.world.services.terrain;
  for (const y of CHANNEL) for (let x = 0; x < w.map.w; x += 1) {
    terrain.setKind(w.index(x, y, z), TileKind.Open, 0);
    terrain.setKind(w.index(x, y, z - 1), TileKind.Open, 0);
  }
  w.step(1);
  const centred: { x: number; y: number; z: number }[] = [];
  const ui = defaultUiState(z);
  ui.camX = 20; ui.camY = 0;
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui, submit: (cmd) => { w.submit(cmd); },
    speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: (x, y, cz) => { centred.push({ x, y, z: cz }); }, home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 42, true), precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
    now: () => 1000, confirm: (_id, _params, reply) => reply(true),
  };
  const screen = new FortressScreen(host, keymap, strings);
  return { w, screen, host, centred };
}

/** Readers whose trade reader is `trade` with `over` laid on it. */
function withTrade(readers: ReaderSet, over: Partial<TradeReader>): ReaderSet {
  const trade = { ...readers.of<TradeReader>('20'), ...over };
  return new Proxy(readers, { get: (target, key) => key === 'of' ? (id: string) => id === '20' ? trade : target.of(id) : Reflect.get(target, key) }) as ReaderSet;
}

describe('T-628 where the caravan\'s way to the depot ends', () => {
  it('the trade reader finds the gap: the channel\'s north edge, and the depot\'s bank across from it', () => {
    const { w } = setup('t628-reader');
    const depot = w.build('trade_depot', w.index(45, 20, z), 'granite');
    const footprint = w.readers.of<BuildingsReader>('14').get(depot)?.footprint ?? [];
    const xs = footprint.map((t) => w.map.xOf(t));
    const gap = w.readers.of<TradeReader>('20').caravanGap('hillfolk', footprint);
    expect(gap).not.toBeNull();
    const { tile, depotSide } = gap!;
    expect([w.map.yOf(tile), w.map.zOf(tile)]).toEqual([9, z]);
    expect([w.map.yOf(depotSide), w.map.zOf(depotSide)]).toEqual([14, z]);
    expect(w.map.xOf(tile)).toBeGreaterThanOrEqual(Math.min(...xs));
    expect(w.map.xOf(tile)).toBeLessThanOrEqual(Math.max(...xs));
    expect(w.map.xOf(depotSide)).toBe(w.map.xOf(tile));
    // A depot the caravans reach has no gap.
    const near = w.build('trade_depot', w.index(45, 4, z), 'granite');
    expect(w.readers.of<TradeReader>('20').caravanGap('hillfolk', w.readers.of<BuildingsReader>('14').get(near)?.footprint ?? [])).toBeNull();
  });

  it('crosses open air level or down, never up into the sky, and gives up past its bound', () => {
    const { w } = setup('t628-search');
    const pathing = w.readers.pathing;
    const edge = [w.index(45, 0, z)];
    const depot = [w.index(45, 20, z)];
    // Within reach of its bound it finds the north bank; with a bound too small for the channel, nothing.
    expect(w.map.yOf(wayGap(w.map, pathing, edge, depot)!.tile)).toBe(9);
    expect(wayGap(w.map, pathing, edge, depot, 50)).toBeNull();
    // From the same side as the depot there is no gap.
    expect(wayGap(w.map, pathing, [w.index(45, 30, z)], depot)).toBeNull();
  });

  it('the depot panel marks both sides of the gap on the map, and only while it is open', () => {
    const { w, screen, host } = setup('t628-mark');
    const depot = w.build('trade_depot', w.index(45, 20, z), 'granite');
    const footprint = w.readers.of<BuildingsReader>('14').get(depot)?.footprint ?? [];
    const gap = w.readers.of<TradeReader>('20').caravanGap('hillfolk', footprint)!;
    const rect = host.layout().map;
    const cellAt = (s: ReturnType<typeof surface>, tile: number) =>
      s.cells.get(rect.col + w.map.xOf(tile) - host.ui.camX, rect.row + w.map.yOf(tile) - host.ui.camY);
    screen.openPanel('build');
    const closed = surface(80, 42);
    screen.draw(closed);
    expect(cellAt(closed, gap.tile).glyph).not.toBe(glyphs.index('x'));
    screen.depot.select(screen.ctx, depot);
    screen.openPanel('depot');
    expect(host.ui.panel).toBe('depot');
    const open = surface(80, 42);
    screen.draw(open);
    for (const tile of [gap.tile, gap.depotSide]) {
      expect(cellAt(open, tile).glyph).toBe(glyphs.index('x'));
      expect(cellAt(open, tile).bg).toBe(open.theme.alert);
    }
    expect(depotGaps(screen.ctx, depot)).toEqual([gap]);
  });

  it('a click on the warning centres the map on the caravan\'s side of the gap; the waiting caravan\'s gap is from where it stands', () => {
    const { w, screen, centred } = setup('t628-click');
    const depot = w.build('trade_depot', w.index(45, 20, z), 'granite');
    screen.depot.select(screen.ctx, depot);
    const footprint = w.readers.of<BuildingsReader>('14').get(depot)?.footprint ?? [];
    const gap = w.readers.of<TradeReader>('20').caravanGap('hillfolk', footprint)!;
    const s = surface(36, 24);
    drawDepotPanel(s, { col: 0, row: 0, cols: 36, rows: 24 }, screen.depot, screen.ctx, () => {});
    s.hitAt(1, 1)?.action();
    expect(centred.at(-1)).toEqual({ x: w.map.xOf(gap.tile), y: w.map.yOf(gap.tile), z });
    // While a caravan waits for the depot in vain, the panel marks that caravan's gap alone.
    const waiting = { ...screen.ctx, readers: withTrade(w.readers, { activeCaravan: () => ({ civ: 'wildwood', state: 'waiting', daysRemaining: 0 }) }) };
    expect(depotGaps(waiting, depot)).toEqual([w.readers.of<TradeReader>('20').caravanGap('wildwood', footprint)]);
  });
});
