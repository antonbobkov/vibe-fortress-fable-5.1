import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { TICKS_PER_DAY } from '@core/constants';
import { Registrations, type TickContext } from '@core/system';
import { arriveParty } from '@systems/threats';
import { despawnMember, memberThink, pickUpLoot } from '@systems/threats/ai';
import { spawnHostileMember } from '@systems/threats/parties';
import { checkInvariants } from '../scenarios/invariants';
import { TestWorld } from '../scenarios/test-world';

function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(), jobs: w.game.world.services.jobs,
    terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) };
}

function manualThief() {
  const w = new TestWorld({ seed: 't185-held-animal', world: 'flat-test', embark: 'none' });
  const entities = w.game.world.entities;
  const partyId = entities.create('party');
  entities.add(partyId, C.Party, { civ: 'gloam', purpose: 'thief', members: [], leaderId: 0,
    state: 'approach', goalTile: w.index(12, 12, 32), goalEntity: 0,
    arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1 });
  const member = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
    partyId, 'gloam_snatcher', 'thief', w.index(12, 12, 32), 1, false);
  const party = entities.get(partyId, C.Party)!;
  return { w, entities, partyId, member, party };
}

function arrive(w: TestWorld): number {
  return arriveParty(w.game.world, w.game.registry, w.game.world.rngFor('18'),
    'thief', 'gloam', 1, 'n', w.tick, 0, 2, false).partyId;
}

