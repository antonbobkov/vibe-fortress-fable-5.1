/**
 * T-504: raid morale is readable (18 § Morale, Readable). The Threats panel shows an active party's
 * morale in words, and a raider that loses its nerve gets a note; a flight on blood does not.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog } from '@ui/announcements';
import type { Speed } from '@ui/status';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { arriveParty, spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.spawnDwarf({ at: w.index(40, 60, z), name: 'Urist Stone' });
  const layout = computeLayout(80, 42, true);
  const state = { speed: 1 as Speed };
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c),
    speed: () => state.speed, setSpeed: (s) => { state.speed = s; },
    pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  const draw = (): string[] => { const s = surface(80, 42); screen.draw(s); return s.lines(); };
  const reg = w.game.registry;
  const rng = w.game.world.rngFor('t504');
  const { partyId, pendingSpawns } = arriveParty(w.game.world as never, reg, rng, 'raid', 'gloam', 4, 'n', w.tick, 15, 2, false);
  for (const s of pendingSpawns) spawnHostileMember(w.game.world as never, reg, rng, s.partyId, s.species, s.role, s.tile, s.gearTier, s.isCaptain);
  w.step(1);
  return { w, screen, draw, partyId };
}

describe('T-504 morale in the Threats panel and the log', () => {
  it('the panel names an active raid\'s morale: steady, then wavering', () => {
    const f = setup('t504-panel');
    f.screen.openPanel('threats');
    expect(f.draw().join('\n')).toMatch(/Active: raid \(5, \w+\)/);
    expect(f.draw().join('\n')).toContain('Morale: steady');
    f.w.game.world.entities.get(f.partyId, C.Party)!.morale = 40;
    expect(f.draw().join('\n')).toContain('Morale: wavering');
    f.w.game.world.entities.get(f.partyId, C.Party)!.state = 'retreat';
    expect(f.draw().join('\n')).not.toContain('Morale:');
  });

  it('a raider that loses its nerve is a note; a flight on blood is not announced', () => {
    const f = setup('t504-note');
    const log = new AnnouncementLog(strings, f.w.game.registry);
    log.register(f.w.game.world.registrations.announcements);
    const party = f.w.game.world.entities.get(f.partyId, C.Party)!;
    const warrior = party.members.find((m) => f.w.game.world.entities.get(m, C.Hostile)?.role === 'warriors')!;
    const species = f.w.game.world.entities.get(warrior, C.Creature)!.species;
    const nerve = log.announce({ type: 'HostileFled', id: warrior, nerve: true, species }, f.w.readers, 1);
    expect(nerve?.severity).toBe('note');
    expect(nerve?.line.text).toBe('A gloam warrior has lost its nerve and runs.');
    expect(log.announce({ type: 'HostileFled', id: warrior }, f.w.readers, 2)).toBeNull();
  });
});
