/**
 * Stage 8: traits. `02-systems/01-world-generation.md` § Traits; `algorithms/world-generation.md`
 * step 8; the trait table and its requirements are content (`regions-biomes-and-traits.md`
 * § Region traits).
 */

import { RATING_MAX } from '@core/constants';
import type { Registry } from '@core/registry';
import { TRAIT_MAX_PER_REGION } from '../constants';
import type { GenRegion, GenWorld } from '../state';
import { stageStream, tempBand } from './common';

export interface TraitRequirements {
  readonly biomes?: readonly string[];
  readonly notBiomes?: readonly string[];
  readonly tempBands?: readonly string[];
  readonly peril?: readonly [number, number];
  readonly wealth?: readonly [number, number];
  readonly temper?: readonly [number, number];
  readonly deepness?: readonly [number, number];
  readonly river?: boolean;
  readonly volcano?: boolean;
  readonly geology?: readonly string[];
}

export interface RegionTraitRow {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly requirements: TraitRequirements;
  readonly freq: number;
  readonly companion: boolean;
  readonly hooks: Readonly<Record<string, unknown>>;
}

interface BiomeRow {
  readonly id: string;
  readonly embarkable: boolean;
}

/** The trait rows in table order (`order`), the order the roll walks them in. */
export function traitsInTableOrder(registry: Registry): RegionTraitRow[] {
  const table = registry.table<RegionTraitRow>('regionTraits');
  return table
    .ids()
    .map((id) => table.byId(id) as RegionTraitRow)
    .sort((a, b) => a.order - b.order);
}

function within(v: number, range: readonly [number, number] | undefined): boolean {
  return range === undefined || (v >= range[0] && v <= range[1]);
}

/** `meets(t.requirements, r)`: every stated requirement holds. */
export function meets(req: TraitRequirements, r: GenRegion): boolean {
  if (req.biomes !== undefined && !req.biomes.includes(r.biome)) return false;
  if (req.notBiomes !== undefined && req.notBiomes.includes(r.biome)) return false;
  if (req.tempBands !== undefined && !req.tempBands.includes(tempBand(r.tempC))) return false;
  if (!within(r.peril, req.peril)) return false;
  if (!within(r.wealth, req.wealth)) return false;
  if (!within(r.temper, req.temper)) return false;
  if (!within(r.deepness, req.deepness)) return false;
  if (req.river === true && r.river === null) return false;
  if (req.volcano === true && !r.volcano) return false;
  if (req.geology !== undefined && !req.geology.includes(r.geology)) return false;
  return true;
}

/**
 * The trait's rating overrides, from its `01` hook ("wealth +1", "temper +1"); `serene_vale`'s
 * "peril fixed at 0" is its requirement `peril 0` and needs no override.
 */
export function applyRatingHooks(trait: RegionTraitRow, r: GenRegion): void {
  const hook = trait.hooks['01'];
  if (typeof hook !== 'string') return;
  const re = /(wealth|peril|temper)\s*([+-])\s*(\d+)/g;
  for (let m = re.exec(hook); m !== null; m = re.exec(hook)) {
    const key = m[1] as 'wealth' | 'peril' | 'temper';
    const delta = Number(m[3]) * (m[2] === '-' ? -1 : 1);
    r[key] = Math.max(0, Math.min(RATING_MAX, r[key] + delta));
  }
}

/**
 * Roll the traits of one region: in table order, each eligible trait rolls its permille; a success
 * is kept, and stops the roll if the trait allows no companion or the region is full.
 */
export function rollTraits(
  r: GenRegion,
  traits: readonly RegionTraitRow[],
  chance: (permille: number) => boolean,
): void {
  const eligible = traits.filter((t) => meets(t.requirements, r));
  for (const t of eligible) {
    if (!chance(t.freq)) continue;
    r.traits.push(t.id);
    if (!t.companion) break;
    if (r.traits.length === TRAIT_MAX_PER_REGION) break;
  }
  for (const id of r.traits) {
    const t = traits.find((row) => row.id === id);
    if (t !== undefined) applyRatingHooks(t, r);
  }
}

/**
 * Stage 8. Traits are rolled only for regions that can be embarked on: `ocean` and `glacier`
 * carry none (`acceptance-tests.md` `wg_ratings`; DECISIONS.md D-042).
 */
export function stageTraits(g: GenWorld, registry: Registry): void {
  const st = stageStream(g.s, 'worldgen.traits');
  const traits = traitsInTableOrder(registry);
  const biomes = registry.table<BiomeRow>('biomes');
  for (const r of g.regions) {
    if (biomes.byId(r.biome)?.embarkable !== true) continue;
    rollTraits(r, traits, (permille) => st.chance(permille));
  }
}
