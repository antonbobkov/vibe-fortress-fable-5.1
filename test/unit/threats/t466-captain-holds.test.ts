/**
 * T-466: the captain holds the party together (18 § Party composition, § Party AI, Retreat). In
 * every journaled `defence_year` raid the captain walked the kill corridor first and its cage trap
 * caught it before any loot was taken; the rest stood outside the walls for two days, picked up
 * what lay there and left `looted`, since one loss in eleven is far from half. A party that arrived
 * with captains now breaks when none of them stands with it: dead, unconscious, caged or gone.
 */
import { describe, it, expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import type { EntityId } from '@core/types';
import { arriveParty, spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

/** A peril-2 raid of `size` (its captain on top) from the north edge toward a hearth with loose logs beside it. */
function raid(seed: string, kind: 'raid' | 'siege' = 'raid', size = 4): { w: TestWorld; partyId: EntityId } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.build('hearth', w.index(40, 30, Z), 'granite');
  for (let k = 0; k < 8; k += 1) w.spawnItem('log', 'oak', w.index(36 + k, 32, Z));
  w.step(1);
  const reg = w.game.registry;
  const rng = w.game.world.rngFor('t466');
  const { partyId, pendingSpawns } = arriveParty(w.game.world as never, reg, rng, kind, 'gloam', size, 'n', w.tick, 15, kind === 'siege' ? 4 : 2, false);
  for (const s of pendingSpawns) spawnHostileMember(w.game.world as never, reg, rng, s.partyId, s.species, s.role, s.tile, s.gearTier, s.isCaptain);
  w.step(1);
  return { w, partyId };
}

/** Cages a creature as a cage trap does (19 § Traps): off the map, into the cage item. */
function cage(w: TestWorld, creatureId: EntityId): void {
  const entities = w.game.world.entities;
  const p = entities.get(creatureId, C.Position)!;
  const tile = w.index(p.x, p.y, p.z);
  const cageId = w.spawnItem('cage', 'oak', tile);
  w.game.world.services.movement?.stopWalking(creatureId);
  w.game.world.services.spatial?.remove(creatureId, tile);
  entities.remove(creatureId, C.Position);
  entities.add(creatureId, C.Creature, { ...entities.get(creatureId, C.Creature)!, cagedIn: cageId });
  w.game.world.services.items?.setOccupant?.(cageId, creatureId);
}

/** Steps until the captain has led the party well in from the edge (members at the edge leave at once on a retreat). */
function inland(w: TestWorld, partyId: EntityId): void {
  const party = w.game.world.entities.get(partyId, C.Party)!;
  const ent = w.game.world.entities;
  w.until(() => party.members.every((m) => (ent.get(m, C.Position)?.y ?? 0) >= 8), 1_000);
}

function ending(w: TestWorld, partyId: EntityId): string {
  w.until(() => w.events('RaidEnded').some((e) => e['partyId'] === partyId), 4 * TICKS_PER_DAY);
  return String(w.events('RaidEnded').find((e) => e['partyId'] === partyId)?.['outcome'] ?? 'active');
}

describe('T-466 the captain holds the party together', () => {
  it('a raid records the captain it arrived with', () => {
    const { w, partyId } = raid('t466-captain-recorded');
    const party = w.game.world.entities.get(partyId, C.Party)!;
    expect(party.captainIds).toHaveLength(1);
    expect(w.game.world.entities.get(party.captainIds![0]!, C.Hostile)?.role).toBe('captain');
    expect(party.leaderId).toBe(party.captainIds![0]);
  });

  it('a raid that loses its captain before it loots retreats at once, repelled, with far fewer than half lost', () => {
    const { w, partyId } = raid('t466-captain-caged');
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    inland(w, partyId);
    cage(w, party().captainIds![0]!);
    w.step(60);
    expect(party().state).toBe('retreat');
    expect(party().loot).toEqual([]);
    expect(ending(w, partyId)).toBe('repelled');
  });

  it('with its captain standing, the same raid reaches the hearth, loots and leaves looted', () => {
    const { w, partyId } = raid('t466-captain-caged');
    expect(ending(w, partyId)).toBe('looted');
  });

  it('a raid that has taken loot when its captain falls retreats and escapes with it: looted', () => {
    const { w, partyId } = raid('t466-captain-late');
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    const captain = party().captainIds![0]!;
    const items = w.game.world.entities;
    w.until(() => party().loot.some((l) => ![0, captain].includes(items.get(l, C.Item)?.carriedBy ?? 0)), 3 * TICKS_PER_DAY);
    expect(party().state).toBe('loiter');
    cage(w, captain);
    w.step(60);
    expect(party().state).toBe('retreat');
    expect(ending(w, partyId)).toBe('looted');
  });

  it('a siege breaks only when every captain is lost', () => {
    const { w, partyId } = raid('t466-siege-captains', 'siege', 20);
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    w.until(() => (party().captainIds?.length ?? 0) >= 2, 200);
    const [first, second] = party().captainIds!;
    inland(w, partyId);
    cage(w, first!);
    w.step(60);
    expect(party().state).not.toBe('retreat');
    cage(w, second!);
    w.step(60);
    expect(party().state).toBe('retreat');
  });

  it('the captains survive a save: a raid loaded and then robbed of its captain is repelled', () => {
    const { w, partyId } = raid('t466-captain-save');
    const before = [...w.game.world.entities.get(partyId, C.Party)!.captainIds!];
    inland(w, partyId);
    w.replaceGame(roundTrip(w.game).game);
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    expect(party().captainIds).toEqual(before);
    cage(w, before[0]!);
    w.step(60);
    expect(party().state).toBe('retreat');
    expect(ending(w, partyId)).toBe('repelled');
  });

  it('a party with no recorded captains, as in an older save, is held by its casualties alone', () => {
    const { w, partyId } = raid('t466-captain-old-save');
    const party = () => w.game.world.entities.get(partyId, C.Party)!;
    const captain = party().captainIds![0]!;
    delete party().captainIds;
    inland(w, partyId);
    cage(w, captain);
    w.step(60);
    expect(party().state).not.toBe('retreat');
  });
});
