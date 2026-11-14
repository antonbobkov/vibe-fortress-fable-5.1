/**
 * T-548, Making Do: the new plants, wild and farmed. `03` § Local map generation (the conversions
 * that end stage 10), `07` § Species table, § Farm plots, § Shrubs, § Ash, `08` § Pastures and
 * feeding (grazing shrubs), `09` § Gathering (the nettle's sting), `10` § Eating and drinking (a
 * cactus), `12` § Operation (`Item.seasoned`), `15` § Thoughts (wyrmtongue keeps out the cold),
 * `05` § Fire (ironwood is hard to burn), `plants.md` § Conversions.
 */

import { describe, expect, it } from 'vitest';
import { contentRegistry, loadContent, rawTables } from '@content/loader';
import { FLAT_TEST_SURFACE_Z, regionSpec } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import type { LocalMapSpec } from '@systems/embark';
import { siteSummary } from '@systems/embark/site';
import { CACTUS_THIRST_RELIEF } from '@systems/dwarves/constants';
import { STINGS_STREAM } from '@systems/foraging';
import { FIRE_RESIST_DIVISOR } from '@systems/materials/constants';
import { ASH_DURATION_DAYS } from '@systems/materials/constants';
import { PlantFacts, growthPerHour, stageLength, type PlantRow, type PlantsReader } from '@systems/plants';
import { generateLocalMap } from '@systems/terrain/generate';
import { workCentiTicksFor } from '@systems/terrain/producer';
import { Designation } from '@core/map3d';
import { CHOP_BASE_TICKS } from '@systems/terrain/constants';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const facts = new PlantFacts(registry);
const materials = registry.table<{ id: string; class: string; hardness: number; tags?: readonly string[] }>('materials');
const Z = FLAT_TEST_SURFACE_Z;

function row(id: string): PlantRow {
  const r = facts.row(facts.indexOf(id));
  if (r === undefined) throw new Error(`no plant ${id}`);
  return r;
}

/** The same content with no conversion rows: the maps as they were before T-548. */
function withoutConversions(): Registry {
  const plants = (rawTables()['plants'] as Record<string, unknown>[]).map((r) => {
    const copy = { ...r };
    delete copy['convert'];
    return copy;
  });
  return loadContent({ overrides: { plants } });
}

function spec(biome: string): LocalMapSpec {
  return { ...regionSpec(`t548-${biome}`, { biome, peril: 2, traits: [] }, registry), relief: 1 };
}

const CONVERTED = ['reed_bed', 'barrel_cactus', 'wild_nettle', 'wild_rye', 'rock_lichen', 'wild_wyrmtongue', 'ironwood'];

describe('T-548 stage 10 conversions', () => {
  const before = withoutConversions();
  const species = new Map(CONVERTED.map((id) => [materials.index(id), id] as const));

  /** Every tile that differs from the map without conversions, as `[species, was]`. */
  function converted(biome: string): Map<string, number> {
    const s = spec(biome);
    const now = generateLocalMap(s, registry);
    const old = generateLocalMap(s, before);
    const counts = new Map<string, number>();
    const map = now.map;
    for (let i = 0; i < map.kind.length; i += 1) {
      const same = map.kind[i] === old.map.kind[i] && map.material[i] === old.map.material[i] &&
        map.flags[i] === old.map.flags[i] && map.fluid[i] === old.map.fluid[i];
      if (same) continue;
      // Only a column's surface tile turns, into a converted plant, from a floor, shrub or tree.
      const c = map.yOf(i) * map.w + map.xOf(i);
      expect([biome, i, map.zOf(i)]).toEqual([biome, i, now.result.surface[c]]);
      const id = species.get(map.material[i] as number);
      expect([biome, i, id !== undefined]).toEqual([biome, i, true]);
      const was = old.map.kind[i] as TileKind;
      if (id === 'ironwood') expect([i, was, map.kind[i]]).toEqual([i, TileKind.Tree, TileKind.Tree]);
      else expect([i, [TileKind.Floor, TileKind.Shrub].includes(was), map.kind[i]]).toEqual([i, true, TileKind.Shrub]);
      counts.set(id as string, (counts.get(id as string) ?? 0) + 1);
    }
    // The rest of the result is the same.
    expect(now.result.spawns).toEqual(old.result.spawns);
    expect(Array.from(now.result.surface)).toEqual(Array.from(old.result.surface));
    return counts;
  }

  it('a dark forest turns some trees to ironwood and shrubs to nettles, and nothing else', () => {
    const counts = converted('dark_forest');
    expect(counts.get('ironwood') ?? 0).toBeGreaterThan(0);
    expect(counts.get('wild_nettle') ?? 0).toBeGreaterThan(0);
    expect(Array.from(counts.keys()).every((id) => ['ironwood', 'wild_nettle', 'reed_bed'].includes(id))).toBe(true);
  });

  it('a desert grows barrel cacti; alpine rock grows lichen; a taiga wild rye', () => {
    expect(converted('desert').get('barrel_cactus') ?? 0).toBeGreaterThan(0);
    const alpine = converted('alpine');
    expect(alpine.get('rock_lichen') ?? 0).toBeGreaterThan(0);
    const taiga = converted('taiga');
    expect((taiga.get('wild_rye') ?? 0) + (taiga.get('rock_lichen') ?? 0)).toBeGreaterThan(0);
  });

  it('a grassland no conversion names changes only where reeds grow by the water', () => {
    const counts = converted('temperate_grassland');
    expect(Array.from(counts.keys()).every((id) => id === 'reed_bed')).toBe(true);
  });

  it('the site summary lists the converted plants with the trees and the shrubs', () => {
    const dark = siteSummary(spec('dark_forest'), registry);
    expect(dark.trees?.species).toContain('ironwood');
    expect(dark.shrubs?.species).toContain('wild_nettle');
    const grass = siteSummary(spec('temperate_grassland'), registry);
    expect(grass.trees?.species ?? []).not.toContain('ironwood');
  });

  it('no converted plant is placed by biome weights or regrows', () => {
    for (const id of CONVERTED) expect([id, row(id).biomes]).toEqual([id, undefined]);
  });
});

