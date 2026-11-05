/**
 * T-504: raid morale and raider nerve (18 § Party AI, Morale). A party's morale starts by purpose,
 * falls with its casualties (scaled by its size, a member's worst counting once), the loss of its
 * captains, traps and its own careless archers, and rises with the foes it fells and the loot it
 * takes. It breaks at MORALE_BREAK, at half the party lost whatever its morale, and, leaderless out
 * of a fight, below MORALE_BREAK_LEADERLESS. A raider whose nerve is above the party's morale runs
 * on its own, drops what it holds, and its flight costs morale again.
 */
import { describe, it, expect } from 'vitest';
import { C, type Party } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import type { EntityId } from '@core/types';
import { arriveParty, spawnHostileMember } from '@systems/threats/parties';
import { MORALE_BREAK_LEADERLESS, MORALE_CAPTAIN_LOST, MORALE_FOE_FELLED, MORALE_LOOT, MORALE_OWN_FIRE, MORALE_START } from '@systems/threats/constants';
import { moraleWord, nerveOf } from '@systems/threats/morale';
import type { ThreatsReader } from '@systems/threats/reader';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

function party(seed: string, kind: 'raid' | 'siege' | 'bandits' | 'ambush' | 'thief' = 'raid', size = 4): { w: TestWorld; partyId: EntityId; P: () => Party } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.build('hearth', w.index(40, 30, Z), 'granite');
  for (let k = 0; k < 8; k += 1) w.spawnItem('log', 'oak', w.index(36 + k, 32, Z));
  w.step(1);
  const reg = w.game.registry;
  const rng = w.game.world.rngFor('t504');
  const { partyId, pendingSpawns } = arriveParty(w.game.world as never, reg, rng, kind, kind === 'bandits' ? 'hillfolk' : 'gloam', size, 'n', w.tick, 15, kind === 'siege' ? 4 : 2, false);
  for (const s of pendingSpawns) spawnHostileMember(w.game.world as never, reg, rng, s.partyId, s.species, s.role, s.tile, s.gearTier, s.isCaptain);
  w.step(1);
  return { w, partyId, P: () => w.game.world.entities.get(partyId, C.Party)! };
}

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

function inland(w: TestWorld, P: () => Party): void {
  const ent = w.game.world.entities;
  w.until(() => P().members.every((m) => (ent.get(m, C.Position)?.y ?? 0) >= 8), 1_000);
}

const role = (w: TestWorld, m: EntityId): string => w.game.world.entities.get(m, C.Hostile)?.role ?? '';

