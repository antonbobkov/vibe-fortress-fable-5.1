/**
 * T-396: with no hearth hall a civilian's retreat tile is never a door tile, and it is fixed when
 * the alert starts and kept while the alert lasts, so the shelter does not move with the dwarf
 * (19 § Hearth alert retreat, 10 § Behavior selection step 2).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { DefenseReader } from '@systems/defense';
import { TestWorld } from '../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z - 7;

function dig(w: TestWorld, x: number, y: number, width: number, height: number): void {
  w.digRoom(x, y, Z, width, height);
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) w.discover(w.index(x + dx, y + dy, Z));
}

/** Three chambers in a row, A (x 14..19), B (21..27) and C (29..35), with a door between each pair; a civilian in A. */
function threeRooms(seed: string): { w: TestWorld; dwarf: EntityId; d1: TileIndex; d2: TileIndex } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  dig(w, 14, 14, 6, 7);
  dig(w, 20, 17, 1, 1);
  const d1 = w.index(20, 17, Z);
  w.build('door', d1, 'granite');
  dig(w, 21, 14, 7, 7);
  dig(w, 28, 17, 1, 1);
  const d2 = w.index(28, 17, Z);
  w.build('door', d2, 'granite');
  dig(w, 29, 14, 7, 7);
  const dwarf = w.spawnDwarf({ at: w.index(19, 17, Z) });
  return { w, dwarf, d1, d2 };
}

const defense = (w: TestWorld): DefenseReader => w.readers.of<DefenseReader>('19');

/** Keep the civilian's needs down, so that nothing but the alert moves it. */
function run(w: TestWorld, dwarf: EntityId, ticks: number, each?: () => void): void {
  for (let t = 0; t < ticks; t += 10) {
    w.step(10);
    for (const need of ['hunger', 'thirst', 'rest'] as const) {
      const n = w.game.world.entities.get(dwarf, C.Needs);
      if (n !== undefined && n[need] > 20) w.setNeed(dwarf, need, 0);
    }
    each?.();
  }
}

describe('T-396 the shelter without a hall stays where it was fixed', () => {
  it('the retreat tile is behind the first door, not in its doorway, and holds for a day', () => {
    const { w, dwarf, d1, d2 } = threeRooms('t396-three-rooms');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(1);
    const first = defense(w).retreatTile(dwarf);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).not.toBe(d1);
    expect(first).not.toBe(d2);
    expect(w.map.xOf(first)).toBeGreaterThan(20);
    expect(w.map.xOf(first)).toBeLessThan(28);
    const seen = new Set<TileIndex>();
    let ticks = 0;
    // It passes the first doorway on its way; once through, it never stands in a doorway again.
    run(w, dwarf, TICKS_PER_DAY, () => {
      ticks += 10;
      const at = w.game.movement.tileOf(dwarf);
      seen.add(at);
      if (ticks > 200) {
        expect(at).not.toBe(d1);
        expect(at).not.toBe(d2);
      }
      expect(defense(w).retreatTile(dwarf)).toBe(first);
    });
    // It went through the first door, to its shelter, and no further.
    expect([...seen].every((t) => w.map.xOf(t) < 28)).toBe(true);
    expect(w.map.xOf(w.game.movement.tileOf(dwarf))).toBeGreaterThan(20);
    expect(w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('retreat');
  });

  it('the kept tile survives a save in the middle of the alert', () => {
    const { w, dwarf } = threeRooms('t396-save');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    run(w, dwarf, 300);
    const kept = defense(w).retreatTile(dwarf);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    w.replaceGame(loaded);
    expect(defense(w).retreatTile(dwarf)).toBe(kept);
    run(w, dwarf, 600);
    expect(defense(w).retreatTile(dwarf)).toBe(kept);
  });

  it('is fixed again when the alert is raised again, and when the tile can no longer be reached', () => {
    const { w, dwarf } = threeRooms('t396-recompute');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    run(w, dwarf, 300);
    const first = defense(w).retreatTile(dwarf);
    // The tile is walled in: the dwarf takes another one behind a door.
    w.game.world.services.terrain.setKind(first, TileKind.Wall, w.game.registry.table('materials').index('granite'));
    run(w, dwarf, 100);
    const second = defense(w).retreatTile(dwarf);
    expect(second).toBeGreaterThanOrEqual(0);
    expect(second).not.toBe(first);
    expect(defense(w).retreatTile(dwarf)).toBe(second);
    // Lowered and raised again, from where it stands now: fixed anew.
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'calm' }).ok).toBe(true);
    run(w, dwarf, 100);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    run(w, dwarf, 100);
    expect(defense(w).retreatTile(dwarf)).toBeGreaterThanOrEqual(0);
  });

  it('a hearth hall that becomes reachable takes the shelter from the kept tile', () => {
    const { w, dwarf } = threeRooms('t396-hall');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    run(w, dwarf, 300);
    const kept = defense(w).retreatTile(dwarf);
    const hall: TileIndex[] = [];
    for (let y = 14; y < 21; y += 1) for (let x = 14; x < 20; x += 1) hall.push(w.index(x, y, Z));
    w.build('hearth', w.index(16, 16, Z), 'granite');
    w.zone('hearth_hall', hall);
    w.step(5);
    const now = defense(w).retreatTile(dwarf);
    expect(now).not.toBe(kept);
    expect(hall).toContain(now);
  });
});
