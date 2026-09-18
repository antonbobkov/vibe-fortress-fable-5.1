/**
 * T-M1-09 scenario: "seven dwarves walk to the hearth-hall fallback (the wagon tile) and idle".
 *
 * `10` § Behavior selection step 9 and `algorithms/creature-brains.md`: with no job, a dwarf goes
 * idle, `goal = hearthHallTile(id) or wagonTile`, and waits `IDLE_TICKS` before choosing again.
 * There is no hearth hall before M4, so the goal is the wagon tile of the arrival (D-057).
 */

import { expect } from 'vitest';
import type { DwarvesReader } from '@systems/dwarves';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'dw_walk_idle',
  milestone: 1,
  seed: 'dw-walk-idle',
  world: 'flat-test',
  embark: 'default',
  run: 400,
  expect: (w) => {
    const arrival = w.game.arrival;
    expect(arrival).not.toBeNull();
    const dwarves = arrival?.dwarves ?? [];
    expect(dwarves).toHaveLength(7);
    const wagon = w.index(arrival?.wagon.x ?? 0, arrival?.wagon.y ?? 0, arrival?.wagon.z ?? 0);
    const reader = w.readers.of<DwarvesReader>('10');
    for (const id of dwarves) {
      expect(w.movement.tileOf(id)).toBe(wagon);
      expect(reader.behavior(id)).not.toBe('');
      expect(reader.activityText(id)).toBe('No job');
    }
    // Each went idle once: DwarfIdle is throttled to one per stretch without a job.
    expect(w.events('DwarfIdle')).toHaveLength(7);
    // They walked there: the moves were recorded.
    expect(w.events('EntitiesMoved').length).toBeGreaterThan(0);
  },
};

export default scenario;
