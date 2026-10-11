import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { buildFlatTestMap, FLAT_TEST_SPEC, FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { CombatReader } from '@systems/combat';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;

describe('T-220 a pack stops its hunting attacks when a kill feeds it', () => {
  it.each(['hunt', 'attack', 'defending'])('ends only hunting targets in %s when a packmate kills another', (state) => {
    const w = new TestWorld({ seed: `t220-pack-fed-${state}`, registry,
      map: buildFlatTestMap(registry, 64, 64), embark: 'none', surfaceWildlife: 'none', spec: FLAT_TEST_SPEC });
    const a = w.spawnCreature('wolf', w.index(30, 30, Z), 'wild');
    const b = w.spawnCreature('wolf', w.index(40, 30, Z), 'wild');
    const deadPrey = w.spawnTame('dog', w.index(29, 30, Z));
    const livePrey = w.spawnDwarf({ at: w.index(state === 'hunt' ? 49 : 41, 30, Z) });
    const entities = w.game.world.entities;
    for (const [id, target] of [[a, deadPrey], [b, livePrey]]) {
      entities.add(id!, C.Wild, { ...entities.get(id!, C.Wild)!, state: state === 'defending' ? 'attack' : state, hungry: true, stateUntil: 0,
        ...(state === 'defending' && id === b ? { defendFrom: w.index(40, 30, Z) } : {}) });
      w.animals.brain.setTarget(id!, target!);
    }
    const combat = w.readers.of<CombatReader>('16');
    let atKill: { hungry: boolean; target: number; walkTarget: number } | undefined;
    w.game.world.onEvents((events) => {
      if (events.some((event) => event.type === 'CreatureDied' && event['id'] === deadPrey)) {
        atKill = { hungry: entities.get(b, C.Wild)!.hungry, target: combat.targetOf(b), walkTarget: w.movement.walkTarget(b) };
      }
    });
    w.game.world.emit({ type: 'DamageDealt', defenderId: deadPrey, part: 'head', damageType: 'edge', amount: 999, attackerId: a, weaponId: 0 });
    w.step(2);
    expect(w.events('CreatureDied').some((event) => event['id'] === deadPrey && event['killerId'] === a)).toBe(true);
    expect(entities.alive(livePrey)).toBe(true);
    expect(atKill).toEqual({ hungry: false, target: state === 'defending' ? livePrey : 0, walkTarget: -1 });
  });
});
