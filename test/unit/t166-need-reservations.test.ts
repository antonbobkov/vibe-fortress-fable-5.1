import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C, ItemFlag } from '@core/components';
import type { ItemsReader, ItemsSystem } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';

function errand(need: 'hunger' | 'thirst' = 'hunger'): { w: TestWorld; dwarf: number; item: number } {
  const w = new TestWorld({ seed: 't115-death2', map: buildFlatTestMap(contentRegistry(), 48, 48) });
  const entities = w.game.world.entities;
  const dwarf = w.spawnDwarf({ at: w.index(4, 4, 32), ageYears: 30 });
  for (const labor of w.game.registry.table('labors').ids()) w.setLabor(dwarf, labor, false);
  const item = w.spawnItem(need === 'hunger' ? 'easy_meal' : 'drink', need === 'hunger' ? 'dimcap' : 'ale', w.index(40, 40, 32));
  w.setNeed(dwarf, need, 55);
  w.until(() => entities.get(item, C.Item)?.reservedBy === dwarf, 100);
  expect(entities.get(item, C.Item)?.carriedBy).toBe(0);
  expect(w.dwarves.activities.plans.get(dwarf)?.itemId).toBe(item);
  return { w, dwarf, item };
}
function released(w: TestWorld, dwarf: number, item: number): void {
  w.until(() => w.game.world.entities.get(item, C.Item)?.reservedBy === 0, 10);
  w.step(2);
  expect(w.game.world.entities.get(item, C.Item)!.flags & ItemFlag.Reserved).toBe(0);
  expect(w.events('ItemReleased').filter((e) => e['itemId'] === item && e['jobId'] === dwarf)).toHaveLength(1);
  expect(w.dwarves.activities.plans.has(dwarf)).toBe(false);
}

describe('T-166 a need reservation ends when the errand ends', () => {
  it.each(['hunger', 'thirst'] as const)('death on the walk releases a %s reservation once', (need) => {
    const { w, dwarf, item } = errand(need);
    const hp = w.game.world.entities.get(dwarf, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, attackerId: 0,
      part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CreatureDied').some((event) => event['id'] === dwarf), 5);
    released(w, dwarf, item);
  });

  it('death after picking up a meal drops it at the death tile and releases it once', () => {
    const { w, dwarf, item } = errand();
    const entities = w.game.world.entities;
    w.until(() => entities.get(item, C.Item)?.carriedBy === dwarf, 1000);
    const pos = entities.get(dwarf, C.Position)!;
    const deathTile = w.index(pos.x, pos.y, pos.z);
    const hp = entities.get(dwarf, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, attackerId: 0,
      part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CreatureDied').some((event) => event['id'] === dwarf), 5);
    released(w, dwarf, item);
    expect(entities.get(item, C.Item)?.carriedBy).toBe(0);
    expect(w.readers.of<ItemsReader>('13').tileOf(item)).toBe(deathTile);
  });

  it('death drops a held meal without releasing its changed reservation', () => {
    const { w, dwarf, item } = errand();
    const entities = w.game.world.entities;
    w.until(() => entities.get(item, C.Item)?.carriedBy === dwarf, 1000);
    const other = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 30 });
    for (const labor of w.game.registry.table('labors').ids()) w.setLabor(other, labor, false);
    const pos = entities.get(dwarf, C.Position)!;
    const deathTile = w.index(pos.x, pos.y, pos.z);
    w.items.release(item);
    w.items.reserve(item, other);
    const hp = entities.get(dwarf, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, attackerId: 0,
      part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CreatureDied').some((event) => event['id'] === dwarf), 5);
    expect(entities.get(item, C.Item)?.carriedBy).toBe(0);
    expect(w.readers.of<ItemsReader>('13').tileOf(item)).toBe(deathTile);
    expect(entities.get(item, C.Item)?.reservedBy).toBe(other);
    expect(w.events('ItemReleased').filter((e) => e['itemId'] === item)).toHaveLength(0);
  });

  it('unconsciousness abandons the meal errand and releases it once', () => {
    const { w, dwarf, item } = errand();
    const entities = w.game.world.entities;
    entities.add(dwarf, C.Body, { ...entities.get(dwarf, C.Body)!, conscious: false });
    released(w, dwarf, item);
  });

  it('fleeing from a threat releases the abandoned meal once', () => {
    const { w, dwarf, item } = errand();
    const hostile = w.spawnCreature('dwarf', w.index(5, 4, 32), 'hostile:hillfolk');
    w.game.world.emit({ type: 'ThreatNearby', id: dwarf, hostileId: hostile });
    released(w, dwarf, item);
    expect(w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('flee');
  });

  it('food rotting during travel cancels the errand and releases the rotten item', () => {
    const { w, dwarf, item } = errand();
    const core = (w.game.world.scheduler.byId('13') as ItemsSystem).core;
    core.setRot(item, 2, w.game.registry.table('items').index('rotten'));
    released(w, dwarf, item);
    expect(w.events('MealEaten').filter((e) => e['id'] === dwarf)).toHaveLength(0);
  });

  it('abandoning an errand cannot release another holder\'s reservation', () => {
    const { w, dwarf, item } = errand();
    const entities = w.game.world.entities;
    const other = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 30 });
    w.items.release(item);
    w.items.reserve(item, other);
    entities.add(dwarf, C.Body, { ...entities.get(dwarf, C.Body)!, conscious: false });
    w.step(3);
    expect(entities.get(item, C.Item)?.reservedBy).toBe(other);
    expect(entities.get(item, C.Item)!.flags & ItemFlag.Reserved).not.toBe(0);
    expect(w.events('ItemReleased').filter((e) => e['itemId'] === item)).toHaveLength(0);
  });
});
