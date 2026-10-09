import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';

const Z = 32;

/** The setup of `fo_hunt`, plus a dwarf's corpse lying far away (the T-115 orders probe). */
function huntWorld(seed: string, withButcher: boolean): { w: TestWorld; hunter: number; deer: number; old: number; butcher: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const ent = w.game.world.entities;
  const victim = w.spawnDwarf({ at: w.index(45, 45, Z), ageYears: 30 });
  w.step(2);
  const hp = ent.get(victim, C.Body)!.parts[1]!.maxHp;
  w.game.world.emit({ type: 'DamageDealt', defenderId: victim, attackerId: 0, part: 'torso', damageType: 'blunt', amount: hp * 2 });
  w.until(() => ent.with(C.Corpse).length > 0, 200);
  const old = ent.with(C.Corpse)[0] as number;
  const butcher = withButcher ? w.build('butcher', w.index(20, 20, Z)) : 0;
  const hunter = w.spawnDwarf({ at: w.index(21, 20, Z), skills: { crossbow: 10, hunting: 5, butchery: 5 } });
  const items = w.game.registry.table('items');
  const iron = w.game.registry.table('materials').index('iron');
  const crossbow = w.spawnItem(items.index('crossbow'), iron, w.index(21, 20, Z));
  const bolts = w.spawnItem(items.index('bolt'), iron, w.index(21, 20, Z), 20);
  ent.add(hunter, C.Equipment, { weapon: crossbow, shield: 0, armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
    clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver: bolts });
  const deer = w.game.world.services.spawn.creature(w.game.registry.table('creatures').index('deer'), w.index(25, 20, Z), 'wild');
  return { w, hunter, deer, old, butcher };
}

describe('T-183 a hunter carries its own kill and nothing else', () => {
  it('the deer is delivered to the butcher and the dwarf corpse is left where it lay', () => {
    const { w, hunter, old } = huntWorld('t183-hunt', true);
    const ent = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const oldTile = items.tileOf(old);
    const carried = new Set<number>();
    w.until((v) => {
      const c = ent.get(hunter, C.Worker)?.carrying ?? 0;
      if (c !== 0) carried.add(c);
      return v.events('ButcheryDone').length > 0;
    }, 2 * TICKS_PER_DAY);
    expect(w.events('HuntKill')).toHaveLength(1);
    expect(carried.has(old)).toBe(false);
    expect(items.tileOf(old)).toBe(oldTile);
    expect(ent.alive(old)).toBe(true);
    expect(w.events('ButcheryDone')[0]).toMatchObject({ species: 'deer' });
    expect(carried.size).toBe(1);
  }, 120_000);

  it('with no butcher the hunter sets its own kill down where it stands and takes no other corpse', () => {
    const { w, hunter, deer, old } = huntWorld('t183-nobutcher', false);
    const deerSpecies = w.game.world.entities.get(deer, C.Creature)!.species;
    const ent = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const oldTile = items.tileOf(old);
    const carried = new Set<number>();
    w.until((v) => {
      const c = ent.get(hunter, C.Worker)?.carrying ?? 0;
      if (c !== 0) carried.add(c);
      return v.events('JobCompleted').some((e) => e['jobType'] === 'hunt');
    }, 2 * TICKS_PER_DAY);
    expect(carried.has(old)).toBe(false);
    expect(items.tileOf(old)).toBe(oldTile);
    expect(carried.size).toBe(1);
    const [kill] = [...carried] as number[];
    expect(ent.get(kill as number, C.Corpse)?.species).toBe(deerSpecies);
    expect(ent.get(hunter, C.Worker)?.carrying).toBe(0);
  }, 120_000);
});