describe('T-185 thieves wait for quarry and trained animals guard it', () => {
  it('waits hidden for one day when there is nothing to steal, then withdraws', () => {
    const w = new TestWorld({ seed: 't115-thief-empty', world: 'flat-test', embark: 'none' });
    const id = arrive(w);
    const party = w.game.world.entities.get(id, C.Party)!;
    const start = { ...w.game.world.entities.get(party.leaderId, C.Position)! };
    w.step(TICKS_PER_DAY - 50);
    expect(w.events('RaidEnded')).toHaveLength(0);
    expect(party.state).toBe('approach');
    expect(w.game.world.entities.get(party.leaderId, C.Hostile)?.stealthed).toBe(true);
    expect(w.game.world.entities.get(party.leaderId, C.Position)).toEqual(start);
    w.until((v) => v.events('RaidEnded').length > 0, 150);
    expect(w.events('RaidEnded').map((e) => e['outcome'])).toEqual(['withdrew']);
    expect(w.events('ThiefEscaped')).toHaveLength(0);
  });

  it('looks again while waiting and steals a newly available item', () => {
    const w = new TestWorld({ seed: 't185-recheck', world: 'flat-test', embark: 'none' });
    const partyId = arrive(w);
    w.step(100);
    const party = w.game.world.entities.get(partyId, C.Party)!;
    expect(party.state).toBe('approach');
    const p = w.game.world.entities.get(party.leaderId, C.Position)!;
    const ring = w.spawnItem('ring', 'gold', w.index(p.x, p.y, p.z));
    w.until((v) => v.events('ThiefEscaped').some((e) => e['itemId'] === ring), TICKS_PER_DAY);
    expect(w.events('RaidEnded').map((e) => e['outcome'])).toEqual(['looted']);
  });

  it.each([0, 1, 2, 3, 4])('steals an unguarded cat in report seed %i', (seed) => {
    const w = new TestWorld({ seed: `t115-thief-cat-${seed}`, world: 'flat-test', embark: 'none' });
    const cat = w.spawnTame('cat', w.index(24, 15, 32));
    arrive(w);
    w.step(TICKS_PER_DAY);
    expect(w.events('ThiefSpotted')).toHaveLength(0);
    expect(w.events('ThiefEscaped').filter((e) => e['animalId'] === cat)).toHaveLength(1);
    expect(w.game.world.entities.alive(cat)).toBe(false);
  });

  it.each([
    ['dog', 'war', true], ['dog', 'hunting', true], ['mole_hound', 'war', true],
    ['dog', 'none', false], ['cat', 'none', false], ['cat', 'war', false],
  ] as const)('%s trained %s spots the thief: %s', (species, trained, spotted) => {
    const { w, entities, party, member } = manualThief();
    const ring = w.spawnItem('ring', 'gold', w.index(12, 12, 32));
    party.goalEntity = ring;
    w.spawnTame(species, w.index(21, 12, 32), { trained });
    memberThink(member, entities.get(member, C.Hostile)!, party, context(w));
    expect(entities.get(member, C.Hostile)?.spotted).toBe(spotted);
    expect(party.loot.includes(ring)).toBe(!spotted);
  });

  it('a trained guard still needs line of sight', () => {
    const { w, entities, party, member } = manualThief();
    const ring = w.spawnItem('ring', 'gold', w.index(12, 12, 32));
    party.goalEntity = ring;
    w.spawnTame('dog', w.index(21, 12, 32), { trained: 'war' });
    w.carve(w.index(18, 12, 32), TileKind.Wall);
    memberThink(member, entities.get(member, C.Hostile)!, party, context(w));
    expect(entities.get(member, C.Hostile)?.spotted).toBe(false);
    expect(party.loot).toContain(ring);
  });

  it('only the animal carrier can report its escape', () => {
    const { w, entities, partyId, party, member } = manualThief();
    const other = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
      partyId, 'gloam_snatcher', 'thief', w.index(20, 12, 32), 1, false);
    const cat = w.spawnTame('cat', w.index(12, 12, 32));
    pickUpLoot(other, cat, party, context(w));
    despawnMember(member, partyId, party, context(w));
    w.step(1);
    expect(w.events('ThiefEscaped')).toHaveLength(0);
    expect(entities.alive(cat)).toBe(true);
    expect(party.loot).toContain(cat);
    despawnMember(other, partyId, party, context(w));
    w.step(1);
    expect(w.events('ThiefEscaped').filter((e) => e['animalId'] === cat)).toHaveLength(1);
  });

  it('saves a stolen animal and returns it at the carrier death tile', () => {
    const { w, partyId, party, member } = manualThief();
    const cat = w.spawnTame('cat', w.index(12, 12, 32));
    pickUpLoot(member, cat, party, context(w));
    expect(w.game.world.entities.get(cat, C.Position)).toBeUndefined();
    expect(w.spatial.at(w.index(12, 12, 32))).not.toContain(cat);
    party.state = 'retreat';
    w.step(1);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    w.replaceGame(loaded);
    const e = loaded.world.entities;
    const torso = e.get(member, C.Body)!.parts[1]!;
    loaded.world.emit({ type: 'DamageDealt', defenderId: member, attackerId: 0,
      part: 'torso', damageType: 'blunt', amount: torso.maxHp * 2 });
    w.until(() => !e.alive(member), 10);
    const death = w.events('CreatureDied').find((ev) => ev['id'] === member)!;
    const deathTile = death['tile'] as number;
    expect(e.alive(cat)).toBe(true);
    expect(e.get(cat, C.Position)).toEqual(w.map.unpack(deathTile));
    expect(w.spatial.at(deathTile)).toContain(cat);
    expect(e.get(partyId, C.Party)?.loot).not.toContain(cat);
  });

  it('recognizes a valid held animal but still reports a missing or dead carrier', () => {
    const { w, entities, party, member } = manualThief();
    const cat = w.spawnTame('cat', w.index(12, 12, 32));
    pickUpLoot(member, cat, party, context(w));
    expect(checkInvariants(w.game).filter((f) => f.inv === 'creature.no-position')).toEqual([]);
    const carriers = party.animalCarriers;
    delete party.animalCarriers;
    expect(checkInvariants(w.game).filter((f) => f.inv === 'creature.no-position').length).toBeGreaterThan(0);
    if (carriers !== undefined) party.animalCarriers = carriers;
    entities.destroy(member);
    expect(checkInvariants(w.game).filter((f) => f.inv === 'creature.no-position').length).toBeGreaterThan(0);
  });
});
