/** T-122: a cavern civilian must use the vertical route to safety and then drink. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'dw_stair_flee', milestone: 8, seed: 'dw-stair-flee', world: 'flat-test', embark: 'none',
  run: (w) => {
    const start = w.index(48, 48, 30);
    for (let z = 30; z <= 32; z += 1) w.carve(w.index(48, 48, z), TileKind.StairsUpDown);
    const enemyTile = w.index(50, 48, 30);
    w.carve(enemyTile, TileKind.Floor);
    const hall = w.index(56, 48, 32);
    w.build('hearth', hall, 'granite');
    const id = w.spawnDwarf({ at: start, name: 'Stair Miner' });
    w.spawnCreature('gloam_warrior', enemyTile, 'hostile:gloam');
    w.spawnItem('drink', 'ale', w.index(55, 48, 32), 5);
    w.setNeed(id, 'thirst', 90);
    w.step(2);
    expect(w.game.world.entities.get(id, C.Brain)?.behavior).toBe('flee');
    expect(w.map.zOf(w.game.world.entities.get(id, C.Brain)!.targetTile)).toBe(32);
    w.until(() => w.events('DrankAlcohol').some((e) => e['id'] === id), 350);
    expect(w.game.world.entities.get(id, C.Position)?.z).toBe(32);
    expect(w.game.world.entities.get(id, C.Needs)?.thirst).toBeLessThan(50);
    expect(w.game.world.entities.alive(id)).toBe(true);
    expect(w.events('CreatureDied').filter((e) => e['id'] === id)).toHaveLength(0);
  },
};
export default scenario;
