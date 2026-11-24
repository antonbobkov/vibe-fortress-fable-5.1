/**
 * T-696: bandages were cut at the clothier and sold by caravans, and no medic took one: the treatments
 * asked only for cloth. `stop_bleeding`, `dress_burn` and `bandage_animal` take a bandage while one is to
 * be had, else a cloth; a hospital stocks bandages by its `bandages` setting, and the dressings a light
 * burn leaves for the bleeding count bandages with the cloth.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C, type Item } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import { HOSPITAL_DEFAULT_SUPPLIES } from '@systems/health/constants';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A medic of skill 20 and a dwarf with no labor; `cloth` cloth and `bandages` bandages on the floor. */
function ward(seed: string, cloth: number, bandages: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const labors = w.game.registry.table<{ id: string }>('labors').ids();
  const medic = w.spawnDwarf({ at: w.index(12, 10, Z), skills: { medicine: 20 } });
  const hurt = w.spawnDwarf({ at: w.index(10, 10, Z) });
  for (const id of [medic, hurt]) {
    for (const l of labors) w.setLabor(id, l, id === medic && l === 'medicine');
    for (const need of NEEDS) w.setNeed(id, need, 0);
  }
  if (cloth > 0) w.spawnItem('cloth', 'flax_cloth', w.index(11, 12, Z), cloth);
  if (bandages > 0) w.spawnItem('bandage', 'flax_cloth', w.index(13, 12, Z), bandages);
  const units = (id: string): number => {
    const t = w.game.registry.table('items').index(id);
    let n = 0;
    for (const e of world.entities.with(C.Item)) {
      const it = world.entities.get(e, C.Item) as Item;
      if (it.type === t) n += it.count;
    }
    return n;
  };
  const wounds = (id: EntityId) => world.entities.get(id, C.Body)!.parts.flatMap((p) => p.wounds);
  const cut = (id: EntityId): void => {
    world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'edge', amount: 12 });
  };
  const bandaged = (id: EntityId): boolean => {
    const cuts = wounds(id).filter((x) => x.type === 'cut');
    return cuts.length > 0 && cuts.every((x) => x.bandaged);
  };
  const jobs = () => w.readers.of<JobsReader>('11');
  return { w, world, labors, medic, hurt, units, wounds, cut, bandaged, jobs };
}

