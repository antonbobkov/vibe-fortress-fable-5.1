/**
 * `core_command_rejection` of `04-implementation/acceptance-tests.md` § Core:
 * "submit `Designate` out of bounds | `CommandRejected { out_of_bounds }`, no state change".
 *
 * Since T-M1-07 the real 03 terrain system owns and validates `Designate` (`command-catalog.md`:
 * "each tile in bounds"); the M0 stand-in of DECISIONS.md D-036 is gone. The scenario pins what the
 * core does with a rejection: the reason reaches the command log and a `CommandRejected` event, and
 * the world is unchanged.
 *
 * It also pins a registered command's invalid input rejection without a state change.
 */

import { expect } from 'vitest';
import { hashesAt } from '@app/headless';
import { LOCAL_MAP_H, LOCAL_MAP_W, LOCAL_MAP_Z } from '@core/constants';
import { Designation } from '@core/map3d';
import type { Scenario } from './runner';

const SEED = 'core-command-rejection';
const TICKS = 3;

const scenario: Scenario = {
  id: 'core_command_rejection',
  milestone: 0,
  seed: SEED,
  world: 'flat-test',
  embark: 'none',
  commands: [
    { tick: 0, command: { type: 'Designate', tiles: [-1, LOCAL_MAP_W * LOCAL_MAP_H * LOCAL_MAP_Z], kind: Designation.Dig, priority: 5 } },
    { tick: 1, command: { type: 'SetPopulationCap', n: Number.NaN } },
  ],
  run: TICKS,
  expect: (w) => {
    const rejected = w.events('CommandRejected');
    expect(rejected.map((e) => e['reason'])).toEqual(['out_of_bounds', 'bad_setting']);
    expect((rejected[0]?.['command'] as { type: string }).type).toBe('Designate');
    const log = w.game.world.commandLog.all();
    expect(log.map((entry) => entry.result)).toEqual([
      { ok: false, reason: 'out_of_bounds' },
      { ok: false, reason: 'bad_setting' },
    ]);
    // No state change: the same run without the commands hashes the same.
    const untouched = hashesAt({ seed: SEED, world: 'flat-test' }, [TICKS]);
    expect(w.hash()).toBe(untouched.get(TICKS));
    for (let i = 0; i < w.map.tileCount; i += 97) expect(w.map.designationAt(i)).toBe(Designation.None);
  },
};

export default scenario;
