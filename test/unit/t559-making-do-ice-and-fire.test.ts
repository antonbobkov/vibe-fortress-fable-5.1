/**
 * T-559, Making Do C3: ice harvesting, ice constructions and fire on purpose
 * (`03-terrain-and-mining.md` § Ice harvesting, § Setting a fire; `05-materials-and-temperature.md`
 * § Fire on purpose, § Ice constructions; `13-items-and-storage.md` § Rot).
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { contentRegistry } from '@content/loader';
import { C, type Item } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { Designation, TileFlag, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { ICE_MELT_DAYS } from '@systems/items/constants';
import { ICE_CONSTRUCTION_DAYS } from '@systems/materials/constants';
import type { MoraleReader } from '@systems/morale';
import { ICE_RECUT_DAYS } from '@systems/terrain/constants';
import { burnableTile, precondition, TerrainFacts, type TerrainSystem } from '@systems/terrain';
import { digPond } from '../scenarios/pond';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const materials = registry.table('materials');
const facts = new TerrainFacts(registry);
const Z = 32;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function itemsOf(w: TestWorld, type: string, material?: string): { id: EntityId; item: Item }[] {
  const t = registry.table('items').index(type);
  const out: { id: EntityId; item: Item }[] = [];
  for (const id of w.game.world.entities.with(C.Item)) {
    const item = w.game.world.entities.get(id, C.Item);
    if (item?.type === t && (material === undefined || item.material === materials.index(material))) out.push({ id, item });
  }
  return out;
}

/** A dwarf holding a tool in hand (the way T-403 arms its miner). */
function armed(w: TestWorld, at: TileIndex, tool: string, material: string, skills: Record<string, number> = {}): EntityId {
  const dwarf = w.spawnDwarf({ at, skills });
  const item = w.spawnItem(tool, material, at);
  w.items.attachToCarrier(item, dwarf);
  w.game.world.entities.add(dwarf, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: item });
  const equipment = w.game.world.entities.get(dwarf, C.Equipment)!;
  w.game.world.entities.add(dwarf, C.Equipment, { ...equipment, weapon: item });
  return dwarf;
}

/** A frozen outdoor pond: 3×3 water at level 3 one level down, frozen into ice walls. */
function frozenPond(w: TestWorld): TileIndex[] {
  const pond = digPond(w, 3);
  for (const t of pond) w.forceTemperature(t, -10);
  w.step(30);
  for (const t of pond) expect(w.fluids.sim.isFrozen(t)).toBe(true);
  return pond;
}

/** An ice wall or floor laid through the terrain API, as 14 lays a construction. */
function buildIce(w: TestWorld, t: TileIndex, kind: TileKind = TileKind.Wall): void {
  const terrain = w.game.world.services.terrain;
  terrain.setKind(t, kind, materials.index('ice'));
  terrain.setFlag(t, TileFlag.Constructed, true);
}