describe('T-696 medics dress wounds with bandages', () => {
  it('a bleeding dwarf is bandaged with a bandage when one is there, and the cloth stays', () => {
    const a = ward('t696-bandage-first', 3, 4);
    a.w.step(2);
    a.cut(a.hurt);
    a.w.step(5);
    const job = a.jobs().byKey(`stop_bleeding:${a.hurt}`);
    expect(job?.inputs[0]?.filter.category).toBe('medical/bandage');
    a.w.until(() => a.bandaged(a.hurt), TICKS_PER_DAY / 2);
    expect(a.bandaged(a.hurt)).toBe(true);
    expect(a.units('bandage')).toBe(3);
    expect(a.units('cloth')).toBe(3);
  });

  it('a medic bandages a bleeding dwarf with a bandage when there is no cloth', () => {
    const a = ward('t696-no-cloth', 0, 1);
    a.w.step(2);
    a.cut(a.hurt);
    a.w.until(() => a.bandaged(a.hurt), TICKS_PER_DAY / 2);
    expect(a.bandaged(a.hurt)).toBe(true);
    expect(a.units('bandage')).toBe(0);
  });

  it('with no bandage the medic takes a cloth, as before', () => {
    const a = ward('t696-cloth', 2, 0);
    a.w.step(2);
    a.cut(a.hurt);
    a.w.step(5);
    expect(a.jobs().byKey(`stop_bleeding:${a.hurt}`)?.inputs[0]?.filter.category).toBe('textile/cloth');
    a.w.until(() => a.bandaged(a.hurt), TICKS_PER_DAY / 2);
    expect(a.bandaged(a.hurt)).toBe(true);
    expect(a.units('cloth')).toBe(1);
  });

  it('a bandage waiting for its cloth takes a bandage that comes to be had', () => {
    // No cloth and no bandage: the job waits for cloth. A bandage is brought (a caravan's), and the job takes it.
    const a = ward('t696-switch', 0, 0);
    a.w.step(2);
    a.cut(a.hurt);
    a.w.step(5);
    expect(a.jobs().byKey(`stop_bleeding:${a.hurt}`)?.inputs[0]?.filter.category).toBe('textile/cloth');
    a.w.spawnItem('bandage', 'flax_cloth', a.w.index(13, 12, Z), 2);
    a.w.step(2 * 5);
    expect(a.jobs().byKey(`stop_bleeding:${a.hurt}`)?.inputs[0]?.filter.category).toBe('medical/bandage');
    a.w.until(() => a.bandaged(a.hurt), TICKS_PER_DAY / 2);
    expect(a.bandaged(a.hurt)).toBe(true);
    expect(a.units('bandage')).toBe(1);
  });

  it('a serious burn is dressed with a bandage before a cloth', () => {
    const a = ward('t696-burn', 2, 2);
    a.world.emit({ type: 'DamageDealt', defenderId: a.hurt, attackerId: 0, part: 'left_arm', damageType: 'burn', amount: 13 });
    a.w.step(5);
    expect(a.wounds(a.hurt).some((x) => x.type === 'burn' && x.severity === 'serious')).toBe(true);
    a.w.until(() => a.wounds(a.hurt).some((x) => x.dressed), TICKS_PER_DAY);
    // The serious burn bleeds: one bandage for it, and one for its dressing; the cloth is not touched.
    a.w.step(TICKS_PER_DAY / 4);
    expect(a.units('bandage')).toBe(0);
    expect(a.units('cloth')).toBe(2);
  });

  it('light burns do not take the hospital\'s last dressing from a bleeding dwarf, bandages counted with the cloth', () => {
    // One cloth and one bandage; the hospital keeps one cloth. One light burn is dressed (with the
    // bandage), and the last dressing waits for the cut.
    const a = ward('t696-kept', 1, 1);
    const tiles: TileIndex[] = [];
    for (let x = 20; x < 23; x += 1) tiles.push(a.w.index(x, 20, Z));
    const zone = a.w.zone('hospital', tiles);
    expect(a.world.applyCommand({ type: 'SetHospitalSupplies', zoneId: zone, wants: { cloth: 1 } }).ok).toBe(true);
    for (const part of ['left_arm', 'right_arm', 'left_leg', 'right_leg', 'torso']) {
      a.world.emit({ type: 'DamageDealt', defenderId: a.hurt, attackerId: 0, part, damageType: 'burn', amount: 5 });
    }
    a.w.step(3);
    const burns = () => a.wounds(a.hurt).filter((x) => x.type === 'burn');
    a.w.until(() => burns().some((x) => x.dressed), TICKS_PER_DAY);
    a.w.step(TICKS_PER_DAY / 2);
    expect(burns().filter((x) => x.dressed)).toHaveLength(1);
    expect(a.units('bandage')).toBe(0);
    expect(a.units('cloth')).toBe(1);

    const cutDwarf = a.w.spawnDwarf({ at: a.w.index(14, 10, Z) });
    for (const l of a.labors) a.w.setLabor(cutDwarf, l, false);
    a.cut(cutDwarf);
    a.w.until(() => a.bandaged(cutDwarf), TICKS_PER_DAY / 2);
    expect(a.bandaged(cutDwarf)).toBe(true);
    expect(a.units('cloth')).toBe(0);
    expect(burns().filter((x) => x.dressed)).toHaveLength(1);
  });

  it('the hospital\'s bandages setting is kept too: light burns leave it for the bleeding', () => {
    // Two bandages, no cloth; the hospital keeps one bandage and no cloth.
    const a = ward('t696-kept-bandage', 0, 2);
    const tiles: TileIndex[] = [];
    for (let x = 20; x < 23; x += 1) tiles.push(a.w.index(x, 20, Z));
    const zone = a.w.zone('hospital', tiles);
    expect(a.world.applyCommand({ type: 'SetHospitalSupplies', zoneId: zone, wants: { cloth: 0, bandages: 1 } }).ok).toBe(true);
    for (const part of ['left_arm', 'right_arm', 'left_leg', 'right_leg', 'torso']) {
      a.world.emit({ type: 'DamageDealt', defenderId: a.hurt, attackerId: 0, part, damageType: 'burn', amount: 5 });
    }
    a.w.step(3);
    const burns = () => a.wounds(a.hurt).filter((x) => x.type === 'burn');
    a.w.until(() => burns().some((x) => x.dressed), TICKS_PER_DAY);
    a.w.step(TICKS_PER_DAY / 2);
    expect(burns().filter((x) => x.dressed)).toHaveLength(1);
    expect(a.units('bandage')).toBe(1);
  });

  it('a tame animal is bandaged with a bandage', () => {
    const a = ward('t696-animal', 2, 1);
    a.w.setLabor(a.medic, 'animal_care', true);
    const cow = a.w.spawnTame('cow', a.w.index(15, 10, Z));
    a.w.step(2);
    a.world.emit({ type: 'DamageDealt', defenderId: cow, attackerId: 0, part: 'torso', damageType: 'edge', amount: 5 });
    a.w.step(3);
    expect(a.jobs().byKey(`bandage_animal:${cow}`)?.inputs[0]?.filter.category).toBe('medical/bandage');
    const bleeding = () => a.wounds(cow).some((x) => x.bleed > 0 && !x.bandaged);
    a.w.until(() => !bleeding(), TICKS_PER_DAY / 2);
    expect(bleeding()).toBe(false);
    expect(a.units('cloth')).toBe(2);
  });
});

