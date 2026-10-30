import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import {
  ATTRIBUTE_BASELINE,
  EMBARK_BUDGET_BASE,
  EMBARK_BUDGET_PER_PERIL,
  EMBARK_DWARF_COUNT,
  START_HOUR,
  TICKS_PER_HOUR,
  WORLD_SIZE_STANDARD,
} from '@core/constants';
import { TileKind } from '@core/map3d';
import { hash64 } from '@core/noise';
import { RngStream } from '@core/rng';
import { dayOfSeasonOf, hourOf, seasonOf, yearOf } from '@core/calendar';
import { HeadlessGame, FLAT_TEST_SPEC } from '@app/headless';
import {
  ATTRIBUTE_KEYS,
  makeDwarf,
  rollAttribute,
  rollPersonality,
  uniqueName,
  NAME_RETRIES,
} from '@systems/dwarves/rules/make-dwarf';
import * as E from '@systems/embark/constants';
import {
  ARRIVAL_NEEDS,
  EmbarkSession,
  applyPreset,
  canEmbark,
  edgeMidpoint,
  embarkBudget,
  findWagonSite,
  generateParty,
  localMapSpec,
  reliefOf,
  suppliesTotal,
  thaneIndex,
} from '@systems/embark';
import { generate } from '@systems/worldgen';
import { tuningConstants } from '../system-constants';

const registry = contentRegistry();

describe('T-M1-04 embark: tuning constants', () => {
  it('every numeric row of 02 § Tuning constants is in constants.ts with its value', () => {
    const rows = tuningConstants('02-systems/02-embark-and-loadout.md');
    expect(rows.length).toBe(7);
    const code = E as unknown as Record<string, number>;
    for (const row of rows) expect([row.name, code[row.name]]).toEqual([row.name, row.value]);
  });
});

