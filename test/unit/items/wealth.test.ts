import { describe, expect, it } from 'vitest';
import { C, ItemFlag, type Party } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { roundTrip } from '@app/game-save';
import { ItemsSystem, type ItemsReader } from '@systems/items';
import { spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';

function kit(seed: string, role = 'warriors') {
  const w = new TestWorld({ world: 'flat-test', embark: 'none', seed });
  const at = w.index(0, 0, 32);
  const partyId = w.game.world.entities.create('party');
  const party: Party = {
    civ: 'gloam', purpose: 'raid', members: [], leaderId: 0, state: 'engage',
    goalTile: at, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1,
  };
  w.game.world.entities.add(partyId, C.Party, party);
  const hostile = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
    partyId, role === 'archers' ? 'gloam_archer' : 'gloam_warrior', role, at, 3, false);
  const items = w.readers.of<ItemsReader>('13');
  const gear = items.carriedItems(hostile);
  expect(gear.length).toBeGreaterThan(0);
  return { w, at, party, hostile, items, gear };
}

describe('T-M8-06 wealth: fortress possession and hostile loot', () => {
  it('D-219: living raiders and their departed edge equipment add no fortress wealth or stocks', () => {
    const { w, party, hostile, items, gear } = kit('wealth-live-and-departed');
    expect(gear.reduce((sum, id) => sum + items.value(id), 0)).toBeGreaterThan(0);
    expect(items.wealth()).toBe(0);
    for (const id of gear) expect(items.count(items.get(id)!.type)).toBe(0);
    party.state = 'retreat';
    w.step(11);
    expect(w.game.world.entities.alive(hostile)).toBe(false);
    expect(items.wealth()).toBe(0);
    expect(w.game.world.fortress.wealthCached).toBe(0);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    expect(loaded.world.readers.of<ItemsReader>('13').wealth()).toBe(0);
  });

  it('a hostile corpse and its unstripped gear count only when a real strip job recovers the gear', () => {
    const { w, hostile, items } = kit('wealth-strip');
    // Health performs the death and emits its normal faction and worn-item payload.
    w.game.world.emit({ type: 'Starvation', id: hostile });
    w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === hostile), 60);
    const corpseId = w.events('CorpseCreated').find((e) => e['creatureId'] === hostile)!['id'] as number;
    const worn = w.game.world.entities.get(corpseId, C.Corpse)!.wornItems.slice();
    const lootValue = worn.reduce((sum, id) => sum + items.value(id), 0);
    expect(lootValue).toBeGreaterThan(0);
    expect(items.wealth()).toBe(0);
    const worker = w.spawnDwarf({ at: w.index(1, 1, 32) });
    w.setLabor(worker, 'hauling', true);
    const before = items.wealth();
    w.until(() => w.events('JobCompleted').some((e) => e['jobType'] === 'strip_corpse'), 2000);
    expect(w.game.world.entities.get(corpseId, C.Corpse)?.wornItems).toEqual([]);
    expect(items.wealth()).toBe(before + lootValue);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    w.step(20);
    loaded.step(20);
    expect(loaded.hash()).toBe(w.hash());
    expect(items.wealth()).toBe(before + lootValue);
    const core = (w.game.world.scheduler.byId('13') as ItemsSystem).core;
    expect(core.recount().wealth).toBe(core.wealth);
    w.items.attachToCarrier(corpseId, worker);
    expect(items.wealth()).toBe(before + lootValue + items.value(corpseId));
  });

  it('dropped and split hostile ammunition stays excluded until fortress pickup, counted once', () => {
    const { w, at, hostile, items, gear } = kit('wealth-split-ammunition', 'archers');
    const arrowType = w.game.registry.table('items').index('arrow');
    const arrows = gear.find((id) => items.get(id)?.type === arrowType)!;
    expect(items.get(arrows)?.count).toBeGreaterThan(3);
    const part = w.items.split(arrows, 3);
    w.items.dropAt(part, at);
    expect(items.wealth()).toBe(0);
    expect(items.countMatching({ type: arrowType })).toBe(0);
    const fortressCarrier = w.spawnCreature('dwarf', at, 'fortress');
    w.items.attachToCarrier(part, fortressCarrier);
    expect(items.wealth()).toBe(items.value(part));
    expect(items.count(arrowType)).toBe(3);
    expect(items.countMatching({ type: arrowType })).toBe(3);
    w.items.dropAt(part, at);
    w.items.attachToCarrier(part, fortressCarrier);
    expect(items.wealth()).toBe(items.value(part));
    expect(items.get(arrows)?.carriedBy).toBe(hostile);
    expect(roundTrip(w.game).game.hash()).toBe(w.hash());
  });

  it('fortress goods on an edge and building value count; merchant ownership still controls trade value', () => {
    const w = new TestWorld({ world: 'flat-test', embark: 'none', seed: 'wealth-own-edge' });
    const items = w.readers.of<ItemsReader>('13');
    const log = w.spawnItem('log', 'oak', w.index(0, 0, 32));
    expect(items.wealth()).toBe(items.value(log));
    w.items.setFlag(log, ItemFlag.Merchant, true);
    expect(items.wealth()).toBe(0);
    w.items.setFlag(log, ItemFlag.Merchant, false);
    expect(items.wealth()).toBe(items.value(log));
    const wall = w.build('wall', w.index(4, 4, 32), 'granite');
    w.step(11);
    const value = w.events('BuildingCompleted').find((e) => e['id'] === wall)!['value'] as number;
    expect(value).toBeGreaterThan(0);
    expect(items.wealth()).toBe(items.value(log) + value);
  });

  it('a death queued between item ticks saves its foreign origin; carrying the corpse recovers its contents', () => {
    const { w, at, hostile, items } = kit('wealth-queued-death');
    w.step(5);
    w.game.world.emit({ type: 'Starvation', id: hostile });
    w.step(1);
    expect(w.events('CorpseCreated')).toHaveLength(0);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    const cadence = (w.game.world.scheduler.byId('13') as ItemsSystem).cadence;
    for (let tick = 0; tick < cadence && w.events('CorpseCreated').length === 0; tick += 1) {
      w.step(1);
      loaded.step(1);
      expect(loaded.hash()).toBe(w.hash());
    }
    const corpseId = w.events('CorpseCreated').find((e) => e['creatureId'] === hostile)!['id'] as number;
    expect(items.wealth()).toBe(0);
    const corpse = w.game.world.entities.get(corpseId, C.Corpse)!;
    const recovered = items.value(corpseId) + corpse.wornItems.reduce((sum, id) => sum + items.value(id), 0);
    const carrier = w.spawnCreature('dwarf', at, 'fortress');
    w.items.attachToCarrier(corpseId, carrier);
    expect(items.wealth()).toBe(recovered);
  });

  it('picking up a fortress bin recovers the foreign ammunition inside it', () => {
    const { w, at, gear, items } = kit('wealth-contained-loot', 'archers');
    const arrows = gear.find((id) => items.def(items.get(id)!.type)?.id === 'arrow')!;
    const part = w.items.split(arrows, 3);
    const bin = w.spawnItem('bin', 'oak', at);
    expect(w.items.putIn(part, bin)).toBe(true);
    expect(items.wealth()).toBe(items.value(bin));
    const carrier = w.spawnCreature('dwarf', at, 'fortress');
    w.items.attachToCarrier(bin, carrier);
    expect(items.wealth()).toBe(items.value(bin) + items.value(part));
  });

  it('an unrecovered corpse becoming a skeleton still adds no wealth until pickup', () => {
    const { w, at, hostile, items } = kit('wealth-rotted-foreign-corpse');
    w.forceTemperature(at, 20);
    w.game.world.emit({ type: 'Starvation', id: hostile });
    w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === hostile), 60);
    const corpseId = w.events('CorpseCreated').find((e) => e['creatureId'] === hostile)!['id'] as number;
    w.step(21 * TICKS_PER_DAY + 51);
    expect(items.def(items.get(corpseId)!.type)?.id).toBe('skeleton');
    expect(items.wealth()).toBe(0);
    const carrier = w.spawnCreature('dwarf', at, 'fortress');
    w.items.attachToCarrier(corpseId, carrier);
    expect(items.wealth()).toBe(items.value(corpseId));
  });

  it('stolen fortress goods remain counted until the raider actually escapes with them', () => {
    const { w, at, party, hostile, items } = kit('wealth-stolen-fortress-goods');
    const log = w.spawnItem('log', 'oak', at);
    w.items.attachToCarrier(log, hostile);
    party.loot.push(log);
    expect(items.wealth()).toBe(items.value(log));
    party.state = 'retreat';
    w.step(11);
    expect(w.events('ThiefEscaped').some((e) => e['itemId'] === log)).toBe(true);
    expect(items.get(log)).toBeUndefined();
    expect(items.wealth()).toBe(0);
  });
});
