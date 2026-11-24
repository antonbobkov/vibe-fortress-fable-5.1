/**
 * T-690: a ruin's furniture still stands (02 § Ruins): the next embark on the site finds the old
 * fortress's beds and doors built where their tiles still stand, weathered a quality level; a piece
 * whose tiles are gone is not there. And the world map marks a region where a fortress ended.
 */
import { describe, expect, it, vi } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { composeRuin } from '@app/ruins';
import { C, type Building, type Item } from '@core/components';
import { WORLD_SIZE_SMALL } from '@core/constants';
import { TileKind } from '@core/map3d';
import { contentRegistry } from '@content/loader';
import { WorldMapCompositor } from '@render/world-map';
import { BuildingsSystem } from '@systems/buildings';
import { localMapSpec, RUIN_FURNITURE_MAX } from '@systems/embark';
import { ruinsOf, withRuin } from '@systems/terrain/generate/ruins';
import { generate, type RuinBuilding, type WorldMap } from '@systems/worldgen';
import { WorldMapScreen } from '@ui/screens/world_map';
import { keymap, palette, strings, surface } from '../ui/ui-fixture';

const registry = contentRegistry();
const world: WorldMap = generate('t686-world', WORLD_SIZE_SMALL, registry);
const embarkable = world.regions.filter((r) => registry.table<{ id: string; embarkable: boolean }>('biomes').byId(r.biome)?.embarkable === true);
const site = embarkable[0]!;
const other = embarkable[1]!;

function embarkOn(w: WorldMap, regionId: number): HeadlessGame {
  return new HeadlessGame({ seed: w.seed, world: 'local', spec: localMapSpec(w, regionId, registry), embark: 'default', ruins: ruinsOf(w, regionId) });
}

function store(game: HeadlessGame): BuildingsSystem['buildings'] {
  return (game.world.scheduler.inOrder().find((s) => s instanceof BuildingsSystem) as BuildingsSystem).buildings;
}

const items = registry.table('items');
const materials = registry.table('materials');

/** The built building of a type at a tile, or undefined. */
function builtAt(game: HeadlessGame, tile: number, type: string): Building | undefined {
  const id = game.map.buildingAtTile(tile);
  const b = id === 0 ? undefined : game.world.entities.get<Building>(id, C.Building);
  const row = b === undefined ? undefined : registry.table<{ id: string }>('buildings').byIndex(b.type);
  return b !== undefined && b.state === 'built' && row?.id === type ? b : undefined;
}

/**
 * A first fortress: a 7×7 hall dug four levels under its wagon with twenty granite beds of quality 2
 * in it, and a corridor running north from it whose first tile holds an oak door between rock walls.
 */
function firstFortress(): { game: HeadlessGame; beds: number[]; door: number } {
  const game = embarkOn(world, site.id);
  const map = game.map;
  const wagon = game.arrival!.wagon;
  const z = wagon.z - 4;
  const hall: number[] = [];
  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      const i = map.index(wagon.x + dx, wagon.y + dy, z);
      if (map.kind[i] !== TileKind.Wall) continue;
      map.kind[i] = TileKind.Floor;
      hall.push(i);
    }
  }
  const door = map.index(wagon.x, wagon.y - 4, z);
  for (const dx of [-1, 1]) expect(map.kind[map.index(wagon.x + dx, wagon.y - 4, z)]).toBe(TileKind.Wall);
  map.kind[door] = TileKind.Floor;
  map.kind[map.index(wagon.x, wagon.y - 5, z)] = TileKind.Floor;
  const buildings = store(game);
  const granite = materials.index('granite');
  const beds = hall.slice(0, 20);
  for (const tile of beds) expect(buildings.placeRuin({ type: 'bed', tile, orientation: 0, item: items.index('bed'), material: granite, quality: 2 })).not.toBe(0);
  expect(buildings.placeRuin({ type: 'door', tile: door, orientation: 0, item: items.index('door'), material: materials.index('oak'), quality: 2 })).not.toBe(0);
  return { game, beds, door };
}