describe('T-M1-04 embark: makeDwarf', () => {
  it('attribute distribution over 10,000 rolls: mean 50 ± 1, min ≥ 26, max ≤ 74', () => {
    const rng = new RngStream(20260917);
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let k = 0; k < 10_000; k += 1) {
      const v = rollAttribute(rng);
      sum += v;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(Math.abs(sum / 10_000 - ATTRIBUTE_BASELINE)).toBeLessThanOrEqual(1);
    expect(min).toBeGreaterThanOrEqual(26);
    expect(max).toBeLessThanOrEqual(74);
    // A bell, not a plateau: the extremes are rare.
    expect(min).toBeLessThan(40);
    expect(max).toBeGreaterThan(60);
  });

  it('three traits from three distinct pairs, weighted within the pair', () => {
    const table = registry.table<{ id: string; pair: string }>('personality');
    const rng = new RngStream(7);
    const seenPairs = new Set<string>();
    for (let k = 0; k < 500; k += 1) {
      const traits = rollPersonality(rng, registry);
      const pairs = traits.map((t) => table.byId(t)?.pair as string);
      expect(new Set(pairs).size).toBe(3);
      expect(new Set(traits).size).toBe(3);
      for (const p of pairs) seenPairs.add(p);
    }
    expect(seenPairs.size).toBe(6);
  });

  it('a dwarf is sex, unique name, age 18-65, seven attributes, three traits, needs 30, no skills', () => {
    const rng = new RngStream(99);
    for (let k = 0; k < 200; k += 1) {
      const d = makeDwarf(rng, registry);
      expect([0, 1]).toContain(d.sex);
      expect(d.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
      expect(d.ageYears).toBeGreaterThanOrEqual(E.EMBARK_AGE_MIN);
      expect(d.ageYears).toBeLessThanOrEqual(E.EMBARK_AGE_MAX);
      expect(Object.keys(d.attributes)).toEqual([...ATTRIBUTE_KEYS]);
      expect(d.personality).toHaveLength(3);
      expect(d.needs).toBe(30);
      expect(d.skills).toEqual({});
    }
  });

  it('names are unique in a party, and a crowded name gets an ordinal suffix', () => {
    for (let s = 0; s < 50; s += 1) {
      const party = generateParty(new RngStream(s), registry);
      expect(party).toHaveLength(EMBARK_DWARF_COUNT);
      expect(new Set(party.map((d) => d.name)).size).toBe(EMBARK_DWARF_COUNT);
    }
    const names = { givenA: ['Orm'], givenB: ['Orm'], shared: ['Orm'], hallFirst: ['Iron'], hallSecond: ['vein'] };
    const rng = new RngStream(1);
    expect(uniqueName(rng, names, 0, new Set())).toBe('Orm Ironvein');
    expect(uniqueName(rng, names, 0, new Set(['Orm Ironvein']))).toBe('Orm Ironvein the Second');
    expect(uniqueName(rng, names, 1, new Set(['Orm Ironvein', 'Orm Ironvein the Second']))).toBe('Orm Ironvein the Third');
    expect(NAME_RETRIES).toBe(20);
  });
});

describe('T-M1-04 embark: LocalMapSpec', () => {
  const world = generate('spec-world', WORLD_SIZE_STANDARD, registry);

  it('carries the region fields, the seed hash and the arrival edge', () => {
    const region = world.regions.find((r) => r.river !== null && r.biome !== 'ocean' && r.traits.length > 0) ??
      (world.regions.find((r) => r.biome !== 'ocean') as (typeof world.regions)[number]);
    const spec = localMapSpec(world, region.id, registry);
    expect(spec.seed).toBe(hash64(world.seed, region.id));
    expect(spec.regionId).toBe(region.id);
    for (const key of ['biome', 'elevation', 'geology', 'wealth', 'peril', 'temper', 'deepness', 'volcano', 'lake'] as const) {
      expect(spec[key]).toBe(region[key]);
    }
    expect(spec.traits).toEqual(region.traits);
    expect(spec.soilDepth).toBe(registry.table<{ id: string; soilDepth: number }>('biomes').byId(region.biome)?.soilDepth);
    expect(spec.civEdges).toEqual(region.nearestEdgeTo);
    expect(spec.arrivalEdge).toBe(region.nearestEdgeTo.mountainhome);
    if (region.river !== null) {
      expect(spec.river).toEqual({ inflowEdges: region.river.inflow, outflowEdge: region.river.outflow, class: region.river.class });
    }
    expect(localMapSpec(world, region.id, registry)).toEqual(spec);
    expect(() => localMapSpec(world, -1, registry)).toThrow(RangeError);
  });

  it('T-436: relief is 0 for level ground, else 1 plus the largest neighbour elevation difference over 96', () => {
    for (const r of world.regions) {
      const relief = reliefOf(world, r.id);
      expect(relief).toBeGreaterThanOrEqual(0);
      expect(relief).toBeLessThanOrEqual(3);
    }
    const flat = { ...world, regions: world.regions.map((r) => ({ ...r, elevation: 100 })) };
    expect(reliefOf(flat, 65)).toBe(0);
    const steep = { ...flat, regions: flat.regions.map((r) => (r.id === 66 ? { ...r, elevation: 250 } : r)) };
    expect(reliefOf(steep, 65)).toBe(2);
    const cliff = { ...flat, regions: flat.regions.map((r) => (r.id === 66 ? { ...r, elevation: 0 } : { ...r, elevation: 255 })) };
    expect(reliefOf(cliff, 65)).toBe(3);
  });
});

describe('T-M1-04 embark: presets and the budget', () => {
  it('the four presets price out to the documented totals, within the base budget', () => {
    const documented: Record<string, number> = { balanced: 1480, miner_s_guild: 1490, farmstead: 1466, warband: 1495 };
    for (const id of Object.keys(documented)) {
      const party = generateParty(new RngStream(3), registry);
      const supplies = applyPreset(registry, party, id);
      const total = suppliesTotal(registry, supplies);
      expect([id, total]).toEqual([id, documented[id]]);
      expect(total).toBeLessThanOrEqual(EMBARK_BUDGET_BASE);
      expect(canEmbark(registry, party, supplies, 0)).toEqual({ ok: true, reason: null });
    }
  });

  it('a preset gives every dwarf at most 10 points and 5 in any skill', () => {
    const party = generateParty(new RngStream(3), registry);
    applyPreset(registry, party, 'balanced');
    expect(party[0]?.skills).toEqual({ mining: 5, building: 3, axe: 2 });
    expect(party[6]?.skills).toEqual({ medicine: 4, crossbow: 3, hunting: 3 });
  });

  it('budget = base + per-peril × peril; over-budget and over-skilled parties cannot embark', () => {
    expect(embarkBudget(0)).toBe(EMBARK_BUDGET_BASE);
    expect(embarkBudget(3)).toBe(EMBARK_BUDGET_BASE + 3 * EMBARK_BUDGET_PER_PERIL);
    const party = generateParty(new RngStream(4), registry);
    const heavy = [
      { entry: 'e_anvil', count: 1 },
      { entry: 'e_mail_iron', count: 4 },
      { entry: 'e_pick_iron', count: 2 },
    ];
    expect(suppliesTotal(registry, heavy)).toBe(1566);
    expect(canEmbark(registry, party, heavy, 0)).toEqual({ ok: false, reason: 'over_budget' });
    expect(canEmbark(registry, party, heavy, 1).ok).toBe(true);
    (party[2] as (typeof party)[number]).skills = { mining: 5, masonry: 5, carpentry: 1 };
    expect(canEmbark(registry, party, [], 0).reason).toBe('too_many_points:2');
    (party[2] as (typeof party)[number]).skills = { mining: 6 };
    expect(canEmbark(registry, party, [], 0).reason).toBe('skill_over_max:2:mining');
  });

  it('the Thane is the highest Charm, ties to the lowest id', () => {
    expect(thaneIndex([40, 55, 61, 61, 12])).toBe(2);
    expect(thaneIndex([50])).toBe(0);
  });
});

describe('T-M1-04 embark: the session', () => {
  it('answers the embark-session commands', () => {
    const s = new EmbarkSession(registry, 'session-seed', 1);
    expect(s.party).toHaveLength(EMBARK_DWARF_COUNT);
    expect(s.fortressName.length).toBeGreaterThan(0);
    expect(s.budget()).toBe(EMBARK_BUDGET_BASE + EMBARK_BUDGET_PER_PERIL);
    expect(s.apply({ type: 'ApplyPreset', preset: 'warband' })).toEqual({ ok: true });
    expect(s.total()).toBe(1495);
    expect(s.apply({ type: 'ApplyPreset', preset: 'nope' }).ok).toBe(false);
    expect(s.apply({ type: 'SetSkill', dwarf: 0, skill: 'mining', level: 6 })).toEqual({ ok: false, reason: 'invalid' });
    expect(s.apply({ type: 'SetSkill', dwarf: 0, skill: 'mining', level: 5 })).toEqual({ ok: true });
    expect(s.canEmbark()).toEqual({ ok: false, reason: 'too_many_points:0' });
    expect(s.apply({ type: 'ConfirmEmbark' }).ok).toBe(false);
    expect(s.apply({ type: 'SetSkill', dwarf: 0, skill: 'mining', level: 0 })).toEqual({ ok: true });
    const kept = { ...s.party[1]?.skills };
    const oldName = s.party[1]?.name;
    expect(s.apply({ type: 'RerollDwarf', dwarf: 1 })).toEqual({ ok: true });
    expect(s.party[1]?.skills).toEqual(kept);
    expect(s.party[1]?.name).not.toBe(oldName);
    expect(s.budget()).toBe(EMBARK_BUDGET_BASE + EMBARK_BUDGET_PER_PERIL - E.EMBARK_REROLL_COST);
    expect(s.apply({ type: 'RenameDwarf', dwarf: 1, name: '  ' }).ok).toBe(false);
    expect(s.apply({ type: 'RenameDwarf', dwarf: 1, name: 'Urist' })).toEqual({ ok: true });
    expect(s.apply({ type: 'SetSupply', entry: 'e_cat', count: 5 }).ok).toBe(false);
    expect(s.apply({ type: 'SetSupply', entry: 'e_cat', count: 1 })).toEqual({ ok: true });
    expect(s.total()).toBe(1495 + 12);
    expect(s.apply({ type: 'SetFortressName', name: 'Stonehearth' })).toEqual({ ok: true });
    expect(s.apply({ type: 'ConfirmEmbark' })).toEqual({ ok: true });
    expect(s.apply({ type: 'SetFortressName', name: 'Later' }).ok).toBe(false);
  });

  it('the same world seed gives the same party', () => {
    const a = new EmbarkSession(registry, 'same', 0);
    const b = new EmbarkSession(registry, 'same', 0);
    expect(a.party).toEqual(b.party);
    expect(a.fortressName).toBe(b.fortressName);
  });
});

describe('T-M1-04 embark: arrival', () => {
  it('lands seven dwarves next to the wagon, Thane by Charm, calendar at spring day 1 hour 8, Embarked', () => {
    const game = new HeadlessGame({ seed: 'arrival', world: 'flat-test', embark: 'default', fortressName: 'Emberhall' });
    const arrival = game.arrival;
    if (arrival === null) throw new Error('no arrival');
    const e = game.world.entities;
    expect(arrival.dwarves).toHaveLength(EMBARK_DWARF_COUNT);
    const tick = game.world.calendar.tick;
    expect(tick).toBe(START_HOUR * TICKS_PER_HOUR);
    expect([seasonOf(tick), dayOfSeasonOf(tick), hourOf(tick), yearOf(tick)]).toEqual([0, 1, START_HOUR, 1]);
    expect(game.world.fortress.name).toBe('Emberhall');
    expect(game.world.fortress.embarkTick).toBe(tick);

    // The wagon is the patch nearest the middle of the north edge.
    const mid = edgeMidpoint(game.map, FLAT_TEST_SPEC.arrivalEdge);
    expect([arrival.wagon.x, arrival.wagon.y]).toEqual([mid.x, 1]);
    const charms = arrival.dwarves.map((id) => e.get(id, C.Attributes)?.cha as number);
    const best = Math.max(...charms);
    const thane = arrival.dwarves[charms.indexOf(best)];
    expect(arrival.thane).toBe(thane);
    for (const id of arrival.dwarves) {
      const pos = e.get(id, C.Position) as { x: number; y: number; z: number };
      expect(Math.max(Math.abs(pos.x - arrival.wagon.x), Math.abs(pos.y - arrival.wagon.y))).toBe(2);
      expect(pos.z).toBe(arrival.wagon.z);
      expect(e.get(id, C.Title)?.title).toBe(id === thane ? 'thane' : 'none');
      expect(e.get(id, C.Needs)?.hunger).toBe(ARRIVAL_NEEDS);
      expect(e.get(id, C.Creature)?.faction).toBe('fortress');
      expect(game.spatial.at(game.map.index(pos.x, pos.y, pos.z))).toContain(id);
    }
    // Balanced skills reached the entities.
    const skills = registry.table('skills');
    expect(e.get(arrival.dwarves[0] as number, C.Skills)?.level[skills.index('mining')]).toBe(5);
    expect(arrival.supplies.length).toBeGreaterThan(0);

    game.step(1);
    // Embarked is dispatched in the first tick.
    const events: string[] = [];
    const game2 = new HeadlessGame({ seed: 'arrival', world: 'flat-test', embark: 'default' });
    game2.world.onEvents((batch) => batch.forEach((ev) => events.push(ev.type)));
    game2.step(1);
    expect(events).toContain('Embarked');
  });

  it('clears trees from the nearest patch when no clear patch exists', () => {
    const game = new HeadlessGame({ seed: 'trees', world: 'flat-test' });
    const map = game.map;
    const z = 32;
    for (let y = 0; y < map.h; y += 1) {
      for (let x = 0; x < map.w; x += 1) if ((x + y) % 5 === 0) map.setKind(map.index(x, y, z), TileKind.Tree, 1);
    }
    const site = findWagonSite(map, 'n');
    expect(site).not.toBeNull();
    expect(site?.cleared.length).toBeGreaterThan(0);
    for (const i of site?.cleared ?? []) expect(map.kindAt(i)).toBe(TileKind.Floor);
  });

  it('the same seed lands the same party in the same places', () => {
    const a = new HeadlessGame({ seed: 'twice', world: 'flat-test', embark: 'default' });
    const b = new HeadlessGame({ seed: 'twice', world: 'flat-test', embark: 'default' });
    expect(a.hash()).toBe(b.hash());
  });
});