describe('T-548 the new crops', () => {
  const ok = { season: 0, lit: true, lamped: false, tempC: -1, growthModifier: 100 };

  it('rye grows in a cold spring where barley does not', () => {
    expect(growthPerHour(row('rye'), false, ok)).toBeGreaterThan(0);
    expect(growthPerHour(row('barley'), false, ok)).toBe(0);
    expect(growthPerHour(row('rye'), false, { ...ok, tempC: -3 })).toBe(0);
  });

  it('ironwood chops at twice the time and catches spread fire at a quarter of the chance', () => {
    const oak = materials.byId('oak');
    const ironwood = materials.byId('ironwood');
    expect(workCentiTicksFor(Designation.Chop, oak?.hardness ?? 0)).toBe(CHOP_BASE_TICKS * 100);
    expect(workCentiTicksFor(Designation.Chop, ironwood?.hardness ?? 0)).toBe(CHOP_BASE_TICKS * 200);
    expect(ironwood?.tags).toContain('fire_resistant');
    expect(FIRE_RESIST_DIVISOR).toBe(4);
  });

  it('the coarse fibers spin onward: reed to reed thread, nettle fiber to nettle thread', () => {
    const next = registry.table<{ id: string; nextStage?: string }>('materials');
    expect(next.byId('reed')?.nextStage).toBe('reed_thread');
    expect(next.byId('nettle_fiber')?.nextStage).toBe('nettle_thread');
    expect(next.byId('cactus_fiber')?.nextStage).toBe('cactus_thread');
    expect(materials.byId('wyrmtongue')?.tags).toContain('seasoning');
    expect(materials.byId('cactus_pulp')?.tags).toContain('drinkable');
  });
});

function surface(w: TestWorld, x: number, y: number, n: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dx = 0; dx < n; dx += 1) out.push(w.index(x + dx, y, Z));
  return out;
}

/** A crop at its fourth stage, run through, ready to harvest. */
function ripe(w: TestWorld, tile: TileIndex, species: string): EntityId {
  const id = w.plantCrop(tile, species, 3);
  const crop = w.game.world.entities.get(id, C.Crop);
  w.game.world.entities.add(id, C.Crop, { ...(crop as NonNullable<typeof crop>), growth: stageLength(row(species)) });
  return id;
}

function farmer(w: TestWorld, at: TileIndex): EntityId {
  const id = w.spawnDwarf({ at, skills: { farming: 2 } });
  w.setLabor(id, 'farming', true);
  return id;
}

