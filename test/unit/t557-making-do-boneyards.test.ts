/**
 * T-557, Making Do C1: the boneyards and the bone recipes (`03-terrain-and-mining.md` § Local map
 * generation stage 9b, § Tile transitions, § State; `10-dwarves.md` § Movement; `15` § Thoughts;
 * `20-trade-and-caravans.md` § Valuation; `23-rendering.md` § Compositor; `workshops-and-recipes.md`
 * § Mason, § Craftsdwarf).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_LAYERS, FLAT_TEST_SPEC, HeadlessGame, regionSpec } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import type { Item } from '@core/components';
import { LOCAL_MAP_Z } from '@core/constants';
import { Map3D, TileKind, isSolidBottomed } from '@core/map3d';
import { StateHasher } from '@core/serialize';
import type { TileIndex } from '@core/types';
import { Compositor } from '@render/compositor';
import { Palette } from '@render/palette';
import type { CombatReader } from '@systems/combat';
import { ARRIVAL_SEARCH_DEPTH } from '@systems/embark/constants';
import type { ItemsReader } from '@systems/items';
import type { MoraleReader } from '@systems/morale';
import { TerrainFacts, digDrop, type TerrainReader, type TerrainSystem } from '@systems/terrain';
import {
  BONEYARD_MAX,
  BONEYARD_MIN,
  BONEYARD_WAGON_BAND,
} from '@systems/terrain/constants';
import { generateLocal, generateLocalMap, type LocalMapResult } from '@systems/terrain/generate';
import { preferencePercent } from '@systems/trade/valuation';
import { onlyMiner, rect, stairShaft } from '../scenarios/m1-helpers';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const materials = registry.table('materials');
const BONE = materials.index('giant_bone');
const IVORY = materials.index('ivory');
const FOUR = ['desert', 'badlands', 'wetland', 'tundra'];

/**
 * The local-map hash of `t557-<biome>` at reliefs 0 and 2 before T-557, as `world-hashes.test.ts`
 * hashes a local map. Every biome but the four keeps it: the boneyards draw nothing on its map.
 */
const BEFORE: Readonly<Record<string, string>> = {
  'alpine|0': 'e37f3665fc016d9f', 'alpine|2': '88eeb57840fef02e',
  'badlands|0': 'ef1cd00f8add33a9', 'badlands|2': '9a821cb3eb73e3f9',
  'cold_steppe|0': 'e3e078dedabe94d6', 'cold_steppe|2': '5312fee4baf18596',
  'dark_forest|0': 'ceeba2bb808069f0', 'dark_forest|2': 'd93e1db1c0f499ea',
  'desert|0': 'f8a43d20f9e993d0', 'desert|2': '8505649073d8b4da',
  'glacier|0': '7e523fe98ceea27b', 'glacier|2': 'ab2a5c5264823d58',
  'mountain|0': '4b6ee9003782398a', 'mountain|2': '7877b589fa31a857',
  'savanna|0': '442595e3cf9dd90c', 'savanna|2': '0c6a895ddf06a00c',
  'taiga|0': '6d794a3a143a54ff', 'taiga|2': 'a95bbef52085aada',
  'temperate_forest|0': 'a1e24bcd6baa4881', 'temperate_forest|2': 'afd961f5a17cb1f7',
  'temperate_grassland|0': 'cb5b52684975ad4c', 'temperate_grassland|2': 'dc529f89ce23886b',
  'temperate_hills|0': '20a6637ac261b3e0', 'temperate_hills|2': '6c55577f75843bb1',
  'tropical_forest|0': '01930f68ced58b58', 'tropical_forest|2': '109dd102b423f02e',
  'tundra|0': 'fe1a5b78a432e52c', 'tundra|2': 'bc35dce2d99cf62c',
  'wetland|0': '8469ea30175f4320', 'wetland|2': '83bb054052734434',
};

function spec(biome: string, relief: 0 | 2): ReturnType<typeof regionSpec> {
  return regionSpec(`t557-${biome}`, { biome, relief, traits: [] });
}

function hashOf(map: Map3D, result: LocalMapResult): string {
  const h = new StateHasher();
  h.array(map.kind).array(map.material).array(map.fluid).array(map.flags);
  h.value(result.layerStack).value(result.spawns).value(result.warmSprings).value(result.sinks).value(result.waterSources);
  return h.digest();
}

