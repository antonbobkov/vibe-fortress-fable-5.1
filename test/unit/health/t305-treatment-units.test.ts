/** T-305: a treatment job reserves one unit of its supply, not the whole stack. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A hospital of two beds and one built chest holding five cloth in one stack. */
function hospital() {
  const w = new TestWorld({ seed: 't305-treatment-units', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const bedTile = w.index(40, 40, Z), bed2Tile = w.index(42, 40, Z), chestTile = w.index(41, 40, Z);
  w.zone('hospital', [bedTile, chestTile, bed2Tile]);
  w.build('bed', bedTile, 'oak');
  w.build('bed', bed2Tile, 'oak');
  const chest = w.build('chest', chestTile, 'oak');
  const chestItem = w.game.world.entities.get(chest, C.Building)!.itemId;
  const cloth = w.spawnItem('cloth', 'flax_cloth', w.index(20, 40, Z), 5);
  w.game.world.services.items!.putIn(cloth, chestItem);
  const dwarf = (x: number, y: number): EntityId => {
    const id = w.spawnDwarf({ at: w.index(x, y, Z), skills: { medicine: 20 } });
    for (const need of NEEDS) w.setNeed(id, need, 0);
    return id;
  };
  const clothUnits = (): number => {
    const type = w.game.registry.table('items').index('cloth');
    return w.game.world.entities.with(C.Item).reduce((sum, id) => {
      const item = w.game.world.entities.get(id, C.Item)!;
      return sum + (item.type === type ? item.count : 0);
    }, 0);
  };
  const cut = (id: EntityId): void => {
    w.game.world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'edge', amount: 20 });
  };
  const bandaged = (id: EntityId): boolean =>
    w.events('TreatmentDone').some((e) => e['patientId'] === id && e['kind'] === 'stop_bleeding');
  return { w, chestItem, cloth, dwarf, clothUnits, cut, bandaged };
}

describe('T-305 a treatment job takes one unit of its supply', () => {
  it('bandages a patient with one unit, and the rest of the stack stays in the chest', () => {
    const a = hospital();
    const patient = a.dwarf(40, 42);
    a.dwarf(44, 44);
    a.w.step(2);
    a.cut(patient);
    a.w.until(() => a.bandaged(patient), 600);
    expect(a.clothUnits()).toBe(4);
    expect(a.w.game.world.entities.get(a.cloth, C.Item)).toMatchObject({ count: 4, containerId: a.chestItem, reservedBy: 0 });
  });

  it('serves two bleeding patients at once from one stack of cloth', () => {
    const a = hospital();
    const first = a.dwarf(40, 42), second = a.dwarf(42, 42);
    a.dwarf(44, 44); a.dwarf(44, 45);
    a.w.step(2);
    a.cut(first); a.cut(second);
    a.w.until(() => a.bandaged(first) && a.bandaged(second), 600);
    expect(a.w.events('JobBlocked').filter((e) => e['jobType'] === 'stop_bleeding' && e['reason'] === 'missing_input')).toEqual([]);
    expect(a.clothUnits()).toBe(3);
  });
});