describe('T-690: a ruin\'s furniture still stands', () => {
  it('a ruin\'s beds stand as buildings on the next embark, a quality level worse, deterministically', () => {
    const { game, beds } = firstFortress();
    const ruin = composeRuin(game, world, registry)!;
    const kept = ruin.buildings ?? [];
    // Each piece stands with RUIN_FURNITURE_STAND_PERMILLE: some, not all.
    const keptBeds = kept.filter((b) => b.type === 'bed');
    expect(keptBeds.length).toBeGreaterThan(0);
    expect(keptBeds.length).toBeLessThan(beds.length);
    expect(kept.length).toBeLessThanOrEqual(RUIN_FURNITURE_MAX);
    for (const b of keptBeds) expect(b).toMatchObject({ item: 'bed', material: 'granite', quality: 1 });
    // The installed beds are not also left as loose items.
    expect(ruin.items.some((item) => item.type === 'bed')).toBe(false);

    const next = embarkOn(withRuin(world, ruin), site.id);
    for (const b of keptBeds) {
      const bed = builtAt(next, b.tile, 'bed');
      expect(bed, `bed at ${b.tile}`).toBeDefined();
      const item = next.world.entities.get<Item>(bed!.itemId, C.Item)!;
      expect([item.type, item.material, item.quality]).toEqual([items.index('bed'), materials.index('granite'), 1]);
      expect(bed!.material).toBe(materials.index('granite'));
    }
    for (const tile of beds) if (!keptBeds.some((b) => b.tile === tile)) expect(next.map.buildingAtTile(tile)).toBe(0);
    expect(embarkOn(withRuin(world, ruin), site.id).hash()).toBe(next.hash());
  }, 90_000);

  it('a door stands in its doorway while its walls stand, and a piece whose tiles are gone is not there', () => {
    const { game, door } = firstFortress();
    const ruin = composeRuin(game, world, registry)!;
    const map = game.map;
    const wagon = game.arrival!.wagon;
    // A rock tile the fortress never dug: a bed told there has no floor.
    const rock = map.index(wagon.x + 6, wagon.y + 6, wagon.z - 4);
    expect(map.kind[rock]).toBe(TileKind.Wall);
    const pieces: RuinBuilding[] = [
      { tile: door, type: 'door', orientation: 0, item: 'door', material: 'oak', quality: 1 },
      { tile: rock, type: 'bed', orientation: 0, item: 'bed', material: 'granite', quality: 1 },
    ];
    const next = embarkOn(withRuin(world, { ...ruin, buildings: pieces }), site.id);
    const built = builtAt(next, door, 'door');
    expect(built).toBeDefined();
    expect(built!.mode).toBe('open');
    expect(next.world.entities.get<Item>(built!.itemId, C.Item)!.quality).toBe(1);
    expect(next.map.buildingAtTile(rock)).toBe(0);
    // The door's walls fallen: the tile west of the doorway is open floor, so the door does not stand.
    const west = map.index(wagon.x - 1, wagon.y - 4, wagon.z - 4);
    const fallen = embarkOn(withRuin(world, { ...composeRuin(digWest(game, west), world, registry)!, buildings: pieces.slice(0, 1) }), site.id);
    expect(fallen.map.kind[west]).toBe(TileKind.Floor);
    expect(fallen.map.buildingAtTile(door)).toBe(0);
  }, 120_000);

  it('a site with no ended fortress has no ruin furniture', () => {
    const { game } = firstFortress();
    const ruined = withRuin(world, composeRuin(game, world, registry)!);
    const fresh = embarkOn(ruined, other.id);
    expect(fresh.hash()).toBe(embarkOn(world, other.id).hash());
  }, 60_000);
});

function digWest(game: HeadlessGame, tile: number): HeadlessGame {
  game.map.kind[tile] = TileKind.Floor;
  return game;
}

describe('T-690: the world map marks a ruined site', () => {
  const compositor = new WorldMapCompositor(registry, palette);

  it('draws the ruin mark on a region with a ruin or a Legends fortress, with a legend entry', () => {
    const homes = Object.values(world.civHomes);
    const [ruinSite, legendOnly, plain] = embarkable.filter((r) => !homes.includes(r.id));
    const ruined = withRuin(world, { fortress: 'Frostreach', regionId: ruinSite!.id, endedTick: 0, tileCount: 0, materials: [], tiles: '', items: [] });
    const screen = new WorldMapScreen(ruined, { embark: vi.fn(), back: vi.fn(), ruins: (id) => (id === legendOnly!.id ? [{ fortress: 'Oldhold', cause: 'Retired.' }] : []) }, keymap, strings, compositor, registry);
    expect(screen.ruined(ruinSite!.id)).toBe(true);
    expect(screen.ruined(legendOnly!.id)).toBe(true);
    expect(screen.ruined(plain!.id)).toBe(false);
    const mark = compositor.ruinCell();
    expect(mark.fg).toBe(palette.color('magenta'));
    // The mark replaces a river and the biome; a civilization's home keeps its glyph.
    expect(compositor.regionCell(ruined, ruinSite!.id, true)).toEqual(mark);
    expect(compositor.regionCell(ruined, ruinSite!.id, false)).not.toEqual(mark);
    expect(compositor.regionCell(world, homes[0]!, true)).not.toEqual(mark);
    // Drawn on the map: the cursor elsewhere, the camera over the ruined region.
    const s = surface(80, 45);
    screen.cursor = { x: ruinSite!.id % world.size, y: Math.floor(ruinSite!.id / world.size) };
    screen.draw(s);
    screen.cursor = { x: plain!.id % world.size, y: Math.floor(plain!.id / world.size) };
    screen.moveCursor(0, 0);
    screen.draw(s);
    const x = ruinSite!.id % world.size - screen.camX;
    const y = Math.floor(ruinSite!.id / world.size) - screen.camY;
    if (x >= 0 && y >= 0 && x < 40 && y < 45) expect(s.cells.get(x, y)).toEqual(mark);
    // The legend names the mark.
    screen.toggle('legend');
    const legend = surface(80, 45);
    screen.draw(legend);
    let found = false;
    for (let row = 0; row < 45 && !found; row += 1) {
      for (let col = 0; col < 80 && !found; col += 1) {
        const cell = legend.cells.get(col, row);
        found = cell.glyph === mark.glyph && cell.fg === mark.fg;
      }
    }
    expect(found).toBe(true);
    expect(strings.get('ui.worldmap.legend_ruin')).toBe('ruins of a fortress');
  }, 60_000);
});
