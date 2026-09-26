/** T-M6-13: a linked floodgate holds a river source out of a pit, then admits it. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { FluidsReader } from '@systems/fluids';
import type { Scenario } from './runner';

let gate = 0;
let lever = 0;
let pit = 0;
const scenario: Scenario = {
  id: 'bd_floodgate', milestone: 6, seed: 'bd-floodgate', world: 'flat-test', embark: 'none',
  setup: (w) => {
    const granite = w.game.registry.table('materials').index('granite');
    const source = w.index(40, 40, 32);
    pit = w.index(42, 40, 32);
    for (let x = 39; x <= 43; x += 1) for (const y of [39, 41]) w.game.world.services.terrain.setKind(w.index(x, y, 32), TileKind.Wall, granite);
    for (const x of [39, 43]) w.game.world.services.terrain.setKind(w.index(x, 40, 32), TileKind.Wall, granite);
    gate = w.build('floodgate_building', w.index(41, 40, 32), 'granite');
    lever = w.build('lever', w.index(45, 40, 32), 'granite');
    const record = w.game.world.entities.get(lever, C.Building)!;
    w.game.world.entities.add(lever, C.Building, { ...record, linkedIds: [gate] });
    w.setFluid(source, 7, 'water', true);
    const dwarf = w.spawnDwarf({ at: w.index(46, 40, 32) });
    expect(w.game.world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor: 'hauling', on: true }).ok).toBe(true);
  },
  run: (w) => {
    const fluids = w.readers.of<FluidsReader>('04');
    const buildings = w.readers.of<BuildingsReader>('14');
    w.step(150);
    expect(fluids.levelAt(pit)).toBe(0);
    expect(buildings.mechanismState(gate)).toBe('closed');
    expect(w.readers.pathing.passable(w.index(41, 40, 32), 'walker')).toBe(false);
    expect(w.game.world.applyCommand({ type: 'PullLever', leverId: lever }).ok).toBe(true);
    w.until(() => buildings.mechanismState(gate) === 'open', 500);
    expect(w.readers.pathing.passable(w.index(41, 40, 32), 'walker')).toBe(true);
    w.until(() => fluids.levelAt(pit) === 7, 2000);
  },
};
export default scenario;
