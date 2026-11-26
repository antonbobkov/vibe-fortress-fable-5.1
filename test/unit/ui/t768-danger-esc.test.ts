/**
 * T-768: `Esc` on a pinned danger line also backs out one step (closes the panel, cancels the
 * tool), so "`Esc`, then a letter" reaches another panel and not the Military panel's alert and mode
 * keys; and lowering the alert while a hostile party is on the map (from Hearth, also while one is
 * announced as coming) asks first (24 § Announcements and the log, `ui-screens/panels.md`
 * § Military; playtest 2026-11-25 (military), finding 1).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Party } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Alert, EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { CombatReader } from '@systems/combat';
import type { ComingParty, ThreatsReader } from '@systems/threats';
import type { LogLine } from '@ui/announcements';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import type { Speed } from '@ui/status';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);
const DANGER: LogLine = { tick: 0, severity: 'danger', text: 'A Gloam siege has come from the north!', count: 1 };

interface Threat { onMap: boolean; coming: boolean }

/**
 * A fortress of three dwarves in an Active squad, at `alert`, with a host that records the
 * questions it is asked and the game menu it is asked to open. `threat` says whether a Gloam party
 * is on the map (three warriors at the map's far side, looting) and whether a siege is announced:
 * the threats reader is the world's with its parties and warnings replaced.
 */
