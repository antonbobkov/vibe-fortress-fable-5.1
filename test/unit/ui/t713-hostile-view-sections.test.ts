/**
 * T-713: a hostile's view in Look draws 18's `creature › hostile` sections (`ui-screens/fortress-screen.md`
 * § Inspection panel): its party in the Threats panel's words with its morale, its role, the leader it
 * follows (a link) and its state, a dim label and a value a row, within the 36-column sidebar under
 * T-703's rule (a fact never cut). A hostile the map hides is never shown, counted or linked.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Hostile, type Party } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, keymap, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const COLS = 80;
const ROWS = 42;
const LAYOUT = computeLayout(COLS, ROWS, true);
const SIDE = LAYOUT.sidebar?.col ?? 0;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 10 * TICKS_PER_DAY });
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (cmd) => { w.game.world.applyCommand(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => LAYOUT, precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 0,
  };
  return { w, f: new FortressScreen(host, keymap, strings) };
}

interface Member { species: string; role: string; hostile?: Partial<Hostile> }

/** A party of `purpose` on the map, its first member leading, in `state`; its members' ids. */
function party(w: TestWorld, purpose: Party['purpose'], members: readonly Member[], state: string, over: Partial<Party> = {}): { partyId: EntityId; ids: EntityId[] } {
  const partyId = w.game.world.entities.create('party');
  const ids = members.map((m, k) => {
    const id = w.spawnCreature(m.species, w.index(20 + k, 20, z), purpose === 'bandits' ? 'hostile:hillfolk' : 'hostile:gloam');
    w.game.world.entities.add(id, C.Hostile, {
      partyId, role: m.role, behaviorState: 'attack', stealthed: false, spotted: false, breakingDoorId: 0, breakingSince: 0, ...m.hostile,
    });
    return id;
  });
  w.game.world.entities.add(partyId, C.Party, {
    civ: purpose === 'bandits' ? 'hillfolk' : 'gloam', purpose, members: ids, leaderId: ids[0] ?? 0,
    state, goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: ids.length, ...over,
  });
  return { partyId, ids };
}

/** The screen drawn with the creature's view open, its sidebar as text, and every cut T-703 forbids. */
function view(f: FortressScreen, id: EntityId) {
  f.inspectCreature(id);
  const s = surface(COLS, ROWS);
  const cuts: string[] = [];
  const text = s.text.bind(s);
  s.text = (col, row, value, fg, bg, width = Infinity) => {
    const kept = Array.from(value).slice(0, Math.min(width, COLS - col)).join('');
    if (col >= SIDE && Array.from(value).slice(kept.length).join('').trim() !== '' && !kept.endsWith('»')) cuts.push(value.trim());
    return text(col, row, value, fg, bg, width);
  };
  f.draw(s);
  const rows = s.lines().map((line) => Array.from(line).slice(SIDE + 2).join('').trimEnd());
  for (const row of rows.slice(0, LAYOUT.sidebar?.rows ?? ROWS)) if (row.includes('»')) cuts.push(row);
  return { s, rows, cuts };
}

/** The value of a section's row: the text after its label, with the rows it wraps onto. */
function field(rows: readonly string[], name: string): string | undefined {
  const at = rows.findIndex((row) => row.startsWith(`${name} `));
  if (at < 0) return undefined;
  const parts = [(rows[at] as string).slice(10)];
  for (let k = at + 1; k < rows.length && /^ {10}\S/.test(rows[k] as string); k += 1) parts.push((rows[k] as string).trim());
  return parts.join(' ');
}

const RAID: Member[] = [
  { species: 'gloam_captain', role: 'captain' },
  { species: 'gloam_archer', role: 'archers' },
  { species: 'gloam_warrior', role: 'warriors' },
  { species: 'gloam_warrior', role: 'warriors' },
];

