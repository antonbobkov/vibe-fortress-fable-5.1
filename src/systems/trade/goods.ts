/** Caravan cargo from the authored `caravanGoods` table. */
import { CARAVAN_BUNDLE_UNITS, CARAVAN_VALUE_BASE, CARAVAN_VALUE_PER_RENOWN, CARAVAN_VALUE_PER_REP, REQUEST_SHARE } from './constants';
import type { TradeRequest } from './state';
import type { Civ } from '@core/types';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import { itemValue } from '@systems/items/value';

interface MaterialChoice { material: string; weight: number }
export interface GoodsEntry {
  item: string | string[];
  materials: MaterialChoice[];
  count: [number, number];
  weight: number;
  rare?: boolean;
  /** Drawn outside the weighted pool, past the budget, on system 25's stream. */
  extra?: { permille: number; minReputation?: number };
}
interface CivGoods { civ: Civ; entries: GoodsEntry[] }
interface ItemRow { id: string; mult: number; quality: boolean; tags?: string[] }
interface MaterialRow { id: string; class: string; value: number }
interface SpeciesRow { id: string; value: number }

export interface PlannedGood {
  type: number; material: number; count: number; value: number; species?: number;
  container?: number;
  companion?: { type: number; material: number; count: number };
  /** An `extra` good: it comes on top of the budget and adds no pack animal. */
  extra?: true;
}

export function caravanBudget(renown: number, reputation: number): number {
  return Math.max(0, CARAVAN_VALUE_BASE + renown * CARAVAN_VALUE_PER_RENOWN + reputation * CARAVAN_VALUE_PER_REP);
}

function entriesFor(registry: Registry, civ: Civ): GoodsEntry[] {
  return (registry.derived<readonly CivGoods[]>('caravanGoods').find((row) => row.civ === civ)?.entries ?? []);
}

export function eligibleGoodsEntries(registry: Registry, civ: Civ, reputation: number): GoodsEntry[] {
  return entriesFor(registry, civ).filter((entry) => {
    if (entry.materials.length === 1 && entry.materials[0]?.material === 'deepsilver') return reputation >= 75;
    return true;
  }).map((entry) => {
    const keys = Array.isArray(entry.item) ? entry.item : [entry.item];
    if (reputation < 50) return entry;
    if (civ === 'mountainhome' && keys.includes('bar') && entry.materials.some((m) => m.material === 'steel')) {
      return { ...entry, materials: entry.materials.map((m) => m.material === 'steel' ? { ...m, weight: 30 } : m) };
    }
    if (civ === 'mountainhome' && keys.includes('helm')) return { ...entry, item: [...keys, 'breastplate'] };
    if (civ === 'mountainhome' && keys.includes('cut_gem')) return { ...entry, materials: [...entry.materials, { material: 'ruby', weight: 1 }, { material: 'sapphire', weight: 1 }] };
    if (civ === 'mountainhome' && keys.includes('dog')) return { ...entry, item: [...keys, 'cave_ox'] };
    if (civ === 'hillfolk' && keys.includes('easy_meal')) return { ...entry, item: [...keys, 'fine_meal'] };
    if (civ === 'hillfolk' && keys.includes('cow')) return { ...entry, item: [...keys, 'horse'] };
    if (civ === 'wildwood' && keys.includes('dog')) return { ...entry, item: [...keys, 'bear', 'lynx'] };
    return entry;
  });
}

function resolveType(registry: Registry, key: string, rng: RngStream): number {
  const types = registry.table<ItemRow>('items');
  if (types.has(key)) return types.index(key);
  const tagged = types.ids().filter((id) => types.byId(id)?.tags?.includes(key));
  return tagged.length > 0 ? types.index(rng.pick(tagged)) : 0;
}

function resolveMaterial(registry: Registry, key: string, reputation: number, rng: RngStream): number {
  const materials = registry.table<MaterialRow>('materials');
  if (materials.has(key)) return materials.index(key);
  const byClass = materials.ids().filter((id) => materials.byId(id)?.class === key && (id !== 'deepsilver' || reputation >= 75));
  return byClass.length > 0 ? materials.index(rng.pick(byClass)) : 0;
}

