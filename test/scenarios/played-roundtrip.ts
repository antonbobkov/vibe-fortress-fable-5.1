/** T-176: replace a played fortress with its load and preserve test-only observations. */
import { roundTrip } from '@app/game-save';
import { threeYearsMeasurements } from './three_years_measurements';
import { continueInvariantObservations } from './invariants';
import type { TestWorld } from './test-world';

export function reloadPlayedFortress(w: TestWorld): void {
  const previous = w.game;
  const loaded = roundTrip(previous).game;
  if (loaded.hash() !== previous.hash())
    throw new Error(`T-176 played save hash differs at tick ${w.tick}`);
  continueInvariantObservations(previous, loaded);
  w.replaceGame(loaded);
  const measurements = threeYearsMeasurements(w);
  measurements.connect();
  const immigration = loaded.world.scheduler.byId('21')!;
  const handle = immigration.handle.bind(immigration);
  immigration.handle = (event, ctx) =>
    measurements.observeImmigration(
      { serialize: () => immigration.serialize(), handle },
      event,
      ctx,
    );
}
