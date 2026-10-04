import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import { WORLD_SIZE_SMALL } from '@core/constants';
import type { GameEvent } from '@core/events';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press } from './ui-fixture';

describe('T-M8-08 WorldGenerated dispatch', () => {
  it('dispatches the completed world before embark and supports unsubscribe', () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 'interface-world', registry: loadContent(),
      createCanvas: mockCanvasFactory(), width: 1280, height: 800, randomSeed: () => 'interface-world' });
    const events: GameEvent[] = [];
    const off = game.onAppEvents((batch) => {
      expect(game.host.started).toBe(false);
      events.push(...batch);
    });
    game.openWorldGen();
    game.handleKey(press('Tab'));
    game.handleKey(press('←'));
    game.handleKey(press('g'));
    expect(events).toEqual([{ type: 'WorldGenerated', seed: 'interface-world', size: WORLD_SIZE_SMALL }]);
    off();
    game.handleKey(press('g'));
    expect(events).toHaveLength(1);
  });
});
