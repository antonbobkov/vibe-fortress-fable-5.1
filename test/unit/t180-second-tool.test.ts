import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';

const Z = 32;

function world(): TestWorld {
  return new TestWorld({ seed: 't180-toolswap', map: buildFlatTestMap(contentRegistry(), 48, 48) });
}

function only(w: TestWorld, dwarf: number, on: string[]): void {
  for (const name of w.game.world.registry.table('labors').ids()) w.setLabor(dwarf, name, on.includes(name));
}

function done(w: TestWorld, jobType: string): number {
  return w.events('JobCompleted').filter((e) => e['jobType'] === jobType).length;
}

describe('T-180 a worker holds one tool', () => {
  it('a miner that chops puts the pick down and the next dig is not blocked', () => {
    const w = world();
    const entities = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const d = w.spawnDwarf({ at: w.index(10, 10, Z), ageYears: 30, skills: { mining: 5 } });
    only(w, d, ['mining', 'woodcutting']);
    const pick = w.spawnItem('pick', 'iron', w.index(11, 12, Z));
    const axe = w.spawnItem('axe', 'iron', w.index(12, 12, Z));
    w.spawnItem('easy_meal', 'dimcap', w.index(20, 20, Z), 60);
    w.spawnItem('drink', 'ale', w.index(21, 20, Z), 60);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'channel',
      tiles: [10, 11].map((x) => w.index(x, 16, Z)), priority: 5 })).toEqual({ ok: true });
    w.until(() => done(w, 'channel') >= 2, 2 * TICKS_PER_DAY);
    expect(entities.get(d, C.Worker)?.toolId).toBe(pick);

    const trees = [w.index(20, 10, Z), w.index(22, 10, Z)];
    for (const t of trees) w.map.setKind(t, TileKind.Tree, w.game.registry.table('materials').index('pine'));
    w.step(2);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'chop', tiles: trees, priority: 5 })).toEqual({ ok: true });
    w.until(() => done(w, 'chop') >= 2, 2 * TICKS_PER_DAY);
    expect(entities.get(d, C.Worker)?.toolId).toBe(axe);
    expect(items.carriedItems(d)).not.toContain(pick);
    expect(items.get(pick)?.carriedBy).toBe(0);
    expect(w.events('ToolDropped').filter((e) => e['itemId'] === pick)).toHaveLength(1);

    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'channel',
      tiles: [10, 11, 12, 13].map((x) => w.index(x, 18, Z)), priority: 5 })).toEqual({ ok: true });
    const second = w.spawnDwarf({ at: w.index(10, 11, Z), ageYears: 30, skills: { mining: 5 } });
    only(w, second, ['mining']);
    w.until(() => done(w, 'channel') >= 6, 5 * TICKS_PER_DAY);
    expect(done(w, 'channel')).toBeGreaterThanOrEqual(6);
  }, 120_000);

  it('an axe in the weapon slot counts as held: no tool is fetched', () => {
    const w = world();
    const entities = w.game.world.entities;
    const d = w.spawnDwarf({ at: w.index(10, 10, Z), ageYears: 30, skills: { woodcutting: 5 } });
    only(w, d, ['woodcutting']);
    const axe = w.spawnItem('axe', 'iron', w.index(10, 10, Z));
    w.game.world.services.items!.attachToCarrier(axe, d);
    entities.add(d, C.Equipment, { ...entities.get(d, C.Equipment)!, weapon: axe });
    w.spawnItem('easy_meal', 'dimcap', w.index(20, 20, Z), 60);
    w.spawnItem('drink', 'ale', w.index(21, 20, Z), 60);
    const trees = [w.index(14, 10, Z)];
    for (const t of trees) w.map.setKind(t, TileKind.Tree, w.game.registry.table('materials').index('pine'));
    w.step(2);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'chop', tiles: trees, priority: 5 })).toEqual({ ok: true });
    w.until(() => done(w, 'chop') >= 1, 2 * TICKS_PER_DAY);
    expect(done(w, 'chop')).toBe(1);
    expect(w.events('ToolEquipped')).toHaveLength(0);
    expect(w.events('ToolDropped')).toHaveLength(0);
    expect(w.readers.of<ItemsReader>('13').get(axe)?.carriedBy).toBe(d);
  }, 120_000);

  it('a pick carried by a dwarf that holds no tool is dropped on the first tick', () => {
    const w = world();
    const items = w.readers.of<ItemsReader>('13');
    const d = w.spawnDwarf({ at: w.index(10, 10, Z), ageYears: 30 });
    const pick = w.spawnItem('pick', 'iron', w.index(10, 10, Z));
    w.game.world.services.items!.attachToCarrier(pick, d);
    expect(items.get(pick)?.carriedBy).toBe(d);
    w.step(1);
    expect(items.get(pick)?.carriedBy).toBe(0);
    expect(items.tileOf(pick)).toBe(w.index(10, 10, Z));
    expect(w.events('ToolDropped').filter((e) => e['itemId'] === pick)).toHaveLength(1);
  });
});