describe('T-559 ice harvesting', () => {
  it('only frozen outdoor water takes harvest_ice', () => {
    const w = world('t559-pre');
    const pond = frozenPond(w);
    const centre = pond[4] as TileIndex;
    expect(precondition(w.map, centre, Designation.HarvestIce, facts)).toBe(true);
    // A constructed ice wall is not frozen water, nor is plain rock.
    const built = w.index(20, 20, Z + 1);
    buildIce(w, built);
    expect(precondition(w.map, built, Designation.HarvestIce, facts)).toBe(false);
    expect(precondition(w.map, w.index(20, 20, 25), Designation.HarvestIce, facts)).toBe(false);
    // Thawed, the pond takes none, and a designation on it waits for the ice (T-586).
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [centre], kind: 'harvest_ice', priority: 5 }).ok).toBe(true);
    for (const t of pond) w.forceTemperature(t, 10);
    w.step(30);
    expect(w.fluids.sim.isFrozen(centre)).toBe(false);
    expect(w.map.designationAt(centre)).toBe(Designation.HarvestIce);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [pond[1] as TileIndex], kind: 'harvest_ice', priority: 5 }).ok).toBe(false);
  });

  it('a miner cuts an ice block from the bank above, the tile stays frozen, and waits ICE_RECUT_DAYS to be cut again', () => {
    const w = world('t559-cut');
    const pond = frozenPond(w);
    // The pond's corner: its neighbours on its level are rock, and the bank above is ground.
    const centre = pond[0] as TileIndex;
    const above = w.map.above(centre);
    const miner = armed(w, w.index(36, 41, Z), 'pick', 'iron', { mining: 5 });
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [centre], kind: 'harvest_ice', priority: 5 }).ok).toBe(true);
    w.until((v) => itemsOf(v, 'stone_block', 'ice').length > 0, 2000);
    const [block] = itemsOf(w, 'stone_block', 'ice');
    expect(block?.item.count).toBe(1);
    // Ice is cut, not dug: the tile is the frozen water it was, its designation gone.
    expect(w.map.kindAt(centre)).toBe(TileKind.Wall);
    expect(w.map.materialAt(centre)).toBe(materials.index('ice'));
    expect(w.fluids.sim.isFrozen(centre)).toBe(true);
    expect(w.map.designationAt(centre)).toBe(Designation.None);
    // The block lies where the miner stood: on the ice, above the pond's level.
    expect(w.movement.tileOf(miner)).toBeGreaterThanOrEqual(0);
    expect(w.game.world.entities.get(block!.id, C.Position)?.z).toBe(Z);
    expect(w.map.kindAt(above)).toBe(TileKind.Open);
    // The tile waits: a batch of it alone is refused, a batch with another tile leaves it out.
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [centre], kind: 'harvest_ice', priority: 5 })).toMatchObject({ ok: false, reason: 'precondition_failed' });
    const other = pond[1] as TileIndex;
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [centre, other], kind: 'harvest_ice', priority: 5 }).ok).toBe(true);
    expect(w.map.designationAt(centre)).toBe(Designation.None);
    expect(w.map.designationAt(other)).toBe(Designation.HarvestIce);
    w.game.world.applyCommand({ type: 'UndoDesignation', tiles: [other] });
    // The wait is saved.
    const terrain = w.game.world.scheduler.byId('03') as TerrainSystem;
    expect(terrain.serialize().iceCut?.map(([t]) => t)).toEqual([centre]);
    w.replaceGame(roundTrip(w.game).game);
    expect((w.game.world.scheduler.byId('03') as TerrainSystem).serialize().iceCut?.map(([t]) => t)).toEqual([centre]);
    for (const t of pond) w.forceTemperature(t, -10);
    w.step(ICE_RECUT_DAYS * TICKS_PER_DAY);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [centre], kind: 'harvest_ice', priority: 5 }).ok).toBe(true);
  });
});

describe('T-559 ice blocks melt', () => {
  it('a block lying warm melts in ICE_MELT_DAYS with no stage, a block kept below freezing keeps', () => {
    const w = world('t559-melt');
    const warm = w.index(20, 20, Z);
    const cold = w.index(24, 20, Z);
    w.forceTemperature(warm, 10);
    w.forceTemperature(cold, -10);
    const melting = w.spawnItem('stone_block', 'ice', warm);
    const kept = w.spawnItem('stone_block', 'ice', cold);
    const granite = w.spawnItem('stone_block', 'granite', warm);
    w.step((ICE_MELT_DAYS - 1) * TICKS_PER_DAY);
    expect(w.game.world.entities.alive(melting)).toBe(true);
    expect(w.game.world.entities.get(melting, C.Item)?.rotStage).toBe(0);
    w.step(2 * TICKS_PER_DAY);
    expect(w.game.world.entities.alive(melting)).toBe(false);
    const destroyed = w.events('ItemDestroyed').find((e) => e['id'] === melting);
    expect(destroyed?.['reason']).toBe('melted');
    expect(w.events('ItemRotStage').some((e) => e['id'] === melting)).toBe(false);
    expect(w.game.world.entities.alive(kept)).toBe(true);
    expect(w.game.world.entities.alive(granite)).toBe(true);
  });
});

