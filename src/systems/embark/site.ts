/**
 * The site summary of the world map: `02-systems/02-embark-and-loadout.md` § Site summary;
 * `04-implementation/ui-screens/menus-and-world.md` § World map.
 *
 * Everything here is read from the region's `LocalMapSpec` and the content tables that 03 local
 * map generation reads, through the generator's own helpers, so the summary says what the local
 * map will have. Counts and ores are estimates: generation rolls them, and the screen says so.
 */

import { LOCAL_MAP_H, LOCAL_MAP_W, MAGMA_SEA_TOP_Z } from '@core/constants';
import { FIXED_SCALE, type Fixed } from '@core/fixed';
import type { Registry } from '@core/registry';
import type { Edge } from '@core/types';
import { FROSTMARROW_YAK, FROSTMARROW_YAK_WEIGHT, SERENE_VALE_BANNED } from '@systems/animals/constants';
import { FREEZE_C } from '@systems/fluids/constants';
import { baseSurfaceZ, RELIEF_AMPLITUDE } from '@systems/terrain/generate/height';
import { BASEMENT, GLASSLANDS_FIRST_LAYER, specSoilDepth } from '@systems/terrain/generate/layers';
import { expectedOreCount } from '@systems/terrain/generate/minerals';
import { carvesLake, carvesRiver } from '@systems/terrain/generate/rivers';
import { surfaceTreeDensity } from '@systems/terrain/generate/vegetation';
import { SUMMER, WINTER, seasonBase, temperSpread, type Climate } from '@systems/weather/transitions';
import type { LocalMapSpec } from './spec';

export type TemperatureBand = 'frozen' | 'cold' | 'temperate' | 'warm' | 'hot';

/** What a site has and lacks. Ids are content ids; the screen names them. */
export interface SiteSummary {
  /** Surface soil: its depth in levels and its materials, most common first; null for none. */
  readonly soil: { readonly depth: number; readonly materials: readonly string[] } | null;
  /** With no soil, what the ground is: the biome's bare `rock`, or `glasslands` `obsidian`. */
  readonly ground: 'soil' | 'rock' | 'obsidian';
  /** Trees on the surface: the expected count and the species, most common first; null for none. */
  readonly trees: { readonly estimate: number; readonly species: readonly string[] } | null;
  /** Wild shrubs: the expected count and the species, most common first; null for none. */
  readonly shrubs: { readonly estimate: number; readonly species: readonly string[] } | null;
  /** Grass on the open soil, for grazing. */
  readonly grass: boolean;
  readonly water: {
    /** The river the local map carves, or null. */
    readonly river: { readonly class: string; readonly inflow: readonly Edge[]; readonly outflow: Edge | null } | null;
    readonly lake: boolean;
    /** `gemsprings` warm springs (they lie on soil, and never freeze). */
    readonly springs: boolean;
    /** The winter's mean is below the freezing point: the river or lake likely freezes. */
    readonly freezes: boolean;
  };
  /** The geology class and its rock layers, top down. */
  readonly stone: { readonly geology: string; readonly layers: readonly string[] };
  /** Ores of at least one expected vein or cluster in a layer the map reaches, most first. */
  readonly ores: readonly string[];
  /** The wealth gives deepsilver veins by the Sea of Fire. */
  readonly deepsilver: boolean;
  readonly climate: {
    readonly band: TemperatureBand;
    readonly meanC: number;
    readonly summerC: number;
    readonly winterC: number;
    /** `frostmarrow`: spring and autumn take winter's values. */
    readonly longWinter: boolean;
  };
  /** Surface wildlife, most common first: aggressive or territorial species, and the rest. */
  readonly wildlife: { readonly dangerous: readonly string[]; readonly other: readonly string[] };
  /** The missing essentials, in this order. */
  readonly lacks: readonly ('soil' | 'trees' | 'water')[];
}

interface BiomeRow {
  readonly id: string;
  readonly referenceTempC: number;
  readonly seasonTemp: readonly number[];
  readonly soil: readonly { readonly material: string; readonly weight: number }[];
  readonly treeDensity: Fixed;
  readonly shrubDensity: Fixed;
}

interface PlantRow {
  readonly id: string;
  readonly kind: string;
  readonly biomes?: readonly { readonly biome: string; readonly weight: number }[];
  readonly convert?: {
    readonly tiles: readonly { readonly tile: string; readonly permille: number }[];
    readonly any?: boolean;
    readonly biomes?: readonly { readonly biome: string; readonly times?: number; readonly permille?: number }[];
  };
}

