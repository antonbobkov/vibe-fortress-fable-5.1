import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { readJsonSection } from '@app/save-manager';
import { contentRegistry } from '@content/loader';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';

describe('T-M4-16 first embark hint', () => {
  it('opens the paused fortress with the lamp hint, saves it once, and honours the setting', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 'first-hint', registry: contentRegistry(),
      createCanvas: mockCanvasFactory(), width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    expect(game.fortress.log.lines.filter((line) => line.text.includes('Designate a place to dig'))).toHaveLength(1);
    expect(game.ui.hintsShown).toContain('hint_dig');
    game.fortress.showFirstHint();
    expect(game.fortress.log.lines.filter((line) => line.text.includes('Designate a place to dig'))).toHaveLength(1);
    expect(readJsonSection(game.uiSection())).toMatchObject({ hintsShown: ['hint_dig'] });
    game.fortress.settings.hintsEnabled = false;
    game.host.step(51);
    expect(game.ui.hintsShown).toEqual(['hint_dig']);
  });
});