function drawGood(registry: Registry, entry: GoodsEntry, reputation: number, rng: RngStream, requested?: TradeRequest): PlannedGood | null {
  const keys = Array.isArray(entry.item) ? entry.item : [entry.item];
  const packaged = keys.includes('drink') || keys.includes('seed') || keys.includes('flour');
  const paired = keys.includes('crossbow') || keys.includes('bandage');
  const key = requested?.itemType ?? (packaged || paired ? keys[0] as string : rng.pick(keys));
  if (!keys.includes(key)) return null;
  const species = registry.table<SpeciesRow>('creatures');
  if (species.has(key) && entry.materials.length === 0) {
    const cage = registry.table<ItemRow>('items').byId('cage');
    const pine = registry.table<MaterialRow>('materials').byId('pine');
    const kind = species.byId(key);
    if (!cage || !pine || !kind) return null;
    const count = rng.int(entry.count[0], entry.count[1]) * (CARAVAN_BUNDLE_UNITS[key] ?? 1);
    return {
      type: registry.table('items').index('cage'), material: registry.table('materials').index('pine'),
      species: species.index(key), count,
      value: (kind.value + itemValue(pine.value, cage.mult, 1, cage.quality, 1)) * count,
    };
  }
  const type = resolveType(registry, key, rng);
  if (type === 0) return null;
  const materials = registry.table<MaterialRow>('materials');
  const materialKey = requested?.material ?? (key === 'bandage' ? 'flax_cloth' : entry.materials.length > 0
    ? rng.weighted(entry.materials.map((choice): readonly [string, number] => [choice.material, choice.weight]))
    : '');
  const material = materialKey ? resolveMaterial(registry, materialKey, reputation, rng) : 0;
  if (material === 0) return null;
  const row = registry.table<ItemRow>('items').byIndex(type);
  const mat = materials.byIndex(material);
  if (!row || !mat) return null;
  const count = rng.int(entry.count[0], entry.count[1]) * (CARAVAN_BUNDLE_UNITS[key] ?? 1);
  let value = itemValue(mat.value, row.mult, 1, row.quality, count);
  const containerKey = packaged ? keys[1] : undefined;
  const container = containerKey ? registry.table('items').index(containerKey) : undefined;
  if (container) {
    const containerRow = registry.table<ItemRow>('items').byIndex(container);
    const pine = registry.table<MaterialRow>('materials').byId('pine');
    const units = CARAVAN_BUNDLE_UNITS[key] ?? 1;
    if (containerRow && pine) value += itemValue(pine.value, containerRow.mult, 1, containerRow.quality, Math.ceil(count / units));
  }
  let companion: PlannedGood['companion'];
  if (paired) {
    const other = keys[1];
    if (other) {
      const otherType = registry.table('items').index(other);
      const otherMat = other === 'splint' ? registry.table('materials').index('pine') : material;
      const otherCount = other === 'bolt' ? 50 : count;
      companion = { type: otherType, material: otherMat, count: otherCount };
      const otherRow = registry.table<ItemRow>('items').byIndex(otherType);
      const otherMaterial = materials.byIndex(otherMat);
      if (otherRow && otherMaterial) value += itemValue(otherMaterial.value, otherRow.mult, 1, otherRow.quality, otherCount);
    }
  }
  return { type, material, count, value, ...(container ? { container } : {}), ...(companion ? { companion } : {}) };
}

/**
 * Requests spend their separate share first; ordinary weighted draws spend the remainder. Each
 * `extra` entry then rolls once on `extraRng` and adds one good past the budget, so the budget and
 * the ordinary draws are what they would be without it.
 */
export function generateGoods(registry: Registry, civ: Civ, renown: number, reputation: number, requests: readonly TradeRequest[], rng: RngStream, extraRng: RngStream): PlannedGood[] {
  const entries = eligibleGoodsEntries(registry, civ, reputation);
  const result: PlannedGood[] = [];
  const budget = caravanBudget(renown, reputation);
  let requestRemaining = Math.floor(budget * REQUEST_SHARE / 100);
  const priorities = [...requests].sort((a, b) => b.priority - a.priority);
  for (const request of priorities) {
    const entry = entries.find((e) => (Array.isArray(e.item) ? e.item : [e.item]).includes(request.itemType));
    if (!entry) continue;
    let attempts = 0;
    while (requestRemaining > 0 && attempts < 20) {
      attempts += 1;
      const good = drawGood(registry, entry, reputation, rng, request);
      if (!good || good.value <= 0 || good.value > requestRemaining * 1.2) break;
      result.push(good);
      requestRemaining -= good.value;
    }
  }

  let remaining = budget - result.reduce((sum, good) => sum + good.value, 0);
  // A `rare` flag on a base row denotes the extra variant in its W3 prose. The base
  // entry remains in the draw pool; the deepsilver row itself is rare (D-184).
  const pool = entries.filter((e) => e.extra === undefined);
  let misses = 0;
  while (pool.length > 0 && remaining > 0 && misses < 20) {
    const entry = rng.weighted(pool.map((e): readonly [GoodsEntry, number] => [e, e.weight]));
    const good = drawGood(registry, entry, reputation, rng);
    if (!good || good.value <= 0 || good.value > remaining * 1.2) { misses += 1; continue; }
    result.push(good);
    remaining -= good.value;
    misses = 0;
  }
  for (const entry of entries) {
    if (entry.extra === undefined || reputation < (entry.extra.minReputation ?? reputation)) continue;
    if (!extraRng.chance(entry.extra.permille)) continue;
    const good = drawGood(registry, entry, reputation, extraRng);
    if (good) result.push({ ...good, extra: true });
  }
  return result;
}
