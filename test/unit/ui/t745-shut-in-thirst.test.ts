/**
 * T-745: shut in under the Hearth alert with its drink outside the locked doors, the fortress went to
 * thirst 100 and the log called it starving. The day's line names the need ("dying of thirst"); the
 * first sheltering dwarf cut off from its drink brings a once-per-alert line that says why and what
 * to do; the Military panel says it while it lasts (19 § Hearth alert retreat, 24 § Announcements).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { GameEvent } from '@core/events';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import { ALERT_LOCK_GRACE_TICKS } from '@systems/defense/constants';
import { AnnouncementLog } from '@ui/announcements';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { cutOff } from '@ui/shut-in';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, keymap, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

const starving = (id: EntityId, need: 'hunger' | 'thirst'): GameEvent => ({ type: 'Starving', id, need } as GameEvent);

describe('T-745 the day\'s Starving line names the need', () => {
  function log(seed: string) {
    const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const names = ['Asa Forgehall', 'Njal Coppervein', 'Liv Ashbeard'];
    const ids = names.map((name, k) => w.spawnDwarf({ at: w.index(10 + k, 10, z), name }));
    const l = new AnnouncementLog(strings, w.game.registry);
    l.register(w.game.world.registrations.announcements);
    return { w, ids, l, texts: () => l.lines.map((line) => line.text) };
  }

  it('reads "dying of thirst" for one dwarf and for three, with its own keys', () => {
    const f = log('t745-thirst-line');
    const day = 3 * TICKS_PER_DAY;
    f.l.announce(starving(f.ids[0] as EntityId, 'thirst'), f.w.readers, day);
    expect(f.texts()).toEqual(['Asa Forgehall is dying of thirst.']);
    expect(f.l.lines[0]?.key).toBe('announce.thirsting');
    f.l.announce(starving(f.ids[1] as EntityId, 'thirst'), f.w.readers, day + 1);
    f.l.announce(starving(f.ids[2] as EntityId, 'thirst'), f.w.readers, day + 2);
    expect(f.texts()).toEqual(['3 dwarves are dying of thirst: Asa, Njal, Liv.']);
    expect(f.l.lines[0]?.key).toBe('announce.thirsting_many');
  });

  it('a day of hunger reads as before, and a day of both makes two lines, one for each need', () => {
    const f = log('t745-both-lines');
    const day = 3 * TICKS_PER_DAY;
    f.l.announce(starving(f.ids[0] as EntityId, 'hunger'), f.w.readers, day);
    f.l.announce(starving(f.ids[1] as EntityId, 'thirst'), f.w.readers, day + 1);
    f.l.announce(starving(f.ids[2] as EntityId, 'hunger'), f.w.readers, day + 2);
    expect(f.texts()).toEqual(['2 dwarves are starving: Asa, Liv.', 'Njal Coppervein is dying of thirst.']);
    expect(f.l.lines.map((line) => line.key)).toEqual(['announce.starving_many', 'announce.thirsting']);
    // The next day starts new lines.
    f.l.announce(starving(f.ids[1] as EntityId, 'hunger'), f.w.readers, day + TICKS_PER_DAY);
    expect(f.texts()[2]).toBe('Njal Coppervein is starving.');
  });
});

/**
 * A wall across the map with a `lock_on_alert` door at (40, 20); north of it indoor tiles and a
 * hearth, whose hall the civilians shelter in, south the open surface. Two dwarves stand south of
 * the wall, and a barrel of ale stands outside (or inside) the hall's room.
 */
