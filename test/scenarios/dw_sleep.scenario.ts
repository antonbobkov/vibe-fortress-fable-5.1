import { expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { Scenario } from './runner';

const Z = 25;
let dwarf = 0;

const scenario: Scenario = {
  id: 'dw_sleep', milestone: 4, seed: 'dw-sleep', world: 'flat-test', embark: 'none',
  setup: (w) => {
    w.digRoom(10, 30, Z, 2, 2);
    const tiles = [w.index(10, 30, Z), w.index(11, 30, Z), w.index(10, 31, Z), w.index(11, 31, Z)];
    for (let y = 29; y <= 32; y += 1) for (let x = 9; x <= 12; x += 1) w.discover(w.index(x, y, Z));
    const zone = w.zone('bedroom', tiles);
    w.build('bed', tiles[0] as number, 'oak');
    w.step(10);
    dwarf = w.spawnDwarf({ at: tiles[1] as number });
    expect(w.game.world.applyCommand({ type: 'AssignRoom', zoneId: zone, dwarfId: dwarf })).toEqual({ ok: true });
    w.setNeed(dwarf, 'rest', 65);
  },
  run: TICKS_PER_DAY,
  expect: (w) => {
    expect(w.events('Slept').some((e) => e['id'] === dwarf && e['ownBed'] === true && e['onFloor'] === false)).toBe(true);
    expect(w.game.world.entities.get(dwarf, C.Schedule)).toBeDefined();
  },
};
export default scenario;
