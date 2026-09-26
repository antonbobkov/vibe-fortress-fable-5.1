/**
 * `he_fall` of `04-implementation/acceptance-tests.md` § 17 Health:
 * "a dwarf falls 3 levels | 54 damage to the torso, or damage capped at the leg's hp − 1 to a leg;
 * a fracture either way; never LimbLost".
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { HealthReader } from '@systems/health';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'he_fall',
  milestone: 6,
  seed: 'he-fall',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const at = w.index(40, 40, FLAT_TEST_SURFACE_Z);
    const id = w.spawnDwarf({ at });

    w.game.world.emit({
      type: 'Fell',
      id,
      levels: 3,
      landedOn: at,
    });

    w.step(5);

    const health = w.readers.of<HealthReader>('17');
    const wounds = health.wounds(id);
    expect(wounds.some((wound) => wound.type === 'fracture')).toBe(true);
    expect(w.events('LimbLost')).toHaveLength(0);

    const body = w.game.world.entities.get(id, C.Body);
    expect(body?.parts.some((p) => p.destroyed)).toBe(false);

    // If a leg was damaged, it must have survived with hp >= 1
    const leftLeg = body?.parts[4];
    const rightLeg = body?.parts[5];
    if (leftLeg) expect(leftLeg.hp).toBeGreaterThanOrEqual(1);
    if (rightLeg) expect(rightLeg.hp).toBeGreaterThanOrEqual(1);
  },
};

export default scenario;