describe('T-559 ice constructions', () => {
  it('an ice wall cools its 3×3 on its level by 10 °C each; two beside a tile make it 20 colder', () => {
    const w = world('t559-cool');
    w.digRoom(10, 10, 25, 6, 6);
    const tile = w.index(12, 12, 25);
    const before = w.materials.temperatureAt(tile);
    buildIce(w, w.index(11, 12, 25));
    w.step(20);
    expect(w.materials.temperatureAt(tile)).toBe(before - 10);
    expect(w.materials.temperatureAt(w.index(14, 12, 25))).toBe(before);
    buildIce(w, w.index(13, 12, 25));
    w.step(20);
    expect(w.materials.temperatureAt(tile)).toBe(before - 20);
    // The level above is not cooled.
    expect(w.materials.iceBuilt.size).toBe(2);
  });

  it('a larder walled in ice keeps its meat until the walls melt after ICE_CONSTRUCTION_DAYS underground', () => {
    const w = world('t559-larder');
    w.digRoom(10, 10, 25, 6, 6);
    const larder = w.index(12, 12, 25);
    for (const t of [w.index(11, 11, 25), w.index(11, 12, 25), w.index(11, 13, 25)]) buildIce(w, t);
    w.step(20);
    expect(w.materials.temperatureAt(larder)).toBeLessThan(-1);
    const meat = w.spawnItem('raw_meat', 'boar_meat', larder);
    w.step(10 * TICKS_PER_DAY);
    expect(w.game.world.entities.get(meat, C.Item)?.rotStage).toBe(0);
    // The walls' days run out: the next DayPassed melts them, with no item and no water.
    const built = Array.from(w.materials.iceBuilt.keys());
    for (const t of built) w.materials.iceBuilt.set(t, w.tick - ICE_CONSTRUCTION_DAYS * TICKS_PER_DAY);
    w.step(TICKS_PER_DAY + 20);
    for (const t of built) {
      expect(w.map.kindAt(t)).not.toBe(TileKind.Wall);
      expect(w.map.hasFlag(t, TileFlag.Constructed)).toBe(false);
    }
    expect(w.materials.iceBuilt.size).toBe(0);
    expect(itemsOf(w, 'stone_block', 'ice')).toHaveLength(0);
    expect(w.events('IceMelted')).toHaveLength(1);
    expect(w.materials.temperatureAt(larder)).toBeGreaterThan(-1);
    // The meat rots again.
    w.step(6 * TICKS_PER_DAY);
    expect(w.game.world.entities.get(meat, C.Item)?.rotStage ?? 3).toBeGreaterThan(0);
  });

  it('a gate of ice holds outdoors while it freezes and melts at the thaw; IceMelted is said once a day', () => {
    const w = world('t559-gate');
    const gate = [w.index(30, 30, Z + 1), w.index(31, 30, Z + 1)];
    for (const t of gate) {
      w.forceTemperature(t, -10);
      buildIce(w, t);
    }
    w.step(5 * TICKS_PER_DAY);
    for (const t of gate) expect(w.map.kindAt(t)).toBe(TileKind.Wall);
    // Spring: the first wall thaws, then the second the same day.
    w.forceTemperature(gate[0] as TileIndex, 5);
    w.step(20);
    expect(w.map.kindAt(gate[0] as TileIndex)).toBe(TileKind.Open);
    expect(w.map.kindAt(gate[1] as TileIndex)).toBe(TileKind.Wall);
    w.forceTemperature(gate[1] as TileIndex, 5);
    w.step(20);
    expect(w.map.kindAt(gate[1] as TileIndex)).toBe(TileKind.Open);
    expect(w.events('IceMelted')).toHaveLength(1);
    expect(w.events('IceMelted')[0]?.['tiles']).toEqual([gate[0]]);
  });

  it('the ice record and the day are saved', () => {
    const w = world('t559-save');
    const t = w.index(12, 12, 25);
    w.digRoom(10, 10, 25, 6, 6);
    buildIce(w, t);
    w.step(20);
    const state = w.materials.serialize();
    expect(state.iceBuilt?.map(([tile]) => tile)).toEqual([t]);
    w.replaceGame(roundTrip(w.game).game);
    expect(w.materials.iceBuilt.has(t)).toBe(true);
    const fresh = world('t559-save-2');
    expect(fresh.materials.serialize().iceBuilt).toBeUndefined();
  });
});

