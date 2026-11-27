/**
 * T-565, Making Do C6: the feast, mugs at the table and the Thane's seasonal whim (`10` § Feasts,
 * § The Thane's whim; `12` § Feasts; `14` § Mugs at the table; `15` § The Thane's whim).
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { contentRegistry } from '@content/loader';
import { C, type Item } from '@core/components';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import { WHIMS_STREAM, whimRows } from '@systems/dwarves/whims';
import { FEAST_RECIPE, eventPredicate, type ThoughtDef } from '@systems/morale/thoughts';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const items = registry.table<{ id: string; category: string; stack: number; rotDays: number; edible?: boolean; quality: boolean }>('items');
const materials = registry.table<{ id: string }>('materials');
const thoughts = registry.table<ThoughtDef>('thoughts');
const Z = 25;
const SEASON = TICKS_PER_DAY * DAYS_PER_SEASON;
const LABORS = registry.table<{ id: string }>('labors').ids();
const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

function world(seed: string, startTick?: number): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', ...(startTick === undefined ? {} : { startTick }) });
}

function b14(w: TestWorld): BuildingsReader {
  return w.readers.of<BuildingsReader>('14');
}

/** A dug, discovered room on the flat test map underground, and its tiles. */
function room(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  w.digRoom(x, y, Z, width, height);
  for (let yy = y - 1; yy <= y + height; yy += 1) for (let xx = x - 1; xx <= x + width; xx += 1) w.discover(w.index(xx, yy, Z));
  const out: TileIndex[] = [];
  for (let yy = y; yy < y + height; yy += 1) for (let xx = x; xx < x + width; xx += 1) out.push(w.index(xx, yy, Z));
  return out;
}

/** A dwarf with only `labor` on (none for '') and no needs pressing. */
function dwarf(w: TestWorld, at: TileIndex, labor = '', skills: Record<string, number> = {}): EntityId {
  const id = w.spawnDwarf({ at, skills });
  for (const l of LABORS) w.setLabor(id, l, l === labor);
  for (const need of NEEDS) w.setNeed(id, need, 0);
  return id;
}

function units(w: TestWorld, type: string): number {
  const t = items.index(type);
  let n = 0;
  for (const id of w.game.world.entities.with(C.Item)) {
    const it = w.game.world.entities.get(id, C.Item) as Item;
    if (it.type === t) n += it.count;
  }
  return n;
}

function thoughtIds(w: TestWorld, id: EntityId): string[] {
  return (w.game.world.entities.get(id, C.Mood)?.thoughts ?? []).map((t) => thoughts.byIndex(t.thought)?.id ?? '');
}

