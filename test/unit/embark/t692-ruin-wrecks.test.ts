/**
 * T-692: a ruin's workshops, hearth, depots and wells stand as wrecks (02 § Ruins, 14 § Wrecks): the
 * next embark on the site finds the old smithy's forge and the old hall's cold hearth where their
 * tiles still stand, doing nothing; taken apart, a wreck gives back every second unit it was built
 * of. The old hearth is not the new fortress's: it does not light, and the player builds their own.
 */
import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { loadGame, saveGame } from '@app/game-save';
import { composeRuin } from '@app/ruins';
import { InProcessHost } from '@app/sim-host';
import { ThingLayers } from '@render/things';
import { C, type Building, type Item, type Position } from '@core/components';
import { WORLD_SIZE_SMALL } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import { contentRegistry } from '@content/loader';
import { BuildingsSystem, type BuildingsReader } from '@systems/buildings';
import { localMapSpec } from '@systems/embark';
import { ruinsOf, withRuin } from '@systems/terrain/generate/ruins';
import { generate, type WorldMap } from '@systems/worldgen';
import { palette } from '../ui/ui-fixture';

const registry = contentRegistry();
const world: WorldMap = generate('t686-world', WORLD_SIZE_SMALL, registry);
const embarkable = world.regions.filter((r) => registry.table<{ id: string; embarkable: boolean }>('biomes').byId(r.biome)?.embarkable === true);
const site = embarkable[0]!;
const other = embarkable[1]!;
const items = registry.table('items');
const materials = registry.table('materials');
const buildingTypes = registry.table<{ id: string }>('buildings');

function embarkOn(w: WorldMap, regionId: number): HeadlessGame {
  return new HeadlessGame({ seed: w.seed, world: 'local', spec: localMapSpec(w, regionId, registry), embark: 'default', ruins: ruinsOf(w, regionId) });
}

function system(game: HeadlessGame): BuildingsSystem {
  return game.world.scheduler.inOrder().find((s) => s instanceof BuildingsSystem) as BuildingsSystem;
}

function reader(game: HeadlessGame): BuildingsReader {
  return game.world.readers.of<BuildingsReader>('14');
}

function buildingAt(game: HeadlessGame, tile: number): { id: number; b: Building; type: string } | undefined {
  const id = game.map.buildingAtTile(tile);
  const b = id === 0 ? undefined : game.world.entities.get<Building>(id, C.Building);
  return b === undefined ? undefined : { id, b, type: buildingTypes.byIndex(b.type)?.id ?? '' };
}

/**
 * The origins of `count` free `w`×`w` patches of surface floor near the wagon, apart from it and
 * from each other: the same tiles on every embark on the site, since the map is generated again.
 */
function patches(game: HeadlessGame, sizes: readonly number[]): number[] {
  const map = game.map;
  const wagon = game.arrival!.wagon;
  const taken = new Set<number>();
  for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) taken.add(map.index(wagon.x + dx, wagon.y + dy, wagon.z));
  const out: number[] = [];
  for (const w of sizes) {
    let found = -1;
    for (let r = 3; r <= 14 && found < 0; r += 1) {
      for (let dy = -r; dy <= r && found < 0; dy += 1) {
        for (let dx = -r; dx <= r && found < 0; dx += 1) {
          const x = wagon.x + dx;
          const y = wagon.y + dy;
          if (x < 1 || y < 1 || x + w >= map.w || y + w >= map.h) continue;
          const tiles: number[] = [];
          for (let j = 0; j < w; j += 1) for (let i = 0; i < w; i += 1) tiles.push(map.index(x + i, y + j, wagon.z));
          // A ring of one tile kept free around each patch, so no two touch.
          const ring: number[] = [];
          for (let j = -1; j <= w; j += 1) for (let i = -1; i <= w; i += 1) ring.push(map.index(x + i, y + j, wagon.z));
          if (ring.some((t) => taken.has(t))) continue;
          if (!tiles.every((t) => map.kind[t] === TileKind.Floor && map.buildingAtTile(t) === 0)) continue;
          found = tiles[0]!;
          for (const t of ring) taken.add(t);
        }
      }
    }
    expect(found, `a free ${w}×${w} floor`).toBeGreaterThanOrEqual(0);
    out.push(found);
  }
  return out;
}