function inward(s: ReturnType<typeof spec>, map: Map3D, i: TileIndex): number {
  const x = map.xOf(i);
  const y = map.yOf(i);
  const e = s.arrivalEdge;
  return e === 'n' ? y : e === 's' ? map.h - 1 - y : e === 'w' ? x : map.w - 1 - x;
}

describe('T-557 stage 9b draws on its own stream, only in the four biomes', () => {
  it('the wagon band the skeletons keep out of is 02\'s arrival search depth', () => {
    expect(BONEYARD_WAGON_BAND).toBe(ARRIVAL_SEARCH_DEPTH);
  });

  for (const key of Object.keys(BEFORE)) {
    const [biome, relief] = key.split('|') as [string, string];
    const four = FOUR.includes(biome);
    it(`${biome} at relief ${relief}: ${four ? 'the map moves' : 'the map is the map it was'}`, () => {
      const s = spec(biome, Number(relief) as 0 | 2);
      const { map, result } = generateLocalMap(s, registry);
      if (four) expect(hashOf(map, result)).not.toBe(BEFORE[key]);
      else {
        expect(hashOf(map, result)).toBe(BEFORE[key]);
        expect(result.boneyards).toEqual([]);
        expect(result.giantSkulls).toEqual([]);
      }
    });
  }
});

describe('T-557 the skeletons (03 stage 9b)', () => {
  for (const biome of FOUR) {
    for (const relief of [0, 2] as const) {
      it(`${biome} at relief ${relief}: one to three skeletons of bone, out of the wagon band, with their skulls and cages`, () => {
        const s = spec(biome, relief);
        const { map, result } = generateLocalMap(s, registry);
        expect(result.boneyards.length).toBeGreaterThanOrEqual(BONEYARD_MIN);
        expect(result.boneyards.length).toBeLessThanOrEqual(BONEYARD_MAX);
        expect(result.giantSkulls.length).toBeGreaterThanOrEqual(1);
        expect(result.giantSkulls.length).toBeLessThanOrEqual(result.boneyards.length);
        // The surface's bone: boulders (the spine) and walls (ribs and skull), all beyond the wagon band.
        let boulders = 0;
        let walls = 0;
        let ivory = 0;
        for (let y = 0; y < map.h; y += 1) {
          for (let x = 0; x < map.w; x += 1) {
            const i = map.index(x, y, result.surface[y * map.w + x] as number);
            const m = map.materialAt(i);
            if (m !== BONE && m !== IVORY) continue;
            if (map.kindAt(i) === TileKind.Boulder) boulders += 1;
            if (map.kindAt(i) === TileKind.Wall) walls += 1;
            if (m === IVORY) ivory += 1;
            expect(inward(s, map, i)).toBeGreaterThan(BONEYARD_WAGON_BAND);
            expect(map.fluidLevelAt(i)).toBe(0);
          }
        }
        expect(boulders).toBeGreaterThanOrEqual(4 * result.boneyards.length);
        expect(walls).toBeGreaterThanOrEqual(4 * result.boneyards.length);
        // Tusks of ivory in the tundra only, never more than two a skull.
        if (biome === 'tundra') expect(ivory).toBeGreaterThan(0);
        else expect(ivory).toBe(0);
        expect(ivory).toBeLessThanOrEqual(2 * result.giantSkulls.length);
        for (const group of result.giantSkulls) {
          expect(group.length).toBeGreaterThan(0);
          expect(group.length).toBeLessThanOrEqual(4);
          expect([...group].sort((a, b) => a - b)).toEqual(group);
          for (const t of group) {
            expect(map.kindAt(t)).toBe(TileKind.Wall);
            expect([BONE, IVORY]).toContain(map.materialAt(t));
          }
        }
        // The cages: walkable, dry, ascending, and each beside a bone boulder of its spine.
        for (const cage of result.boneyards) {
          expect([...cage].sort((a, b) => a - b)).toEqual(cage);
          for (const t of cage) {
            expect(isSolidBottomed(map.kindAt(t))).toBe(true);
            expect(map.fluidLevelAt(t)).toBe(0);
          }
        }
        expect(result.boneyards.some((cage) => cage.length > 0)).toBe(true);
      });
    }
  }

  it('the same spec lays the same skeletons', () => {
    const a = generateLocalMap(spec('desert', 2), registry);
    const b = generateLocalMap(spec('desert', 2), registry);
    expect(a.result.boneyards).toEqual(b.result.boneyards);
    expect(a.result.giantSkulls).toEqual(b.result.giantSkulls);
    expect(hashOf(a.map, a.result)).toBe(hashOf(b.map, b.result));
  });

  it('a map too small for a start lays none', () => {
    const s = spec('desert', 0);
    const map = new Map3D(20, 20, LOCAL_MAP_Z);
    const result = generateLocal(s, map, registry);
    expect(result.boneyards).toEqual([]);
  });
});