function setup(seed: string, alert: Alert, threat: Threat) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ids: EntityId[] = [0, 1, 2].map((k) => w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${k} Stone` }));
  w.submit({ type: 'CreateSquad', name: 'The Gate Guard' });
  w.step(1);
  const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
  w.submit({ type: 'SetSquadMembers', squadId, members: ids });
  w.submit({ type: 'SetSquadMode', squadId, mode: 'active' });
  w.submit({ type: 'SetAlert', level: alert });
  w.step(1);
  const raiders = [40, 41, 42].map((x) => w.spawnCreature('gloam_warrior', w.index(x, 40, z), 'hostile:gloam'));
  const party = { civ: 'gloam', purpose: 'siege', members: raiders, leaderId: raiders[0], state: 'loiter', loot: [], edge: 'n', size: 3 } as unknown as Party;
  const coming: ComingParty = { kind: 'siege', civ: 'gloam', sizeBand: 'horde', edge: 'n', arrivalTick: w.readers.calendar.tick };
  const real = w.readers.of<ThreatsReader>('18');
  const threats: ThreatsReader = Object.create(real, {
    activeParties: { value: () => (threat.onMap ? [1] : []) },
    party: { value: (id: number) => (threat.onMap && id === 1 ? party : undefined) },
    isStealthed: { value: () => false },
    isSpotted: { value: () => true },
    coming: { value: () => (threat.coming ? [coming] : []) },
  }) as ThreatsReader;
  const readers: ReaderSet = Object.create(w.readers, {
    of: { value: <T>(id: string): T => (id === '18' ? threats as T : w.readers.of<T>(id)) },
  }) as ReaderSet;
  const ui = defaultUiState(z);
  let speed: Speed = 0;
  const asked: { id: string; params: Readonly<Record<string, string | number>>; answer: (yes: boolean) => void }[] = [];
  let menus = 0;
  const host: FortressHost = {
    readers, registry: w.game.registry, ui, submit: (cmd) => w.submit(cmd),
    speed: () => speed, setSpeed: (s) => { speed = s; }, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => LAYOUT, precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    confirm: (id, params, answer) => { asked.push({ id, params: params as Readonly<Record<string, string | number>>, answer }); },
    gameMenu: () => { menus += 1; },
  };
  const screen = new FortressScreen(host, keymap, strings);
  /** Press each key, then let the world take the commands. */
  const keys = (...list: string[]): void => {
    for (const k of list) screen.key(press(k));
    w.step(1);
  };
  const alertNow = (): Alert => w.readers.of<CombatReader>('16').alert();
  const mode = (): string => w.readers.of<CombatReader>('16').squads()[0]!.mode;
  return { w, ui, screen, asked, menus: () => menus, keys, alertNow, mode };
}

describe('T-768 Esc on a danger line backs out of the open panel', () => {
  it('with the Military panel open and a danger line pinned, `Esc` closes both, and `a` then opens the Log', () => {
    const { ui, screen, keys } = setup('t768-esc-closes', 'hearth', { onMap: true, coming: false });
    keys('m');
    expect(ui.panel).toBe('military');
    screen.pinned = DANGER;
    expect(screen.key(press('Esc'))).toBe(true);
    expect(screen.pinned).toBeNull();
    expect(ui.panel).toBeNull();
    keys('a');
    expect(ui.panel).toBe('log');
  });

  it('the siege: `Esc` `a` `1` reads the log and leaves the alert at Hearth', () => {
    const { ui, screen, asked, keys, alertNow } = setup('t768-siege', 'hearth', { onMap: true, coming: false });
    keys('m');
    screen.pinned = DANGER;
    keys('Esc', 'a', '1');
    expect(ui.panel).toBe('log');
    expect(alertNow()).toBe('hearth');
    expect(asked).toEqual([]);
  });

  it('the ambush: `Esc` `a` `2` leaves the alert at Calm, and `Esc` `t` opens Threats with the squad still Active', () => {
    const { ui, screen, keys, alertNow, mode } = setup('t768-ambush', 'calm', { onMap: true, coming: false });
    keys('m');
    screen.pinned = DANGER;
    keys('Esc', 'a', '2');
    expect(ui.panel).toBe('log');
    expect(alertNow()).toBe('calm');
    keys('m');
    screen.pinned = DANGER;
    keys('Esc', 't');
    expect(ui.panel).toBe('threats');
    expect(mode()).toBe('active');
  });

  it('with nothing open, `Esc` on a pinned line only dismisses it: no game menu; the next `Esc` opens it', () => {
    const { ui, screen, menus } = setup('t768-no-menu', 'calm', { onMap: false, coming: false });
    screen.pinned = DANGER;
    expect(screen.key(press('Esc'))).toBe(true);
    expect(screen.pinned).toBeNull();
    expect(ui.panel).toBeNull();
    expect(menus()).toBe(0);
    screen.key(press('Esc'));
    expect(menus()).toBe(1);
  });

  it('`Space` on a pinned line still only dismisses it: the game stays paused and the panel open', () => {
    const { ui, screen, keys } = setup('t768-space', 'calm', { onMap: false, coming: false });
    keys('m');
    screen.pinned = DANGER;
    screen.key(press('Space'));
    expect(screen.pinned).toBeNull();
    expect(ui.panel).toBe('military');
  });

  it('a letter on a pinned line still acts: in the Military panel `t` sets Train', () => {
    const { ui, screen, keys, mode } = setup('t768-letter', 'calm', { onMap: false, coming: false });
    keys('m');
    screen.pinned = DANGER;
    keys('t');
    expect(screen.pinned).toBeNull();
    expect(ui.panel).toBe('military');
    expect(mode()).toBe('train');
  });
});

describe('T-768 lowering the alert under a threat asks first', () => {
  it('under Hearth with a party on the map, `1` asks, `n` leaves Hearth, `y` lowers it to Calm', () => {
    const { asked, keys, alertNow } = setup('t768-ask', 'hearth', { onMap: true, coming: false });
    keys('m', '1');
    expect(asked.map((a) => a.id)).toEqual(['c_lower_alert']);
    expect(strings.get(`confirm.${asked[0]!.id}`, asked[0]!.params)).toBe('Active: Gloam siege, 3, waiting. Lower the alert to Calm?');
    asked[0]!.answer(false);
    keys();
    expect(alertNow()).toBe('hearth');
    keys('1');
    asked[1]!.answer(true);
    keys();
    expect(alertNow()).toBe('calm');
  });

  it('under Hearth with a party on the map, `2` asks too; under Watchful, `1` asks', () => {
    const { asked, keys, alertNow } = setup('t768-ask-watch', 'hearth', { onMap: true, coming: false });
    keys('m', '2');
    expect(asked.map((a) => a.id)).toEqual(['c_lower_alert']);
    asked[0]!.answer(true);
    keys();
    expect(alertNow()).toBe('watchful');
    keys('1');
    expect(asked.map((a) => a.id)).toEqual(['c_lower_alert', 'c_lower_alert']);
    expect(alertNow()).toBe('watchful');
  });

  it('with no party, `1` lowers Hearth at once', () => {
    const { asked, keys, alertNow } = setup('t768-no-party', 'hearth', { onMap: false, coming: false });
    keys('m', '1');
    expect(asked).toEqual([]);
    expect(alertNow()).toBe('calm');
  });

  it('a siege announced as coming: from Hearth `2` asks and names it; from Watchful `1` lowers at once', () => {
    const { asked, keys, alertNow } = setup('t768-coming', 'hearth', { onMap: false, coming: true });
    keys('m', '2');
    expect(asked.map((a) => a.id)).toEqual(['c_lower_alert_coming']);
    expect(strings.get(`confirm.${asked[0]!.id}`, asked[0]!.params)).toBe('Coming: a Gloam siege, a horde, from the north, today. Lower the alert to Watchful?');
    asked[0]!.answer(true);
    keys();
    expect(alertNow()).toBe('watchful');
    keys('1');
    expect(asked).toHaveLength(1);
    expect(alertNow()).toBe('calm');
  });

  it('raising the alert never asks, with a party on the map', () => {
    const { asked, keys, alertNow } = setup('t768-raise', 'calm', { onMap: true, coming: false });
    keys('m', '2');
    expect(alertNow()).toBe('watchful');
    keys('3');
    expect(alertNow()).toBe('hearth');
    expect(asked).toEqual([]);
  });
});
