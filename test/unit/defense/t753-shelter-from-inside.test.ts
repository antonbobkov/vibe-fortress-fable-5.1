/**
 * T-753 (open): a civilian already standing in the only room behind a door, with no hearth hall,
 * finds no shelter (its search leaves by the door into the open and never comes back) and works as
 * one with no shelter, while its fellows outside walk in past it. A shelter-in-place rule was tried
 * and taken back out, as it cost the sweep (docs/work/T-753-shelter-from-inside.md § Tried); these
 * tests pin today's behaviour (19 § Hearth alert retreat, step 2) until a narrower rule lands.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { DwarvesReader } from '@systems/dwarves';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from '../ui/ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

/**
 * A wall across the map with a `lock_on_alert` door at (40, 20); north of it a room of indoor tiles
 * (34..46, 14..19) whose only door is that one, and no hearth. Two dwarves stand in the room, one
 * at the door's outside in the open.
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
const sorted = (ids: readonly EntityId[]): EntityId[] => [...ids].sort((a, b) => a - b);

describe('T-753 (today) a civilian already inside a room whose only door leads outdoors has no shelter', () => {
  it('is one of the unsheltered under Hearth and the Military panel counts it, while the one outside gets a tile behind the door', () => {
    const f = room('t753-inside');
    expect(f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    f.w.step(1);
    for (const id of f.inside) expect(retreatOf(f.w, id), 'no shelter tile').toBe(-1);
    expect(f.w.map.yOf(retreatOf(f.w, f.outside))).toBeLessThan(20);
    expect(sorted(f.w.readers.of<DwarvesReader>('10').unsheltered())).toEqual(sorted(f.inside));

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
    const sidebar = s.lines().map((l) => l.split('│')[1] ?? '').join(' ').replace(/\s+/g, ' ');
    expect(sidebar).toContain('No shelter: 2 dwarves keep working');
  });

  it('a dwarf under a roof with no door anywhere has no shelter either', () => {
    const w = new TestWorld({ seed: 't753-open', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    for (let y = 14; y < 20; y += 1) for (let x = 34; x < 47; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, z), TileFlag.Outdoor, false);
    const id = w.spawnDwarf({ at: w.index(40, 16, z), name: 'Asa Roofed' });
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(1);
    expect(retreatOf(w, id)).toBe(-1);
    expect(w.readers.of<DwarvesReader>('10').unsheltered()).toEqual([id]);
  });
});
