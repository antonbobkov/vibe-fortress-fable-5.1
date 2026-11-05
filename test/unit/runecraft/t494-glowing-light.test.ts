/**
 * T-494: a piece enchanted `glowing` lights its wearer's 3×3 for a `glow` crop, as a lamp does
 * (`07-plants-and-farming.md` § Growth `lightOk`, `25-runecraft.md` § Enchantments in combat `light`).
 * The light moves with the wearer; it is not a lamp, so the `lit` flag, lamp coverage and the plot's
 * kind stay as they were. With no glowing wearer nothing is looked up: the goldens, the six T-470
 * no-channel digests and the annual instrument pin that.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Equipment, type Position } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { EnchantDef } from '@content/generate';
import type { BuildingsReader } from '@systems/buildings';
import { wornLightAt } from '@systems/magic/enchant';
import type { PlantsReader } from '@systems/plants';
import { loadContent } from '@content/loader';
import { Compositor } from '@render/compositor';
import { Palette } from '@render/palette';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const enchants = registry.table<EnchantDef>('enchants');
const hour = 50;

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

/** A breastplate of `enchant` worn by `id`. */
function wearBreastplate(w: TestWorld, id: EntityId, enchant: string): EntityId {
  const ent = w.game.world.entities;
  const at = w.spatial.tileOf(id);
  const piece = w.spawnItem('breastplate', 'iron', at, 1, 1);
  ent.add(piece, C.Item, { ...ent.get(piece, C.Item)!, enchant: { id: enchants.index(enchant), tier: 1 } });
  const old = ent.get(id, C.Equipment);
  const eq: Equipment = {
    weapon: 0, shield: 0,
    armor: { head: 0, body: piece, arms: 0, legs: 0, feet: 0 },
    clothing: old?.clothing ?? { body: 0, legs: 0, feet: 0, over: 0 }, quiver: old?.quiver ?? 0,
  };
  w.game.world.services.items?.attachToCarrier(piece, id);
  w.game.world.services.items?.setOwner(piece, id);
  ent.add(id, C.Equipment, eq);
  return piece;
}

/** Move a creature at once, keeping the spatial index in step. */
function teleport(w: TestWorld, id: EntityId, to: TileIndex): void {
  const ent = w.game.world.entities;
  const from = w.spatial.tileOf(id);
  const pos = ent.get<Position>(id, C.Position)!;
  ent.add(id, C.Position, { ...pos, x: w.map.xOf(to), y: w.map.yOf(to), z: w.map.zOf(to) });
  w.spatial.move(id, from, to);
}

function lightAt(w: TestWorld, x: number, y: number, z = Z): boolean {
  return wornLightAt(w.map, (i) => w.readers.entities.at(i), w.game.world.entities, registry, w.index(x, y, z));
}

function growth(w: TestWorld, crop: EntityId): number {
  return w.game.world.entities.get(crop, C.Crop)?.growth ?? -1;
}

/** A dark 2×1 floor pocket walled in, at (x, y) and (x + 1, y), so a dwarf in it stays beside its crop. */
function pocket(w: TestWorld, x: number, y: number): [TileIndex, TileIndex] {
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 2; dx += 1) {
    if (dy === 0 && (dx === 0 || dx === 1)) continue;
    w.carve(w.index(x + dx, y + dy, Z), TileKind.Wall);
  }
  const a = w.index(x, y, Z);
  const b = w.index(x + 1, y, Z);
  for (const t of [a, b]) {
    w.game.world.services.terrain.setFlag(t, TileFlag.Lit, false);
    w.forceTemperature(t, 15);
  }
  return [a, b];
}

