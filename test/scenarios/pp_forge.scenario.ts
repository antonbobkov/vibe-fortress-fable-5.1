/**
 * Player path: crafts and forge (T-330; `docs/process/player-paths.md`).
 *
 * From the Miner's Guild embark (picks, an iron anvil, charcoal and iron bars) on a compact
 * generated forest region, by commands only: a stockpile; a stairwell beside the wagon down to
 * the nearest ore of a metal other than iron, read off the map as a player reads the layers; a
 * drift to that ore; a mason's workshop for blocks, a smelter and a forge; orders to cut blocks,
 * smelt the ore and forge crafts of its metal. The wagon carries iron bars only, so a craft of
 * that metal can only come from the ore.
 *
 * Asserted, as a player sees it, within a season: the ore was mined and smelted, crafts of its
 * metal were forged, and they stand in the stockpile. Wild animals stay on.
 */

import { expect } from 'vitest';
import { C } from '@core/components';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';
import { built, cmd, day, expectNoInvariantFindings, pathWorld, placeNear, playUntil, stairDown, surfaceZ, trace, wagon, zoneRect } from './player-path';
import { deathCounts } from './death-counts';
import type { TestWorld } from './test-world';

/** How deep the player looks for ore below the stair's head. */
const SEARCH_DEPTH = 12;

interface Ore { tile: TileIndex; mineral: string; metal: string }

/** The nearest ore of a metal the wagon has no bars of, by walk and depth from (x, y). */
function nearestOre(w: TestWorld, x: number, y: number): Ore {
  const map = w.map;
  const materials = w.game.registry.table<{ id: string; class: string }>('materials');
  const minerals = w.game.registry.table<{ id: string; yields: { metal: string }[] }>('minerals');
  const top = surfaceZ(w, x, y);
  let best: Ore | null = null;
  let bestCost = Infinity;
  for (let z = top - 1; z >= top - SEARCH_DEPTH; z -= 1) for (let yy = 3; yy < map.h - 3; yy += 1) for (let xx = 3; xx < map.w - 3; xx += 1) {
    const t = w.index(xx, yy, z);
    const m = materials.byIndex(map.materialAt(t));
    if (m?.class !== 'ore' || map.kindAt(t) !== TileKind.Wall) continue;
    const metal = minerals.byId(m.id)?.yields[0]?.metal ?? '';
    if (['', 'iron', 'coal', 'deepsilver'].includes(metal)) continue;
    const cost = Math.abs(xx - x) + Math.abs(yy - y) + (top - z) * 2;
    if (cost < bestCost) { bestCost = cost; best = { tile: t, mineral: m.id, metal }; }
  }
  if (best === null) throw new Error('pp_forge: no ore of a non-iron metal within reach');
  return best;
}

