import { expect } from 'vitest';
import { TileFlag, TileKind } from '@core/map3d';
import type { DefenseReader } from '@systems/defense';
import type { Scenario } from './runner';

let dwarf = 0;
let door = 0;
const scenario: Scenario = {
  id: 'df_retreat_tile', milestone: 6, seed: 'df-retreat-tile', world: 'flat-test', embark: 'none',
  setup: (w) => {
    const granite = w.game.registry.table('materials').index('granite');
    for (let x = 0; x < w.map.w; x += 1) {
      if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 40, 32), TileKind.Wall, granite);
    }
    door = w.build('door', w.index(40, 40, 32), 'oak');
    for (let y = 41; y < 46; y += 1) for (let x = 38; x <= 42; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, 32), TileFlag.Outdoor, false);
    dwarf = w.spawnDwarf({ at: w.index(40, 37, 32) });
  },
  run: (w) => {
    w.step(1);
    const target = w.readers.of<DefenseReader>('19').retreatTile(dwarf);
    expect(w.map.yOf(target)).toBe(41);
    expect(w.map.hasFlag(target, TileFlag.Outdoor)).toBe(false);
    expect(w.readers.of<{ doorAt(tile: number): boolean }>('14').doorAt(w.index(40, 40, 32))).toBe(true);
    expect(door).toBeGreaterThan(0);
  },
};
export default scenario;
