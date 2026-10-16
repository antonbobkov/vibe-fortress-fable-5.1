/** T-335: a grazer picks only grass it can reach. */
import { describe, expect, it } from 'vitest';
import { buildFlatTestMap, FLAT_TEST_SURFACE_Z as Z, HeadlessGame, FLAT_TEST_SPEC, FLAT_TEST_LAYERS } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();

function meadow(seed: string) {
  const w = new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none', surfaceWildlife: 'none',
    systems: HeadlessGame.standardSystems(FLAT_TEST_SPEC, FLAT_TEST_LAYERS).filter((system) => system.id !== '21') });
  // One grass tile two steps from the cow, shut in by a ring of trees: walkable, in no region the cow is in.
  const shutIn = w.index(12, 10, Z);
  w.map.setFlag(shutIn, TileFlag.Grass, true);
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    if (dx !== 0 || dy !== 0) w.carve(w.index(12 + dx, 10 + dy, Z), TileKind.Tree);
  }
  // Open grass farther away, still within the six-tile search of a grazer with no pasture.
  const open: number[] = [];
  for (let y = 8; y <= 12; y += 1) for (let x = 15; x <= 16; x += 1) {
    const tile = w.index(x, y, Z);
    w.map.setFlag(tile, TileFlag.Grass, true);
    open.push(tile);
  }
  w.step(2);
  return { w, shutIn, open };
}

describe('T-335 a grazer grazes the grass it can reach', () => {
  it('passes over pasture grass shut in by trees and eats from the open grass', () => {
    const { w, shutIn, open } = meadow('t335-pasture');
    const zoneId = w.zone('pasture', [shutIn, ...open]);
    const cow = w.spawnTame('cow', w.index(10, 10, Z), { sex: 1 });
    expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId: cow, zoneId }).ok).toBe(true);
    const tame = w.game.world.entities.get(cow, C.Tame)!;
    w.game.world.entities.add(cow, C.Tame, { ...tame, condition: 80 });
    w.step(400);
    expect(w.game.world.entities.get(cow, C.Tame)!.condition).toBeLessThan(80);
    expect(w.map.hasFlag(shutIn, TileFlag.Grass)).toBe(true);
  });

  it('a grazer with no pasture passes over grass it cannot reach', () => {
    const { w, shutIn } = meadow('t335-no-pasture');
    const cow = w.spawnTame('cow', w.index(10, 10, Z), { sex: 1 });
    const tame = w.game.world.entities.get(cow, C.Tame)!;
    w.game.world.entities.add(cow, C.Tame, { ...tame, condition: 80 });
    w.step(400);
    expect(w.game.world.entities.get(cow, C.Tame)!.condition).toBeLessThan(80);
    expect(w.map.hasFlag(shutIn, TileFlag.Grass)).toBe(true);
  });

  it('keeps walking to the grass it chose while that grass is still there for it', () => {
    const w = new TestWorld({ seed: 't335-keep-target', registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none', surfaceWildlife: 'none',
      systems: HeadlessGame.standardSystems(FLAT_TEST_SPEC, FLAT_TEST_LAYERS).filter((system) => system.id !== '21') });
    const far = w.index(20, 10, Z), near = w.index(8, 10, Z);
    w.map.setFlag(far, TileFlag.Grass, true);
    w.step(2);
    const zoneId = w.zone('pasture', [far, near]);
    const cow = w.spawnTame('cow', w.index(10, 10, Z), { sex: 1 });
    expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId: cow, zoneId }).ok).toBe(true);
    const tame = w.game.world.entities.get(cow, C.Tame)!;
    w.game.world.entities.add(cow, C.Tame, { ...tame, condition: 80 });
    const movement = w.game.movement;
    w.until(() => movement.walkTarget(cow) === far, 30);
    // Nearer grass appears behind it: the cow does not turn round on its next think.
    w.map.setFlag(near, TileFlag.Grass, true);
    w.until(() => w.events('GrassGrazed').length > 0, 400);
    expect(w.events('GrassGrazed')[0]!['tile']).toBe(far);
  });
});
