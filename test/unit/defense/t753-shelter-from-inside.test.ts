/**
 * T-753: a civilian already standing in the only room behind a door, with no hearth hall, found no
 * shelter (its search left by the door into the open and never came back) and worked as one with no
 * shelter while its fellows walked in past it. A dwarf on the indoor side of a door shelters where
 * it stands (19 § Hearth alert retreat, step 2).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import { ALERT_LOCK_GRACE_TICKS } from '@systems/defense/constants';
import type { DwarvesReader } from '@systems/dwarves';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from '../ui/ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

/**
 * A wall across the map with a `lock_on_alert` door at (40, 20); north of it a room of indoor tiles
 * (34..46, 14..19) whose only door is that one, and no hearth. Two dwarves stand in the room, one
 * at the door's outside in the open (with no hearth, 14 holds the door for a dwarf on that tile).
 */
function room(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  const terrain = w.game.world.services.terrain;
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) terrain.setKind(w.index(x, 20, z), TileKind.Wall, granite);
  for (let y = 14; y < 20; y += 1) for (let x = 34; x < 47; x += 1) terrain.setFlag(w.index(x, y, z), TileFlag.Outdoor, false);
  const door = w.build('door', w.index(40, 20, z), 'oak');
  expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' }).ok).toBe(true);
  const inside = [w.spawnDwarf({ at: w.index(37, 16, z), name: 'Asa Inside' }), w.spawnDwarf({ at: w.index(44, 17, z), name: 'Njal Inside' })];
  const outside = w.spawnDwarf({ at: w.index(40, 21, z), name: 'Liv Outside' });
  for (const id of [...inside, outside]) { w.setNeed(id, 'thirst', 0); w.setNeed(id, 'hunger', 0); w.setNeed(id, 'rest', 0); }
  return { w, door, inside, outside };
}

const retreatOf = (w: TestWorld, id: EntityId): number => w.readers.of<{ retreatTile(id: EntityId): number }>('19').retreatTile(id);
const tileOf = (w: TestWorld, id: EntityId): number => {
  const p = w.game.world.entities.get(id, C.Position);
  return p === undefined ? -1 : w.index(p.x, p.y, p.z);
};

describe('T-753 a civilian already inside the only room behind a door shelters there', () => {
  it('shelters where it stands under Hearth, is not one of the unsheltered, and the panel says no one is without shelter', () => {
    const f = room('t753-inside');
    const starts = f.inside.map((id) => tileOf(f.w, id));
    expect(f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    f.w.step(1);
    f.inside.forEach((id, k) => expect(retreatOf(f.w, id), 'its own tile').toBe(starts[k]));
    // The one outside walks in through the door, as before.
    const outsideShelter = retreatOf(f.w, f.outside);
    expect(f.w.map.yOf(outsideShelter)).toBeLessThan(20);
    expect(f.w.readers.of<DwarvesReader>('10').unsheltered()).toEqual([]);

    const locked = (): boolean => f.w.readers.of<BuildingsReader>('14').mechanismState(f.door) === 'locked';
    f.w.until(locked, ALERT_LOCK_GRACE_TICKS + 2 * TICKS_PER_HOUR);
    expect(locked()).toBe(true);
    f.w.step(TICKS_PER_HOUR);
    for (const id of [...f.inside, f.outside]) {
      expect(f.w.game.world.entities.get(id, C.Position)?.y, 'sheltering north of the wall').toBeLessThan(20);
    }
    expect(f.w.readers.of<DwarvesReader>('10').unsheltered()).toEqual([]);
    // The fixed tile holds: still each one's own first tile.
    f.inside.forEach((id, k) => expect(retreatOf(f.w, id)).toBe(starts[k]));

    // The Military panel's no-shelter line does not count them.
    const layout = computeLayout(80, 42, true);
    const host: FortressHost = {
      readers: f.w.readers, registry: f.w.game.registry, ui: defaultUiState(z), submit: (c) => f.w.submit(c),
      speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => layout, precondition: () => false,
      registeredPanels: () => f.w.game.world.registrations.panels, announcements: () => f.w.game.world.registrations.announcements, now: () => 0,
      prompt: () => {}, laborManager: () => {},
    };
    const screen = new FortressScreen(host, keymap, strings);
    screen.openPanel('military');
    const s = surface(80, 42);
    screen.draw(s);
    expect(s.lines().join('\n')).not.toContain('No shelter');
  });

  it('a dwarf in the open with no door anywhere still has no shelter', () => {
    const w = new TestWorld({ seed: 't753-open', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const granite = w.game.registry.table('materials').index('granite');
    // Indoor tiles with no door: a roof, not a room behind a door.
    for (let y = 14; y < 20; y += 1) for (let x = 34; x < 47; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, z), TileFlag.Outdoor, false);
    w.game.world.services.terrain.setKind(w.index(30, 30, z), TileKind.Wall, granite);
    const id = w.spawnDwarf({ at: w.index(40, 16, z), name: 'Asa Roofed' });
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(1);
    expect(retreatOf(w, id)).toBe(-1);
    expect(w.readers.of<DwarvesReader>('10').unsheltered()).toEqual([id]);
  });
});
