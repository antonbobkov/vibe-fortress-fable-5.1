import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import { cumulativeXp } from '@systems/dwarves/rules/skills';
import type { Scenario } from './runner';

/** T-157: a real dig completion, rather than a direct grantXp call, crosses level 20. */
const scenario: Scenario = {
  id: 'dw_legendary', milestone: 8, seed: 'dw-legendary', world: 'flat-test', embark: 'none',
  run: (w) => {
    const at = w.index(10, 10, 32);
    const miner = w.spawnDwarf({ at, skills: { mining: 19 } });
    w.setSkill(miner, 'mining', 19, cumulativeXp(20) - 1);
    w.spawnItem('pick', 'iron', at);
    const wall = w.index(11, 10, 32);
    w.carve(wall, TileKind.Wall, w.game.registry.table('materials').index('granite'));
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [wall], kind: 'dig' }).ok).toBe(true);
    w.until((v) => v.events('LegendaryReached').length > 0, 500);
    expect(w.events('JobCompleted').some((e) => e['jobType'] === 'dig' && e['workerId'] === miner)).toBe(true);
    expect(w.events('LegendaryReached')).toEqual([expect.objectContaining({ id: miner, skill: 'mining' })]);
  },
};
export default scenario;
