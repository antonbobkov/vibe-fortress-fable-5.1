import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import type { ImmigrationReader } from '@systems/immigration/reader';
import { drawPopulationPanel, eligibilityText } from '@ui/panels/population';
import { press, surface } from './ui-fixture';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';

describe('T-M7-05 population panel', () => {
  it('edits the population cap with plus and minus without changing game speed', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 'm7-population-key', registry: loadContent(),
      createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    game.fortress.openPanel('population');
    const immigration = game.host.readers.of<ImmigrationReader>('21');
    const before = immigration.cap();
    const speed = game.host.speed();
    expect(game.fortress.key(press('+'))).toBe(true);
    game.host.step(1);
    expect(immigration.cap()).toBe(before + 1);
    expect(game.host.speed()).toBe(speed);
    expect(game.fortress.key(press('-'))).toBe(true);
    game.host.step(1);
    expect(immigration.cap()).toBe(before);
    expect(game.host.speed()).toBe(speed);
    const s = surface(36, 12);
    drawPopulationPanel(s, { col: 0, row: 0, cols: 36, rows: 12 }, game.fortress.ctx);
    s.hitAt(13, 1)?.action();
    game.host.step(1);
    expect(immigration.cap()).toBe(before + 1);
    s.hitAt(6, 1)?.action();
    game.host.step(1);
    expect(immigration.cap()).toBe(before);
  });

  it('explains current eligibility reasons', () => {
    expect(eligibilityText([])).toBe('Eligible: yes');
    expect(eligibilityText(['cap'])).toBe('Immigration paused by cap');
    expect(eligibilityText(['spirit'])).toContain('Content');
  });
});
