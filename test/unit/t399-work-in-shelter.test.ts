/**
 * T-399: under a `hearth` alert a sheltering civilian also works the jobs done wholly inside its
 * shelter (11 § Assignment, 10 § Behavior selection step 2); nothing that takes it outside is offered.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z - 7;

function dig(w: TestWorld, x: number, y: number, width: number, height: number): void {
  w.digRoom(x, y, Z, width, height);
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) w.discover(w.index(x + dx, y + dy, Z));
}

const rect = (w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] => {
  const out: TileIndex[] = [];
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) out.push(w.index(x + dx, y + dy, Z));
  return out;
};

/**
 * Chamber A (x 14..19) with the civilian, a door, and chamber B (x 21..27): with no hearth hall, B
 * is the shelter. A log lies in each chamber, each with a stockpile in its own chamber.
 */
function chambers(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  dig(w, 14, 14, 6, 7);
  dig(w, 20, 17, 1, 1);
  w.build('door', w.index(20, 17, Z), 'granite');
  dig(w, 21, 14, 7, 7);
  const dwarf = w.spawnDwarf({ at: w.index(19, 17, Z) });
  const pileA = rect(w, 14, 14, 2, 2);
  const pileB = rect(w, 26, 14, 2, 2);
  for (const tiles of [pileA, pileB]) {
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: w.zone('stockpile', tiles), filter: 'wood' }).ok).toBe(true);
  }
  const logA = w.spawnItem('log', 'oak', w.index(17, 19, Z));
  const logB = w.spawnItem('log', 'oak', w.index(23, 19, Z));
  return { w, dwarf, pileA, pileB, logA, logB };
}

function keepFed(w: TestWorld, dwarf: EntityId): void {
  for (const need of ['hunger', 'thirst', 'rest'] as const) {
    const n = w.game.world.entities.get(dwarf, C.Needs);
    if (n !== undefined && n[need] > 20) w.setNeed(dwarf, need, 0);
  }
}

describe('T-399 a sheltering civilian works what lies inside its shelter', () => {
  it('hauls a log inside the shelter to the stockpile inside it, and leaves the log and the stockpile outside', () => {
    const { w, dwarf, pileA, pileB, logA, logB } = chambers('t399-haul');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    const items = w.readers.of<ItemsReader>('13');
    for (let t = 0; t < 2 * TICKS_PER_DAY; t += 10) {
      w.step(10);
      keepFed(w, dwarf);
      // It never leaves the shelter to work.
      const at = w.game.movement.tileOf(dwarf);
      if (t > 200) expect(w.map.xOf(at)).toBeGreaterThan(20);
    }
    expect(pileB).toContain(items.tileOf(logB));
    expect(items.tileOf(logA)).toBe(w.index(17, 19, Z));
    expect(pileA).not.toContain(items.tileOf(logA));
    expect(w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('retreat');
  });

  it('hauls the log outside once the alert is lowered', () => {
    const { w, dwarf, pileA, logA } = chambers('t399-lowered');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    for (let t = 0; t < TICKS_PER_DAY; t += 10) { w.step(10); keepFed(w, dwarf); }
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'calm' }).ok).toBe(true);
    for (let t = 0; t < TICKS_PER_DAY; t += 10) { w.step(10); keepFed(w, dwarf); }
    expect(pileA).toContain(w.readers.of<ItemsReader>('13').tileOf(logA));
  });

  it('works a dig and a workshop order inside the shelter, with the tool in hand, and none outside it', () => {
    const { w, dwarf } = chambers('t399-work');
    const entities = w.game.world.entities;
    const pick = w.spawnItem('pick', 'iron', w.index(19, 17, Z));
    w.items.attachToCarrier(pick, dwarf);
    entities.add(dwarf, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
    const equipment = entities.get(dwarf, C.Equipment)!;
    entities.add(dwarf, C.Equipment, { ...equipment, weapon: pick });
    // A wall to dig in each chamber; a carpenter with a log in each chamber.
    const digIn = w.index(24, 14, Z);
    const digOut = w.index(16, 14, Z);
    for (const tile of [digIn, digOut]) w.carve(tile, TileKind.Wall);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [digIn, digOut] }).ok).toBe(true);
    const shopIn = w.build('carpenter', w.index(24, 17, Z), 'oak');
    const shopOut = w.build('carpenter', w.index(15, 17, Z), 'oak');
    w.spawnItem('log', 'oak', w.index(25, 20, Z));
    w.spawnItem('log', 'oak', w.index(16, 20, Z));
    w.step(1);
    for (const workshopId of [shopIn, shopOut]) {
      expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId, order: { recipe: 'make_barrel', count: 1 } })).toEqual({ ok: true });
    }
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    for (let t = 0; t < 2 * TICKS_PER_DAY; t += 10) {
      w.step(10);
      keepFed(w, dwarf);
      if (t > 200) expect(w.map.xOf(w.game.movement.tileOf(dwarf))).toBeGreaterThan(20);
    }
    expect(w.map.kindAt(digIn)).toBe(TileKind.Floor);
    expect(w.map.kindAt(digOut)).toBe(TileKind.Wall);
    const crafted = w.events('JobCompleted').filter((e) => e['jobType'] === 'craft').map((e) => e['target']);
    expect(crafted).toContain(shopIn);
    expect(crafted).not.toContain(shopOut);
  });
});