/** Place a building and finish it at once; its consumed inputs are then set to `inputs`. */
function build(game: HeadlessGame, type: string, origin: number, material: string, inputs: [string, string, number][]): number {
  const store = system(game).buildings;
  const map = game.map;
  const row = registry.table<{ id: string; footprint: { w: number; h: number } }>('buildings').byId(type)!;
  for (let j = 0; j < row.footprint.h; j += 1) for (let i = 0; i < row.footprint.w; i += 1) {
    const t = map.offset(origin, i, j, 0);
    map.flags[t] = (map.flags[t] as number) | TileFlag.Discovered;
  }
  let placed = 0;
  expect(store.place({ type: 'PlaceBuilding', buildingType: type, origin, orientation: 0, materialChoice: material }, (id) => { placed = id; })).toMatchObject({ ok: true });
  system(game).completeNow(placed, materials.index(material));
  const used = inputs.flatMap(([t, m, n]) => Array.from({ length: n }, () => ({ type: t, material: materials.index(m) })));
  const b = store.get(placed)!;
  store.write(placed, { settings: { ...b.settings, inputs: used } });
  expect(store.get(placed)!.state).toBe('built');
  return placed;
}

/** A first fortress with a carpenter's workshop, a forge and its hearth on the surface by the wagon. */
function firstFortress(): { game: HeadlessGame; carpenter: number; forge: number; hearth: number } {
  const game = embarkOn(world, site.id);
  const [carpenter, forge, hearth] = patches(game, [3, 3, 1]) as [number, number, number];
  build(game, 'carpenter', carpenter, 'oak', [['log', 'oak', 2]]);
  build(game, 'forge', forge, 'granite', [['anvil', 'iron', 1], ['stone_block', 'granite', 3]]);
  build(game, 'hearth', hearth, 'granite', [['stone_block', 'granite', 3], ['log', 'oak', 1]]);
  expect(reader(game).hearth()).not.toBe(0);
  return { game, carpenter, forge, hearth };
}

/** The items of a type and material lying on a tile, in units. */
function unitsAt(game: HeadlessGame, tile: number, type: string, material: string): number {
  const at = game.map.unpack(tile);
  let n = 0;
  for (const id of game.world.entities.with(C.Item, C.Position)) {
    const pos = game.world.entities.get<Position>(id, C.Position)!;
    const item = game.world.entities.get<Item>(id, C.Item)!;
    if (pos.x === at.x && pos.y === at.y && pos.z === at.z && item.type === items.index(type) && item.material === materials.index(material)) n += item.count;
  }
  return n;
}

