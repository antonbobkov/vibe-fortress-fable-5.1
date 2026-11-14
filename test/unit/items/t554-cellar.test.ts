import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;
const YEAR = DAYS_PER_YEAR * TICKS_PER_DAY;

/** A flat map; with no natural arrivals unless a save must restore the same systems. */
function world(seed: string, wildlife = false): TestWorld {
  const registry = new TestWorld({ seed: `${seed}-registry`, world: 'flat-test', embark: 'none' }).game.registry;
  return new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none', ...(wildlife ? {} : { surfaceWildlife: 'none' as const }) });
}

/** A 3×3 stockpile of drink with its tiles dark and at `c` °C; the cellar setting on. */
function cellar(w: TestWorld, c: number, x = 10, y = 10): { zone: number; tiles: TileIndex[] } {
  const tiles: TileIndex[] = [];
  for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) tiles.push(w.index(x + dx, y + dy, Z));
  for (const t of tiles) {
    w.map.setFlag(t, TileFlag.Lit, false);
    w.map.setFlag(t, TileFlag.Outdoor, false);
    w.forceTemperature(t, c);
  }
  const zone = w.zone('stockpile', tiles);
  expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: zone, filter: 'everything' })).toEqual({ ok: true });
  expect(w.game.world.applyCommand({ type: 'SetStockpileCellar', zoneId: zone, on: true })).toEqual({ ok: true });
  return { zone, tiles };
}

/**
 * A barrel of `material` holding 20 bellwine on a tile, forbidden: a thief takes the most valuable thing
 * it finds, and a vintage is the most valuable thing here (that is the point, elsewhere).
 */
function barrelOf(w: TestWorld, material: string, at: TileIndex): { barrel: number; drink: number } {
  const barrel = w.spawnItem('barrel', material, at);
  const drink = w.spawnItem('drink', 'bellwine', { containerId: barrel }, 20);
  expect(w.game.world.applyCommand({ type: 'ForbidItem', itemId: barrel, on: true })).toEqual({ ok: true });
  expect(w.game.world.applyCommand({ type: 'ForbidItem', itemId: drink, on: true })).toEqual({ ok: true });
  return { barrel, drink };
}

