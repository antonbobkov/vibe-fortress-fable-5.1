/**
 * T-770: a squad shut in by the alert's locked doors (`reports/data/2026-11-25-playtest-6.md`,
 * finding 3; `ui-screens/panels.md` § Military). The Station row says when the members cannot walk
 * to the station, and whether the locked doors are why; a soldier on duty cut off from the drink
 * counts in the shut-in line and the Thirsty line, which names its squad; and a squad set off reads
 * active while the alert makes it so.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import { ALERT_LOCK_GRACE_TICKS } from '@systems/defense/constants';
import { modeText, stationReach } from '@ui/panels/military';
import type { PanelContext } from '@ui/panels/context';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { cutOff } from '@ui/shut-in';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, keymap, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

/**
 * An airlock: walls across the map at y 20 and y 24, each with a `lock_on_alert` door at x 40; the
 * hearth hall north of the inner wall holds a civilian and a barrel of ale; the squad, The Gate
 * Guard, stands in the vestibule between the doors.
 */
function airlock(seed: string, mode: 'off' | 'active', soldiers = 1) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (const y of [20, 24]) for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, y, z), TileKind.Wall, granite);
  for (let y = 14; y < 20; y += 1) for (let x = 34; x < 47; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, z), TileFlag.Outdoor, false);
  const doors = [20, 24].map((y) => w.build('door', w.index(40, y, z), 'oak'));
  for (const door of doors) expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
  w.build('hearth', w.index(40, 16, z), 'granite');
  const civilian = w.spawnDwarf({ at: w.index(38, 17, z), name: 'Liv Ashbeard', ageYears: 40 });
  const members = Array.from({ length: soldiers }, (_, k) => w.spawnDwarf({ at: w.index(38 + 2 * k, 22, z), name: `Asa${String(k).padStart(2, '0')} Forgehall`, ageYears: 40 }));
  for (const id of [civilian, ...members]) { w.setNeed(id, 'thirst', 0); w.setNeed(id, 'hunger', 0); }
  const barrel = w.spawnItem('barrel', 'oak', w.index(44, 16, z));
  w.spawnItem('drink', 'ale', { containerId: barrel }, 20);
  w.submit({ type: 'CreateSquad', name: 'The Gate Guard' });
  w.step(1);
  const combat = w.readers.of<CombatReader>('16');
  const squadId = combat.squads()[0]?.id ?? 0;
  for (const cmd of [{ type: 'SetSquadMembers', squadId, members }, { type: 'SetSquadMode', squadId, mode }] as const) {
    expect(w.game.world.applyCommand(cmd).ok).toBe(true);
  }

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
  const draw = () => { const s = surface(80, 42); screen.draw(s); return s; };
  const sidebarRows = (): string[] => draw().lines().map((l) => (l.split('│')[1] ?? '').trim());
  const sidebar = (): string => sidebarRows().join(' ').replace(/\s+/g, ' ');
  const alert = (level: 'calm' | 'watchful' | 'hearth'): void => {
    expect(w.game.world.applyCommand({ type: 'SetAlert', level }).ok).toBe(true);
    w.step(2);
  };
  const locked = (): boolean => doors.every((door) => w.readers.of<BuildingsReader>('14').mechanismState(door) === 'locked');
  const lockUp = (): void => {
    alert('hearth');
    w.until(() => locked(), ALERT_LOCK_GRACE_TICKS + 2 * TICKS_PER_HOUR);
    expect(locked()).toBe(true);
  };
  const ctx: PanelContext = {
    readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd) => { expect(w.game.world.applyCommand(cmd).ok).toBe(true); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
  const squad = () => {
    const sq = combat.squad(squadId);
    if (sq === undefined) throw new Error('no squad');
    return sq;
  };
  const shutIn = () => screen.log.lines.filter((line) => line.key === 'announce.shut_in.thirst');
  return { w, ctx, civilian, members, squadId, squad, draw, sidebar, sidebarRows, alert, lockUp, locked, shutIn };
}

const LOCKED_OUT = 'Out of reach behind the locked doors: the squad waits where it is until Calm [1] opens them.';