describe('T-692: a ruin\'s workshops stand as wrecks', () => {
  it('a ruin keeps its workshops and hearth as wrecks holding every second unit, and the next embark finds them doing nothing', async () => {
    const { game, carpenter, forge, hearth } = firstFortress();
    const ruin = composeRuin(game, world, registry)!;
    const wrecks = ruin.wrecks ?? [];
    // Every second unit in the order consumed: the anvil went with the looters.
    expect(wrecks.find((w) => w.tile === carpenter)).toEqual({ tile: carpenter, type: 'carpenter', orientation: 0, material: 'oak', inputs: [{ type: 'log', material: 'oak', count: 1 }] });
    expect(wrecks.find((w) => w.tile === forge)).toMatchObject({ type: 'forge', material: 'granite', inputs: [{ type: 'stone_block', material: 'granite', count: 2 }] });
    expect(wrecks.find((w) => w.tile === hearth)).toMatchObject({ type: 'hearth', inputs: [{ type: 'stone_block', material: 'granite', count: 1 }, { type: 'log', material: 'oak', count: 1 }] });
    // The wagon is not a wreck: it leaves with the expedition.
    expect(wrecks.some((w) => w.type === 'wagon')).toBe(false);

    const next = embarkOn(withRuin(world, ruin), site.id);
    const r = reader(next);
    const shop = buildingAt(next, carpenter)!;
    expect([shop.type, shop.b.state, shop.b.material]).toEqual(['carpenter', 'ruined', materials.index('oak')]);
    expect(shop.b.settings['inputs']).toEqual([{ type: 'log', material: materials.index('oak') }]);
    // A wreck is no workshop: 12 runs nothing there, and it adds nothing to the fortress's wealth.
    expect(next.world.entities.has(shop.id, C.Workshop)).toBe(false);
    expect(r.value(shop.id)).toBe(0);
    // A forge's corners block a walker when it is built; its wreck has fallen in and blocks nothing.
    const smithy = buildingAt(next, forge)!;
    expect([smithy.type, smithy.b.state]).toEqual(['forge', 'ruined']);
    for (const t of smithy.b.footprint) expect(r.blocksMovementAt(t, 'walker')).toBe(false);
    // Drawn worn: its glyph in its material's color dimmed a level, not a plan's `text_dim`.
    const things = new ThingLayers(registry, palette, (ch) => ch.codePointAt(0) ?? 0);
    const black = palette.color('black');
    const cell = things.buildingOver({ glyph: 0, fg: black, bg: black }, carpenter, next.world.readers);
    const oak = palette.color(registry.table<{ id: string; color: string }>('materials').byId('oak')!.color);
    expect(cell.fg).toEqual(palette.dim(oak, 1));
    expect(cell.fg).not.toEqual(palette.color('text_dim'));
    // The old hearth does not glow.
    const ember = things.buildingOver({ glyph: 0, fg: black, bg: black }, hearth, next.world.readers);
    expect(ember.bg).toEqual(black);
    expect(ember.fg).toEqual(palette.dim(palette.color('hearth_orange'), 1));
    // The same ruin, the same embark.
    expect(embarkOn(withRuin(world, ruin), site.id).hash()).toBe(next.hash());
    // A save keeps the wrecks.
    const loaded = (await loadGame(await saveGame(next, { kind: 'manual' }))).game;
    expect(loaded.hash()).toBe(next.hash());
    expect(buildingAt(loaded, forge)!.b.state).toBe('ruined');
  }, 120_000);

  it('the old hearth stands cold: it is not the fortress\'s hearth, and the player builds their own', () => {
    const { game, hearth } = firstFortress();
    const ruin = composeRuin(game, world, registry)!;
    const next = embarkOn(withRuin(world, ruin), site.id);
    const r = reader(next);
    const old = buildingAt(next, hearth)!;
    expect([old.type, old.b.state]).toEqual(['hearth', 'ruined']);
    expect(r.hearth()).toBe(0);
    expect(r.hearthLightAt(hearth)).toBe(false);
    expect(r.hearthHallTiles()).toEqual([]);
    next.step(10);
    expect(r.hearth()).toBe(0);
    // A wreck is taken apart, never cancelled; the old hearth may be taken apart while dwarves live.
    const store = system(next).buildings;
    expect(store.cancel({ type: 'CancelBuilding', buildingId: old.id })).toMatchObject({ ok: false, reason: 'not_cancellable' });
    expect(store.deconstruct({ type: 'DeconstructBuilding', buildingId: old.id })).toMatchObject({ ok: true });
    // The new fortress's own hearth is placed elsewhere: the wreck does not count as one.
    const [spot] = patches(next, [1]) as [number];
    next.map.flags[spot] = (next.map.flags[spot] as number) | TileFlag.Discovered;
    expect(store.place({ type: 'PlaceBuilding', buildingType: 'hearth', origin: spot, orientation: 0, materialChoice: 'granite' })).toMatchObject({ ok: true });
    expect(store.hearthId).toBe(next.map.buildingAtTile(spot));
  }, 120_000);

  it('a dwarf takes a wreck apart for what it still holds', () => {
    const { game, forge } = firstFortress();
    const next = embarkOn(withRuin(world, composeRuin(game, world, registry)!), site.id);
    const smithy = buildingAt(next, forge)!;
    const anchor = system(next).buildings.anchorOf(smithy.b);
    expect(unitsAt(next, anchor, 'stone_block', 'granite')).toBe(0);
    expect(system(next).buildings.deconstruct({ type: 'DeconstructBuilding', buildingId: smithy.id })).toMatchObject({ ok: true });
    for (let t = 0; t < 40 && next.map.buildingAtTile(forge) !== 0; t += 1) next.step(100);
    expect(next.map.buildingAtTile(forge)).toBe(0);
    expect(next.world.entities.alive(smithy.id)).toBe(false);
    // Two of the forge's three blocks; the looted anvil does not come back.
    expect(unitsAt(next, anchor, 'stone_block', 'granite')).toBe(2);
    expect(unitsAt(next, anchor, 'anvil', 'iron')).toBe(0);
  }, 120_000);

  it('a wreck left standing is a wreck again, halved again; a testing fortress leaves none', () => {
    const { game, forge } = firstFortress();
    const next = embarkOn(withRuin(world, composeRuin(game, world, registry)!), site.id);
    const again = composeRuin(next, withRuin(world, composeRuin(game, world, registry)!), registry)!;
    expect(again.wrecks?.find((w) => w.tile === forge)).toMatchObject({ type: 'forge', inputs: [{ type: 'stone_block', material: 'granite', count: 1 }] });
    game.world.fortress.testing = true;
    expect(composeRuin(game, world, registry)!.wrecks).toBeUndefined();
  }, 120_000);

  it('a site with no ended fortress is unchanged', async () => {
    const { game } = firstFortress();
    const ruined = withRuin(world, composeRuin(game, world, registry)!);
    expect(ruined.ruins?.[0]?.wrecks?.length).toBe(3);
    const hashOf = async (w: WorldMap): Promise<string> => {
      const host = new InProcessHost(() => 0);
      await host.newGame({ seed: w.seed, world: 'local', spec: localMapSpec(w, other.id, registry), embark: 'default', worldMap: w });
      return host.headless.hash();
    };
    expect(await hashOf(ruined)).toBe(await hashOf(world));
  }, 60_000);
});
