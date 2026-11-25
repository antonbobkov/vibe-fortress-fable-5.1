/**
 * T-693: a wildfire's light burns asked for a cloth each. On two three-year timelines a lightning-lit
 * fire gave 141 and 59 light burns and their dressings stood waiting on cloth for weeks; a fortress
 * that had the cloth would have spent its bandages on scorches. A light burn is dressed only while
 * the dwarf's light burns together give `PAIN_DISCHARGE` pain or more, and only with cloth beyond
 * what the hospitals keep for bandages; a serious burn is dressed as before.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C, type Item } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { TileIndex } from '@core/types';
import { createWound, PAIN_DISCHARGE, woundTreatmentNeeds } from '@systems/health';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;
const PARTS = ['left_arm', 'right_arm', 'left_leg', 'right_leg', 'torso'] as const;

const light = (dressed = false) => ({ ...createWound('burn', 'light', 5, 0), dressed });

/**
 * A medic, and a dwarf with no labor and a light burn (amount 5) on each of `parts`; `cloth` cloth on
 * the floor, and a hospital zone keeping `kept` cloth for bandages (none when `kept` is null).
 */
function scorched(seed: string, cloth: number, kept: number | null, parts: readonly string[] = PARTS) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const labors = w.game.registry.table<{ id: string }>('labors').ids();
  const medic = w.spawnDwarf({ at: w.index(12, 10, Z), skills: { medicine: 20 } });
  const burnt = w.spawnDwarf({ at: w.index(10, 10, Z) });
  for (const id of [medic, burnt]) {
    for (const l of labors) w.setLabor(id, l, id === medic && l === 'medicine');
    for (const need of NEEDS) w.setNeed(id, need, 0);
  }
  if (cloth > 0) w.spawnItem('cloth', 'flax_cloth', w.index(11, 12, Z), cloth);
  if (kept !== null) {
    const tiles: TileIndex[] = [];
    for (let x = 20; x < 23; x += 1) tiles.push(w.index(x, 20, Z));
    const zone = w.zone('hospital', tiles);
    expect(world.applyCommand({ type: 'SetHospitalSupplies', zoneId: zone, wants: { cloth: kept } }).ok).toBe(true);
  }
  for (const part of parts) world.emit({ type: 'DamageDealt', defenderId: burnt, attackerId: 0, part, damageType: 'burn', amount: 5 });
  w.step(3);
  const burns = () => world.entities.get(burnt, C.Body)!.parts.flatMap((p) => p.wounds).filter((x) => x.type === 'burn');
  const clothLeft = () => {
    let n = 0;
    const t = w.game.registry.table('items').index('cloth');
    for (const id of world.entities.with(C.Item)) {
      const it = world.entities.get(id, C.Item) as Item;
      if (it.type === t) n += it.count;
    }
    return n;
  };
  const dressJobs = () => w.readers.of<JobsReader>('11').list().filter((j) => j.key === `dress_burn:${burnt}`);
  return { w, world, medic, burnt, burns, clothLeft, dressJobs };
}