describe('T-557 standing in the ribs (10 § Movement, 15 § Thoughts)', () => {
  it('the first dwarf in each boneyard\'s ribs is noted once and is proud; the record is saved', () => {
    // A desert map at full size with its boneyards, and a soldier walked into the first cage.
    const s = spec('desert', 0);
    const map = new Map3D(96, 96, LOCAL_MAP_Z);
    const local = generateLocal(s, map, registry);
    const w = new TestWorld({ seed: 't557-ribs', registry, map, spec: s, embark: 'none',
      systems: HeadlessGame.standardSystems(s, local.layerStack, local) });
    const terrain = w.readers.of<TerrainReader>('03');
    const cage = local.boneyards.findIndex((c) => c.length > 0);
    const target = local.boneyards[cage]?.[0] as TileIndex;
    expect(terrain.boneyardAt(target)).toBe(cage);
    expect(terrain.boneyardEntered(cage)).toBe(false);
    // Two dwarves on a clear tile near the cage, one level up or down at most, then walked in.
    const near = (): TileIndex => {
      const x0 = map.xOf(target);
      const y0 = map.yOf(target);
      for (let r = 3; r < 12; r += 1) {
        for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = x0 + dx;
          const y = y0 + dy;
          const i = map.index(x, y, local.surface[y * map.w + x] as number);
          if (map.kindAt(i) === TileKind.Floor && map.fluidLevelAt(i) === 0 && terrain.boneyardAt(i) < 0) return i;
        }
      }
      throw new Error('no tile near the cage');
    };
    const start = near();
    const first = w.spawnDwarf({ at: start });
    const second = w.spawnDwarf({ at: start });
    const apply = (c: Parameters<typeof w.game.world.applyCommand>[0]): ReturnType<typeof w.game.world.applyCommand> => w.game.world.applyCommand(c);
    expect(apply({ type: 'CreateSquad', name: 'Bonewalkers' }).ok).toBe(true);
    const squad = w.readers.of<CombatReader>('16').squads()[0]!.id;
    expect(apply({ type: 'SetSquadMembers', squadId: squad, members: [first] }).ok).toBe(true);
    expect(apply({ type: 'SetSquadStation', squadId: squad, tile: target }).ok).toBe(true);
    expect(apply({ type: 'SetSquadMode', squadId: squad, mode: 'active' }).ok).toBe(true);
    w.until((v) => v.events('RibsEntered').length > 0, 600);
    expect(w.events('RibsEntered')[0]).toEqual(expect.objectContaining({ id: first, boneyard: cage }));
    w.step(2);
    expect(w.readers.of<MoraleReader>('15').thoughts(first).some((t) => t.id === 'stood_in_the_ribs')).toBe(true);
    expect(terrain.boneyardEntered(cage)).toBe(true);
    const saved = (w.game.world.scheduler.byId('03') as TerrainSystem).serialize();
    expect(saved.boneyards).toEqual(local.boneyards);
    expect(saved.giantSkulls).toEqual(local.giantSkulls);
    expect(saved.boneyardsEntered?.[cage]).toBe(true);
    const before = w.game.hash();
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(before);
    w.replaceGame(loaded);
    // The first walks out; the second walks in on its own squad: no second note for the same skeleton.
    const count = w.events('RibsEntered').length;
    const tile = (id: number): TileIndex => {
      const p = w.game.world.entities.get(id, C.Position)!;
      return map.index(p.x, p.y, p.z);
    };
    expect(apply({ type: 'SetSquadStation', squadId: squad, tile: start }).ok).toBe(true);
    w.until((v) => v.readers.of<TerrainReader>('03').boneyardAt(tile(first)) < 0, 600);
    expect(apply({ type: 'CreateSquad', name: 'Latecomers' }).ok).toBe(true);
    const late = w.readers.of<CombatReader>('16').squads()[1]!.id;
    expect(apply({ type: 'SetSquadMembers', squadId: late, members: [second] }).ok).toBe(true);
    expect(apply({ type: 'SetSquadStation', squadId: late, tile: target }).ok).toBe(true);
    expect(apply({ type: 'SetSquadMode', squadId: late, mode: 'active' }).ok).toBe(true);
    w.until(() => tile(second) === target, 600);
    w.step(5);
    expect(w.events('RibsEntered').slice(count).filter((e) => e['boneyard'] === cage)).toHaveLength(0);
  });
});

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

