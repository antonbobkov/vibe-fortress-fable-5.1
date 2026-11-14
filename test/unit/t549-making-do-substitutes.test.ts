/**
 * T-549, Making Do A3: wicker, coarse thread and cloth, reed and leather rope, bone and metal
 * splints and crutches, and workshops of stone (`12-workshops-and-professions.md` § Substitutes;
 * `13-items-and-storage.md` § Containers in play; `14-buildings-and-rooms.md` § Placement, Workshops
 * of stone; `17-health-and-medicine.md` § Treatment; `24-ui-and-input.md`; `workshops-and-recipes.md`).
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { Game } from '@app/game';
import { contentRegistry, loadContent } from '@content/loader';
import { C } from '@core/components';
import type { Item } from '@core/components';
import type { EntityId } from '@core/types';
import { STONE_WORKSHOP_TICKS_PERCENT } from '@systems/buildings/constants';
import type { ItemsReader } from '@systems/items';
import { preferencePercent } from '@systems/trade/valuation';
import type { WorkshopsReader } from '@systems/workshops';
import { OF_BLOCKS } from '@ui/panels/build';
import { MockCanvas, mockCanvasFactory } from './render/canvas-mock';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const items = registry.table<{ id: string; category: string; materials: string | string[]; capacity?: number; containerClass?: string; quality: boolean }>('items');
const materials = registry.table<{ id: string; class: string; burnable: boolean; nextStage?: string }>('materials');
const buildings = registry.table<{ id: string; tags: string[]; buildTicks: number }>('buildings');
const Z = 32;

function itemsOf(w: TestWorld, type: string): Item[] {
  const t = items.index(type);
  const out: Item[] = [];
  for (const id of w.game.world.entities.with(C.Item)) {
    const item = w.game.world.entities.get(id, C.Item);
    if (item?.type === t) out.push(item);
  }
  return out;
}

function units(w: TestWorld, type: string, material?: string): number {
  return itemsOf(w, type).filter((i) => material === undefined || i.material === materials.index(material)).reduce((n, i) => n + i.count, 0);
}

function order(w: TestWorld, workshopId: EntityId, recipeId: string, remaining = 1): void {
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId, order: { recipeId, mode: 'once', remaining, priority: 5 } })).toEqual({ ok: true });
}

function crafted(w: TestWorld, recipeId: string): number {
  return w.events('ItemCrafted').filter((e) => e['recipeId'] === recipeId).length;
}

interface JobView { readonly key: string; readonly inputs: readonly { filter: { types?: number[] }; count: number }[]; readonly data: Record<string, unknown> }

/** The build job of a planned building. */
function buildJob(w: TestWorld, id: EntityId): JobView | undefined {
  const jobs = w.game.world.services.jobs as unknown as { jobs: Map<number, JobView> };
  return Array.from(jobs.jobs.values()).find((j) => j.key === `build:${id}`);
}

function lastPlaced(w: TestWorld, type: string): EntityId {
  const ids = w.readers.of<{ byType(type: string): number[] }>('14').byType(type);
  return ids[ids.length - 1] as EntityId;
}

describe('T-549 the rows', () => {
  it('the substitutes are rows of their workshops', () => {
    const reader = new TestWorld({ seed: 't549-rows', world: 'flat-test', embark: 'none' }).readers.of<WorkshopsReader>('12');
    const at = (id: string): string | undefined => reader.recipe(id)?.workshop;
    expect(at('spin_coarse_thread')).toBe('loom');
    for (const id of ['weave_basket', 'twist_reed_rope', 'weave_wicker_shield', 'make_splint_bone', 'make_crutch_bone']) expect(at(id), id).toBe('craftdwarf');
    expect(at('cut_leather_rope')).toBe('leatherworks');
    expect(at('forge_crutch')).toBe('forge');
    expect(reader.recipe('forge_crutch')).toMatchObject({ fuel: true, quality: false });
    expect(reader.recipe('weave_wicker_shield')?.quality).toBe(true);
    expect(reader.recipe('spin_coarse_thread')?.inputs[0]).toMatchObject({ match: 'fiber|reed', count: 2, sameMaterial: true, materials: ['reed', 'cactus_fiber', 'nettle_fiber'] });
  });

  it('a basket is a bin of 15 of reed, which burns; crutches and splints take bone and metal; rope takes reed and leather; a buckler takes reed', () => {
    expect(items.byId('basket')).toMatchObject({ category: 'container/basket', capacity: 15, containerClass: 'bin', materials: ['plant'], quality: false });
    expect(materials.byId('reed')).toMatchObject({ class: 'plant', burnable: true, nextStage: 'reed_thread' });
    for (const id of ['crutch', 'splint']) expect(items.byId(id)?.materials, id).toEqual(['wood', 'bone', 'metal']);
    expect(items.byId('crutch')?.quality).toBe(false);
    expect(items.byId('rope')?.materials).toEqual(['cloth', 'plant', 'leather']);
    expect(items.byId('buckler')?.materials).toEqual(['wood', 'metal', 'plant']);
  });

  it('the carpenter is logs_only, and the Wildwood pays 100% for reed, not the 80% of furniture', () => {
    expect(buildings.byId('carpenter')?.tags).toContain('logs_only');
    expect(preferencePercent(registry, 'wildwood', 'furniture/chain', 'reed', 'plant')).toBe(100);
    expect(preferencePercent(registry, 'wildwood', 'furniture/chain', 'flax_cloth', 'cloth')).toBe(80);
  });
});

