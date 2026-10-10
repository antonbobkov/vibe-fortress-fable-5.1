import { expect } from 'vitest';
import { C } from '@core/components';
import type { DefenseReader } from '@systems/defense';
import type { Scenario } from './runner';

/** T-157: deterministic real triggers jam a weapon trap; cleaning and rearming are real jobs. */
const scenario: Scenario = {
  id: 'df_trap_upkeep', milestone: 8, seed: 'df-trap-upkeep', world: 'flat-test', embark: 'none',
  run: (w) => {
    const tile = w.index(40, 40, 32);
    const trap = w.build('weapon_trap', tile, 'iron');
    const reader = w.readers.of<DefenseReader>('19');
    w.step(1);
    for (let i = 0; i < 40 && reader.trapState(trap) !== 'jammed'; i++) {
      const target = w.spawnCreature('trollkin', w.index(39, 40, 32), 'hostile:gloam');
      w.movement.teleport(target, tile);
      w.step(2);
      // Each trial is a new crossing; remove survivors so the later cleaner is not in combat.
      if (w.game.world.entities.alive(target)) w.game.world.entities.destroy(target);
    }
    expect(w.events('TrapJammed').some((e) => e['trapId'] === trap)).toBe(true);
    expect(reader.trapState(trap)).toBe('jammed');
    const mechanic = w.spawnDwarf({ at: w.index(44, 40, 32), skills: { mechanics: 10 } });
    w.setLabor(mechanic, 'cleaning', true);
    w.until((v) => v.events('JobCompleted').some((e) => e['jobType'] === 'clean_trap'), 1000);
    expect(reader.trapState(trap)).toBe('armed');
    // A spent stone trap separately exercises rearm_trap and TrapRearmed (cleaning is not reloading).
    const stoneTile = w.index(40, 44, 32);
    const stoneTrap = w.build('stone_fall_trap', stoneTile, 'granite');
    const victim = w.spawnCreature('trollkin', w.index(39, 44, 32), 'hostile:gloam');
    w.step(1);
    w.movement.teleport(victim, stoneTile);
    w.step(2);
    expect(reader.trapState(stoneTrap)).toBe('spent');
    if (w.game.world.entities.alive(victim)) w.game.world.entities.destroy(victim);
    w.spawnItem('stone_block', 'granite', w.index(44, 43, 32));
    w.until((v) => v.events('TrapRearmed').some((e) => e['trapId'] === stoneTrap), 1500);
    expect(reader.trapState(stoneTrap)).toBe('armed');
    expect(w.game.world.entities.get(mechanic, C.Creature)).toBeDefined();
    expect(w.events('JobCompleted').some((e) => e['jobType'] === 'rearm_trap')).toBe(true);
  },
};
export default scenario;
