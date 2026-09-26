/** T-M6-13 kill corridor: a weapon trap hits a raider while a stationed crossbow fires through a fortification. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { CombatReader } from '@systems/combat/reader';
import type { Scenario } from './runner';

let shooter = 0;
let raider = 0;
let trap = 0;
const scenario: Scenario = {
  id: 'df_pattern_corridor', milestone: 6, seed: 'df-pattern-corridor', world: 'flat-test', embark: 'none',
  setup: (w) => {
    const granite = w.game.registry.table('materials').index('granite');
    for (let x = 30; x <= 40; x += 1) for (const y of [39, 41]) {
      if (x === 35) w.build('fortification', w.index(x, y, 32), 'granite');
      else w.game.world.services.terrain.setKind(w.index(x, y, 32), TileKind.Wall, granite);
    }
    trap = w.build('weapon_trap', w.index(35, 40, 32), 'iron');
    shooter = w.spawnDwarf({ at: w.index(35, 38, 32), skills: { crossbow: 8 } });
    const crossbow = w.spawnItem('crossbow', 'iron', w.index(35, 38, 32));
    const bolts = w.spawnItem('bolt', 'iron', w.index(35, 38, 32), 20);
    w.game.world.entities.add(shooter, C.Equipment, { weapon: crossbow, shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver: bolts });
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate archers' }).ok).toBe(true);
    const squad = w.readers.of<CombatReader>('16').squads()[0]!;
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [shooter] }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetSquadStation', squadId: squad.id, tile: w.index(35, 38, 32) }).ok).toBe(true);
    raider = w.spawnCreature('gloam_warrior', w.index(34, 40, 32), 'hostile:gloam');
  },
  run: (w) => {
    const trapTile = w.index(35, 40, 32);
    w.step(1);
    w.game.world.services.movement?.teleport(raider, trapTile);
    w.until(() => w.events('TrapTriggered').some((e) => e['trapId'] === trap), 10);
    expect(w.readers.pathing.lineOfSight(w.index(35, 38, 32), trapTile)).toBe(true);
    expect(w.game.world.services.combat?.fireAt(shooter, raider)).toBe(true);
    w.until(() => w.events('AttackResolved').some((e) => e['attackerId'] === shooter), 30);
  },
};
export default scenario;
