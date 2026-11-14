/**
 * T-547, Making Do A1: soil that drops a load, fossils, butcher parts, the new minerals' own
 * streams and the pewter preference (`03-terrain-and-mining.md` § Local map generation stage 7,
 * § Tile transitions, § Digging as a job; `09-hunting-gathering-fishing.md` § Butchery;
 * `caravan-goods.md` § Preferences).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SPEC } from '@app/headless';
import { contentRegistry, loadContent } from '@content/loader';
import mineralRows from '@content/minerals.json';
import rowOrderRows from '@content/rowOrder.json';
import { Map3D, TileKind } from '@core/map3d';
import { C } from '@core/components';
import type { Item } from '@core/components';
import type { TileIndex } from '@core/types';
import { butcherParts, type ForagingReader } from '@systems/foraging';
import type { MoraleReader } from '@systems/morale';
import { digDrop, SOIL_DROP_STREAM, TerrainFacts, type TerrainSystem, type TransitionRolls } from '@systems/terrain';
import { generateLocalMap } from '@systems/terrain/generate';
import { preferencePercent } from '@systems/trade/valuation';
import { onlyMiner, rect, stairShaft } from '../scenarios/m1-helpers';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const materials = registry.table('materials');
const facts = new TerrainFacts(registry);
const NEW_MINERALS = ['halite', 'bog_iron', 'giant_bone'];

/** Every item of a type in the world. */
function itemsOf(w: TestWorld, type: string): Item[] {
  const t = registry.table('items').index(type);
  const out: Item[] = [];
  for (const id of w.game.world.entities.with(C.Item)) {
    const item = w.game.world.entities.get(id, C.Item);
    if (item?.type === t) out.push(item);
  }
  return out;
}

function drop(material: string, rolls: Partial<TransitionRolls> = {}): ReturnType<typeof digDrop> {
  const map = new Map3D(3, 3, 3);
  const i = map.index(1, 1, 1);
  map.kind[i] = TileKind.Wall;
  map.material[i] = materials.index(material);
  return digDrop(map, i, facts, { stoneDrops: () => true, logs: () => 1, gather: () => null, logMaterial: () => '', ...rolls });
}

describe('T-547 the dig drops of soil and bone', () => {
  it('a soil tagged soil_drop drops a load of itself on its own roll; other soils roll nothing', () => {
    let rolled = 0;
    const yes = { soilDrops: () => { rolled += 1; return true; } };
    for (const soil of ['clay', 'sand', 'peat']) {
      expect(drop(soil, yes)).toMatchObject({ type: 'soil_load', material: materials.index(soil), count: 1 });
    }
    expect(rolled).toBe(3);
    expect(drop('clay', { soilDrops: () => false })).toBeNull();
    for (const soil of ['loam', 'silt', 'cave_loam']) expect(drop(soil, yes)).toBeNull();
    expect(rolled).toBe(3);
    // Stone draws its own roll, never the soil's.
    expect(drop('granite', yes)).toMatchObject({ type: 'raw_stone' });
    expect(rolled).toBe(3);
  });

  it('a tile of class bone always drops a fossil; rock salt and bog iron drop ore', () => {
    expect(facts.classOf(materials.index('giant_bone'))).toBe('bone');
    expect(drop('giant_bone', { stoneDrops: () => false })).toMatchObject({ type: 'fossil', material: materials.index('giant_bone') });
    expect(drop('halite')).toMatchObject({ type: 'ore', material: materials.index('halite') });
    expect(drop('bog_iron')).toMatchObject({ type: 'ore', material: materials.index('bog_iron') });
  });

  function digRoom(material: string, seed: string): { w: TestWorld; room: TileIndex[]; miner: number } {
    const w = new TestWorld({ seed, world: 'flat-test', embark: 'default' });
    stairShaft(w, 48, 12, 32, 29);
    const miner = onlyMiner(w);
    const room = rect(w, 49, 11, 29, 3, 3);
    for (const t of room) w.carve(t, TileKind.Wall, materials.index(material));
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: room, kind: 'dig', priority: 5 }).ok).toBe(true);
    w.until((v) => room.every((t) => v.map.kindAt(t) === TileKind.Floor), 4000);
    for (const t of room) expect(w.map.kindAt(t)).toBe(TileKind.Floor);
    return { w, room, miner };
  }

  it('a dug clay room leaves loads of clay, and its stream exists only once soil is dug', () => {
    const granite = digRoom('granite', 't547-granite');
    expect(granite.w.game.world.rngState().some((s) => s.id === SOIL_DROP_STREAM)).toBe(false);
    const { w } = digRoom('clay', 't547-clay');
    expect(w.game.world.rngState().some((s) => s.id === SOIL_DROP_STREAM)).toBe(true);
    const loads = itemsOf(w, 'soil_load').reduce((sum, item) => sum + item.count, 0);
    expect(loads).toBeGreaterThan(0);
    expect(loads).toBeLessThan(9);
    for (const item of itemsOf(w, 'soil_load')) expect(item.material).toBe(materials.index('clay'));
  });

  it('the first fossil dug is announced once, with the digger\'s thought, and the flag is saved', () => {
    const { w, room, miner } = digRoom('giant_bone', 't547-fossil');
    const fossils = itemsOf(w, 'fossil');
    expect(fossils.reduce((sum, item) => sum + item.count, 0)).toBe(room.length);
    for (const item of fossils) expect(item.material).toBe(materials.index('giant_bone'));
    expect(w.events('MineralMined')).toHaveLength(room.length);
    expect(w.events('VeinFound')).toHaveLength(0);
    const found = w.events('FossilFound');
    expect(found).toHaveLength(1);
    expect(found[0]?.['dwarfId']).toBe(miner);
    w.step(2);
    expect(w.readers.of<MoraleReader>('15').thoughts(miner).some((t) => t.id === 'first_fossil')).toBe(true);
    const terrain = w.game.world.scheduler.byId('03') as TerrainSystem;
    expect(terrain.serialize().fossilFound).toBe(true);
    const fresh = new TestWorld({ seed: 't547-fossil-2', world: 'flat-test', embark: 'none' });
    expect((fresh.game.world.scheduler.byId('03') as TerrainSystem).serialize().fossilFound).toBeUndefined();
  });
});

