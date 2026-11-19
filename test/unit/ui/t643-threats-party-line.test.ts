/**
 * T-643: the Threats panel's party line in words. A party in view is named as the log names it,
 * with the members still on the map ("7 of 10" when some are gone) and what it is doing:
 * approach "coming", engage "attacking", loiter "waiting" or "looting" while a member holds loot,
 * retreat "leaving".
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Party } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { PanelContext } from '@ui/panels/context';
import { drawThreatsPanel, ThreatsPanel } from '@ui/panels/threats';
import { TestWorld } from '../../scenarios/test-world';
import { registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function ctxOf(readers: ReaderSet, focused: number[] = []): PanelContext {
  return {
    readers, registry, strings,
    submit: () => {}, focusOn: (tile) => { focused.push(tile); }, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
}

interface Fixture { w: TestWorld; partyId: number; members: number[] }

/** A party of `purpose` with `n` visible members on the map, in `state`. */
function setup(seed: string, purpose: Party['purpose'], n: number, state: string): Fixture {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const partyId = w.game.world.entities.create('party');
  const members: number[] = [];
  for (let k = 0; k < n; k += 1) {
    const id = w.spawnCreature('gloam_warrior', w.index(20 + k, 20, z), 'hostile:gloam');
    w.game.world.entities.add(id, C.Hostile, { partyId, role: 'warriors', behaviorState: 'attack', stealthed: false, spotted: false, breakingDoorId: 0, breakingSince: 0 });
    members.push(id);
  }
  w.game.world.entities.add(partyId, C.Party, {
    civ: purpose === 'bandits' ? 'hillfolk' : 'gloam', purpose, members, leaderId: members[0] ?? 0,
    state, goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: n,
  });
  return { w, partyId, members };
}

function party(f: Fixture): Party {
  return f.w.game.world.entities.get(f.partyId, C.Party)!;
}

/** The panel's lines, drawn 60 wide. */
function draw(f: Fixture, focused: number[] = []): string[] {
  const s = surface(60, 30);
  drawThreatsPanel(s, { col: 0, row: 0, cols: 60, rows: 30 }, new ThreatsPanel(), ctxOf(f.w.readers, focused));
  return s.lines();
}

function activeLine(f: Fixture): string {
  return (draw(f).find((l) => l.includes('Active:')) ?? '').trim();
}

describe('T-643 the Threats panel names a party and says what it is doing', () => {
  it('each state in words: coming, attacking, waiting, leaving', () => {
    const f = setup('t643-states', 'raid', 10, 'approach');
    expect(activeLine(f)).toBe('Active: Gloam raid, 10, coming');
    party(f).state = 'engage';
    expect(activeLine(f)).toBe('Active: Gloam raid, 10, attacking');
    party(f).state = 'loiter';
    expect(activeLine(f)).toBe('Active: Gloam raid, 10, waiting');
    party(f).state = 'retreat';
    expect(activeLine(f)).toBe('Active: Gloam raid, 10, leaving');
  });

  it('a loitering party with loot in a member\'s hands is looting; loot no member holds is not', () => {
    const f = setup('t643-loot', 'bandits', 4, 'loiter');
    const log = f.w.spawnItem('log', 'oak', f.w.index(30, 30, z));
    party(f).loot = [log];
    expect(activeLine(f)).toBe('Active: bandit raid, 4, waiting');
    f.w.game.world.entities.get(log, C.Item)!.carriedBy = f.members[1]!;
    expect(activeLine(f)).toBe('Active: bandit raid, 4, looting');
    // The carrier is gone from the map: nobody in the party holds it now.
    f.w.game.world.entities.destroy(f.members[1]!);
    expect(activeLine(f)).toBe('Active: bandit raid, 3 of 4, waiting');
  });

  it('counts only the members still on the map: dead, fled and caged ones are gone', () => {
    const f = setup('t643-count', 'raid', 10, 'engage');
    f.w.game.world.entities.destroy(f.members[7]!);
    f.w.game.world.entities.destroy(f.members[8]!);
    f.w.game.world.entities.get(f.members[9]!, C.Creature)!.cagedIn = 1;
    expect(activeLine(f)).toBe('Active: Gloam raid, 7 of 10, attacking');
  });

  it('a siege, a thief and the restless dead are named as the log names them', () => {
    const siege = setup('t643-siege', 'siege', 3, 'retreat');
    expect(activeLine(siege)).toBe('Active: Gloam siege, 3, leaving');
    const thief = setup('t643-thief', 'thief', 1, 'approach');
    expect(activeLine(thief)).toBe('Active: thief, 1, coming');
    const restless = setup('t643-restless', 'restless', 2, 'engage');
    expect(activeLine(restless)).toBe('Active: restless dead, 2, attacking');
  });

  it('a click on the line still centres on the leader', () => {
    const f = setup('t643-click', 'raid', 3, 'engage');
    const focused: number[] = [];
    const s = surface(60, 30);
    drawThreatsPanel(s, { col: 0, row: 0, cols: 60, rows: 30 }, new ThreatsPanel(), ctxOf(f.w.readers, focused));
    const row = s.lines().findIndex((l) => l.includes('Active:'));
    s.hitAt(5, row)?.action();
    expect(focused).toEqual([f.w.index(20, 20, z)]);
  });
});