describe('T-565 the rows', () => {
  it('the feast, its recipe, five thoughts and eight whims', () => {
    expect(items.byId('feast')).toMatchObject({ category: 'food/meal/feast', stack: 20, rotDays: 1, edible: true, quality: true });
    const recipe = registry.table<{ id: string; workshop: string; inputs: unknown; outputs: unknown; quality: boolean }>('recipes').byId(FEAST_RECIPE);
    expect(recipe).toMatchObject({ workshop: 'kitchen', quality: true,
      inputs: [{ match: 'salt|honey|plant_food', count: 1, materials: ['salt', 'honey', 'wyrmtongue'] }, { match: 'ingredient', count: 6, distinct: true }],
      outputs: [{ item: 'feast', count: 20, material: { from: 'input', index: 1 } }] });
    for (const m of ['salt', 'honey', 'wyrmtongue']) expect(materials.has(m), m).toBe(true);
    const buildings = registry.table<{ id: string; wants?: unknown }>('buildings');
    expect(buildings.byId('table')?.wants).toEqual([{ match: 'mug', count: 1, per: 'chair', max: 4 }]);
    const t = (id: string): ThoughtDef => thoughts.byId(id) as ThoughtDef;
    expect(t('feasted')).toMatchObject({ value: 8, hours: 48, group: 'comfort' });
    expect(t('held_a_feast')).toMatchObject({ value: 3, hours: 72, group: 'social' });
    expect(t('drank_from_a_mug')).toMatchObject({ value: 1, hours: 24, group: 'room' });
    expect(t('thane_pleased')).toMatchObject({ value: 3, hours: 72, group: 'social' });
    expect(t('thane_grumbled')).toMatchObject({ hours: 72, group: 'none' });
    expect(eventPredicate(t('feasted'), { type: 'MealEaten', id: 1, feast: true }, registry)).toBe(true);
    expect(eventPredicate(t('feasted'), { type: 'MealEaten', id: 1 }, registry)).toBe(false);
    expect(eventPredicate(t('drank_from_a_mug'), { type: 'MealEaten', id: 1, mug: true }, registry)).toBe(true);
    expect(eventPredicate(t('held_a_feast'), { type: 'ItemCrafted', recipeId: FEAST_RECIPE }, registry)).toBe(true);
    expect(eventPredicate(t('held_a_feast'), { type: 'ItemCrafted', recipeId: 'cook_fine_meal' }, registry)).toBe(false);
    expect(eventPredicate(t('thane_pleased'), { type: 'WhimJudged', met: true }, registry)).toBe(true);
    expect(eventPredicate(t('thane_grumbled'), { type: 'WhimJudged', met: true }, registry)).toBe(false);
    expect(eventPredicate(t('thane_grumbled'), { type: 'WhimJudged', met: false }, registry)).toBe(true);
    expect(whimRows(registry).map((r) => r.id)).toEqual(['whim_lantern', 'whim_mead', 'whim_ivory_statue', 'whim_fine_meal',
      'whim_cheese', 'whim_spirits', 'whim_masterwork', 'whim_featherbed', 'whim_statue_hall', 'whim_hall_tier', 'whim_engraved_room',
      'whim_fine_furniture', 'whim_superior']);
    expect(whimRows(registry).find((r) => r.id === 'whim_featherbed')).toMatchObject({ kind: 'room', item: 'bed', bedding: 'feather', zone: 'bedroom', thane: true });
    expect(whimRows(registry).find((r) => r.id === 'whim_masterwork')).toMatchObject({ kind: 'stock', item: 'any', quality: 5, count: 1 });
  });
});