const scenario: Scenario = {
  id: 'pp_forge',
  milestone: 8,
  seed: 'pp-forge',
  world: 'flat-test',
  timeoutMs: 300_000,
  run: () => {
    const w = pathWorld('pp-forge', { preset: 'miner_s_guild' });
    const { x: cx, y: cy } = wagon(w);
    const ent = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const map = w.map;

    const stockpile = zoneRect(w, 'stockpile', cx - 12, cy + 3, surfaceZ(w, cx, cy), 14, 8);
    cmd(w, { type: 'SetStockpileFilter', zoneId: stockpile, filter: 'everything' });
    const ore = nearestOre(w, cx + 5, cy + 10);
    const oz = map.zOf(ore.tile), ox = map.xOf(ore.tile), oy = map.yOf(ore.tile);
    const { sx, sy } = stairDown(w, cx + 5, cy + 10, () => oz);
    // An L-shaped drift on the ore's level from the foot of the stair, and the ore around its end.
    const drift: TileIndex[] = [];
    for (let x = Math.min(sx, ox); x <= Math.max(sx, ox); x += 1) drift.push(w.index(x, sy, oz));
    for (let y = Math.min(sy, oy); y <= Math.max(sy, oy); y += 1) drift.push(w.index(ox, y, oz));
    const oreTiles: TileIndex[] = [];
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const t = w.index(ox + dx, oy + dy, oz);
      if (map.materialAt(t) === map.materialAt(ore.tile) && map.kindAt(t) === TileKind.Wall) oreTiles.push(t);
    }
    const dig = [...new Set([...drift, ...oreTiles])].filter((t) => map.kindAt(t) === TileKind.Wall && !(map.xOf(t) === sx && map.yOf(t) === sy));
    cmd(w, { type: 'Designate', kind: 'dig', priority: 4, tiles: dig });

    const avoid = new Set<number>();
    const shops: Record<string, EntityId> = {
      mason: placeNear(w, 'mason', cx - 7, cy + 12, avoid),
      smelter: placeNear(w, 'smelter', cx - 2, cy + 14, avoid),
      forge: placeNear(w, 'forge', cx + 3, cy + 16, avoid),
    };
    const orders: Record<string, { recipeId: string; mode: 'once'; remaining: number; materialFilter?: string }> = {
      mason: { recipeId: 'make_stone_block', mode: 'once', remaining: 3 },
      smelter: { recipeId: `smelt_${ore.mineral}`, mode: 'once', remaining: 2 },
      forge: { recipeId: 'forge_crafts', mode: 'once', remaining: 1, materialFilter: ore.metal },
    };
    const ordered = new Set<string>();
    const metal = w.game.registry.table('materials').index(ore.metal);
    // The forge's crafts (the recipe makes one of several craft types) of the ore's metal.
    const crafts = (): EntityId[] => w.events('ItemCrafted').filter((e) => e['recipeId'] === 'forge_crafts')
      .map((e) => Number(e['itemId'])).filter((id) => ent.alive(id) && ent.get(id, C.Item)?.material === metal);
    const stored = (): EntityId[] => crafts().filter((id) => items.stockpileAt(items.tileOf(id)) === stockpile);
    const finished = playUntil(w, () => stored().length > 0, DAYS_PER_SEASON * TICKS_PER_DAY, () => {
      for (const [shop, id] of Object.entries(shops)) {
        if (ordered.has(shop) || !built(w, id)) continue;
        ordered.add(shop);
        cmd(w, { type: 'AddWorkOrder', workshopId: id, order: orders[shop]! });
      }
    }, 100);

    const mined = w.events('ItemCreated').filter((e) => e['material'] === ore.mineral).length;
    const bars = w.events('ItemCreated').filter((e) => e['itemType'] === 'bar' && e['material'] === ore.metal).length;
    const summary = `${trace(w, 'pp_forge')}; ore ${ore.mineral} (${ore.metal}) at (${ox}, ${oy}, ${oz}), ${dig.length} tiles to dig, ` +
      `${dig.filter((t) => map.kindAt(t) === TileKind.Wall).length} left; shops ${JSON.stringify(Object.fromEntries(Object.entries(shops).map(([k, id]) => [k, built(w, id)])))}; ` +
      `ore items ${mined}; bars ${bars}; crafts ${crafts().length}, stored ${stored().length}; stone ${items.count('raw_stone')}, blocks ${items.count('stone_block')}`;
    console.log(summary);
    expect(mined, `the ore was mined; ${summary}`).toBeGreaterThan(0);
    expect(bars, `the ore was smelted; ${summary}`).toBeGreaterThan(0);
    expect(crafts().length, `crafts of ${ore.metal} were forged; ${summary}`).toBeGreaterThan(0);
    expect(finished, `the crafts stand in the stockpile by day ${DAYS_PER_SEASON}; ${summary}`).toBe(true);
    expect(deathCounts(w).dwarf, 'no dwarf died').toBe(0);
    expectNoInvariantFindings(w, `pp_forge day ${day(w)}`);
  },
};

export default scenario;
