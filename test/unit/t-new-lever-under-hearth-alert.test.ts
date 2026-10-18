/**
 * T-NEW-lever-under-hearth-alert: under a `hearth` alert a sheltering civilian pulls a lever that
 * stands inside its shelter (10 § Behavior selection step 2, 11 § Hearth alert), and returns to the
 * shelter; a lever outside the shelter waits for the alert to end.
 */

import { describe, it, expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { PRIORITY_MAX } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z - 7;

function rect(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) out.push(w.index(x + dx, y + dy, Z));
  return out;
}

/** A dug chamber with a hearth hall at x 17..23 and a mechanic in it; the lever at `leverAt`. */
function fortress(seed: string, leverAt: (w: TestWorld) => TileIndex, mechanicAt: [number, number] = [19, 19]): { w: TestWorld; mechanic: EntityId; lever: EntityId } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  w.digRoom(14, 14, Z, 34, 14);
  for (const tile of rect(w, 14, 14, 34, 14)) w.discover(tile);
  w.build('hearth', w.index(20, 20, Z), 'granite');
  w.zone('hearth_hall', rect(w, 17, 17, 7, 7));
  const lever = w.build('lever', leverAt(w), 'granite');
  const mechanic = w.spawnDwarf({ at: w.index(mechanicAt[0], mechanicAt[1], Z) });
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

  it('a civilian standing in the gatehouse when the alert is raised shelters in the hall: the gatehouse lever waits', () => {
    // The gatehouse lies past the hall's door; the mechanic stands beside its lever.
    const { w, mechanic, lever } = fortress('lever-alert-gatehouse', (tw) => tw.index(44, 21, Z), [44, 20]);
    for (let y = 14; y < 28; y += 1) if (y !== 20) w.game.world.services.terrain.setKind(w.index(40, y, Z), 1, w.game.registry.table('materials').index('granite'));
    w.build('door', w.index(40, 20, Z), 'granite');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PullLever', leverId: lever }).ok).toBe(true);
    run(w, mechanic, 600);
    expect(pulled(w, lever)).toBe(false);
    const pos = w.game.world.entities.get(mechanic, C.Position);
    expect(pos !== undefined && pos.x >= 17 && pos.x <= 23).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'calm' }).ok).toBe(true);
    run(w, mechanic, 900);
    expect(pulled(w, lever)).toBe(true);
  });
});

/** Dig a box and mark it discovered, as the dwarves' own dig leaves it. */
function dig(w: TestWorld, x: number, y: number, z: number, width: number, height: number): void {
  w.digRoom(x, y, z, width, height);
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) w.discover(w.index(x + dx, y + dy, z));
}

/**
 * With no hearth hall a civilian shelters in the indoor area around its retreat tile (19): here the
 * tile nearest to it behind a door, the doorway `(20, 17)` of a chamber `S`; the area spreads from
 * it along the walker graph, so it is the room `X` the mechanic stands in and `S`. Whether the lever
 * job is offered is read from the board on the alert's first tick, before the mechanic moves: 19
 * recomputes the retreat tile from where the dwarf stands, so once it stands in the doorway its
 * shelter is the area past the next door (T-NEW-no-hall-shelter-moves-with-the-dwarf).
 */
function noHall(seed: string): { w: TestWorld; mechanic: EntityId } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  dig(w, 14, 14, Z, 6, 7); // X
  dig(w, 20, 17, Z, 1, 1);
  w.build('door', w.index(20, 17, Z), 'granite');
  dig(w, 21, 14, Z, 7, 7); // S
  const mechanic = w.spawnDwarf({ at: w.index(19, 17, Z) });
  w.setLabor(mechanic, 'mechanics', true);
  return { w, mechanic };
}

/** The board offers the mechanic an open job, or it has claimed one already. */
function offered(w: TestWorld, mechanic: EntityId): boolean {
  return w.readers.of<JobsReader>('11').hasUrgent(mechanic, PRIORITY_MAX) || (w.game.world.entities.get(mechanic, C.Worker)?.jobId ?? 0) !== 0;
}

describe('T-NEW-lever-under-hearth-alert: the shelter without a hall', () => {
  it('a lever on the level below, reached only by the stairs past a door, is not in the shelter', () => {
    const { w, mechanic } = noHall('lever-alert-below');
    // L lies under X; the way down is the door D2 at (17, 21), the stairs at (17, 23) and back north.
    dig(w, 14, 14, Z - 1, 6, 7);
    dig(w, 17, 21, Z, 1, 2);
    w.build('door', w.index(17, 21, Z), 'granite');
    w.carve(w.index(17, 23, Z), TileKind.StairsDown);
    w.carve(w.index(17, 23, Z - 1), TileKind.StairsUp);
    w.discover(w.index(17, 23, Z));
    w.discover(w.index(17, 23, Z - 1));
    dig(w, 17, 21, Z - 1, 1, 2);
    const lever = w.build('lever', w.index(16, 17, Z - 1), 'granite');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PullLever', leverId: lever }).ok).toBe(true);
    w.step(1);
    expect(w.reachable(w.index(18, 17, Z), w.index(16, 18, Z - 1))).toBe(true);
    expect(offered(w, mechanic)).toBe(false);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'calm' }).ok).toBe(true);
    run(w, mechanic, 900);
    expect(pulled(w, lever)).toBe(true);
  });

  it('a lever in an indoor tunnel past a lowered drawbridge is not in the shelter', () => {
    const { w, mechanic } = noHall('lever-alert-bridge');
    // A tunnel south from X, a lowered drawbridge across it at (16, 24), the lever beyond.
    dig(w, 16, 21, Z, 1, 9);
    const bridge = w.build('drawbridge', w.index(16, 24, Z), 'granite');
    const lever = w.build('lever', w.index(16, 28, Z), 'granite');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PullLever', leverId: lever }).ok).toBe(true);
    w.step(1);
    expect(w.readers.of<{ mechanismState(id: EntityId): string }>('14').mechanismState(bridge)).toBe('lowered');
    expect(offered(w, mechanic)).toBe(false);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'calm' }).ok).toBe(true);
    run(w, mechanic, 900);
    expect(pulled(w, lever)).toBe(true);
  });

  it('a lever in the room the civilian shelters in is offered', () => {
    const { w, mechanic } = noHall('lever-alert-same');
    const lever = w.build('lever', w.index(15, 15, Z), 'granite');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PullLever', leverId: lever }).ok).toBe(true);
    w.step(1);
    expect(offered(w, mechanic)).toBe(true);
  });
});
