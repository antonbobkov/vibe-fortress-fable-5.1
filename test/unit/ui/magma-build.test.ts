import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';

describe('T-M5-04 magma build menu', () => {
  it('shows powered variants and hides the unused magma kiln', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 'm5-magma-menu', registry: loadContent(),
      createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    game.fortress.build.choose('w');
    const types = game.fortress.build.rows(game.fortress.ctx).map((row) => row.id);
    expect(types).toContain('magma_smelter');
    expect(types).toContain('magma_forge');
    expect(types).not.toContain('magma_kiln');
  });
});
