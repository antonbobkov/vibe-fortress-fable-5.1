import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { TileFlag } from '@core/map3d';
import { BREEDING_CAP_DEFAULT, CONDITION_PER_GRASS, CONDITION_PER_HOUR, conditionRise } from '@systems/animals';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const at = (w: TestWorld, x = 10, y = 10): number => w.index(x, y, FLAT_TEST_SURFACE_Z);
const world = (seed: string): TestWorld => new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });

describe('T-M4-04 tame animals', () => {
  it('condition arithmetic, cold snap, and grass relief', () => {
    expect(conditionRise(false)).toBe(CONDITION_PER_HOUR);
    expect(conditionRise(true)).toBe(CONDITION_PER_HOUR * 2);
    const w = world('tame-condition');
    const tile = at(w);
    w.map.setFlag(tile, TileFlag.Grass, true);
    const cow = w.spawnTame('cow', tile);
    w.step(21 * TICKS_PER_HOUR + 12);
    expect(w.game.world.entities.get(cow, C.Tame)?.condition).toBe(42 - CONDITION_PER_GRASS);
    expect(w.events('GrassGrazed').length).toBeGreaterThan(0);
  });

  it('D-113: only grazers accumulate condition', () => {
    const w = world('tame-diet');
    const cow = w.spawnTame('cow', at(w));
    const dog = w.spawnTame('dog', at(w, 11));
    w.step(2 * TICKS_PER_HOUR + 1);
    expect(w.game.world.entities.get(cow, C.Tame)?.condition).toBe(CONDITION_PER_HOUR);
    expect(w.game.world.entities.get(dog, C.Tame)?.condition).toBe(0);
  });

  it('D-114: a tame grazer eats on its think interval', () => {
    const w = world('tame-think');
    const tile = at(w);
    w.map.setFlag(tile, TileFlag.Grass, true);
    const cow = w.spawnTame('cow', tile);
    const t = w.game.world.entities.get(cow, C.Tame);
    if (t === undefined) throw new Error('cow missing');
    w.game.world.entities.add(cow, C.Tame, { ...t, condition: 42 });
    w.step(12);
    expect(w.game.world.entities.get(cow, C.Tame)?.condition).toBe(42 - CONDITION_PER_GRASS);
    expect(w.events('GrassGrazed')).toHaveLength(1);
  });

  it('breeding cap prevents pregnancy, and C-003: cow gestation lasts 60 days', () => {
    const w = world('cow-gestation');
    const female = w.spawnTame('cow', at(w), { sex: 0 });
    w.spawnTame('cow', at(w, 11), { sex: 1 });
    expect(w.game.world.applyCommand({ type: 'SetBreedingCap', species: 'cow', cap: 2 }).ok).toBe(true);
    w.step(TICKS_PER_DAY);
    expect(w.game.world.entities.get(female, C.Tame)?.pregnantUntil).toBe(0);
    expect(w.game.world.applyCommand({ type: 'SetBreedingCap', species: 'cow', cap: BREEDING_CAP_DEFAULT }).ok).toBe(true);
    w.until((v) => (v.game.world.entities.get(female, C.Tame)?.pregnantUntil ?? 0) > 0, 25 * TICKS_PER_DAY);
    const due = w.game.world.entities.get(female, C.Tame)?.pregnantUntil ?? 0;
    expect(due - w.tick).toBeGreaterThanOrEqual(60 * TICKS_PER_DAY - 1);
    // Keep the mother fed without changing the breeding clock.
    const t = w.game.world.entities.get(female, C.Tame);
    if (t === undefined) throw new Error('mother missing');
    w.game.world.entities.add(female, C.Tame, { ...t, condition: 0, pregnantUntil: w.tick + TICKS_PER_DAY });
    w.until((v) => v.events('AnimalBorn').length > 0, 2 * TICKS_PER_DAY);
    const born = w.events('AnimalBorn');
    expect(born).toHaveLength(1);
    const baby = born[0]?.['id'] as number;
    expect(w.game.world.entities.get(baby, C.Tame)?.pastureId).toBe(0);
  });

  it('eggs require a nest box and a rooster to hatch', () => {
    const w = world('eggs-hatch');
    w.spawnTame('chicken', at(w), { sex: 0 });
    w.step(4 * TICKS_PER_DAY);
    expect(w.animals.eggs.size).toBe(0);
    w.build('nest_box', at(w, 11));
    w.step(4 * TICKS_PER_DAY);
    expect(w.animals.eggs.size).toBe(1);
    expect(w.animals.reader().nestBoxes()).toHaveLength(1);
    w.step(12 * TICKS_PER_DAY);
    expect(w.events('AnimalBorn')).toHaveLength(0);
    w.spawnTame('chicken', at(w, 12), { sex: 1 });
    w.until((v) => v.events('AnimalBorn').length > 0, 2 * TICKS_PER_DAY);
    expect(w.animals.eggs.size).toBe(0);
  });

  it('milk, wool and egg collection make the specified jobs when ready', () => {
    const w = world('animal-products');
    w.build('farmers_workshop', at(w, 15));
    w.build('nest_box', at(w, 20));
    const cow = w.spawnTame('cow', at(w), { sex: 0 });
    const sheep = w.spawnTame('sheep', at(w, 11), { sex: 0 });
    w.spawnTame('chicken', at(w, 12), { sex: 0 });
    const grass = Array.from({ length: 20 }, (_, n) => at(w, 8 + n % 5, 8 + Math.floor(n / 5)));
    for (const tile of grass) w.map.setFlag(tile, TileFlag.Grass, true);
    const pasture = w.zone('pasture', grass);
    for (const animalId of [cow, sheep]) expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId, zoneId: pasture }).ok).toBe(true);
    w.step(29 * TICKS_PER_DAY);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.byKey(`milk:${cow}`)).toBeDefined();
    expect(jobs.byKey(`wool:${sheep}`)).toBeDefined();
    expect(jobs.list().some((j) => jobs.typeOf(j.id) === 'collect_egg')).toBe(true);
    expect(w.events('ProductReady').filter((e) => e['product'] === 'milk')).toHaveLength(1);
  });

  it('D-115: marking slaughter keeps a flag for T-M4-11', () => {
    const w = world('slaughter-mark');
    const cow = w.spawnTame('cow', at(w));
    expect(w.game.world.applyCommand({ type: 'MarkSlaughter', animalId: cow }).ok).toBe(true);
    expect(w.game.world.entities.get(cow, C.Tame)?.slaughter).toBe(true);
    w.step(20);
    expect(w.game.world.entities.alive(cow)).toBe(true);
    expect(w.game.world.applyCommand({ type: 'UnmarkSlaughter', animalId: cow }).ok).toBe(true);
    expect(w.game.world.entities.get(cow, C.Tame)?.slaughter).toBe(false);
  });

  it('D-116: animal names use the creature name limit', () => {
    const w = world('animal-name');
    const dog = w.spawnTame('dog', at(w));
    expect(w.game.world.applyCommand({ type: 'NameAnimal', animalId: dog, name: 'Moss' }).ok).toBe(true);
    expect(w.game.world.entities.get(dog, C.Creature)?.name).toBe('Moss');
    expect(w.game.world.applyCommand({ type: 'NameAnimal', animalId: dog, name: 'x'.repeat(25) }).ok).toBe(false);
  });

  it('cats adopt on about a quarter of 100 seasonal opportunities', () => {
    const w = world('cat-adoption');
    w.spawnDwarf({ at: at(w, 12) });
    const cat = w.spawnTame('cat', at(w));
    let adopted = 0;
    for (let season = 0; season < 100; season += 1) {
      const t = w.game.world.entities.get(cat, C.Tame);
      if (t === undefined) throw new Error('cat missing');
      w.game.world.entities.add(cat, C.Tame, { ...t, petOf: 0 });
      w.animals.seasonDue = true;
      w.step(1);
      if (w.game.world.entities.get(cat, C.Tame)?.petOf !== 0) adopted += 1;
    }
    expect(adopted).toBeGreaterThanOrEqual(15);
    expect(adopted).toBeLessThanOrEqual(35);
  });
});
