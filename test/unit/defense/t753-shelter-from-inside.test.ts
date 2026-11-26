/**
 * T-753: a civilian already standing in the only room behind a door, with no hearth hall, found no
 * shelter (its search left by the door into the open and never came back) and worked as one with no
 * shelter, while its fellows outside walked in past it. A dwarf in a room the alert shuts (every door
 * around it `lock_on_alert` or `locked`, no open way out) shelters where it stands (19 § Hearth alert
 * retreat, step 2); a room with a door that never locks, or an open side, is no shelter.
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
 * A wall across the map at y = 20 with a door at (40, 20); north of it a walled room of indoor tiles
 * (34..46, 14..19) whose only door is that one, and no hearth. Two dwarves stand in the room and one
 * on the door's doorstep in the open. `gap` leaves one tile of the room's west wall open.
 */
function room(seed: string, mode: string, gap = false) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  const terrain = w.game.world.services.terrain;
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) terrain.setKind(w.index(x, 20, z), TileKind.Wall, granite);
  for (let x = 33; x <= 47; x += 1) terrain.setKind(w.index(x, 13, z), TileKind.Wall, granite);
  for (let y = 14; y < 20; y += 1) {
    if (!(gap && y === 16)) terrain.setKind(w.index(33, y, z), TileKind.Wall, granite);
    terrain.setKind(w.index(47, y, z), TileKind.Wall, granite);
  }
  for (let y = 14; y < 20; y += 1) for (let x = 34; x < 47; x += 1) terrain.setFlag(w.index(x, y, z), TileFlag.Outdoor, false);
  const door = w.build('door', w.index(40, 20, z), 'oak');
  if (mode !== 'open') expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode }).ok).toBe(true);
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
const sorted = (ids: readonly EntityId[]): EntityId[] => [...ids].sort((a, b) => a - b);

function militarySidebar(w: TestWorld): string {
  const layout = computeLayout(80, 42, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c),
    speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  screen.openPanel('military');
  const s = surface(80, 42);
  screen.draw(s);
  return s.lines().map((l) => l.split('│')[1] ?? '').join(' ').replace(/\s+/g, ' ');
}

describe('T-753 a civilian already inside a room the alert shuts shelters where it stands', () => {
  it('behind a lock_on_alert door: each shelters on its own tile, none is unsheltered, and the panel has no No-shelter line', () => {
    const f = room('t753-inside', 'lock_on_alert');
    const starts = f.inside.map((id) => tileOf(f.w, id));
    expect(f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    f.w.step(1);
    f.inside.forEach((id, k) => expect(retreatOf(f.w, id), 'its own tile').toBe(starts[k]));
    // The one outside walks in through the door, as before.
    expect(f.w.map.yOf(retreatOf(f.w, f.outside))).toBeLessThan(20);
    expect(f.w.readers.of<DwarvesReader>('10').unsheltered()).toEqual([]);

    const locked = (): boolean => f.w.readers.of<BuildingsReader>('14').mechanismState(f.door) === 'locked';
    f.w.until(locked, ALERT_LOCK_GRACE_TICKS + 2 * TICKS_PER_HOUR);
    expect(locked()).toBe(true);
    f.w.step(TICKS_PER_HOUR);
    for (const id of [...f.inside, f.outside]) {
      expect(f.w.game.world.entities.get(id, C.Position)?.y, 'sheltering north of the wall').toBeLessThan(20);
    }
    expect(f.w.readers.of<DwarvesReader>('10').unsheltered()).toEqual([]);
    // The fixed tile holds.
    f.inside.forEach((id, k) => expect(retreatOf(f.w, id)).toBe(starts[k]));
    expect(militarySidebar(f.w)).not.toContain('No shelter');
  });

  it('behind a door locked by hand: they shelter where they stand', () => {
    const f = room('t753-locked', 'locked');
    const starts = f.inside.map((id) => tileOf(f.w, id));
    expect(f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    f.w.step(1);
    f.inside.forEach((id, k) => expect(retreatOf(f.w, id)).toBe(starts[k]));
  });

  it('behind a door that never locks: no shelter, and the Military panel counts them', () => {
    const f = room('t753-open-door', 'open');
    expect(f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    f.w.step(1);
    for (const id of f.inside) expect(retreatOf(f.w, id), 'no shelter tile').toBe(-1);
    expect(sorted(f.w.readers.of<DwarvesReader>('10').unsheltered())).toEqual(sorted(f.inside));
    expect(militarySidebar(f.w)).toContain('No shelter: 2 dwarves keep working');
  });

  it('in a room with an open side: no shelter, though its door locks on the alert', () => {
    const f = room('t753-gap', 'lock_on_alert', true);
    expect(f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    f.w.step(1);
    for (const id of f.inside) expect(retreatOf(f.w, id)).toBe(-1);
    expect(sorted(f.w.readers.of<DwarvesReader>('10').unsheltered())).toEqual(sorted(f.inside));
  });

  it('a dwarf under a roof with no door anywhere has no shelter', () => {
    const w = new TestWorld({ seed: 't753-roof', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    for (let y = 14; y < 20; y += 1) for (let x = 34; x < 47; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, z), TileFlag.Outdoor, false);
    const id = w.spawnDwarf({ at: w.index(40, 16, z), name: 'Asa Roofed' });
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(1);
    expect(retreatOf(w, id)).toBe(-1);
    expect(w.readers.of<DwarvesReader>('10').unsheltered()).toEqual([id]);
  });
});
