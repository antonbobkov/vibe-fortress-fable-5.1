import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { loadGame, saveGame } from '@app/game-save';
import { TICKS_PER_DAY } from '@core/constants';
import type { ImmigrationReader } from '@systems/immigration/reader';

describe('T-M7-04 immigration save continuity', () => {
  it('resumes a wave between staggered arrivals with the same world hash', async () => {
    const first = new HeadlessGame({ seed: 'immigration-save', world: 'flat-test', embark: 'default', startTick: 28 * TICKS_PER_DAY - 2 });
    while (first.world.readers.of<ImmigrationReader>('21').wavesSoFar() === 0) first.step(1);
    expect(first.world.scheduler.byId('21')?.serialize()).toMatchObject({ pending: { nextIndex: 1 } });
    const blob = await saveGame(first, { kind: 'manual' });
    const second = (await loadGame(blob)).game;
    expect(second.hash()).toBe(first.hash());
    first.step(100);
    second.step(100);
    expect(second.hash()).toBe(first.hash());
    expect(second.world.readers.of<ImmigrationReader>('21').lastWave()?.count).toBeGreaterThanOrEqual(2);
  });
});