describe('T-565 the feast', () => {
  it('the kitchen cooks six stacks and a salt into a stack of 20 servings; everyone holds the feast', () => {
    const w = world('t565-cook');
    room(w, 10, 10, 14, 10);
    const kitchen = w.build('kitchen', w.index(11, 11, Z), 'granite');
    const cook = dwarf(w, w.index(20, 18, Z), 'cooking', { cooking: 5 });
    const other = dwarf(w, w.index(22, 12, Z));
    for (let k = 0; k < 6; k += 1) w.spawnItem('plant_food', 'dimcap', w.index(16 + k, 17, Z), 1);
    w.spawnItem('salt', 'salt', w.index(18, 19, Z), 1);
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: kitchen, order: { recipeId: FEAST_RECIPE, mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    w.until(() => units(w, 'feast') > 0, 4000);
    expect(units(w, 'feast')).toBe(20);
    // Of the first ingredient, seasoned with the salt.
    const feast = w.game.world.entities.with(C.Item).map((id) => w.game.world.entities.get(id, C.Item) as Item).find((it) => it.type === items.index('feast')) as Item;
    expect(materials.byIndex(feast.material)?.id).toBe('dimcap');
    expect(feast.seasoned).toEqual([materials.index('salt')]);
    expect(units(w, 'plant_food')).toBe(0);
    expect(units(w, 'salt')).toBe(0);
    w.step(20);
    expect(thoughtIds(w, cook)).toContain('held_a_feast');
    expect(thoughtIds(w, other)).toContain('held_a_feast');
  }, 120_000);

  it('a hungry dwarf takes a serving of the feast before a lavish meal nearer to it', () => {
    const w = world('t565-eat');
    room(w, 10, 10, 14, 6);
    w.spawnItem('lavish_meal', 'boar_meat', w.index(13, 12, Z), 2, 2);
    w.spawnItem('feast', 'boar_meat', w.index(22, 14, Z), 20, 2);
    const id = dwarf(w, w.index(12, 12, Z));
    w.setNeed(id, 'hunger', 80);
    w.until((v) => v.events('MealEaten').some((e) => e['id'] === id), 3000);
    const meal = w.events('MealEaten').find((e) => e['id'] === id) as GameEvent;
    expect(meal).toMatchObject({ mealType: 'feast', feast: true, kind: 'meal' });
    expect(units(w, 'feast')).toBe(19);
    w.step(20);
    expect(thoughtIds(w, id)).toContain('feasted');
  }, 120_000);
});

describe('T-565 mugs at the table', () => {
  it('a table wants a mug per chair beside it, up to four; a meal at a seat with its mug is drunk from it', () => {
    const w = world('t565-mug');
    const tiles = room(w, 10, 10, 8, 5);
    w.zone('dining_hall', tiles);
    const table = w.build('table', w.index(12, 12, Z), 'oak');
    expect(b14(w).wants(table)).toEqual([{ match: 'mug', count: 0, held: 0, coming: 0 }]);
    const chairA = w.build('chair', w.index(13, 12, Z), 'oak');
    const chairB = w.build('chair', w.index(11, 12, Z), 'oak');
    expect(b14(w).wants(table)[0]).toMatchObject({ count: 2, held: 0 });
    expect(b14(w).seatHasMug(chairA)).toBe(false);
    // One mug: the first chair by id has it, the second not.
    w.spawnItem('mug', 'oak', w.index(16, 14, Z), 1);
    dwarf(w, w.index(16, 13, Z), 'hauling');
    w.until(() => b14(w).held(table).length > 0, 2000);
    expect(b14(w).wants(table)[0]).toMatchObject({ count: 2, held: 1 });
    expect(b14(w).seatHasMug(Math.min(chairA, chairB))).toBe(true);
    expect(b14(w).seatHasMug(Math.max(chairA, chairB))).toBe(false);
    // A second mug, and the hungry dwarf at either seat drinks from a mug.
    w.spawnItem('mug', 'oak', w.index(16, 14, Z), 1);
    w.until(() => (b14(w).wants(table)[0]?.held ?? 0) >= 2, 2000);
    expect(b14(w).seatHasMug(chairA) && b14(w).seatHasMug(chairB)).toBe(true);
    w.spawnItem('easy_meal', 'boar_meat', w.index(16, 11, Z), 2, 2);
    const eater = dwarf(w, w.index(15, 11, Z));
    w.setNeed(eater, 'hunger', 80);
    w.until((v) => v.events('MealEaten').some((e) => e['id'] === eater), 3000);
    expect(w.events('MealEaten').find((e) => e['id'] === eater)).toMatchObject({ atTable: true, mug: true });
    w.step(20);
    expect(thoughtIds(w, eater)).toContain('drank_from_a_mug');
  }, 120_000);
});

describe('T-565 the Thane\'s whim', () => {
  const thaneOf = (w: TestWorld, id: EntityId): void => {
    expect(w.game.world.applyCommand({ type: 'AssignTitle', dwarfId: id, title: 'thane' })).toEqual({ ok: true });
  };

  it('no Thane, no whim and no draw; a Thane with a kiln wishes for what a kiln can make', () => {
    const none = world('t565-none', SEASON - 5);
    room(none, 10, 10, 8, 5);
    dwarf(none, none.index(12, 12, Z));
    none.build('kiln', none.index(14, 11, Z), 'granite');
    none.spawnItem('stone_block', 'glass', none.index(16, 13, Z));
    none.spawnItem('candle', 'tallow', none.index(17, 13, Z));
    none.step(10);
    expect(none.events('SeasonChanged').length).toBe(1);
    expect(none.events('WhimSet')).toEqual([]);
    expect(none.game.world.rngState().some((r) => r.id === WHIMS_STREAM)).toBe(false);

    const w = world('t565-kiln', SEASON - 5);
    room(w, 10, 10, 8, 5);
    const thane = dwarf(w, w.index(12, 12, Z));
    thaneOf(w, thane);
    w.build('kiln', w.index(14, 11, Z), 'granite');
    // The glass block and the candle a lantern takes (10 § The Thane's whim: its inputs at hand).
    w.spawnItem('stone_block', 'glass', w.index(16, 13, Z));
    w.spawnItem('candle', 'tallow', w.index(17, 13, Z));
    w.step(10);
    const set = w.events('WhimSet');
    expect(set.length).toBe(1);
    expect(set[0]).toMatchObject({ thaneId: thane });
    // A kiln makes lanterns and quality goods; nothing it makes is mead, ivory or a meal, and no
    // dwarf of level 0 could roll a masterwork.
    expect(set[0]?.['whimId']).toBe('whim_lantern');
    expect(w.readers.of<DwarvesReader>('10').whim()).toMatchObject({ id: set[0]?.['whimId'], met: false });
  }, 60_000);

  it('a lantern in the dining hall by the season\'s end pleases everyone; it survives a save', () => {
    const w = world('t565-met', 2 * SEASON - 5);
    const tiles = room(w, 10, 10, 8, 5);
    w.zone('dining_hall', tiles);
    w.build('table', w.index(12, 12, Z), 'oak');
    w.build('chair', w.index(13, 12, Z), 'oak');
    const thane = dwarf(w, w.index(15, 13, Z));
    const other = dwarf(w, w.index(16, 13, Z));
    thaneOf(w, thane);
    w.dwarves.whim = { id: 'whim_lantern', setTick: SEASON };
    expect(w.readers.of<DwarvesReader>('10').whim()).toEqual({ id: 'whim_lantern', text: 'a lantern in the dining hall', met: false, kind: 'room', count: 1, have: 0, kept: false });
    w.build('lantern', w.index(16, 11, Z), 'glass');
    expect(w.readers.of<DwarvesReader>('10').whim()?.met).toBe(true);
    const loaded = roundTrip(w.game).game;
    w.replaceGame(loaded);
    expect(w.dwarves.whim).toEqual({ id: 'whim_lantern', setTick: SEASON });
    w.step(10);
    expect(w.events('WhimJudged')).toEqual([expect.objectContaining({ thaneId: thane, whimId: 'whim_lantern', met: true })]);
    w.step(20);
    expect(thoughtIds(w, thane)).toContain('thane_pleased');
    expect(thoughtIds(w, other)).toContain('thane_pleased');
    expect(thoughtIds(w, thane)).not.toContain('thane_grumbled');
  }, 60_000);

  it('a whim missed grumbles the Thane alone, and nobody else anything', () => {
    const w = world('t565-missed', 2 * SEASON - 5);
    room(w, 10, 10, 8, 5);
    const thane = dwarf(w, w.index(15, 13, Z));
    const other = dwarf(w, w.index(16, 13, Z));
    thaneOf(w, thane);
    w.dwarves.whim = { id: 'whim_mead', setTick: SEASON };
    w.spawnItem('drink', 'mead', w.index(12, 12, Z), 5);
    w.step(10);
    expect(w.events('WhimJudged')).toEqual([expect.objectContaining({ thaneId: thane, whimId: 'whim_mead', met: false })]);
    w.step(20);
    expect(thoughtIds(w, thane)).toContain('thane_grumbled');
    expect(thoughtIds(w, other)).not.toContain('thane_grumbled');
    expect(thoughtIds(w, other)).not.toContain('thane_pleased');
  }, 60_000);
});
