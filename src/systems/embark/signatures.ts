/**
 * What a site has and lacks: `02-systems/02-embark-and-loadout.md` § What a site has and lacks;
 * the rows are `03-content/regions-biomes-and-traits.md` § Signatures.
 *
 * The site summary shows the two lists, and 20 prices a merchant good the site lacks at the
 * scarcity price (`20-trade-and-caravans.md` § The scarcity price). Both read this module, so the
 * summary's lacks line is the list the merchants charge for.
 */

import type { Registry } from '@core/registry';
import { specSoilDepth } from '@systems/terrain/generate/layers';
import type { LocalMapSpec } from './spec';

interface SignatureRow {
  readonly id: string;
  readonly has: readonly string[];
  readonly lacks: readonly string[];
}

interface MaterialRow {
  readonly id: string;
  readonly class: string;
  readonly tags?: readonly string[];
}

interface BiomeSoilRow {
  readonly id: string;
  readonly soil: readonly { readonly material: string; readonly weight: number }[];
}

/** The tag of the soils a dug wall or a channelled floor drops as a `soil_load` (`materials.md` § Soil). */
export const SOIL_DROP_TAG = 'soil_drop';

/** A site's goods: material ids, material classes and the signature words; its soil goods first, then table order. */
export interface SiteSignature {
  readonly has: readonly string[];
  readonly lacks: readonly string[];
}

/** The words a map gets only by a roll of its generator (03 stage 7's fossils, the boneyards): "likely". */
export const SIGNATURE_LIKELY: readonly string[] = ['fossils', 'giant_bones'];

/** The material a signature word stands for, where it stands for one. */
const WORD_MATERIALS: Readonly<Record<string, readonly string[]>> = {
  honey: ['honey'],
  fossils: ['giant_bone'],
  giant_bones: ['giant_bone'],
  ice: ['ice'],
};

/** The species a signature word stands for. */
const WORD_SPECIES: Readonly<Record<string, string>> = { horses: 'horse', camels: 'camel', reindeer: 'reindeer' };

/** The rows that apply to a site: its biome's, its geology's, then its traits' in the spec's order. */
function rowsOf(spec: LocalMapSpec, registry: Registry): SignatureRow[] {
  const table = registry.table<SignatureRow>('signatures');
  const keys = [spec.biome, `geology:${spec.geology}`, ...spec.traits.map((t) => `trait:${t}`)];
  return keys.flatMap((key) => {
    const row = table.byId(key);
    return row === undefined ? [] : [row];
  });
}

/**
 * The surface soil the local map is laid with (03 § Local map generation, stage 3): the biome's
 * soil materials, most common first (ties by id); `loam` alone on a `serene_vale`; none at soil
 * depth 0 or in the `glasslands`, whose surface is obsidian.
 */
export function siteSoilMaterials(spec: LocalMapSpec, registry: Registry): string[] {
  const biome = registry.table<BiomeSoilRow>('biomes').byId(spec.biome);
  if (biome === undefined || spec.traits.includes('glasslands') || specSoilDepth(spec) <= 0) return [];
  if (spec.traits.includes('serene_vale')) return ['loam'];
  return [...biome.soil].sort((a, b) => b.weight - a.weight || (a.material < b.material ? -1 : a.material > b.material ? 1 : 0)).map((s) => s.material);
}

/** The site's soil goods: the materials of its surface soil tagged `soil_drop`, most common first. */
export function siteSoilGoods(spec: LocalMapSpec, registry: Registry): string[] {
  const materials = registry.table<MaterialRow>('materials');
  return siteSoilMaterials(spec, registry).filter((id) => materials.byId(id)?.tags?.includes(SOIL_DROP_TAG) === true);
}

/**
 * Whether the game has a good yet: a material id or class with a material, a word whose item,
 * material or species exists. A word whose content is still to come (`honey` before there was
 * honey, `camels` before there were camels) is left out of the summary and the price.
 */
export function signatureGoodExists(registry: Registry, good: string): boolean {
  const species = WORD_SPECIES[good];
  if (species !== undefined) return registry.table('creatures').has(species);
  const materials = registry.table<MaterialRow>('materials');
  if (good === 'flux') return materials.ids().some((id) => materials.byId(id)?.tags?.includes('flux') === true);
  const words = WORD_MATERIALS[good];
  if (words !== undefined) return words.some((id) => materials.has(id)) || (good === 'honey' && registry.table('items').has('honey'));
  if (materials.has(good)) return true;
  return materials.ids().some((id) => materials.byId(id)?.class === good);
}

/**
 * A site's has and lacks: its soil goods (the rows name none), then the union of its biome's, its
 * geology's and its traits' has; the union of their lacks less anything in its has. Goods the game
 * does not have yet are left out.
 */
export function siteSignature(spec: LocalMapSpec, registry: Registry): SiteSignature {
  const rows = rowsOf(spec, registry);
  const has: string[] = siteSoilGoods(spec, registry);
  const lacks: string[] = [];
  for (const row of rows) for (const good of row.has) if (!has.includes(good)) has.push(good);
  for (const row of rows) for (const good of row.lacks) if (!lacks.includes(good) && !has.includes(good)) lacks.push(good);
  return {
    has: has.filter((good) => signatureGoodExists(registry, good)),
    lacks: lacks.filter((good) => signatureGoodExists(registry, good)),
  };
}

/**
 * How closely a good names a material: 3 by its id, 2 by a word (`flux` for a `flux`-tagged stone,
 * `giant_bones` for `giant_bone`), 1 by its class, 0 not at all.
 */
export function goodCovers(good: string, material: MaterialRow): number {
  if (good === material.id) return 3;
  if (good === 'flux' && material.tags?.includes('flux') === true) return 2;
  if (WORD_MATERIALS[good]?.includes(material.id) === true) return 2;
  return good === material.class ? 1 : 0;
}

/**
 * Whether the site lacks a material (20 § The scarcity price): a good of its lacks names it more
 * closely than any good of its has. A mountain lacks soil but has sand, so its sand is not scarce;
 * an igneous mountain has stone but lacks flux, so its limestone is.
 */
export function lacksMaterial(signature: SiteSignature, registry: Registry, materialIndex: number): boolean {
  const material = registry.table<MaterialRow>('materials').byIndex(materialIndex);
  if (material === undefined) return false;
  const closest = (goods: readonly string[]): number => goods.reduce((best, good) => Math.max(best, goodCovers(good, material)), 0);
  return closest(signature.lacks) > closest(signature.has);
}
