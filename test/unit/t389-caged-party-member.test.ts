/**
 * T-389: a party whose leader is caught in a cage trap stays on the map. The caged member kept the
 * lead (it is alive), and with no position the party never saw itself arrive at its goal, so it
 * never loitered or retreated. A caged member has left its party (18 § Parties): it counts toward
 * the casualties, cannot lead, and stays in its cage when the party leaves.
 */
import { describe, it, expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { FLAT_TEST_SPEC, FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TileKind } from '@core/map3d';
import { Registrations, type TickContext } from '@core/system';
import { ThreatsSystem } from '@systems/threats';
import { TestWorld } from '../scenarios/test-world';

function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) };
}

/** An ambush party that 18's schedule sends now, on a flat map with no fortress. */
function raid(seed: string): { w: TestWorld; partyId: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', spec: { ...FLAT_TEST_SPEC, peril: 2, traits: [] } });
  const threats = w.game.world.scheduler.byId('18') as ThreatsSystem;
  const state = threats.serialize();
  const entry = state.schedule.find(([kind]) => kind === 'ambush')!;
  entry[1].earliestTick = 0; entry[1].nextTick = 0;
  threats.deserialize(state, context(w));
  threats.handle({ type: 'DayPassed' }, context(w));
  const partyId = w.game.world.entities.with(C.Party).find((id) => w.game.world.entities.get(id, C.Party)?.purpose === 'ambush')!;
  return { w, partyId };
}

/** Cages a creature as a cage trap does (19 § Traps): off the map, into the cage item. */
function cage(w: TestWorld, creatureId: number): number {
  const entities = w.game.world.entities;
  const p = entities.get(creatureId, C.Position)!;
  const tile = w.index(p.x, p.y, p.z);
  const cageId = w.spawnItem('cage', 'oak', tile);
  w.game.world.services.movement?.stopWalking(creatureId);
  w.game.world.services.spatial?.remove(creatureId, tile);
  entities.remove(creatureId, C.Position);
  entities.add(creatureId, C.Creature, { ...entities.get(creatureId, C.Creature)!, cagedIn: cageId });
  w.game.world.services.items?.setOccupant?.(cageId, creatureId);
  return cageId;
}

describe('T-389 a caged member leaves its party', () => {
  it('an ambush whose leader is caged takes a new leader, loiters at its goal and leaves; the caged one stays caged', () => {
    const { w, partyId } = raid('t389-caged-leader');
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    w.until(() => party().members.length >= 3 && party().leaderId !== 0, 2_000);
    const leader = party().leaderId;
    w.step(50);
    const cageId = cage(w, leader);
    w.until(() => w.events('RaidEnded').some((e) => e['partyId'] === partyId), 6 * TICKS_PER_DAY);
    expect(party().leaderId).not.toBe(leader);
    expect(w.game.world.entities.alive(leader)).toBe(true);
    expect(w.game.world.entities.get(leader, C.Creature)?.cagedIn).toBe(cageId);
    expect(w.game.world.entities.get(leader, C.Position)).toBeUndefined();
  });

  it('caged members count toward the casualties that send a party home', () => {
    const { w, partyId } = raid('t389-caged-half');
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    w.until(() => party().members.length >= party().size && party().leaderId !== 0, 2_000);
    w.step(20);
    const others = party().members.filter((m) => m !== party().leaderId);
    const half = Math.ceil(party().members.length / 2);
    for (const m of others.slice(0, half)) cage(w, m);
    w.step(100);
    expect(party().state).toBe('retreat');
    expect(party().outcome).toBe('repelled');
  });
});

/**
 * T-389, `three-years-p2-6`: a Gloam ambush whose walk to the hearth failed loitered at its arrival
 * edge, and every `TilesChanged` of the fortress's miners sent it back to `approach` with a new
 * loiter clock; the walk failed again at once, so it loitered for ever (18 § Loiter: unrelated
 * terrain changes do not restart the timer; only a broken door sends it back to approach).
 */
describe('T-389 a failed walk keeps its loiter clock', () => {
  /** The ambush on the map, its walk to the hearth failed: loitering where it stands. */
  function failedWalk(seed: string): { w: TestWorld; partyId: number; since: number } {
    const { w, partyId } = raid(seed);
    w.build('hearth', w.index(60, 60, FLAT_TEST_SURFACE_Z), 'granite');
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    w.until(() => party().members.length >= party().size && party().leaderId !== 0, 2_000);
    w.step(10);
    const P = party();
    P.state = 'loiter'; P.stateSince = w.tick; P.goalUnreachable = true; P.walkUnreachable = true;
    return { w, partyId, since: w.tick };
  }

  it('a terrain change far away does not send it back to approach or restart its loiter time', () => {
    const { w, partyId, since } = failedWalk('t389-loiter-dig');
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    // A miner digs a tile far below, every hundred ticks for a day.
    for (let k = 0; k < 12; k += 1) {
      w.game.world.services.terrain.setKind(w.index(10 + k, 90, FLAT_TEST_SURFACE_Z - 5), TileKind.Floor, 0);
      w.step(100);
      if (party().state === 'retreat' || party().state === 'gone') break;
      expect(party().state).toBe('loiter');
      expect(party().stateSince).toBe(since);
    }
  });

  it('a broken door sends it back to approach', () => {
    const { w, partyId } = failedWalk('t389-loiter-door');
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    const threats = w.game.world.scheduler.byId('18') as ThreatsSystem;
    threats.handle({ type: 'DoorBroken', id: 0 }, context(w));
    w.step(60);
    expect(party().state).not.toBe('loiter');
  });
});
