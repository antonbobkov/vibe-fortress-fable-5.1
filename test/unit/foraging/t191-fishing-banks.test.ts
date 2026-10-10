import { describe, expect, it } from 'vitest';
import { FluidType, Map3D, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import { floodBodies, type ForagingReader } from '@systems/foraging';
import { homesteadYearWorld } from '../../scenarios/homestead_year_fortress';
import { TestWorld } from '../../scenarios/test-world';

function channel(drop: number): { w: TestWorld; bank: number; water: number } {
  const w = new TestWorld({ seed: 't191-bank', world: 'flat-test', embark: 'none' });
  const bank = w.index(5, 5, 32);
  for (let d = 0; d < drop; d += 1) w.carve(w.index(6, 5, 32 - d), TileKind.Open);
  const water = w.index(6, 5, 32 - drop);
  w.carve(water, TileKind.Floor);
  w.setFluid(water, 7);
  return { w, bank, water };
}

function qualifies(w: TestWorld, bank: number, expected: boolean): void {
  expect(w.readers.of<BuildingsReader>('14').zoneTileQualifies('fishing', bank)).toBe(expected);
  expect(w.readers.of<ForagingReader>('09').canFishAt(bank)).toBe(expected);
  expect(w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'fishing', tiles: [bank] }))
    .toEqual(expected ? { ok: true } : { ok: false, reason: 'bad_zone_tiles' });
}

describe('T-191 fishing banks beside natural channels', () => {
  it.each([0, 1, 2])('accepts deep water %i levels below the bank', (drop) => {
    const { w, bank } = channel(drop);
    qualifies(w, bank, true);
  });

  it('rejects a three-level drop', () => {
    const { w, bank } = channel(3);
    qualifies(w, bank, false);
  });

  it.each([0, 1, 2])('rejects frozen water %i levels below the bank', (drop) => {
    const { w, bank, water } = channel(drop);
    w.map.fluid[water] = Map3D.packFluid(7, FluidType.Water, false, false, true);
    qualifies(w, bank, false);
  });

  it('does not fish through an intervening floor', () => {
    const { w, bank } = channel(2);
    w.carve(w.index(6, 5, 31), TileKind.Floor);
    qualifies(w, bank, false);
  });

  it('does not look through shallow water to a lower pool', () => {
    const { w, bank } = channel(2);
    w.setFluid(w.index(6, 5, 31), 1);
    qualifies(w, bank, false);
  });

  it('rejects water beside magma at the bottom of the drop', () => {
    const { w, bank } = channel(2);
    w.setFluid(w.index(7, 5, 30), 1, 'magma');
    qualifies(w, bank, false);
  });

  it('keeps vertically aligned water pools separate', () => {
    const { w, water } = channel(1);
    const lower = w.index(6, 5, 30);
    w.setFluid(lower, 7);
    const bodies = floodBodies(w.map, 1);
    expect(bodies.bodyOfTile.get(water)).not.toBe(bodies.bodyOfTile.get(lower));
  });

  it('qualifies the rejected generated brook bank', () => {
    const w = homesteadYearWorld();
    qualifies(w, w.index(31, 10, 32), true);
  });

  it('draws a catch from the pool at the bottom of a two-level drop', () => {
    const { w, bank, water } = channel(2);
    for (let y = 5; y <= 6; y += 1) for (let x = 6; x <= 8; x += 1) {
      const tile = w.index(x, y, 30);
      w.carve(tile, TileKind.Floor);
      w.setFluid(tile, 7);
    }
    qualifies(w, bank, true);
    w.spawnDwarf({ at: bank, skills: { fishing: 10 } });
    w.until((v) => v.events('FishCaught').length > 0, 3000);
    const reader = w.readers.of<ForagingReader>('09');
    const body = reader.waterBodyAt(water);
    expect(body).toBeDefined();
    expect(w.events('FishCaught')[0]?.['bodyId']).toBe(body?.id);
    expect(body?.tileCount).toBe(6);
    expect(body?.fishPool).toBeLessThan(12);
    expect(w.events('JobCompleted').some((ev) => ev['jobType'] === 'fish')).toBe(true);
  });
});
