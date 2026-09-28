/** T-M7-05: a real summer immigrant wave in the population panel. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { drawPopulationPanel } from '@ui/panels/population';
import type { PanelContext } from '@ui/panels/context';
import { TestWorld } from '../../scenarios/test-world';
import { cellRows, strings, surface } from '../../unit/ui/ui-fixture';

const name = 'render/m7-population';
const file = fileURLToPath(new URL('./m7-population.json', import.meta.url));
const update = process.env['DEEPHOLM_GOLDEN_UPDATE'] === name || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';
interface PanelGolden { text: string[]; cells: string[][] }
let golden: PanelGolden | null = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as PanelGolden : null;

function render(): PanelGolden {
  const w = new TestWorld({ seed: 'm7-population-golden', world: 'flat-test', embark: 'none', startTick: 28 * TICKS_PER_DAY - 2 });
  for (let n = 0; n < 7; n += 1) w.spawnDwarf();
  w.until((world) => world.events('ImmigrantsArrived').length > 0, 200);
  w.submit({ type: 'SetPopulationCap', n: 40 });
  w.step(1);
  const ctx: PanelContext = { readers: w.readers, registry: w.game.registry, strings,
    submit: (command) => w.submit(command), focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
  const s = surface(36, 12);
  drawPopulationPanel(s, { col: 0, row: 0, cols: 36, rows: 12 }, ctx);
  return { text: s.lines(), cells: cellRows(s) };
}

describe('T-M7-05 golden: population after immigration', () => {
  it('matches the authored cell buffer', () => {
    if (update) {
      golden = render();
      writeFileSync(file, `${JSON.stringify({ $note: 'npm run golden:update -- render/m7-population', ...golden }, null, 2)}\n`, 'utf8');
    }
    expect(golden).not.toBeNull();
    const actual = render();
    expect(actual).toEqual({ text: golden?.text, cells: golden?.cells });
    expect(actual.text.join('\n')).toContain('Last wave:');
    expect(actual.text.join('\n')).toContain('Next evaluation: Autumn');
  });
});