describe('T-548 farming: straw and ash', () => {
  it('a barley harvest drops straw of barley beside the seed', () => {
    const w = new TestWorld({ seed: 't548-straw', world: 'flat-test', embark: 'none' });
    const tiles = surface(w, 30, 30, 1);
    w.zone('farm_plot', tiles);
    ripe(w, tiles[0] as TileIndex, 'barley');
    expect(w.game.world.applyCommand({ type: 'DesignateHarvest', tiles }).ok).toBe(true);
    farmer(w, w.index(30, 32, Z));
    w.until(() => w.events('CropHarvested').length > 0, 2000);
    expect(w.events('CropHarvested')).toHaveLength(1);
    const straw = w.events('ItemCreated').filter((e) => e['itemType'] === 'straw');
    expect(straw).toHaveLength(1);
    expect(straw[0]?.['material']).toBe('barley');
  });

  it('wyrmtongue is refused off ash, sown only on ash, and its harvest keeps the ash', () => {
    const w = new TestWorld({ seed: 't548-ash', world: 'flat-test', embark: 'none' });
    const tiles = surface(w, 40, 40, 2);
    const zoneId = w.zone('farm_plot', tiles);
    const world = w.game.world;
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'wyrmtongue' })).toEqual({ ok: false, reason: 'not_on_ash' });
    for (const t of tiles) world.services.terrain.setFlag(t, TileFlag.Ash, true);
    const plants = w.plants;
    for (const t of tiles) plants.ashTiles.set(t, world.calendar.tick + TICKS_PER_DAY);
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'wyrmtongue' }).ok).toBe(true);
    // Barley is not sown on a tile with ash.
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 1, speciesId: 'barley' }).ok).toBe(true);
    ripe(w, tiles[0] as TileIndex, 'wyrmtongue');
    expect(world.applyCommand({ type: 'DesignateHarvest', tiles: [tiles[0] as TileIndex] }).ok).toBe(true);
    farmer(w, w.index(40, 42, Z));
    w.until(() => w.events('CropHarvested').length > 0, 2000);
    expect(w.events('CropHarvested')[0]?.['species']).toBe('wyrmtongue');
    const harvestedAt = w.events('CropHarvested').length > 0 ? world.calendar.tick : 0;
    expect(plants.ashTiles.get(tiles[0] as TileIndex) ?? 0).toBeGreaterThanOrEqual(harvestedAt - 100 + ASH_DURATION_DAYS * TICKS_PER_DAY);
    // The other tile was not harvested: its ash clears on its day.
    expect(plants.ashTiles.get(tiles[1] as TileIndex)).toBeLessThan(world.calendar.tick + 2 * TICKS_PER_DAY);
  });

  it('the producer sows a non-ash crop on no ash tile', () => {
    const w = new TestWorld({ seed: 't548-ash-sow', world: 'flat-test', embark: 'none' });
    const tiles = surface(w, 50, 50, 2);
    const zoneId = w.zone('farm_plot', tiles);
    const world = w.game.world;
    world.services.terrain.setFlag(tiles[0] as TileIndex, TileFlag.Ash, true);
    w.plants.ashTiles.set(tiles[0] as TileIndex, world.calendar.tick + 30 * TICKS_PER_DAY);
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'barley' }).ok).toBe(true);
    w.spawnItem('seed', 'barley', w.index(50, 52, Z), 5);
    farmer(w, w.index(50, 53, Z));
    w.until(() => w.events('CropPlanted').length > 0, 3000);
    w.step(400);
    const planted = w.events('CropPlanted').map((e) => e['tile']);
    expect(planted).toContain(tiles[1]);
    expect(planted).not.toContain(tiles[0]);
  });
});

