import { describe, expect, it } from 'vitest';
import { TileKind } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { MAGMA_POWER_LEVEL } from '@systems/workshops/constants';
import type { WorkshopsReader } from '@systems/workshops';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M5-04 magma workshops', () => {
  it('D-148: requires enough magma directly below a footprint tile and rejects pine blocks', () => {
    const w = new TestWorld({ seed: 'm5-magma-place', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    const below = w.map.below(at);
    w.carve(below, TileKind.Open);
    const place = (materialChoice: string) => w.game.world.applyCommand({ type: 'PlaceBuilding',
      buildingType: 'magma_smelter', origin: at, orientation: 0, materialChoice });
    expect(place('granite')).toEqual({ ok: false, reason: 'bad_placement' });
    w.setFluid(below, MAGMA_POWER_LEVEL - 1, 'magma', true);
    expect(place('granite')).toEqual({ ok: false, reason: 'bad_placement' });
    w.setFluid(below, MAGMA_POWER_LEVEL, 'magma', true);
    expect(place('pine')).toEqual({ ok: false, reason: 'not_magma_safe' });
    expect(place('granite')).toEqual({ ok: true });
  });

  it('filters the magma forge anvil to iron or steel and its blocks to the magma-safe chosen material', () => {
    const w = new TestWorld({ seed: 'm5-magma-forge-input', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    w.carve(w.map.below(at), TileKind.Open);
    w.setFluid(w.map.below(at), 7, 'magma', true);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'magma_forge',
      origin: at, orientation: 0, materialChoice: 'granite' })).toEqual({ ok: true });
    w.step(1);
    const job = Array.from((w.game.world.services.jobs as JobBoard).jobs.values()).find((entry) => entry.key.startsWith('build:'));
    expect(job?.inputs[0]?.filter.materialIds?.map((id) => w.game.registry.table('materials').idOf(id))).toEqual(['iron', 'steel']);
    expect(job?.inputs[0]?.filter.materialId).toBeUndefined();
    expect(job?.inputs[1]?.filter.materialId).toBe(w.game.registry.table('materials').index('granite'));
  });

  it('exposes magma smelter and forge recipes but keeps the reserved kiln without recipes', () => {
    const w = new TestWorld({ seed: 'm5-magma-recipes', world: 'flat-test', embark: 'none' });
    const reader = w.readers.of<WorkshopsReader>('12');
    expect(reader.recipesFor('magma_smelter')).toHaveLength(25);
    expect(reader.recipesFor('magma_forge')).toHaveLength(40);
    expect(reader.recipesFor('magma_kiln')).toHaveLength(0);
  });

  it('forges a steel dagger over magma without consuming a fuel bar', () => {
    const w = new TestWorld({ seed: 'm5-magma-forge-craft', world: 'flat-test', embark: 'none' });
    const at = w.index(15, 15, 32);
    w.carve(w.map.below(at), TileKind.Open);
    w.setFluid(w.map.below(at), 7, 'magma', true);
    const forge = w.build('magma_forge', at, 'granite');
    w.spawnDwarf({ at: w.index(18, 17, 32), skills: { weaponsmithing: 8 } });
    w.spawnItem('bar', 'steel', w.index(19, 17, 32));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: forge,
      order: { recipeId: 'forge_dagger', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    w.until(() => w.events('ItemCrafted').some((e) => e['recipeId'] === 'forge_dagger'), 1000);
    expect(w.readers.of<ItemsReader>('13').count('charcoal_bar')).toBe(0);
    expect(w.readers.of<ItemsReader>('13').count('coal_bar')).toBe(0);
  });
});
