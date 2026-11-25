/**
 * T-698: a hospital's `honey` setting did nothing (its chests did not take honey), and a supply raised from 0
 * did not call the goods already lying loose with no home. A hospital's chests take honey as they take soap
 * and bandages, and `SetHospitalSupplies` raises `ZoneChanged { change: settings }` as `SetZoneSetting` does,
 * so 13 looks again at its `noHome` goods.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import { HOSPITAL_DEFAULT_SUPPLIES } from '@systems/health/constants';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A hospital of one bed and one built chest, a hauler, and six of `type` twenty tiles away on no stockpile. */
function ward(seed: string, type: string, material: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const bedTile = w.index(40, 40, Z), chestTile = w.index(41, 40, Z);
  const zone = w.zone('hospital', [bedTile, chestTile]);
  w.build('bed', bedTile, 'oak');
  const chest = w.build('chest', chestTile, 'oak');
  const chestItem = w.game.world.entities.get(chest, C.Building)!.itemId;
  const hauler = w.spawnDwarf({ at: w.index(21, 40, Z) });
  for (const need of NEEDS) w.setNeed(hauler, need, 0);
  w.spawnItem(type, material, w.index(20, 40, Z), 6);
  const typeIndex = w.game.registry.table('items').index(type);
  const inChest = (): number => (w.game.world.entities.get(chestItem, C.Container)?.contents ?? [])
    .map((id: EntityId) => w.game.world.entities.get(id, C.Item)!)
    .filter((it) => it.type === typeIndex)
    .reduce((n, it) => n + it.count, 0);
  const want = (kind: string, n: number): void => {
    expect(w.game.world.applyCommand({ type: 'SetHospitalSupplies', zoneId: zone, wants: { ...HOSPITAL_DEFAULT_SUPPLIES, [kind]: n } }).ok)
      .toBe(true);
  };
  return { w, inChest, want };
}

describe('T-698 a hospital stocks honey', () => {
  it('the supply record wants no honey by default: it stays where it lies', () => {
    expect(HOSPITAL_DEFAULT_SUPPLIES['honey']).toBe(0);
    const a = ward('t698-honey-none', 'honey', 'honey');
    a.w.step(TICKS_PER_DAY / 4);
    expect(a.inChest()).toBe(0);
  });

  it('a hospital asked for honey has it hauled into its chest', () => {
    const a = ward('t698-honey', 'honey', 'honey');
    a.want('honey', 4);
    a.w.until(() => a.inChest() > 0, TICKS_PER_DAY / 2);
    // The stack goes whole, as any supply's does while the hospital has fewer than it wants (13).
    expect(a.inChest()).toBe(6);
  });
});

describe('T-698 a raised supply calls the goods lying loose', () => {
  it('bandages lying loose with no home are hauled in once the hospital\'s bandages are raised from 0', () => {
    const a = ward('t698-raised', 'bandage', 'flax_cloth');
    // Wanted by nobody, the bandages have no home and stay.
    a.w.step(TICKS_PER_DAY / 8);
    expect(a.inChest()).toBe(0);
    a.want('bandages', 4);
    a.w.until(() => a.inChest() > 0, TICKS_PER_DAY / 2);
    expect(a.inChest()).toBe(6);
  });

  it('honey lying loose with no home is hauled in once the hospital\'s honey is raised from 0', () => {
    const a = ward('t698-raised-honey', 'honey', 'honey');
    a.w.step(TICKS_PER_DAY / 8);
    expect(a.inChest()).toBe(0);
    a.want('honey', 4);
    a.w.until(() => a.inChest() > 0, TICKS_PER_DAY / 2);
    expect(a.inChest()).toBe(6);
  });
});