describe('T-554 the cellar ages drink and cheese', () => {
  it('ages bellwine in oak in a year and to vintage in two; in pine it is only aged; in metal never', () => {
    const w = world('t554-cellar');
    const { zone, tiles } = cellar(w, 10);
    const items = w.readers.of<ItemsReader>('13');
    expect(items.stockpile(zone)?.cellar).toBe(true);
    expect(items.stockpile(zone)?.cellarOk).toBe(true);
    const oak = barrelOf(w, 'oak', tiles[0] as TileIndex);
    const pine = barrelOf(w, 'pine', tiles[1] as TileIndex);
    const iron = barrelOf(w, 'iron', tiles[2] as TileIndex);
    const young = items.value(oak.drink);
    w.step(YEAR + 20);
    expect(items.get(oak.drink)?.age).toBe(1);
    expect(items.get(pine.drink)?.age).toBeUndefined();
    expect(items.get(pine.drink)?.cellarDays).toBeGreaterThan(DAYS_PER_YEAR - 2);
    expect(items.get(iron.drink)?.age).toBeUndefined();
    expect(items.get(iron.drink)?.cellarDays).toBeUndefined();
    expect(items.value(oak.drink)).toBe(Math.floor((young * 150) / 100));
    expect(w.events('ItemAged').filter((e) => e['id'] === oak.drink).map((e) => e['stage'])).toEqual([1]);
    w.step(YEAR);
    expect(items.get(oak.drink)?.age).toBe(2);
    expect(items.get(pine.drink)?.age).toBe(1);
    expect(items.value(oak.drink)).toBe(Math.floor((young * 250) / 100));
    // Vintage is the last stage.
    w.step(YEAR);
    expect(items.get(oak.drink)?.age).toBe(2);
    expect(items.get(oak.drink)?.cellarDays).toBeUndefined();
  }, 240_000);

  it('judges the cellar: lit, too warm and too cold work as no cellar, and a warm week only pauses', () => {
    const w = world('t554-judge');
    const { zone, tiles } = cellar(w, 16);
    const items = w.readers.of<ItemsReader>('13');
    expect(items.stockpile(zone)).toMatchObject({ cellar: true, cellarReason: 'too_warm', cellarC: 16 });
    expect(items.stockpile(zone)?.cellarOk).toBeUndefined();
    const oak = barrelOf(w, 'oak', tiles[0] as TileIndex);
    w.step(3 * TICKS_PER_DAY);
    expect(items.get(oak.drink)?.cellarDays).toBeUndefined();
    for (const t of tiles) w.forceTemperature(t, 10);
    w.step(5 * TICKS_PER_DAY);
    expect(items.stockpile(zone)?.cellarOk).toBe(true);
    const days = items.get(oak.drink)?.cellarDays ?? 0;
    expect(days).toBeGreaterThanOrEqual(4);
    for (const t of tiles) w.forceTemperature(t, 1);
    w.step(3 * TICKS_PER_DAY);
    expect(items.stockpile(zone)).toMatchObject({ cellarReason: 'too_cold', cellarC: 1 });
    expect(items.get(oak.drink)?.cellarDays).toBe(days);
    for (const t of tiles) w.forceTemperature(t, 10);
    w.map.setFlag(tiles[4] as TileIndex, TileFlag.Lit, true);
    w.step(TICKS_PER_DAY);
    expect(items.stockpile(zone)?.cellarReason).toBe('lit');
    expect(items.get(oak.drink)?.cellarDays).toBe(days);
    // Off clears the judgement; the drink keeps its days.
    expect(w.game.world.applyCommand({ type: 'SetStockpileCellar', zoneId: zone, on: false })).toEqual({ ok: true });
    expect(items.stockpile(zone)?.cellar).toBeUndefined();
    expect(items.stockpile(zone)?.cellarReason).toBeUndefined();
    expect(items.get(oak.drink)?.cellarDays).toBe(days);
  }, 60_000);

  it('a hearth or a lamp is comfort light: no cellar beside it', () => {
    const w = world('t554-hearth');
    const { zone } = cellar(w, 10, 14, 14);
    w.build('hearth', w.index(13, 13, Z));
    w.step(TICKS_PER_DAY + 10);
    expect(w.readers.of<ItemsReader>('13').stockpile(zone)?.cellarReason).toBe('lit');
  }, 60_000);

  it('refuses a hospital and a missing zone, and a non-boolean setting', () => {
    const w = world('t554-refuse');
    const { zone } = cellar(w, 10);
    expect(w.game.world.applyCommand({ type: 'SetStockpileCellar', zoneId: zone, on: 'yes' })).toEqual({ ok: false, reason: 'bad_setting' });
    expect(w.game.world.applyCommand({ type: 'SetStockpileCellar', zoneId: 9999, on: true }).ok).toBe(false);
    const hospital = w.zone('hospital', [w.index(20, 20, Z)]);
    expect(w.game.world.applyCommand({ type: 'SetStockpileCellar', zoneId: hospital, on: true }).ok).toBe(false);
  });

  it('cheese ages in a year and then no longer rots; it merges only at its own stage', () => {
    const w = world('t554-cheese');
    const { tiles } = cellar(w, 10);
    const barrel = w.spawnItem('barrel', 'pine', tiles[0] as TileIndex);
    const cheese = w.spawnItem('cheese', 'milk', { containerId: barrel }, 2);
    w.game.world.applyCommand({ type: 'ForbidItem', itemId: barrel, on: true });
    w.game.world.applyCommand({ type: 'ForbidItem', itemId: cheese, on: true });
    const items = w.readers.of<ItemsReader>('13');
    w.step(YEAR + 20);
    expect(items.get(cheese)?.age).toBe(1);
    const stage = items.rotStage(cheese);
    expect(stage).toBeLessThan(2);
    // Out of the cellar, in the warm, it still does not rot.
    const warm = w.index(25, 25, Z);
    w.forceTemperature(warm, 25);
    w.items.dropAt(cheese, warm);
    w.step(60 * TICKS_PER_DAY);
    expect(items.rotStage(cheese)).toBe(stage);
    const young = w.spawnItem('cheese', 'milk', w.index(26, 25, Z), 1);
    expect(w.items.canMerge(cheese, young)).toBe(false);
  }, 240_000);

  it('saves the setting, the judgement and the stage, and resumes with the same hash', () => {
    const w = world('t554-save', true);
    const { tiles } = cellar(w, 10);
    barrelOf(w, 'oak', tiles[0] as TileIndex);
    w.step(3 * TICKS_PER_DAY);
    const resumed = roundTrip(w.game).game;
    expect(resumed.hash()).toBe(w.hash());
    w.step(2 * TICKS_PER_DAY);
    resumed.step(2 * TICKS_PER_DAY);
    expect(resumed.hash()).toBe(w.hash());
  }, 60_000);
});