describe('T-557 digging a skeleton (03 § Tile transitions)', () => {
  it('a dug ivory tile drops a tusk, a dug bone tile a fossil', () => {
    const facts = new TerrainFacts(registry);
    const map = new Map3D(3, 3, 3);
    const i = map.index(1, 1, 1);
    map.kind[i] = TileKind.Wall;
    const rolls = { stoneDrops: () => false, logs: () => 1, gather: () => null, logMaterial: () => '' };
    map.material[i] = IVORY;
    expect(digDrop(map, i, facts, rolls)).toMatchObject({ type: 'tusk', material: IVORY, count: 1 });
    map.material[i] = BONE;
    expect(digDrop(map, i, facts, rolls)).toMatchObject({ type: 'fossil', material: BONE, count: 1 });
  });

  it('the skull drops one giant skull, from its last tile dug, beside the fossils and tusks', () => {
    const w0 = new TestWorld({ seed: 't557-skull-probe', world: 'flat-test', embark: 'none' });
    const skull = rect(w0, 49, 11, 29, 2, 2);
    const w = new TestWorld({ seed: 't557-skull', world: 'flat-test', embark: 'default',
      systems: HeadlessGame.standardSystems(FLAT_TEST_SPEC, FLAT_TEST_LAYERS, { sinks: [], warmSprings: [], giantSkulls: [skull] }) });
    stairShaft(w, 48, 12, 32, 29);
    onlyMiner(w);
    const [a, b, c, d] = skull as [TileIndex, TileIndex, TileIndex, TileIndex];
    w.carve(a, TileKind.Wall, BONE);
    w.carve(b, TileKind.Wall, BONE);
    w.carve(c, TileKind.Wall, IVORY);
    w.carve(d, TileKind.Wall, IVORY);
    // Three of the four dug: no skull yet.
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [a, b, c], kind: 'dig', priority: 5 }).ok).toBe(true);
    w.until((v) => [a, b, c].every((t) => v.map.kindAt(t) === TileKind.Floor), 4000);
    expect(itemsOf(w, 'giant_skull')).toHaveLength(0);
    expect((w.game.world.scheduler.byId('03') as TerrainSystem).serialize().giantSkulls).toEqual([skull]);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [d], kind: 'dig', priority: 5 }).ok).toBe(true);
    w.until((v) => v.map.kindAt(d) === TileKind.Floor, 4000);
    const skulls = itemsOf(w, 'giant_skull');
    expect(skulls).toHaveLength(1);
    expect(skulls[0]?.material).toBe(BONE);
    expect(itemsOf(w, 'fossil').reduce((n, it) => n + it.count, 0)).toBe(2);
    expect(itemsOf(w, 'tusk').reduce((n, it) => n + it.count, 0)).toBe(2);
    for (const tusk of itemsOf(w, 'tusk')) expect(tusk.material).toBe(IVORY);
    // The group is done: it leaves the saved list.
    expect((w.game.world.scheduler.byId('03') as TerrainSystem).serialize().giantSkulls).toBeUndefined();
  });
});