interface CreatureRow {
  readonly id: string;
  readonly temper: string;
  readonly factionDefault: string;
  readonly biomes?: readonly { readonly biome: string; readonly weight: number }[];
}

interface MineralRow {
  readonly id: string;
  /** `ore`, or `bone` for a fossil, which the summary does not list as an ore. */
  readonly class?: string;
  readonly hosts: readonly string[];
  readonly count: number;
  readonly deepsilver?: boolean;
  readonly tags?: readonly string[];
}

interface TemplateRow {
  readonly id: string;
  readonly layers: readonly { readonly material: string; readonly min: number; readonly max: number }[];
}

interface WealthRow {
  readonly wealth: number;
  readonly ore: Fixed;
  readonly deepsilverVeins: number;
}

/** `01` § Biomes, the temperature bands. */
export function temperatureBandOf(tempC: number): TemperatureBand {
  if (tempC < -5) return 'frozen';
  if (tempC < 5) return 'cold';
  if (tempC < 18) return 'temperate';
  if (tempC <= 26) return 'warm';
  return 'hot';
}

/** Ids by weight, heaviest first, ties by id. */
function byWeight(rows: readonly (readonly [string, number])[]): string[] {
  return [...rows].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map((r) => r[0]);
}

function weightIn(rows: readonly { readonly biome: string; readonly weight: number }[] | undefined, biome: string): number {
  return rows?.find((b) => b.biome === biome)?.weight ?? 0;
}

/** The species of a plant kind in a biome, by weight. */
function plantsOf(registry: Registry, kind: string, biome: string): string[] {
  const plants = registry.table<PlantRow>('plants');
  const rows: [string, number][] = [];
  for (const id of plants.ids()) {
    const p = plants.byId(id) as PlantRow;
    const w = p.kind === kind ? weightIn(p.biomes, biome) : 0;
    if (w > 0) rows.push([id, w]);
  }
  return byWeight(rows);
}

/** A conversion row that applies to a site: its plant, kind and per-tile permille there. */
interface Conversion {
  readonly id: string;
  readonly kind: string;
  readonly tiles: readonly { readonly tile: string; readonly permille: number }[];
}

/**
 * The conversions of 03 (end of stage 10) that may place a plant here (`plants.md` § Conversions): a
 * row that names the biome, or an every-region row whose tiles lie by surface water when the site
 * has a river or a lake. A row on `ash_soil` alone never applies: no generated surface is ash.
 */
function conversionsOf(registry: Registry, biome: string, wet: boolean): Conversion[] {
  const plants = registry.table<PlantRow>('plants');
  const out: Conversion[] = [];
  for (const id of plants.ids()) {
    const p = plants.byId(id) as PlantRow;
    const conv = p.convert;
    if (conv === undefined) continue;
    const entry = conv.biomes?.find((b) => b.biome === biome);
    const byWater = conv.any === true && wet && conv.tiles.some((t) => t.tile === 'near_water' || t.tile === 'shallow');
    if (entry === undefined && !byWater) continue;
    const times = entry?.times ?? 1;
    out.push({ id, kind: p.kind, tiles: conv.tiles.map((t) => ({ tile: t.tile, permille: (entry?.permille ?? t.permille) * times })) });
  }
  return out;
}

/**
 * The shrubs the conversions add on open ground, as an estimate: each row's permille of the soil
 * floors left bare of trees and shrubs (`grass`, `dry_soil`, and `sand` by its share of the soil),
 * and of every surface tile when the ground is bare rock (`rock`). A shrub or tree turned is no new
 * plant, and the tiles by the water are too few to count.
 */
function convertedShrubs(conversions: readonly Conversion[], bareSoil: number, rock: number, sandShare: number): number {
  let n = 0;
  for (const c of conversions) {
    if (c.kind !== 'shrub') continue;
    for (const t of c.tiles) {
      const area = t.tile === 'grass' || t.tile === 'dry_soil' ? bareSoil : t.tile === 'sand' ? (bareSoil * sandShare) / FIXED_SCALE : t.tile === 'rock' ? rock : 0;
      n += (area * t.permille) / FIXED_SCALE;
    }
  }
  return Math.round(n);
}

