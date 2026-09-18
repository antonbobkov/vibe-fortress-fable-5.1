/**
 * `core_command_rejection` of `04-implementation/acceptance-tests.md` § Core:
 * "submit `Designate` out of bounds | `CommandRejected { out_of_bounds }`, no state change".
 *
 * 03 terrain, which validates `Designate` (`command-catalog.md`: "each tile in bounds"), arrives
 * with T-M1-07. Until then a stand-in with 03's id owns the command and applies only that bounds
 * rule, so the scenario pins what the core does with a rejection: the reason reaches the command
 * log and a `CommandRejected` event, and the world is unchanged (T-M0-08: "with no real systems";
 * DECISIONS.md D-036). T-M1-07 swaps the stand-in for the real system.
 *
 * It also pins D-018: a command whose owner is not registered is rejected with `not_found`.
 */

import { expect } from 'vitest';
import { hashesAt } from '@app/headless';
import { LOCAL_MAP_H, LOCAL_MAP_W, LOCAL_MAP_Z } from '@core/constants';
import { Designation } from '@core/map3d';
import type { GameSystem } from '@core/system';
import type { Scenario } from './runner';
import { StandInSystem } from './stand-in-systems';

const SEED = 'core-command-rejection';
const TICKS = 3;

function terrainStandIn(): GameSystem[] {
  return [
    new StandInSystem('03', 3, {
      ownsCommands: ['Designate'],
      onCommand: (cmd) => {
        const tiles = cmd['tiles'] as readonly number[];
        // The flat-test map is the standard local map size.
        const count = LOCAL_MAP_W * LOCAL_MAP_H * LOCAL_MAP_Z;
        for (const i of tiles) {
          if (!Number.isInteger(i) || i < 0 || i >= count) return { ok: false, reason: 'out_of_bounds' };
        }
        return { ok: true };
      },
    }),
  ];
}

const scenario: Scenario = {
  id: 'core_command_rejection',
  milestone: 0,
  seed: SEED,
  world: 'flat-test',
  embark: 'none',
  systems: terrainStandIn,
  commands: [
    { tick: 0, command: { type: 'Designate', tiles: [-1, LOCAL_MAP_W * LOCAL_MAP_H * LOCAL_MAP_Z], kind: Designation.Dig, priority: 5 } },
    { tick: 1, command: { type: 'SetPopulationCap', n: 40 } },
  ],
  run: TICKS,
  expect: (w) => {
    const rejected = w.events('CommandRejected');
    expect(rejected.map((e) => e['reason'])).toEqual(['out_of_bounds', 'not_found']);
    expect((rejected[0]?.['command'] as { type: string }).type).toBe('Designate');
    const log = w.game.world.commandLog.all();
    expect(log.map((entry) => entry.result)).toEqual([
      { ok: false, reason: 'out_of_bounds' },
      { ok: false, reason: 'not_found' },
    ]);
    // No state change: the same run without the commands hashes the same.
    const untouched = hashesAt({ seed: SEED, world: 'flat-test', systems: terrainStandIn() }, [TICKS]);
    expect(w.hash()).toBe(untouched.get(TICKS));
    for (let i = 0; i < w.map.tileCount; i += 97) expect(w.map.designationAt(i)).toBe(Designation.None);
  },
};

export default scenario;
