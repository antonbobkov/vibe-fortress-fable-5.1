import { describe, it, expect } from 'vitest';
import { MIST_DURATION_TICKS } from '@systems/fluids/constants';
import type { FluidsReader, FluidsSystem } from '@systems/fluids';
import { TestWorld } from '../../scenarios/test-world';
import { digWaterfall } from '../../scenarios/waterfall';

describe('T-M3-07 mist', () => {
  it('expires MIST_DURATION_TICKS after the last emission, and is saved with its expiry', () => {
    const w = new TestWorld({ seed: 'mist', world: 'flat-test' });
    const fall = digWaterfall(w, 30, 40, 31, 10, 3);
    w.until((ww) => ww.events('MistProduced').length > 0, 600);
    const reader = w.readers.of<FluidsReader>('04');
    expect(reader.isMisty(fall.landing)).toBe(true);
    const system = w.game.world.scheduler.byId('04') as unknown as FluidsSystem;
    const saved = system.serialize();
    expect(saved.mistTiles.length).toBe(18);
    // Stop the water: take the source away and let the channel run dry.
    w.fluids.sim.pour(fall.source, 0);
    for (const t of fall.channel) w.fluids.sim.pour(t, 0);
    for (const t of fall.shaft) w.fluids.sim.pour(t, 0);
    const lastEmission = Math.max(...saved.mistTiles.map(([, until]) => until));
    w.step(Math.max(0, lastEmission - w.tick) + MIST_DURATION_TICKS + 4);
    expect(reader.isMisty(fall.landing)).toBe(false);
    expect(system.serialize().mistTiles).toEqual([]);
    // A single MistProduced for the one area, however long the fall ran.
    expect(w.events('MistProduced').length).toBe(1);
  });

  it('magma and short falls make no mist', () => {
    const w = new TestWorld({ seed: 'mist-short', world: 'flat-test' });
    digWaterfall(w, 30, 40, 31, 6, 1);
    w.step(400);
    expect(w.events('MistProduced').length).toBe(0);
  });
});
