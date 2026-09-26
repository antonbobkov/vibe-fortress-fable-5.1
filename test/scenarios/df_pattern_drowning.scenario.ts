/** T-M6-13 drowning chamber: a floodgate admits deep water that drowns trollkin but not a large wyrm at level 6. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { FluidsReader } from '@systems/fluids';
import type { Scenario } from './runner';

let gate = 0;
let lever = 0;
let troll = 0;
let wyrm = 0;
let pit = 0;
const scenario: Scenario = {
  id: 'df_pattern_drowning', milestone: 6, seed: 'df-pattern-drowning', world: 'flat-test', embark: 'none',
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
    troll = w.spawnCreature('trollkin', pit, 'hostile:trollkin');
    const wyrmTile = w.index(48, 40, 32);
    for (const n of w.map.neighbors8(wyrmTile)) w.game.world.services.terrain.setKind(n, TileKind.Wall, granite);
    wyrm = w.spawnCreature('magma_wyrm', wyrmTile, 'hostile:wyrm');
    w.setFluid(source, 6, 'water', true);
    w.setFluid(wyrmTile, 6, 'water');
  },
  run: (w) => {
    const fluid = w.readers.of<FluidsReader>('04');
    w.step(120);
    expect(fluid.levelAt(pit)).toBe(0);
    w.game.world.emit({ type: 'MechanismTriggered', sourceId: lever, on: true });
    w.until(() => fluid.levelAt(pit) >= 6, 1500);
    w.until(() => !w.game.world.entities.alive(troll), 2000);
    expect(w.events('CreatureDied').some((e) => e['id'] === troll)).toBe(true);
    expect(w.game.world.entities.alive(wyrm)).toBe(true);
  },
};
export default scenario;
