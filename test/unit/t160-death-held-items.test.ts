import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C, ItemFlag } from '@core/components';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';

function world(): TestWorld {
  return new TestWorld({ seed: 't115-death2', map: buildFlatTestMap(contentRegistry(), 48, 48) });
}

function only(w: TestWorld, dwarf: number, labor: string): void {
  for (const name of w.game.registry.table('labors').ids()) w.setLabor(dwarf, name, name === labor);
}

function kill(w: TestWorld, dwarf: number): number {
  const entities = w.game.world.entities;
  const hp = entities.get(dwarf, C.Body)!.parts[1]!.maxHp;
  w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, attackerId: 0,
    part: 'torso', damageType: 'blunt', amount: hp * 2 });
  w.until(() => w.events('CreatureDied').some((event) => event['id'] === dwarf), 5);
  const event = w.events('CreatureDied').find((event) => event['id'] === dwarf)!;
  w.step(1);
  return event['tile'] as number;
}

function expectDropped(w: TestWorld, itemId: number, tile: number): void {
  const items = w.readers.of<ItemsReader>('13');
  const item = items.get(itemId)!;
  expect(item.carriedBy).toBe(0);
  expect(item.containerId).toBe(0);
  expect(item.ownerId).toBe(0);
  expect(item.reservedBy).toBe(0);
  expect(item.flags & (ItemFlag.Owned | ItemFlag.Reserved | ItemFlag.Forbidden)).toBe(0);
  expect(items.tileOf(itemId)).toBe(tile);
  expect(w.readers.entities.get(itemId, C.Position)).toEqual(w.map.unpack(tile));
}

describe('T-160 held items fall at the death tile', () => {
  it('the death2 miner drops the only pick and another miner fetches it', () => {
    const w = world();
    const entities = w.game.world.entities;
    const miner = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 30, skills: { mining: 5 } });
    only(w, miner, 'mining');
    const pick = w.spawnItem('pick', 'iron', w.index(11, 12, 32));
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'channel',
      tiles: Array.from({ length: 8 }, (_, x) => w.index(10 + x, 16, 32)), priority: 5 })).toEqual({ ok: true });
    w.until(() => entities.get(miner, C.Worker)?.toolId === pick, 1000);
    expect(entities.get(miner, C.Equipment)?.weapon).toBe(0);
    const worn = Object.values(entities.get(miner, C.Equipment)!.clothing).filter((id) => id !== 0);
    const tile = kill(w, miner);
    expect(entities.alive(miner)).toBe(false);
    expect(entities.get(miner, C.Worker)).toBeUndefined();
    expectDropped(w, pick, tile);
    expect(w.events('ToolDropped').filter((event) => event['itemId'] === pick)).toHaveLength(1);
    w.until(() => entities.with(C.Corpse).length > 0, 10);
    const corpse = entities.with(C.Corpse)[0]!;
    expect(entities.get(corpse, C.Corpse)?.wornItems).toEqual(expect.arrayContaining(worn));
    expect(entities.get(corpse, C.Corpse)?.wornItems).not.toContain(pick);
    for (const id of worn) expect(entities.get(id, C.Item)?.carriedBy).toBe(corpse);
    const replacement = w.spawnDwarf({ at: w.index(10, 11, 32), ageYears: 30, skills: { mining: 5 } });
    only(w, replacement, 'mining');
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'channel',
      tiles: [10, 11, 12, 13].map((x) => w.index(x, 18, 32)), priority: 5 })).toEqual({ ok: true });
    w.until(() => entities.get(replacement, C.Worker)?.toolId === pick, 1000);
    w.until(() => w.events('JobCompleted').some((event) => event['jobType'] === 'channel'
      && event['workerId'] === replacement), 2000);
  });

  it('a hauler killed after pickup drops and releases the carried item for a replacement', () => {
    const w = world();
    const entities = w.game.world.entities;
    const hauler = w.spawnDwarf({ at: w.index(30, 30, 32), ageYears: 30 });
    only(w, hauler, 'hauling');
    const stone = w.spawnItem('raw_stone', 'granite', w.index(40, 40, 32));
    const stockpile = w.zone('stockpile', [w.index(5, 40, 32), w.index(6, 40, 32)]);
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: stockpile,
      filter: { categories: ['stone/raw'], materialClasses: 'any', minQuality: 0, maxQuality: 5, allowRot: false } })).toEqual({ ok: true });
    w.until(() => entities.get(hauler, C.Worker)?.carrying === stone, 1000);
    const item = entities.get(stone, C.Item)!;
    expect(item.carriedBy).toBe(hauler);
    expect(item.reservedBy).toBeGreaterThan(0);
    const tile = kill(w, hauler);
    expectDropped(w, stone, tile);
    const replacement = w.spawnDwarf({ at: w.index(30, 31, 32), ageYears: 30 });
    only(w, replacement, 'hauling');
    w.until(() => w.events('JobCompleted').some((event) => event['jobType'] === 'haul_to_stockpile'
      && event['workerId'] === replacement), 3000);
    expect(w.readers.of<ItemsReader>('13').stockpileAt(w.readers.of<ItemsReader>('13').tileOf(stone))).toBe(stockpile);
  });

  it('a tool also referenced by Equipment stays worn by the corpse', () => {
    const w = world();
    const entities = w.game.world.entities;
    const miner = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 30 });
    only(w, miner, 'mining');
    const pick = w.spawnItem('pick', 'iron', w.index(11, 12, 32));
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'channel',
      tiles: [w.index(10, 16, 32)], priority: 5 })).toEqual({ ok: true });
    w.until(() => entities.get(miner, C.Worker)?.toolId === pick, 1000);
    entities.add(miner, C.Equipment, { ...entities.get(miner, C.Equipment)!, weapon: pick });
    kill(w, miner);
    w.until(() => entities.with(C.Corpse).length > 0, 10);
    const corpse = entities.with(C.Corpse)[0]!;
    expect(entities.get(corpse, C.Corpse)?.wornItems).toContain(pick);
    expect(entities.get(pick, C.Item)?.carriedBy).toBe(corpse);
    expect(entities.get(pick, C.Position)).toBeUndefined();
    expect(w.events('ToolDropped').filter((event) => event['itemId'] === pick)).toHaveLength(0);
  });

  it('dropping a build input retains the job\'s other reserved inputs', () => {
    const w = world();
    const entities = w.game.world.entities;
    const builder = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 30 });
    only(w, builder, 'masonry');
    const blocks = w.spawnItem('stone_block', 'granite', w.index(11, 12, 32), 3);
    const log = w.spawnItem('log', 'pine', w.index(14, 12, 32));
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'hearth',
      origin: w.index(30, 30, 32), orientation: 0, materialChoice: 0 })).toEqual({ ok: true });
    w.until(() => entities.get(builder, C.Worker)?.carrying === blocks, 1000);
    const jobId = entities.get(builder, C.Worker)!.jobId;
    expect(entities.get(log, C.Item)?.reservedBy).toBe(jobId);
    expect(entities.get(log, C.Item)?.carriedBy).toBe(0);
    const tile = kill(w, builder);
    expectDropped(w, blocks, tile);
    expect(entities.get(log, C.Item)?.reservedBy).toBe(jobId);
    const replacement = w.spawnDwarf({ at: w.index(10, 11, 32), ageYears: 30 });
    only(w, replacement, 'masonry');
    w.until(() => w.events('BuildingCompleted').length > 0, 3000);
    expect(entities.alive(blocks)).toBe(false);
    expect(entities.alive(log)).toBe(false);
  });

});
