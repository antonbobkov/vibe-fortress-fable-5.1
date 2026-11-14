/**
 * What a site has and lacks: `02-systems/02-embark-and-loadout.md` § What a site has and lacks;
 * the rows are `03-content/regions-biomes-and-traits.md` § Signatures.
 *
 * The site summary shows the two lists, and 20 prices a merchant good the site lacks at the
 * scarcity price (`20-trade-and-caravans.md` § The scarcity price). Both read this module, so the
 * summary's lacks line is the list the merchants charge for.
 */

import type { Registry } from '@core/registry';
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

/** A site's goods: material ids, material classes and the signature words, in table order. */
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
 * Whether the game has a good yet: a material id or class with a material, a word whose item,
 * material or species exists. A word whose content is still to come (`honey` before there is
 * honey, `camels` before camels) is left out of the summary and the price.
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
 * A site's has and lacks: the union of its biome's, its geology's and its traits' has; the union of
 * their lacks less anything in its has. Goods the game does not have yet are left out.
 */
export function siteSignature(spec: LocalMapSpec, registry: Registry): SiteSignature {
  const rows = rowsOf(spec, registry);
  const has: string[] = [];
  const lacks: string[] = [];
  for (const row of rows) for (const good of row.has) if (!has.includes(good)) has.push(good);
  for (const row of rows) for (const good of row.lacks) if (!lacks.includes(good) && !has.includes(good)) lacks.push(good);
  return {
    has: has.filter((good) => signatureGoodExists(registry, good)),
    lacks: lacks.filter((good) => signatureGoodExists(registry, good)),
  };
}

/** Whether a good names a material: its id, its class, the flux tag for `flux`, or the word's material. */
export function goodCovers(good: string, material: MaterialRow): boolean {
  if (good === material.id || good === material.class) return true;
  if (good === 'flux') return material.tags?.includes('flux') === true;
  return WORD_MATERIALS[good]?.includes(material.id) === true;
}

/**
 * Whether the site lacks a material (20 § The scarcity price): a good of its lacks names it, and no
 * good of its has does (a mountain lacks soil but has sand, so sand is not scarce there).
 */
export function lacksMaterial(signature: SiteSignature, registry: Registry, materialIndex: number): boolean {
  const material = registry.table<MaterialRow>('materials').byIndex(materialIndex);
  if (material === undefined) return false;
  return signature.lacks.some((good) => goodCovers(good, material)) && !signature.has.some((good) => goodCovers(good, material));
}
