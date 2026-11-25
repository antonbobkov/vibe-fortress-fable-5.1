/**
 * T-726: a creature with no name of its own is shown by its species' name, never by the species id
 * spawn stores as its name (24 § Inspection): a gloam captain's view is titled "gloam captain", and
 * its tile-list row, hover line and Units All row say the same. A named dwarf and a cow are unchanged.
 * T-728: a party member with no target reads its party's state in the Threats panel's words.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Hostile } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { creatureName } from '@ui/creature-name';
import { creatureActivity } from '@ui/panels/look-activity';
import { creatureSummary, tileContents, tileListRows } from '@ui/panels/look';
import { allCreatures, creatureFact } from '@ui/panels/units-all';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

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

/** A gloam raid's member on the map at (20 + k, 20), in its party's `state`. */
function raider(w: TestWorld, species: string, k: number, state: string, hostile: Partial<Hostile> = {}): EntityId {
  const id = w.spawnCreature(species, w.index(20 + k, 20, z), 'hostile:gloam');
  const partyId = w.game.world.entities.create('party');
  w.game.world.entities.add(id, C.Hostile, {
    partyId, role: 'warriors', behaviorState: 'attack', stealthed: false, spotted: false, breakingDoorId: 0, breakingSince: 0, ...hostile,
  });
  w.game.world.entities.add(partyId, C.Party, {
    civ: 'gloam', purpose: 'raid', members: [id], leaderId: id, state, goalTile: 0, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1,
  });
  return id;
}

/** The sidebar's rows as text with the creature's view open. */
function view(f: FortressScreen, id: EntityId): string[] {
  f.inspectCreature(id);
  const s = surface(COLS, ROWS);
  f.draw(s);
  return s.lines().map((line) => Array.from(line).slice(SIDE + 2).join('').trimEnd());
}

describe('T-726 a creature without a name of its own is shown by its species\' name', () => {
  it('a gloam captain\'s view, tile-list row, hover line and Units All row read "gloam captain"', () => {
    const { w, f } = setup('t726-captain');
    const captain = raider(w, 'gloam_captain', 0, 'engage');
    // The data keeps the species id as the name (saves and world hashes hold it).
    expect(w.readers.entities.get(captain, C.Creature)?.name).toBe('gloam_captain');
    const rows = view(f, captain);
    expect(rows[0]?.startsWith('gloam captain ')).toBe(true);
    expect(rows.some((row) => row.includes('gloam_captain'))).toBe(false);
    const tile = w.index(20, 20, z);
    expect(tileListRows(w.readers, w.game.registry, strings, tile).find((r) => r.target?.kind === 'creature')?.name).toBe('gloam captain');
    expect(creatureSummary(w.readers, w.game.registry, strings, captain)).toBe('gloam captain, Attacking');
    expect(tileContents(w.readers, w.game.registry, strings, tile)).toMatch(/^gloam captain, Attacking/);
    expect(allCreatures(w.readers, w.game.registry).find((r) => r.id === captain)?.name).toBe('gloam captain');
  });

  it('a second creature on the tile is named by its species too ("· gloam archer")', () => {
    const { w } = setup('t726-pair');
    raider(w, 'gloam_captain', 0, 'engage');
    w.spawnCreature('gloam_archer', w.index(20, 20, z), 'hostile:gloam');
    const line = tileContents(w.readers, w.game.registry, strings, w.index(20, 20, z));
    expect(line).toContain('gloam archer');
    expect(line).not.toContain('_');
  });

  it('the view of a captain gone out of sight keeps its species\' name as its title', () => {
    const { w, f } = setup('t726-hidden');
    const captain = raider(w, 'gloam_captain', 0, 'engage');
    view(f, captain);
    const h = w.game.world.entities.get(captain, C.Hostile) as Hostile;
    h.stealthed = true;
    h.spotted = false;
    const s = surface(COLS, ROWS);
    f.draw(s);
    const rows = s.lines().map((line) => Array.from(line).slice(SIDE + 2).join('').trimEnd());
    expect(rows[0]?.startsWith('gloam captain ')).toBe(true);
    expect(rows).toContain('Out of sight.');
  });

  it('a named dwarf and a cow are unchanged', () => {
    const { w, f } = setup('t726-named');
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, z), name: 'Ketil Ironvein' });
    const cow = w.spawnCreature('cow', w.index(12, 10, z), 'wild');
    expect(view(f, dwarf)[0]?.startsWith('Ketil Ironvein ')).toBe(true);
    expect(creatureSummary(w.readers, w.game.registry, strings, dwarf).startsWith('Ketil Ironvein, ')).toBe(true);
    expect(view(f, cow)[0]?.startsWith('cow ')).toBe(true);
    expect(creatureName(w.game.registry, w.readers.entities.get(cow, C.Creature))).toBe('cow');
    expect(tileListRows(w.readers, w.game.registry, strings, w.index(12, 10, z))[0]?.name).toBe('cow');
  });
});

describe('T-728 a raider with no target reads its party\'s state in words', () => {
  it('loiter reads Waiting, retreat Leaving, engage Attacking; Units All agrees', () => {
    const { w, f } = setup('t728-states');
    const cases: [string, string, string][] = [['loiter', 'Waiting', 'Hostile, waiting'], ['retreat', 'Leaving', 'Hostile, leaving'], ['engage', 'Attacking', 'Hostile, attacking']];
    cases.forEach(([state, activity, fact], k) => {
      const id = raider(w, 'gloam_warrior', k * 3, state, { behaviorState: state });
      expect(creatureActivity({ readers: w.readers, registry: w.game.registry, strings }, id)).toBe(activity);
      const row = allCreatures(w.readers, w.game.registry).find((r) => r.id === id);
      expect(row === undefined ? '' : creatureFact(f.ctx, row)).toBe(fact);
      expect(view(f, id)).toContain(`Activity: ${activity}`);
    });
  });
});
