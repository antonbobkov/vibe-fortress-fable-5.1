/**
 * T-806: the Thane wishes for the builder's things (a statue in the hall, a grander hall, an engraved
 * bedroom, a fine table and chair, a superior work), keeps the drink a whim asks for from the
 * fortress's throats, and does not wish for the same thing twice running while another is possible
 * (`10` § The Thane's whim).
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import { whimFacts, whimPossible, whimRows } from '@systems/dwarves/whims';
import { TestWorld } from '../scenarios/test-world';

const Z = 25;
const SEASON = TICKS_PER_DAY * DAYS_PER_SEASON;
const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

function world(seed: string, startTick?: number): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', ...(startTick === undefined ? {} : { startTick }) });
  w.digRoom(10, 10, Z, 14, 8);
  for (let y = 9; y <= 18; y += 1) for (let x = 9; x <= 24; x += 1) w.discover(w.index(x, y, Z));
  return w;
}

function rect(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let yy = y; yy < y + height; yy += 1) for (let xx = x; xx < x + width; xx += 1) out.push(w.index(xx, yy, Z));
  return out;
}

function dwarf(w: TestWorld, x: number, skills: Record<string, number> = {}): EntityId {
  const id = w.spawnDwarf({ at: w.index(x, 16, Z), skills });
  for (const need of NEEDS) w.setNeed(id, need, 0);
  return id;
}

function thaneOf(w: TestWorld, id: EntityId): void {
  expect(w.game.world.applyCommand({ type: 'AssignTitle', dwarfId: id, title: 'thane' })).toEqual({ ok: true });
}

function possible(w: TestWorld, thane: EntityId = 0): string[] {
  const facts = whimFacts(w.readers.of<DwarvesReader>('10'), w.game.world.entities);
  return whimRows(w.game.registry).filter((row) => whimPossible(w.readers, w.game.registry, row, facts, thane)).map((row) => row.id);
}

function view(w: TestWorld) {
  return w.readers.of<DwarvesReader>('10').whim();
}

/** A piece of furniture built from an item of `quality`. */
function furniture(w: TestWorld, type: string, x: number, y: number, quality: number): EntityId {
  const item = w.spawnItem(type, 'oak', w.index(x, y, Z));
  w.game.world.entities.get(item, C.Item)!.quality = quality as never;
  return w.build(type, w.index(x, y, Z), 'oak', 0, item);
}

