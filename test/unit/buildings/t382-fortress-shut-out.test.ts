/** T-382: the game says when a hearth alert has locked every dwarf outside its gate. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import { ALERT_LOCK_GRACE_TICKS } from '@systems/defense/constants';
import type { BuildingsReader } from '@systems/buildings';
import { Strings } from '@ui/strings';
import { AnnouncementLog } from '@ui/announcements';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** A wall across the map with a `lock_on_alert` door and a hearth behind it; every dwarf stands still outdoors, south of the wall. */
function gate(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'default', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const door = w.build('door', w.index(40, 20, Z), 'oak');
  w.build('hearth', w.index(40, 14, Z), 'granite');
  expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
  w.step(1);
  const dwarves = w.game.world.entities.with(C.Labors);
  expect(dwarves.length).toBeGreaterThan(0);
  for (const id of dwarves) {
    w.game.world.entities.remove(id, C.Brain);
    expect(w.game.movement.teleport(id, w.index(30 + (id % 8), 30, Z))).toBe(true);
  }
  return { w, door, dwarves };
}

const shutOut = (w: TestWorld) => w.events('FortressShutOut');

describe('T-382 every dwarf outside a gate that the alert locks', () => {
  it('is announced once when the door locks, naming the door, and again in the next alert', () => {
    const { w, door } = gate('t382-shut-out');
    const b = w.readers.of<BuildingsReader>('14');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 30);
    expect(b.mechanismState(door)).toBe('locked');
    expect(shutOut(w)).toHaveLength(1);
    expect(shutOut(w)[0]).toMatchObject({ id: door, doors: [door], tile: w.index(40, 20, Z) });
    w.step(200);
    expect(shutOut(w)).toHaveLength(1);
    // The alert ends and returns: the door locks again and the player is told again.
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'calm' }).ok).toBe(true);
    w.step(20);
    expect(b.mechanismState(door)).not.toBe('locked');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 30);
    expect(shutOut(w)).toHaveLength(2);
  });

  it('is not announced while a dwarf stands inside', () => {
    const { w, door, dwarves } = gate('t382-one-inside');
    const inside = w.index(40, 14, Z);
    w.game.world.services.terrain.setFlag(inside, TileFlag.Outdoor, false);
    expect(w.game.movement.teleport(dwarves[0] as number, inside)).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 30);
    expect(w.readers.of<BuildingsReader>('14').mechanismState(door)).toBe('locked');
    expect(shutOut(w)).toHaveLength(0);
  });

  it('is not announced when every dwarf is in an open courtyard inside the walls', () => {
    const { w, door, dwarves } = gate('t382-courtyard');
    // Outdoor tiles, but on the hearth's side of the gate, in the same region as the door's inner tile.
    for (const id of dwarves) {
      const tile = w.index(30 + (id % 8), 10, Z);
      expect(w.map.hasFlag(tile, TileFlag.Outdoor)).toBe(true);
      expect(w.game.movement.teleport(id, tile)).toBe(true);
    }
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 60);
    expect(w.readers.of<BuildingsReader>('14').mechanismState(door)).toBe('locked');
    expect(shutOut(w)).toHaveLength(0);
  });

  it('is a danger line that names the doors', () => {
    const { w } = gate('t382-line');
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 30);
    const event = shutOut(w)[0]!;
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const line = log.announce(event, w.readers, w.tick);
    expect(line?.severity).toBe('danger');
    expect(line?.line.text).toMatch(/^Every dwarf is outside the locked gate \(Door #1\)/);
  });
});
