/**
 * Stockpiles: `02-systems/13-items-and-storage.md` § Stockpiles, § Containers in play, § Player-
 * facing behavior (presets), and `algorithms/jobs-and-hauling.md` § Wants-hauling (`accept`,
 * `findSlot`, slot reservations).
 *
 * A stockpile is a `stockpile` zone of 14 carrying 13's `Stockpile` component. 13 adds the
 * component the first time it meets the zone (its `ZoneChanged`, or a stockpile command in the same
 * tick) with an empty filter, and keeps `stockpileTiles` in step with the zone's tiles.
 *
 * Slot search follows 13 § Stockpiles as written: an item whose type wants a container goes into a
 * container of that class with room, or waits for a wanted container to be hauled in, and is
 * otherwise refused ("seeds need bags", `it_containers`); an item that wants no container takes the
 * first empty tile in `(y, x)` order, then an identical stack with room (D-071).
 */

import { C, ItemFlag, type Item, type Stockpile, type StockpileFilter } from '@core/components';
import type { EntityId, Priority, Quality, TileIndex } from '@core/types';
import { HAUL_PRIORITY, HAUL_PRIORITY_FOOD } from '@systems/jobs/constants';
import type { ItemCore } from './api';
import { categoryUnder } from './facts';

/** The container classes a stockpile can want (`Stockpile.containersWanted`). */
export const WANTED_CLASSES: readonly ('barrel' | 'bag' | 'bin')[] = ['barrel', 'bag', 'bin'];

/**
 * 13 § Category tree, "fixed by this design", plus `items.md`'s drink filter nodes (`drink/ale`,
 * `drink/wine`). Filters may select any node of this tree or of the item types' own paths.
 */
export const CATEGORY_TREE: readonly string[] = [
  'food', 'food/meat', 'food/meat/raw', 'food/meat/cooked', 'food/fish', 'food/fish/raw', 'food/plant', 'food/plant/raw',
  'food/plant/processed', 'food/meal', 'food/meal/easy', 'food/meal/fine', 'food/meal/lavish', 'food/egg', 'food/cheese',
  'food/milk', 'food/fat', 'food/tallow',
  'drink', 'drink/ale', 'drink/beer', 'drink/wine', 'drink/spirits',
  'seed',
  'stone', 'stone/raw', 'stone/block', 'stone/gem_rough', 'stone/gem_cut',
  'ore',
  'wood', 'wood/log', 'wood/block',
  'bar', 'bar/metal', 'bar/coal', 'bar/charcoal',
  'furniture', 'furniture/bed', 'furniture/table', 'furniture/chair', 'furniture/door', 'furniture/hatch', 'furniture/cabinet',
  'furniture/chest', 'furniture/coffin', 'furniture/statue', 'furniture/cage', 'furniture/mechanism', 'furniture/floodgate',
  'furniture/anvil', 'furniture/nest_box', 'furniture/weapon_rack', 'furniture/armor_stand', 'furniture/memorial_slab',
  'furniture/trap_part',
  'container', 'container/barrel', 'container/bag', 'container/bin', 'container/bucket',
  'weapon', 'weapon/melee', 'weapon/ranged',
  'ammo',
  'armor', 'armor/head', 'armor/body', 'armor/arms', 'armor/legs', 'armor/feet', 'armor/shield',
  'clothing', 'clothing/body', 'clothing/legs', 'clothing/feet',
  'tool', 'tool/pick', 'tool/axe', 'tool/fishing_rod', 'tool/crutch',
  'craft', 'craft/figurine', 'craft/ring', 'craft/amulet', 'craft/mug', 'craft/totem',
  'textile', 'textile/fiber', 'textile/thread', 'textile/cloth', 'textile/wool', 'textile/hide', 'textile/leather',
  'textile/bone', 'textile/shell', 'textile/skull',
  'medical', 'medical/splint', 'medical/bandage', 'medical/brightleaf',
  'refuse', 'refuse/corpse', 'refuse/skeleton', 'refuse/rotten', 'refuse/part',
];