function shelter(seed: string, drinkInside: boolean) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, z), TileKind.Wall, granite);
  for (let y = 14; y < 20; y += 1) for (let x = 34; x < 47; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, z), TileFlag.Outdoor, false);
  const door = w.build('door', w.index(40, 20, z), 'oak');
  w.build('hearth', w.index(40, 16, z), 'granite');
  expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
  const dwarves = [0, 1].map((k) => w.spawnDwarf({ at: w.index(38 + k, 24, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` }));
  for (const id of dwarves) { w.setNeed(id, 'thirst', 0); w.setNeed(id, 'hunger', 0); }
  const barrelAt: TileIndex = drinkInside ? w.index(44, 16, z) : w.index(46, 26, z);
  const barrel = w.spawnItem('barrel', 'oak', barrelAt);
  w.spawnItem('drink', 'ale', { containerId: barrel }, 20);

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
  const sidebar = (): string => draw().lines().map((l) => l.split('│')[1] ?? '').join(' ').replace(/\s+/g, ' ');
  const shutIn = () => screen.log.lines.filter((line) => line.key === 'announce.shut_in.thirst');
  const shutInLines = (): string[] => shutIn().map((line) => line.text);
  const timesSaid = (): number => shutIn().reduce((n, line) => n + line.count, 0);
  const alert = (level: 'calm' | 'hearth'): void => { expect(w.game.world.applyCommand({ type: 'SetAlert', level }).ok).toBe(true); };
  const locked = (): boolean => w.readers.of<BuildingsReader>('14').mechanismState(door) === 'locked';
  const thirsty = (value: number): void => { for (const id of dwarves) w.setNeed(id, 'thirst', value); };
  return { w, door, dwarves, screen, draw, sidebar, shutInLines, timesSaid, alert, locked, thirsty };
}

const LINE = 'The drink is outside the locked doors: 2 dwarves are thirsty. [m] [1] opens them; drink kept inside the hall, or a well, keeps them drinking.';
const PANEL = 'Thirsty: 2 cannot reach drink behind the locked doors.';

describe('T-745 sheltering dwarves locked away from their drink', () => {
  it('get the shut-in line once and the Military panel line; both go with the alert, and a new alert brings the line back', () => {
    const f = shelter('t745-outside', false);
    f.alert('hearth');
    f.w.until(() => f.locked(), ALERT_LOCK_GRACE_TICKS + 2 * TICKS_PER_HOUR);
    expect(f.locked()).toBe(true);
    f.w.step(TICKS_PER_HOUR);
    for (const id of f.dwarves) expect(f.w.game.world.entities.get(id, C.Position)?.y, 'sheltering north of the wall').toBeLessThan(20);
    expect(f.shutInLines()).toEqual([]);
    f.thirsty(84);
    f.w.until(() => f.shutInLines().length > 0, 6 * TICKS_PER_HOUR);
    expect(f.shutInLines()).toEqual([LINE]);
    expect(cutOff(f.w.readers, 'thirst')).toEqual([...f.dwarves].sort((a, b) => a - b));
    const s = f.draw();
    expect(f.sidebar()).toContain(PANEL);
    const row = s.lines().findIndex((l) => l.includes('Thirsty:'));
    expect(fgOfText(s, row, 'Thirsty:')).toBe(hexOf(theme.alert));
    // Once per alert: a day more of thirst says it no more.
    f.w.step(TICKS_PER_DAY / 2);
    expect(f.timesSaid()).toBe(1);
    // The alert lowered: the doors open, the panel line goes and the dwarves drink.
    f.alert('calm');
    f.w.step(1);
    expect(f.sidebar()).not.toContain('Thirsty:');
    f.w.until(() => f.dwarves.every((id) => (f.w.game.world.entities.get(id, C.Needs)?.thirst ?? 100) < 50), TICKS_PER_DAY / 2);
    // Raised again with the dwarves rested and back in the hall: once the doors lock and the thirst
    // comes back, so does the line.
    f.dwarves.forEach((id, k) => {
      f.w.setNeed(id, 'rest', 0);
      expect(f.w.game.movement.teleport(id, f.w.index(39 + 2 * k, 17, z))).toBe(true);
    });
    f.alert('hearth');
    f.w.until(() => f.locked(), ALERT_LOCK_GRACE_TICKS + 2 * TICKS_PER_HOUR);
    f.w.step(TICKS_PER_HOUR);
    f.thirsty(84);
    f.w.until(() => f.timesSaid() > 1, 6 * TICKS_PER_HOUR);
    // The same day, the log merges it into the first line with a count (24 § Announcements and the log).
    expect(f.shutInLines()).toEqual([LINE]);
    expect(f.timesSaid()).toBe(2);
  });

  it('with the barrel inside the hall, neither the line nor the panel line shows', () => {
    const f = shelter('t745-inside', true);
    f.alert('hearth');
    f.w.until(() => f.locked(), ALERT_LOCK_GRACE_TICKS + 2 * TICKS_PER_HOUR);
    f.w.step(TICKS_PER_HOUR);
    f.thirsty(84);
    for (let hour = 0; hour < 6; hour += 1) {
      f.w.step(TICKS_PER_HOUR);
      expect(f.sidebar()).not.toContain('Thirsty:');
    }
    expect(f.shutInLines()).toEqual([]);
    expect(f.w.events('DrankAlcohol').length).toBeGreaterThan(0);
  });

  it('under Calm, neither shows', () => {
    const f = shelter('t745-calm', false);
    f.thirsty(84);
    f.w.step(6 * TICKS_PER_HOUR);
    expect(f.shutInLines()).toEqual([]);
    expect(f.sidebar()).not.toContain('Thirsty:');
  });
});
