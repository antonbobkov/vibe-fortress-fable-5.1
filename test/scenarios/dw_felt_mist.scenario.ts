import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { CombatReader } from '@systems/combat';
import type { Scenario } from './runner';
import { digWaterfall } from './waterfall';

/** T-157: a commanded station walk enters the mist above a source-fed waterfall. */
const scenario: Scenario = {
  id: 'dw_felt_mist', milestone: 8, seed: 'dw-felt-mist', world: 'flat-test', embark: 'none',
  run: (w) => {
    digWaterfall(w, 30, 40, 31, 10, 3);
    w.until((v) => v.events('MistProduced').length > 0, 600);
    for (let x = 37; x <= 39; x++) w.carve(w.index(x, 39, 29), TileKind.Floor);
    const dwarf = w.spawnDwarf({ at: w.index(37, 39, 29) });
    const apply = w.game.world.applyCommand.bind(w.game.world);
    expect(apply({ type: 'CreateSquad', name: 'Mist visitors' }).ok).toBe(true);
    const squad = w.readers.of<CombatReader>('16').squads()[0]!.id;
    expect(apply({ type: 'SetSquadMembers', squadId: squad, members: [dwarf] }).ok).toBe(true);
    expect(apply({ type: 'SetSquadStation', squadId: squad, tile: w.index(39, 39, 29) }).ok).toBe(true);
    expect(apply({ type: 'SetSquadMode', squadId: squad, mode: 'active' }).ok).toBe(true);
    w.until((v) => v.events('DwarfFeltMist').length > 0, 200);
    expect(w.events('DwarfFeltMist')).toEqual([expect.objectContaining({ id: dwarf })]);
  },
};
export default scenario;
