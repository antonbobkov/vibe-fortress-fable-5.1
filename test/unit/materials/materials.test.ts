import { describe, it, expect } from 'vitest';
import { Map3D, TileFlag, TileKind } from '@core/map3d';
import { contentRegistry } from '@content/loader';
import * as K from '@systems/materials/constants';
import { overrideAt, baseTemperature } from '@systems/materials/temperature';
import type { MaterialsReader } from '@systems/materials';
import { regionSpec } from '@app/headless';
import { TestWorld } from '../../scenarios/test-world';
import { tuningConstants } from '../system-constants';

describe('T-M3-03 materials: tuning constants', () => {
  it('every row of 05 § Tuning constants is in src/systems/materials/constants.ts', () => {
    const rows = tuningConstants('02-systems/05-materials-and-temperature.md');
    expect(rows.length).toBe(19); // T-548 adds FIRE_RESIST_DIVISOR
    const values = K as unknown as Record<string, number>;
    for (const row of rows) expect([row.name, values[row.name]]).toEqual([row.name, row.value]);
  });
});

function magmaMap(): Map3D {
  const map = new Map3D(12, 12, 4);
  map.kind.fill(TileKind.Open);
  return map;
}

const NONE = { isBurning: () => false, isWarmSpring: () => false };

describe('T-M3-03 materials: overrides', () => {
  it('magma adds MAGMA_OVERRIDE at distance 0, half at 1, a quarter at 2, nothing at 3; on its level and the level above', () => {
    const map = magmaMap();
    map.fluid[map.index(5, 5, 1)] = Map3D.packFluid(3, 1);
    expect(overrideAt(map, map.index(5, 5, 1), NONE)).toBe(K.MAGMA_OVERRIDE);
    expect(overrideAt(map, map.index(6, 6, 1), NONE)).toBe(K.MAGMA_OVERRIDE / 2);
    expect(overrideAt(map, map.index(7, 3, 1), NONE)).toBe(K.MAGMA_OVERRIDE / 4);
    expect(overrideAt(map, map.index(8, 5, 1), NONE)).toBe(0);
    expect(overrideAt(map, map.index(5, 5, 2), NONE)).toBe(K.MAGMA_OVERRIDE);
    expect(overrideAt(map, map.index(4, 5, 2), NONE)).toBe(K.MAGMA_OVERRIDE / 2);
    expect(overrideAt(map, map.index(5, 5, 3), NONE)).toBe(0);
    expect(overrideAt(map, map.index(5, 5, 0), NONE)).toBe(0);
  });

  it('sums sources and clamps to ±24 units (±120 °C); fire, springs and snow contribute as specified', () => {
    const map = magmaMap();
    for (let x = 4; x <= 6; x += 1) map.fluid[map.index(x, 5, 1)] = Map3D.packFluid(7, 1);
    expect(overrideAt(map, map.index(5, 5, 1), NONE)).toBe(K.TEMP_OVERRIDE_LIMIT);
    const plain = map.index(1, 10, 1);
    const fire = { isBurning: (i: number) => i === map.index(2, 10, 1), isWarmSpring: (i: number) => i === plain };
    expect(overrideAt(map, map.index(2, 10, 1), fire)).toBe(K.FIRE_OVERRIDE);
    expect(overrideAt(map, plain, fire)).toBe(K.FIRE_OVERRIDE / 2 + K.SPRING_OVERRIDE);
    expect(overrideAt(map, map.index(4, 10, 1), fire)).toBe(0);
    map.setFlag(map.index(10, 10, 1), TileFlag.Snow, true);
    expect(overrideAt(map, map.index(10, 10, 1), NONE)).toBe(-K.SNOW_OVERRIDE);
  });

  it('the base temperature: surface outdoors, blended over NEAR_SURFACE_DEPTH, then deep heat below DEEP_HEAT_START_Z', () => {
    const map = new Map3D(4, 4, 40);
    map.kind.fill(TileKind.Wall);
    for (let z = 31; z < 40; z += 1) map.kind[map.index(1, 1, z)] = TileKind.Open;
    map.setFlag(map.index(1, 1, 30), TileFlag.Outdoor, true);
    const surface = -10;
    expect(baseTemperature(map, map.index(1, 1, 30), surface)).toBe(surface);
    expect(baseTemperature(map, map.index(1, 1, 29), surface)).toBe(surface + Math.trunc((K.UNDERGROUND_BASE_C - surface) / 3));
    expect(baseTemperature(map, map.index(1, 1, 27), surface)).toBe(K.UNDERGROUND_BASE_C);
    expect(baseTemperature(map, map.index(1, 1, 20), surface)).toBe(K.UNDERGROUND_BASE_C);
    expect(baseTemperature(map, map.index(1, 1, 5), surface)).toBe(K.UNDERGROUND_BASE_C + (K.DEEP_HEAT_START_Z - 5) * K.DEEP_HEAT_PER_Z);
  });
});

