import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';

/** T-157: a single real dig breaches a generated cavern and wakes its sleepers. */
const scenario: Scenario = {
  id: 'th_cavern_spawn', milestone: 8, seed: 'descent',
  world: { region: { wealth: 3, peril: 1, geology: 'igneous' } }, embark: 'none',
  run: (w) => {
    // Isolate the last dig from the long descent's shaft, forge and economy setup.
    w.digRoom(20, 45, 19, 2, 1);
    const wall = w.index(22, 45, 19);
    w.discover(wall);
    expect(w.map.kindAt(wall)).toBe(TileKind.Wall);
    w.spawnDwarf({ at: w.index(21, 45, 19), skills: { mining: 15 } });
    w.spawnItem('pick', 'iron', w.index(21, 45, 19));
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [wall], kind: 'dig' }).ok).toBe(true);
    w.until((v) => v.events('CavernBreached').some((e) => e['cavern'] === 1), 500);
    w.step(1);
    const spawned = w.events('MonsterSpawned').filter((e) => e['cavern'] === 1);
    expect(spawned.length).toBeGreaterThan(0);
    expect(new Set(spawned.map((e) => e['id'])).size).toBe(spawned.length);
    for (const event of spawned) expect(w.game.world.entities.get(event['id'] as number, C.Hostile)?.behaviorState).not.toBe('asleep');
  },
};
export default scenario;