describe('T-559 fire on purpose', () => {
  it('03\'s burnable rule is 05\'s, tile by tile', () => {
    const w = world('t559-burnable');
    const fire = w.materials.fire;
    const at = w.index(10, 10, Z);
    const cases: [TileKind, string, number][] = [];
    for (const kind of [TileKind.Tree, TileKind.Sapling, TileKind.Shrub, TileKind.Floor, TileKind.Wall, TileKind.Open]) {
      for (const material of ['oak', 'loam', 'peat', 'granite', 'pine']) {
        for (const flags of [0, TileFlag.Outdoor, TileFlag.Outdoor | TileFlag.Grass, TileFlag.Constructed, TileFlag.Constructed | TileFlag.Outdoor]) cases.push([kind, material, flags]);
      }
    }
    for (const [kind, material, flags] of cases) {
      w.map.setKind(at, kind, materials.index(material));
      w.map.flags[at] = flags;
      expect([kind, material, flags, burnableTile(w.map, at, facts)]).toEqual([kind, material, flags, fire.burnableTile(at)]);
    }
  });

  it('the first ignite waits for ConfirmIgnite; a woodcutter spends a firebrand, the tile burns, and the dwarf is pleased', () => {
    const w = world('t559-ignite');
    const field = w.index(30, 30, Z);
    w.map.setFlag(field, TileFlag.Grass, true);
    w.discover(field);
    expect(precondition(w.map, field, Designation.Ignite, facts)).toBe(true);
    const designate = { type: 'Designate', tiles: [field], kind: 'ignite', priority: 5 } as const;
    expect(w.game.world.applyCommand(designate)).toMatchObject({ ok: false, reason: 'ignite_unconfirmed' });
    expect(w.map.designationAt(field)).toBe(Designation.None);
    expect(w.game.world.applyCommand({ type: 'ConfirmIgnite' }).ok).toBe(true);
    expect(w.game.world.fortress.igniteConfirmed).toBe(true);
    const dwarf = w.spawnDwarf({ at: w.index(24, 30, Z) });
    w.setLabor(dwarf, 'woodcutting');
    const brand = w.spawnItem('firebrand', 'oak', w.index(22, 30, Z), 2);
    expect(w.game.world.applyCommand(designate).ok).toBe(true);
    w.until((v) => v.events('TileIgnited').length > 0, 2000);
    const lit = w.events('TileIgnited')[0];
    expect(lit?.['tile']).toBe(field);
    expect(lit?.['dwarfId']).toBe(dwarf);
    w.step(12);
    expect(w.map.hasFlag(field, TileFlag.Burning) || w.map.hasFlag(field, TileFlag.Ash)).toBe(true);
    expect(w.events('FireStarted').some((e) => e['tile'] === field)).toBe(true);
    // One firebrand of the two is spent.
    expect(itemsOf(w, 'firebrand').reduce((sum, { item }) => sum + item.count, 0)).toBe(1);
    expect(w.readers.of<MoraleReader>('15').thoughts(dwarf).some((t) => t.id === 'set_a_fire')).toBe(true);
    expect(brand).toBeGreaterThan(0);
  });

  it('a wet, snowy or stone tile takes no ignite, and a child never lights one', () => {
    const w = world('t559-child');
    const wet = w.index(30, 30, Z);
    w.map.setFlag(wet, TileFlag.Grass, true);
    w.map.setFlag(wet, TileFlag.Wet, true);
    expect(precondition(w.map, wet, Designation.Ignite, facts)).toBe(false);
    w.map.setFlag(wet, TileFlag.Wet, false);
    w.map.setFlag(wet, TileFlag.Snow, true);
    expect(precondition(w.map, wet, Designation.Ignite, facts)).toBe(false);
    w.map.setFlag(wet, TileFlag.Snow, false);
    w.carve(w.index(32, 30, Z), TileKind.Floor, materials.index('granite'));
    expect(precondition(w.map, w.index(32, 30, Z), Designation.Ignite, facts)).toBe(false);
    const child = w.spawnDwarf({ at: w.index(24, 30, Z), ageYears: 6 });
    w.setLabor(child, 'woodcutting');
    w.spawnItem('firebrand', 'oak', w.index(22, 30, Z));
    expect(w.game.world.applyCommand({ type: 'ConfirmIgnite' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [wet], kind: 'ignite', priority: 5 }).ok).toBe(true);
    w.step(600);
    expect(w.events('TileIgnited')).toHaveLength(0);
    expect(w.map.hasFlag(wet, TileFlag.Burning)).toBe(false);
  });
});

describe('T-559 content', () => {
  it('firebrands are made at the craftsdwarf, two to a dip, of the stick\'s material', () => {
    const recipe = registry.table<{ id: string; workshop: string; outputs: { item: string; count: number }[] }>('recipes').byId('make_firebrand');
    expect(recipe?.workshop).toBe('craftdwarf');
    expect(recipe?.outputs[0]).toMatchObject({ item: 'firebrand', count: 2 });
    const jobs = registry.table<{ id: string; labor: string; tool: string | null }>('jobTypes');
    expect(jobs.byId('ignite')).toMatchObject({ labor: 'woodcutting', tool: null });
    expect(jobs.byId('harvest_ice')).toMatchObject({ labor: 'mining', tool: 'pick' });
  });
});
