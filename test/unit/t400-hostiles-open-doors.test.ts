/**
 * T-400-hostiles-never-open-doors: a hostile whose species has the flag `O` (creatures.md, exported
 * as `flags.opensDoors`) passes an unlocked door and is stopped by a locked one (14 § Doors and
 * hatches, 22 § Passability). The movers read the flag at the top of the creature row, where the
 * content has none, so no hostile ever opened a door.
 */
import { describe, it, expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { TestWorld } from '../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

/** A wall across the map at y = 40 with one door at (40, 40); a Gloam warrior north of it. */
function walled(seed: string): { w: TestWorld; door: EntityId; gloam: EntityId; beyond: TileIndex } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 40, Z), TileKind.Wall, granite);
  const door = w.build('door', w.index(40, 40, Z), 'granite');
  const gloam = w.spawnCreature('gloam_warrior', w.index(40, 36, Z), 'hostile:gloam');
  return { w, door, gloam, beyond: w.index(40, 44, Z) };
}

/** Walks the creature toward `to` for up to `ticks`; the last outcome. */
function walk(w: TestWorld, id: EntityId, to: TileIndex, ticks: number): string {
  const movement = w.game.world.services.movement!;
  let outcome = '';
  for (let t = 0; t < ticks; t += 1) {
    outcome = movement.walkTo(id, to, 'combat', { tick: w.tick, emit: (e) => w.game.world.emit(e) });
    if (outcome === 'arrived' || outcome === 'unreachable') return outcome;
    w.step(1);
  }
  return outcome;
}

describe('T-400-hostiles-never-open-doors', () => {
  it('a Gloam warrior walks through an unlocked door', () => {
    const { w, gloam, beyond } = walled('t-new-doors-open');
    w.step(1);
    expect(walk(w, gloam, beyond, 600)).toBe('arrived');
    expect(w.game.world.services.movement!.tileOf(gloam)).toBe(beyond);
  });

  it('a locked door stops it', () => {
    const { w, door, gloam, beyond } = walled('t-new-doors-locked');
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' }).ok).toBe(true);
    w.step(1);
    expect(walk(w, gloam, beyond, 600)).toBe('unreachable');
    expect(w.game.world.entities.get(gloam, C.Position)!.y).toBeLessThan(40);
  });
});
