import { expect } from 'vitest';
import { C } from '@core/components';
import type { Scenario } from './runner';

/** T-157: capture in a trap, install the occupied cage, then release through its command. */
const scenario: Scenario = {
  id: 'df_release_cage', milestone: 8, seed: 'df-release-cage', world: 'flat-test', embark: 'none',
  run: (w) => {
    const trapTile = w.index(40, 40, 32);
    w.build('cage_trap', trapTile, 'iron');
    const creature = w.spawnCreature('trollkin', w.index(39, 40, 32), 'hostile:gloam');
    w.step(1);
    w.movement.teleport(creature, trapTile);
    w.until((v) => v.events('CreatureCaged').length > 0, 10);
    const item = w.events('CreatureCaged')[0]!['cageItemId'] as number;
    const cage = w.build('cage_building', w.index(42, 40, 32), 'iron', 0, item);
    w.step(1);
    expect(w.game.world.entities.get(cage, C.Building)?.settings['occupantId']).toBe(creature);
    expect(w.game.world.applyCommand({ type: 'ReleaseCage', cageBuildingId: cage })).toEqual({ ok: true });
    w.step(1);
    expect(w.game.world.entities.get(creature, C.Position)).toBeDefined();
    expect(w.game.world.entities.get(creature, C.Creature)?.cagedIn).toBe(0);
    expect(w.game.world.entities.get(item, C.Item)?.occupantId).toBe(0);
    expect(w.game.world.entities.get(cage, C.Building)?.settings['occupantId']).toBe(0);
  },
};
export default scenario;