/** `items.md` § Drink: "Categories for stockpile filters: `drink/ale` (…), `drink/wine` (…)". */
const DRINK_GROUPS: Readonly<Record<string, string>> = Object.freeze({
  ale: 'drink/ale',
  dimcap_ale: 'drink/ale',
  cavewheat_beer: 'drink/ale',
  hopped_ale: 'drink/ale',
  bellwine: 'drink/wine',
  rootwine: 'drink/wine',
  strawberry_wine: 'drink/wine',
});

/**
 * The presets of 13 § Player-facing behavior ("Food, Drink, Seeds, Stone, Ore and bars, Wood,
 * Furniture, Weapons and armor, Cloth and leather, Crafts and gems, Refuse, Corpses, Everything"),
 * as category nodes (D-071).
 */
export const STOCKPILE_PRESETS: Readonly<Record<string, { categories: readonly string[]; allowRot: boolean }>> = Object.freeze({
  food: { categories: ['food'], allowRot: false },
  drink: { categories: ['drink'], allowRot: false },
  seeds: { categories: ['seed'], allowRot: false },
  stone: { categories: ['stone/raw', 'stone/block'], allowRot: false },
  ore_and_bars: { categories: ['ore', 'bar'], allowRot: false },
  wood: { categories: ['wood'], allowRot: false },
  furniture: { categories: ['furniture'], allowRot: false },
  weapons_and_armor: { categories: ['weapon', 'ammo', 'armor'], allowRot: false },
  cloth_and_leather: { categories: ['textile', 'clothing'], allowRot: false },
  crafts_and_gems: { categories: ['craft', 'stone/gem_rough', 'stone/gem_cut'], allowRot: false },
  refuse: { categories: ['refuse/skeleton', 'refuse/rotten', 'refuse/part'], allowRot: true },
  corpses: { categories: ['refuse/corpse'], allowRot: true },
  everything: {
    categories: ['food', 'drink', 'seed', 'stone', 'ore', 'wood', 'bar', 'furniture', 'container', 'weapon', 'ammo', 'armor',
      'clothing', 'tool', 'craft', 'textile', 'medical', 'refuse'],
    allowRot: true,
  },
});

/** A new stockpile's filter: nothing selected until the player picks (D-071). */
export function emptyFilter(): StockpileFilter {
  return { categories: [], materialClasses: 'any', minQuality: 0, maxQuality: 5, allowRot: false };
}

export function presetFilter(name: string): StockpileFilter | null {
  const p = STOCKPILE_PRESETS[name];
  if (p === undefined) return null;
  return { categories: [...p.categories], materialClasses: 'any', minQuality: 0, maxQuality: 5, allowRot: p.allowRot };
}

/** A slot: a tile, or a container on a tile, or an identical stack to merge into. */
export interface Slot {
  readonly tile: TileIndex;
  /** The container the item goes into, or 0. */
  readonly container: EntityId;
  /** The stack the item joins on delivery, or 0. */
  readonly merge: EntityId;
  /** The reservation key. */
  readonly key: string;
}

/** What `findSlot` answers when a wanted container must be hauled in first. */
export interface ContainerNeeded {
  readonly needContainer: 'barrel' | 'bag' | 'bin';
}

export interface StockpileHost {
  readonly core: ItemCore;
  /** 14's zone view: the zone's type id and ascending tiles, or undefined. */
  zone(id: EntityId): { readonly type: string; readonly tiles: readonly TileIndex[] } | undefined;
  /** The items lying on a tile, ascending. */
  itemsOn(i: TileIndex): EntityId[];
  /** The building on a tile (a workshop is a link source), or 0. */
  buildingAt(i: TileIndex): EntityId;
}

