/**
 * T-718: under a calm alert the Military panel's alert line names the squads whose members work no
 * job (on Train or Active, 16 § Squads), and a squad on Train says under its mode how many dwarves
 * it takes off work, and, with no barracks, that they cannot drill and how to stop it
 * (`ui-screens/panels.md` § Military).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { alertLine } from '@ui/panels/military';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, keymap, press, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string, count: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const dwarves: EntityId[] = [];
  for (let k = 0; k < count; k += 1) dwarves.push(w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` }));
  const sent: Command[] = [];
  const layout = computeLayout(80, 50, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => { sent.push(c); w.submit(c); },
    speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  const draw = () => { const s = surface(80, 50); screen.draw(s); return s; };
  const squad = (name: string, members: EntityId[], mode: 'off' | 'train' | 'active'): void => {
    w.submit({ type: 'CreateSquad', name });
    w.step(1);
    const squadId = w.readers.of<{ squads(): { id: EntityId; name: string }[] }>('16').squads().find((sq) => sq.name === name)?.id ?? 0;
    w.submit({ type: 'SetSquadMembers', squadId, members });
    w.submit({ type: 'SetSquadMode', squadId, mode });
    w.step(1);
  };
  return { w, screen, dwarves, draw, squad };
}

type Drawn = ReturnType<ReturnType<typeof setup>['draw']>;
/** The sidebar's text as one line: wrapped lines joined, borders and padding dropped. */
const panel = (s: Drawn): string => s.lines().map((l) => l.split('│')[1] ?? '').join(' ').replace(/\s+/g, ' ');
const rowOf = (s: Drawn, part: string): number => s.lines().findIndex((l) => l.includes(part));

describe('T-718 the Calm line says who does not work', () => {
  it('with no squad on duty it reads as before, an Off squad included', () => {
    const f = setup('t718-off', 3);
    f.screen.openPanel('military');
    expect(panel(f.draw())).toContain('Calm: everyone works. Squads');
    f.squad('The Hearthguard', f.dwarves, 'off');
    const text = panel(f.draw());
    expect(text).toContain('Calm: everyone works. Squads');
    expect(text).not.toContain('off work');
  });

  it('a squad on Train is named with its members, and the mode line counts them off work', () => {
    const f = setup('t718-train', 7);
    f.screen.openPanel('military');
    f.squad('The Hearthguard', f.dwarves.slice(0, 3), 'train');
    let s = f.draw();
    expect(panel(s)).toContain('Calm: everyone works but 3 in The Hearthguard (Train). Squads');
    // No barracks: they cannot drill, and the line gives the way out, [o] Off among it.
    expect(panel(s)).toContain('Mode: train [o] Off [t] Train [v] Active 3 dwarves off work, and with no barracks they cannot drill: [z] Barracks, then [b], or [o] Off.');
    expect(fgOfText(s, rowOf(s, '3 dwarves off work'), '3 dwarves off work')).toBe(hexOf(theme.alert));
    // With a barracks they drill there, still off work, and the line is quiet.
    f.w.zone('barracks', [f.w.index(20, 20, z), f.w.index(21, 20, z)]);
    s = f.draw();
    expect(panel(s)).toContain('Mode: train [o] Off [t] Train [v] Active 3 dwarves off work: they drill at the barracks.');
    expect(fgOfText(s, rowOf(s, '3 dwarves off work'), '3 dwarves off work')).toBe(hexOf(theme.dim));
    // Off again: everyone works, and the mode line has no cost.
    f.screen.key(press('O', { shift: true }));
    f.w.step(1);
    s = f.draw();
    expect(panel(s)).toContain('Calm: everyone works. Squads');
    expect(panel(s)).not.toContain('off work');
  });

  it('every squad on duty is named, Train and Active, and a squad with no members is not', () => {
    const f = setup('t718-two', 4);
    f.screen.openPanel('military');
    f.squad('The Hearthguard', f.dwarves.slice(0, 2), 'train');
    f.squad('The Cold Bolts', f.dwarves.slice(2, 3), 'active');
    f.squad('The Iron Shields', [], 'train');
    expect(panel(f.draw())).toContain('Calm: everyone works but 2 in The Hearthguard (Train) and 1 in The Cold Bolts (Active). Squads');
    // Another alert keeps its own line.
    f.w.submit({ type: 'SetAlert', level: 'watchful' });
    f.w.step(1);
    expect(panel(f.draw())).toContain('Watch: squads stand to; civilians work. Squads');
  });

  it('the line wraps whole at the sidebar width, never cut', () => {
    const squads = ['The Hearthguard', 'The Cold Bolts', 'The Mountain Guard'].map((name, k) => ({ name, members: [1, 2, 3].slice(0, k + 1) as EntityId[], mode: k === 1 ? 'active' as const : 'train' as const }));
    const line = alertLine(strings, 'calm', squads);
    expect(line).toBe('Calm: everyone works but 1 in The Hearthguard (Train), 2 in The Cold Bolts (Active) and 3 in The Mountain Guard (Train).');
    expect(alertLine(strings, 'hearth', squads)).toBe(strings.get('ui.military.alert_hearth'));
    expect(strings.get('ui.military.train_cost', { n: 1 })).toBe('1 dwarf off work: they drill at the barracks.');
  });
});