describe('T-557 the bone recipes (workshops-and-recipes.md § Mason, § Craftsdwarf)', () => {
  function make(workshop: string, skill: string, recipeId: string, inputs: readonly [string, string, number][]): Item {
    const w = new TestWorld({ seed: `t557-${recipeId}`, world: 'flat-test', embark: 'none' });
    const shop = w.build(workshop, w.index(15, 15, 32));
    w.spawnDwarf({ at: w.index(19, 18, 32), skills: { [skill]: 4 } });
    for (const [type, material, count] of inputs) for (let k = 0; k < count; k += 1) w.spawnItem(type, material, w.index(18, 17, 32));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: shop,
      order: { recipeId, mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    w.until(() => w.events('ItemCrafted').some((e) => e['recipeId'] === recipeId), 4000);
    const made = w.events('ItemCrafted').find((e) => e['recipeId'] === recipeId)!;
    return w.readers.of<ItemsReader>('13').get(made['itemId'] as number)!;
  }

  it('the mason mounts a giant skull as a statue of bone', () => {
    const statue = make('mason', 'masonry', 'mount_skull', [['giant_skull', 'giant_bone', 1]]);
    expect(registry.table('items').byIndex(statue.type)?.id).toBe('statue');
    expect(statue.material).toBe(BONE);
  });

  it('the craftsdwarf carves a fossil into a figurine of bone', () => {
    const figurine = make('craftdwarf', 'crafting', 'carve_fossil', [['fossil', 'giant_bone', 1]]);
    expect(registry.table('items').byIndex(figurine.type)?.id).toBe('figurine');
    expect(figurine.material).toBe(BONE);
  });

  it('the mason cuts a fossil into two blocks of bone', () => {
    const block = make('mason', 'masonry', 'cut_bone_blocks', [['fossil', 'giant_bone', 1]]);
    expect(registry.table('items').byIndex(block.type)?.id).toBe('stone_block');
    expect(block.material).toBe(BONE);
  });

  it('bone furniture and statues are allowed materials; the giant skull is never sold', () => {
    const items = registry.table<{ id: string; materials: string[] | 'any' }>('items');
    for (const id of ['table', 'chair', 'door', 'coffin', 'statue']) expect(items.byId(id)?.materials).toContain('bone');
    expect(items.byId('giant_skull')).toMatchObject({ category: 'textile/skull', stack: 1 });
  });
});

describe('T-557 carved fossils at the Mountainhome (caravan-goods.md § Preferences)', () => {
  it('a craft of giant bone is worth 150% to the Mountainhome, before any other row', () => {
    expect(preferencePercent(registry, 'mountainhome', 'craft/figurine', 'giant_bone', 'bone')).toBe(150);
    // A craft of other bone, and a block of giant bone, are judged as before.
    expect(preferencePercent(registry, 'mountainhome', 'craft/figurine', 'bone', 'bone')).toBe(130);
    expect(preferencePercent(registry, 'mountainhome', 'stone/block', 'giant_bone', 'bone')).toBe(60);
    expect(preferencePercent(registry, 'hillfolk', 'craft/figurine', 'giant_bone', 'bone')).toBe(100);
    expect(preferencePercent(registry, 'wildwood', 'craft/figurine', 'giant_bone', 'bone')).toBe(60);
  });
});

describe('T-557 bone on the map (23 § Compositor)', () => {
  it('a boulder of bone draws a bullet, a boulder of stone a ring; a rib is a rough wall', () => {
    const compositor = new Compositor({ registry, palette: new Palette(registry) });
    const w = new TestWorld({ seed: 't557-glyph', world: 'flat-test', embark: 'none' });
    const i = w.index(10, 10, 32);
    const cell = (kind: TileKind, material: string): number => {
      w.carve(i, kind, materials.index(material));
      return compositor.terrainCell(w.readers.map, i).glyph;
    };
    expect(cell(TileKind.Boulder, 'giant_bone')).not.toBe(cell(TileKind.Boulder, 'granite'));
    expect(cell(TileKind.Boulder, 'giant_bone')).toBe(cell(TileKind.Boulder, 'ivory'));
    expect(cell(TileKind.Wall, 'giant_bone')).toBe(cell(TileKind.Wall, 'granite'));
  });
});

describe('T-557 the reader on a map with no boneyard', () => {
  it('no tile is in a boneyard and nothing is saved', () => {
    const w = new TestWorld({ seed: 't557-none', world: 'flat-test', embark: 'none' });
    expect(w.readers.of<TerrainReader>('03').boneyardAt(w.index(10, 10, 32))).toBe(-1);
    const saved = (w.game.world.scheduler.byId('03') as TerrainSystem).serialize();
    expect(saved.boneyards).toBeUndefined();
    expect(saved.giantSkulls).toBeUndefined();
    expect(saved.boneyardsEntered).toBeUndefined();
  });
});
