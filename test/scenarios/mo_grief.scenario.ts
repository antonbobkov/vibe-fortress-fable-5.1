import { expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { ItemsReader } from '@systems/items';
import type { MoraleReader } from '@systems/morale';
import { baseValue, personalityMultiplier, type ThoughtDef } from '@systems/morale';
import type { Scenario } from './runner';

/** T-M6-14: a friend's real death causes grief; an unburied body causes a standing thought until burial. */
const scenario: Scenario = {
  id: 'mo_grief', milestone: 6, seed: 'mo-grief', world: 'flat-test', embark: 'none',
  run: (w) => {
    const friend = w.spawnDwarf({ at: w.index(10, 10, 32) });
    const dead = w.spawnDwarf({ at: w.index(11, 10, 32) });
    const rel = w.game.world.entities.get(friend, C.Relationships)!;
    w.game.world.entities.add(friend, C.Relationships, { ...rel, friends: [dead] });
    w.spawnItem('drink', 'ale', w.index(9, 10, 32), 100);
    w.spawnItem('fine_meal', 'dimcap', w.index(9, 10, 32), 100);
    w.step(1);
    const hp = w.game.world.entities.get(dead, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: dead, attackerId: 0, part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CreatureDied').some((e) => e['id'] === dead), 5);
    const morale = w.readers.of<MoraleReader>('15');
    const def = w.game.registry.table<ThoughtDef>('thoughts').byId('friend_died')!;
    const traits = w.game.world.entities.get(friend, C.Personality)?.traits ?? [];
    expect(morale.thoughts(friend).find((t) => t.id === 'friend_died')?.value)
      .toBeCloseTo(baseValue(def) * personalityMultiplier(w.game.registry, traits, def, baseValue(def)), 2);
    w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === dead), 30);
    const items = w.readers.of<ItemsReader>('13');
    w.until(() => items.unburiedDead(w.tick), 4 * TICKS_PER_DAY);
    w.until(() => morale.thoughts(friend).some((t) => t.id === 'unburied_dead'), TICKS_PER_DAY + 10);
    w.build('coffin', w.index(12, 10, 32), 'granite');
    w.until(() => w.events('Buried').some((e) => e['dwarfId'] === dead), 1500);
    w.until(() => !items.unburiedDead(w.tick), 20);
    w.until(() => !morale.thoughts(friend).some((t) => t.id === 'unburied_dead'), 10);
    expect(morale.thoughts(friend).some((t) => t.id === 'buried_friend' && t.value > 0)).toBe(true);
    expect(morale.thoughts(friend).some((t) => t.id === 'memorial_placed')).toBe(false);
  },
};
export default scenario;