describe('T-504 raid morale and raider nerve', () => {
  it('a party arrives at its purpose\'s morale: a siege steadiest, bandits the least; a thief has none', () => {
    for (const kind of ['raid', 'siege', 'bandits', 'ambush'] as const) {
      const { P } = party(`t504-start-${kind}`, kind);
      expect(P().morale).toBe(MORALE_START[kind]);
    }
    expect(MORALE_START['siege']!).toBeGreaterThan(MORALE_START['raid']!);
    expect(MORALE_START['bandits']!).toBeLessThan(MORALE_START['ambush']!);
    const { w, partyId, P } = party('t504-start-thief', 'thief', 1);
    expect(P().morale).toBeUndefined();
    expect(w.readers.of<ThreatsReader>('18').moraleWord(partyId)).toBe('');
  });

  it('the words: steady, shaken, wavering, breaking', () => {
    expect([90, 70, 69, 50, 49, 30, 29, 0].map(moraleWord)).toEqual(['steady', 'steady', 'shaken', 'shaken', 'wavering', 'wavering', 'breaking', 'breaking']);
  });

  it('a member killed costs its share of a party of ten, scaled by the party\'s size; a fall then a death counts the death once', () => {
    const { w, P } = party('t504-casualty', 'raid', 9);
    inland(w, P);
    P().morale = 90;
    const warrior = P().members.find((m) => role(w, m) === 'warriors')!;
    const body = w.game.world.entities.get(warrior, C.Body)!;
    w.game.world.entities.add(warrior, C.Body, { ...body, conscious: false });
    w.game.world.emit({ type: 'CreatureUnconscious', id: warrior });
    w.step(1);
    expect(P().morale).toBe(90 - 8);
    w.game.world.emit({ type: 'CreatureDied', id: warrior, cause: 'killed', killerId: 0, tile: 0, species: w.game.world.entities.get(warrior, C.Creature)!.species, name: '', faction: 'hostile:gloam', ageTicks: 0, wornItems: [] });
    w.step(1);
    expect(P().morale).toBe(90 - 10);
  });

  it('a caged captain is a large drop, and a leaderless raid out of a fight goes home before it loots', () => {
    const { w, P } = party('t504-captain', 'raid', 4);
    inland(w, P);
    expect(P().state).not.toBe('engage');
    cage(w, P().captainIds![0]!);
    w.step(60);
    // 90 − the caged captain's share of five (20) − the captain's loss (30) = 40 < 50.
    expect(P().morale).toBe(90 - 20 - MORALE_CAPTAIN_LOST);
    expect(P().morale!).toBeLessThan(MORALE_BREAK_LEADERLESS);
    expect(P().state).toBe('retreat');
    expect(P().loot).toEqual([]);
  });

  it('half the party lost breaks it whatever its morale: the floor of the scale', () => {
    const { w, P } = party('t504-floor', 'raid', 5);
    inland(w, P);
    const warriors = P().members.filter((m) => role(w, m) !== 'captain').slice(0, 3);
    for (const m of warriors) cage(w, m);
    P().morale = 100;
    w.step(60);
    expect(P().state).toBe('retreat');
  });

  it('a raider whose nerve is above the party\'s morale runs on its own, drops its loot, and costs morale again; the captain holds', () => {
    const { w, partyId, P } = party('t504-nerve', 'raid', 6);
    inland(w, P);
    const ent = w.game.world.entities;
    const nerves = P().members.map((m) => ({ m, nerve: nerveOf(m, ent.get(m, C.Hostile)!, { world: w.game.world, registry: w.game.registry } as never) }));
    const captain = P().captainIds![0]!;
    expect(nerves.find((n) => n.m === captain)!.nerve).toBeLessThan(0);
    const coward = nerves.filter((n) => n.m !== captain).sort((a, b) => b.nerve - a.nerve || a.m - b.m)[0]!;
    // Hand the coward a log, then set morale just below its nerve, above every other raider's.
    const log = w.spawnItem('log', 'oak', w.index(40, 20, Z));
    w.game.world.services.items!.attachToCarrier(log, coward.m);
    P().loot.push(log);
    const next = nerves.filter((n) => n.m !== coward.m && n.m !== captain).reduce((a, n) => Math.max(a, n.nerve), -1);
    expect(next, 'this seed has one raider to single out').toBeLessThan(coward.nerve - 1);
    P().morale = coward.nerve - 1;
    const before = P().morale!;
    w.step(1);
    const fled = w.events('HostileFled').filter((e) => e['id'] === coward.m);
    expect(fled).toHaveLength(1);
    expect(fled[0]!['nerve']).toBe(true);
    // The coward runs first; its flight may put the next below its nerve (a rout cascades).
    expect(w.events('HostileFled').filter((e) => e['nerve'] === true)[0]?.['id']).toBe(coward.m);
    expect(ent.get(coward.m, C.Hostile)?.nerveLost).toBe(true);
    expect(P().loot).not.toContain(log);
    expect(ent.get(log, C.Item)?.carriedBy).toBe(0);
    // Its flight costs at least a fled member's share of seven.
    expect(P().morale!).toBeLessThanOrEqual(before - Math.round(50 / 7));
    w.until(() => !ent.alive(coward.m), 2 * TICKS_PER_DAY);
    expect(ent.alive(coward.m)).toBe(false);
    expect(w.events('HostileFled').some((e) => e['id'] === captain && e['nerve'] === true)).toBe(false);
    void partyId;
  });

  it('nerve comes from the species and the entity id: no draw, the same after a save', () => {
    const { w, P } = party('t504-nerve-save', 'raid', 6);
    const ctx = (): never => ({ world: w.game.world, registry: w.game.registry }) as never;
    const before = P().members.map((m) => nerveOf(m, w.game.world.entities.get(m, C.Hostile)!, ctx()));
    const rngBefore = JSON.stringify(w.game.world.rngFor('18'));
    P().members.forEach((m) => nerveOf(m, w.game.world.entities.get(m, C.Hostile)!, ctx()));
    expect(JSON.stringify(w.game.world.rngFor('18'))).toBe(rngBefore);
    w.replaceGame(roundTrip(w.game).game);
    expect(P().members.map((m) => nerveOf(m, w.game.world.entities.get(m, C.Hostile)!, ctx()))).toEqual(before);
    // Warriors (flee at 40% blood) sit between 20 and 39; archers (50%) between 30 and 49.
    for (const m of P().members) {
      const n = nerveOf(m, w.game.world.entities.get(m, C.Hostile)!, ctx());
      if (role(w, m) === 'warriors') expect(n >= 20 && n < 40).toBe(true);
      if (role(w, m) === 'archers') expect(n >= 30 && n < 50).toBe(true);
    }
  });

  it('a hit from its own archer shakes the party; a foe felled and loot taken steady it', () => {
    const { w, P } = party('t504-shocks', 'raid', 6);
    inland(w, P);
    const [a, b] = P().members.filter((m) => role(w, m) !== 'captain');
    P().morale = 60;
    w.game.world.emit({ type: 'AttackResolved', attackerId: a!, defenderId: b!, part: 'torso', damageType: 'pierce', amount: 3, outcome: 'hit' });
    w.step(1);
    expect(P().morale).toBe(60 - MORALE_OWN_FIRE);
    const dwarf = w.spawnDwarf({ at: w.index(40, 40, Z) });
    w.game.world.emit({ type: 'CreatureDied', id: dwarf, cause: 'killed', killerId: a!, tile: 0, species: w.game.world.entities.get(dwarf, C.Creature)!.species, name: '', faction: 'fortress', ageTicks: 0, wornItems: [] });
    w.step(1);
    expect(P().morale).toBe(60 - MORALE_OWN_FIRE + MORALE_FOE_FELLED);
    P().morale = 60;
    w.until(() => P().loot.length > 0, 4 * TICKS_PER_DAY);
    expect(P().morale!).toBeGreaterThanOrEqual(60 + MORALE_LOOT);
  });

  it('a siege is steadier: losing its captains shakes it, and it breaks when more losses follow', () => {
    const { w, P } = party('t504-siege', 'siege', 20);
    w.until(() => (P().captainIds?.length ?? 0) >= 2, 200);
    inland(w, P);
    for (const c of P().captainIds!) cage(w, c);
    w.step(60);
    expect(P().state).not.toBe('retreat');
    expect(moraleWord(P().morale!)).toBe('shaken');
    const rest = P().members.filter((m) => role(w, m) !== 'captain').slice(0, 4);
    for (const m of rest) cage(w, m);
    w.step(60);
    expect(P().state).toBe('retreat');
  });

  it('the morale and a lost nerve survive a save', () => {
    const { w, P } = party('t504-save', 'raid', 6);
    inland(w, P);
    const m = P().members.find((x) => role(w, x) === 'warriors')!;
    P().morale = 77;
    w.game.world.entities.get(m, C.Hostile)!.nerveLost = true;
    w.replaceGame(roundTrip(w.game).game);
    expect(P().morale).toBe(77);
    expect(w.game.world.entities.get(m, C.Hostile)?.nerveLost).toBe(true);
  });
});