describe('T-547 butcher parts', () => {
  const foraging = (): ForagingReader => new TestWorld({ seed: 't547-butcher', world: 'flat-test', embark: 'none' }).readers.of<ForagingReader>('09');

  it('a yak gives two horns, a mammoth two tusks of ivory, a chicken two feathers, a goat one horn', () => {
    const reader = foraging();
    expect(reader.butcherYields('yak').parts).toEqual([{ item: 'horn', material: 'horn', count: 2 }]);
    expect(reader.butcherYields('mammoth').parts).toEqual([{ item: 'tusk', material: 'ivory', count: 2 }]);
    expect(reader.butcherYields('chicken').parts).toEqual([{ item: 'feather', material: 'feather', count: 2 }]);
    expect(reader.butcherYields('goat').parts).toEqual([{ item: 'horn', material: 'horn', count: 1 }]);
    expect(reader.butcherYields('cow').parts).toEqual([]);
  });

  it('a cave crawler gives its bones, its skull and its chitin, and no meat, hide or fat', () => {
    const y = foraging().butcherYields('cave_crawler');
    expect(y).toMatchObject({ meat: 0, hide: 0, fat: 0, bone: 1, skull: 1, shell: 0 });
    expect(y.parts).toEqual([{ item: 'shell_piece', material: 'chitin', count: 2 }]);
  });

  it('a rotten corpse gives none of its parts', () => {
    const yak = registry.table<{ id: string; butcherParts?: { item: string; material: string; count: number }[] }>('creatures').byId('yak');
    expect(butcherParts(yak?.butcherParts, true)).toEqual([]);
    expect(butcherParts(yak?.butcherParts, false)).toHaveLength(1);
  });

  it('a slaughtered yak at the butcher leaves two horns of horn', () => {
    const w = new TestWorld({ seed: 't547-yak', world: 'flat-test', embark: 'none' });
    w.build('butcher', w.index(15, 15, 32));
    const yak = w.spawnTame('yak', w.index(11, 15, 32), { sex: 0 });
    w.spawnDwarf({ at: w.index(14, 15, 32), skills: { butchery: 5 } });
    expect(w.game.world.applyCommand({ type: 'MarkSlaughter', animalId: yak }).ok).toBe(true);
    w.until((v) => v.events('ButcheryDone').length > 0, 3000);
    const horns = itemsOf(w, 'horn');
    expect(horns.reduce((sum, item) => sum + item.count, 0)).toBe(2);
    for (const item of horns) expect(item.material).toBe(materials.index('horn'));
  });
});

describe('T-547 the new minerals draw on streams of their own (03 stage 7)', () => {
  const without = loadContent({
    overrides: {
      minerals: (mineralRows as { id: string }[]).filter((m) => !NEW_MINERALS.includes(m.id)),
      rowOrder: (rowOrderRows as { table: string; id: string }[]).filter((r) =>
        !(r.table === 'minerals' && NEW_MINERALS.includes(r.id)) && !(r.table === 'recipes' && r.id === 'smelt_bog_iron')),
    },
  });

  it('a sedimentary map holds rock salt and fossils, and every other tile is as it was without them', () => {
    const spec = { ...FLAT_TEST_SPEC, seed: 't547-sedimentary', geology: 'sedimentary', traits: [] };
    const a = generateLocalMap(spec, registry).map;
    const b = generateLocalMap(spec, without).map;
    const fresh = new Set(NEW_MINERALS.map((id) => materials.index(id)));
    let placed = 0;
    let differ = 0;
    for (let i = 0; i < a.kind.length; i += 1) {
      if (fresh.has(a.material[i] as number)) {
        placed += 1;
        continue;
      }
      if (a.kind[i] !== b.kind[i] || a.material[i] !== b.material[i] || a.fluid[i] !== b.fluid[i] || a.flags[i] !== b.flags[i]) differ += 1;
    }
    expect(placed).toBeGreaterThan(0);
    expect(differ).toBe(0);
    expect(a.material.some((m) => m === materials.index('giant_bone'))).toBe(true);
  });

  it('an igneous map, which hosts none of them, is the same tile for tile', () => {
    const spec = { ...FLAT_TEST_SPEC, seed: 't547-igneous' };
    const a = generateLocalMap(spec, registry).map;
    const b = generateLocalMap(spec, without).map;
    expect(Array.from(a.material)).toEqual(Array.from(b.material));
    expect(Array.from(a.kind)).toEqual(Array.from(b.kind));
  });
});

describe('T-547 pewter at the Mountainhome', () => {
  it('a material row comes before the category rows, and only for the civilization that has it', () => {
    expect(preferencePercent(registry, 'mountainhome', 'craft/mug', 'pewter', 'metal')).toBe(110);
    expect(preferencePercent(registry, 'mountainhome', 'craft/mug', 'tin', 'metal')).toBe(130);
    expect(preferencePercent(registry, 'hillfolk', 'craft/mug', 'pewter', 'metal')).toBe(100);
  });
});
