import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { spawnCaravan, type TradeSystem } from '@systems/trade';
import { Registrations, type TickContext } from '@core/system';
import { C } from '@core/components';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { TestWorld } from '../scenarios/test-world';
import { prepareBusyFortress } from '../scenarios/core_save_roundtrip.scenario';
import {
  attachThreeYearsMeasurements,
  stepThreeYears,
} from '../scenarios/three_years_measurements';
import { reloadPlayedFortress } from '../scenarios/played-roundtrip';
import { checkInvariants, watchInvariants } from '../scenarios/invariants';

describe('T-176 played caravan save continuation', () => {
  it.each([1, 2, 3])(
    'continues jobs, event history and observations on the loaded game in year %i',
    (year) => {
      const w = new TestWorld({ seed: 't176-played-save', world: 'flat-test', embark: 'default' });
      const measurements = attachThreeYearsMeasurements(w);
      prepareBusyFortress(w);
      stepThreeYears(w, 2000);
      expect(w.events('JobCompleted').length).toBeGreaterThan(0);
      // A compact played state at a year boundary, with the same public caravan spawn path.
      w.game.world.calendar.setTick((year - 1) * DAYS_PER_YEAR * TICKS_PER_DAY + w.tick);
      const ctx: TickContext = {
        world: w.game.world,
        registry: w.game.registry,
        readers: w.readers,
        tick: w.tick,
        rng: w.game.world.rngFor('20'),
        register: new Registrations(),
        terrain: w.game.world.services.terrain,
        jobs: w.game.world.services.jobs,
        spawn: w.game.world.services.spawn,
        emit: (event) => w.game.world.emit(event),
      };
      const caravan = spawnCaravan(ctx, 'hillfolk', 'n', 0, false, 0, [], ctx.rng);
      const trade = w.game.world.scheduler.byId('20') as TradeSystem;
      const state = trade.serialize();
      trade.deserialize({ ...state, activeCaravan: caravan }, ctx);
      w.step(1);
      const control = roundTrip(w.game).game;
      const before = w.game;
      const history = w.allEvents().length;
      const oldMeals = measurements.meals;
      const stop = watchInvariants(w.game, (findings) => expect(findings).toEqual([]));
      stop();
      reloadPlayedFortress(w);
      expect(w.game).not.toBe(before);
      expect(w.hash()).toBe(control.hash());
      expect(w.allEvents()).toHaveLength(history);
      const stopLoaded = watchInvariants(w.game, (findings) => expect(findings).toEqual([]));
      stepThreeYears(w, 500);
      control.step(500);
      stopLoaded();
      expect(w.hash()).toBe(control.hash());
      expect(checkInvariants(w.game)).toEqual([]);
      expect(w.allEvents().length).toBeGreaterThan(history);
      // Observational listeners move with the load without replacing accumulated counters.
      const dwarf = w.game.world.entities.with(C.Labors)[0]!;
      w.game.world.emit({ type: 'MealEaten', dwarfId: dwarf });
      w.step(1);
      expect(measurements.meals).toBeGreaterThan(oldMeals);
      expect(w.events('MealEaten').length).toBeGreaterThan(0);
    },
  );
});
