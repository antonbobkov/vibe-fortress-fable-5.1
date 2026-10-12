import { describe, expect, it } from 'vitest';
import { Designation, TileKind } from '@core/map3d';
import type { TerrainReader } from '@systems/terrain/reader';
import { upperBand } from './three_years_economy';
import { designateSmoothTiles, HALL_Z, setupThreeYearsFortress, threeYearsWorld, Z } from './three_years_fortress';

describe('F-17f/F-17g: economy access and designations', () => {
  it('resolves the upper mine bounds after both fixture modules initialize', () => {
    const w = threeYearsWorld('three-years');
    const state = setupThreeYearsFortress(w);
    const band = upperBand(w, state);
    expect(Number.isFinite(band.zMax)).toBe(true);
    expect(band.zMax).toBe(HALL_Z);
    expect(band.zMin).toBeLessThan(band.zMax);
  });
  it('clears both door approaches before the gate can enclose the stair', () => {
    const w = threeYearsWorld('three-years');
    const state = setupThreeYearsFortress(w);
    for (const dy of [-2, 2]) expect(w.map.kindAt(w.index(state.cx + 6, state.cy + 6 + dy, Z))).toBe(TileKind.Floor);
  });
  it('room finishing preserves the excavation already ordered beside it', () => {
    const w = threeYearsWorld('three-years');
    const state = setupThreeYearsFortress(w);
    const terrain = w.readers.of<TerrainReader>('03');
    const materials = w.game.registry.table<{ id: string; class: string }>('materials');
    const tile = state.hearthHallTiles.find(t => w.map.kindAt(t) === TileKind.Wall &&
      materials.byIndex(w.map.materialAt(t))?.class === 'stone' && terrain.designationAt(t)?.kind === Designation.Dig);
    expect(tile).toBeDefined();
    designateSmoothTiles(w, [tile!]);
    expect(terrain.designationAt(tile!)?.kind).toBe(Designation.Dig);
  });
});
