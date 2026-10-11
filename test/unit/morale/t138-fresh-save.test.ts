import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';

describe('T-138 morale bootstrap survives a fresh embark save', () => {
  for (const bootstrapTicks of [0, 1]) {
    it(`preserves every next hash when saved after ${bootstrapTicks} bootstrap ticks`, () => {
      const original = new HeadlessGame({ seed: 't133-save', world: 'flat-test', embark: 'default' });
      original.step(bootstrapTicks);
      const tick = original.tick;
      const hash = original.hash();
      const morale = original.world.scheduler.byId('15')!.serialize();
      const loaded = roundTrip(original).game;
      expect(original.tick).toBe(tick);
      expect(original.hash()).toBe(hash);
      expect(original.world.scheduler.byId('15')!.serialize()).toEqual(morale);
      expect(loaded.hash()).toBe(hash);
      for (let next = 0; next < 50; next += 1) {
        original.step(1);
        loaded.step(1);
        expect(loaded.hash(), `tick ${original.tick}`).toBe(original.hash());
        expect(loaded.world.scheduler.byId('15')!.serialize()).toEqual(original.world.scheduler.byId('15')!.serialize());
      }
      for (const id of original.world.entities.with(C.Brain)) {
        expect(original.world.entities.get(id, C.Mood)!.thoughts.length).toBeGreaterThan(0);
      }
    });
  }
});
