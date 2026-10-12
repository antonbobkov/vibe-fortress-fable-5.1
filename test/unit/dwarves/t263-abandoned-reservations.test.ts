/** T-263: controller changes and death end the personal reservation's lifetime. */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C, ItemFlag } from '@core/components';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

function trip(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const id = w.spawnDwarf({ at: w.index(12, 12, Z) });
  const target = w.index(30, 30, Z);
  const otherTarget = w.index(31, 30, Z);
  w.zone('stockpile', [target, otherTarget]);
  const barrel = w.spawnItem('barrel', 'oak', target);
  const otherBarrel = w.spawnItem('barrel', 'oak', otherTarget);
  const drink = w.spawnItem('drink', 'ale', { containerId: barrel });
  const otherDrink = w.spawnItem('drink', 'ale', { containerId: otherBarrel });
  w.setNeed(id, 'thirst', 86);
  w.step(1);
  expect(w.dwarves.activities.plans.get(id)?.itemId).toBe(drink);
  return { w, id, drink, otherDrink, target };
}
function weep(a: ReturnType<typeof trip>) {
  a.w.game.world.emit({ type: 'SulkHappened', id: a.id, kind: 'weep', targetTile: -1 });
  a.w.step(1);
}
function die(w: TestWorld, id: number) {
  const damage = 2 * w.game.world.entities.get(id, C.Body)!.parts[1]!.maxHp;
  w.game.world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'blunt', amount: damage });
  w.until(() => w.events('CreatureDied').some(event => event['id'] === id), 5);
}

describe('T-263 abandoned personal reservations', () => {
  it('releases the travelling drink and stops its walk before delivering weeping', () => {
    const a = trip('t263-weep');
    let observed = false;
    a.w.game.world.onEvents(batch => {
      if (!batch.some(event => event.type === 'SulkHappened' && event['id'] === a.id)) return;
      observed = true;
      expect(a.w.dwarves.activities.plans.has(a.id)).toBe(false);
      expect(a.w.game.world.entities.get(a.drink, C.Item)?.reservedBy).toBe(0);
      expect(a.w.game.movement.walkTarget(a.id)).toBe(-1);
    });
    weep(a); expect(observed).toBe(true);
    // A normal threshold interrupt requests another selection, as work did in the trace.
    a.w.setNeed(a.id, 'rest', 61);
    a.w.step(1);
    expect(a.w.events('ItemReleased').filter(event => event['itemId'] === a.drink && event['jobId'] === a.id)).toHaveLength(1);
    const held = [a.drink, a.otherDrink].filter(item => a.w.game.world.entities.get(item, C.Item)?.reservedBy === a.id);
    expect(held).toHaveLength(1);
    expect(held[0]).toBe(a.w.dwarves.activities.plans.get(a.id)?.itemId);
  });

  it('drops a held meal and updates its spatial and available indices on weeping', () => {
    const w = new TestWorld({ seed: 't263-held-meal', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const at = w.index(12, 12, Z); const id = w.spawnDwarf({ at });
    const meal = w.spawnItem('easy_meal', 'dimcap', at);
    w.setNeed(id, 'hunger', 86); w.step(2);
    expect(w.game.world.entities.get(meal, C.Item)?.carriedBy).toBe(id);
    w.game.world.emit({ type: 'SulkHappened', id, kind: 'weep', targetTile: -1 });
    w.step(1);
    expect(w.game.world.entities.get(meal, C.Item)?.carriedBy).toBe(0);
    expect(w.game.world.entities.get(meal, C.Item)?.reservedBy).toBe(0);
    const items = w.readers.of<ItemsReader>('13');
    expect(items.at(at)).toContain(meal);
    expect(items.available('easy_meal')).toBe(1);
  });

  it('saves the interrupted boundary and preserves the next 50 hashes', () => {
    const a = trip('t263-save'); weep(a);
    expect(a.w.game.world.entities.get(a.drink, C.Item)?.reservedBy).toBe(0);
    const loaded = roundTrip(a.w.game).game;
    expect(loaded.hash()).toBe(a.w.hash());
    for (let tick = 0; tick < 50; tick += 1) {
      a.w.step(1); loaded.step(1); expect(loaded.hash()).toBe(a.w.hash());
    }
  });

  it('preserves a reservation transferred to another holder before the interruption', () => {
    const a = trip('t263-other-holder');
    const other = a.w.spawnDwarf({ at: a.w.index(11, 12, Z) });
    a.w.items.reserve(a.drink, other);
    weep(a); a.w.step(1);
    expect(a.w.game.world.entities.get(a.drink, C.Item)?.reservedBy).toBe(other);
    expect(a.w.events('ItemReleased').filter(event => event['itemId'] === a.drink)).toHaveLength(0);
  });

  it('releases legacy reservations with no current plan on death, preserving another holder', () => {
    const w = new TestWorld({ seed: 't263-legacy-death', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const at = w.index(12, 12, Z); const id = w.spawnDwarf({ at });
    const other = w.spawnDwarf({ at: w.index(11, 12, Z) });
    const barrel = w.spawnItem('barrel', 'oak', at);
    const drink = w.spawnItem('drink', 'ale', { containerId: barrel });
    const meal = w.spawnItem('easy_meal', 'dimcap', at);
    const heldElsewhere = w.spawnItem('drink', 'ale', w.index(14, 12, Z));
    for (const item of [drink, meal]) w.items.reserve(item, id);
    w.items.reserve(heldElsewhere, other);
    expect(w.dwarves.activities.plans.has(id)).toBe(false);
    die(w, id); w.step(1);
    for (const item of [drink, meal]) {
      const record = w.game.world.entities.get(item, C.Item)!;
      expect(record.reservedBy).toBe(0);
      expect(record.flags & ItemFlag.Reserved).toBe(0);
      expect(w.events('ItemReleased').filter(event => event['itemId'] === item && event['jobId'] === id)).toHaveLength(1);
    }
    expect(w.game.world.entities.get(heldElsewhere, C.Item)?.reservedBy).toBe(other);
  });

  it('releases an active plan once at death, without a duplicate death-cleanup event', () => {
    const a = trip('t263-active-death'); die(a.w, a.id); a.w.step(1);
    expect(a.w.game.world.entities.get(a.drink, C.Item)?.reservedBy).toBe(0);
    expect(a.w.events('ItemReleased').filter(event => event['itemId'] === a.drink && event['jobId'] === a.id)).toHaveLength(1);
  });
});