/**
 * The rock materials the map is sure to reach: the layers of the rolled stack (`glasslands`
 * basalt first, the template, then the basement pairs) whose deepest possible top lies above the
 * lowest rock level under the lowest possible surface.
 */
function reachedLayers(registry: Registry, spec: LocalMapSpec, soil: number): string[] {
  const template = registry.table<TemplateRow>('geologyTemplates').byId(spec.geology);
  const layers: { material: string; max: number }[] = [];
  if (spec.traits.includes('glasslands')) layers.push({ material: GLASSLANDS_FIRST_LAYER.material, max: GLASSLANDS_FIRST_LAYER.max });
  for (const l of template?.layers ?? []) layers.push({ material: l.material, max: l.max });
  const lowestSurface = baseSurfaceZ(spec.elevation) - (RELIEF_AMPLITUDE[spec.relief] ?? 0);
  // Rock runs from below the soil down to MAGMA_SEA_TOP_Z + 2; undulation shifts a layer by 1.
  const reach = lowestSurface - soil - (MAGMA_SEA_TOP_Z + 2) - 1;
  const out: string[] = [];
  let top = 0;
  for (let k = 0; top < reach; k += 1) {
    const layer = k < layers.length ? (layers[k] as { material: string; max: number }) : (BASEMENT[(k - layers.length) % BASEMENT.length] as { material: string; max: number });
    if (!out.includes(layer.material)) out.push(layer.material);
    top += layer.max;
  }
  return out;
}

