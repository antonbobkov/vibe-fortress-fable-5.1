/** T-M6-13 magma chamber: a safe stone floodgate admits magma and burns a raider, but spares a wyrm. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { FluidsReader } from '@systems/fluids';
import type { Scenario } from './runner';

let gate = 0;
let lever = 0;
let raider = 0;
let wyrm = 0;
let chamber = 0;
const scenario: Scenario = {
  id: 'df_pattern_magma', milestone: 6, seed: 'df-pattern-magma', world: 'flat-test', embark: 'none',
  setup: (w) => {
    const granite = w.game.registry.table('materials').index('granite');
    const source = w.index(40, 40, 32);
    chamber = w.index(42, 40, 32);
    for (let x = 39; x <= 43; x += 1) for (const y of [39, 41]) w.game.world.services.terrain.setKind(w.index(x, y, 32), TileKind.Wall, granite);
    for (const x of [39, 43]) w.game.world.services.terrain.setKind(w.index(x, 40, 32), TileKind.Wall, granite);
    gate = w.build('floodgate_building', w.index(41, 40, 32), 'granite');
    lever = w.build('lever', w.index(45, 40, 32), 'granite');
    const record = w.game.world.entities.get(lever, C.Building)!;
    w.game.world.entities.add(lever, C.Building, { ...record, linkedIds: [gate] });
    raider = w.spawnCreature('gloam_warrior', chamber, 'hostile:gloam');
    const wyrmTile = w.index(48, 40, 32);
    for (const n of w.map.neighbors8(wyrmTile)) w.game.world.services.terrain.setKind(n, TileKind.Wall, granite);
    wyrm = w.spawnCreature('magma_wyrm', wyrmTile, 'hostile:wyrm');
    w.setFluid(source, 7, 'magma', true);
    w.setFluid(wyrmTile, 7, 'magma');
  },
  run: (w) => {
    const fluid = w.readers.of<FluidsReader>('04');
    w.step(120);
    expect(fluid.levelAt(chamber)).toBe(0);
    w.game.world.emit({ type: 'MechanismTriggered', sourceId: lever, on: true });
    w.until(() => fluid.levelAt(chamber) > 0, 1500);
    w.until(() => w.events('CreatureDied').some((e) => e['id'] === raider && e['cause'] === 'magma'), 300);
    expect(w.game.world.entities.alive(wyrm)).toBe(true);
    expect(w.events('MagmaContact').length).toBeGreaterThan(0);
  },
};
export default scenario;
