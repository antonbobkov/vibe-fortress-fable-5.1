/**
 * T-772: the raid warning says what comes. A raid's warning names its size band, a siege's its band
 * and its trollkin; the Threats panel's Coming line gives a siege's band; and a party in view has a
 * row under its Active line that says what it is made of, counting only the members the map shows
 * (18 § Arrival and warning, `ui-screens/panels.md` § Threats).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import { C, type Hostile } from '@core/components';
import type { GameEvent } from '@core/events';
import type { ReaderSet } from '@core/readers';
import type { ComingParty, ThreatsReader } from '@systems/threats';
import { AnnouncementLog } from '@ui/announcements';
import type { PanelContext } from '@ui/panels/context';
import { drawThreatsPanel, ThreatsPanel } from '@ui/panels/threats';
import { comingText } from '@ui/raid-lines';
import { TestWorld } from '../../scenarios/test-world';
import { registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(readers: ReaderSet): PanelContext {
  return {
    readers, registry, strings,
    submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
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

const warning = (kind: string, sizeBand: string): GameEvent => ({ type: 'ThreatWarning', kind, civ: 'gloam', sizeBand, edge: 'n' } as unknown as GameEvent);

describe('T-772 the raid warning names the kind and the band', () => {
  it('a raid of band size: "A band of Gloam raiders has been seen at the northern edge."', () => {
    const w = world('t772-raid');
    const readers = withComing(w.readers, [{ kind: 'raid', civ: 'gloam', sizeBand: 'band', edge: 'n', arrivalTick: w.tick + TICKS_PER_DAY }]);
    expect(announcer(w).announce(warning('raid', 'band'), readers, w.tick)?.line.text)
      .toBe('A band of Gloam raiders has been seen at the northern edge. They will come tomorrow.');
  });

  it('a few raiders "have been seen", a horde "has been seen"', () => {
    const w = world('t772-bands');
    expect(announcer(w).announce(warning('raid', 'few'), w.readers, w.tick)?.line.text)
      .toBe('A few Gloam raiders have been seen at the northern edge. They will come tomorrow.');
    expect(announcer(w).announce(warning('raid', 'horde'), w.readers, w.tick)?.line.text)
      .toBe('A horde of Gloam raiders has been seen at the northern edge. They will come tomorrow.');
  });

  it('a siege of horde size names its band and its trollkin', () => {
    const w = world('t772-siege');
    expect(announcer(w).announce(warning('siege', 'horde'), w.readers, w.tick)?.line.text)
      .toBe('A Gloam siege, a horde, has been seen at the northern edge, with trollkin. They will come tomorrow.');
  });

  it('a warning whose party comes the same day (fog halved the lead) says "today", as the Coming line does', () => {
    const w = world('t772-fog');
    const readers = withComing(w.readers, [{ kind: 'siege', civ: 'gloam', sizeBand: 'band', edge: 'n', arrivalTick: w.tick }]);
    expect(announcer(w).announce(warning('siege', 'band'), readers, w.tick)?.line.text)
      .toBe('A Gloam siege, a band, has been seen at the northern edge, with trollkin. They will come today.');
  });
});

describe('T-772 the Coming line gives a siege its band', () => {
  it('"Coming: a Gloam siege, a horde, from the north, tomorrow."', () => {
    const siege: ComingParty = { kind: 'siege', civ: 'gloam', sizeBand: 'horde', edge: 'n', arrivalTick: TICKS_PER_DAY + 10 };
    expect(comingText(strings, registry, siege, 10)).toBe('Coming: a Gloam siege, a horde, from the north, tomorrow.');
  });
});

describe('T-772 a party in view says what it is made of', () => {
  /** A siege party on the map: each member by species, with its hostile fields. */
  function siege(seed: string, members: readonly (readonly [string, Partial<Hostile>?])[]) {
    const w = world(seed);
    const partyId = w.game.world.entities.create('party');
    const ids = members.map(([species, h], k) => {
      const id = w.spawnCreature(species, w.index(10 + (k % 20), 20 + Math.floor(k / 20), z), 'hostile:gloam');
      w.game.world.entities.add(id, C.Hostile, { partyId, role: 'warriors', behaviorState: 'attack', stealthed: false, spotted: false, breakingDoorId: 0, breakingSince: 0, ...h });
      return id;
    });
    w.game.world.entities.add(partyId, C.Party, {
      civ: 'gloam', purpose: 'siege', members: ids, leaderId: ids[0] ?? 0,
      state: 'engage', goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: ids.length,
    });
    const draw = (cols = 60): string[] => {
      const s = surface(cols, 40);
      drawThreatsPanel(s, { col: 0, row: 0, cols, rows: 40 }, new ThreatsPanel(), ctxOf(w.readers));
      return s.lines().map((l) => l.slice(1).trimEnd());
    };
    return { w, ids, draw };
  }

  const many = (species: string, n: number): [string][] => Array.from({ length: n }, () => [species] as [string]);
  const party = (): (readonly [string, Partial<Hostile>?])[] => [
    ['gloam_captain'], ...many('trollkin', 2), ...many('gloam_archer', 3), ...many('gloam_warrior', 6),
    ['gloam_hexer', { stealthed: true }],
  ];

  it('6 warriors, 3 archers, 2 trollkin and a captain, under the Active line; a hidden hexer is not counted', () => {
    const f = siege('t772-makeup', party());
    const lines = f.draw();
    const row = lines.findIndex((l) => l.startsWith('Active:'));
    expect(lines[row]).toBe('Active: Gloam siege, 12, attacking');
    expect(lines[row + 1]).toBe('  6 warriors, 3 archers, 2 trollkin, a captain');
    expect(lines[row + 2]).toMatch(/^ {2}Morale: /);
  });

  it('a spotted hexer is counted, and a fallen member leaves the row', () => {
    const f = siege('t772-spotted', party());
    const hexer = f.ids[f.ids.length - 1] as number;
    const h = f.w.game.world.entities.get(hexer, C.Hostile) as Hostile;
    h.spotted = true;
    f.w.game.world.entities.destroy(f.ids[0] as number);
    const lines = f.draw();
    const row = lines.findIndex((l) => l.startsWith('Active:'));
    expect(lines[row]).toBe('Active: Gloam siege, 12 of 13, attacking');
    expect(lines[row + 1]).toBe('  6 warriors, 3 archers, 2 trollkin, a hexer');
  });

  it('wraps under itself with a two-cell indent', () => {
    const f = siege('t772-wrap', party());
    const lines = f.draw(26);
    const row = lines.findIndex((l) => l.startsWith('Active:'));
    const at = lines.findIndex((l, k) => k > row && l.startsWith('  6 warriors'));
    expect(lines.slice(at, at + 2)).toEqual(['  6 warriors, 3 archers,', '  2 trollkin, a captain']);
  });
});
