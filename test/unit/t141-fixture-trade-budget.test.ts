import { describe, expect, it, vi } from 'vitest';
import { C, ItemFlag } from '@core/components';
import type { Command } from '@core/commands';
import { TICKS_PER_DAY } from '@core/constants';
import { requiredValue } from '@systems/trade/valuation';
import { trade } from '../scenarios/three_years_economy';
import type { FortressState } from '../scenarios/three_years_fortress';
import type { TestWorld } from '../scenarios/test-world';
import * as measurements from '../scenarios/three_years_measurements';

describe('T-141 old fixture respects the rounded trade margin', () => {
  it('buys an affordable quantity with 3.9 marks instead of abandoning an offer requiring 4', () => {
    const stock = new Map<number, { type: number; count: number; flags: number; containerId: number; carriedBy: number }>([
      [1, { type: 1, count: 1, flags: ItemFlag.AtDepot, containerId: 10, carriedBy: 0 }],
      [2, { type: 2, count: 10, flags: ItemFlag.Merchant, containerId: 10, carriedBy: 0 }],
    ]);
    const offers: Command[] = [];
    const trader = { activeCaravan: () => ({ civ: 'mountainhome', state: 'atDepot' }),
      sessionOpen: () => true, marginPercent: () => 8, depotItems: () => [1], merchantItems: () => [2],
      valuation: (_civ: string, id: number) => id === 1 ? 3.9 : 0, price: () => 12 };
    const w = { tick: 243 * TICKS_PER_DAY,
      readers: { of: (id: string) => id === '20' ? trader : id === '14' ? { depots: () => [10] }
        : id === '13' ? { available: () => 0, count: () => 0 } : { byKey: () => undefined } },
      game: { registry: { table: () => ({ byIndex: (id: number) => id === 1
        ? { id: 'figurine', category: 'craft/figurine' } : { id: 'bar', category: 'bar/metal' } }) },
        world: { entities: { with: (component: unknown) => component === C.Item ? [1, 2] : [], get: (id: number) => stock.get(id) },
          applyCommand: (command: Command) => {
            if (command.type === 'TradeOffer') {
              offers.push(command);
              const take = command['take'] as { itemId: number; count: number }[];
              const cost = take.reduce((sum, line) => sum + 1.2 * line.count, 0);
              expect(requiredValue(cost, 8)).toBeLessThanOrEqual(3.9);
              stock.get(2)!.flags = 0;
            }
            return { ok: true };
          } } } } as unknown as TestWorld;
    const state = { economy: { traded: new Set<string>() } } as FortressState;
    const observer = vi.spyOn(measurements, 'threeYearsMeasurements').mockReturnValue({
      purchases: new Set<number>(),
    } as measurements.ThreeYearsMeasurements);
    try {
      trade(w, state);
      expect(offers).toHaveLength(1);
      expect(offers[0]?.['take']).toEqual([{ itemId: 2, count: 2 }]);
      expect(state.economy.traded.size).toBe(1);
    } finally {
      observer.mockRestore();
    }
  });
});
