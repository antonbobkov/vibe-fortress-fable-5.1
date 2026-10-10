import { expect } from 'vitest';
import { HeadlessGame, FLAT_TEST_SPEC, FLAT_TEST_LAYERS } from '@app/headless';
import { C } from '@core/components';
import { LOCAL_MAP_H, LOCAL_MAP_W } from '@core/constants';
import { MaterialsSystem } from '@systems/materials';
import type { CombatReader } from '@systems/combat';
import type { Scenario } from './runner';

const spring = (32 * LOCAL_MAP_H + 20) * LOCAL_MAP_W + 20;
/** T-157: walking to a station enters a real configured warm-spring neighbourhood. */
const scenario: Scenario = {
  id: 'dw_near_spring', milestone: 8, seed: 'dw-near-spring', world: 'flat-test', embark: 'none',
  systems: () => HeadlessGame.standardSystems(FLAT_TEST_SPEC, FLAT_TEST_LAYERS).map((s) => s.id === '05' ? new MaterialsSystem({ warmSprings: [spring] }) : s),
  run: (w) => {
    const dwarf = w.spawnDwarf({ at: w.index(14, 20, 32) });
    const apply = w.game.world.applyCommand.bind(w.game.world);
    expect(apply({ type: 'CreateSquad', name: 'Spring visitors' }).ok).toBe(true);
    const squad = w.readers.of<CombatReader>('16').squads()[0]!.id;
    expect(apply({ type: 'SetSquadMembers', squadId: squad, members: [dwarf] }).ok).toBe(true);
    expect(apply({ type: 'SetSquadStation', squadId: squad, tile: spring }).ok).toBe(true);
    expect(apply({ type: 'SetSquadMode', squadId: squad, mode: 'active' }).ok).toBe(true);
    w.until((v) => v.events('DwarfNearSpring').length > 0, 200);
    expect(w.events('DwarfNearSpring')).toEqual([expect.objectContaining({ id: dwarf })]);
    const pos = w.game.world.entities.get(dwarf, C.Position)!;
    expect(Math.max(Math.abs(pos.x - 20), Math.abs(pos.y - 20))).toBeLessThanOrEqual(1);
    w.step(20);
    expect(w.events('DwarfNearSpring')).toHaveLength(1);
  },
};
export default scenario;