export class StockpileStore {
  readonly host: StockpileHost;
  /** `stockpileTiles: Map<TileIndex, stockpileId>`. */
  readonly tiles = new Map<TileIndex, EntityId>();
  /** `slotReservations: Map<slotKey, jobId>`. */
  readonly reservations = new Map<string, number>();
  /** Stockpiles whose priority the player set (`11`: "inherits the stockpile's priority setting if the player changes it"). */
  readonly explicitPriority: EntityId[] = [];
  /** Container hauls in flight: `containerId → stockpileId`, counted as present. */
  readonly incomingContainers = new Map<EntityId, EntityId>();

  constructor(host: StockpileHost) {
    this.host = host;
  }

  private get core(): ItemCore {
    return this.host.core;
  }

  private get entities(): ItemCore['host']['entities'] {
    return this.core.host.entities;
  }

  // ---------- the component ----------

  stockpile(id: EntityId): Stockpile | undefined {
    return this.entities.get(id, C.Stockpile);
  }

  /** Every stockpile, ascending id. */
  all(): EntityId[] {
    return this.entities.with(C.Stockpile);
  }

  /** Give a `stockpile` zone its component and tiles if it has none yet; false when it is no stockpile. */
  ensure(id: EntityId): boolean {
    const zone = this.host.zone(id);
    if (zone === undefined || zone.type !== 'stockpile') return false;
    if (this.stockpile(id) === undefined) {
      this.entities.add(id, C.Stockpile, {
        filter: emptyFilter(),
        containersWanted: { barrel: 0, bag: 0, bin: 0 },
        priority: HAUL_PRIORITY as Priority,
        linkedSources: [],
      });
      this.syncTiles(id);
    }
    return true;
  }

  /** Re-read a stockpile's tiles from its zone (created or resized). */
  syncTiles(id: EntityId): void {
    for (const t of Array.from(this.tiles.keys())) if (this.tiles.get(t) === id) this.tiles.delete(t);
    const zone = this.host.zone(id);
    if (zone === undefined) return;
    for (const t of zone.tiles) this.tiles.set(t, id);
  }

  /** A stockpile's zone went away: its tiles, reservations and links go with it. */
  removed(id: EntityId): void {
    for (const t of Array.from(this.tiles.keys())) if (this.tiles.get(t) === id) this.tiles.delete(t);
    const at = this.explicitPriority.indexOf(id);
    if (at >= 0) this.explicitPriority.splice(at, 1);
    for (const other of this.all()) {
      const sp = this.stockpile(other) as Stockpile;
      if (sp.linkedSources.includes(id)) this.write(other, { linkedSources: sp.linkedSources.filter((x) => x !== id) });
    }
  }

  write(id: EntityId, patch: Partial<Stockpile>): void {
    const sp = this.stockpile(id);
    if (sp === undefined) return;
    this.entities.add(id, C.Stockpile, { ...sp, ...patch });
  }

  /** The tiles of a stockpile, ascending (`(z, y, x)` order, which is `(y, x)` on one level). */
  tilesOf(id: EntityId): readonly TileIndex[] {
    return this.host.zone(id)?.tiles ?? [];
  }

  stockpileAt(i: TileIndex): EntityId {
    return this.tiles.get(i) ?? 0;
  }

  /** A filter that selects food only gets `HAUL_PRIORITY_FOOD` by default (13 § Stockpiles). */
  defaultPriority(filter: StockpileFilter): Priority {
    const cats = filter.categories;
    const food = cats.length > 0 && cats.every((c) => categoryUnder(c, 'food'));
    return (food ? HAUL_PRIORITY_FOOD : HAUL_PRIORITY) as Priority;
  }

  // ---------- accept ----------

  /** The category an item files under: its type's path, a drink by its material's group. */
  categoryOf(it: Item): string {
    const facts = this.core.host.facts;
    const cat = facts.row(it.type).category;
    if (cat === 'drink') return DRINK_GROUPS[facts.materialIdOf(it.material)] ?? cat;
    return cat;
  }