describe('T-M3-03 materials: the system', () => {
  it('property arrays and derived tables come from the registry', () => {
    const w = new TestWorld({ seed: 'props', world: 'flat-test' });
    const m = w.readers.of<MaterialsReader>('05');
    const mats = contentRegistry().table('materials');
    const granite = mats.index('granite');
    const copper = mats.index('copper');
    const oak = mats.index('oak');
    expect([m.hardness(granite), m.meltsAt(granite), m.classOf(granite), m.isMagmaSafe(granite)]).toEqual([150, 1300, 'stone', true]);
    expect([m.meltsAt(copper), m.isMagmaSafe(copper)]).toEqual([1085, false]);
    expect([m.burnable(oak), m.propertyOf(oak, 'burnTicks'), m.value(oak)]).toEqual([true, 600, 3]);
    expect(m.yieldsOf(mats.index('hematite'))).toEqual([{ metal: mats.index('iron'), count: 2 }]);
    expect(m.alloyInputs(mats.index('bronze'))).toEqual([
      { material: copper, count: 1 },
      { material: mats.index('tin'), count: 1 },
    ]);
  });

  it('recomputes only the chunks a magma change reaches, and never for water', () => {
    const w = new TestWorld({ seed: 'reach', world: 'flat-test' });
    w.step(4);
    const materials = w.materials;
    expect(materials.started).toBe(true);
    // The Sea of Fire (z 0-3) warms the level above it at the first tick.
    expect(w.map.tempOverride[w.index(40, 40, 4)]).toBe(K.TEMP_OVERRIDE_LIMIT);
    for (let x = 40; x < 44; x += 1) w.carve(w.index(x, 40, 20), TileKind.Floor);
    materials.recomputes = 0;
    w.setFluid(w.index(40, 40, 20), 7);
    w.step(20);
    expect(materials.recomputes).toBe(0);
    w.carve(w.index(42, 45, 20), TileKind.Floor);
    w.setFluid(w.index(42, 45, 20), 7, 'magma');
    w.step(20);
    // (42, 45) lies in chunk (2, 2): its level has 9 chunks around it, the level above 9 more.
    expect(materials.recomputes).toBe(18);
    expect(w.map.tempOverride[w.index(42, 45, 21)]).toBe(K.MAGMA_OVERRIDE);
    expect(w.map.tempOverride[w.index(44, 45, 20)]).toBe(K.MAGMA_OVERRIDE / 4);
  });

  it('gemsprings warm springs carry SPRING_OVERRIDE', () => {
    const spec = regionSpec('springs', { traits: ['gemsprings'] });
    const w = new TestWorld({ seed: 'springs', world: 'local', spec });
    const springs = w.game.local?.warmSprings ?? [];
    expect(springs.length).toBeGreaterThan(0);
    w.step(4);
    const m = w.readers.of<MaterialsReader>('05');
    for (const s of springs) {
      expect(m.isWarmSpring(s)).toBe(true);
      expect(w.map.tempOverride[s]).toBe(K.SPRING_OVERRIDE);
    }
  });
});
