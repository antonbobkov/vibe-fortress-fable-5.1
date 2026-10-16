/** T-251: successful placement feedback, merchant stacks, and pending broker requests. */
import { describe, expect, it, vi } from 'vitest';
import { Game } from '@app/game';
import type { ReaderSet } from '@core/readers';
import type { Command } from '@core/commands';
import type { BuildingsSystem, BuildingsReader } from '@systems/buildings';
import type { TradeReader } from '@systems/trade';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import { drawDepotPanel } from '@ui/panels/depot';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { registry, strings, press, surface } from './ui-fixture';
async function game() {
 const g = new Game({ canvas: new MockCanvas(), registry, seed: 't251-feedback', createCanvas: mockCanvasFactory(), width: 1280, height: 800, devicePixelRatio: 1 });
 await g.start(); g.ui.camX = 0; g.ui.camY = 0; return g;
}
function point(g: Game, x: number, y: number) {
 const map = g.compositor.layout.map; return { col: map.col + x, row: map.row + y, button: 0, shift: false, ctrl: false, alt: false, meta: false };
}
function merchant(g: Game) {
 const spawn = g.host.world.services.spawn;
 const cages = Array.from({ length: 12 }, (_v, n) => spawn.item(registry.table('items').index('cage'), registry.table('materials').index('pine'), g.host.world.map.index(10 + n, 10, 32), 1, 1));
 const other = spawn.item(registry.table('items').index('cage'), registry.table('materials').index('oak'), g.host.world.map.index(12, 10, 32), 1, 1);
 const quality = spawn.item(registry.table('items').index('cage'), registry.table('materials').index('pine'), g.host.world.map.index(13, 10, 32), 1, 2);
 const meal = spawn.item(registry.table('items').index('easy_meal'), registry.table('materials').index('meal'), g.host.world.map.index(14, 10, 32), 20, 1);
 const trade = g.host.readers.of<TradeReader>('20');
 const mocked = { ...trade, activeCaravan: () => ({ civ: 'hillfolk', state: 'atDepot', daysRemaining: 3 }), merchantItems: () => [...cages, other, quality], depotItems: () => [meal], price: () => 10, valuation: () => 200, marginPercent: () => 15 };
 const readers = new Proxy(g.host.readers, { get(target, key) { return key === 'of' ? (id: string) => id === '20' ? mocked : target.of(id) : Reflect.get(target, key); } }) as ReaderSet;
 const sent: Command[] = [];
 const modal = new TradeSessionScreen({ readers, registry, strings, submit: cmd => sent.push(cmd), commandTick: () => {}, back: () => {} });
 return { modal, sent, cages, other, quality, meal, readers };
}
describe('T-251 placement and trade feedback', () => {
 it('hides the ghost and keeps successful placement text until leaving the whole footprint', async () => {
  const g = await game(), f = g.fortress; f.openPanel('build'); f.build.choose('w'); f.build.arm();
  f.build.list.selected = f.build.rows(f.ctx).findIndex(row => row.id === 'carpenter');
  const p = point(g, 30, 20); f.pointerMove(p); f.pointerDown(p);
  expect(g.host.readers.of<BuildingsReader>('14').byType('carpenter')).toHaveLength(1);
  expect(f.statusRow2()).toContain("Carpenter's workshop placed");
  expect(f.build.ghost(f.ctx, { x: 30, y: 20, z: 32 })).toBeNull();
  f.pointerMove(point(g, 31, 20)); expect(f.statusRow2()).toContain('placed');
  f.notice('Another notice'); expect(f.statusRow2()).toBe('Another notice');
  expect(f.build.ghost(f.ctx, { x: 31, y: 20, z: 32 })).toBeNull();
  f.pointerMove(point(g, 38, 20)); expect(f.statusRow2()).not.toContain('placed');
  expect(f.build.ghost(f.ctx, { x: 38, y: 20, z: 32 })).not.toBeNull();
  f.pointerMove(p); expect(f.statusRow2()).toContain('blocked');
 });
 it('groups equal type/material/quality only, totals partial stacks, and offers matching raw ids', async () => {
  const g = await game(), m = merchant(g), s = surface(120, 34); m.modal.draw(s);
  expect(s.lines().join('\n')).toContain('12 pine cages');
  expect(s.lines().filter(line => line.includes('pine cage'))).toHaveLength(2);
  m.modal.key(press('+')); m.modal.key(press('+')); m.modal.key(press('+'));
  expect(m.modal.totals().take).toBe(30); m.modal.setQuantity('fortress', m.meal, 20); m.modal.key(press('Enter'));
  expect(m.sent.at(-1)).toMatchObject({ type: 'TradeOffer', take: m.cages.slice(0, 3).map(itemId => ({ itemId, count: 1 })) });
  m.modal.key(press('End')); expect(m.modal.quantity('merchant', m.cages[0]!)).toBe(12);
  m.modal.key(press('Home')); expect(m.modal.quantity('merchant', m.cages[0]!)).toBe(0);
 });
 it('a paused trade request explains the broker journey and retains the action row', async () => {
  const g = await game(), world = g.host.world;
  expect(world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: world.map.index(45, 8, 32), orientation: 0, materialChoice: 'granite' }).ok).toBe(true);
  const buildings = world.scheduler.byId('14') as BuildingsSystem, depot = buildings.lastPlacedBuilding;
  buildings.completeNow(depot, registry.table('materials').index('granite'), 0);
  const trade = g.host.readers.of<TradeReader>('20'); vi.spyOn(trade, 'activeCaravan').mockReturnValue({ civ: 'hillfolk', state: 'atDepot', daysRemaining: 3 });
  vi.spyOn(g.host, 'submit').mockImplementation(() => true); g.host.setSpeed(0);
  g.fortress.depot.select(g.fortress.ctx, depot); g.fortress.openPanel('depot'); g.fortress.key(press('T', { shift: true }));
  expect(g.fortress.statusRow2()).toContain('The broker is on the way to the depot.');
  expect(g.fortress.statusRow2()).toContain('[Space] resumes');
  const s = surface(80, 20); drawDepotPanel(s, { col: 0, row: 0, cols: 80, rows: 20 }, g.fortress.depot, g.fortress.ctx, () => {});
  expect(s.lines().join('\n')).toContain('[S-t] trade');
 });
 it('mouse quantity controls operate on the grouped merchant count and clamp scrubbing', async () => {
  const g = await game(), m = merchant(g), s = surface(120, 34); m.modal.draw(s);
  const p = (col: number, row: number) => ({ col, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
  m.modal.pointerDown(p(10, 5)); expect(m.modal.quantity('merchant', m.cages[0]!)).toBe(1);
  m.modal.draw(surface(120, 34)); m.modal.pointerDown(p(4, 5));
  expect(m.modal.quantity('merchant', m.cages[0]!)).toBe(0);
  m.modal.draw(surface(120, 34)); m.modal.pointerDown(p(8, 5));
  m.modal.pointerMove(p(200, 5)); m.modal.pointerUp();
  expect(m.modal.quantity('merchant', m.cages[0]!)).toBe(12);
  expect([...m.modal.take.keys()]).toEqual(m.cages);
  m.modal.setQuantity('merchant', m.cages[0]!, -10); expect(m.modal.take.size).toBe(0);
 });
 it('a refused placement keeps its refusal and never leaves a hidden ghost', async () => {
  const g = await game(), f = g.fortress; f.openPanel('build'); f.build.choose('w'); f.build.arm();
  f.build.list.selected = f.build.rows(f.ctx).findIndex(row => row.id === 'carpenter'); f.build.priority = 999;
  const p = point(g, 30, 20); f.pointerMove(p); f.pointerDown(p);
  expect(g.host.readers.of<BuildingsReader>('14').byType('carpenter')).toHaveLength(0);
  expect(f.statusRow2()).toContain('Refused:');
  expect(f.build.ghost(f.ctx, { x: 30, y: 20, z: 32 })).not.toBeNull();
 });

});