describe('T-806 the builder\'s whims', () => {
  it('five rows, each of its kind', () => {
    const rows = whimRows(new TestWorld({ seed: 't806-rows', world: 'flat-test', embark: 'none' }).game.registry);
    expect(rows.find((r) => r.id === 'whim_statue_hall')).toMatchObject({ kind: 'room', item: 'statue', zone: 'hearth_hall', count: 1 });
    expect(rows.find((r) => r.id === 'whim_hall_tier')).toMatchObject({ kind: 'tier', zone: 'hearth_hall' });
    expect(rows.find((r) => r.id === 'whim_engraved_room')).toMatchObject({ kind: 'engraved', zone: 'bedroom', thane: true });
    expect(rows.find((r) => r.id === 'whim_fine_furniture')).toMatchObject({ kind: 'room', item: 'table', also: 'chair', quality: 2, zone: 'dining_hall' });
    expect(rows.find((r) => r.id === 'whim_superior')).toMatchObject({ kind: 'stock', item: 'any', quality: 3, count: 1 });
  });

  it('a statue in the hall: possible with a statue at hand, met by one built in the hearth hall', () => {
    const w = world('t806-statue');
    const thane = dwarf(w, 12);
    thaneOf(w, thane);
    expect(possible(w, thane)).not.toContain('whim_statue_hall');
    const statue = w.spawnItem('statue', 'granite', w.index(20, 16, Z));
    expect(possible(w, thane)).toContain('whim_statue_hall');
    w.build('hearth', w.index(14, 12, Z), 'granite');
    w.zone('hearth_hall', rect(w, 11, 10, 8, 5));
    w.dwarves.whim = { id: 'whim_statue_hall', setTick: 0 };
    expect(view(w)).toMatchObject({ kind: 'room', have: 0, count: 1, met: false });
    w.build('statue', w.index(17, 11, Z), 'granite', 0, statue);
    expect(view(w)).toMatchObject({ have: 1, met: true });
  });

  it('a grander hall: possible with a hearth below royal; the draw wishes for one tier up, met when the hall reaches it', () => {
    const w = world('t806-tier', SEASON - 5);
    const thane = dwarf(w, 12);
    thaneOf(w, thane);
    expect(possible(w, thane)).not.toContain('whim_hall_tier');
    w.build('hearth', w.index(14, 12, Z), 'granite');
    const b14 = w.readers.of<BuildingsReader>('14');
    const tier = b14.hearthHallTier();
    expect(tier).toBeLessThan(5);
    // The hearth is the only thing built: a grander hall is the only wish the fortress could answer.
    expect(possible(w, thane)).toEqual(['whim_hall_tier']);
    w.step(10);
    expect(w.events('WhimSet')).toEqual([expect.objectContaining({ whimId: 'whim_hall_tier' })]);
    expect(w.dwarves.whim).toMatchObject({ id: 'whim_hall_tier', target: tier + 1 });
    expect(view(w)).toMatchObject({ kind: 'tier', have: tier, count: tier + 1, met: false });
    // Smoothing and engraving the 5×5 around the hearth raises the implicit hall.
    for (const t of b14.hearthHallTiles()) { w.map.setFlag(t, TileFlag.Smoothed, true); w.map.setFlag(t, TileFlag.Engraved, true); }
    expect(b14.hearthHallTier()).toBeGreaterThan(tier);
    expect(view(w)?.met).toBe(true);
  });

  it('an engraved bedroom: possible while the Thane\'s bedroom has a smoothed tile not engraved; met when every one is', () => {
    const w = world('t806-engraved');
    const thane = dwarf(w, 12);
    thaneOf(w, thane);
    const tiles = rect(w, 20, 11, 2, 2);
    const bedroom = w.zone('bedroom', tiles);
    w.build('bed', tiles[0] as TileIndex, 'oak');
    expect(w.game.world.applyCommand({ type: 'AssignRoom', zoneId: bedroom, dwarfId: thane })).toEqual({ ok: true });
    expect(possible(w, thane)).not.toContain('whim_engraved_room');
    for (const t of tiles) w.map.setFlag(t, TileFlag.Smoothed, true);
    expect(possible(w, thane)).toContain('whim_engraved_room');
    // Another dwarf's bedroom is no reason: the row is the Thane's own.
    expect(possible(w, 0)).not.toContain('whim_engraved_room');
    w.dwarves.whim = { id: 'whim_engraved_room', setTick: 0 };
    expect(view(w)).toMatchObject({ kind: 'engraved', have: 0, count: 4, met: false });
    for (const t of tiles.slice(0, 3)) w.map.setFlag(t, TileFlag.Engraved, true);
    expect(view(w)).toMatchObject({ have: 3, count: 4, met: false });
    w.map.setFlag(tiles[3] as TileIndex, TileFlag.Engraved, true);
    expect(view(w)).toMatchObject({ have: 4, count: 4, met: true });
    expect(possible(w, thane)).not.toContain('whim_engraved_room');
  });

  it('a fine table and chair: both of fine quality or better, both in the dining hall', () => {
    const w = world('t806-furniture');
    const thane = dwarf(w, 12);
    thaneOf(w, thane);
    // A carpenter of level 3 could roll fine (its top roll is 3 × 5 + 40 = 55); of level 2 not.
    w.build('carpenter', w.index(20, 11, Z), 'oak');
    w.spawnItem('log', 'oak', w.index(22, 17, Z), 4);
    w.setSkill(thane, 'carpentry', 2);
    expect(possible(w, thane)).not.toContain('whim_fine_furniture');
    w.setSkill(thane, 'carpentry', 3);
    expect(possible(w, thane)).toContain('whim_fine_furniture');
    w.zone('dining_hall', rect(w, 11, 10, 6, 4));
    w.dwarves.whim = { id: 'whim_fine_furniture', setTick: 0 };
    furniture(w, 'table', 12, 11, 2);
    furniture(w, 'chair', 13, 11, 1);
    expect(view(w)).toMatchObject({ have: 0, met: false });
    furniture(w, 'chair', 12, 12, 3);
    expect(view(w)).toMatchObject({ have: 1, met: true });
  });

  it('a superior work: in stock, or a dwarf whose top roll reaches 75 (level 7) at a quality recipe at hand', () => {
    const w = world('t806-superior');
    const thane = dwarf(w, 12);
    thaneOf(w, thane);
    w.build('craftdwarf', w.index(20, 11, Z), 'granite');
    w.spawnItem('raw_stone', 'granite', w.index(22, 17, Z), 2);
    w.setSkill(thane, 'crafting', 6);
    expect(possible(w, thane)).not.toContain('whim_superior');
    w.setSkill(thane, 'crafting', 7);
    expect(possible(w, thane)).toContain('whim_superior');
    const other = world('t806-superior-stock');
    const t2 = dwarf(other, 12);
    const figurine = other.spawnItem('figurine', 'granite', other.index(20, 16, Z));
    other.game.world.entities.get(figurine, C.Item)!.quality = 3 as never;
    expect(possible(other, t2)).toContain('whim_superior');
  });
});