describe('T-549 workshops of stone', () => {
  it('a loom of blocks takes 4 blocks for its 2 logs and half as long again; the carpenter and the mason refuse "blocks"', () => {
    const w = new TestWorld({ seed: 't549-loom-job', world: 'flat-test', embark: 'none' });
    expect(STONE_WORKSHOP_TICKS_PERCENT).toBe(150);
    const place = (type: string, x: number): { ok: boolean; reason?: string } =>
      w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin: w.index(x, 15, Z), orientation: 0, materialChoice: 'blocks' });
    expect(place('carpenter', 5)).toEqual({ ok: false, reason: 'not_found' });
    expect(place('mason', 5)).toEqual({ ok: false, reason: 'not_found' });
    expect(place('loom', 10)).toEqual({ ok: true });
    const loom = lastPlaced(w, 'loom');
    expect(w.game.world.entities.get(loom, C.Building)?.settings['ofBlocks']).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'craftdwarf', origin: w.index(15, 15, Z), orientation: 0, materialChoice: 'blocks' })).toEqual({ ok: true });
    const craft = lastPlaced(w, 'craftdwarf');
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'tannery', origin: w.index(20, 15, Z), orientation: 0 })).toEqual({ ok: true });
    const tannery = lastPlaced(w, 'tannery');
    w.step(1);
    const blockType = items.index('stone_block');
    const logType = items.index('log');
    expect(buildJob(w, loom)?.inputs.map((i) => [i.filter.types, i.count])).toEqual([[[blockType], 4]]);
    expect(buildJob(w, loom)?.data['buildTicks']).toBe(300);
    expect(buildJob(w, craft)?.inputs.map((i) => [i.filter.types, i.count])).toEqual([[[items.index('raw_stone')], 1], [[blockType], 2]]);
    expect(buildJob(w, craft)?.data['buildTicks']).toBe(300);
    // Placed as ever, a tannery takes its logs.
    expect(buildJob(w, tannery)?.inputs[0]).toMatchObject({ filter: { types: [logType] }, count: 2 });
    expect(buildJob(w, tannery)?.data['buildTicks']).toBe(buildings.byId('tannery')?.buildTicks);
    // The choice is saved with the building.
    const loaded = roundTrip(w.game).game;
    expect(loaded.world.entities.get(loom, C.Building)?.settings['ofBlocks']).toBe(true);
    expect(loaded.hash()).toBe(w.hash());
  });

  it('end to end: a treeless fortress builds a loom of blocks, spins nettle thread, weaves a basket and splints a leg with bone', () => {
    const w = new TestWorld({ seed: 't549-treeless', world: 'flat-test', embark: 'none' });
    w.spawnItem('stone_block', 'granite', w.index(20, 18, Z), 6);
    w.spawnItem('raw_stone', 'granite', w.index(20, 19, Z), 1);
    const crafter = w.spawnDwarf({ at: w.index(19, 18, Z), skills: { weaving: 4, crafting: 4 } });
    w.setLabor(crafter, 'medicine', false);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'loom', origin: w.index(15, 15, Z), orientation: 0, materialChoice: 'blocks' })).toEqual({ ok: true });
    const loom = lastPlaced(w, 'loom');
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'craftdwarf', origin: w.index(25, 15, Z), orientation: 0, materialChoice: 'blocks' })).toEqual({ ok: true });
    const craft = lastPlaced(w, 'craftdwarf');
    const built = (id: EntityId): boolean => w.game.world.entities.get(id, C.Building)?.state === 'built';
    w.until(() => built(loom) && built(craft), 6000);
    expect(built(loom) && built(craft)).toBe(true);
    expect(units(w, 'stone_block')).toBe(0);
    expect(units(w, 'raw_stone')).toBe(0);
    expect(w.game.world.entities.get(loom, C.Building)?.material).toBe(materials.index('granite'));

    // Coarse thread: two nettle fibers to a thread of nettle, at the loom of stone.
    w.spawnItem('fiber', 'nettle_fiber', w.index(21, 18, Z), 2);
    order(w, loom, 'spin_coarse_thread');
    w.until(() => crafted(w, 'spin_coarse_thread') > 0, 3000);
    expect(units(w, 'thread', 'nettle_thread')).toBe(1);
    expect(units(w, 'fiber')).toBe(0);

    // A basket of three reeds, a bin of 15.
    w.spawnItem('reed', 'reed', w.index(21, 19, Z), 3);
    order(w, craft, 'weave_basket');
    w.until(() => crafted(w, 'weave_basket') > 0, 3000);
    const basket = w.events('ItemCrafted').find((e) => e['recipeId'] === 'weave_basket')?.['itemId'] as EntityId;
    expect(w.readers.of<ItemsReader>('13').containerRecord(basket)).toMatchObject({ capacity: 15, classId: 'bin' });
    expect(w.readers.of<ItemsReader>('13').countAvailable({ emptyContainer: 'bin' })).toBe(1);
    expect(w.game.world.entities.get(basket, C.Item)?.material).toBe(materials.index('reed'));

    // Bone splints, and a medic sets a broken leg with one.
    w.spawnItem('bone_pile', 'bone', w.index(22, 18, Z), 1);
    order(w, craft, 'make_splint_bone');
    w.until(() => crafted(w, 'make_splint_bone') > 0, 3000);
    expect(units(w, 'splint', 'bone')).toBe(2);

    const bed = w.index(40, 40, Z);
    const chest = w.index(41, 40, Z);
    const ward = w.index(40, 41, Z);
    const shelf = w.index(41, 41, Z);
    w.zone('hospital', [bed, chest, ward, shelf]);
    w.build('bed', bed, 'oak');
    w.build('chest', chest, 'oak');
    const medic = w.spawnDwarf({ at: w.index(42, 40, Z) });
    w.setSkill(medic, 'medicine', 20);
    w.setLabor(medic, 'medicine', true);
    const patient = w.spawnDwarf({ at: ward });
    w.setLabor(patient, 'medicine', false);
    w.step(2);
    w.game.world.emit({ type: 'DamageDealt', defenderId: patient, part: 'left_leg', damageType: 'blunt', amount: 15, attackerId: 0 });
    w.until(() => w.events('TreatmentDone').some((e) => e['patientId'] === patient && e['kind'] === 'set_bone'), 3000);
    const fracture = w.game.world.entities.get(patient, C.Body)?.parts.flatMap((p) => p.wounds).find((wnd) => wnd.type === 'fracture');
    expect(fracture?.splinted).toBe(true);
    expect(units(w, 'splint', 'bone')).toBe(1);
  });
});

