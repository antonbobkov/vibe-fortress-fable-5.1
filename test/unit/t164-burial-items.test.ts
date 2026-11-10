import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { roundTrip } from '@app/game-save';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';

function world(): TestWorld {
  return new TestWorld({ seed: 't115-burial', map: buildFlatTestMap(contentRegistry(), 48, 48) });
}
function kill(w: TestWorld, dwarf: number): number {
  const entities = w.game.world.entities;
  const hp = entities.get(dwarf, C.Body)!.parts[1]!.maxHp;
  w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, attackerId: 0,
    part: 'torso', damageType: 'blunt', amount: hp * 2 });
  w.until(() => w.events('CreatureDied').some((event) => event['id'] === dwarf), 5);
  w.until(() => entities.with(C.Corpse).length > 0, 10);
  return entities.with(C.Corpse)[0]!;
}

describe('T-164 burial consumes clothing and returns gear', () => {
  it('the death3 burial removes worn clothing from counts and wealth', () => {
    const w = world();
    const entities = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const victim = w.spawnDwarf({ at: w.index(40, 40, 32), ageYears: 30 });
    w.spawnDwarf({ at: w.index(41, 40, 32), ageYears: 30 });
    w.build('coffin', w.index(43, 40, 32), 'granite');
    w.zone('tomb', [w.index(43, 40, 32), w.index(44, 40, 32)]);
    w.step(2);
    const clothing = Object.values(entities.get(victim, C.Equipment)!.clothing).filter((id) => id !== 0);
    const types = clothing.map((id) => entities.get(id, C.Item)!.type);
    const clothingValue = clothing.reduce((sum, id) => sum + items.value(id), 0);
    const corpse = kill(w, victim);
    const before = items.wealth();
    const corpseValue = items.value(corpse);
    w.until(() => w.events('Buried').some((event) => event['dwarfId'] === victim), 1000);
    w.step(1);
    expect(entities.alive(corpse)).toBe(false);
    for (const id of clothing) {
      expect(entities.alive(id)).toBe(false);
      expect(w.events('ItemDestroyed').filter((e) => e['id'] === id && e['reason'] === 'buried')).toHaveLength(1);
    }
    for (const type of types) expect(items.count(type)).toBe(1);
    expect(items.wealth()).toBe(before - corpseValue - clothingValue);
    w.step(20 * TICKS_PER_DAY);
    for (const type of types) expect(items.count(type)).toBe(1);
    for (const id of entities.with(C.Item)) expect(entities.get(id, C.Item)?.carriedBy).not.toBe(corpse);
  });

  it('a fallen soldier\'s gear drops unowned where it fell, stays there through the burial, and another soldier claims the sword', () => {
    const w = world();
    const entities = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const victim = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 30 });
    const hauler = w.spawnDwarf({ at: w.index(11, 10, 32), ageYears: 30 });
    for (const labor of w.game.registry.table('labors').ids()) w.setLabor(hauler, labor, labor === 'hauling');
    const coffinTile = w.index(15, 10, 32);
    w.build('coffin', coffinTile, 'granite');
    const sword = w.spawnItem('short_sword', 'iron', w.index(12, 12, 32));
    const shield = w.spawnItem('buckler', 'iron', w.index(12, 12, 32));
    const armor = w.spawnItem('mail_shirt', 'iron', w.index(12, 12, 32));
    const quiver = w.spawnItem('quiver', 'leather', w.index(12, 12, 32));
    const gear = [sword, shield, armor, quiver];
    for (const id of gear) { w.items.attachToCarrier(id, victim); w.items.setOwner(id, victim); }
    const equip = entities.get(victim, C.Equipment)!;
    entities.add(victim, C.Equipment, { ...equip, weapon: sword, shield, armor: { ...equip.armor, body: armor }, quiver });
    const corpse = kill(w, victim);
    // T-541: a dwarf falls out of its kit; only its clothing goes to the coffin with it.
    const deathTile = items.tileOf(corpse);
    for (const id of gear) expect(entities.get(corpse, C.Corpse)?.wornItems).not.toContain(id);
    w.until(() => w.events('Buried').some((event) => event['dwarfId'] === victim), 1000);
    expect(deathTile).not.toBe(coffinTile);
    for (const id of gear) {
      expect(entities.alive(id)).toBe(true);
      expect(items.tileOf(id)).toBe(deathTile);
      expect(entities.get(id, C.Item)?.carriedBy).toBe(0);
      expect(entities.get(id, C.Item)?.ownerId).toBe(0);
      expect(entities.get(id, C.Item)!.flags & ItemFlag.Owned).toBe(0);
    }
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' })).toEqual({ ok: true });
    const squad = entities.with(C.Squad)[0]!;
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad, members: [hauler] })).toEqual({ ok: true });
    expect(entities.get(hauler, C.Equipment)?.weapon).toBe(sword);
  });

  it('destroying a corpse through the item API also disposes of clothes and drops gear', () => {
    const w = world();
    const entities = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const victim = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 30 });
    const clothing = Object.values(entities.get(victim, C.Equipment)!.clothing).filter((id) => id !== 0);
    const sword = w.spawnItem('short_sword', 'iron', w.index(12, 12, 32));
    w.items.attachToCarrier(sword, victim);
    entities.add(victim, C.Equipment, { ...entities.get(victim, C.Equipment)!, weapon: sword });
    const corpse = kill(w, victim);
    const tile = items.tileOf(corpse);
    w.items.destroy(corpse, 'melted');
    for (const id of clothing) expect(entities.alive(id)).toBe(false);
    expect(items.tileOf(sword)).toBe(tile);
    expect(entities.get(sword, C.Item)?.carriedBy).toBe(0);
    expect(entities.get(sword, C.Item)?.ownerId).toBe(0);
  });

  it('a saved corpse with the existing wornItems format disposes identically after load', () => {
    const w = world();
    const entities = w.game.world.entities;
    const victim = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 30 });
    const clothing = Object.values(entities.get(victim, C.Equipment)!.clothing).filter((id) => id !== 0);
    const sword = w.spawnItem('short_sword', 'iron', w.index(12, 12, 32));
    w.items.attachToCarrier(sword, victim);
    entities.add(victim, C.Equipment, { ...entities.get(victim, C.Equipment)!, weapon: sword });
    const corpse = kill(w, victim);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    w.items.destroy(corpse, 'buried');
    loaded.world.services.items!.destroy(corpse, 'buried');
    for (const id of clothing) expect(loaded.world.entities.alive(id)).toBe(false);
    expect(loaded.world.entities.get(sword, C.Item)?.carriedBy).toBe(0);
    expect(loaded.hash()).toBe(w.game.hash());
    w.step(20);
    loaded.step(20);
    expect(loaded.hash()).toBe(w.game.hash());
  });

});