/** The summary of one region's site, from its local map spec. */
export function siteSummary(spec: LocalMapSpec, registry: Registry): SiteSummary {
  const biome = registry.table<BiomeRow>('biomes').byId(spec.biome);
  if (biome === undefined) throw new RangeError(`siteSummary: unknown biome ${spec.biome}`);
  const tiles = LOCAL_MAP_W * LOCAL_MAP_H;
  const glass = spec.traits.includes('glasslands');
  const serene = spec.traits.includes('serene_vale');

  // 03 stage 3: soil depth by biome (+2 serene_vale, loam only); glasslands lays obsidian instead.
  const depth = specSoilDepth(spec);
  const materials = serene ? ['loam'] : byWeight(biome.soil.map((s) => [s.material, s.weight] as const));
  const hasSoil = !glass && depth > 0 && materials.length > 0;
  const soil = hasSoil ? { depth, materials } : null;

  // 03 stage 9: trees and shrubs only on soil; grass on the soil that is left.
  const river = carvesRiver(spec);
  const treeDensity = surfaceTreeDensity(spec.traits, biome);
  const treeSpecies = plantsOf(registry, 'tree', spec.biome);
  if (river) for (const id of plantsOf(registry, 'tree', 'riverbank')) if (!treeSpecies.includes(id)) treeSpecies.push(id);
  const trees = hasSoil && treeDensity > 0 && treeSpecies.length > 0
    ? { estimate: Math.round((treeDensity * tiles) / FIXED_SCALE), species: treeSpecies }
    : null;
  const shrubSpecies = hasSoil && biome.shrubDensity > 0 ? plantsOf(registry, 'shrub', spec.biome) : [];
  // 03 stage 10 conversions: the converted plants are listed after their kind's own species, and
  // the shrubs they add on open ground counted in.
  const conversions = conversionsOf(registry, spec.biome, river || carvesLake(spec));
  for (const c of conversions) if (c.kind === 'tree' && trees !== null && !treeSpecies.includes(c.id)) treeSpecies.push(c.id);
  const baseShrubs = shrubSpecies.length > 0 ? Math.round(((FIXED_SCALE - treeDensity) * biome.shrubDensity * tiles) / (FIXED_SCALE * FIXED_SCALE)) : 0;
  const bareSoil = hasSoil ? ((FIXED_SCALE - treeDensity) * (FIXED_SCALE - biome.shrubDensity) * tiles) / (FIXED_SCALE * FIXED_SCALE) : 0;
  const soilWeight = biome.soil.reduce((sum, s) => sum + s.weight, 0);
  const sandShare = serene || soilWeight <= 0 ? 0 : Math.round(((biome.soil.find((s) => s.material === 'sand')?.weight ?? 0) * FIXED_SCALE) / soilWeight);
  const added = convertedShrubs(conversions, bareSoil, hasSoil ? 0 : tiles, sandShare);
  for (const c of conversions) {
    if (c.kind !== 'shrub' || shrubSpecies.includes(c.id)) continue;
    // A shrub conversion appears where its tiles exist: existing shrubs, or the open ground it counted.
    if (baseShrubs > 0 || convertedShrubs([c], bareSoil, hasSoil ? 0 : tiles, sandShare) > 0 || c.tiles.some((t) => t.tile === 'near_water' || t.tile === 'shallow')) shrubSpecies.push(c.id);
  }
  const shrubs = shrubSpecies.length > 0 && baseShrubs + added > 0 ? { estimate: baseShrubs + added, species: shrubSpecies } : null;

  // 06: the season's base plus the temper spread, as the weather system computes it.
  const climate: Climate = {
    seasonTemp: biome.seasonTemp,
    referenceTempC: biome.referenceTempC,
    tempC: spec.tempC ?? biome.referenceTempC,
    temper: spec.temper,
    traits: spec.traits,
  };
  const winterC = seasonBase(WINTER, climate) + temperSpread(WINTER, climate);
  const summerC = seasonBase(SUMMER, climate) + temperSpread(SUMMER, climate);

  // 03 stage 2 (rivers, lakes) and stage 10 (gemsprings' springs, on dry surface soil).
  const water = {
    river: river && spec.river !== null ? { class: spec.river.class, inflow: spec.river.inflowEdges, outflow: spec.river.outflowEdge } : null,
    lake: carvesLake(spec),
    springs: hasSoil && spec.traits.includes('gemsprings'),
    freezes: winterC < FREEZE_C,
  };

  // 03 stages 4 and 7: the layer template and the ores hosted in the layers the map reaches.
  const template = registry.table<TemplateRow>('geologyTemplates').byId(spec.geology);
  const stack = [...(glass ? [GLASSLANDS_FIRST_LAYER.material] : []), ...(template?.layers ?? []).map((l) => l.material)];
  const layers = stack.filter((m, k) => stack.indexOf(m) === k);
  const reached = reachedLayers(registry, spec, hasSoil ? depth : 0);
  const mult = registry.derived<readonly WealthRow[]>('wealthMultipliers').find((w) => w.wealth === spec.wealth);
  const minerals = registry.table<MineralRow>('minerals');
  const ores: [string, number][] = [];
  for (const id of minerals.ids()) {
    const m = minerals.byId(id) as MineralRow;
    if (m.deepsilver === true || mult === undefined || (m.class !== undefined && m.class !== 'ore')) continue;
    const expected = expectedOreCount(m, mult.ore, spec.traits);
    if (expected >= FIXED_SCALE && m.hosts.some((h) => reached.includes(h))) ores.push([id, expected]);
  }

  // 08: the biome's surface species, without serene_vale's banned ones.
  const creatures = registry.table<CreatureRow>('creatures');
  const dangerous: [string, number][] = [];
  const other: [string, number][] = [];
  for (const id of creatures.ids()) {
    const c = creatures.byId(id) as CreatureRow;
    const w = c.factionDefault === 'wild' ? weightIn(c.biomes, spec.biome) : 0;
    if (w <= 0 || (serene && SERENE_VALE_BANNED.includes(id))) continue;
    (c.temper === 'aggressive' || c.temper === 'territorial' ? dangerous : other).push([id, w]);
  }
  // `frostmarrow` brings wild yaks (08 § Wild spawning, T-445).
  if (spec.traits.includes('frostmarrow') && creatures.byId(FROSTMARROW_YAK) !== undefined && !other.some(([id]) => id === FROSTMARROW_YAK)) other.push([FROSTMARROW_YAK, FROSTMARROW_YAK_WEIGHT]);

  const lacks: ('soil' | 'trees' | 'water')[] = [];
  if (soil === null) lacks.push('soil');
  if (trees === null) lacks.push('trees');
  if (water.river === null && !water.lake && !water.springs) lacks.push('water');

  return {
    soil,
    ground: hasSoil ? 'soil' : glass ? 'obsidian' : 'rock',
    trees,
    shrubs,
    grass: hasSoil,
    water,
    stone: { geology: spec.geology, layers },
    ores: byWeight(ores),
    deepsilver: (mult?.deepsilverVeins ?? 0) > 0,
    climate: {
      band: temperatureBandOf(climate.tempC),
      meanC: climate.tempC,
      summerC,
      winterC,
      longWinter: spec.traits.includes('frostmarrow'),
    },
    wildlife: { dangerous: byWeight(dangerous), other: byWeight(other) },
    lacks,
  };
}
