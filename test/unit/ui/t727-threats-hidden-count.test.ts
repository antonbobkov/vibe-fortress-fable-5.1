/**
 * T-727: the Threats panel's party line counts only the members the map shows, as Look's `Party` row
 * does (18 § Stealth, `ui-screens/panels.md` § Threats): a thief pair with one spotted reads
 * "thief, 1, coming", and a click on the line never centres on a hidden member.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Hostile, type Party } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { PanelContext } from '@ui/panels/context';
import { drawThreatsPanel, ThreatsPanel } from '@ui/panels/threats';
import { TestWorld } from '../../scenarios/test-world';
import { registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function ctxOf(readers: ReaderSet, focused: number[]): PanelContext {
  return {
    readers, registry, strings,
    submit: () => {}, focusOn: (tile) => { focused.push(tile); }, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
}

/** A party of `purpose` on the map, its first member leading, each member's hostile fields as given. */
function setup(seed: string, purpose: Party['purpose'], members: readonly Partial<Hostile>[], over: Partial<Party> = {}) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const partyId = w.game.world.entities.create('party');
  const ids = members.map((h, k) => {
    const id = w.spawnCreature(purpose === 'thief' ? 'gloam_snatcher' : 'gloam_warrior', w.index(20 + k, 20, z), 'hostile:gloam');
    w.game.world.entities.add(id, C.Hostile, { partyId, role: purpose === 'thief' ? 'thief' : 'warriors', behaviorState: 'attack', stealthed: false, spotted: false, breakingDoorId: 0, breakingSince: 0, ...h });
    return id;
  });
  w.game.world.entities.add(partyId, C.Party, {
    civ: 'gloam', purpose, members: ids, leaderId: ids[0] ?? 0,
    state: 'approach', goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: ids.length, ...over,
  });
  const draw = () => {
    const focused: number[] = [];
    const s = surface(60, 30);
    drawThreatsPanel(s, { col: 0, row: 0, cols: 60, rows: 30 }, new ThreatsPanel(), ctxOf(w.readers, focused));
    const row = s.lines().findIndex((l) => l.includes('Active:'));
    s.hitAt(5, row)?.action();
    return { line: (s.lines()[row] ?? '').trim(), focused };
  };
  return { w, ids, draw };
}

describe('T-727 the Threats panel counts only the members the map shows', () => {
  it('a thief pair with one spotted reads 1, and the click goes to the spotted one, not the hidden leader', () => {
    const f = setup('t727-pair', 'thief', [{ stealthed: true }, { stealthed: true, spotted: true }]);
    const { line, focused } = f.draw();
    expect(line).toBe('Active: thief, 1, coming');
    expect(focused).toEqual([f.w.index(21, 20, z)]);
  });

  it('both spotted, the pair reads 2 and the click goes to the leader', () => {
    const f = setup('t727-both', 'thief', [{ stealthed: true, spotted: true }, { stealthed: true, spotted: true }]);
    const { line, focused } = f.draw();
    expect(line).toBe('Active: thief, 2, coming');
    expect(focused).toEqual([f.w.index(20, 20, z)]);
  });

  it('a hidden member gone from the map is in neither number', () => {
    const f = setup('t727-gone', 'thief', [{ stealthed: true, spotted: true }, { stealthed: true, spotted: true }, { stealthed: true }]);
    f.w.game.world.entities.destroy(f.ids[1]!);
    expect(f.draw().line).toBe('Active: thief, 1 of 2, coming');
  });

  it('a revealed ambush is unchanged', () => {
    const f = setup('t727-ambush', 'ambush', [{ spotted: true }, { spotted: true }, { spotted: true }], { state: 'engage', ambushSprung: true });
    const { line, focused } = f.draw();
    expect(line).toBe('Active: ambush, 3, attacking');
    expect(focused).toEqual([f.w.index(20, 20, z)]);
  });
});
