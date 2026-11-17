/**
 * T-558, Making Do C2: glass walls, glass floors and skylights (`03` § Outdoor and lit, `05` §
 * Temperature model, `07` § Under a skylight, `14` § Glass, `16` § Ranged resolution, `22` § Line
 * of sight, `23` § Terrain). The greenhouse itself is the scenario `pl_greenhouse`.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { loadContent } from '@content/loader';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import { Compositor } from '@render/compositor';
import { Palette } from '@render/palette';
import type { MaterialsReader } from '@systems/materials';
import { HintEngine } from '@ui/hints';
import { defaultUiState } from '@ui/ui-state';
import { AnnouncementLog } from '@ui/announcements';
import { Strings } from '@ui/strings';
import { TestWorld } from '../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none' });
}

function flags(w: TestWorld, i: TileIndex): { outdoor: boolean; skylit: boolean; lit: boolean } {
  return { outdoor: w.map.hasFlag(i, TileFlag.Outdoor), skylit: w.map.hasFlag(i, TileFlag.Skylit), lit: w.map.hasFlag(i, TileFlag.Lit) };
}

/** Dig a soil room one level down and discover it. */
function room(w: TestWorld, x: number, y: number, width: number, height: number, z = Z - 1): void {
  w.digRoom(x, y, z, width, height);
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) w.discover(w.index(x + dx, y + dy, z));
}

describe('T-558 skylights', () => {
  it('a glass floor lights the column under it, down to the first other solid tile; stone does not', () => {
    const w = world('t558-column');
    // Two open levels under the surface, a floor below them.
    const x = 30;
    const y = 30;
    w.digRoom(x, y, Z - 3, 1, 1);
    w.carve(w.index(x, y, Z - 2), TileKind.Open);
    w.carve(w.index(x, y, Z - 1), TileKind.Open);
    for (let z = Z - 3; z < Z; z += 1) w.discover(w.index(x, y, z));
    const top = w.index(x, y, Z);
    w.step(1);
    for (let z = Z - 3; z < Z; z += 1) expect(flags(w, w.index(x, y, z))).toEqual({ outdoor: false, skylit: false, lit: false });

    w.build('floor', top, 'glass');
    w.step(1);
    expect(flags(w, top)).toEqual({ outdoor: true, skylit: false, lit: true });
    for (let z = Z - 3; z < Z; z += 1) expect(flags(w, w.index(x, y, z)), `z ${z}`).toEqual({ outdoor: false, skylit: true, lit: true });
    // The solid tile under the lit floor is not reached.
    expect(flags(w, w.index(x, y, Z - 4)).skylit).toBe(false);

    // A second glass floor in a column keeps the light going; a granite one stops it under itself.
    const column = (x2: number, material: string): void => {
      w.digRoom(x2, y, Z - 3, 1, 1);
      w.carve(w.index(x2, y, Z - 2), TileKind.Open);
      w.carve(w.index(x2, y, Z - 1), TileKind.Open);
      for (let z = Z - 3; z < Z; z += 1) w.discover(w.index(x2, y, z));
      w.build('floor', w.index(x2, y, Z - 1), material);
      w.build('floor', w.index(x2, y, Z), 'glass');
    };
    column(x + 2, 'glass');
    column(x + 4, 'granite');
    w.step(1);
    expect(flags(w, w.index(x + 2, y, Z - 3)).skylit).toBe(true);
    expect(flags(w, w.index(x + 4, y, Z - 1)).skylit).toBe(true);
    expect(flags(w, w.index(x + 4, y, Z - 2))).toEqual({ outdoor: false, skylit: false, lit: false });
    expect(flags(w, w.index(x + 4, y, Z - 3)).skylit).toBe(false);

    // The flag is a map flag: it is saved with the grid and survives a round trip.
    const loaded = roundTrip(w.game).game;
    expect(loaded.world.map.hasFlag(w.index(x + 2, y, Z - 3), TileFlag.Skylit)).toBe(true);
  });

  it('a skylit tile is covered: it takes the near-surface blend, not the surface temperature', () => {
    const w = world('t558-temperature');
    room(w, 40, 40, 3, 1);
    const plot = w.index(40, 40, Z - 1);
    const materials = w.readers.of<MaterialsReader>('05');
    w.build('floor', w.index(40, 40, Z), 'glass');
    w.step(1);
    expect(flags(w, plot)).toEqual({ outdoor: false, skylit: true, lit: true });
    const surface = materials.temperatureAt(w.index(45, 45, Z));
    // One level down: surface + (10 − surface) / 3, truncated (05 § Temperature model).
    expect(materials.temperatureAt(plot)).toBe(surface + Math.trunc((10 - surface) / 3));
  });

  it('a cave mouth keeps its temperature: a lit tile that is not skylit still takes the surface', () => {
    const w = world('t558-cave-mouth');
    // A room dug into the hillside one level down, opened to the sky beside it.
    room(w, 50, 50, 4, 1);
    const terrain = w.game.terrain!.core;
    const soil = w.map.materialAt(w.index(49, 50, Z - 1));
    terrain.setKind(w.index(49, 50, Z), TileKind.Open, 0);
    terrain.setKind(w.index(49, 50, Z - 1), TileKind.Open, 0);
    terrain.setKind(w.index(49, 50, Z - 2), TileKind.Floor, soil);
    w.step(1);
    const mouth = w.index(50, 50, Z - 1);
    expect(flags(w, mouth)).toEqual({ outdoor: false, skylit: false, lit: true });
    const materials = w.readers.of<MaterialsReader>('05');
    expect(materials.temperatureAt(mouth)).toBe(materials.temperatureAt(w.index(45, 45, Z)));
  });

  it('daylight spreads through a glass wall into the hall behind it, and not through granite', () => {
    const lit = (wall: string): boolean => {
      const w = world(`t558-spread-${wall}`);
      // A covered corridor one level down whose west end opens on an outdoor pit.
      room(w, 60, 60, 4, 1);
      w.game.terrain!.core.setKind(w.index(59, 60, Z), TileKind.Open, 0);
      w.carve(w.index(59, 60, Z - 1), TileKind.Open);
      w.discover(w.index(59, 60, Z - 1));
      w.build('wall', w.index(60, 60, Z - 1), wall);
      w.step(1);
      expect(w.map.hasFlag(w.index(60, 60, Z - 1), TileFlag.Lit)).toBe(false);
      return w.map.hasFlag(w.index(61, 60, Z - 1), TileFlag.Lit);
    };
    expect(lit('glass')).toBe(true);
    expect(lit('granite')).toBe(false);
  });
});

