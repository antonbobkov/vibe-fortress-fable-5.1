/** T-793: at the population cap a hint names [p] and the sinks the fortress has for its idle. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { GameEvent } from '@core/events';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const HOUR = { type: 'HourPassed', hour: 0 } as GameEvent;

describe('T-793 hint_cap', () => {
  it('shows once the living dwarves reach the cap, and names [p], a squad on Train, the deep and a runeforge', () => {
    const w = new TestWorld({ seed: 't793-cap', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    for (let k = 0; k < 3; k += 1) w.spawnDwarf({ at: w.index(10 + k, 10, z) });
    w.game.world.fortress.populationCap = 4;
    const ui = defaultUiState(z);
    const log = new AnnouncementLog(strings, w.game.registry);
    const hints = new HintEngine(w.game.registry, ui, log);
    hints.onEvents([HOUR], w.readers);
    expect(ui.hintsShown).not.toContain('hint_cap');
    w.spawnDwarf({ at: w.index(14, 10, z) });
    hints.onEvents([HOUR], w.readers);
    expect(ui.hintsShown).toContain('hint_cap');
    const line = log.lines.find((l) => l.text.startsWith('☼ The fortress has reached its population cap'));
    expect(line?.text).toContain('[p] raises it');
    expect(line?.text).toContain('a squad on Train [m]');
    expect(line?.text).toContain('the deep');
    expect(line?.text).toContain('runeforge');
    hints.onEvents([HOUR], w.readers);
    expect(log.lines.filter((l) => l.text.startsWith('☼ The fortress has reached'))).toHaveLength(1);
  });
});
