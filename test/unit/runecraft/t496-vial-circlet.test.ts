/**
 * T-496: a vial fills up to the circlet-aware maximum (`25-runecraft.md` § Vials, § Rune of one's own).
 *
 * A vial is drunk only below the held spell's cost (at most 3), so the cap bites only where the plain
 * maximum is within a vial of the cost: a caster of level 1 (plain maximum 5) holding a Call (cost 3).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Equipment } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import { weaponOf } from '@systems/combat';
import { SICK_VIAL_PERCENT, VIAL_RUNE, VIALS_PER_DAY } from '@systems/magic/constants';
import { drinkVial } from '@systems/magic/cast';
import type { MagicReader } from '@systems/magic';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;

function ctxOf(w: TestWorld): TickContext {
  return {
    world: w.game.world, registry, tick: w.tick, readers: w.readers,
    emit: (e: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(e),
  } as unknown as TickContext;
}

/** A level-1 caster at `current` milli-rune holding a wand of glowstone (Call, cost 3), with two vials. */
function setup(seed: string, current: number, circlet: boolean, drunk = 0): { w: TestWorld; mage: EntityId } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const at: TileIndex = w.index(30, 30, Z);
  const mage = w.spawnDwarf({ at, skills: { runecraft: 1 } });
  const items = w.game.world.services.items!;
  const wand = w.spawnItem('wand', 'oak', at, 1, 1);
  w.game.world.entities.add(wand, C.Item, { ...w.game.world.entities.get(wand, C.Item)!, stone: registry.table('materials').index('glowstone') });
  items.attachToCarrier(wand, mage);
  items.setOwner(wand, mage);
  let eq = w.game.world.entities.get(mage, C.Equipment) as Equipment;
  eq = { ...eq, weapon: wand };
  if (circlet) {
    const c = w.spawnItem('circlet', 'silver', at);
    items.attachToCarrier(c, mage);
    eq = { ...eq, armor: { ...eq.armor, head: c } };
  }
  w.game.world.entities.add(mage, C.Equipment, eq);
  items.attachToCarrier(w.spawnItem('rune_vial', 'rune', at, 2), mage);
  w.game.world.entities.add(mage, C.Rune, { current, vialsToday: drunk });
  return { w, mage };
}

const drink = (w: TestWorld, mage: EntityId): boolean => drinkVial(ctxOf(w), mage, weaponOf(w.game.world.entities, registry, mage), new Map());
const rune = (w: TestWorld, mage: EntityId): number => w.game.world.entities.get(mage, C.Rune)!.current;

describe('T-496 a vial is capped at the circlet-aware maximum', () => {
  it('a caster in a silver circlet at 2 rune drinks a vial and reaches 7, its maximum 15; without the circlet it stops at 5', () => {
    const worn = setup('t496-circlet', 2000, true);
    expect(worn.w.readers.of<MagicReader>('25').rune(worn.mage)).toMatchObject({ max: 15_000, maxBonus: 10 });
    expect(drink(worn.w, worn.mage)).toBe(true);
    expect(rune(worn.w, worn.mage)).toBe(2000 + VIAL_RUNE * 1000);

    const bare = setup('t496-bare', 2000, false);
    expect(drink(bare.w, bare.mage)).toBe(true);
    expect(rune(bare.w, bare.mage)).toBe(5000);
  });

  it('the desperate fourth is capped at the same maximum: 2.9 rune and half a vial reach 5.4', () => {
    const { w, mage } = setup('t496-sick', 2900, true, VIALS_PER_DAY);
    const goblin = w.spawnCreature('gloam_warrior', w.index(31, 31, Z), 'hostile:gloam');
    w.game.world.services.combat!.setTarget(mage, goblin);
    expect(drink(w, mage)).toBe(true);
    expect(rune(w, mage)).toBe(2900 + (VIAL_RUNE * 1000 * SICK_VIAL_PERCENT) / 100);
  });
});
