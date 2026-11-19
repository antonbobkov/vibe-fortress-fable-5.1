/**
 * T-638: a raid read from its warning to its end. The Threats panel lists a warned party until it
 * arrives and names the hostiles in view; Military names a squad's kill or follow order; the end
 * of a raid says its outcome with the party's counts; a theft names what was taken; and when the
 * last raid is gone under a raised alert, a line says the alert can come down.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, createEntityStore, type Party } from '@core/components';
import type { GameEvent } from '@core/events';
import type { ReaderSet } from '@core/readers';
import { Registrations, type TickContext } from '@core/system';
import { TICKS_PER_DAY } from '@core/constants';
import { makeThreatsReader, type ComingParty, type PendingArrivalState, type ThreatsReader } from '@systems/threats';
import { memberThink, pickUpLoot } from '@systems/threats/ai';
import { spawnHostileMember } from '@systems/threats/parties';
import { AnnouncementLog } from '@ui/announcements';
import type { PanelContext } from '@ui/panels/context';
import { drawMilitaryPanel, MilitaryPanel } from '@ui/panels/military';
import { drawThreatsPanel, ThreatsPanel } from '@ui/panels/threats';
import { comingText } from '@ui/raid-lines';
import { TestWorld } from '../../scenarios/test-world';
import { registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(readers: ReaderSet, focused: number[] = []): PanelContext {
  return {
    readers, registry, strings,
    submit: () => {}, focusOn: (tile) => { focused.push(tile); }, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

/** The world's readers with the threats reader's `coming()` answering `coming`. */
function withComing(readers: ReaderSet, coming: readonly ComingParty[]): ReaderSet {
  return new Proxy(readers, {
    get(target, key) {
      if (key === 'of') return (id: string) => (id === '18' ? { ...target.of<ThreatsReader>('18'), coming: () => coming } : target.of(id));
      const value = Reflect.get(target, key, target) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}

/** A threat party of `purpose` whose members are the given creature ids. */
function party(w: TestWorld, purpose: Party['purpose'], members: number[], extra: Partial<Party> = {}): number {
  const id = w.game.world.entities.create('party');
  w.game.world.entities.add(id, C.Party, {
    civ: purpose === 'bandits' ? 'hillfolk' : 'gloam', purpose, members, leaderId: members[0] ?? 0,
    state: 'gone', goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: members.length, ...extra,
  });
  return id;
}

/** `n` member ids no longer on the map (dead or gone). */
function goneIds(w: TestWorld, n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k += 1) {
    const id = w.spawnCreature('gloam_warrior', w.index(5 + k, 5, z), 'hostile:gloam');
    w.game.world.entities.destroy(id);
    out.push(id);
  }
  return out;
}

const ended = (partyId: number, outcome: string): GameEvent => ({ type: 'RaidEnded', partyId, outcome } as unknown as GameEvent);

describe('T-638 the Threats panel lists a warned party until it arrives', () => {
  it('the reader lists each warned arrival, soonest first, by its size band; an unwarned one is not listed', () => {
    const arrivals: PendingArrivalState[] = [
      { kind: 'siege', civ: 'gloam', size: 30, arrivalTick: 5000, edge: 'e', warningEmitted: true },
      { kind: 'bandits', civ: 'hillfolk', size: 4, arrivalTick: 100, edge: 'w', warningEmitted: false },
      { kind: 'raid', civ: 'gloam', size: 10, arrivalTick: 2000, edge: 'n', warningEmitted: true },
    ];
    const reader = makeThreatsReader(createEntityStore(), () => 0, () => new Map(), () => 0, () => 0, undefined, undefined, () => arrivals);
    expect(reader.coming()).toEqual([
      { kind: 'raid', civ: 'gloam', sizeBand: 'a band', edge: 'n', arrivalTick: 2000 },
      { kind: 'siege', civ: 'gloam', sizeBand: 'a horde', edge: 'e', arrivalTick: 5000 },
    ]);
  });

  it('"Coming: a horde of Gloam from the north, tomorrow." and a siege in days', () => {
    const raid: ComingParty = { kind: 'raid', civ: 'gloam', sizeBand: 'a horde', edge: 'n', arrivalTick: TICKS_PER_DAY + 10 };
    expect(comingText(strings, registry, raid, 10)).toBe('Coming: a horde of Gloam from the north, tomorrow.');
    expect(comingText(strings, registry, { ...raid, sizeBand: 'a few', arrivalTick: 20 }, 10)).toBe('Coming: a few Gloam from the north, today.');
    expect(comingText(strings, registry, { ...raid, kind: 'siege', edge: 'e', arrivalTick: 2 * TICKS_PER_DAY }, 0)).toBe('Coming: a Gloam siege from the east, in 2 days.');
  });

  it('the panel shows the coming party under the Active line', () => {
    const w = world('t638-coming');
    const readers = withComing(w.readers, [{ kind: 'raid', civ: 'gloam', sizeBand: 'a band', edge: 'n', arrivalTick: w.tick + TICKS_PER_DAY }]);
    const s = surface(60, 30);
    drawThreatsPanel(s, { col: 0, row: 0, cols: 60, rows: 30 }, new ThreatsPanel(), ctxOf(readers));
    const text = s.lines().join('\n');
    expect(text).toContain('Active: none');
    expect(text).toContain('Coming: a band of Gloam from the north, tomorrow.');
  });
});

describe('T-638 the Active line names the hostiles in view, and a click centres on the first', () => {
  it('"Active: 2 gloam warriors and a cave crab"', () => {
    const w = world('t638-active');
    const first = w.index(20, 20, z);
    for (const [species, at] of [['gloam_warrior', first], ['cave_crab', w.index(22, 20, z)], ['gloam_warrior', w.index(24, 20, z)]] as const) {
      w.discover(at);
      const id = w.spawnCreature(species, at, species === 'cave_crab' ? 'deep' : 'hostile:gloam');
      w.game.world.entities.add(id, C.Hostile, { partyId: 0, role: 'warrior', behaviorState: 'attack', stealthed: false, spotted: false, breakingDoorId: 0, breakingSince: 0 });
    }
    const focused: number[] = [];
    const s = surface(60, 30);
    drawThreatsPanel(s, { col: 0, row: 0, cols: 60, rows: 30 }, new ThreatsPanel(), ctxOf(w.readers, focused));
    const lines = s.lines();
    const row = lines.findIndex((l) => l.includes('Active:'));
    expect(lines[row]).toContain('Active: 2 gloam warriors and a cave crab');
    s.hitAt(5, row)?.action();
    expect(focused).toEqual([first]);
  });
});

describe('T-638 Military names the squad\'s orders', () => {
  it('a kill order reads "Orders kill: a gloam captain", a follow order adds the dwarf, and [q] cancels', () => {
    const w = world('t638-orders');
    w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    w.step(1);
    const squadId = w.readers.of<{ squads(): { id: number }[] }>('16').squads()[0]?.id ?? 0;
    const captain = w.spawnCreature('gloam_captain', w.index(20, 20, z), 'hostile:gloam');
    const draw = (): string[] => {
      const s = surface(40, 60);
      drawMilitaryPanel(s, { col: 0, row: 0, cols: 40, rows: 60 }, new MilitaryPanel(), ctxOf(w.readers));
      return s.lines();
    };
    expect(draw().join('\n')).toContain('Orders [S-k] kill [S-f] follow');
    w.submit({ type: 'SquadOrder', squadId, order: { kind: 'kill', targetId: captain } });
    w.step(1);
    let lines = draw();
    expect(lines.join('\n')).toContain('Orders kill: a gloam captain');
    expect(lines.join('\n')).toContain('[S-k] kill [S-f] follow');
    expect(lines.join('\n')).toContain('[q] cancel orders');
    const liv = w.spawnDwarf({ at: w.index(21, 20, z), name: 'Liv Hammerfall' });
    w.submit({ type: 'SquadOrder', squadId, order: { kind: 'follow', dwarfId: liv } });
    w.step(1);
    lines = draw();
    expect(lines.join(' ').replace(/\s+/g, ' ')).toContain('Orders kill: a gloam captain; follow: Liv H.');
    w.submit({ type: 'SquadOrder', squadId, order: { kind: 'cancel' } });
    w.step(1);
    expect(draw().join('\n')).not.toContain('Orders kill');
  });
});

describe('T-638 the end of a raid says what happened', () => {
  it('looted: "The Gloam raid is over: 6 raiders fled with 14 goods, 3 fell.", an alert', () => {
    const w = world('t638-looted');
    const id = party(w, 'raid', goneIds(w, 9), { despawnedCount: 6, escapedLootCount: 14 });
    const done = announcer(w).announce(ended(id, 'looted'), w.readers, 1);
    expect(done?.line.text).toBe('The Gloam raid is over: 6 raiders fled with 14 goods, 3 fell.');
    expect(done?.severity).toBe('alert');
  });

  it('repelled with a raider in a cage: "… 4 raiders fled, 4 fell, 1 caged."', () => {
    const w = world('t638-repelled');
    const caged = w.spawnCreature('gloam_warrior', w.index(30, 30, z), 'hostile:gloam');
    w.game.world.entities.get(caged, C.Creature)!.cagedIn = 999;
    const id = party(w, 'raid', [...goneIds(w, 8), caged], { despawnedCount: 4 });
    const done = announcer(w).announce(ended(id, 'repelled'), w.readers, 1);
    expect(done?.line.text).toBe('The Gloam raid was driven off: 4 raiders fled, 4 fell, 1 caged.');
    expect(done?.severity).toBe('note');
  });

  it('wiped, withdrew, a thief and the restless dead', () => {
    const w = world('t638-other');
    const log = announcer(w);
    expect(log.announce(ended(party(w, 'siege', goneIds(w, 22)), 'wiped'), w.readers, 1)?.line.text).toBe('The Gloam siege was destroyed: all 22 fell.');
    expect(log.announce(ended(party(w, 'bandits', goneIds(w, 5), { despawnedCount: 5 }), 'withdrew'), w.readers, 2)?.line.text)
      .toBe('The bandit raid has withdrawn: 5 raiders left empty-handed.');
    expect(log.announce(ended(party(w, 'thief', goneIds(w, 1), { despawnedCount: 1 }), 'withdrew'), w.readers, 3)?.line.text).toBe('The thief has gone empty-handed.');
    // A thief that got away with something has only its theft line.
    expect(log.announce(ended(party(w, 'thief', goneIds(w, 1), { despawnedCount: 1, escapedLootCount: 1 }), 'looted'), w.readers, 4)).toBeNull();
    expect(log.announce(ended(party(w, 'restless', goneIds(w, 3)), 'wiped'), w.readers, 5)?.line.text).toBe('The restless dead have gone back to their rest.');
  });
});

describe('T-638 a theft names what was taken', () => {
  it('ThiefEscaped carries the item by content id, and its line names it', () => {
    const w = world('t638-thief');
    const ctx: TickContext = { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
      rng: w.game.world.rngFor('18'), register: new Registrations(),
      jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
      emit: (event) => w.game.world.emit(event) };
    const partyId = w.game.world.entities.create('party');
    w.game.world.entities.add(partyId, C.Party, { civ: 'gloam', purpose: 'thief', members: [], leaderId: 0,
      state: 'approach', goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1 });
    const member = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'), partyId, 'gloam_snatcher', 'thief', w.index(12, 12, z), 1, false);
    const p = w.game.world.entities.get(partyId, C.Party)!;
    const sword = w.spawnItem('short_sword', 'iron', w.index(12, 12, z));
    pickUpLoot(member, sword, p, ctx);
    p.state = 'retreat';
    w.game.world.entities.add(member, C.Position, w.map.unpack(w.index(12, 0, z)));
    memberThink(member, w.game.world.entities.get(member, C.Hostile)!, p, ctx);
    w.step(1);
    const escaped = w.events('ThiefEscaped');
    expect(escaped).toHaveLength(1);
    expect(escaped[0]).toMatchObject({ partyId, itemId: sword, itemType: 'short_sword', material: 'iron', count: 1 });
    expect(w.game.world.entities.alive(sword)).toBe(false);
    const done = announcer(w).announce(escaped[0] as GameEvent, w.readers, w.tick);
    expect(done?.line.text).toBe('A thief has escaped with an iron short sword!');
    expect(done?.severity).toBe('alert');
  });

  it('a raid\'s escapes are one line, counted and listed by kind', () => {
    const w = world('t638-raid-loot');
    const id = party(w, 'raid', goneIds(w, 4), { state: 'retreat' });
    const log = announcer(w);
    const escape = (itemType: string, material: string): GameEvent => ({ type: 'ThiefEscaped', id: 1, partyId: id, itemId: 2, itemType, material, count: 1 } as unknown as GameEvent);
    log.announce(escape('bar', 'iron'), w.readers, 10);
    expect(log.lines[log.lines.length - 1]?.text).toBe('Raiders have escaped with an iron bar!');
    for (let k = 0; k < 5; k += 1) log.announce(escape('bar', 'iron'), w.readers, 11 + k);
    for (let k = 0; k < 7; k += 1) log.announce(escape('log', 'oak'), w.readers, 20 + k);
    log.announce(escape('short_sword', 'iron'), w.readers, 30);
    const theft = log.lines.filter((l) => l.text.startsWith('Raiders'));
    expect(theft).toHaveLength(1);
    expect(theft[0]?.text).toBe('Raiders have escaped with 14 goods: iron bars ×6, oak logs ×7 and an iron short sword!');
  });

  it('a stack is named with its count', () => {
    const w = world('t638-stack');
    const id = party(w, 'thief', goneIds(w, 1), { state: 'retreat' });
    const done = announcer(w).announce({ type: 'ThiefEscaped', id: 1, partyId: id, itemId: 2, itemType: 'bar', material: 'iron', count: 6 } as unknown as GameEvent, w.readers, 1);
    expect(done?.line.text).toBe('A thief has escaped with 6 iron bars!');
  });
});

describe('T-638 when the last raid is gone under a raised alert, a line says the alert can come down', () => {
  it('under the Hearth alert: "The raid is gone: [m] [1] lowers the alert.", an alert; not while another raid is on the map; not under Calm', () => {
    const w = world('t638-gone');
    const log = announcer(w);
    const first = party(w, 'raid', goneIds(w, 3), { despawnedCount: 3 });
    // Calm: no line.
    log.announce(ended(first, 'withdrew'), w.readers, 1);
    expect(log.lines.some((l) => l.text.startsWith('The raid is gone'))).toBe(false);
    w.submit({ type: 'SetAlert', level: 'hearth' });
    w.step(1);
    // Another raid still on the map: no line.
    const other = w.spawnCreature('gloam_warrior', w.index(30, 30, z), 'hostile:gloam');
    const second = party(w, 'raid', [other], { state: 'engage' });
    log.announce(ended(first, 'withdrew'), w.readers, 2);
    expect(log.lines.some((l) => l.text.startsWith('The raid is gone'))).toBe(false);
    w.game.world.entities.get(second, C.Party)!.state = 'gone';
    const done = log.announce(ended(second, 'repelled'), w.readers, 3);
    expect(done?.line.text).toBe('The raid is gone: [m] [1] lowers the alert.');
    expect(done?.severity).toBe('alert');
    // A thief's end never says it.
    const thief = party(w, 'thief', goneIds(w, 1), { despawnedCount: 1 });
    const before = log.lines.filter((l) => l.text.startsWith('The raid is gone')).length;
    log.announce(ended(thief, 'withdrew'), w.readers, 4 * TICKS_PER_DAY);
    expect(log.lines.filter((l) => l.text.startsWith('The raid is gone')).length).toBe(before);
  });
});