describe('T-549 the build menu', () => {
  it('a loom offers "of logs" and "of blocks"; the carpenter only logs', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 't549-build-menu', registry: loadContent(),
      createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const tool = game.fortress.build;
    const ctx = game.fortress.ctx;
    tool.choose('w');
    const rows = tool.rows(ctx);
    tool.list.selected = rows.findIndex((r) => r.id === 'carpenter');
    tool.arm();
    expect(tool.materials(ctx).some((m) => m.material === OF_BLOCKS)).toBe(false);
    expect(tool.builtOfText(ctx)).toBeNull();
    tool.disarm();
    tool.list.selected = rows.findIndex((r) => r.id === 'loom');
    tool.arm();
    expect(tool.builtOfText(ctx)).toBe('Of logs: 2 logs, 200 ticks');
    const p = { x: 10, y: 10, z: 0 };
    expect(tool.command(ctx, p)?.['materialChoice']).toBe(0);
    const choices = tool.materials(ctx);
    expect(choices[choices.length - 1]?.material).toBe(OF_BLOCKS);
    for (let k = 1; k < choices.length; k += 1) tool.cycleMaterial(ctx);
    expect(tool.ofBlocks(ctx)).toBe(true);
    expect(tool.builtOfText(ctx)).toBe('Of blocks: 4 blocks, 300 ticks');
    expect(tool.command(ctx, p)?.['materialChoice']).toBe('blocks');
    tool.cycleMaterial(ctx);
    expect(tool.ofBlocks(ctx)).toBe(false);
  });
});
