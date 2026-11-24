/**
 * T-686: an ended fortress leaves ruins on its site (02 § Ruins): the next embark there finds its
 * dug halls, its standing constructions and some of its items; a site with no ended fortress is
 * generated as before. And a fortress that ends on its embark tick names its seven dwarves.
 */
import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { composeLegend } from '@app/legend';
import { composeRuin } from '@app/ruins';
import { InProcessHost } from '@app/sim-host';
import { C, type Item, type Position } from '@core/components';
import { WORLD_SIZE_SMALL } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import { contentRegistry } from '@content/loader';
import { localMapSpec, RUIN_ITEMS_MAX } from '@systems/embark';
import type { LegendReader } from '@systems/legend';
import { decodeRuinTiles, ruinsOf, withRuin } from '@systems/terrain/generate/ruins';
import { generate, type WorldMap } from '@systems/worldgen';

const registry = contentRegistry();
const world: WorldMap = generate('t686-world', WORLD_SIZE_SMALL, registry);
const embarkable = world.regions.filter((r) => registry.table<{ id: string; embarkable: boolean }>('biomes').byId(r.biome)?.embarkable === true);
const site = embarkable[0]!;
const other = embarkable[1]!;

function embarkOn(w: WorldMap, regionId: number): HeadlessGame {
  return new HeadlessGame({ seed: w.seed, world: 'local', spec: localMapSpec(w, regionId, registry), embark: 'default', ruins: ruinsOf(w, regionId) });
}

/** A first fortress: a 7×7 hall dug four levels under its wagon, a constructed wall row on the surface, twenty tables in the hall. */
function firstFortress(): { game: HeadlessGame; hall: number[]; tables: number } {
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
  const table = registry.table('items').index('table');
  const granite = registry.table('materials').index('granite');
  const tables = Math.min(20, hall.length);
  for (let k = 0; k < tables; k += 1) game.world.services.spawn.item(table, granite, hall[k]!, 1, 2);
  return { game, hall, tables };
}

describe('T-686: an ended fortress leaves ruins on its site', () => {
  it('the next embark on the site has the old fortress\'s dug tiles and some of its items', () => {
    const { game, hall } = firstFortress();
    expect(hall.length).toBeGreaterThan(20);
    const ruin = composeRuin(game, world, registry)!;
    expect(ruin.fortress).toBe(game.world.fortress.name);
    expect(ruin.regionId).toBe(site.id);
    // The record is compact: the changed tiles only, packed, and a bounded list of items.
    expect(ruin.tileCount).toBe(hall.length);
    expect(decodeRuinTiles(ruin, registry).map((t) => t.index)).toEqual([...hall].sort((a, b) => a - b));
    expect(ruin.items.length).toBeGreaterThan(0);
    expect(ruin.items.length).toBeLessThanOrEqual(RUIN_ITEMS_MAX);
    expect(JSON.stringify(ruin).length).toBeLessThan(8_000);
    // The same end leaves the same ruin.
    expect(composeRuin(game, world, registry)).toEqual(ruin);

    const next = embarkOn(withRuin(world, ruin), site.id);
    for (const i of hall) expect(next.map.kind[i]).toBe(TileKind.Floor);
    const table = registry.table('items').index('table');
    const found = next.world.entities.with(C.Item, C.Position).filter((id) => {
      const item = next.world.entities.get<Item>(id, C.Item)!;
      const p = next.world.entities.get<Position>(id, C.Position)!;
      return item.type === table && hall.includes(next.map.index(p.x, p.y, p.z));
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found.length).toBeLessThan(20);
    // Weathered: a quality level worse.
    for (const id of found) expect(next.world.entities.get<Item>(id, C.Item)!.quality).toBe(1);
    // Deterministic from the world seed and the record.
    expect(embarkOn(withRuin(world, ruin), site.id).hash()).toBe(next.hash());
  }, 60_000);

  it('a constructed tile stands or has fallen, and a second ruin on the site builds on the first', () => {
    const { game } = firstFortress();
    const map = game.map;
    const wagon = game.arrival!.wagon;
    const surface: number[] = [];
    for (let dx = -10; dx <= 10; dx += 1) {
      const i = map.index(wagon.x + dx, wagon.y - 8, wagon.z + 1);
      if (map.kind[i] !== TileKind.Open || map.fluid[i] !== 0) continue;
      map.kind[i] = TileKind.Wall;
      map.flags[i] = (map.flags[i] as number) | TileFlag.Constructed;
      surface.push(i);
    }
    expect(surface.length).toBeGreaterThan(8);
    const ruin = composeRuin(game, world, registry)!;
    const standing = decodeRuinTiles(ruin, registry).filter((t) => t.constructed).map((t) => t.index);
    expect(standing.length).toBeGreaterThan(0);
    expect(standing.length).toBeLessThan(surface.length + 1);
    const second = embarkOn(withRuin(world, ruin), site.id);
    for (const i of standing) expect([second.map.kind[i], (second.map.flags[i] as number) & TileFlag.Constructed]).toEqual([TileKind.Wall, TileFlag.Constructed]);
    // The second fortress digs one more tile; its ruin holds that tile alone, and the third embark has both.
    const i = second.map.index(wagon.x, wagon.y, wagon.z - 6);
    second.map.kind[i] = TileKind.StairsUpDown;
    const later = composeRuin(second, withRuin(world, ruin), registry)!;
    expect(decodeRuinTiles(later, registry).map((t) => t.index)).toEqual([i]);
    const third = embarkOn(withRuin(withRuin(world, ruin), later), site.id);
    expect(third.map.kind[i]).toBe(TileKind.StairsUpDown);
    for (const k of standing) expect(third.map.kind[k]).toBe(TileKind.Wall);
  }, 90_000);

  it('balance: the wagon and its load leave with the expedition, so ending on the embark tick leaves no supplies', () => {
    const game = embarkOn(world, site.id);
    const ruin = composeRuin(game, world, registry)!;
    // Only what lay on the ground (the logs of the trees cleared for the wagon) can stay.
    expect(ruin.items.every((item) => item.type === 'log')).toBe(true);
    expect(ruin.tileCount).toBe(0);
  }, 30_000);

  it('a site with no ended fortress is unchanged', async () => {
    const { game } = firstFortress();
    const ruined = withRuin(world, composeRuin(game, world, registry)!);
    const hashOf = async (w: WorldMap): Promise<string> => {
      const host = new InProcessHost(() => 0);
      await host.newGame({ seed: w.seed, world: 'local', spec: localMapSpec(w, other.id, registry), embark: 'default', worldMap: w });
      return host.headless.hash();
    };
    expect(await hashOf(ruined)).toBe(await hashOf(world));
  }, 60_000);
});

describe('T-686: a fortress that ends on its embark tick', () => {
  it('a fortress retired on its embark tick names its seven dwarves', () => {
    const game = embarkOn(world, site.id);
    const journal = game.world.readers.of<LegendReader>('24');
    const record = composeLegend(game, world, registry, journal, [], { kind: 'retired' });
    expect(record.cause).toBe('Retired in Year 1 with 7 dwarves.');
    expect(record.peakPopulation).toBe(7);
    expect(composeLegend(game, world, registry, journal, [], { kind: 'abandoned' }).cause).toBe('Abandoned in Year 1 by 7 dwarves.');
  }, 30_000);
});
