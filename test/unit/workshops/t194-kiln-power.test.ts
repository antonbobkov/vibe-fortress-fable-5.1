import { describe, expect, it } from 'vitest';
import { TileKind } from '@core/map3d';
import { MAGMA_POWER_LEVEL } from '@systems/workshops/constants';
import type { WorkshopsReader } from '@systems/workshops';
import { TestWorld } from '../../scenarios/test-world';

describe('T-194 the magma kiln recognizes its power source', () => {
  it("reads magma power by the footprint rule, and has the kiln's recipes (T-553)", () => {
    const w = new TestWorld({ seed: 't194-kiln-power', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    const below = w.map.below(at);
    w.carve(below, TileKind.Open);
    w.setFluid(below, 7, 'magma', true);
    const kiln = w.buildUnchecked('magma_kiln', at, 'granite');
    w.step(1);
    const reader = w.readers.of<WorkshopsReader>('12');
    expect(reader.recipesFor('magma_kiln')).toEqual(reader.recipesFor('kiln'));
    expect(reader.recipesFor('kiln')).toHaveLength(10);
    expect(reader.isMagmaPowered(kiln)).toBe(true);
    w.setFluid(below, MAGMA_POWER_LEVEL - 1, 'magma', true);
    expect(reader.isMagmaPowered(kiln)).toBe(false);
    w.setFluid(below, MAGMA_POWER_LEVEL, 'water', true);
    expect(reader.isMagmaPowered(kiln)).toBe(false);
    w.setFluid(below, MAGMA_POWER_LEVEL, 'magma', true);
    expect(reader.isMagmaPowered(kiln)).toBe(true);
    expect(reader.isMagmaPowered(0)).toBe(false);
  });

  it('does not power an ordinary workshop built above magma', () => {
    const w = new TestWorld({ seed: 't194-ordinary-workshop', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    w.carve(w.map.below(at), TileKind.Open);
    w.setFluid(w.map.below(at), 7, 'magma', true);
    const ordinary = w.build('smelter', at, 'granite');
    w.step(1);
    expect(w.readers.of<WorkshopsReader>('12').isMagmaPowered(ordinary)).toBe(false);
  });
});
