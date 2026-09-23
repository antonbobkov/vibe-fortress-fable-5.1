import { expect } from 'vitest';
import { TICKS_PER_HOUR } from '@core/constants';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { Strings } from '@ui/strings';
import { defaultUiState } from '@ui/ui-state';
import type { Scenario } from './runner';

/** Headless presentation subscriber: the same onEvents path used by the fortress screen. */
const scenario: Scenario = {
  id: 'ui_hints_once', milestone: 4, seed: 'ui-hints-once', world: 'flat-test', embark: 'none',
  run: (w) => {
    const ui = defaultUiState(32);
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    const hints = new HintEngine(w.game.registry, ui, log);
    w.game.world.onEvents((events) => hints.onEvents(events, w.readers));
    w.step(TICKS_PER_HOUR + 1);
    const dig = log.lines.filter((line) => line.text.includes('Designate a place to dig'));
    expect(dig).toHaveLength(1);
    expect(dig[0]?.text.startsWith('☼ ')).toBe(true);
    expect(ui.hintsShown).toContain('hint_dig');
    w.step(5 * TICKS_PER_HOUR);
    expect(log.lines.filter((line) => line.text.includes('Designate a place to dig'))).toHaveLength(1);
  },
};
export default scenario;
