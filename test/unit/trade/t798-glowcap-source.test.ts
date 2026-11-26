/**
 * T-798: glowcap has a source the player can count on. A request that names a Mountainhome extra
 * good raises its roll (1000‰ at high, its permille plus half the rest at medium), on the same draws
 * of the runecraft stream, so a world without the request draws as before; a caravan at the depot
 * stays while a raid is warned or on the map (20 § Movement step 4).
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { RngStream } from '@core/rng';
import { Registrations, type TickContext } from '@core/system';
import { contentRegistry } from '@content/loader';
import { CARAVAN_STAY_DAYS, type TradeReader } from '@systems/trade';
import { eligibleGoodsEntries, extraPermille, generateGoods, type PlannedGood } from '@systems/trade/goods';
import type { TradeRequest } from '@systems/trade/state';
import type { ThreatsStateV1 } from '@systems/threats/state';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const SEED = registry.table('items').index('seed');
const GLOWCAP = registry.table('materials').index('glowcap');
const glowcapSeeds = (goods: readonly PlannedGood[]): PlannedGood[] => goods.filter((g) => g.type === SEED && g.material === GLOWCAP);
const request = (priority: 1 | 2 | 3): TradeRequest[] => [{ itemType: 'seed', material: 'glowcap', priority }];

describe('T-798 a request for an extra good is honoured', () => {
  it('a high request for glowcap seeds always brings 2 to 4 bags, and spends the streams as a world without it', () => {
    for (let n = 0; n < 200; n += 1) {
      const main = new RngStream(n + 1);
      const extra = new RngStream(5000 + n);
      const goods = generateGoods(registry, 'mountainhome', 0, 0, request(3), main, extra);
      const seeds = glowcapSeeds(goods);
      expect(seeds.length).toBe(1);
      expect(seeds[0]!.extra).toBe(true);
      expect(seeds[0]!.count).toBeGreaterThanOrEqual(20);
      expect(seeds[0]!.count).toBeLessThanOrEqual(40);
      // The same world without the request: the same ordinary goods and the same stream states.
      const main0 = new RngStream(n + 1);
      const extra0 = new RngStream(5000 + n);
      const without = generateGoods(registry, 'mountainhome', 0, 0, [], main0, extra0);
      expect(main.state()).toEqual(main0.state());
      expect(goods.filter((g) => !g.extra)).toEqual(without.filter((g) => !g.extra));
      // Only the seeds' own draws differ on the runecraft stream; with seeds in both, nothing does.
      if (glowcapSeeds(without).length > 0) {
        expect(extra.state()).toEqual(extra0.state());
        expect(goods).toEqual(without);
      }
    }
  });

  it('raises the permille to 1000 at high, by half the rest at medium, and not at low or for another material', () => {
    const entries = eligibleGoodsEntries(registry, 'mountainhome', 0);
    const entry = entries.find((e) => e.extra !== undefined && e.materials.some((m) => m.material === 'glowcap'))!;
    expect(entry.extra?.permille).toBe(700);
    expect(extraPermille(entry, [], entries)).toBe(700);
    expect(extraPermille(entry, request(1), entries)).toBe(700);
    expect(extraPermille(entry, request(2), entries)).toBe(850);
    expect(extraPermille(entry, request(3), entries)).toBe(1000);
    expect(extraPermille(entry, [{ itemType: 'seed', material: 'dimcap', priority: 3 }], entries)).toBe(700);
    expect(extraPermille(entry, [{ itemType: 'seed', priority: 3 }], entries)).toBe(700);
  });

  it('a high glowcap request beside a high glowstone request still brings the seeds', () => {
    const requests: TradeRequest[] = [{ itemType: 'rough_gem', material: 'glowstone', priority: 3 }, ...request(3)];
    for (let n = 0; n < 50; n += 1) {
      expect(glowcapSeeds(generateGoods(registry, 'mountainhome', 0, 0, requests, new RngStream(n + 7), new RngStream(n + 70))).length).toBe(1);
    }
  });
});

function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('20'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain,
    spawn: w.game.world.services.spawn, emit: (event) => w.game.world.emit(event) };
}

describe('T-798 the caravan waits out a raid', () => {
  it('stays at the depot while a raid is warned, and packs a full stay after the warning is gone', () => {
    const w = new TestWorld({ seed: 't798-raid', world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
    w.build('trade_depot', w.index(45, 8, 32), 'granite');
    w.until(() => w.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
    const reader = w.readers.of<TradeReader>('20');
    expect(reader.activeCaravan()?.state).toBe('atDepot');
    // A raid is warned, to arrive long after the stay would end.
    const threats = w.game.world.scheduler.byId('18') as unknown as { serialize(): ThreatsStateV1; deserialize(s: ThreatsStateV1, ctx: TickContext): void };
    const state = threats.serialize();
    const pending = { kind: 'raid', civ: 'gloam', size: 8, arrivalTick: w.tick + 30 * TICKS_PER_DAY, edge: 'n' as const, warningEmitted: true };
    threats.deserialize({ ...state, pendingArrivals: [...(state.pendingArrivals ?? []), pending] }, context(w));
    w.step((CARAVAN_STAY_DAYS + 1) * TICKS_PER_DAY);
    expect(reader.activeCaravan()?.state).toBe('atDepot');
    expect(reader.activeCaravan()?.daysRemaining).toBeGreaterThan(0);
    // The warning is withdrawn: the stay's clock runs again, and the caravan packs when it ends.
    const after = threats.serialize();
    threats.deserialize({ ...after, pendingArrivals: (after.pendingArrivals ?? []).filter((a) => a !== undefined && a.arrivalTick !== pending.arrivalTick) }, context(w));
    w.until(() => reader.activeCaravan()?.state !== 'atDepot', (CARAVAN_STAY_DAYS + 1) * TICKS_PER_DAY);
    expect(reader.activeCaravan()?.state).not.toBe('atDepot');
  });
});