describe('T-693 a light burn is dressed only when it hurts, and only with spare cloth', () => {
  it('light burns want dressing only while their pain together is PAIN_DISCHARGE or more', () => {
    expect(PAIN_DISCHARGE).toBe(30);
    expect(woundTreatmentNeeds([light()])).not.toContain('dress_burn');
    expect(woundTreatmentNeeds([light(), light(), light()])).not.toContain('dress_burn');
    expect(woundTreatmentNeeds([light(), light(), light(), light()])).toContain('dress_burn');
    // One of the four dressed (its pain halved, 4): 28, below the threshold.
    const dressed = { ...light(true), pain: 4 };
    expect(woundTreatmentNeeds([dressed, light(), light(), light()])).not.toContain('dress_burn');
    expect(woundTreatmentNeeds([createWound('burn', 'serious', 13, 0)])).toContain('dress_burn');
  });

  it('a dwarf with two light burns is not dressed, with cloth to spare and a medic at hand', () => {
    const a = scorched('t693-two', 5, null, ['left_arm', 'right_leg']);
    a.w.step(TICKS_PER_DAY);
    expect(a.burns()).toHaveLength(2);
    expect(a.burns().some((b) => b.dressed)).toBe(false);
    expect(a.dressJobs()).toHaveLength(0);
    expect(a.clothLeft()).toBe(5);
  });

  it('five light burns are dressed until they hurt less than PAIN_DISCHARGE, with no hospital to keep cloth', () => {
    const a = scorched('t693-five', 5, null);
    a.w.until(() => a.burns().filter((b) => b.dressed).length >= 3, TICKS_PER_DAY);
    a.w.step(TICKS_PER_DAY / 2);
    // 40 → 36 → 32 → 28: three dressings, two burns left as they are.
    expect(a.burns().filter((b) => b.dressed)).toHaveLength(3);
    expect(a.clothLeft()).toBe(2);
    expect(a.world.entities.has(a.burnt, C.Patient)).toBe(false);
  });

  it('light burns do not take the hospital\'s last bandage cloth from a bleeding patient', () => {
    // Two cloth, the hospital keeps one: one light burn is dressed, and the last cloth waits.
    const a = scorched('t693-kept', 2, 1);
    a.w.until(() => a.burns().some((b) => b.dressed), TICKS_PER_DAY);
    a.w.step(TICKS_PER_DAY / 2);
    expect(a.burns().filter((b) => b.dressed)).toHaveLength(1);
    expect(a.clothLeft()).toBe(1);
    expect(a.dressJobs()).toHaveLength(0);

    // A raid's cut: a third dwarf bleeds, and the kept cloth bandages it.
    const cut = a.w.spawnDwarf({ at: a.w.index(14, 10, Z) });
    for (const l of a.w.game.registry.table<{ id: string }>('labors').ids()) a.w.setLabor(cut, l, false);
    a.world.emit({ type: 'DamageDealt', defenderId: cut, attackerId: 0, part: 'torso', damageType: 'edge', amount: 12 });
    a.w.until(() => a.world.entities.get(cut, C.Body)!.parts.some((p) => p.wounds.some((wd) => wd.bandaged)), TICKS_PER_DAY / 2);
    expect(a.world.entities.get(cut, C.Body)!.parts.flatMap((p) => p.wounds).filter((wd) => wd.type === 'cut').every((wd) => wd.bandaged)).toBe(true);
    expect(a.clothLeft()).toBe(0);
    expect(a.burns().filter((b) => b.dressed)).toHaveLength(1);
  });

  it('a light dressing waiting for its cloth gives way when the hospital comes to keep it', () => {
    // No medic can reach the cloth yet: the medic has no labor, so the job waits.
    const a = scorched('t693-gives-way', 1, null);
    a.w.setLabor(a.medic, 'medicine', false);
    a.w.step(2 * 5);
    expect(a.dressJobs()).toHaveLength(1);
    expect(a.dressJobs()[0]!.priority).toBe(4);
    const tiles: TileIndex[] = [a.w.index(20, 20, Z), a.w.index(21, 20, Z)];
    const zone = a.w.zone('hospital', tiles);
    expect(a.world.applyCommand({ type: 'SetHospitalSupplies', zoneId: zone, wants: { cloth: 1 } }).ok).toBe(true);
    a.w.step(2 * 5);
    expect(a.dressJobs()).toHaveLength(0);
    a.w.setLabor(a.medic, 'medicine', true);
    a.w.step(TICKS_PER_DAY / 2);
    expect(a.burns().some((b) => b.dressed)).toBe(false);
    expect(a.clothLeft()).toBe(1);
  });

  it('a serious burn is dressed from the hospital\'s cloth, at its old priority, before the light ones', () => {
    // Two cloth, the hospital keeps five: the serious burn bleeds, and takes one for its bandage and one for its dressing.
    const a = scorched('t693-serious', 2, 5, ['left_arm', 'right_arm']);
    a.world.emit({ type: 'DamageDealt', defenderId: a.burnt, attackerId: 0, part: 'torso', damageType: 'burn', amount: 13 });
    a.w.step(2 * 5);
    expect(a.burns().some((b) => b.severity === 'serious')).toBe(true);
    a.w.until(() => a.burns().some((b) => b.dressed), TICKS_PER_DAY);
    a.w.step(TICKS_PER_DAY / 2);
    expect(a.burns().filter((b) => b.dressed).map((b) => b.severity)).toEqual(['serious']);
    expect(a.clothLeft()).toBe(0);
  });
});
