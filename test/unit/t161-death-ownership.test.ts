import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C, ItemFlag } from '@core/components';
import { TestWorld } from '../scenarios/test-world';

function world(): TestWorld {
  return new TestWorld({ seed: 't115-death', map: buildFlatTestMap(contentRegistry(), 48, 48) });
}
function labor(w: TestWorld, dwarf: number, enabled: string | null): void {
  for (const name of w.game.registry.table('labors').ids()) w.setLabor(dwarf, name, name === enabled);
}
function squad(w: TestWorld, soldier: number): number {
  expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' })).toEqual({ ok: true });
  const id = w.game.world.entities.with(C.Squad)[0]!;
  expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: id, members: [soldier] })).toEqual({ ok: true });
  return id;
}

describe('T-161 ownership ends at death and civilian tools remain available', () => {
  it('a dead soldier releases all claims; its pick drops beside the corpse and is usable at once', () => {
    const w = world();
    const entities = w.game.world.entities;
    const soldier = w.spawnDwarf({ at: w.index(12, 10, 32), ageYears: 30 });
    labor(w, soldier, null);
    const pick = w.spawnItem('pick', 'iron', w.index(11, 12, 32));
    const barrel = w.spawnItem('barrel', 'pine', w.index(15, 12, 32));
    const contents = w.spawnItem('short_sword', 'iron', { containerId: barrel });
    w.items.setOwner(contents, soldier);
    squad(w, soldier);
    expect(entities.get(soldier, C.Equipment)?.weapon).toBe(pick);
    const clothes = Object.values(entities.get(soldier, C.Equipment)!.clothing).filter((id) => id !== 0);
    const hp = entities.get(soldier, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: soldier, attackerId: 0,
      part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CreatureDied').some((e) => e['id'] === soldier), 5);
    w.until(() => entities.with(C.Corpse).length > 0, 10);
    const corpse = entities.with(C.Corpse)[0]!;
    for (const id of [pick, contents, ...clothes]) {
      expect(entities.get(id, C.Item)?.ownerId).toBe(0);
      expect(entities.get(id, C.Item)!.flags & ItemFlag.Owned).toBe(0);
    }
    expect(entities.get(contents, C.Item)?.containerId).toBe(barrel);
    // T-541: a dwarf falls out of its kit; the pick lies beside the corpse at once, not after rot.
    expect(entities.get(corpse, C.Corpse)?.wornItems).not.toContain(pick);
    expect(entities.get(pick, C.Item)?.carriedBy).toBe(0);
    expect(entities.has(pick, C.Position)).toBe(true);
    const miner = w.spawnDwarf({ at: w.index(10, 11, 32), ageYears: 30, skills: { mining: 5 } });
    labor(w, miner, 'mining');
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'channel',
      tiles: [w.index(10, 16, 32)], priority: 5 })).toEqual({ ok: true });
    w.until(() => entities.get(miner, C.Worker)?.toolId === pick, 1000);
    w.until(() => w.events('JobCompleted').some((e) => e['jobType'] === 'channel'), 2000);
  });

  it.each([['pick', 'mining'], ['axe', 'woodcutting']] as const)(
    'a soldier leaves the only %s for an enabled %s worker without a tool', (tool, civilianLabor) => {
      const w = world();
      const entities = w.game.world.entities;
      const soldier = w.spawnDwarf({ at: w.index(12, 10, 32), ageYears: 30 });
      const civilian = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 30 });
      labor(w, soldier, null);
      labor(w, civilian, civilianLabor);
      const item = w.spawnItem(tool, 'iron', w.index(11, 12, 32));
      const squadId = squad(w, soldier);
      expect(entities.get(civilian, C.Worker)?.toolId).toBe(0);
      expect(entities.get(soldier, C.Equipment)?.weapon).toBe(0);
      expect(entities.get(item, C.Item)?.ownerId).toBe(0);
      expect(w.game.world.applyCommand({ type: 'SetLabor', dwarfId: civilian, labor: civilianLabor, on: false })).toEqual({ ok: true });
      expect(w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId,
        equipment: { weaponClass: 'any', armor: 'any', ranged: false } })).toEqual({ ok: true });
      expect(entities.get(soldier, C.Equipment)?.weapon).toBe(item);
    },
  );

  it.each([['pick', 'mining'], ['axe', 'woodcutting']] as const)(
    'an enabled %s user already holding that kind in Equipment leaves a spare available to the squad', (tool, civilianLabor) => {
      const w = world();
      const entities = w.game.world.entities;
      const soldier = w.spawnDwarf({ at: w.index(12, 10, 32), ageYears: 30 });
      const civilian = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 30 });
      labor(w, soldier, null);
      labor(w, civilian, civilianLabor);
      const held = w.spawnItem(tool, 'iron', w.index(11, 12, 32));
      w.items.attachToCarrier(held, civilian);
      entities.add(civilian, C.Equipment, { ...entities.get(civilian, C.Equipment)!, weapon: held });
      expect(entities.get(civilian, C.Worker)?.toolId).toBe(0);
      const spare = w.spawnItem(tool, 'iron', w.index(13, 12, 32));
      squad(w, soldier);
      expect(entities.get(soldier, C.Equipment)?.weapon).toBe(spare);
      expect(entities.get(held, C.Item)?.carriedBy).toBe(civilian);
    },
  );

});
