import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { contentRegistry } from '@content/loader';
import type { CombatReader } from '@systems/combat/reader';
import { TestWorld } from '../scenarios/test-world';
import { HALL_Z, Z, checkFortressDefense, type FortressState } from '../scenarios/three_years_fortress';

/**
 * T-461: in `three-years-p4-2` one cave crawler killed 43 dwarves on days 234 to 239 with the alert
 * calm. The game had said so: the breach, the attacks, the first death. The three-year script now
 * answers a hostile of no party that can walk to a dwarf near it, with the alert and the squad.
 */
function fortress(seed: string): { w: TestWorld; state: FortressState; squadId: number; dwarves: number[] } {
  const w = new TestWorld({ seed, registry: contentRegistry() });
  w.digRoom(10, 10, HALL_Z, 12, 6);
  w.digRoom(10, 18, HALL_Z, 6, 4);
  const dwarves = [0, 1, 2, 3].map((i) => w.spawnDwarf({ at: w.index(11 + i, 11, HALL_Z) }));
  expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' }).ok).toBe(true);
  const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
  expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: dwarves.slice(0, 3) }).ok).toBe(true);
  w.step(1);
  const state = {
    cx: 40, cy: 40, z: Z, hallZ: HALL_Z, placedIds: {}, economy: { phases: new Set(), specialists: {} },
    gateDoorId: 0, gateDoorPlaced: false, gateDoorId2: 0, gateDoorPlaced2: false,
    squadId, answered: '', lastDangerTick: -1, shutOut: false,
  } as unknown as FortressState;
  return { w, state, squadId, dwarves };
}

function crawlerAt(w: TestWorld, tile: number, stealthed = false): number {
  const id = w.spawnCreature('cave_crawler', tile, 'hostile:cavern');
  w.game.world.entities.add(id, C.Hostile, { partyId: 0, role: 'cavern_monster', behaviorState: 'wander', stealthed, spotted: false, breakingDoorId: 0, breakingSince: 0 });
  return id;
}

describe('T-461 the three-year script answers a hostile indoors', () => {
  it('raises the alert and sends the squad at a crawler near a dwarf', () => {
    const { w, state, squadId } = fortress('t461-near');
    const crawler = crawlerAt(w, w.index(20, 14, HALL_Z));
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('hearth');
    const orders = w.readers.of<CombatReader>('16').squad(squadId)!.orders;
    expect(orders.some((o) => o.kind === 'kill' && o.targetId === crawler), 'a kill order on the crawler').toBe(true);
  });

  it('sends a squad without weapons as well: there is nowhere inside to wait for it to pass', () => {
    const { w, state, squadId } = fortress('t461-unarmed');
    const crawler = crawlerAt(w, w.index(20, 14, HALL_Z));
    expect(w.readers.of<CombatReader>('16').squad(squadId)!.members.every((m) => w.readers.of<CombatReader>('16').weaponOf(m) === 0)).toBe(true);
    checkFortressDefense(w, state);
    expect(w.readers.of<CombatReader>('16').squad(squadId)!.orders.some((o) => o.kind === 'kill' && o.targetId === crawler)).toBe(true);
  });

  it('stays calm for one that cannot walk to the dwarf, and for one it cannot see', () => {
    const { w, state } = fortress('t461-apart');
    crawlerAt(w, w.index(12, 19, HALL_Z));
    crawlerAt(w, w.index(20, 14, HALL_Z), true);
    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('calm');
  });
});
