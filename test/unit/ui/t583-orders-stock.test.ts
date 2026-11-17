/**
 * T-583: a keep order's status counts what its workshop counts (12 § Work orders; panels.md § Orders).
 * The orders panel said "stocked (303)" for a keep order of mead or spirits in a fortress with 303
 * units of ale, and "stocked (132)" for glass blocks kept by a material filter while the fortress had
 * sandstone blocks and no glass: it counted every unit of the output type, where the workshop counts
 * the order's material, or a drink's fixed material.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { WorkOrder } from '@core/components';
import { computeLayout } from '@render/cellbuffer';
import type { WorkshopsReader, WorkshopsSystem } from '@systems/workshops';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string): { w: TestWorld; screen: FortressScreen } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => { w.submit(cmd); },
    speed: () => 1,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => computeLayout(80, 42, true),
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    confirm: (_id, _params, reply) => reply(true),
  };
  return { w, screen: new FortressScreen(host, keymap, strings) };
}

/** The panel's status of each order, and whether the workshop itself calls it stocked. */
function statuses(w: TestWorld, screen: FortressScreen): { panel: string; stocked: boolean }[] {
  const operator = (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
  screen.openPanel('orders');
  return screen.orders.rows(screen.ctx).map((row) => {
    const panel = screen.orders.status(screen.ctx, row).short;
    const entry = row.kind === 'live' ? row.entry : null;
    return { panel, stocked: entry !== null && operator.problem(entry.order as WorkOrder, entry.workshopId) === 'stocked' };
  });
}

describe('T-583 a keep order counts what its workshop counts', () => {
  it('spirits and mead count their own drink, not the ale beside them', () => {
    const { w, screen } = setup('t583-orders-drink');
    const still = w.build('still', w.index(10, 10, z), 'granite');
    const ale = w.spawnItem('barrel', 'pine', w.index(16, 12, z));
    w.spawnItem('drink', 'ale', { containerId: ale }, 20);
    const wine = w.spawnItem('barrel', 'pine', w.index(17, 12, z));
    w.spawnItem('drink', 'strawberry_wine', { containerId: wine }, 20);
    w.step(1);
    w.submit({ type: 'AddWorkOrder', workshopId: still, order: { recipeId: 'distill', mode: 'maintain', threshold: 10, priority: 5 } });
    w.submit({ type: 'AddWorkOrder', workshopId: still, order: { recipeId: 'brew_mead', mode: 'maintain', threshold: 10, priority: 5 } });
    w.step(1);
    // Forty units of drink, none of them deepfire or mead: neither order is stocked.
    let rows = statuses(w, screen);
    expect(rows.map((r) => r.stocked)).toEqual([false, false]);
    for (const r of rows) expect(r.panel).not.toMatch(/^stocked/);
    // Twenty deepfire stocks the spirits order, and only it.
    const spirits = w.spawnItem('barrel', 'pine', w.index(18, 12, z));
    w.spawnItem('drink', 'deepfire', { containerId: spirits }, 20);
    w.step(1);
    rows = statuses(w, screen);
    expect(rows.map((r) => r.stocked)).toEqual([true, false]);
    expect(rows[0]?.panel).toBe('stocked (20)');
    expect(rows[1]?.panel).not.toMatch(/^stocked/);
  });

  it('a glass block kept by its material counts glass, and with no filter it counts glass too (T-585), as the kiln does', () => {
    const { w, screen } = setup('t583-orders-glass');
    const kiln = w.build('kiln', w.index(10, 10, z), 'granite');
    w.spawnItem('stone_block', 'granite', w.index(16, 12, z), 30);
    w.step(1);
    w.submit({ type: 'AddWorkOrder', workshopId: kiln, order: { recipeId: 'make_glass_block', mode: 'maintain', threshold: 4, priority: 5, materialFilter: 'glass' } });
    w.submit({ type: 'AddWorkOrder', workshopId: kiln, order: { recipeId: 'make_glass_block', mode: 'maintain', threshold: 4, priority: 5 } });
    w.step(1);
    const rows = statuses(w, screen);
    expect(rows.map((r) => r.stocked)).toEqual([false, false]);
    for (const r of rows) expect(r.panel).not.toMatch(/^stocked/);
    expect(w.readers.of<WorkshopsReader>('12').orderStock(w.readers.of<WorkshopsReader>('12').ordersOf(kiln)[0]!)).toBe(0);
  });
});
