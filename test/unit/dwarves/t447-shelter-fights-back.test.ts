/**
 * T-447: a civilian sheltering under the hearth alert whose shelter a hostile party member has
 * entered fights back when attacked, as if cornered (10 § Behavior selection, steps 1 and 2); it
 * does not keep backing away inside the shelter. Outside the shelter a civilian still flees.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';

/** A hearth hall over x 14–26, y 14–26 with a dwarf in it, and a Gloam warrior attacking the dwarf at `raiderAt`. */
function hall(seed: string, alert: boolean, raiderX: number, raiderY: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.build('hearth', w.index(20, 20, Z), 'granite');
  for (let y = 14; y <= 26; y += 1) for (let x = 14; x <= 26; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, Z), TileFlag.Outdoor, false);
  const dwarf = w.spawnDwarf({ at: w.index(20, 22, Z) });
  for (const need of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(dwarf, need, 0);
  w.step(2);
  expect(new Set(w.readers.of<BuildingsReader>('14').hearthHallTiles()).has(w.index(20, 22, Z)), 'the hall exists').toBe(true);
  if (alert) {
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(5);
  }
  const at = w.index(raiderX, raiderY, Z);
  const partyId = w.game.world.entities.create('party');
  w.game.world.entities.add(partyId, C.Party, {
    civ: 'gloam', purpose: 'raid', members: [], leaderId: 0, state: 'engage',
    goalTile: at, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 's', size: 1,
  });
  const raider = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'), partyId, 'gloam_warrior', 'warriors', at, 2, false);
  w.game.world.services.combat!.setTarget(raider, dwarf);
  return { w, dwarf, raider };
}

function play(w: TestWorld, dwarf: EntityId, raider: EntityId, ticks: number): { struck: number; fled: number } {
  let struck = 0; let fled = 0;
  for (let t = 0; t < ticks && w.game.world.entities.alive(dwarf) && w.game.world.entities.alive(raider); t += 1) {
    w.step(1);
    if (w.game.world.entities.get(dwarf, C.Brain)?.behavior === 'flee') fled += 1;
  }
  struck = w.events('AttackResolved').filter((e) => e['attackerId'] === dwarf && e['defenderId'] === raider).length;
  return { struck, fled };
}

describe('T-447 a sheltering civilian fights a party hostile inside its shelter', () => {
  it('fights back instead of backing away inside the hall', () => {
    const { w, dwarf, raider } = hall('t447-inside', true, 21, 22);
    const r = play(w, dwarf, raider, 300);
    expect(r.struck, 'the civilian struck the raider').toBeGreaterThan(0);
    expect(r.fled, 'ticks spent fleeing inside the shelter').toBe(0);
  });

  it('flees a raider when there is no hearth alert', () => {
    const { w, dwarf, raider } = hall('t447-calm', false, 21, 22);
    const r = play(w, dwarf, raider, 60);
    expect(r.fled, 'ticks spent fleeing').toBeGreaterThan(0);
  });
});
