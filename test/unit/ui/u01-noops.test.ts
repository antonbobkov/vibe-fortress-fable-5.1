/**
 * U-01: a gesture that does nothing says why, and no raw id or code reaches the screen
 * (`docs/05-plan/ui-fixes/README.md` D-U4; UI audit §§ 4.1, 4.2, 4.5, Q3, Q6, Q12 `hint_farm`).
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import { SQUAD_MAX_COUNT } from '@core/constants';
import { TileKind } from '@core/map3d';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog } from '@ui/announcements';
import { actionText } from '@ui/panels/help';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string): { w: TestWorld; screen: FortressScreen; sent: Command[] } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const sent: Command[] = [];
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
    speed: () => 0,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => computeLayout(80, 42, true),
    precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 0,
  };
  return { w, screen: new FortressScreen(host, keymap, strings), sent };
}

/** Discovered granite floor: walkable, not farmable. */
function floor(w: TestWorld, x0: number, y0: number, x1: number, y1: number): void {
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = x0; x <= x1; x += 1) for (let y = y0; y <= y1; y += 1) {
    const i = w.index(x, y, z);
    w.discover(i);
    w.carve(i, TileKind.Floor, granite);
  }
}

describe('U-01 silent no-ops get a status message (§4.2, Q6)', () => {
  it('a dig rectangle where no tile qualifies sends nothing and says why', () => {
    const { w, screen, sent } = setup('u01-dig');
    floor(w, 10, 10, 13, 12);
    screen.openPanel('designate');
    screen.tool.choose('d');
    expect(screen.commit({ x: 10, y: 10, z }, { x: 13, y: 12, z })).toEqual([]);
    expect(sent).toEqual([]);
    expect(screen.statusRow2()).toBe('No tile here can be dug: dig marks rock walls and boulders.');
  });

  it('a zone rectangle where no tile qualifies names the rule, and a farm plot brings up hint_farm (Q12)', () => {
    const { w, screen, sent } = setup('u01-zone');
    floor(w, 10, 10, 12, 12);
    screen.openPanel('zones');
    screen.zones.choose('f');
    screen.commitZone({ x: 10, y: 10, z }, { x: 12, y: 12, z });
    expect(sent).toEqual([]);
    expect(screen.statusRow2()).toBe('Farm plot: 0 of 9 tiles qualify: it needs soil, mud or cave loam that no other zone holds.');
    expect(screen.ui.hintsShown).toContain('hint_farm');
    expect(screen.log.lines.some((l) => l.text.includes('☼'))).toBe(true);
  });

  it('Ctrl+Z with nothing to undo, and the squad limit, say so', () => {
    const { w, screen } = setup('u01-squads');
    expect(screen.key(press('z', { ctrl: true }))).toBe(true);
    expect(screen.statusRow2()).toBe('Nothing to undo.');
    for (let k = 0; k < SQUAD_MAX_COUNT; k += 1) w.submit({ type: 'CreateSquad', name: `Squad ${k}` });
    w.step(1);
    screen.openPanel('military');
    expect(screen.key(press('+'))).toBe(true);
    expect(screen.statusRow2()).toBe(`There can be at most ${SQUAD_MAX_COUNT} squads.`);
  });

  it('[S-t] trade without a depot says so (U-03: `t` opens Threats)', () => {
    const { screen, sent } = setup('u01-trade');
    screen.openPanel('depot');
    expect(screen.key(press('t', { shift: true }))).toBe(true);
    expect(sent).toEqual([]);
    expect(screen.statusRow2()).toBe('There is no trade depot: build one [b › Special].');
  });

  it('a kill order clicked on an empty tile asks for a creature', () => {
    const { w, screen } = setup('u01-kill');
    w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    w.step(1);
    screen.openPanel('military');
    screen.military.settingKill = true;
    const map = computeLayout(80, 42, true).map;
    screen.pointerDown({ col: map.col + 3, row: map.row + 3, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(screen.statusRow2()).toBe('Click a creature to attack · [Esc] cancel');
    expect(screen.military.settingKill).toBe(true);
  });

  it('the trade modal says why a gift or an offer sent nothing', () => {
    const w = new TestWorld({ seed: 'u01-modal', world: 'flat-test', embark: 'none' });
    const sent: Command[] = [];
    const modal = new TradeSessionScreen({ readers: w.readers, registry: w.game.registry, submit: (c) => sent.push(c), commandTick: () => {}, back: () => {}, strings });
    modal.key(press('Enter'));
    expect(modal.notice).toBe('Choose goods to offer.');
    modal.take.set(1, 1);
    modal.key(press('g'));
    expect(modal.notice).toBe('A gift takes nothing: clear their side first.');
    expect(sent).toEqual([]);
  });

  it('[t] title and [n] rename are off the units action row and do not swallow their keys', () => {
    const { screen } = setup('u01-units');
    screen.openPanel('units');
    expect(screen.key(press('t'))).toBe(true);
    expect(screen.ui.panel).toBe('threats');
    expect(strings.get('ui.units.actions2')).not.toContain('rename');
  });
});

describe('U-01 announcements and keys read as words, not codes (§4.5, Q3)', () => {
  function logOf(w: TestWorld): AnnouncementLog {
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    return log;
  }

  it('a skipped wave and a fallen standing give their reason in words; no children, no clause', () => {
    const w = new TestWorld({ seed: 'u01-announce', world: 'flat-test', embark: 'none' });
    const log = logOf(w);
    expect(log.announce({ type: 'ImmigrationSkipped', reason: 'spirit' } as never, w.readers, 0)?.line.text)
      .toMatch(/^No immigrants this season: hall spirit must be Content \(now [A-Z][a-z]+\)\.$/);
    expect(log.announce({ type: 'ImmigrationSkipped', reason: 'luck' } as never, w.readers, 200)?.line.text).toBe('No immigrants this season: no one set out this time.');
    expect(log.announce({ type: 'ReputationChanged', civ: 'wildwood', delta: -2, reason: 'wood_offered' } as never, w.readers, 400)?.line.text)
      .toBe('Our standing with wildwood has fallen: they were offered wooden goods.');
    expect(log.announce({ type: 'ImmigrantsArrived', ids: [], count: 5, children: 0 } as never, w.readers, 600)?.line.text).toBe('5 dwarves have come to join the hall.');
    expect(log.announce({ type: 'ImmigrantsArrived', ids: [], count: 5, children: 2 } as never, w.readers, 800)?.line.text).toBe('5 dwarves have come to join the hall, 2 of them children.');
  });

  it('a binding reads with its own context wording (help and the keybindings screen)', () => {
    const trade = keymap.bindings.find((b) => b.context === 'trade_session' && b.spec.key === '+');
    expect(trade !== undefined && actionText(trade)).toBe('quantity');
    const embark = keymap.bindings.find((b) => b.context === 'embark' && b.spec.key === 'Enter');
    expect(embark !== undefined && actionText(embark)).toBe('Embark');
    const speed = keymap.bindings.find((b) => b.id === 'speed_up');
    expect(speed !== undefined && actionText(speed)).not.toContain('_');
  });
});
