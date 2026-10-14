/** T-285: one physical grass tile feeds at most one grazer before it is cleared. */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import { TestWorld } from '../../scenarios/test-world';

const SPECIES = ['cow', 'cow', 'sheep', 'sheep', 'goat', 'goat'];

function world(seed: string) {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}
function hungry(w: TestWorld, species: string, tile: number, condition = 42) {
  const id = w.spawnTame(species, tile, { sex: 1 });
  w.game.world.entities.add(id, C.Tame, { ...w.game.world.entities.get(id, C.Tame)!, condition });
  return id;
}
const conditionOf = (w: TestWorld, id: number) => w.game.world.entities.get(id, C.Tame)?.condition;
const grazed = (w: TestWorld, tile: number) => w.events('GrassGrazed').filter(e => e['tile'] === tile).length;

describe('T-285 several grazers, one grass tile', () => {
  it('gives relief to one of six grazers for one physical consumption', () => {
    const w = world('t285-single-grass');
    const tile = w.index(10, 10, Z); w.map.setFlag(tile, TileFlag.Grass, true);
    const ids = SPECIES.map(species => hungry(w, species, tile));
    w.step(20);
    const conditions = ids.map(id => conditionOf(w, id));
    expect(conditions.filter(c => c === 17)).toHaveLength(1);
    expect(conditions.filter(c => c === 42)).toHaveLength(5);
    expect(grazed(w, tile)).toBe(1);
    expect(w.map.hasFlag(tile, TileFlag.Grass)).toBe(false);
  });

  it('feeds one grazer on each of two distinct tiles', () => {
    const w = world('t285-two-tiles');
    const a = w.index(10, 10, Z), b = w.index(20, 20, Z);
    for (const t of [a, b]) w.map.setFlag(t, TileFlag.Grass, true);
    const ids = [hungry(w, 'cow', a), hungry(w, 'cow', a), hungry(w, 'sheep', b), hungry(w, 'sheep', b)];
    w.step(20);
    expect(ids.map(id => conditionOf(w, id)).filter(c => c === 17)).toHaveLength(2);
    expect(grazed(w, a)).toBe(1);
    expect(grazed(w, b)).toBe(1);
  });

  it('a grazer that was denied walks to other grass and eats it', () => {
    const w = world('t285-denied-walks');
    const a = w.index(10, 10, Z), b = w.index(12, 10, Z);
    for (const t of [a, b]) w.map.setFlag(t, TileFlag.Grass, true);
    const ids = [hungry(w, 'cow', a), hungry(w, 'cow', a)];
    w.step(60);
    // Each ate once (42 - 25 = 17, plus the hourly rise); neither ate twice.
    for (const id of ids) {
      expect(conditionOf(w, id)!).toBeGreaterThanOrEqual(17);
      expect(conditionOf(w, id)!).toBeLessThan(25);
    }
    expect(grazed(w, a)).toBe(1);
    expect(grazed(w, b)).toBe(1);
  });

  it('regrowth of the same tile may be eaten again', () => {
    const w = world('t285-regrowth');
    const tile = w.index(10, 10, Z); w.map.setFlag(tile, TileFlag.Grass, true);
    const id = hungry(w, 'cow', tile);
    w.step(20);
    expect(conditionOf(w, id)).toBe(17);
    expect(w.map.hasFlag(tile, TileFlag.Grass)).toBe(false);
    w.game.world.entities.add(id, C.Tame, { ...w.game.world.entities.get(id, C.Tame)!, condition: 42 });
    w.map.setFlag(tile, TileFlag.Grass, true);
    w.step(20);
    expect(conditionOf(w, id)).toBe(17);
    expect(grazed(w, tile)).toBe(2);
  });

  it('keeps the claim across a save and load made while it is pending', () => {
    const w = world('t285-save-load');
    const tile = w.index(10, 10, Z); w.map.setFlag(tile, TileFlag.Grass, true);
    const ids = SPECIES.map(species => hungry(w, species, tile));
    w.step(1);
    const before = w.game.hash();
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(before);
    w.replaceGame(loaded);
    w.step(20);
    expect(ids.map(id => conditionOf(w, id)).filter(c => c === 17)).toHaveLength(1);
    expect(grazed(w, tile)).toBe(1);
  });
});
