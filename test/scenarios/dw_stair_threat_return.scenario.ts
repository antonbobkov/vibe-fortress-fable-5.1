/** T-141: a stationary threat must not make a civilian cycle through an entrance stair. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

export function setupStairThreat(w: TestWorld): { id: number; enemy: number; hall: number } {
  for (let x = 45; x <= 50; x += 1) for (let y = 45; y <= 50; y += 1) {
    w.carve(w.index(x, y, 30), TileKind.Floor);
    w.discover(w.index(x, y, 30));
  }
  for (let z = 30; z <= 32; z += 1) w.carve(w.index(48, 48, z), TileKind.StairsUpDown);
  w.build('hearth', w.index(45, 45, 30), 'granite');
  const hall = w.index(47, 47, 30);
  const id = w.spawnDwarf({ at: w.index(48, 48, 32), name: 'Entrance Cook' });
  const enemy = w.spawnCreature('gloam_warrior', w.index(53, 48, 32), 'hostile:gloam');
  w.spawnItem('easy_meal', 'dimcap', w.index(48, 47, 32), 5);
  for (const need of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(id, need, 0);
  w.setNeed(id, 'hunger', 60);
  return { id, enemy, hall };
}

const scenario: Scenario = {
  id: 'dw_stair_threat_return', milestone: 8, seed: 'dw-stair-threat-return', world: 'flat-test', embark: 'none',
  run: (w) => {
    const { id, enemy } = setupStairThreat(w);
    let level = w.game.world.entities.get(id, C.Position)!.z;
    let changes = 0;
    for (let tick = 0; tick < 500; tick += 1) {
      w.step(1);
      const next = w.game.world.entities.get(id, C.Position)!.z;
      if (next !== level) changes += 1;
      level = next;
    }
    expect(w.game.world.entities.get(enemy, C.Position)).toMatchObject({ x: 53, y: 48, z: 32 });
    expect(changes, 'T-141: at most one descent through the two-level stair').toBeLessThanOrEqual(2);
    expect(w.events('MealEaten').filter((e) => e['id'] === id)).toHaveLength(0);
    w.setNeed(id, 'hunger', 90);
    w.until(() => w.events('MealEaten').some((e) => e['id'] === id), 500);
    expect(w.game.world.entities.get(id, C.Needs)?.hunger).toBeLessThan(50);
    expect(w.game.world.entities.alive(id)).toBe(true);
  },
};
export default scenario;