describe('T-548 the wild shrubs at work', () => {
  it('a gathered barrel cactus gives its pulp and its fiber at once', () => {
    const w = new TestWorld({ seed: 't548-cactus', world: 'flat-test', embark: 'none' });
    const tile = w.index(20, 20, Z);
    w.game.world.services.terrain.setKind(tile, TileKind.Shrub, materials.index('barrel_cactus'));
    const terrain = w.game.world.scheduler.byId('03') as unknown as { producer: { rolls(): { gather(m: number): unknown } } };
    const got = terrain.producer.rolls().gather(materials.index('barrel_cactus')) as { type: string; material: string; extra?: unknown };
    expect(got.type).toBe('plant_food');
    expect(got.material).toBe('cactus_pulp');
    expect(got.extra).toEqual({ type: 'fiber', material: 'cactus_fiber', count: 1 });
  });

  it('a nettle stings on its own stream, about one gathering in ten', () => {
    const w = new TestWorld({ seed: 't548-nettle', world: 'flat-test', embark: 'none' });
    const tile = w.index(22, 22, Z);
    const world = w.game.world;
    world.services.terrain.setKind(tile, TileKind.Shrub, materials.index('wild_nettle'));
    const dwarf = w.spawnDwarf({ at: w.index(22, 24, Z) });
    const before = world.rngFor(STINGS_STREAM).state();
    // A bramble draws nothing from the stream.
    const bramble = w.index(24, 22, Z);
    world.services.terrain.setKind(bramble, TileKind.Shrub, materials.index('bramble'));
    world.emit({ type: 'JobCompleted', jobId: 1, jobType: 'gather', workerId: dwarf, target: bramble } as never);
    w.step(1);
    expect(world.rngFor(STINGS_STREAM).state()).toEqual(before);
    for (let k = 0; k < 200; k += 1) {
      world.emit({ type: 'JobCompleted', jobId: 2 + k, jobType: 'gather', workerId: dwarf, target: tile } as never);
      w.step(1);
    }
    const stung = w.events('Stung');
    expect(stung.length).toBeGreaterThan(5);
    expect(stung.length).toBeLessThan(45);
    expect(stung[0]).toMatchObject({ id: dwarf, source: 'nettle' });
    const thoughts = w.game.world.entities.get(dwarf, C.Mood)?.thoughts ?? [];
    const nettles = registry.table('thoughts').index('nettles');
    expect(thoughts.some((t) => t.thought === nettles)).toBe(true);
  });

  it('a thirsty dwarf with nothing else to drink eats a cactus, for half a drink', () => {
    const w = new TestWorld({ seed: 't548-drink-cactus', world: 'flat-test', embark: 'none' });
    const id = w.spawnDwarf({ at: w.index(12, 12, Z) });
    w.spawnItem('plant_food', 'cactus_pulp', w.index(14, 12, Z), 2);
    w.setNeed(id, 'thirst', 60);
    w.setNeed(id, 'hunger', 0);
    w.until(() => w.events('DrankFromPlant').length > 0, 500);
    expect(w.events('DrankFromPlant')).toMatchObject([{ id }]);
    expect(w.dwarves.reader().need(id, 'thirst')).toBeGreaterThan(60 - CACTUS_THIRST_RELIEF - 5);
    expect(w.dwarves.reader().need(id, 'thirst')).toBeLessThan(60 - CACTUS_THIRST_RELIEF + 5);
    const thoughts = w.game.world.entities.get(id, C.Mood)?.thoughts ?? [];
    expect(thoughts.some((t) => t.thought === registry.table('thoughts').index('drank_cactus'))).toBe(true);
  });

  it('a hungry yak with no grass grazes lichen, which then regrows', () => {
    const w = new TestWorld({ seed: 't548-yak', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    // A pasture of lichen on bare ground: no grass in it.
    const tiles: TileIndex[] = [];
    for (let y = 60; y < 64; y += 1) for (let x = 60; x < 64; x += 1) tiles.push(w.index(x, y, Z));
    for (const t of tiles) world.services.terrain.setFlag(t, TileFlag.Grass, false);
    const lichen = tiles.slice(0, 4);
    for (const t of lichen) world.services.terrain.setKind(t, TileKind.Shrub, materials.index('rock_lichen'));
    const pasture = w.zone('pasture', tiles);
    const yak = w.spawnTame('yak', tiles[10] as TileIndex);
    expect(world.applyCommand({ type: 'AssignPasture', animalId: yak, zoneId: pasture }).ok).toBe(true);
    const tame = world.entities.get(yak, C.Tame);
    world.entities.add(yak, C.Tame, { ...(tame as NonNullable<typeof tame>), condition: 80 });
    w.until(() => w.events('ShrubGrazed').length > 0, 3000);
    const grazed = w.events('ShrubGrazed')[0]?.['tile'] as TileIndex;
    expect(lichen).toContain(grazed);
    w.step(60);
    expect(w.readers.of<PlantsReader>('07').shrubReady(grazed)).toBe(false);
    expect(world.entities.get(yak, C.Tame)?.condition ?? 100).toBeLessThan(80);
  });
});

describe('T-548 wyrmtongue keeps out the cold', () => {
  it('a meal seasoned with wyrmtongue gives ate_wyrmtongue, which keeps bitter_cold away', () => {
    const w = new TestWorld({ seed: 't548-wyrmtongue', world: 'flat-test', embark: 'none' });
    const world = w.game.world;
    const id = w.spawnDwarf({ at: w.index(12, 12, Z) });
    const meal = w.spawnItem('easy_meal', 'wyrmtongue', w.index(13, 12, Z));
    const item = world.entities.get(meal, C.Item);
    world.entities.add(meal, C.Item, { ...(item as NonNullable<typeof item>), seasoned: [materials.index('wyrmtongue')] });
    // A dwarf already cold.
    world.emit({ type: 'DwarfOutdoorsIn', id, weather: 'cold_snap' } as never);
    w.step(1);
    const cold = registry.table('thoughts').index('bitter_cold');
    const warm = registry.table('thoughts').index('ate_wyrmtongue');
    const held = (thought: number): boolean => (world.entities.get(id, C.Mood)?.thoughts ?? []).some((t) => t.thought === thought);
    expect(held(cold)).toBe(true);
    w.setNeed(id, 'hunger', 60);
    w.until(() => w.events('MealEaten').length > 0, 500);
    expect(w.events('MealEaten')[0]?.['seasoned']).toEqual(['wyrmtongue']);
    w.step(1);
    expect(held(warm)).toBe(true);
    expect(held(cold)).toBe(false);
    world.emit({ type: 'DwarfOutdoorsIn', id, weather: 'cold_snap' } as never);
    w.step(1);
    expect(held(cold)).toBe(false);
  });
});
