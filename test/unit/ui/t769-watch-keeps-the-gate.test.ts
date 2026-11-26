/**
 * T-769: a Hearth alert's lock on the Lock on alert doors holds under Watch and opens only at Calm
 * (14 § Doors and hatches, 19 § Hearth alert retreat). Lowering Hearth to Watch once opened every such
 * door without a word, and a raid walked down the open stair. Each change that keeps the doors locked
 * or opens them says so in the log, and the Military panel's alert line says what the doors do.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TileFlag, TileKind } from '@core/map3d';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import { ALERT_LOCK_GRACE_TICKS } from '@systems/defense/constants';
import { alertDoors, alertLine } from '@ui/panels/military';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

/** A wall across the map at y 20 with one door at x 40, the hearth to the north and two dwarves beside it. */
function gate(seed: string, withDoor = true) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, z), TileKind.Wall, granite);
  for (let y = 14; y < 20; y += 1) for (let x = 34; x < 47; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, z), TileFlag.Outdoor, false);
  const doorTile = w.index(40, 20, z);
  const door = w.build('door', doorTile, 'oak');
  w.build('hearth', w.index(40, 16, z), 'granite');
  if (withDoor) expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
  for (let k = 0; k < 2; k += 1) w.spawnDwarf({ at: w.index(38 + 2 * k, 17, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` });

  const layout = computeLayout(80, 42, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c),
    speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  w.game.world.onEvents((batch) => screen.onEvents(batch));
  screen.openPanel('military');
  const sidebar = (): string => { const s = surface(80, 42); screen.draw(s); return s.lines().map((l) => l.split('│')[1] ?? '').join(' ').replace(/\s+/g, ' '); };
  const notes = (key: string): string[] => screen.log.lines.filter((line) => line.key === key).map((line) => line.text);
  const alert = (level: 'calm' | 'watchful' | 'hearth'): void => {
    expect(w.game.world.applyCommand({ type: 'SetAlert', level }).ok).toBe(true);
    // 14 answers `AlertChanged` in its dispatch; its own events reach the log with the next tick's.
    w.step(2);
  };
  const locked = (): boolean => w.readers.of<BuildingsReader>('14').mechanismState(door) === 'locked';
  const passable = (): boolean => w.game.world.readers.pathing.passable(doorTile, 'walker');
  const lockUp = (): void => {
    alert('hearth');
    w.until(() => locked(), ALERT_LOCK_GRACE_TICKS + 20);
    expect(locked()).toBe(true);
  };
  return { w, door, sidebar, notes, alert, locked, passable, lockUp };
}

const HELD = 'The Lock on alert doors stay locked under Watch: [m] [1] Calm opens them.';
const CLEARED = 'The Lock on alert doors are open: the alert is Calm.';
const WATCH_HELD = 'Watch: squads stand to; civilians work; Lock on alert doors stay locked until Calm [1].';
const WATCH_OPEN = 'Watch: squads stand to; civilians work; Lock on alert doors stay open.';
const CALM_DOORS = 'Calm: everyone works; Lock on alert doors stay open.';

describe('T-769 Watch keeps the gate the Hearth alert locked; Calm opens it', () => {
  it('Hearth to Watch keeps the doors locked and says so once; Watch to Calm opens them and says so', () => {
    const f = gate('t769-watch-calm');
    expect(f.sidebar()).toContain(CALM_DOORS);
    f.lockUp();
    expect(f.sidebar()).toContain('Lock on alert doors shut until Calm.');
    f.alert('watchful');
    expect(f.locked()).toBe(true);
    expect(f.passable()).toBe(false);
    expect(f.notes('announce.alert_locks_held')).toEqual([HELD]);
    expect(f.sidebar()).toContain(WATCH_HELD);
    // The lock holds for as long as the alert stays at Watch, and nothing else is said.
    f.w.step(ALERT_LOCK_GRACE_TICKS * 2);
    expect(f.locked()).toBe(true);
    expect(f.notes('announce.alert_locks_held')).toEqual([HELD]);
    expect(f.notes('announce.alert_locks_cleared')).toEqual([]);
    f.alert('calm');
    expect(f.locked()).toBe(false);
    expect(f.passable()).toBe(true);
    expect(f.notes('announce.alert_locks_cleared')).toEqual([CLEARED]);
    expect(f.sidebar()).toContain(CALM_DOORS);
  });

  it('raising Hearth again from Watch never opens the doors, not for a tick', () => {
    const f = gate('t769-watch-hearth');
    f.lockUp();
    f.alert('watchful');
    expect(f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    for (let k = 0; k < 30; k += 1) {
      f.w.step(1);
      expect(f.locked()).toBe(true);
      expect(f.passable()).toBe(false);
    }
    // Hearth straight to Calm opens them with the note; Calm to Watch locks nothing and says nothing.
    f.alert('calm');
    expect(f.locked()).toBe(false);
    expect(f.notes('announce.alert_locks_cleared')).toEqual([CLEARED]);
    f.alert('watchful');
    f.w.step(ALERT_LOCK_GRACE_TICKS + 20);
    expect(f.locked()).toBe(false);
    expect(f.notes('announce.alert_locks_held')).toEqual([HELD]);
    expect(f.sidebar()).toContain(WATCH_OPEN);
  });

  it('a door still waiting for its lock when the alert drops to Watch stays open, and nothing is said', () => {
    const f = gate('t769-in-grace');
    // A dwarf outside holds the door open through the grace's start.
    f.w.spawnDwarf({ at: f.w.index(40, 23, z), name: 'Outside Stone' });
    f.alert('hearth');
    expect(f.locked()).toBe(false);
    f.alert('watchful');
    f.w.step(ALERT_LOCK_GRACE_TICKS + 20);
    expect(f.locked()).toBe(false);
    expect(f.notes('announce.alert_locks_held')).toEqual([]);
    f.alert('calm');
    expect(f.notes('announce.alert_locks_cleared')).toEqual([]);
  });

  it('without a built Lock on alert door the Watch and Calm lines read as before', () => {
    const f = gate('t769-no-door', false);
    expect(alertDoors(f.w.readers)).toBe('none');
    expect(f.sidebar()).toContain('Calm: everyone works. Squads');
    f.alert('watchful');
    expect(f.sidebar()).toContain('Watch: squads stand to; civilians work. Squads');
    expect(alertLine(strings, 'calm', [{ name: 'The Hearthguard', members: [1, 2], mode: 'train' }], 'open'))
      .toBe('Calm: everyone works but 2 in The Hearthguard (Train); Lock on alert doors stay open.');
    expect(alertLine(strings, 'watchful', [], 'none')).toBe('Watch: squads stand to; civilians work.');
  });
});
