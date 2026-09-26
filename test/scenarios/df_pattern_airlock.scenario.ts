/** T-M6-13 airlock: civilians retreat through two alert doors before they lock. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { Scenario } from './runner';

let dwarf = 0;
const doors: number[] = [];
const scenario: Scenario = {
  id: 'df_pattern_airlock', milestone: 6, seed: 'df-pattern-airlock', world: 'flat-test', embark: 'none',
  setup: (w) => {
    doors.length = 0;
    const granite = w.game.registry.table('materials').index('granite');
    for (const y of [40, 42]) {
      for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, y, 32), TileKind.Wall, granite);
      const door = w.build('door', w.index(40, y, 32), 'oak');
      doors.push(door);
      expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
    }
    // The vestibule is outside the inner enclosure, so its door waits for the civilian.
    for (let y = 42; y <= 48; y += 1) for (let x = 37; x <= 43; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, 32), TileFlag.Outdoor, false);
    w.game.world.services.terrain.setFlag(w.index(40, 41, 32), TileFlag.Outdoor, true);
    w.build('hearth', w.index(40, 46, 32), 'granite');
    dwarf = w.spawnDwarf({ at: w.index(40, 39, 32) });
  },
  run: (w) => {
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(2);
    expect(w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('retreat');
    w.until(() => w.map.yOf(w.game.world.services.movement?.tileOf(dwarf) ?? 0) >= 43, 500);
    w.step(401);
    const b = w.readers.of<BuildingsReader>('14');
    for (const door of doors) expect(b.mechanismState(door)).toBe('locked');
  },
};
export default scenario;