  /** The filter part of `accept`: category, material class, quality range, rot. */
  private filterAccepts(filter: StockpileFilter, it: Item): boolean {
    const facts = this.core.host.facts;
    const cat = this.categoryOf(it);
    if (!filter.categories.some((node) => categoryUnder(cat, node))) return false;
    if (filter.materialClasses !== 'any' && !filter.materialClasses.includes(facts.materialClass(it.material))) return false;
    // A type that bears no quality has none to range over (D-071).
    if (facts.row(it.type).quality && (it.quality < filter.minQuality || it.quality > filter.maxQuality)) return false;
    if (it.rotStage >= 2 && !filter.allowRot) return false;
    return true;
  }

  /**
   * `accepts(stockpile, item)`: "the item's category is under a selected node, its material class is
   * allowed, its quality is in range, it is not forbidden, and (if `linkedSources` is non-empty) the
   * item currently sits in one of those stockpiles or a workshop". A container with contents is
   * accepted for its contents ("barrels of ale still accepted (they are containers)").
   */
  accepts(spId: EntityId, itemId: EntityId): boolean {
    const sp = this.stockpile(spId);
    const it = this.core.get(itemId);
    if (sp === undefined || it === undefined) return false;
    if ((it.flags & ItemFlag.Forbidden) !== 0) return false;
    const c = this.core.container(itemId);
    if (c !== undefined && c.contents.length > 0) {
      for (const inner of c.contents) {
        const x = this.core.get(inner);
        if (x === undefined || !this.filterAccepts(sp.filter, x)) return false;
      }
    } else if (!this.filterAccepts(sp.filter, it)) {
      return false;
    }
    if (sp.linkedSources.length > 0) {
      const t = this.core.tileOf(itemId);
      if (t < 0) return false;
      const pile = this.stockpileAt(t);
      const building = this.host.buildingAt(t);
      if (!sp.linkedSources.includes(pile) && !sp.linkedSources.includes(building)) return false;
    }
    return true;
  }

  // ---------- slots ----------

  private tileKey(t: TileIndex): string {
    return `t${t}`;
  }

  private containerKey(c: EntityId, itemId: EntityId): string {
    return `c${c}:${itemId}`;
  }

  /** Units (or items, for bins) already promised to a container by reservations. */
  private pendingIn(c: EntityId, cls: string): number {
    let n = 0;
    const prefix = `c${c}:`;
    for (const key of Array.from(this.reservations.keys())) {
      if (!key.startsWith(prefix)) continue;
      const itemId = Number(key.slice(prefix.length));
      n += this.core.needs(itemId, cls);
    }
    return n;
  }

  /** The containers of a class lying on a stockpile's tiles, in tile order. */
  containersIn(spId: EntityId, cls: string): EntityId[] {
    const out: EntityId[] = [];
    for (const t of this.tilesOf(spId)) {
      for (const id of this.host.itemsOn(t)) if (this.core.container(id)?.classId === cls) out.push(id);
    }
    return out;
  }

  /** Containers of a class present, counting those on their way in. */
  containersPresent(spId: EntityId, cls: string): number {
    let n = this.containersIn(spId, cls).length;
    for (const c of Array.from(this.incomingContainers.keys())) {
      if (this.incomingContainers.get(c) === spId && this.core.container(c)?.classId === cls) n += 1;
    }
    return n;
  }

  /** An empty tile no reservation holds, in `(y, x)` order, or -1. */
  emptyTile(spId: EntityId): TileIndex {
    for (const t of this.tilesOf(spId)) {
      if (this.reservations.has(this.tileKey(t))) continue;
      if (this.host.itemsOn(t).length === 0) return t;
    }
    return -1;
  }

