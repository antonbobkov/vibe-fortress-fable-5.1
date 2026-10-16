/** T-303: a lock_on_alert door does not lock on a creature standing in its doorway. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { ALERT_LOCK_GRACE_TICKS } from '@systems/defense/constants';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

describe('T-303 an alert door locks only when its doorway is clear', () => {
  it('stays open past the grace period while a dwarf stands in the doorway, and locks when it leaves', () => {
    const w = new TestWorld({ seed: 't303-door-doorway', world: 'flat-test' });
    const granite = w.game.registry.table('materials').index('granite');
    for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
    const t = w.index(40, 20, Z);
    const door = w.build('door', t, 'oak');
    w.build('hearth', w.index(40, 28, Z), 'granite');
    w.step(1);
    const b = w.readers.of<BuildingsReader>('14');
    // A soldier standing guard in the doorway: it does not move on its own.
    const soldier = w.spawnDwarf({ at: t });
    w.game.world.entities.remove(soldier, C.Brain);
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(ALERT_LOCK_GRACE_TICKS + 20);
    expect(b.mechanismState(door)).not.toBe('locked');
    expect(w.game.world.readers.pathing.passable(t, 'walker')).toBe(true);
    // It steps inside: the door locks behind it.
    expect(w.game.movement.teleport(soldier, w.index(40, 22, Z))).toBe(true);
    w.until(() => b.mechanismState(door) === 'locked', 5);
    expect(w.game.world.readers.pathing.passable(t, 'walker')).toBe(false);
  });
});
