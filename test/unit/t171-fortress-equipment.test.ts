import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { CombatReader } from '@systems/combat';
import type { TradeSystem } from '@systems/trade';
import { TestWorld } from '../scenarios/test-world';

function soldier(w: TestWorld) {
  const id = w.spawnDwarf({ at: w.index(20, 20, 32), ageYears: 30 });
  const own = w.spawnItem('short_sword', 'copper', w.index(20, 20, 32));
  const command = w.game.world.applyCommand.bind(w.game.world);
  expect(command({ type: 'CreateSquad', name: 'Guard' })).toEqual({ ok: true });
  const squad = w.readers.of<CombatReader>('16').squads()[0]!.id;
  expect(command({ type: 'SetSquadEquipment', squadId: squad, equipment: { weaponClass: 'sword' } })).toEqual({ ok: true });
  expect(command({ type: 'SetSquadMembers', squadId: squad, members: [id] })).toEqual({ ok: true });
  expect(w.game.world.entities.get(id, C.Equipment)!.weapon).toBe(own);
  return { id, own, squad, command };
}

describe('T-171 squads claim only fortress gear and clear destroyed slots immediately', () => {
  it("keeps its own sword while a better merchant sword is in the visiting caravan's depot container", () => {
    const w = new TestWorld({ seed: 't171-caravan', world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
    w.build('trade_depot', w.index(45, 8, 32), 'granite');
    w.until(() => w.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
    const { id, own, squad, command } = soldier(w);
    const trade = w.game.world.scheduler.byId('20') as TradeSystem;
    const caravan = trade.serialize().activeCaravan!;
    const better = w.spawnItem('short_sword', 'steel', w.index(45, 8, 32));
    const items = w.game.world.services.items!;
    expect(items.putIn(better, caravan.depotId)).toBe(true);
    items.setFlag(better, ItemFlag.Merchant, true);
    items.setFlag(better, ItemFlag.AtDepot, true);
    expect(command({ type: 'SetSquadEquipment', squadId: squad, equipment: { weaponClass: 'sword' } })).toEqual({ ok: true });
    expect(w.game.world.entities.get(id, C.Equipment)!.weapon).toBe(own);
    expect(w.game.world.entities.get(better, C.Item)!.containerId).toBe(caravan.depotId);
    expect(w.game.world.entities.get(caravan.depotId, C.Container)!.contents).toContain(better);
    expect(w.game.world.entities.get(better, C.Item)!.ownerId).toBe(0);
  });

  it.each([ItemFlag.Merchant, ItemFlag.AtDepot, ItemFlag.Foreign, ItemFlag.Forbidden])('does not claim a better sword with excluded flag %i', (flag) => {
    const w = new TestWorld({ seed: 't171-flags', world: 'flat-test', embark: 'none' });
    const { id, own, squad, command } = soldier(w);
    const better = w.spawnItem('short_sword', 'steel', w.index(20, 20, 32));
    w.game.world.services.items!.setFlag(better, flag, true);
    command({ type: 'SetSquadEquipment', squadId: squad, equipment: { weaponClass: 'sword' } });
    expect(w.game.world.entities.get(id, C.Equipment)!.weapon).toBe(own);
    // Once it is fortress stock, the existing best-item rule still upgrades.
    w.game.world.services.items!.setFlag(better, flag, false);
    command({ type: 'SetSquadEquipment', squadId: squad, equipment: { weaponClass: 'sword' } });
    expect(w.game.world.entities.get(id, C.Equipment)!.weapon).toBe(better);
  });

  it('clears every slot naming a destroyed item before items.destroy returns and preserves other gear', () => {
    const w = new TestWorld({ seed: 't171-destroy', world: 'flat-test', embark: 'none' });
    const { id, own } = soldier(w);
    const spare = w.spawnItem('buckler', 'iron', w.index(20, 20, 32));
    const e = w.game.world.entities.get(id, C.Equipment)!;
    e.shield = spare;
    e.quiver = own;
    for (const slot of ['head', 'body', 'arms', 'legs', 'feet'] as const) e.armor[slot] = own;
    for (const slot of ['body', 'legs', 'feet', 'over'] as const) e.clothing[slot] = own;
    const tick = w.tick;
    w.game.world.services.items!.destroy(own, 'test');
    expect(w.tick).toBe(tick);
    expect(e).toEqual({ weapon: 0, shield: spare, quiver: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 } });
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    loaded.world.services.items!.destroy(spare, 'test');
    expect(loaded.world.entities.get(id, C.Equipment)!.shield).toBe(0);
  });
});
