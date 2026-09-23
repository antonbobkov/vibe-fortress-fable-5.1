import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { buildFlatTestMap } from '@app/headless';
import { Designation, FluidType, Map3D, TileFlag, TileKind } from '@core/map3d';
import { butcherYields, fishingWater, floodBodies, FISH_PER_TILE, FISH_REGEN_PERCENT } from '@systems/foraging';
import { TestWorld } from '../../scenarios/test-world';
import { C } from '@core/components';

describe('T-M4-11 foraging', () => {
  it('flood fills connected water, classifies river and cavern, and excludes small pools', () => {
    const map = new Map3D(12, 12, 4);
    const river = [map.index(2, 2, 2), map.index(3, 2, 2), map.index(4, 2, 2),
      map.index(2, 3, 2), map.index(3, 3, 2), map.index(4, 3, 2)];
    for (const tile of river) { map.fluid[tile] = Map3D.packFluid(7, FluidType.Water, true, tile === river[0]); map.setFlag(tile, TileFlag.Outdoor, true); }
    const isolated = map.index(10, 10, 2);
    map.fluid[isolated] = Map3D.packFluid(7);
    const { bodies, bodyOfTile } = floodBodies(map, 1);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toEqual({ id: 1, version: 1, tileCount: 6, fishPool: 6 * FISH_PER_TILE, kind: 'river' });
    expect(bodies[1]?.fishPool).toBe(0);
    expect(bodyOfTile.get(river[5] as number)).toBe(1);
    expect(fishingWater(map, river[0] as number)).toBe(true);
    map.fluid[river[0] as number] = Map3D.packFluid(7, FluidType.Water, false, false, true);
    expect(fishingWater(map, river[0] as number)).toBe(false);
    expect(FISH_REGEN_PERCENT).toBe(5);
  });

  it('calculates documented yields for five sizes, shell and rotten stage', () => {
    const registry = contentRegistry();
    const species = registry.table<{ id: string; size: number; shell?: boolean }>('creatures');
    const expected = [
      ['rabbit', [1, 0, 0, 0, 0, 0]],
      ['cave_crab', [1, 0, 0, 0, 0, 1]],
      ['dog', [1, 1, 0, 0, 0, 0]],
      ['cow', [7, 1, 3, 3, 1, 0]],
      ['mammoth', [18, 2, 8, 7, 1, 0]],
    ] as const;
    for (const [id, want] of expected) {
      const row = species.byId(id) as { size: number; shell?: boolean };
      const y = butcherYields(row.size, row.shell === true);
      expect([y.meat, y.hide, y.bone, y.fat, y.skull, y.shell]).toEqual(want);
    }
    expect(butcherYields(90, false, false, true)).toEqual({ meat: 0, hide: 0, bone: 3, fat: 0, skull: 0, shell: 0 });
    expect(butcherYields(90, false, true).meat).toBe(3);
    expect(butcherYields(90, false, true).bone).toBe(3);
  });

  it('gather zones designate only mature shrubs at their priority after DayPassed', () => {
    const registry = contentRegistry();
    const w = new TestWorld({ seed: 'gather-zone', registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });
    const tile = w.index(10, 10, 32);
    const shrub = registry.table('materials').index('brightleaf');
    w.map.setKind(tile, TileKind.Shrub, shrub);
    const zone = w.zone('gather', [tile]);
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: zone, key: 'priority', value: 3 }).ok).toBe(true);
    w.step(1210);
    expect(w.map.designationAt(tile)).toBe(Designation.Gather);
    expect(w.map.designationPriorityAt(tile)).toBe(3);
  });

  it('leads a marked animal to a butcher, leaves a corpse, then produces the species yields', () => {
    const registry = contentRegistry();
    const w = new TestWorld({ seed: 'slaughter-path', registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });
    const workshop = w.build('butcher', w.index(15, 15, 32));
    const cow = w.spawnTame('cow', w.index(11, 15, 32), { sex: 0 });
    w.spawnDwarf({ at: w.index(14, 15, 32), skills: { butchery: 5 } });
    expect(w.game.world.applyCommand({ type: 'MarkSlaughter', animalId: cow }).ok).toBe(true);
    w.until((v) => v.events('CreatureDied').some((e) => e['id'] === cow), 1600);
    const created = w.events('CorpseCreated').find((e) => e['creatureId'] === cow);
    expect(created).toBeDefined();
    expect(w.events('CorpseCreated')).toHaveLength(1);
    const corpse = created?.['id'] as number;
    expect(w.game.world.entities.get(corpse, C.Corpse)?.species).toBe(registry.table('creatures').index('cow'));
    w.until((v) => v.events('ButcheryDone').length > 0, 1600);
    const done = w.events('ButcheryDone')[0];
    expect(done?.['workshopId']).toBe(workshop);
    expect(done?.['species']).toBe('cow');
    expect(w.readers.of<{ count(id: string): number }>('13').count('raw_meat')).toBeGreaterThan(0);
  });

  it('defaults huntable timid and neutral species by size, and toggles predators without creating hunt jobs', () => {
    const registry = contentRegistry();
    const w = new TestWorld({ seed: 'huntable-seam', registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });
    const reader = w.readers.of<{ isHuntable(s: string): boolean }>('09');
    expect(reader.isHuntable('rabbit')).toBe(false);
    expect(reader.isHuntable('deer')).toBe(true);
    expect(reader.isHuntable('wolf')).toBe(false);
    expect(w.game.world.applyCommand({ type: 'SetHuntable', species: 'wolf', on: true }).ok).toBe(true);
    expect(reader.isHuntable('wolf')).toBe(true);
    w.step(10);
    expect(w.readers.of<{ list(): { key: string }[] }>('11').list().some((j) => j.key.startsWith('hunt:'))).toBe(false);
  });
});
