import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C, type WorkOrder, type Workshop } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { JobsReader } from '@systems/jobs/reader';
import type { WorkshopsReader } from '@systems/workshops';
import { OUT_OF_REACH_RETRY_TICKS } from '@systems/workshops/constants';
import { workshopBlockText } from '@ui/messages';
import type { PanelContext } from '@ui/panels/context';
import { OrdersPanel, workshopWaiting } from '@ui/panels/orders';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from '../ui/ui-fixture';

const Z = 32;

/**
 * T-648 (12 § Operation): in `three-years-p4-6` the smelter's steel order counted the charcoal on the
 * surface as its fuel while the gate was locked; its job waited `blocked: missing_input`, holding the
 * smelter from the coal it could have smelted. A smelter here has a steel order, then a lignite
 * smelt; the charcoal lies in a walled pen whose door is locked (from the start, or once the steel's
 * job is made). The steel is skipped for the lignite, said to be out of reach, and made once the door
 * opens.
 */
function setup(seed: string, locked: boolean): { w: TestWorld; smelter: EntityId; door: EntityId } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
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
  if (locked) expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' })).toEqual({ ok: true });
  w.spawnItem('charcoal_bar', 'charcoal', w.index(x0 + 2, y0 + 2, Z), 2);
  const smelter = w.build('smelter', w.index(15, 15, Z));
  // Two of each: a claim that reserves one and fails on the fuel leaves the order runnable by its count.
  for (const y of [16, 17]) {
    w.spawnItem('bar', 'iron', w.index(18, y, Z));
    w.spawnItem('raw_stone', 'limestone', w.index(19, y, Z));
  }
  w.spawnItem('ore', 'lignite', w.index(19, 18, Z));
  w.spawnItem('easy_meal', 'dimcap', w.index(22, 22, Z), 20);
  w.spawnItem('drink', 'ale', w.index(23, 22, Z), 20);
  w.spawnDwarf({ at: w.index(18, 19, Z), skills: { smelting: 8 } });
  w.step(1);
  for (const recipeId of ['alloy_steel', 'smelt_lignite']) {
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
      order: { recipeId, mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
  }
  return { w, smelter, door };
}

function ctxOf(w: TestWorld): PanelContext {
  return {
    readers: w.readers, registry: w.game.registry, strings, submit: (cmd) => w.submit(cmd),
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
}

const crafted = (w: TestWorld, recipe: string): number => w.events('ItemCrafted').filter((e) => e['recipeId'] === recipe).length;

describe('T-648 a workshop skips an order whose inputs are out of reach for its next one', () => {
  it('a job that blocks when the door locks after it was made is let go, and the next order runs', () => {
    const { w, smelter, door } = setup('t648-blocked', false);
    w.step(1);
    const steelJob = w.game.world.entities.get(smelter, C.Workshop)?.currentJobId ?? 0;
    expect(w.readers.of<JobsReader>('11').get(steelJob)?.data['recipe']).toBe('alloy_steel');
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' })).toEqual({ ok: true });
    w.until((x) => crafted(x, 'smelt_lignite') > 0, 3_000);
    expect(w.events('JobCancelled').filter((e) => e['jobId'] === steelJob).map((e) => e['reason'])).toEqual(['out_of_reach']);
    expect(crafted(w, 'alloy_steel')).toBe(0);
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'open' })).toEqual({ ok: true });
    w.until((x) => crafted(x, 'alloy_steel') > 0, 2_000);
  }, 60_000);

  it('the panels say which input is out of reach', () => {
    const { w, smelter } = setup('t648-panel', true);
    const ctx = ctxOf(w);
    const panel = new OrdersPanel();
    const reader = w.readers.of<WorkshopsReader>('12');
    w.step(1);
    const steel = reader.ordersOf(smelter)[0] as WorkOrder;
    expect(panel.status(ctx, { kind: 'live', entry: { workshopId: smelter, index: 0, order: steel } }).short).toBe('charcoal out of reach');
    panel.openPicker(ctx, { workshopId: smelter });
    const recipe = panel.pickerRecipes(ctx).find((r) => r.id === 'alloy_steel');
    expect(recipe).toBeDefined();
    if (recipe !== undefined) expect(panel.pickerNote(ctx, recipe)).toBe('· charcoal out of reach');
    // Once the lignite is smelted the smelter is idle, and says why.
    w.until((x) => crafted(x, 'smelt_lignite') > 0, 3_000);
    w.step(2);
    const ws = w.game.world.entities.get(smelter, C.Workshop) as Workshop;
    expect(ws.lastBlockedReason).toBe('out_of_reach');
    expect(workshopBlockText(ctx, workshopWaiting(reader, smelter, ws))).toBe('Skipped: charcoal out of reach. Tried again later, or when a door opens.');
  }, 60_000);

  it('the remembered recipe is saved, kept until its time is over, and renewed while out of reach', () => {
    const { w, smelter } = setup('t648-saved', true);
    w.step(2);
    const first = w.game.world.entities.get(smelter, C.Workshop)?.outOfReach ?? [];
    expect(first).toEqual([{ recipe: 'alloy_steel', input: 'charcoal_bar', until: expect.any(Number) as number }]);
    const until = (first[0] as { until: number }).until;
    expect(until - w.tick).toBeGreaterThan(OUT_OF_REACH_RETRY_TICKS - 5);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    expect(loaded.world.entities.get(smelter, C.Workshop)?.outOfReach).toEqual(first);
    w.replaceGame(loaded);
    w.until((x) => crafted(x, 'smelt_lignite') > 0, 3_000);
    w.step(Math.max(1, until - w.tick + 2));
    const renewed = w.game.world.entities.get(smelter, C.Workshop)?.outOfReach ?? [];
    expect(renewed).toHaveLength(1);
    expect((renewed[0] as { until: number }).until).toBeGreaterThan(until);
  }, 60_000);
});
