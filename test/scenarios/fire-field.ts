/**
 * The grass field of `ma_fire_spread` and `ma_fire_rain` (`acceptance-tests.md` § 05 Materials:
 * "ignite a grass tile in a 10×10 dry grass field"): 10×10 surface floors of `flat-test` with
 * `grass`, ringed by a band of granite floor two tiles wide ("no spread onto stone").
 */

import { TileFlag, TileKind } from '@core/map3d';
import type { GameSystem } from '@core/system';
import type { TileIndex } from '@core/types';
import { BaseSystem } from '@core/system';
import type { TestWorld } from './test-world';

export const FIELD_X = 40;
export const FIELD_Y = 40;
export const FIELD = 10;
export const Z = 32;

export function fieldTiles(w: TestWorld): TileIndex[] {
  const out: TileIndex[] = [];
  for (let y = FIELD_Y; y < FIELD_Y + FIELD; y += 1) for (let x = FIELD_X; x < FIELD_X + FIELD; x += 1) out.push(w.index(x, y, Z));
  return out;
}

export function ringTiles(w: TestWorld): TileIndex[] {
  const out: TileIndex[] = [];
  for (let y = FIELD_Y - 2; y < FIELD_Y + FIELD + 2; y += 1) {
    for (let x = FIELD_X - 2; x < FIELD_X + FIELD + 2; x += 1) {
      const inside = x >= FIELD_X && x < FIELD_X + FIELD && y >= FIELD_Y && y < FIELD_Y + FIELD;
      if (!inside) out.push(w.index(x, y, Z));
    }
  }
  return out;
}

export function setupField(w: TestWorld): void {
  const granite = w.game.registry.table('materials').index('granite');
  for (const t of fieldTiles(w)) w.map.setFlag(t, TileFlag.Grass, true);
  for (const t of ringTiles(w)) w.carve(t, TileKind.Floor, granite);
  // "ignite a grass tile": the ignition path of lightning and magma (05 § Fire, Ignition).
  w.materials.fire.pendingIgnite.add(w.index(FIELD_X + 4, FIELD_Y + 4, Z));
}

/** The tiles that caught fire, from `FireStarted` and `FireSpread`. */
export function burnedTiles(w: TestWorld): Set<TileIndex> {
  const out = new Set<TileIndex>();
  for (const e of w.events('FireStarted')) out.add(e['tile'] as TileIndex);
  for (const e of w.events('FireSpread')) for (const t of e['tiles'] as TileIndex[]) out.add(t);
  return out;
}

/**
 * A stand-in for 06 weather (T-M3-06) holding one state: the reader 05 reads (`state()`,
 * `surfaceTempC()`), registered under 06's id as the `core_*` stand-ins are (D-036).
 */
export class FixedWeather extends BaseSystem<{ stateVersion: 1 }> {
  readonly id = '06';
  readonly order = 6;
  constructor(private readonly weather: string) {
    super();
  }
  override reader(): { state(): string; surfaceTempC(): number } {
    return { state: () => this.weather, surfaceTempC: () => 10 };
  }
  serialize(): { stateVersion: 1 } {
    return { stateVersion: 1 };
  }
  deserialize(): void {}
}

export function withWeather(standard: GameSystem[], weather: string): GameSystem[] {
  return [...standard, new FixedWeather(weather)];
}
