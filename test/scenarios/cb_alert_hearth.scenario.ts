import { expect } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { Scenario } from './runner';

let dwarf = 0;
let door = 0;
const scenario: Scenario = {
  id: 'cb_alert_hearth', milestone: 6, seed: 'cb-alert-hearth', world: 'flat-test', embark: 'none',
  setup: (w) => {
    const granite = w.game.registry.table('materials').index('granite');
    for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 40, 32), TileKind.Wall, granite);
    door = w.build('door', w.index(40, 40, 32), 'oak');
    w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' });
    for (let y = 41; y < 48; y += 1) for (let x = 37; x <= 43; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, 32), TileFlag.Outdoor, false);
    w.build('hearth', w.index(40, 44, 32), 'granite');
    dwarf = w.spawnDwarf({ at: w.index(40, 39, 32) });
  },
  run: (w) => {
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' })).toEqual({ ok: true });
    w.step(2);
    expect(w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('retreat');
    expect(w.game.world.entities.get(dwarf, C.Brain)?.targetTile).toBeGreaterThanOrEqual(0);
    w.until((world) => w.map.yOf(world.game.world.services.movement?.tileOf(dwarf) ?? 0) >= 41, 350);
    w.step(401);
    expect(w.readers.of<{ mechanismState(id: number): string }>('14').mechanismState(door)).toBe('locked');
  },
};
export default scenario;
