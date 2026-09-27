import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { loadGame, saveGame } from '@app/game-save';
import { TICKS_PER_DAY } from '@core/constants';
import type { TradeReader } from '@systems/trade';

describe('T-M7-01 caravan save continuity', () => {
  it('restores a loaded party, cargo, schedule and RNG at the same world hash', async () => {
    const first = new HeadlessGame({ seed: 'trade-save', world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
    let arrived = false;
    first.world.onEvents((batch) => { if (batch.some((event) => event.type === 'CaravanArrived')) arrived = true; });
    while (!arrived) first.step(1);
    const blob = await saveGame(first, { kind: 'manual' });
    const second = (await loadGame(blob)).game;
    expect(second.hash()).toBe(first.hash());
    expect(second.world.readers.of<TradeReader>('20').activeCaravan()?.civ).toBe('hillfolk');
    first.step(100);
    second.step(100);
    expect(second.hash()).toBe(first.hash());
  });
});
