import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { Job } from '@systems/jobs';
import type { WorkshopsReader, WorkshopsSystem } from '@systems/workshops';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M5-05 mechanic, jeweler and glowstone lamp', () => {
  it('executes both mechanic and jeweler recipes with authored materials and quality', () => {
    const w = new TestWorld({ seed: 'm5-mechanic-jeweler', world: 'flat-test', embark: 'none' });
    const at = w.index(16, 16, 32);
    const mechanic = w.build('mechanic', at);
    const jeweler = w.build('jeweler', w.index(24, 16, 32));
    const maker = w.spawnDwarf({ at: w.index(20, 18, 32), skills: { mechanics: 20, gem_cutting: 20 } });
    w.step(1);
    const op = (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
    const reader = w.readers.of<WorkshopsReader>('12');
    const items = w.readers.of<ItemsReader>('13');
    const expected = [
      { id: 'make_mechanism', shop: mechanic, inputs: [['raw_stone', 'granite']], item: 'mechanism', material: 'granite' },
      { id: 'make_mechanism_metal', shop: mechanic, inputs: [['bar', 'iron']], item: 'mechanism', material: 'iron' },
      { id: 'cut_gem', shop: jeweler, inputs: [['rough_gem', 'ruby']], item: 'cut_gem', material: 'ruby' },
      { id: 'make_glowstone_lamp', shop: jeweler,
        inputs: [['rough_gem', 'glowstone'], ['stone_block', 'granite']], item: 'statue', material: 'glowstone' },
    ] as const;
    expect(reader.recipesFor('mechanic')).toHaveLength(2);
    expect(reader.recipesFor('jeweler')).toHaveLength(2);
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;
    for (const row of expected) {
      const recipe = reader.recipe(row.id)!;
      expect(recipe.quality).toBe(true);
      const inputs = row.inputs.map(([type, material]) => {
        const id = w.spawnItem(type, material, at);
        return { filter: {}, count: 1, reserved: [id], delivered: [id] };
      });
      const before = new Set(w.game.world.entities.with(C.Item));
      op.producer().onComplete?.({ id: 0, workerId: maker, target: { kind: 'building', ref: row.shop },
        inputs, data: { recipe: row.id, orderIndex: 0, globalOrder: false } } as unknown as Job, ctx);
      const made = w.game.world.entities.with(C.Item).filter((id) => !before.has(id));
      expect(made, row.id).toHaveLength(1);
      const product = items.get(made[0]!)!;
      expect(w.game.registry.table('items').idOf(product.type), row.id).toBe(row.item);
      expect(w.game.registry.table('materials').idOf(product.material), row.id).toBe(row.material);
      expect(product.quality, row.id).toBeGreaterThanOrEqual(4);
      expect(product.crafterId, row.id).toBe(maker);
      for (const input of inputs) expect(items.get(input.delivered[0]!)).toBeUndefined();
    }
  });

  it('accepts only magma-safe metal bars for metal mechanisms', () => {
    const w = new TestWorld({ seed: 'm5-mechanism-metal', world: 'flat-test', embark: 'none' });
    const mechanic = w.build('mechanic', w.index(16, 16, 32));
    w.step(1);
    const op = (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
    const recipe = w.readers.of<WorkshopsReader>('12').recipe('make_mechanism_metal')!;
    const order = { recipe: op.recipeIndex(recipe.id), remaining: 1, mode: 'once' as const,
      threshold: 0, priority: 5 as const, materialFilter: null };
    const filter = op.inputFilter(recipe, recipe.inputs[0]!, order)!;
    const materials = w.game.registry.table('materials');
    expect(filter.materialIds).toContain(materials.index('iron'));
    expect(filter.materialIds).not.toContain(materials.index('copper'));
    w.spawnItem('bar', 'copper', w.index(20, 16, 32));
    expect(op.problem(order, mechanic)).toBe('waiting for bar');
    w.spawnItem('bar', 'iron', w.index(20, 17, 32));
    expect(op.problem(order, mechanic)).toBeNull();
  });

  it('sets and restores the 3×3 Lit flag through terrain, preserving overlap and crop darkness', () => {
    const w = new TestWorld({ seed: 'm5-glowstone-light', world: 'flat-test', embark: 'none' });
    const map = w.game.world.map;
    const terrain = w.game.world.services.terrain;
    const centre = w.index(20, 20, 32);
    const tiles = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) =>
      w.index(19 + x, 19 + y, 32))).flat();
    for (const t of tiles) terrain.setFlag(t, TileFlag.Lit, false);
    terrain.setFlag(tiles[0]!, TileFlag.Lit, true);
    const first = w.build('statue', centre, 'glowstone');
    expect(tiles.every((t) => map.hasFlag(t, TileFlag.Lit))).toBe(true);
    const buildings = w.game.world.scheduler.byId('14') as BuildingsSystem;
    expect(buildings.reader().cropLitAt(centre)).toBe(false);
    expect(buildings.reader().cropLitAt(tiles[0]!)).toBe(true);
    const second = w.build('statue', w.index(22, 20, 32), 'glowstone');
    buildings.buildings.remove(first);
    expect(map.hasFlag(w.index(21, 20, 32), TileFlag.Lit)).toBe(true);
    expect(map.hasFlag(centre, TileFlag.Lit)).toBe(false);
    expect(map.hasFlag(tiles[0]!, TileFlag.Lit)).toBe(true);
    buildings.buildings.remove(second);
    expect(map.hasFlag(w.index(21, 20, 32), TileFlag.Lit)).toBe(false);
  });
});
