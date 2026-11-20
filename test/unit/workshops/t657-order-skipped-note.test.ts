import { describe, expect, it } from 'vitest';
import { C, type WorkOrder, type Workshop } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { WorkshopsReader } from '@systems/workshops';
import { OUT_OF_REACH_RETRY_TICKS } from '@systems/workshops/constants';
import { AnnouncementLog } from '@ui/announcements';
import type { PanelContext } from '@ui/panels/context';
import { OrdersPanel } from '@ui/panels/orders';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from '../ui/ui-fixture';

const Z = 32;

/**
 * T-657 (12 § Operation 2, § Registrations): an order skipped because its inputs lie out of reach
 * is told in the log once, while the workshop works its next order and while it stays skipped,
 * and the skip is remembered by the order's recipe and material filter, so a second order of the
 * recipe with another filter is not held back with it. The goods out of reach lie in a walled pen
 * whose door is locked.
 */
function pen(w: TestWorld): EntityId {
  const terrain = w.game.world.services.terrain;
  const granite = w.game.registry.table('materials').index('granite');
  const [x0, y0, size] = [30, 10, 5];
  for (let k = 0; k < size; k += 1) {
    for (const [x, y] of [[x0 + k, y0], [x0 + k, y0 + size - 1], [x0, y0 + k], [x0 + size - 1, y0 + k]] as const) {
      terrain.setKind(w.index(x, y, Z), TileKind.Wall, granite);
    }
  }
  const gate = w.index(x0 + 2, y0 + size - 1, Z);
  terrain.setKind(gate, TileKind.Floor, granite);
  const door = w.build('door', gate, 'oak');
  expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' })).toEqual({ ok: true });
  return door;
}

function provisions(w: TestWorld, skills: Record<string, number>): void {
  w.spawnItem('easy_meal', 'dimcap', w.index(22, 22, Z), 20);
  w.spawnItem('drink', 'ale', w.index(23, 22, Z), 20);
  w.spawnDwarf({ at: w.index(18, 19, Z), skills });
}

function logFor(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry, defaultUiState(Z));
  log.register(w.game.world.registrations.announcements);
  return log;
}

const crafted = (w: TestWorld, recipe: string): number => w.events('ItemCrafted').filter((e) => e['recipeId'] === recipe).length;
const skipped = (w: TestWorld, workshop: EntityId): Record<string, unknown>[] =>
  w.events('WorkOrderSkipped').filter((e) => e['workshopId'] === workshop).map((e) => ({ ...e }));

describe('T-657 an order skipped as out of reach is told in the log once', () => {
  it('a smelter skipping its steel for its lignite writes one note naming the charcoal, and none while it stays skipped', () => {
    const w = new TestWorld({ seed: 't657-note', world: 'flat-test', embark: 'none' });
    const door = pen(w);
    w.spawnItem('charcoal_bar', 'charcoal', w.index(32, 12, Z), 2);
    const smelter = w.build('smelter', w.index(15, 15, Z));
    // Another door, in a wall of its own, whose change makes the smelter look at the steel again.
    const granite = w.game.registry.table('materials').index('granite');
    for (const x of [9, 11]) w.game.world.services.terrain.setKind(w.index(x, 30, Z), TileKind.Wall, granite);
    const other = w.build('door', w.index(10, 30, Z), 'oak');
    for (const y of [16, 17]) {
      w.spawnItem('bar', 'iron', w.index(18, y, Z));
      w.spawnItem('raw_stone', 'limestone', w.index(19, y, Z));
    }
    w.spawnItem('ore', 'lignite', w.index(19, 18, Z));
    provisions(w, { smelting: 8 });
    w.step(1);
    for (const recipeId of ['alloy_steel', 'smelt_lignite']) {
      expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
        order: { recipeId, mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    }
    w.step(2);
    // The note comes as the smelter starts the lignite, before it is idle.
    expect(skipped(w, smelter)).toEqual([{ type: 'WorkOrderSkipped', workshopId: smelter, recipeId: 'alloy_steel', input: 'charcoal_bar' }]);
    expect(w.events('WorkshopBlocked').filter((e) => e['workshopId'] === smelter)).toEqual([]);
    const line = logFor(w).announce(w.events('WorkOrderSkipped')[0]!, w.readers, w.tick);
    expect(line?.severity).toBe('note');
    expect(line?.line.text).toBe('Smelter #1 skips its make steel order: no charcoal within reach.');
    // The lignite is smelted, the steel is looked at again after each retry and after a door changes, and stays told.
    w.until((x) => crafted(x, 'smelt_lignite') > 0, 3_000);
    w.step(OUT_OF_REACH_RETRY_TICKS * 2);
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: other, mode: 'locked' })).toEqual({ ok: true });
    w.step(OUT_OF_REACH_RETRY_TICKS);
    expect(w.events('BuildingStateChanged').some((e) => e['id'] === other)).toBe(true);
    expect(skipped(w, smelter)).toHaveLength(1);
    const kept = (w.game.world.entities.get(smelter, C.Workshop) as Workshop).outOfReach ?? [];
    expect(kept.map((entry) => entry.recipe)).toEqual(['alloy_steel']);
    // The door opens: the steel is made, its memory goes, and a later skip would be told again.
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'open' })).toEqual({ ok: true });
    w.until((x) => crafted(x, 'alloy_steel') > 0, 2_000);
    expect((w.game.world.entities.get(smelter, C.Workshop) as Workshop).outOfReach).toBeUndefined();
    expect(skipped(w, smelter)).toHaveLength(1);
  }, 60_000);

  it('two orders of one recipe with different material filters are skipped apart', () => {
    const w = new TestWorld({ seed: 't657-filter', world: 'flat-test', embark: 'none' });
    pen(w);
    w.spawnItem('log', 'oak', w.index(32, 12, Z));
    w.spawnItem('log', 'pine', w.index(18, 16, Z));
    const shop = w.build('carpenter', w.index(15, 15, Z));
    provisions(w, { carpentry: 8 });
    w.step(1);
    for (const materialFilter of ['oak', 'pine']) {
      expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: shop,
        order: { recipeId: 'make_chair_wood', mode: 'once', remaining: 1, priority: 5, materialFilter } })).toEqual({ ok: true });
    }
    w.step(2);
    const oak = w.game.registry.table('materials').index('oak');
    expect(skipped(w, shop)).toEqual([{ type: 'WorkOrderSkipped', workshopId: shop, recipeId: 'make_chair_wood', input: 'log' }]);
    expect((w.game.world.entities.get(shop, C.Workshop) as Workshop).outOfReach)
      .toEqual([{ recipe: 'make_chair_wood', material: oak, input: 'log', until: expect.any(Number) as number }]);
    // The pine chair is made while the oak one stays skipped, and each Orders row says its own status.
    w.until((x) => crafted(x, 'make_chair_wood') > 0, 3_000);
    const ctx: PanelContext = {
      readers: w.readers, registry: w.game.registry, strings, submit: (cmd) => w.submit(cmd),
      focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
    };
    const orders = w.readers.of<WorkshopsReader>('12').ordersOf(shop);
    expect(orders).toHaveLength(1);
    const panel = new OrdersPanel();
    expect(panel.status(ctx, { kind: 'live', entry: { workshopId: shop, index: 0, order: orders[0] as WorkOrder } }).short).toBe('log out of reach');
    expect(skipped(w, shop)).toHaveLength(1);
  }, 60_000);
});
