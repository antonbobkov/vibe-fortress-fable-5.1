import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as z } from '@app/headless';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

function world() { return new TestWorld({ seed: 't480-hunter', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' }); }
function hourly(w: TestWorld) {
  const ui = defaultUiState(z), log = new AnnouncementLog(strings, w.game.registry), hints = new HintEngine(w.game.registry, ui, log);
  hints.onEvents([{ type: 'HourPassed', hour: 0 }], w.readers);
  return ui.hintsShown.includes('hint_hunter');
}

describe('T-480 the hunter hint reads the labor bit', () => {
  it('shows when a living fortress dwarf has hunting on and no bow or crossbow exists', () => {
    const w = world(), id = w.spawnDwarf({ at: w.index(20, 20, z) });
    w.setLabor(id, 'hunting', true);
    expect(hourly(w)).toBe(true);
  });
  it('does not show when the only dwarf has hunting off', () => {
    const w = world(), id = w.spawnDwarf({ at: w.index(20, 20, z) });
    w.setLabor(id, 'hunting', false);
    expect(hourly(w)).toBe(false);
  });
  it('shows when one of two dwarves has hunting on, and stops once a bow exists', () => {
    const w = world(), on = w.spawnDwarf({ at: w.index(20, 20, z) }), off = w.spawnDwarf({ at: w.index(21, 20, z) });
    w.setLabor(on, 'hunting', true); w.setLabor(off, 'hunting', false);
    expect(hourly(w)).toBe(true);
    w.spawnItem('bow', 'birch', w.index(22, 20, z));
    expect(hourly(w)).toBe(false);
  });
});
