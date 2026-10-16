/**
 * Player path: pasture (T-330; `docs/process/player-paths.md`).
 *
 * From the Farmstead embark (two cows, two sheep and two goats among its animals) on a compact
 * generated forest region, by commands only: a pasture zone over the meadow south of the wagon,
 * sized at GRASS_PER_GRAZER grass tiles for each grazer, and every grazer of the wagon assigned
 * to it.
 *
 * Asserted, as a player sees it, after a season: every grazer is alive, still on the pasture, has
 * grazed its grass, and never starved. Wild animals stay on.
 */

import { expect } from 'vitest';
import { C } from '@core/components';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { GRASS_PER_GRAZER } from '@systems/animals/constants';
import type { Scenario } from './runner';
import { buildings, cmd, day, expectNoInvariantFindings, pathWorld, surfaceZ, trace, wagon } from './player-path';
import { deathCounts } from './death-counts';
import type { TestWorld } from './test-world';

/** The wagon's grazers: tame animals of the fortress whose species grazes. */
function grazers(w: TestWorld): EntityId[] {
  const ent = w.game.world.entities;
  const species = w.game.registry.table<{ id: string; diet: string }>('creatures');
  return ent.with(C.Tame, C.Creature).filter((id) => species.byIndex(ent.get(id, C.Creature)!.species)?.diet === 'grazer');
}

/**
 * The grass tiles a player would draw a pasture over: the nearest square south of the wagon
 * whose qualifying grass tiles number at least `need`, grown one ring at a time.
 */
function meadow(w: TestWorld, cx: number, cy: number, need: number): TileIndex[] {
  const b = buildings(w);
  const ox = cx, oy = Math.min(w.map.h - 4, cy + 14);
  for (let r = 4; r < w.map.w; r += 1) {
    const tiles: TileIndex[] = [];
    for (let y = Math.max(1, oy - r); y <= Math.min(w.map.h - 2, oy + r); y += 1) {
      for (let x = Math.max(1, ox - r); x <= Math.min(w.map.w - 2, ox + r); x += 1) {
        const t = w.index(x, y, surfaceZ(w, x, y));
        if (w.map.hasFlag(t, TileFlag.Grass) && b.zoneAt(t) === 0 && b.zoneTileQualifies('pasture', t)) tiles.push(t);
      }
    }
    if (tiles.length >= need) return tiles;
  }
  throw new Error(`meadow: fewer than ${need} grass tiles on the map`);
}

const scenario: Scenario = {
  id: 'pp_pasture',
  milestone: 8,
  seed: 'pp-pasture',
  world: 'flat-test',
  timeoutMs: 300_000,
  run: () => {
    const w = pathWorld('pp-pasture', { preset: 'farmstead' });
    const { x: cx, y: cy } = wagon(w);
    const herd = grazers(w);
    expect(herd.length, 'the Farmstead wagon brings grazers').toBeGreaterThanOrEqual(6);

    const tiles = meadow(w, cx, cy, herd.length * GRASS_PER_GRAZER);
    cmd(w, { type: 'CreateZone', zoneType: 'pasture', tiles });
    const pasture = buildings(w).zoneAt(tiles[0]!);
    for (const animalId of herd) cmd(w, { type: 'AssignPasture', animalId, zoneId: pasture });

    w.step(DAYS_PER_SEASON * TICKS_PER_DAY);

    const ent = w.game.world.entities;
    const zoneTiles = new Set(buildings(w).zone(pasture)?.tiles ?? []);
    const grazed = w.events('GrassGrazed').filter((e) => zoneTiles.has(Number(e['tile']))).length;
    const starving = w.events('AnimalStarving').filter((e) => herd.includes(Number(e['id']))).length;
    const living = herd.filter((id) => ent.alive(id));
    const onPasture = living.filter((id) => w.readers.of<{ pastureOf(id: number): number }>('08').pastureOf(id) === pasture);
    const wagonTile = w.index(cx, cy, surfaceZ(w, cx, cy));
    const cut = tiles.filter((t) => !w.reachable(wagonTile, t)).length;
    const summary = `${trace(w, 'pp_pasture')}; pasture ${tiles.length} tiles, ${cut} not reachable from the wagon; herd ${herd.length}, living ${living.length}, ` +
      `on pasture ${onPasture.length}; grazed ${grazed}; starving ${starving}; conditions ${JSON.stringify(living.map((id) => ent.get(id, C.Tame)?.condition))}`;
    console.log(summary);
    expect(living.length, `every grazer alive; ${summary}`).toBe(herd.length);
    expect(onPasture.length, `every grazer on its pasture; ${summary}`).toBe(herd.length);
    expect(grazed, `grass grazed on the pasture; ${summary}`).toBeGreaterThanOrEqual(herd.length);
    expect(starving, `no grazer starved; ${summary}`).toBe(0);
    expect(deathCounts(w).dwarf, 'no dwarf died').toBe(0);
    expectNoInvariantFindings(w, `pp_pasture day ${day(w)}`);
  },
};

export default scenario;