describe('T-494 a glowing wearer lights its 3×3', () => {
  it('lights the wearer\'s tile and its eight neighbours on its level, and nothing further', () => {
    const w = arena('t494-3x3');
    const dwarf = w.spawnDwarf({ at: w.index(30, 30, Z) });
    expect(lightAt(w, 30, 30)).toBe(false);
    wearBreastplate(w, dwarf, 'glowing');
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) expect(lightAt(w, 30 + dx, 30 + dy)).toBe(true);
    expect([lightAt(w, 32, 30), lightAt(w, 30, 28), lightAt(w, 28, 32)]).toEqual([false, false, false]);
    expect(lightAt(w, 30, 30, Z - 1)).toBe(false);
  });

  it('the light follows the wearer', () => {
    const w = arena('t494-follow');
    const dwarf = w.spawnDwarf({ at: w.index(30, 30, Z) });
    wearBreastplate(w, dwarf, 'glowing');
    teleport(w, dwarf, w.index(40, 34, Z));
    expect(lightAt(w, 30, 30)).toBe(false);
    expect([lightAt(w, 41, 35), lightAt(w, 39, 33), lightAt(w, 40, 34)]).toEqual([true, true, true]);
  });

  it('another enchantment, or none, gives no light', () => {
    const w = arena('t494-stout');
    const bare = w.spawnDwarf({ at: w.index(30, 30, Z) });
    const stout = w.spawnDwarf({ at: w.index(40, 30, Z) });
    wearBreastplate(w, stout, 'stout');
    expect([lightAt(w, 30, 30), lightAt(w, 40, 30)]).toEqual([false, false]);
    expect(w.game.world.entities.alive(bare)).toBe(true);
  });

  it('a glowcap on a dark tile with no lamp grows beside a glowing dwarf, and stops when the dwarf goes', () => {
    const w = arena('t494-grow');
    const [stand, cropTile] = pocket(w, 20, 20);
    const dwarf = w.spawnDwarf({ at: stand });
    wearBreastplate(w, dwarf, 'glowing');
    const lit = w.plantCrop(cropTile, 'glowcap');
    const [plainStand, plainTile] = pocket(w, 40, 20);
    const plain = w.spawnDwarf({ at: plainStand });
    wearBreastplate(w, plain, 'stout');
    const dark = w.plantCrop(plainTile, 'glowcap');

    w.step(hour * 26);
    const grown = growth(w, lit);
    expect(grown).toBeGreaterThan(0);
    expect(growth(w, dark)).toBe(0);
    // Not a lamp: the tile keeps its own `lit` bit and no coverage.
    const buildings = w.readers.of<BuildingsReader>('14');
    expect(w.map.hasFlag(cropTile, TileFlag.Lit)).toBe(false);
    expect(buildings.lampCoveredAt(cropTile)).toBe(false);

    teleport(w, dwarf, w.index(60, 60, Z));
    w.step(hour * 26);
    expect(growth(w, lit)).toBe(grown);
    expect(w.game.world.entities.alive(lit)).toBe(true);
  });

  it('a glowing dwarf standing on a cave plot does not make it a glow plot', () => {
    const w = arena('t494-plot');
    const tiles: TileIndex[] = [];
    for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) {
      const t = w.index(20 + dx, 20 + dy, Z);
      w.game.world.services.terrain.setFlag(t, TileFlag.Lit, false);
      tiles.push(t);
    }
    const zoneId = w.zone('farm_plot', tiles);
    const dwarf = w.spawnDwarf({ at: w.index(21, 21, Z) });
    wearBreastplate(w, dwarf, 'glowing');
    expect(lightAt(w, 20, 20)).toBe(true);
    expect(w.readers.of<PlantsReader>('07').plotKind(zoneId)).toBe('cave');
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'glowcap' }))
      .toEqual({ ok: false, reason: 'light_mismatch' });
  });
});

describe('T-494 the view shows a glowing wearer\'s light', () => {
  it('the wearer\'s tile on glow_core, its eight neighbours on glow_halo, on its level; it follows; none without the piece', () => {
    const w = arena('t494-render');
    const dwarf = w.spawnDwarf({ at: w.index(30, 30, Z) });
    // By day, so step 9 does not dim the surface (underground is never dimmed).
    w.until((x) => x.readers.calendar.isDaylight, 3000);
    teleport(w, dwarf, w.index(30, 30, Z));
    const content = loadContent();
    const palette = new Palette(content);
    const compositor = new Compositor({ registry: content, palette });
    const draw = (x: number, y: number): number => compositor.compose(w.readers, { camX: x, camY: y, z: Z,
      sidebarOpen: false, cursor: null, animFrame: 0 }, 3, 8).get(0, 0).bg;
    const core = palette.color('glow_core');
    const halo = palette.color('glow_halo');
    const before = [draw(30, 30), draw(31, 31), draw(32, 30)];
    expect(before).not.toContain(core);
    expect(before).not.toContain(halo);
    wearBreastplate(w, dwarf, 'stout');
    expect([draw(30, 30), draw(31, 31)]).toEqual(before.slice(0, 2));

    wearBreastplate(w, dwarf, 'glowing');
    expect(draw(30, 30)).toBe(core);
    expect([draw(29, 29), draw(31, 31), draw(30, 29), draw(29, 30)]).toEqual([halo, halo, halo, halo]);
    expect(draw(32, 30)).toBe(before[2]);

    teleport(w, dwarf, w.index(40, 30, Z));
    expect([draw(31, 31), draw(32, 30)]).toEqual(before.slice(1));
    expect([draw(40, 30), draw(41, 31)]).toEqual([core, halo]);
  });
});
