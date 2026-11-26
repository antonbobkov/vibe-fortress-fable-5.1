/**
 * T-780: since the Hearth alert's lock holds through Watch (14 § Doors and hatches), civilians who
 * work under Watch on the inner side of the locked doors can reach critical thirst with the drink
 * outside. The shut-in line and the Military panel's Thirsty line say so under Watch as under
 * Hearth (24 § Announcements and the log, Shut in; `ui-screens/panels.md` § Military).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import { ALERT_LOCK_GRACE_TICKS } from '@systems/defense/constants';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { cutOff } from '@ui/shut-in';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

/**
 * T-745's fortress: a wall across the map with a `lock_on_alert` door at (40, 20), indoor tiles and a
 * hearth north of it, two dwarves south of it and a barrel of ale outside, south of the wall.
 */
function shelter(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, z), TileKind.Wall, granite);
  for (let y = 14; y < 20; y += 1) for (let x = 34; x < 47; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, z), TileFlag.Outdoor, false);
  const door = w.build('door', w.index(40, 20, z), 'oak');
  w.build('hearth', w.index(40, 16, z), 'granite');
  expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
  const dwarves = [0, 1].map((k) => w.spawnDwarf({ at: w.index(38 + k, 24, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` }));
  for (const id of dwarves) { w.setNeed(id, 'thirst', 0); w.setNeed(id, 'hunger', 0); }
  const barrel = w.spawnItem('barrel', 'oak', w.index(46, 26, z));
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
  const sidebar = (): string => { const s = surface(80, 42); screen.draw(s); return s.lines().map((l) => l.split('│')[1] ?? '').join(' ').replace(/\s+/g, ' '); };
  const shutIn = () => screen.log.lines.filter((line) => line.key === 'announce.shut_in.thirst');
  const shutInLines = (): string[] => shutIn().map((line) => line.text);
  const timesSaid = (): number => shutIn().reduce((n, line) => n + line.count, 0);
  const alert = (level: 'calm' | 'watchful' | 'hearth'): void => {
    expect(w.game.world.applyCommand({ type: 'SetAlert', level }).ok).toBe(true);
    w.step(2);
  };
  const locked = (): boolean => w.readers.of<BuildingsReader>('14').mechanismState(door) === 'locked';
  const thirsty = (value: number): void => { for (const id of dwarves) w.setNeed(id, 'thirst', value); };
  return { w, dwarves, sidebar, shutInLines, timesSaid, alert, locked, thirsty };
}

const LINE = 'The drink is outside the locked doors: 2 dwarves are thirsty. [m] [1] opens them; drink kept inside the hall, or a well, keeps them drinking.';
const PANEL = 'Thirsty: 2 cannot reach drink behind the locked doors.';

describe('T-780 under Watch with the Hearth lock still held, civilians cut off from drink', () => {
  it('get the shut-in line once and the Military panel line; at Calm the panel line goes and they drink', () => {
    const f = shelter('t780-watch-held');
    f.alert('hearth');
    f.w.until(() => f.locked(), ALERT_LOCK_GRACE_TICKS + 2 * TICKS_PER_HOUR);
    f.w.step(TICKS_PER_HOUR);
    for (const id of f.dwarves) expect(f.w.game.world.entities.get(id, C.Position)?.y, 'sheltering north of the wall').toBeLessThan(20);
    f.alert('watchful');
    expect(f.locked(), 'the Hearth lock holds under Watch').toBe(true);
    expect(f.sidebar()).toContain('Lock on alert doors stay locked until Calm [1].');
    expect(f.shutInLines()).toEqual([]);
    f.thirsty(84);
    f.w.until(() => f.shutInLines().length > 0, 6 * TICKS_PER_HOUR);
    expect(f.shutInLines()).toEqual([LINE]);
    expect(cutOff(f.w.readers, 'thirst')).toEqual([...f.dwarves].sort((a, b) => a - b));
    for (const id of f.dwarves) expect(f.w.game.world.entities.get(id, C.Brain)?.behavior, 'they work, nobody retreats').not.toBe('retreat');
    expect(f.sidebar()).toContain(PANEL);
    // Once per alert.
    f.w.step(TICKS_PER_DAY / 2);
    expect(f.timesSaid()).toBe(1);
    // Calm opens the doors: the panel line goes and the dwarves drink.
    f.alert('calm');
    expect(f.locked()).toBe(false);
    expect(f.sidebar()).not.toContain('Thirsty:');
    expect(cutOff(f.w.readers, 'thirst')).toEqual([]);
    f.w.until(() => f.dwarves.every((id) => (f.w.game.world.entities.get(id, C.Needs)?.thirst ?? 100) < 50), TICKS_PER_DAY / 2);
    expect(f.timesSaid()).toBe(1);
  });

  it('with no lock held (Calm to Watch), neither shows', () => {
    const f = shelter('t780-watch-open');
    f.alert('watchful');
    expect(f.locked()).toBe(false);
    f.thirsty(84);
    for (let hour = 0; hour < 6; hour += 1) {
      f.w.step(TICKS_PER_HOUR);
      expect(f.sidebar()).not.toContain('Thirsty:');
    }
    expect(f.shutInLines()).toEqual([]);
  });
});
