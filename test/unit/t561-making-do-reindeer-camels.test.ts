/**
 * T-561, Making Do C5: reindeer and camels (`08` § Wild herds, § Products, The camel spits;
 * `creatures.md` § Domestic animals, § Wild herds, § Butcher parts; `20` § Sundries, the Hillfolk's camels).
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SPEC } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import { TileFlag } from '@core/map3d';
import { RngStream } from '@core/rng';
import type { LocalMapSpec } from '@systems/embark';
import { siteSignature } from '@systems/embark';
import { dailyHerds, herdPermille, leavers, surfaceCap, type AnimalsSystem } from '@systems/animals';
import { HERDS_STREAM, HERD_SPAWN_PERMILLE, SPIT_PERMILLE } from '@systems/animals/constants';
import type { ItemsReader } from '@systems/items';
import type { MoraleReader } from '@systems/morale';
import { eventPredicate, type ThoughtDef } from '@systems/morale/thoughts';
import { eligibleGoodsEntries, generateGoods } from '@systems/trade/goods';
import { AnnouncementLog } from '@ui/announcements';
import { Strings } from '@ui/strings';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const creatures = registry.table<{
  id: string; diet: string; temper: string; products?: { kind: string; intervalDays: number }[]; factionDefault: string;
  flags: { tameable?: boolean; butcherable?: boolean }; breeding?: unknown; group: [number, number];
  butcherParts?: { item: string; material: string; count: number }[];
  herd?: { biomes: { biome: string; weight: number }[]; group: [number, number]; season?: number[] };
}>('creatures');
const Z = 32;

const spec = (biome: string): LocalMapSpec => ({ ...FLAT_TEST_SPEC, biome, traits: [] });
const world = (seed: string, biome: string, startTick = 0): TestWorld =>
  new TestWorld({ seed, world: 'flat-test', embark: 'none', spec: spec(biome), startTick });

describe('T-561 the rows', () => {
  it('reindeer and camels are tameable domestic grazers with milk, wool, meat, hide and horn', () => {
    const reindeer = creatures.byId('reindeer');
    const camel = creatures.byId('camel');
    expect(reindeer).toMatchObject({ diet: 'grazer', temper: 'timid', factionDefault: 'fortress', products: [{ kind: 'milk', intervalDays: 6 }] });
    expect(camel).toMatchObject({ diet: 'grazer', temper: 'neutral', factionDefault: 'fortress',
      products: [{ kind: 'milk', intervalDays: 5 }, { kind: 'wool', intervalDays: 28 }] });
    for (const row of [reindeer, camel]) {
      expect(row?.flags).toMatchObject({ tameable: true, butcherable: true });
      expect(row?.breeding).toBeDefined();
    }
    expect(reindeer?.butcherParts).toEqual([{ item: 'horn', material: 'horn', count: 2 }]);
    for (const m of ['reindeer_meat', 'reindeer_hide', 'camel_meat', 'camel_hide']) expect(registry.table('materials').has(m)).toBe(true);
    expect(registry.table('palette').has('reindeer_brown') && registry.table('palette').has('camel_tan')).toBe(true);
  });

  it('the wild herds: reindeer in tundra and taiga, camels in desert, badlands and savanna, in herds of their own size', () => {
    expect(creatures.byId('reindeer')?.herd).toEqual({ biomes: [{ biome: 'tundra', weight: 20 }, { biome: 'taiga', weight: 15 }], group: [4, 8], season: [0, 1, 2, 3] });
    expect(creatures.byId('camel')?.herd).toEqual({ biomes: [{ biome: 'desert', weight: 20 }, { biome: 'badlands', weight: 15 }, { biome: 'savanna', weight: 8 }], group: [2, 4], season: [0, 1, 2, 3] });
    // The domestic row keeps its own group: the herd's is only for the wild herd.
    expect(creatures.byId('camel')?.group).toEqual([1, 1]);
    const w = world('t561-rows', 'tundra');
    const facts = w.animals.facts;
    expect(facts.herdSpecies('tundra', 0)).toEqual([[facts.indexOf('reindeer'), 20]]);
    expect(facts.herdSpecies('savanna', 3)).toEqual([[facts.indexOf('camel'), 8]]);
    expect(facts.herdSpecies('temperate_forest', 0)).toEqual([]);
    // They are not in the ordinary biome lists.
    expect(facts.surfaceSpecies('tundra', 0).some(([s]) => s === facts.indexOf('reindeer'))).toBe(false);
    expect(herdPermille(20)).toBe(Math.floor(HERD_SPAWN_PERMILLE * 20 / 100));
  });

  it('the spat_on thought and its note', () => {
    const thought = registry.table<ThoughtDef>('thoughts').byId('spat_on') as ThoughtDef;
    expect(thought.text).toBe('The camel spat on me.');
    expect(eventPredicate(thought, { type: 'SpatOn', id: 1, animalId: 2, first: false }, registry)).toBe(true);
    expect(new Strings(registry).get('announce.spat_on')).toBe('The camel spat on {dwarf}.');
  });

  it('the site summary names the herds of a tundra, a taiga and a desert now that the species are in the game', () => {
    expect(siteSignature(spec('taiga'), registry).has).toContain('reindeer');
    expect(siteSignature(spec('tundra'), registry).has).toContain('reindeer');
    expect(siteSignature(spec('desert'), registry).has).toContain('camels');
    expect(siteSignature(spec('savanna'), registry).has).toContain('camels');
  });
});

describe('T-561 wild herds', () => {
  it('a herd walks into a tundra map on its own stream, within the cap, at the edge; the ordinary stream does not move', () => {
    const w = world('t561-herd', 'tundra');
    w.step(1);
    const host = w.animals.spawner;
    const reindeer = w.animals.facts.indexOf('reindeer');
    const cap = surfaceCap(host, reindeer, 20);
    const herdRng = RngStream.forStream('t561', 'herds');
    const before = JSON.stringify(w.animals.rng.state());
    let groups: ReturnType<typeof dailyHerds> = [];
    for (let day = 0; day < 2000 && groups.length === 0; day += 1) groups = dailyHerds(host, () => herdRng, 0);
    expect(JSON.stringify(w.animals.rng.state())).toBe(before);
    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    expect(group.species).toBe(reindeer);
    expect(group.ids.length).toBeGreaterThanOrEqual(Math.min(4, cap));
    expect(group.ids.length).toBeLessThanOrEqual(Math.min(8, cap));
    const map = w.map;
    for (const id of group.ids) {
      expect(w.game.world.entities.has(id, C.Wild)).toBe(true);
      expect(w.game.world.entities.get(id, C.Creature)?.faction).toBe('wild');
      const p = w.game.world.entities.get(id, C.Position)!;
      expect(map.hasFlag(map.index(p.x, p.y, p.z), TileFlag.Outdoor)).toBe(true);
    }
    // Under its cap a wild reindeer stays; the leaving rule knows the herd's cap.
    const going = leavers(host, 0, w.tick, group.ids, {
      get: (id) => ({ species: w.game.world.entities.get(id, C.Creature)!.species, arrivedTick: w.game.world.entities.get(id, C.Wild)!.arrivedTick }),
    });
    expect(going).toEqual([]);
    // At its cap nothing more comes, and nothing is drawn.
    const full = JSON.stringify(herdRng.state());
    if (group.ids.length >= cap) {
      expect(dailyHerds(host, () => herdRng, 0)).toEqual([]);
      expect(JSON.stringify(herdRng.state())).toBe(full);
    }
  });

  it('a map with no herd never makes the stream; a herd map makes it on its first day', () => {
    const plain = world('t561-stream', 'temperate_forest');
    plain.step(TICKS_PER_DAY + 2);
    expect(plain.game.world.rngState().some((s) => s.id === HERDS_STREAM)).toBe(false);
    let made = false;
    const host = plain.animals.spawner;
    expect(dailyHerds(host, () => { made = true; return RngStream.forStream('x', 'y'); }, 0)).toEqual([]);
    expect(made).toBe(false);
    const tundra = world('t561-stream', 'tundra');
    tundra.step(TICKS_PER_DAY + 2);
    expect(tundra.game.world.rngState().some((s) => s.id === HERDS_STREAM)).toBe(true);
  });

  it('camels walk into a desert map in herds of two to four', () => {
    const w = world('t561-camels', 'desert');
    w.step(1);
    const host = w.animals.spawner;
    const camel = w.animals.facts.indexOf('camel');
    const herdRng = RngStream.forStream('t561', 'camels');
    let groups: ReturnType<typeof dailyHerds> = [];
    for (let day = 0; day < 2000 && groups.length === 0; day += 1) groups = dailyHerds(host, () => herdRng, 1);
    expect(groups[0]?.species).toBe(camel);
    expect(groups[0]!.ids.length).toBeGreaterThanOrEqual(2);
    expect(groups[0]!.ids.length).toBeLessThanOrEqual(4);
  });
});

describe('T-561 the camel spits', () => {
  it('a spit one milking or shearing in twenty, drawn only for a camel; the day\'s first is the note', () => {
    const w = world('t561-spit-odds', 'desert');
    w.step(1);
    const animals: AnimalsSystem = w.animals;
    const dwarf = w.spawnDwarf({ at: w.index(14, 15, Z) });
    const camel = w.spawnTame('camel', w.index(11, 15, Z), { sex: 0 });
    const cow = w.spawnTame('cow', w.index(12, 15, Z), { sex: 0 });
    const out: GameEvent[] = [];
    const before = JSON.stringify(animals.rng.state());
    for (let k = 0; k < 200; k += 1) animals.spit(dwarf, cow, w.tick, (e) => out.push(e));
    expect(out).toEqual([]);
    expect(JSON.stringify(animals.rng.state())).toBe(before);
    const tries = 2000;
    const dayOf: number[] = [];
    for (let k = 0; k < tries; k += 1) {
      const day = Math.floor(k / 40);
      animals.spit(dwarf, camel, w.tick + day * TICKS_PER_DAY, (e) => { out.push(e); dayOf.push(day); });
    }
    const expected = tries * SPIT_PERMILLE / 1000;
    expect(out.length).toBeGreaterThan(expected * 0.6);
    expect(out.length).toBeLessThan(expected * 1.4);
    expect(out[0]).toEqual({ type: 'SpatOn', id: dwarf, animalId: camel, first: true });
    // One note a day: the first of each day's spits, and some day has two.
    const days = new Set<number>();
    out.forEach((e, i) => {
      expect(e['first']).toBe(!days.has(dayOf[i]!));
      days.add(dayOf[i]!);
    });
    expect(days.size).toBeLessThan(out.length);
  });

  it('milking and shearing a tame camel at the farmer\'s workshop: spat on, the thought, the note once a day, saved', () => {
    const w = world('t561-spit', 'desert', 5 * TICKS_PER_DAY - 2);
    w.build('farmers_workshop', w.index(15, 15, Z));
    const camel = w.spawnTame('camel', w.index(11, 15, Z), { sex: 0 });
    const dwarf = w.spawnDwarf({ at: w.index(14, 15, Z) });
    w.step(1);
    const log = new AnnouncementLog(new Strings(registry), registry);
    log.register(w.game.world.registrations.announcements);
    w.game.world.onEvents((events) => { for (const event of events) log.announce(event, w.readers, w.tick); });
    const items = w.readers.of<ItemsReader>('13');
    const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;
    let milked = 0;
    for (let round = 0; round < 120 && w.events('SpatOn').length < 2; round += 1) {
      for (const need of NEEDS) w.setNeed(dwarf, need, 0);
      w.animals.ready.set(`milk:${camel}`, camel);
      w.until(() => !w.animals.ready.has(`milk:${camel}`), 2000);
      milked += 1;
    }
    expect(items.count('milk')).toBeGreaterThan(0);
    const spits = w.events('SpatOn');
    expect(spits.length).toBeGreaterThanOrEqual(2);
    expect(spits[0]).toEqual(expect.objectContaining({ id: dwarf, animalId: camel, first: true }));
    w.step(2);
    expect(w.readers.of<MoraleReader>('15').thoughts(dwarf).some((t) => t.id === 'spat_on')).toBe(true);
    const notes = log.lines.filter((line) => line.text.startsWith('The camel spat on'));
    expect(notes).toHaveLength(spits.filter((e) => e['first'] === true).length);
    const saved = w.animals.serialize();
    expect(saved.spatOnDay).toBeGreaterThanOrEqual(0);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    expect((loaded.world.scheduler.byId('08') as AnimalsSystem).serialize().spatOnDay).toBe(saved.spatOnDay);
    // Shearing is a spitting job too.
    w.animals.ready.set(`wool:${camel}`, camel);
    w.until(() => !w.animals.ready.has(`wool:${camel}`), 2000);
    expect(items.count('wool_raw')).toBe(1);
    expect(milked).toBeGreaterThan(0);
  });
});

describe('T-561 the Hillfolk\'s camels', () => {
  it('are in the Hillfolk\'s list only in a desert, badlands or savanna site', () => {
    const camels = (biome?: string): boolean => eligibleGoodsEntries(registry, 'hillfolk', 0, biome === undefined ? {} : { biome })
      .some((e) => e.item === 'camel');
    expect(camels('desert')).toBe(true);
    expect(camels('badlands')).toBe(true);
    expect(camels('savanna')).toBe(true);
    expect(camels('tundra')).toBe(false);
    expect(camels()).toBe(false);
    for (const civ of ['mountainhome', 'wildwood'] as const) expect(eligibleGoodsEntries(registry, civ, 0, { biome: 'desert' }).some((e) => e.item === 'camel')).toBe(false);
  });

  it('a desert caravan can bring caged camels; elsewhere the draws are as before', () => {
    let caged = 0;
    const camel = registry.table('creatures').index('camel');
    for (let k = 0; k < 40; k += 1) {
      const goods = generateGoods(registry, 'hillfolk', 0, 0, [], RngStream.forStream(`t561-${k}`, 'goods'), RngStream.forStream(`t561-${k}`, 'extra'), { biome: 'desert' });
      caged += goods.filter((g) => g.species === camel).reduce((n, g) => n + g.count, 0);
    }
    expect(caged).toBeGreaterThan(0);
    for (let k = 0; k < 10; k += 1) {
      const a = generateGoods(registry, 'hillfolk', 0, 0, [], RngStream.forStream(`t561-${k}`, 'goods'), RngStream.forStream(`t561-${k}`, 'extra'), { biome: 'tundra' });
      const b = generateGoods(registry, 'hillfolk', 0, 0, [], RngStream.forStream(`t561-${k}`, 'goods'), RngStream.forStream(`t561-${k}`, 'extra'), {});
      expect(a).toEqual(b);
      expect(a.some((g) => g.species === camel)).toBe(false);
    }
    // A request for a camel is not brought where there are none to sell.
    const asked = generateGoods(registry, 'hillfolk', 0, 0, [{ itemType: 'camel', priority: 3 }], RngStream.forStream('t561-ask', 'goods'), RngStream.forStream('t561-ask', 'extra'), { biome: 'tundra' });
    expect(asked.some((g) => g.species === camel)).toBe(false);
  });
});