describe('T-713 a hostile\'s view: party, role, state', () => {
  it('a raider names its party in the Threats panel\'s words, its morale, its role and its leader, under the rule', () => {
    const { w, f } = setup('t713-raid');
    const { ids } = party(w, 'raid', RAID, 'engage');
    w.game.world.entities.destroy(ids[3] as EntityId);
    const { s, rows, cuts } = view(f, ids[2] as EntityId);
    const rule = rows.findIndex((row) => row.startsWith('─'));
    expect(rows.slice(rule + 1, rule + 6)).toEqual([
      'Party     Gloam raid, 3 of 4,',
      '          attacking',
      'Morale    steady',
      'Role      warrior',
      'Leader    gloam captain',
    ]);
    expect(field(rows, 'State')).toBe('hostile');
    // The leader is a link, in the value colour; the labels are dim.
    expect(fgOfText(s, rule + 5, 'gloam captain')).toBe(hexOf(theme.value));
    expect(fgOfText(s, rule + 1, 'Party')).toBe(hexOf(theme.dim));
    // The activity line stays; no animal section, no dwarf's mood.
    expect(rows).toContain('Activity: Attacking');
    for (const gone of ['Species', 'Hunted', 'Training', 'Mood:']) expect(rows.some((row) => row.startsWith(gone)), gone).toBe(false);
    expect(cuts).toEqual([]);
  });

  it('the captain leads the party: no Leader row; its state says it breaks a door and carries loot', () => {
    const { w, f } = setup('t713-captain');
    const { partyId, ids } = party(w, 'raid', RAID, 'loiter');
    const captain = ids[0] as EntityId;
    const door = w.game.world.entities.create('building');
    w.game.world.entities.get(captain, C.Hostile)!.breakingDoorId = door;
    const log = w.spawnItem('log', 'oak', w.index(30, 30, z));
    w.game.world.entities.get(log, C.Item)!.carriedBy = captain;
    w.game.world.entities.get(partyId, C.Party)!.loot = [log];
    const { rows, cuts } = view(f, captain);
    expect(field(rows, 'Party')).toBe('Gloam raid, 4, looting');
    expect(field(rows, 'Role')).toBe('captain, leads the party');
    expect(rows.some((row) => row.startsWith('Leader '))).toBe(false);
    expect(field(rows, 'State')).toBe('hostile, breaking a door, carrying loot');
    expect(cuts).toEqual([]);
  });

  it('a spotted thief: its party, no morale (a thief has none), its role', () => {
    const { w, f } = setup('t713-thief');
    const { ids } = party(w, 'thief', [{ species: 'gloam_snatcher', role: 'thief', hostile: { stealthed: false, spotted: true, behaviorState: 'approach' } }], 'approach');
    const { rows, cuts } = view(f, ids[0] as EntityId);
    expect(field(rows, 'Party')).toBe('thief, 1, coming');
    expect(field(rows, 'Morale')).toBeUndefined();
    expect(field(rows, 'Role')).toBe('thief, leads the party');
    expect(field(rows, 'State')).toBe('hostile');
    expect(cuts).toEqual([]);
  });

  it('a siege\'s trollkin: the party wraps whole under its value, the morale in words, and one that lost its nerve says so', () => {
    const { w, f } = setup('t713-siege');
    const members: Member[] = [
      { species: 'gloam_captain', role: 'captain' },
      ...Array.from({ length: 21 }, (): Member => ({ species: 'trollkin', role: 'warriors' })),
    ];
    const { ids } = party(w, 'siege', members, 'engage', { morale: 40 });
    for (const gone of ids.slice(18)) w.game.world.entities.destroy(gone);
    const troll = ids[5] as EntityId;
    w.game.world.entities.get(troll, C.Hostile)!.nerveLost = true;
    const { rows, cuts } = view(f, troll);
    expect(field(rows, 'Party')).toBe('Gloam siege, 18 of 22, attacking');
    expect(field(rows, 'Morale')).toBe('wavering');
    expect(field(rows, 'Role')).toBe('warrior');
    expect(field(rows, 'Leader')).toBe('gloam captain');
    expect(field(rows, 'State')).toBe('hostile, lost its nerve');
    expect(cuts).toEqual([]);
  });

  it('a sprung ambusher: its party and its role; a leaving party shows no morale', () => {
    const { w, f } = setup('t713-ambush');
    const { partyId, ids } = party(w, 'ambush', [
      { species: 'gloam_warrior', role: 'warriors', hostile: { spotted: true } },
      { species: 'gloam_archer', role: 'archers', hostile: { spotted: true } },
    ], 'engage', { ambushSprung: true });
    let { rows } = view(f, ids[1] as EntityId);
    expect(field(rows, 'Party')).toBe('ambush, 2, attacking');
    expect(field(rows, 'Morale')).toBe('steady');
    expect(field(rows, 'Role')).toBe('archer');
    expect(field(rows, 'Leader')).toBe('gloam warrior');
    w.game.world.entities.get(partyId, C.Party)!.state = 'retreat';
    ({ rows } = view(f, ids[1] as EntityId));
    expect(field(rows, 'Party')).toBe('ambush, 2, leaving');
    expect(field(rows, 'Morale')).toBeUndefined();
  });

  it('a cavern monster has no party: its role and state only', () => {
    const { w, f } = setup('t713-monster');
    const crab = w.spawnCreature('gloam_warrior', w.index(20, 20, z), 'hostile:cavern');
    w.game.world.entities.add(crab, C.Hostile, { partyId: 0, role: 'cavern_monster', behaviorState: 'wander', stealthed: false, spotted: false, breakingDoorId: 0, breakingSince: 0 });
    const { rows } = view(f, crab);
    expect(field(rows, 'Party')).toBeUndefined();
    expect(field(rows, 'Role')).toBe('cavern monster');
    expect(field(rows, 'State')).toBe('hostile');
  });
});

describe('T-713 a hidden hostile is not given away', () => {
  it('a stealthed thief\'s view is out of sight, with none of its sections', () => {
    const { w, f } = setup('t713-hidden');
    const { ids } = party(w, 'thief', [{ species: 'gloam_snatcher', role: 'thief', hostile: { stealthed: true, behaviorState: 'approach' } }], 'approach');
    const { rows } = view(f, ids[0] as EntityId);
    expect(rows).toContain('Out of sight.');
    for (const gone of ['Party', 'Role', 'State', 'Leader', 'Activity:']) expect(rows.some((row) => row.startsWith(gone)), gone).toBe(false);
  });

  it('a spotted thief whose hidden partner leads: the partner is neither counted nor named', () => {
    const { w, f } = setup('t713-pair');
    const { ids } = party(w, 'thief', [
      { species: 'gloam_snatcher', role: 'thief', hostile: { stealthed: true, behaviorState: 'approach' } },
      { species: 'gloam_snatcher', role: 'thief', hostile: { stealthed: false, spotted: true, behaviorState: 'approach' } },
    ], 'approach');
    const { rows } = view(f, ids[1] as EntityId);
    expect(field(rows, 'Party')).toBe('thief, 1, coming');
    expect(field(rows, 'Role')).toBe('thief');
    expect(rows.some((row) => row.startsWith('Leader '))).toBe(false);
  });
});
