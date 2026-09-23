import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { contentRegistry } from '@content/loader';
import { recipeInputFilter, resolveMaterial, type WorkshopsReader, type WorkshopsSystem } from '@systems/workshops';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const materials = registry.table('materials');

describe('T-M4-08 workshops operation and orders', () => {
  it('resolves item, tag and material-class input filters, and all material rules', () => {
    const order = { recipe: 1, remaining: 1, mode: 'once' as const, threshold: 0, priority: 5 as const, materialFilter: null };
    expect(recipeInputFilter(registry, { match: 'log', count: 1 }, order)).toEqual({ type: registry.table('items').index('log') });
    expect(recipeInputFilter(registry, { match: 'ingredient', count: 2 }, order)).toEqual({ tag: 'ingredient' });
    expect(recipeInputFilter(registry, { match: 'wood', count: 1 }, order)).toEqual({ materialClass: 'wood' });
    expect(recipeInputFilter(registry, { match: 'log', count: 1 }, { ...order, materialFilter: 'oak' })).toEqual({ type: registry.table('items').index('log'), materialId: materials.index('oak') });
    const oak = materials.index('oak');
    expect(resolveMaterial(registry, { from: 'input', index: 0 }, [oak])).toBe(oak);
    expect(resolveMaterial(registry, { fixed: 'leather' }, [oak])).toBe(materials.index('leather'));
    expect(resolveMaterial(registry, { plantDrink: true }, [materials.index('dimcap')])).toBe(materials.index('dimcap_ale'));
  });

  it('checks distinct meal ingredients, brew containers, and assigned workers', () => {
    const w = new TestWorld({ seed: 'm4-runnable', world: 'flat-test', embark: 'none' });
    const bed = w.build('carpenter', w.index(12, 12, 32));
    const kitchen = w.build('kitchen', w.index(22, 12, 32));
    const still = w.build('still', w.index(32, 12, 32));
    const dwarf = w.spawnDwarf({ at: w.index(15, 14, 32) });
    w.step(1);
    const reader = w.readers.of<WorkshopsReader>('12');
    expect(reader.isRunnable('make_bed', bed)).toEqual({ runnable: false, reason: 'waiting for log' });
    w.spawnItem('log', 'oak', w.index(15, 14, 32));
    expect(reader.isRunnable('make_bed', bed)).toEqual({ runnable: true, reason: null });
    w.spawnItem('plant_food', 'turnip', w.index(24, 14, 32), 4);
    expect(reader.isRunnable('cook_easy_meal', kitchen)).toEqual({ runnable: false, reason: 'waiting for ingredient' });
    w.spawnItem('plant_food', 'dimcap', w.index(25, 14, 32), 4);
    expect(reader.isRunnable('cook_easy_meal', kitchen)).toEqual({ runnable: true, reason: null });
    expect(reader.isRunnable('brew', still)).toEqual({ runnable: false, reason: 'waiting for barrel' });
    w.spawnItem('barrel', 'oak', w.index(34, 14, 32));
    expect(reader.isRunnable('brew', still)).toEqual({ runnable: true, reason: null });
    const system = w.game.world.scheduler.byId('12') as WorkshopsSystem;
    const ws = system.operator.workshop(bed)!;
    system.operator.save(bed, { ...ws, assignedWorker: 999999 });
    expect(reader.isRunnable('make_bed', bed)).toEqual({ runnable: false, reason: 'no_worker' });
    system.operator.save(bed, { ...ws, assignedWorker: dwarf });
    expect(reader.isRunnable('make_bed', bed)).toEqual({ runnable: true, reason: null });
  });

  it('adds, edits, reorders and suspends local and global orders', () => {
    const w = new TestWorld({ seed: 'm4-orders', world: 'flat-test', embark: 'none' });
    const bed = w.build('carpenter', w.index(12, 12, 32));
    w.step(1);
    const apply = (command: Record<string, unknown>) => w.game.world.applyCommand(command as never);
    expect(apply({ type: 'AddWorkOrder', workshopId: bed, order: { recipeId: 'make_bed', remaining: 2, mode: 'once', priority: 5 } })).toEqual({ ok: true });
    expect(apply({ type: 'AddWorkOrder', workshopId: bed, order: { recipeId: 'make_barrel', remaining: 1, mode: 'once', priority: 4 } })).toEqual({ ok: true });
    expect(apply({ type: 'AddWorkOrder', workshopId: 0, order: { recipeId: 'make_bed', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
    const reader = w.readers.of<WorkshopsReader>('12');
    expect(reader.ordersOf(bed)).toHaveLength(2);
    expect(reader.globalOrders()).toHaveLength(1);
    expect(apply({ type: 'ReorderWorkOrder', workshopId: bed, from: 1, to: 0 })).toEqual({ ok: true });
    expect(reader.recipe(reader.ordersOf(bed)[0]!.recipe)?.id).toBe('make_barrel');
    expect(apply({ type: 'EditWorkOrder', workshopId: bed, index: 0, patch: { priority: 2 } })).toEqual({ ok: true });
    expect(reader.ordersOf(bed)[0]?.priority).toBe(2);
    expect(apply({ type: 'SuspendWorkshop', workshopId: bed, on: true })).toEqual({ ok: true });
    expect(w.game.world.entities.get(bed, C.Workshop)?.suspended).toBe(true);
    expect(apply({ type: 'RemoveWorkOrder', workshopId: bed, index: 0 })).toEqual({ ok: true });
    expect(reader.ordersOf(bed)).toHaveLength(1);
    expect(apply({ type: 'AddWorkOrder', workshopId: bed, order: { recipeId: 'tan_hide', remaining: 1 } })).toEqual({ ok: false, reason: 'precondition_failed' });
  });

  it('uses lastRaised to break profession ties and military skill while on duty', () => {
    const w = new TestWorld({ seed: 'm4-profession', world: 'flat-test', embark: 'none' });
    const id = w.spawnDwarf({ at: w.index(12, 12, 32) });
    const reader = w.readers.of<WorkshopsReader>('12');
    expect(reader.professionOf(id)).toBe('Settler');
    const skills = w.game.world.entities.get(id, C.Skills)!;
    const level = skills.level.slice();
    const carpentry = registry.table('skills').index('carpentry');
    const masonry = registry.table('skills').index('masonry');
    level[carpentry] = 6;
    level[masonry] = 6;
    w.game.world.entities.add(id, C.Skills, { ...skills, level, lastRaised: masonry });
    expect(reader.professionOf(id)).toBe('Mason');
    w.game.world.entities.add(id, C.Skills, { ...skills, level, lastRaised: carpentry });
    expect(reader.professionOf(id)).toBe('Carpenter');
    w.game.world.entities.add(id, C.Soldier, { squadId: 1, onDuty: true, stance: 'hold', targetId: 0, cooldownUntil: 0, lastShiftTick: 0 });
    expect(reader.professionOf(id)).toBe('Recruit');
  });

  it('reports a blocked reason once until that reason changes', () => {
    const w = new TestWorld({ seed: 'm4-blocked', world: 'flat-test', embark: 'none' });
    const id = w.build('carpenter', w.index(12, 12, 32));
    w.spawnDwarf({ at: w.index(15, 14, 32) });
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: id,
      order: { recipeId: 'make_bed', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
    w.step(12);
    const blocked = w.events('WorkshopBlocked').filter((e) => e['workshopId'] === id);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.['reason']).toBe('missing_input');
    w.spawnItem('log', 'oak', w.index(15, 14, 32));
    w.step(4);
    expect(w.events('WorkshopBlocked').filter((e) => e['workshopId'] === id)).toHaveLength(1);
  });
});
