/** T-312: KillRecorded says whether the victim was an enemy, from the death event, though the victim is gone. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TestWorld } from '../../scenarios/test-world';

function world(seed: string) {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

/** The dwarf strikes the victim dead in one blow. */
function kill(w: TestWorld, killer: number, victim: number): void {
  const body = w.game.world.entities.get(victim, C.Body)!;
  w.game.world.emit({ type: 'DamageDealt', attackerId: killer, defenderId: victim, part: 'torso', damageType: 'edge', amount: body.parts[1]!.maxHp * 4 });
  w.until((v) => v.events('KillRecorded').length > 0, 30);
}

function proud(w: TestWorld, dwarf: number): number {
  const thoughts = w.game.registry.table<{ id: string }>('thoughts');
  return (w.game.world.entities.get(dwarf, C.Mood)?.thoughts ?? []).filter((t) => thoughts.byIndex(t.thought)?.id === 'killed_hostile').length;
}

describe('T-312 KillRecorded hostile', () => {
  it('a dwarf killing a hostile warrior records hostile and is proud once', () => {
    const w = world('t312-hostile');
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const gloam = w.spawnCreature('gloam_warrior', w.index(11, 10, Z), 'hostile:gloam');
    kill(w, dwarf, gloam);
    expect(w.events('KillRecorded')[0]!['hostile']).toBe(true);
    w.step(5);
    expect(proud(w, dwarf)).toBe(1);
  });

  it('a dwarf killing a wolf that was attacking records hostile', () => {
    const w = world('t312-attacking-wolf');
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const wolf = w.spawnCreature('wolf', w.index(11, 10, Z), 'wild');
    const e = w.game.world.entities;
    e.add(wolf, C.Wild, { ...e.get(wolf, C.Wild)!, state: 'attack' });
    kill(w, dwarf, wolf);
    expect(w.events('KillRecorded')[0]!['hostile']).toBe(true);
    w.step(5);
    expect(proud(w, dwarf)).toBe(1);
  });

  it('a deer killed outside a fight records not hostile and gives no pride', () => {
    const w = world('t312-deer');
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, Z) });
    w.setLabor(dwarf, 'hunting', false);
    const deer = w.spawnCreature('deer', w.index(11, 10, Z), 'wild');
    kill(w, dwarf, deer);
    expect(w.events('KillRecorded')[0]!['hostile']).toBe(false);
    w.step(5);
    expect(proud(w, dwarf)).toBe(0);
  });
});