  /** Empty, unreserved tiles. */
  freeSlots(spId: EntityId): number {
    let n = 0;
    for (const t of this.tilesOf(spId)) if (!this.reservations.has(this.tileKey(t)) && this.host.itemsOn(t).length === 0) n += 1;
    return n;
  }

  /** `findSlot(sp, it)` of the algorithm, with 13's refusal when a wanted container is missing. */
  findSlot(spId: EntityId, itemId: EntityId): Slot | ContainerNeeded | null {
    const sp = this.stockpile(spId);
    const it = this.core.get(itemId);
    if (sp === undefined || it === undefined) return null;
    const facts = this.core.host.facts;
    const cls = this.core.container(itemId) !== undefined ? 'none' : facts.row(it.type).container;
    if (cls !== 'none') {
      for (const c of this.containersIn(spId, cls)) {
        const room = this.core.room(c) - this.pendingIn(c, cls);
        if (room >= this.core.needs(itemId, cls)) {
          const t = this.core.tileOf(c);
          return { tile: t, container: c, merge: 0, key: this.containerKey(c, itemId) };
        }
      }
      const wanted = sp.containersWanted[cls as 'barrel' | 'bag' | 'bin'] ?? 0;
      if (wanted > this.containersPresent(spId, cls) && (cls === 'barrel' || cls === 'bag' || cls === 'bin')) {
        return { needContainer: cls };
      }
      return null;
    }
    const t = this.emptyTile(spId);
    if (t >= 0) return { tile: t, container: 0, merge: 0, key: this.tileKey(t) };
    for (const tile of this.tilesOf(spId)) {
      if (this.reservations.has(this.tileKey(tile))) continue;
      const on = this.host.itemsOn(tile);
      if (on.length !== 1) continue;
      const other = on[0] as EntityId;
      const x = this.core.get(other);
      if (x === undefined || x.type !== it.type || x.material !== it.material || x.quality !== it.quality) continue;
      if ((x.flags & ItemFlag.Reserved) !== 0) continue;
      if (x.count + it.count > facts.row(it.type).stack) continue;
      if (this.core.container(other) !== undefined) continue;
      return { tile, container: 0, merge: other, key: this.tileKey(tile) };
    }
    return null;
  }

  /** A slot for an empty container being hauled in because the stockpile wants it: an empty tile. */
  containerSlot(spId: EntityId): Slot | null {
    const t = this.emptyTile(spId);
    return t < 0 ? null : { tile: t, container: 0, merge: 0, key: this.tileKey(t) };
  }

  reserve(slot: Slot, jobId: number): void {
    this.reservations.set(slot.key, jobId);
  }

  releaseKey(key: string): void {
    this.reservations.delete(key);
  }

  /** True when the item sits in an accepting slot of a stockpile (it needs no hauling). */
  isStored(itemId: EntityId): boolean {
    const it = this.core.get(itemId);
    if (it === undefined) return false;
    const holder = it.containerId !== 0 ? it.containerId : itemId;
    const t = this.core.tileOf(holder);
    if (t < 0 || this.core.get(holder)?.carriedBy !== 0) return false;
    const sp = this.stockpileAt(t);
    return sp !== 0 && this.accepts(sp, holder);
  }

  // ---------- validation for the commands ----------

  /** Every category node a filter may name: the tree and every prefix of an item type's path. */
  categoryNodes(): Set<string> {
    const nodes = new Set<string>(CATEGORY_TREE);
    const facts = this.core.host.facts;
    for (let t = 1; t <= facts.typeCount; t += 1) {
      const cat = facts.types[t]?.category;
      if (cat === undefined) continue;
      const parts = cat.split('/');
      for (let k = 1; k <= parts.length; k += 1) nodes.add(parts.slice(0, k).join('/'));
    }
    return nodes;
  }

  qualityOf(raw: unknown, fallback: Quality): Quality | null {
    if (raw === undefined) return fallback;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 5) return null;
    return raw as Quality;
  }
}
