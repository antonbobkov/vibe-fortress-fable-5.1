/**
 * T-332: what the Population panel says after a real summer immigrant wave. It was a stored cell
 * buffer (T-M7-05); each assertion now names what a row means.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { drawPopulationPanel } from '@ui/panels/population';
import type { PanelContext } from '@ui/panels/context';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

function render(): { rows: string[]; dwarves: number } {
  const w = new TestWorld({ seed: 'm7-population-golden', world: 'flat-test', embark: 'none', startTick: 28 * TICKS_PER_DAY - 2 });
  for (let n = 0; n < 7; n += 1) w.spawnDwarf();
  w.until((world) => world.events('ImmigrantsArrived').length > 0, 200);
  w.submit({ type: 'SetPopulationCap', n: 40 });
  w.step(1);
  const ctx: PanelContext = { readers: w.readers, registry: w.game.registry, strings,
    submit: (command) => w.submit(command), focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
  const s = surface(36, 12);
  drawPopulationPanel(s, { col: 0, row: 0, cols: 36, rows: 12 }, ctx);
  const rows = s.lines().map((line) => line.trimEnd().replace(/^ /, ''));
  return { rows, dwarves: w.readers.of<{ list(): number[] }>('10').list().length };
}

describe('T-332 panel: population after immigration', () => {
  it('counts the dwarves, shows the cap that was set, and names the wave that arrived and the evaluation to come', () => {
    const { rows, dwarves } = render();
    expect(rows[0]).toBe(`${dwarves} dwarves (0 children)`);
    expect(dwarves).toBeGreaterThan(7);
    expect(rows[1]).toBe('Cap [-] 40 [+]');
    expect(rows[2]).toMatch(/^Hall spirit: Fine \(\d+(\.\d+)?\)$/);
    expect(rows[3]).toBe('Next evaluation: Autumn');
    expect(rows[4]).toMatch(/^Eligible: no · hall spirit below /);
    expect(rows[5]).toBe('Last wave: 2 in Summer, Year 1');
    expect(rows[6]).toBe('Waves so far: 1');
  });
});