describe('T-806 the Thane\'s deepfire is the Thane\'s', () => {
  function cellar(seed: string): { w: TestWorld; thirsty: EntityId; deepfire: EntityId } {
    const w = world(seed);
    const thane = dwarf(w, 12);
    thaneOf(w, thane);
    const near = w.spawnItem('barrel', 'pine', w.index(14, 16, Z));
    const deepfire = w.spawnItem('drink', 'deepfire', { containerId: near }, 6);
    const far = w.spawnItem('barrel', 'pine', w.index(22, 11, Z));
    w.spawnItem('drink', 'ale', { containerId: far }, 10);
    const thirsty = dwarf(w, 13);
    return { w, thirsty, deepfire };
  }

  it('a standing whim for deepfire keeps the barrel: the thirsty walk past it to the ale', () => {
    const { w, thirsty } = cellar('t806-kept');
    w.dwarves.whim = { id: 'whim_spirits', setTick: 0 };
    expect(view(w)).toMatchObject({ have: 6, count: 10, kept: true });
    w.setNeed(thirsty, 'thirst', 90);
    w.until((v) => v.events('DrankAlcohol').some((e) => e['id'] === thirsty), 3000);
    const material = w.game.registry.table('materials');
    expect(w.events('DrankAlcohol').find((e) => e['id'] === thirsty)?.['material']).toBe(material.index('ale'));
    expect(view(w)?.have).toBe(6);
  });

  it('without the whim, or above its count, the nearer deepfire is drunk', () => {
    const { w, thirsty } = cellar('t806-drunk');
    w.setNeed(thirsty, 'thirst', 90);
    w.until((v) => v.events('DrankAlcohol').some((e) => e['id'] === thirsty), 3000);
    const material = w.game.registry.table('materials');
    expect(w.events('DrankAlcohol').find((e) => e['id'] === thirsty)?.['material']).toBe(material.index('deepfire'));

    const more = cellar('t806-more');
    more.w.spawnItem('drink', 'deepfire', { containerId: more.w.game.world.entities.get(more.deepfire, C.Item)!.containerId }, 6);
    more.w.dwarves.whim = { id: 'whim_spirits', setTick: 0 };
    expect(view(more.w)?.have).toBe(12);
    more.w.setNeed(more.thirsty, 'thirst', 90);
    more.w.until((v) => v.events('DrankAlcohol').some((e) => e['id'] === more.thirsty), 3000);
    expect(more.w.events('DrankAlcohol').find((e) => e['id'] === more.thirsty)?.['material']).toBe(material.index('deepfire'));
  });
});

describe('T-806 no wish twice running', () => {
  it('the whim just judged is not drawn again while another is possible', () => {
    const w = world('t806-repeat', SEASON - 5);
    const thane = dwarf(w, 12);
    thaneOf(w, thane);
    w.build('hearth', w.index(14, 12, Z), 'granite');
    w.spawnItem('statue', 'granite', w.index(20, 16, Z));
    expect(possible(w, thane)).toEqual(expect.arrayContaining(['whim_statue_hall', 'whim_hall_tier']));
    expect(possible(w, thane)).toHaveLength(2);
    w.dwarves.whim = { id: 'whim_statue_hall', setTick: 0 };
    w.step(10);
    expect(w.events('WhimSet')).toEqual([expect.objectContaining({ whimId: 'whim_hall_tier' })]);

    // With one row possible, it is drawn again.
    const one = world('t806-again', SEASON - 5);
    const t1 = dwarf(one, 12);
    thaneOf(one, t1);
    one.build('hearth', one.index(14, 12, Z), 'granite');
    expect(possible(one, t1)).toEqual(['whim_hall_tier']);
    one.dwarves.whim = { id: 'whim_hall_tier', setTick: 0, target: 5 };
    one.step(10);
    expect(one.events('WhimSet')).toEqual([expect.objectContaining({ whimId: 'whim_hall_tier' })]);
  });
});
