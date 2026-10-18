/**
 * T-NEW-lever-under-hearth-alert: under a `hearth` alert a sheltering civilian pulls a lever that
 * stands inside its shelter (10 § Behavior selection step 2, 11 § Hearth alert), and returns to the
 * shelter; a lever outside the shelter waits for the alert to end.
 */

import { describe, it, expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId, TileIndex } from '@core/types';
import { TestWorld } from '../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z - 7;

function rect(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) out.push(w.index(x + dx, y + dy, Z));
  return out;
}

/** A dug chamber with a hearth hall at x 17..23 and a mechanic in it; the lever at `leverAt`. */
function fortress(seed: string, leverAt: (w: TestWorld) => TileIndex): { w: TestWorld; mechanic: EntityId; lever: EntityId } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  w.digRoom(14, 14, Z, 34, 14);
  for (const tile of rect(w, 14, 14, 34, 14)) w.discover(tile);
  w.build('hearth', w.index(20, 20, Z), 'granite');
  w.zone('hearth_hall', rect(w, 17, 17, 7, 7));
  const lever = w.build('lever', leverAt(w), 'granite');
  const mechanic = w.spawnDwarf({ at: w.index(19, 19, Z) });
  w.setLabor(mechanic, 'mechanics', true);
  return { w, mechanic, lever };
}

function pulled(w: TestWorld, lever: EntityId): boolean {
  return w.events('MechanismTriggered').some((e) => e['sourceId'] === lever);
}

function run(w: TestWorld, mechanic: EntityId, ticks: number): void {
  for (let t = 0; t < ticks; t += 10) {
    w.step(10);
    for (const need of ['hunger', 'thirst', 'rest'] as const) {
      const n = w.game.world.entities.get(mechanic, C.Needs);
      if (n !== undefined && n[need] > 20) w.setNeed(mechanic, need, 0);
    }
  }
}

describe('T-NEW-lever-under-hearth-alert', () => {
  it('a sheltering civilian pulls a lever inside its shelter while the alert lasts', () => {
    const { w, mechanic, lever } = fortress('lever-alert-in', (tw) => tw.index(22, 21, Z));
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    run(w, mechanic, 50);
    expect(w.game.world.applyCommand({ type: 'PullLever', leverId: lever }).ok).toBe(true);
    run(w, mechanic, 600);
    expect(w.game.world.fortress.alert).toBe('hearth');
    expect(pulled(w, lever)).toBe(true);
    expect(w.game.world.entities.get(mechanic, C.Brain)?.behavior).toBe('retreat');
  });

  it('a lever beyond the shelter, past the chamber\'s far end, waits for the alert to end', () => {
    const { w, mechanic, lever } = fortress('lever-alert-out', (tw) => tw.index(46, 26, Z));
    // A door between the hall and the far end: the lever is reached only by passing it.
    for (let y = 14; y < 28; y += 1) if (y !== 20) w.game.world.services.terrain.setKind(w.index(40, y, Z), 1, w.game.registry.table('materials').index('granite'));
    w.build('door', w.index(40, 20, Z), 'granite');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    run(w, mechanic, 50);
    expect(w.game.world.applyCommand({ type: 'PullLever', leverId: lever }).ok).toBe(true);
    run(w, mechanic, 600);
    expect(pulled(w, lever)).toBe(false);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'calm' }).ok).toBe(true);
    run(w, mechanic, 900);
    expect(pulled(w, lever)).toBe(true);
  });
});
