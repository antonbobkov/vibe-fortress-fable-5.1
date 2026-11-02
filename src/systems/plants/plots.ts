/**
 * Farm plots: `02-systems/07-plants-and-farming.md` § Farm plots, and the command-catalog row
 * `SetPlotCrop { zoneId, season, speciesId | 0 }` ("zone is a farm plot; species light matches the
 * plot kind (`light_mismatch`)").
 *
 * A plot's four season slots live on the zone entity, under the `farm_plot` zone type's own
 * settings key of `03-content/buildings-and-furniture.md` ("crop per season"), exactly as
 * `07` § State prescribes ("settings stored on the zone entity; this system keeps the index").
 * docs/02-systems/07-plants-and-farming.md § Farm plots.
 */

import { SEASONS_PER_YEAR } from '@core/constants';
import { TileFlag, type Map3D } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { RegistryTable } from '@core/registry';
import type { PlantRow } from './facts';

/** The zone type of a farm plot. */
export const FARM_PLOT = 'farm_plot';

/** The zone setting key, `settingKey('crop per season')`. */
export const CROP_SETTING = 'crop_per_season';

/**
 * `07` § Farm plots: "a plot with any `lit` tile is a surface plot; a plot with no `lit` tile is a cave plot";
 * a cave plot with every tile under a lamp is a glow plot.
 */
export type PlotKind = 'surface' | 'cave' | 'glow' | 'mixed';

/** Surface when every tile is lit, cave or glow when none is, mixed otherwise ("mixed plots are refused"). */
export function plotKindOf(map: Map3D, tiles: readonly TileIndex[], cropLitAt: (tile: TileIndex) => boolean =
  (tile) => map.hasFlag(tile, TileFlag.Lit), lampCoveredAt: (tile: TileIndex) => boolean = () => false): PlotKind {
  let lit = 0;
  for (const t of tiles) if (map.validIndex(t) && cropLitAt(t)) lit += 1;
  if (lit === 0) return tiles.length > 0 && tiles.every(lampCoveredAt) ? 'glow' : 'cave';
  if (lit === tiles.length) return 'surface';
  return 'mixed';
}

/** "each `none` or a species whose light requirement matches the plot". */
export function lightMatches(row: PlantRow, kind: PlotKind): boolean {
  if (row.light === 'sun') return kind === 'surface';
  if (row.light === 'dark') return kind === 'cave' || kind === 'glow';
  if (row.light === 'glow') return kind === 'glow';
  return kind !== 'mixed';
}

/** The four season slots of a plot's settings, as plant indices (0 = none). */
export function cropsOf(settings: Readonly<Record<string, unknown>>): number[] {
  const raw = settings[CROP_SETTING];
  const out: number[] = new Array<number>(SEASONS_PER_YEAR).fill(0);
  if (!Array.isArray(raw)) return out;
  for (let s = 0; s < SEASONS_PER_YEAR; s += 1) {
    const v = (raw as unknown[])[s];
    if (typeof v === 'number' && Number.isInteger(v) && v > 0) out[s] = v;
  }
  return out;
}

/** The settings record a `SetPlotCrop` leaves behind. */
export function withCrop(
  settings: Readonly<Record<string, unknown>>,
  season: number,
  plant: number,
): Record<string, unknown> {
  const crops = cropsOf(settings);
  crops[season] = plant;
  return { ...settings, [CROP_SETTING]: crops };
}

/** Resolve a typed crop choice with the same farmed-species and light rules for every setting path. */
export function cropChoice(raw: unknown, plants: RegistryTable<PlantRow>, kind: PlotKind):
  { ok: true; plant: number } | { ok: false; reason: 'not_found' | 'light_mismatch' } {
  const plant = typeof raw === 'string' ? (plants.has(raw) ? plants.index(raw) : -1) : raw;
  if (typeof plant !== 'number' || !Number.isInteger(plant) || plant < 0) return { ok: false, reason: 'not_found' };
  if (plant === 0) return { ok: true, plant };
  const row = plants.byIndex(plant);
  if (row === undefined || (row.kind !== 'crop' && row.kind !== 'cave_crop')) return { ok: false, reason: 'not_found' };
  if (!lightMatches(row, kind)) return { ok: false, reason: 'light_mismatch' };
  return { ok: true, plant };
}
