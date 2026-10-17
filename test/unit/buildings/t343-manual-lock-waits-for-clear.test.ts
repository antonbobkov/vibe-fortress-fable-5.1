/** T-343: a door locked by hand or by a lever does not close on a creature standing in its doorway. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';
import { checkInvariants } from '../../scenarios/invariants';

const Z = 32;

function doorWorld(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const tile = w.index(40, 20, Z);
  const door = w.build('door', tile, 'oak');
  w.step(1);
  // A soldier on guard in the doorway: it does not move on its own.
  const guard = w.spawnDwarf({ at: tile });
  w.game.world.entities.remove(guard, C.Brain);
  return { w, door, tile, guard };
}

describe('T-343 a lock waits until the doorway is clear', () => {
  it('a door set to locked by hand locks when the dwarf in it steps out, and not before', () => {
    const { w, door, tile, guard } = doorWorld('t343-by-hand');
    const b = w.readers.of<BuildingsReader>('14');
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' }).ok).toBe(true);
    w.step(30);
    expect(w.game.world.readers.pathing.passable(tile, 'walker')).toBe(true);
    expect(b.doorOpen(door)).toBe(true);
    expect(checkInvariants(w.game).filter((f) => f.inv === 'creature.on-impassable')).toEqual([]);
    const noted = w.events('BuildingStateChanged').filter((e) => e['id'] === door && e['state'] === 'locked').length;
    expect(w.game.movement.teleport(guard, w.index(40, 22, Z))).toBe(true);
    w.step(12); // the buildings system ticks every 10 ticks
    expect(w.game.world.readers.pathing.passable(tile, 'walker')).toBe(false);
    // The lock is noted again when it takes effect.
    expect(w.events('BuildingStateChanged').filter((e) => e['id'] === door && e['state'] === 'locked').length).toBe(noted + 1);
  });

  it('a door that a lever locks waits in the same way', () => {
    const { w, door, tile, guard } = doorWorld('t343-by-lever');
    const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
    // What a linked lever does when its delay has passed (the door needs neither the tick context nor the stream).
    system.buildings.applyMechanism(door, true, { emit: () => {} } as never, {} as never);
    w.step(5);
    expect(w.map.kindAt(tile)).toBe(TileKind.Floor);
    expect(w.game.world.readers.pathing.passable(tile, 'walker')).toBe(true);
    expect(w.game.movement.teleport(guard, w.index(40, 22, Z))).toBe(true);
    w.step(12);
    expect(w.game.world.readers.pathing.passable(tile, 'walker')).toBe(false);
  });

  it('a door set to locked with nobody in the doorway locks at once', () => {
    const { w, door, tile, guard } = doorWorld('t343-clear');
    expect(w.game.movement.teleport(guard, w.index(40, 22, Z))).toBe(true);
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' }).ok).toBe(true);
    w.step(1);
    expect(w.game.world.readers.pathing.passable(tile, 'walker')).toBe(false);
  });

  it('a hostile that opens doors, standing in the doorway, keeps a locked door from closing on it', () => {
    const { w, door, tile, guard } = doorWorld('t343-hostile');
    expect(w.game.movement.teleport(guard, w.index(40, 22, Z))).toBe(true);
    const hostile = w.spawnCreature('gloam_warrior', tile, 'hostile:gloam');
    w.game.world.entities.remove(hostile, C.Brain);
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' }).ok).toBe(true);
    w.step(30);
    expect(w.game.world.readers.pathing.passable(tile, 'walker')).toBe(true);
    expect(checkInvariants(w.game).filter((f) => f.inv === 'creature.on-impassable')).toEqual([]);
  });
});