describe('T-770 the Station row says when the station is out of reach', () => {
  it('a station outside the locked doors reads out of reach behind them under Hearth, and not under Calm', () => {
    const f = airlock('t770-station', 'active', 2);
    f.lockUp();
    expect(f.sidebar()).not.toContain('Out of reach');
    f.ctx.submit({ type: 'SetSquadStation', squadId: f.squadId, tile: f.w.index(40, 28, z) });
    expect(stationReach(f.ctx, f.squad())).toBe('locked');
    const s = f.draw();
    expect(f.sidebar()).toContain(LOCKED_OUT);
    const row = s.lines().findIndex((l) => l.includes('Out of reach'));
    expect(row).toBeGreaterThan(s.lines().findIndex((l) => l.includes('Station (40,28')));
    expect(fgOfText(s, row, 'Out of reach')).toBe(hexOf(theme.alert));
    // The members stay in the vestibule, on duty.
    f.w.step(TICKS_PER_HOUR);
    expect(f.sidebar()).toContain(LOCKED_OUT);
    // Calm opens the doors: the station is in reach.
    f.alert('calm');
    expect(f.locked()).toBe(false);
    expect(stationReach(f.ctx, f.squad())).toBe('reach');
    expect(f.sidebar()).not.toContain('Out of reach');
  });

  it('a station walled off from the squad reads no path, whatever the alert', () => {
    const f = airlock('t770-no-path', 'active');
    const granite = f.w.game.registry.table('materials').index('granite');
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (dx !== 0 || dy !== 0) f.w.game.world.services.terrain.setKind(f.w.index(60 + dx, 30 + dy, z), TileKind.Wall, granite);
    }
    f.w.step(1);
    f.ctx.submit({ type: 'SetSquadStation', squadId: f.squadId, tile: f.w.index(60, 30, z) });
    expect(stationReach(f.ctx, f.squad())).toBe('none');
    expect(f.sidebar()).toContain('Out of reach: no path from the squad.');
  });
});

describe('T-770 soldiers on duty count in the shut-in rule', () => {
  it('a soldier shut between two locked doors at critical thirst is counted in the alert and the Thirsty line, with its squad', () => {
    // Posted in the vestibule, as the playtest's script posted the Gate Guard on its stair.
    const f = airlock('t770-soldier-thirst', 'off');
    const soldier = f.members[0] as EntityId;
    f.w.setNeed(soldier, 'rest', 0);
    f.ctx.submit({ type: 'SetSquadStation', squadId: f.squadId, tile: f.w.index(40, 22, z) });
    f.lockUp();
    f.w.step(TICKS_PER_HOUR);
    const at = f.w.game.world.entities.get(soldier, C.Position);
    expect(at !== undefined && at.y > 20 && at.y < 24, 'the soldier stands between the doors').toBe(true);
    f.w.setNeed(soldier, 'thirst', 84);
    f.w.until(() => f.shutIn().length > 0, 6 * TICKS_PER_HOUR);
    expect(f.shutIn().map((line) => line.text)).toEqual([
      'The drink is outside the locked doors: 1 dwarf is thirsty. [m] [1] opens them; drink kept inside the hall, or a well, keeps them drinking.',
    ]);
    expect(cutOff(f.w.readers, 'thirst')).toEqual([soldier]);
    const s = f.draw();
    expect(f.sidebar()).toContain('Thirsty: 1 cannot reach drink behind the locked doors.');
    expect(f.sidebar()).toContain('1 of them is a soldier of The Gate Guard.');
    const row = s.lines().findIndex((l) => l.includes('of them is a soldier'));
    expect(fgOfText(s, row, '1 of them')).toBe(hexOf(theme.alert));
    // The civilian inside the hall reaches the barrel: it is not counted.
    f.w.setNeed(f.civilian, 'thirst', 84);
    f.w.step(TICKS_PER_HOUR);
    expect(cutOff(f.w.readers, 'thirst')).toEqual([soldier]);
  });
});

describe('T-770 the Mode shows what the alert makes it', () => {
  it('a squad set off reads off under Calm and off→act under Hearth, its Mode line saying active while the alert is Hearth', () => {
    const f = airlock('t770-mode', 'off');
    expect(f.sidebarRows().some((r) => /^▶? ?The Gate Guard +1\/6 +off$/.test(r))).toBe(true);
    expect(f.sidebar()).toContain('Mode: off ');
    f.alert('hearth');
    expect(f.sidebarRows().some((r) => /^▶? ?The Gate Guard +1\/6 +off→act$/.test(r))).toBe(true);
    expect(f.sidebar()).toContain('Mode: off · active while the alert is Hearth');
    expect(modeText(strings, 'watchful', 'train', 'cell')).toBe('trn→act');
    expect(modeText(strings, 'watchful', 'train', 'line')).toBe('Mode: train · active while the alert is Watchful');
    expect(modeText(strings, 'hearth', 'active', 'line')).toBe('Mode: active');
    f.alert('calm');
    expect(f.sidebar()).not.toContain('active while the alert');
  });
});