describe('T-696 a hospital stocks bandages', () => {
  /** A hospital of one bed and one built chest wanting `bandages` bandages, a hauler, and six bandages twenty tiles away. */
  function stocked(seed: string, bandages: number | null) {
    const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const bedTile = w.index(40, 40, Z), chestTile = w.index(41, 40, Z);
    const zone = w.zone('hospital', [bedTile, chestTile]);
    w.build('bed', bedTile, 'oak');
    const chest = w.build('chest', chestTile, 'oak');
    const chestItem = w.game.world.entities.get(chest, C.Building)!.itemId;
    if (bandages !== null) {
      expect(w.game.world.applyCommand({ type: 'SetHospitalSupplies', zoneId: zone, wants: { ...HOSPITAL_DEFAULT_SUPPLIES, bandages } }).ok).toBe(true);
    }
    const hauler = w.spawnDwarf({ at: w.index(21, 40, Z) });
    for (const need of NEEDS) w.setNeed(hauler, need, 0);
    w.spawnItem('bandage', 'flax_cloth', w.index(20, 40, Z), 6);
    const inChest = (): number => (w.game.world.entities.get(chestItem, C.Container)?.contents ?? [])
      .map((id) => w.game.world.entities.get(id, C.Item)!)
      .filter((it) => it.type === w.game.registry.table('items').index('bandage'))
      .reduce((n, it) => n + it.count, 0);
    return { w, inChest };
  }

  it('the supply record wants no bandages by default: they stay where they lie', () => {
    expect(HOSPITAL_DEFAULT_SUPPLIES['bandages']).toBe(0);
    const a = stocked('t696-hospital-none', null);
    a.w.step(TICKS_PER_DAY / 4);
    expect(a.inChest()).toBe(0);
  });

  it('a hospital asked for bandages has them hauled into its chest', () => {
    const a = stocked('t696-hospital', 4);
    a.w.until(() => a.inChest() > 0, TICKS_PER_DAY / 2);
    // The stack goes whole, as any supply's does while the hospital has fewer than it wants (13).
    expect(a.inChest()).toBe(6);
  });
});
