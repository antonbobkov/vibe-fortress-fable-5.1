/**
 * Player path: trade (T-330; `docs/process/player-paths.md`).
 *
 * The Balanced embark on a compact generated forest region. The one thing staged is the date of
 * the Hillfolk caravan's arrival, brought forward from summer to day 6, as the testing strategy
 * allows; the caravan then comes, walks to the depot and trades by its own rules. By commands only: a stockpile, a trade depot, the mason made
 * broker, the wagon's iron bars, mechanism and leather moved to the depot as export goods, a
 * trade opened when the caravan stands at the depot, an offer of those goods for the dearest
 * merchant item they pay for, and the purchase taken back to the stockpile.
 *
 * Asserted, as a player sees it, within a season: the goods were hauled to the depot, the broker
 * traded, and the purchase stands in the fortress's stockpile. Wild animals stay on.
 */

import { expect } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { TradeReader } from '@systems/trade/reader';
import { requiredValue } from '@systems/trade/valuation';
import type { Scenario } from './runner';
import { buildings, built, cmd, day, expectNoInvariantFindings, pathWorld, placeNear, playUntil, surfaceZ, trace, wagon, zoneRect } from './player-path';
import { deathCounts } from './death-counts';

const EXPORTS = ['bar', 'mechanism', 'leather_piece'];
/** The day the Hillfolk caravan is brought forward to: the depot stands and the goods are in it. */
const CARAVAN_DAY = 6;

const scenario: Scenario = {
  id: 'pp_trade',
  milestone: 8,
  seed: 'pp-trade',
  world: 'flat-test',
  timeoutMs: 300_000,
  run: () => {
    const w = pathWorld('pp-trade');
    // The caravan's arrival is the one thing forced: the Hillfolk come in summer (20 § Schedule),
    // a season after the embark, so their arrival is brought forward to day CARAVAN_DAY.
    const schedule = (w.game.world.scheduler.byId('20') as unknown as { scheduleState: Record<string, { nextArrivalTick: number }> }).scheduleState;
    schedule['hillfolk']!.nextArrivalTick = CARAVAN_DAY * TICKS_PER_DAY;
    const { x: cx, y: cy } = wagon(w);
    const ent = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const trade = w.readers.of<TradeReader>('20');
    const itemTypes = w.game.registry.table('items');
    const typeOf = (id: EntityId): string => itemTypes.byIndex(ent.get(id, C.Item)?.type ?? -1)?.id ?? '?';

    const stockpile = zoneRect(w, 'stockpile', cx - 12, cy + 3, surfaceZ(w, cx, cy), 14, 8);
    cmd(w, { type: 'SetStockpileFilter', zoneId: stockpile, filter: 'everything' });
    const depot = placeNear(w, 'trade_depot', cx + 2, cy + 14);
    const broker = (w.game.arrival?.dwarves ?? [])[3] as EntityId;
    cmd(w, { type: 'AssignTitle', title: 'broker', dwarfId: broker });

    const goods = ent.with(C.Item).filter((id) => EXPORTS.includes(typeOf(id)) && (ent.get(id, C.Item)!.flags & ItemFlag.Merchant) === 0);
    const atDepot = (id: EntityId): boolean => ((ent.get(id, C.Item)?.flags ?? 0) & ItemFlag.AtDepot) !== 0;
    let moved = false;
    let opened = false;
    let offered = null as { take: EntityId; type: string } | null;
    let purchase: EntityId = 0;
    const watch = (): void => {
      if (!moved && built(w, depot)) {
        moved = true;
        cmd(w, { type: 'MoveToDepot', depotId: depot, itemIds: goods });
      }
      const caravan = trade.activeCaravan();
      if (caravan === null || caravan.state !== 'atDepot' || !goods.every(atDepot)) return;
      if (!opened) {
        opened = true;
        cmd(w, { type: 'TradeOpen', depotId: depot });
        return;
      }
      if (offered !== null || !trade.sessionOpen()) return;
      const budget = goods.reduce((sum, id) => sum + trade.valuation(caravan.civ, id), 0);
      const margin = trade.marginPercent(caravan.civ);
      const onOffer = trade.merchantItems().filter((id) => ent.get(id, C.Item)?.containerId === depot && !ent.get(id, C.Item)?.occupantId);
      const unitPrice = (id: EntityId): number => trade.price(caravan.civ, id) / (ent.get(id, C.Item)?.count ?? 1);
      const affordable = onOffer.filter((id) => requiredValue(unitPrice(id), margin) <= budget).sort((a, b) => unitPrice(b) - unitPrice(a) || a - b);
      const take = affordable[0];
      if (take === undefined) return;
      offered = { take, type: typeOf(take) };
      cmd(w, { type: 'TradeOffer', give: goods.map((itemId) => ({ itemId, count: ent.get(itemId, C.Item)?.count ?? 1 })), take: [{ itemId: take, count: 1 }] });
    };
    const traded = (): boolean => w.events('TradeCompleted').length > 0;
    playUntil(w, traded, DAYS_PER_SEASON * TICKS_PER_DAY, watch);

    // The purchase: the item of the offered type in the depot that is no longer the merchant's.
    if (traded() && offered !== null) {
      const want = offered.type;
      purchase = (w.game.world.entities.get(depot, C.Container)?.contents ?? [])
        .find((id) => typeOf(id) === want && (ent.get(id, C.Item)!.flags & ItemFlag.Merchant) === 0) ?? 0;
      cmd(w, { type: 'TradeCancel' });
      if (purchase !== 0) cmd(w, { type: 'RemoveFromDepot', depotId: depot, itemIds: [purchase] });
    }
    const jobs = w.readers.of<JobsReader>('11');
    const stored = (): boolean => purchase !== 0 && ent.alive(purchase) && items.stockpileAt(items.tileOf(purchase)) === stockpile &&
      ((ent.get(purchase, C.Item)?.flags ?? 0) & ItemFlag.Reserved) === 0 && jobs.byKey(`haul:${purchase}`) === undefined;
    playUntil(w, stored, 3 * TICKS_PER_DAY);

    const civs = w.events('CaravanArrived').map((e) => String(e['civ']));
    const summary = `${trace(w, 'pp_trade')}; depot built ${built(w, depot)} (${buildings(w).get(depot)?.footprint.length ?? 0} tiles); ` +
      `goods ${goods.map(typeOf).join(',')}, at depot ${goods.filter(atDepot).length}; caravans ${w.events('CaravanArrived').length} ${civs.join(',')}, ` +
      `at depot ${w.events('CaravanAtDepot').length}; session ${opened}; offered ${offered?.type ?? 'nothing'}; ` +
      `completed ${w.events('TradeCompleted').length}, refused ${w.events('TradeRefused').length}; purchase ${purchase} stored ${stored()} ` +
      `(flags ${ent.get(purchase, C.Item)?.flags}, container ${ent.get(purchase, C.Item)?.containerId}, tile ${items.tileOf(purchase)}, ` +
      `stockpile free ${items.freeSlots(stockpile)}, full events ${w.events('StockpileFull').length})`;
    console.log(summary);
    expect(goods.length, 'the wagon brought export goods').toBeGreaterThan(0);
    expect(w.events('CaravanAtDepot').length, `a caravan reached the depot; ${summary}`).toBeGreaterThan(0);
    expect(traded(), `the broker traded; ${summary}`).toBe(true);
    expect(stored(), `the purchase stands in the stockpile; ${summary}`).toBe(true);
    expect(deathCounts(w).dwarf, 'no dwarf died').toBe(0);
    expectNoInvariantFindings(w, `pp_trade day ${day(w)}`);
  },
};

export default scenario;