describe('T-558 glass walls: sight but not fire', () => {
  it('22 sees through a glass wall and does not fire through it; a granite wall blocks both', () => {
    const w = world('t558-lines');
    const a = w.index(20, 20, Z);
    const b = w.index(26, 20, Z);
    w.build('wall', w.index(23, 20, Z), 'glass');
    expect(w.readers.pathing.lineOfSight(a, b)).toBe(true);
    expect(w.readers.pathing.lineOfFire(a, b)).toBe(false);
    const combat = w.game.world.services.combat!;
    expect(combat.lineOfSight(a, b)).toBe(true);
    expect(combat.lineOfFire(a, b)).toBe(false);
    expect(w.readers.pathing.passable(w.index(23, 20, Z), 'walker')).toBe(false);
    w.build('wall', w.index(23, 21, Z), 'granite');
    const c = w.index(26, 21, Z);
    expect(w.readers.pathing.lineOfSight(w.index(20, 21, Z), c)).toBe(false);
    expect(combat.lineOfSight(w.index(20, 21, Z), c)).toBe(false);
  });

  it('an archer behind a glass wall sees the hall and does not shoot; without the wall it shoots', () => {
    const shots = (glass: boolean): { fired: number; target: number; held: number } => {
      const w = world(`t558-archer-${glass}`);
      const at = w.index(36, 8, Z);
      if (glass) {
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          if (dx !== 0 || dy !== 0) w.build('wall', w.index(36 + dx, 8 + dy, Z), 'glass');
        }
      }
      const archer = w.spawnCreature('gloam_archer', at, 'hostile:gloam');
      const target = w.spawnCreature('dwarf', w.index(36, 2, Z), 'fortress');
      const bow = w.spawnItem('bow', 'oak', at);
      w.game.world.services.items!.attachToCarrier(bow, archer);
      w.game.world.entities.add(archer, C.Equipment, {
        weapon: bow, shield: 0, quiver: 0,
        armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
        clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      });
      w.game.world.services.items!.attachToCarrier(w.spawnItem('arrow', 'iron', at, 30), archer);
      const combat = w.game.world.services.combat!;
      expect(combat.lineOfSight(at, w.index(36, 2, Z))).toBe(true);
      combat.setTarget(archer, target);
      w.step(60);
      return { fired: w.events('ProjectileFired').length, target: combat.targetOf(archer), held: target };
    };
    const open = shots(false);
    expect(open.fired).toBeGreaterThan(0);
    const behind = shots(true);
    expect(behind.fired).toBe(0);
    // It still holds the dwarf it sees.
    expect(behind.target).toBe(behind.held);
  });
});

describe('T-558 glass floors', () => {
  it('a glass floor over magma is magma-safe; an oak one is not', () => {
    const w = new TestWorld({ seed: 't558-magma', world: 'flat-test', embark: 'none', startTick: 10 * 50 });
    const over = w.index(70, 70, Z);
    const below = w.index(70, 70, Z - 1);
    w.carve(below, TileKind.Open);
    w.discover(below);
    w.setFluid(below, 7, 'magma', true);
    const place = (material: string) => w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'floor', origin: over, orientation: 0, materialChoice: material });
    expect(place('oak')).toEqual({ ok: false, reason: 'not_magma_safe' });
    w.build('floor', over, 'glass');
    expect(w.map.isGlassAt(over)).toBe(true);
    w.step(1);
    expect(w.map.hasFlag(below, TileFlag.Skylit)).toBe(true);
    // 23 draws it `+` in glass_pale over the magma, which shows through.
    const registry = loadContent();
    const palette = new Palette(registry);
    const compositor = new Compositor({ registry, palette });
    const view = { camX: 70, camY: 70, z: Z, sidebarOpen: false, cursor: null, animFrame: 0 };
    const cell = compositor.compose(w.readers, view, 3, 8).get(0, 0);
    expect(cell.fg).toBe(palette.color('glass_pale'));
    expect(cell.bg).not.toBe(palette.color('black'));
  });

  it('the first glass floor built over open space raises hint_skylight', () => {
    const w = world('t558-hint');
    room(w, 80, 80, 1, 1);
    const registry = w.game.registry;
    const ui = defaultUiState(32);
    const hints = new HintEngine(registry, ui, new AnnouncementLog(new Strings(registry), registry));
    w.build('floor', w.index(81, 81, Z), 'glass');
    w.step(1);
    hints.onEvents(w.events('BuildingCompleted'), w.readers);
    expect(ui.hintPending).not.toContain('hint_skylight');
    w.build('floor', w.index(80, 80, Z), 'glass');
    w.step(1);
    hints.onEvents(w.events('BuildingCompleted'), w.readers);
    expect(ui.hintPending).toContain('hint_skylight');
  });
});
