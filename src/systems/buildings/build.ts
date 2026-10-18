/**
 * Buildings: `02-systems/14-buildings-and-rooms.md` § Placement, § Constructions, § Value, and the
 * command-catalog rows `PlaceBuilding`, `CancelBuilding`, `DeconstructBuilding`,
 * `SetBuildingPriority`; job types `build` and `deconstruct` of `03-content/jobs.md`.
 *
 * ```
 * PlaceBuilding { type, origin, orientation, materialChoice, priority }:
 *   1. footprint (w × h, rotated for rotatable types), every tile discovered, the type's `on` rule,
 *      no other building
 *   2. materials: the inputs; `materialChoice` narrows the filter
 *   3. magma safety: within 1 of magma every material must be magma-safe (05; T-M3-04, D-098)
 *   4. entity `planned` + a `build` job (labor by category, skill `building`, inputs,
 *      `workTile: adjacent`, or `at` for floors and stairs the builder stands on)
 *   5. BuildingPlaced; a planned building is passable
 * build completion: consume inputs, state `built`, constructions through the terrain API
 *   (`setKind`, `constructed`), BuildingCompleted; a wall waits for creatures and item clearance
 * ```
 *
 * T-M2-06: furniture links its item (`Building.itemId`) instead of consuming it and returns it on
 * deconstruction; doors and hatches (`SetDoorMode`, `SetHatchMode`, passability per faction and
 * class, `no_pets`, `locked`, `lock_on_alert`); the special buildings' state (well, depot, coffin,
 * cage occupant, the wagon's container). D-074.
 */

import { C, type Building } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import { FLUID_MAX_LEVEL, PRIORITY_DEFAULT, PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import { Designation, FluidType, TileFlag, TileKind, isSolidBottomed, type Map3D } from '@core/map3d';
import { MAGMA_C } from '@systems/fluids/constants';
import { MAGMA_POWER_LEVEL } from '@systems/workshops/constants';
import type { EntityStore } from '@core/entities';
import type { GameEvent } from '@core/events';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { MoverOptions } from '@core/pathfinding';
import type { CoreServices, JobProducer, TickContext } from '@core/system';
import { BODY_SLOTS, type EntityId, type Idx, type MovementClass, type TileIndex } from '@core/types';
import { killCreature } from '@systems/health/tick';
import { CONSTRUCTION_KIND, constructionFlags, onRuleHolds, onRuleOf, standsAt, type OnRule } from './constructions';
import { BRIDGE_MAX, BRIDGE_CRUSH_DAMAGE, DOOR_MODES, HATCH_MODES, LINK_WORK_TICKS, WAGON_CAPACITY, WELL_DEPTH } from './constants';
import { ALERT_LOCK_GRACE_TICKS, ALERT_OUTSIDE_CLEAR_TICKS } from '@systems/defense/constants';

export interface BuildingRow {
  readonly id: string;
  readonly name: string;
  readonly category: 'construction' | 'furniture' | 'workshop' | 'mechanism' | 'trap' | 'special';
  readonly footprint: { readonly w: number; readonly h: number; readonly rotatable: boolean; readonly variable?: { readonly max: number } };
  readonly on: string;
  readonly inputs: readonly { readonly match: string; readonly count: number | 'tiles'; readonly material?: unknown }[];
  readonly labor: string;
  readonly buildTicks: number;
  readonly tags: readonly string[];
  readonly roomValue: number | string;
  readonly passable: boolean | 'rules';
  readonly blocksFluid: boolean | 'rules';
  readonly value: number;
  readonly impassableTiles?: readonly number[];
}

interface ItemRow {
  readonly id: string;
  readonly tags?: readonly string[];
}

interface MaterialRow {
  readonly id: string;
  readonly class: string;
  readonly value: number;
  readonly meltsAtC: number;
}

/** Magma (level ≥ 1) on a tile. */
function magmaAt(map: Map3D, i: TileIndex): boolean {
  return map.fluidLevelAt(i) > 0 && map.fluidTypeAt(i) === FluidType.Magma;
}

/** "By material" labor: wood → carpentry, stone → masonry, metal → smithing (`buildings-and-furniture.md`). */
const LABOR_BY_CLASS: Readonly<Record<string, string>> = Object.freeze({ wood: 'carpentry', stone: 'masonry', metal: 'smithing' });

export interface BuildHost {
  readonly map: Map3D;
  readonly entities: EntityStore;
  readonly registry: Registry;
  readonly services: CoreServices;
  emit(event: GameEvent): void;
  /** Creatures standing on a tile. */
  creaturesAt(i: TileIndex): readonly EntityId[];
  /** Loose items with their own ground position. */
  itemsAt(i: TileIndex): readonly EntityId[];
  walkable(i: TileIndex): boolean;
  /** Whether a fortress creature is alive (the hearth cannot be deconstructed while dwarves live). */
  dwarvesAlive(): boolean;
  /** 11's job id for a key, or 0. */
  jobIdByKey(key: string): number;
  /** The fortress alert (`FortressState.alert`); a `lock_on_alert` door locks while it is `hearth`. */
  alert(): string;
  tick(): number;
  /** 04's `waterBelow(i, maxDepth)` (-1 for none), or null without a fluid system (T-M3-05, D-094). */
  waterBelow?(i: TileIndex, maxDepth: number): number | null;
}

export function buildKey(id: EntityId): string {
  return `build:${id}`;
}

export function deconstructKey(id: EntityId): string {
  return `deconstruct:${id}`;
}

function linkKey(source: EntityId, target: EntityId, stage: 'target' | 'source'): string {
  return `link_mechanism:${source}:${target}:${stage}`;
}

export class BuildingStore {
  readonly host: BuildHost;
  private readonly rows: (BuildingRow | undefined)[] = [];
  private readonly rowIndex = new Map<string, number>();
  private readonly materials: (MaterialRow | undefined)[] = [];
  private readonly itemTypes: (ItemRow | undefined)[] = [];
  private readonly itemIndex = new Map<string, number>();
  /** Buildings waiting for a build or deconstruct job, ascending. */
  readonly pending: EntityId[] = [];
  hearthId: EntityId = 0;
  /** `BuildingsState.depots`: built trade depots, ascending. */
  readonly depots: EntityId[] = [];
  /** `BuildingsState.coffins`: built coffins, ascending. */
  readonly coffins: EntityId[] = [];
  /** Lamp coverage and the crop-light bit that was present before the first lamp. */
  readonly lampLight = new Map<TileIndex, { count: number; baseLit: boolean }>();

  /** 03 can recompute sunlight for a whole level after terrain changes; keep installed lamps lit. */
  refreshLampLight(): void {
    for (const tile of Array.from(this.lampLight.keys()).sort((a, b) => a - b)) {
      if (!this.map.hasFlag(tile, TileFlag.Lit)) this.host.services.terrain.setFlag(tile, TileFlag.Lit, true);
    }
  }
  /** Told the footprint of every building that completes or goes (rooms recompute, T-M2-07). */
  onFootprintChanged: (tiles: readonly TileIndex[]) => void = () => {};

  constructor(host: BuildHost) {
    this.host = host;
    const table = host.registry.table<BuildingRow>('buildings');
    for (let t = 1; t <= table.size; t += 1) {
      const row = table.byIndex(t) as BuildingRow;
      this.rows[t] = row;
      this.rowIndex.set(row.id, t);
    }
    const mats = host.registry.table<MaterialRow>('materials');
    for (let m = 1; m <= mats.size; m += 1) this.materials[m] = mats.byIndex(m);
    const items = host.registry.table<ItemRow>('items');
    for (let t = 1; t <= items.size; t += 1) {
      const row = items.byIndex(t) as ItemRow;
      this.itemTypes[t] = row;
      this.itemIndex.set(row.id, t);
    }
  }

  private get map(): Map3D {
    return this.host.map;
  }

  row(type: number): BuildingRow {
    const r = this.rows[type];
    if (r === undefined) throw new RangeError(`buildings: unknown building type ${type}`);
    return r;
  }

  /** Every row, in registry order. */
  rowsList(): BuildingRow[] {
    return this.rows.filter((r): r is BuildingRow => r !== undefined);
  }

  typeOf(id: string | number): number {
    if (typeof id === 'number') return this.rows[id] === undefined ? 0 : id;
    return this.rowIndex.get(id) ?? 0;
  }

  get(id: EntityId): Building | undefined {
    return this.host.entities.get(id, C.Building);
  }

  typeIdOf(id: EntityId): string {
    const b = this.get(id);
    return b === undefined ? '' : (this.rows[b.type]?.id ?? '');
  }

  all(): EntityId[] {
    return this.host.entities.with(C.Building);
  }

  private write(id: EntityId, patch: Partial<Building>): Building {
    const b = { ...(this.get(id) as Building), ...patch };
    this.host.entities.add(id, C.Building, b);
    return b;
  }

  // ---------- footprints and inputs ----------

  /** The footprint of a type at an origin (its north-west tile), rotated for rotatable types. */
  footprint(row: BuildingRow, origin: TileIndex, orientation: number, width = row.footprint.w, height = row.footprint.h): TileIndex[] | null {
    const map = this.map;
    const turned = row.footprint.rotatable && orientation % 2 === 1;
    const w = turned ? height : width;
    const h = turned ? width : height;
    const out: TileIndex[] = [];
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        const t = map.offset(origin, dx, dy, 0);
        if (t < 0) return null;
        out.push(t);
      }
    }
    return out.sort((a, b) => a - b);
  }

  /** The chosen hinge edge must rest on floor; the other bridge tiles may span open space. */
  private bridgeHinge(tiles: readonly TileIndex[], orientation: number): boolean {
    const map = this.map;
    const coord = (tile: TileIndex): number => orientation % 2 === 0 ? map.xOf(tile) : map.yOf(tile);
    const edge = orientation === 0 || orientation === 1 ? Math.min(...tiles.map(coord)) : Math.max(...tiles.map(coord));
    return tiles.some((tile) => coord(tile) === edge && map.kindAt(tile) === TileKind.Floor);
  }

  /** The tile a building's jobs anchor to: the centre of its footprint. */
  anchorOf(b: Building): TileIndex {
    const map = this.map;
    const xs = b.footprint.map((t) => map.xOf(t));
    const ys = b.footprint.map((t) => map.yOf(t));
    const x = Math.floor((Math.min(...xs) + Math.max(...xs)) / 2);
    const y = Math.floor((Math.min(...ys) + Math.max(...ys)) / 2);
    return map.index(x, y, map.zOf(b.origin));
  }

  /** An input's `match` ("block|log|bar|raw_stone"): every item type an alternative names by id or tag (D-012). */
  typesOf(match: string): number[] {
    const out = new Set<number>();
    for (const alt of match.split('|').map((a) => a.trim())) {
      const direct = this.itemIndex.get(alt);
      if (direct !== undefined) {
        out.add(direct);
        continue;
      }
      for (let t = 1; t < this.itemTypes.length; t += 1) if (this.itemTypes[t]?.tags?.includes(alt) === true) out.add(t);
    }
    return Array.from(out).sort((a, b) => a - b);
  }

  private inputsFor(row: BuildingRow, tiles: number, material: number): { filter: Record<string, unknown>; count: number }[] {
    return row.inputs.map((input) => ({
      filter: { types: this.typesOf(input.match),
        ...(input.match === 'barrel' ? { emptyContainer: 'barrel' } : {}),
        unoccupied: true,
        ...(material !== 0 && input.match !== 'anvil' ? { materialId: material } : {}),
        ...(row.id === 'magma_forge' && input.match === 'anvil'
          ? { materialIds: ['iron', 'steel'].map((id) => this.host.registry.table('materials').index(id)) } : {}) },
      count: input.count === 'tiles' ? tiles : input.count,
    }));
  }

  /** `labor` for the build job: the row's, "by material" from the chosen material's class, else `construction`. */
  laborFor(row: BuildingRow, material: number): string {
    // The wagon has no build labor ("placed at embark only"); taking it apart is "everything else".
    if (row.labor === 'none') return 'construction';
    if (row.labor !== 'by_material') return row.labor;
    return LABOR_BY_CLASS[this.materials[material]?.class ?? ''] ?? 'construction';
  }

  /** 14 § Value: `materialValue + type.valueBonus`. */
  valueOf(b: Building): number {
    const row = this.row(b.type);
    return (this.materials[b.material]?.value ?? 0) + row.value * (row.tags.includes('bridge') ? b.footprint.length : 1);
  }

  /**
   * 14 § Placement step 3: "if any footprint tile is within 1 of magma or is over a channel to magma
   * (a `magma_*` workshop), every material must be magma-safe (05)". Within 1 is the 26 tiles around
   * a footprint tile and the tile itself; a building placed there with no material chosen is refused,
   * since its materials cannot be known to be safe (D-098).
   */
  magmaSafe(tiles: readonly TileIndex[], material: number): boolean {
    const map = this.map;
    const exposed = tiles.some((t) => magmaAt(map, t) || map.neighbors26(t).some((n) => magmaAt(map, n)));
    if (!exposed) return true;
    return material !== 0 && (this.materials[material]?.meltsAtC ?? 0) > MAGMA_C;
  }

  /** `12` § Workshops: a magma variant needs level 4 or more directly below one footprint tile. */
  magmaPoweredAt(tiles: readonly TileIndex[]): boolean {
    return tiles.some((t) => {
      const below = this.map.below(t);
      return below >= 0 && this.map.fluidTypeAt(below) === FluidType.Magma &&
        this.map.fluidLevelAt(below) >= MAGMA_POWER_LEVEL;
    });
  }

  /** Tiles named by `MagmaContact`, waiting for 14's tick (D-098). */
  readonly magmaPending: TileIndex[] = [];

  magmaTouched(tile: TileIndex): void {
    if (!this.magmaPending.includes(tile)) this.magmaPending.push(tile);
  }

  /**
   * 05 § Melting: "14 … destroys non-magma-safe buildings on contact". A building (not a
   * construction, which is terrain and burns by 05's fire) on a tile magma touched, whose material
   * melts at or below `MAGMA_C`, is removed; its linked item melts with it.
   */
  destroyMagmaTouched(): void {
    if (this.magmaPending.length === 0) return;
    const tiles = this.magmaPending.slice().sort((a, b) => a - b);
    this.magmaPending.length = 0;
    for (const t of tiles) {
      if (!magmaAt(this.map, t)) continue;
      const id = this.map.buildingAtTile(t);
      const b = id === 0 ? undefined : this.get(id);
      if (b === undefined || this.row(b.type).category === 'construction') continue;
      if ((this.materials[b.material]?.meltsAtC ?? 0) > MAGMA_C) continue;
      const item = b.itemId;
      this.remove(id);
      if (item !== 0 && this.host.entities.alive(item)) this.host.services.items?.destroy(item, 'melted');
    }
  }

  // ---------- commands ----------

  /**
   * The build tool's ghost (`fortress-screen.md` § Build tool: "green ok, red blocked" with the
   * reason): the footprint at an origin, the tiles that fail, and the first reason `PlaceBuilding`
   * would give, or null when it would be accepted.
   */
  ghost(typeId: string, origin: TileIndex, orientation: number, width?: number, height?: number): { tiles: TileIndex[]; bad: TileIndex[]; reason: string | null; rule: OnRule } {
    const map = this.map;
    const type = this.typeOf(typeId);
    const rule = onRuleOf(typeId);
    if (type === 0 || !map.validIndex(origin)) return { tiles: [], bad: [], reason: 'not_found', rule };
    const row = this.row(type);
    if (row.tags.includes('bridge') && (width !== undefined || height !== undefined) &&
      (!Number.isInteger(width) || !Number.isInteger(height) || (width ?? 0) < 1 || (height ?? 0) < 1 || (width ?? 0) > BRIDGE_MAX || (height ?? 0) > BRIDGE_MAX)) {
      return { tiles: [], bad: [], reason: 'out_of_range', rule };
    }
    const tiles = this.footprint(row, origin, orientation, width, height);
    if (tiles === null) return { tiles: [], bad: [], reason: 'out_of_bounds', rule };
    const bad: TileIndex[] = [];
    let reason: string | null = null;
    const note = (r: string): void => {
      if (reason === null) reason = r;
    };
    for (const t of tiles) {
      if (!map.hasFlag(t, TileFlag.Discovered)) {
        bad.push(t);
        note('not_discovered');
      } else if (map.buildingAtTile(t) !== 0) {
        bad.push(t);
        note('footprint_blocked');
      } else if (!onRuleHolds(map, rule, t)) {
        bad.push(t);
        note('bad_placement');
      }
    }
    if (reason === null && row.tags.includes('bridge') && !this.bridgeHinge(tiles, orientation)) reason = 'bad_placement';
    if (reason === null && row.tags.includes('hearth') && this.hearthId !== 0 && this.host.entities.alive(this.hearthId)) reason = 'hearth_exists';
    if (reason === null && row.tags.includes('magma') && !this.magmaPoweredAt(tiles)) reason = 'bad_placement';
    return { tiles, bad, reason, rule };
  }

  /** `PlaceBuilding { buildingType, origin, orientation, materialChoice, priority }`; the new id through `placed`. */
  place(cmd: Command, placed?: (id: EntityId) => void, hasRecipes?: (workshopType: string) => boolean): CommandResult {
    const map = this.map;
    const typeRaw = cmd['buildingType'];
    const type = this.typeOf(typeof typeRaw === 'string' || typeof typeRaw === 'number' ? typeRaw : '');
    if (type === 0) return reject('not_found');
    const row = this.row(type);
    // A workshop that no recipe names makes nothing, so it is not built (12: reserved workshops).
    if (row.category === 'workshop' && hasRecipes !== undefined && !hasRecipes(row.id)) return reject('precondition_failed');
    const origin = cmd['origin'];
    if (typeof origin !== 'number' || !map.validIndex(origin)) return reject('out_of_bounds');
    const orientation = typeof cmd['orientation'] === 'number' ? cmd['orientation'] : 0;
    if (!Number.isInteger(orientation) || orientation < 0 || orientation > 3) return reject('out_of_range');
    const priority = cmd['priority'] === undefined ? PRIORITY_DEFAULT : cmd['priority'];
    if (typeof priority !== 'number' || !Number.isInteger(priority) || priority < PRIORITY_MIN || priority > PRIORITY_MAX) {
      return reject('out_of_range');
    }
    let material = 0;
    const choice = cmd['materialChoice'];
    if (typeof choice === 'string' && choice !== '') {
      const mats = this.host.registry.table('materials');
      if (!mats.has(choice)) return reject('not_found');
      material = mats.index(choice);
    } else if (typeof choice === 'number' && choice !== 0) {
      if (this.materials[choice] === undefined) return reject('not_found');
      material = choice;
    }
    if (row.footprint.variable === undefined && (cmd['width'] !== undefined || cmd['height'] !== undefined)) return reject('fixed_footprint');
    const width = cmd['width'] ?? row.footprint.w;
    const height = cmd['height'] ?? row.footprint.h;
    if (row.tags.includes('bridge') && (!Number.isInteger(width) || !Number.isInteger(height) ||
      (width as number) < 1 || (height as number) < 1 || (width as number) > BRIDGE_MAX || (height as number) > BRIDGE_MAX)) return reject('out_of_range');
    const tiles = this.footprint(row, origin, orientation, width as number, height as number);
    if (tiles === null) return reject('out_of_bounds');
    for (const t of tiles) if (!map.hasFlag(t, TileFlag.Discovered)) return reject('not_discovered');
    for (const t of tiles) if (map.buildingAtTile(t) !== 0) return reject('footprint_blocked');
    const rule = onRuleOf(row.id);
    for (const t of tiles) if (!onRuleHolds(map, rule, t)) return reject('bad_placement');
    if (row.tags.includes('bridge') && !this.bridgeHinge(tiles, orientation)) return reject('bad_placement');
    if (row.tags.includes('magma') && !this.magmaPoweredAt(tiles)) return reject('bad_placement');
    if (!this.magmaSafe(tiles, material)) return reject('not_magma_safe');
    if (row.tags.includes('hearth') && this.hearthId !== 0 && this.host.entities.alive(this.hearthId)) return reject('hearth_exists');

    const id = this.host.entities.create('building');
    this.host.entities.add(id, C.Building, {
      type: type as Idx<'BuildingDef'>,
      material: material as Idx<'MaterialDef'>,
      state: 'planned',
      origin,
      footprint: tiles,
      orientation: orientation as Building['orientation'],
      itemId: 0,
      mode: row.tags.includes('door') || row.tags.includes('hatch') ? 'open' : '',
      linkedIds: [],
      ownerId: 0,
      settings: { priority, materialChoice: material, inputs: [], ...(row.tags.includes('bridge') ? { openTiles: tiles.filter((t) => map.kindAt(t) === TileKind.Open) } : {}) },
      toggled: false,
    });
    for (const t of tiles) map.setBuildingAt(t, id);
    if (row.tags.includes('hearth')) this.hearthId = id;
    this.addPending(id);
    placed?.(id);
    this.host.emit({ type: 'BuildingPlaced', id, buildingType: row.id, tiles: tiles.slice() });
    return OK;
  }

  /** `CancelBuilding { buildingId }`: "planned or constructing". */
  cancel(cmd: Command): CommandResult {
    const id = cmd['buildingId'];
    const b = typeof id === 'number' ? this.get(id) : undefined;
    if (b === undefined) return reject('not_found');
    if (b.state === 'built') return reject('not_cancellable');
    this.remove(id as EntityId);
    return OK;
  }

  /**
   * `DeconstructBuilding { buildingId }`: "built; not the hearth while dwarves live". A construction
   * gets 03's `remove` designation; any other building a `deconstruct` job.
   */
  deconstruct(cmd: Command): CommandResult {
    const id = cmd['buildingId'];
    const b = typeof id === 'number' ? this.get(id) : undefined;
    if (b === undefined) return reject('not_found');
    if (b.state !== 'built') return reject('precondition_failed');
    const row = this.row(b.type);
    if (row.tags.includes('hearth') && this.host.dwarvesAlive()) return reject('hearth_is_home');
    const priority = (b.settings['priority'] as number | undefined) ?? PRIORITY_DEFAULT;
    if (row.category === 'construction') {
      for (const t of b.footprint) this.host.services.terrain.setDesignation(t, Designation.Remove, priority);
      return OK;
    }
    this.write(id as EntityId, { settings: { ...b.settings, deconstruct: true } });
    this.addPending(id as EntityId);
    return OK;
  }

  /** `SetBuildingPriority { buildingId, priority }`: "planned". */
  setPriority(cmd: Command): CommandResult {
    const id = cmd['buildingId'];
    const b = typeof id === 'number' ? this.get(id) : undefined;
    if (b === undefined) return reject('not_found');
    if (b.state !== 'planned') return reject('precondition_failed');
    const p = cmd['priority'];
    if (typeof p !== 'number' || !Number.isInteger(p) || p < PRIORITY_MIN || p > PRIORITY_MAX) return reject('out_of_range');
    this.write(id as EntityId, { settings: { ...b.settings, priority: p } });
    const jobs = this.host.services.jobs;
    const job = this.jobIdOf(buildKey(id as EntityId));
    if (job !== 0) jobs.setPriority?.(job, p);
    return OK;
  }

  private jobIdOf(key: string): number {
    return this.host.jobIdByKey(key);
  }

  private addPending(id: EntityId): void {
    if (!this.pending.includes(id)) {
      this.pending.push(id);
      this.pending.sort((a, b) => a - b);
    }
  }

  /** Take a building away: its tiles, its jobs, `BuildingRemoved { id, buildingType, value }`. */
  remove(id: EntityId): void {
    const b = this.get(id);
    if (b === undefined) return;
    const row = this.row(b.type);
    const jobs = this.host.services.jobs;
    for (const key of [buildKey(id), deconstructKey(id)]) {
      const job = this.jobIdOf(key);
      if (job !== 0) jobs.cancel(job, 'target_invalid');
    }
    for (const t of b.footprint) if (this.map.buildingAtTile(t) === id) this.map.setBuildingAt(t, 0);
    const value = b.state === 'built' ? this.valueOf(b) : 0;
    // A linked furniture item returns to the ground (14 § Placement); a building's own container
    // (the wagon) leaves its contents where it stood.
    const anchor = this.anchorOf(b);
    const mechanism = this.itemIndex.get('mechanism');
    for (const peerId of b.linkedIds) {
      const peer = this.get(peerId);
      if (peer === undefined) continue;
      const ownMaterials = (b.settings['linkMaterials'] as [EntityId, number][] | undefined) ?? [];
      const peerMaterials = (peer.settings['linkMaterials'] as [EntityId, number][] | undefined) ?? [];
      const material = ownMaterials.find(([target]) => target === peerId)?.[1] ??
        peerMaterials.find(([target]) => target === id)?.[1];
      if (material !== undefined && mechanism !== undefined) this.host.services.spawn.item(mechanism, material, anchor, 1);
      this.write(peerId, { linkedIds: peer.linkedIds.filter((linked) => linked !== id),
        settings: { ...peer.settings, linkMaterials: peerMaterials.filter(([target]) => target !== id) } });
    }
    if (b.itemId !== 0) this.host.services.items?.uninstall?.(b.itemId, anchor);
    if (b.state === 'built' && row.tags.includes('bridge')) {
      for (const tile of (b.settings['openTiles'] as TileIndex[] | undefined) ?? []) {
        if (this.map.kindAt(tile) === TileKind.Floor) this.host.services.terrain.setKind(tile, TileKind.Open, 0);
      }
    }
    const held = this.host.entities.get(id, C.Container);
    if (held !== undefined) for (const it of held.contents.slice()) this.host.services.items?.dropAt(it, anchor);
    this.noteSpecial(id, row, false);
    if (b.state === 'built') this.onFootprintChanged(b.footprint);
    const at = this.pending.indexOf(id);
    if (at >= 0) this.pending.splice(at, 1);
    if (this.hearthId === id) this.hearthId = 0;
    this.host.entities.destroy(id);
    this.host.emit({ type: 'BuildingRemoved', id, buildingType: row.id, value });
  }

  // ---------- the job producer ----------

  /** The `buildings` producer: a job for every planned building and every pending deconstruction. */
  producer(): JobProducer {
    return {
      id: 'buildings',
      produce: (ctx: TickContext) => this.produce(ctx),
      onComplete: (job, ctx) => this.onComplete(job as JobLike, ctx),
      canComplete: (job) => this.canComplete(job as JobLike),
      workCentiTicks: (job) => {
        const t = (job as JobLike).data['buildTicks'];
        return typeof t === 'number' ? t * 100 : undefined;
      },
      onJobEvent: (event) => {
        if (event.type === 'JobClaimed' && event['jobType'] === 'build') {
          const id = event['target'] as EntityId;
          const b = this.get(id);
          if (b !== undefined && b.state === 'planned') this.write(id, { state: 'constructing' });
        } else if (event.type === 'JobCancelled') {
          // A cancelled job whose building still stands is made again.
          for (const id of this.all()) {
            const b = this.get(id) as Building;
            if (b.state !== 'built' || b.settings['deconstruct'] === true) this.addPending(id);
          }
        }
      },
    };
  }

  private produce(ctx: TickContext): void {
    if (this.pending.length === 0) return;
    const jobs = ctx.jobs;
    for (const id of this.pending.splice(0)) {
      const b = this.get(id);
      if (b === undefined) continue;
      const row = this.row(b.type);
      const priority = (b.settings['priority'] as number | undefined) ?? PRIORITY_DEFAULT;
      const anchor = this.anchorOf(b);
      const material = (b.settings['materialChoice'] as number | undefined) ?? 0;
      if (b.state !== 'built') {
        if (jobs.exists(buildKey(id))) continue;
        const inputs = this.inputsFor(row, b.footprint.length, material);
        jobs.create(buildKey(id), {
          type: 'build',
          target: { kind: 'building', ref: id },
          workTile: standsAt(row.id, this.map, b.origin) ? 'at' : 'adjacent',
          priority,
          inputs,
          data: {
            building: id,
            anchorTile: anchor,
            labor: this.laborFor(row, material),
            buildTicks: row.buildTicks * (row.tags.includes('bridge') ? b.footprint.length : 1),
            inputUnits: inputs.some((i) => i.count > 1),
          },
        });
      } else if (b.settings['deconstruct'] === true) {
        if (jobs.exists(deconstructKey(id))) continue;
        jobs.create(deconstructKey(id), {
          type: 'deconstruct',
          target: { kind: 'building', ref: id },
          workTile: 'adjacent',
          priority,
          data: { building: id, anchorTile: anchor, labor: this.laborFor(row, b.material), buildTicks: Math.floor(row.buildTicks * (row.tags.includes('bridge') ? b.footprint.length : 1) / 2) },
        });
      }
    }
  }

  /** Plan clearance before consuming inputs; a wall may not entomb leftover ground items. */
  private wallItemMoves(b: Building, delivered: readonly EntityId[], take?: ReadonlyMap<EntityId, number>): readonly [EntityId, TileIndex][] | null {
    if (CONSTRUCTION_KIND[this.row(b.type).id] !== TileKind.Wall) return [];
    const consumed = new Map<EntityId, number>();
    for (const id of delivered) consumed.set(id, (consumed.get(id) ?? 0) + (take?.get(id) ?? 1));
    const moves: [EntityId, TileIndex][] = [];
    for (const tile of b.footprint) {
      const remaining = this.host.itemsAt(tile).filter((id) =>
        (this.host.entities.get(id, C.Item)?.count ?? 0) > (consumed.get(id) ?? 0));
      if (remaining.length === 0) continue;
      const destination = this.map.neighbors8(tile).filter((at) =>
        !b.footprint.includes(at) && isSolidBottomed(this.map.kindAt(at)) && this.host.walkable(at))
        .sort((a, other) => a - other)[0];
      if (destination === undefined) return null;
      for (const id of remaining) moves.push([id, destination]);
    }
    return moves;
  }

  private buildInputs(job: JobLike): { delivered: EntityId[]; take: Map<EntityId, number> } {
    const delivered: EntityId[] = [];
    const take = new Map<EntityId, number>();
    for (const input of job.inputs) {
      let remaining = input.count;
      for (const it of input.delivered) {
        delivered.push(it);
        if (remaining > 0) {
          const stackCount = this.host.entities.get(it, C.Item)?.count ?? 1;
          const units = Math.min(remaining, stackCount);
          take.set(it, units);
          remaining -= units;
        }
      }
    }
    return { delivered, take };
  }

  /** A wall waits for creatures and for space to clear leftover items. */
  private canComplete(job: JobLike): boolean {
    const id = job.data['building'];
    if (typeof id !== 'number' || !job.key.startsWith('build:')) return true;
    const b = this.get(id);
    if (b === undefined) return true;
    if (CONSTRUCTION_KIND[this.row(b.type).id] !== TileKind.Wall) return true;
    if (b.footprint.some((t) => this.host.creaturesAt(t).length !== 0)) return false;
    const { delivered, take } = this.buildInputs(job);
    return this.wallItemMoves(b, delivered, take) !== null;
  }

  private onComplete(job: JobLike, _ctx: TickContext): void {
    if (job.key.startsWith('link_mechanism:')) {
      const sourceId = job.data['sourceId'];
      const targetId = job.data['targetId'];
      if (typeof sourceId !== 'number' || typeof targetId !== 'number') return;
      const source = this.get(sourceId);
      const target = this.get(targetId);
      if (source?.state !== 'built' || target?.state !== 'built') return;
      if (job.data['stage'] === 'target') {
        const item = job.inputs[0]?.delivered[0];
        if (item === undefined) return;
        const material = this.host.entities.get(item, C.Item)?.material;
        if (material === undefined) return;
        _ctx.world.services.items?.consume(item, 1);
        _ctx.jobs.create(linkKey(sourceId, targetId, 'source'), {
          type: 'link_mechanism', target: { kind: 'building', ref: sourceId }, workTile: 'adjacent',
          data: { sourceId, targetId, stage: 'source', material, anchorTile: this.anchorOf(source), labor: 'mechanics', buildTicks: LINK_WORK_TICKS },
        });
      } else if (job.data['stage'] === 'source') {
        const material = job.data['material'];
        const materials = (source.settings['linkMaterials'] as [EntityId, number][] | undefined) ?? [];
        const nextMaterials: [EntityId, number][] = typeof material === 'number' ? [...materials, [targetId, material]] : materials;
        this.write(sourceId, { linkedIds: [...source.linkedIds, targetId].sort((a, b) => a - b),
          settings: { ...source.settings, linkMaterials: nextMaterials.sort((a, b) => a[0] - b[0]) } });
        this.write(targetId, { linkedIds: [...target.linkedIds, sourceId].sort((a, b) => a - b) });
      }
      return;
    }
    const id = job.data['building'];
    if (typeof id !== 'number' || this.get(id) === undefined) return;
    if (job.key.startsWith('build:')) {
      const { delivered, take } = this.buildInputs(job);
      this.complete(id, delivered, 0, 0, take);
    } else if (job.key.startsWith('deconstruct:')) {
      this.dismantle(id);
    }
  }

  /**
   * Build completion: consume the inputs (one unit of each delivered stack, or units from `take`;
   * D-073, Decision F-01c, D-154), `built`, the tile change of a construction,
   * `BuildingCompleted { id, buildingType, value }`. A piece of furniture *links* its item instead
   * (`Building.itemId`, 14 § Placement): the item leaves the map as `Installed` and gives the
   * building its material (D-074). With no delivered inputs (`TestWorld.build`), `linked` names the
   * furniture item to link (else one is made), and `material` and the first alternative of each
   * input stand in for the rest.
   */
  complete(id: EntityId, delivered: readonly EntityId[], material: number, linked: EntityId = 0, take?: ReadonlyMap<EntityId, number>): void {
    const b = this.get(id) as Building;
    const row = this.row(b.type);
    const moves = this.wallItemMoves(b, delivered, take);
    if (moves === null) return;
    const items = this.host.services.items;
    const used: { type: string; material: number }[] = [];
    const furniture = row.category === 'furniture';
    const trap = row.tags.some((tag) => tag.startsWith('trap:'));
    const trapLoaded: EntityId[] = [];
    let itemId: EntityId = 0;
    for (let index = 0; index < delivered.length; index += 1) {
      const it = delivered[index] as EntityId;
      const rec = this.host.entities.get(it, C.Item);
      if (rec === undefined) continue;
      if (furniture && itemId === 0) {
        itemId = it;
        continue;
      }
      const units = take?.get(it) ?? 1;
      if (units <= 0) continue;
      if (trap && index > 0) {
        const payload = rec.count > units ? (items?.split(it, units) ?? it) : it;
        items?.install?.(payload);
        trapLoaded.push(payload);
        used.push({ type: this.itemTypes[rec.type]?.id ?? '', material: rec.material });
        continue;
      }
      for (let u = 0; u < units; u += 1) {
        used.push({ type: this.itemTypes[rec.type]?.id ?? '', material: rec.material });
      }
      items?.consume(it, units);
    }
    if (delivered.length === 0) {
      row.inputs.forEach((input, k) => {
        const t = this.typesOf(input.match)[0];
        const n = input.count === 'tiles' ? b.footprint.length : input.count;
        if (furniture && k === 0) {
          itemId = linked !== 0 ? linked : t === undefined ? 0 : this.host.services.spawn.item(t, material, this.anchorOf(b), 1);
          return;
        }
        for (let j = 0; j < n && t !== undefined; j += 1) used.push({ type: this.itemTypes[t]?.id ?? '', material });
        if (trap && k > 0 && t !== undefined) {
          for (let j = 0; j < n; j += 1) {
            const payload = this.host.services.spawn.item(t, material, this.anchorOf(b), 1);
            items?.install?.(payload);
            trapLoaded.push(payload);
          }
        }
      });
    }
    for (const [item, destination] of moves) items?.dropAt(item, destination);
    const linkedRec = itemId === 0 ? undefined : this.host.entities.get(itemId, C.Item);
    if (linkedRec === undefined) itemId = 0;
    if (itemId !== 0) items?.install?.(itemId);
    const mat = linkedRec?.material ?? used[0]?.material ?? (material !== 0 ? material : b.material);
    this.write(id, { state: 'built', itemId, material: mat as Idx<'MaterialDef'>, settings: { ...b.settings, inputs: used, ...(trap ? { trapLoaded } : {}), ...(row.tags.includes('cage') ? { occupantId: linkedRec?.occupantId ?? 0 } : {}) } });
    const kind = CONSTRUCTION_KIND[row.id];
    if (kind !== undefined) {
      const terrain = this.host.services.terrain;
      const flags = constructionFlags(row.id);
      for (const t of b.footprint) {
        terrain.setKind(t, kind, mat);
        if ((flags.clear & TileFlag.Grass) !== 0) terrain.setFlag(t, TileFlag.Grass, false);
        if ((flags.clear & TileFlag.Mud) !== 0) terrain.setFlag(t, TileFlag.Mud, false);
        // Setting `constructed` runs 03's support check (`03` § Support and collapse).
        terrain.setFlag(t, TileFlag.Constructed, true);
      }
    } else {
      if (row.tags.includes('bridge')) {
        for (const tile of (b.settings['openTiles'] as TileIndex[] | undefined) ?? []) {
          this.host.services.terrain.setKind(tile, TileKind.Floor, mat);
        }
      }
      for (const t of b.footprint) this.map.markChunkDirty(t, true, true);
    }
    const built = this.get(id);
    if (built === undefined) return;
    this.noteSpecial(id, row, true);
    this.onFootprintChanged(built.footprint);
    this.stepOffBlockedTiles(built);
    this.host.emit({ type: 'BuildingCompleted', id, buildingType: row.id, value: this.valueOf(built) });
    if (row.tags.includes('hearth')) this.host.emit({ type: 'HearthLit', id });
  }

  /**
   * 14 § Placement: a creature standing on a tile that the finished building makes impassable (a
   * forge's corner, where its builder may have worked) steps to the nearest passable tile beside the
   * footprint, ties by tile index, in the same tick.
   */
  private stepOffBlockedTiles(b: Building): void {
    const movement = this.host.services.movement;
    if (movement === null || movement === undefined) return;
    const footprint = new Set(b.footprint);
    for (const tile of b.footprint) {
      if (!this.blocksMovementAt(tile, 'walker', undefined)) continue;
      const standing = this.host.creaturesAt(tile).slice();
      if (standing.length === 0) continue;
      let best = -1;
      let bestD = Number.POSITIVE_INFINITY;
      for (const t of b.footprint) {
        for (const n of this.map.neighbors8(t)) {
          if (footprint.has(n) || !this.host.walkable(n)) continue;
          const d = Math.max(Math.abs(this.map.xOf(n) - this.map.xOf(tile)), Math.abs(this.map.yOf(n) - this.map.yOf(tile)));
          if (d < bestD || (d === bestD && n < best)) {
            best = n;
            bestD = d;
          }
        }
      }
      if (best < 0) continue;
      for (const creature of standing) movement.teleport(creature, best);
    }
  }

  /**
   * `deconstruct` completion: "returns the material item(s)" at the anchor, and the building goes
   * (a linked furniture item returns through {@link remove}). The wagon yields `WAGON_LOGS` logs
   * (`02` § Arrival step 3) and leaves its contents on the ground.
   */
  private dismantle(id: EntityId): void {
    const b = this.get(id) as Building;
    const at = this.anchorOf(b);
    const inputs = (b.settings['inputs'] as { type: string; material: number }[] | undefined) ?? [];
    const spawn = this.host.services.spawn;
    for (const u of inputs) {
      const t = this.itemIndex.get(u.type);
      if (t !== undefined) spawn.item(t, u.material, at, 1);
    }
    const yields = b.settings['yields'] as { type: string; material: number; count: number } | undefined;
    if (yields !== undefined) {
      const t = this.itemIndex.get(yields.type);
      if (t !== undefined) spawn.item(t, yields.material, at, yields.count);
    }
    this.remove(id);
  }

  // ---------- special buildings ----------

  /** The depots and coffins lists of `BuildingsState` follow the built buildings. */
  private noteSpecial(id: EntityId, row: BuildingRow, built: boolean): void {
    const b = this.get(id);
    if (row.id === 'statue' && b?.state === 'built' && this.materials[b.material]?.id === 'glowstone') {
      const centre = this.anchorOf(b);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const tile = this.map.offset(centre, dx, dy, 0);
        if (tile < 0) continue;
        const existing = this.lampLight.get(tile);
        if (built) {
          this.lampLight.set(tile, { count: (existing?.count ?? 0) + 1,
            baseLit: existing?.baseLit ?? this.map.hasFlag(tile, TileFlag.Lit) });
          this.host.services.terrain.setFlag(tile, TileFlag.Lit, true);
        } else if (existing !== undefined) {
          if (existing.count > 1) this.lampLight.set(tile, { ...existing, count: existing.count - 1 });
          else {
            this.lampLight.delete(tile);
            this.host.services.terrain.setFlag(tile, TileFlag.Lit, existing.baseLit);
          }
        }
      }
    }
    const lists: [string, EntityId[]][] = [
      ['depot', this.depots],
      ['coffin', this.coffins],
    ];
    for (const [tag, list] of lists) {
      if (!row.tags.includes(tag)) continue;
      const at = list.indexOf(id);
      if (built && at < 0) {
        list.push(id);
        list.sort((a, c) => a - c);
      } else if (!built && at >= 0) {
        list.splice(at, 1);
      }
    }
  }

  /**
   * `02` § Arrival step 3: "Place the wagon building (function tag `container`, capacity unlimited,
   * deconstructable, yields `WAGON_LOGS` logs)". Built at once around its centre, with its own
   * container (D-074); returns its id.
   */
  placeWagon(centre: TileIndex, logs: { type: string; material: number; count: number }): EntityId {
    const type = this.typeOf('wagon');
    const row = this.row(type);
    const map = this.map;
    const origin = map.offset(centre, -1, -1, 0);
    const tiles = origin < 0 ? null : this.footprint(row, origin, 0);
    if (tiles === null) throw new RangeError('buildings: the wagon does not fit around its centre');
    const id = this.host.entities.create('building');
    this.host.entities.add(id, C.Building, {
      type: type as Idx<'BuildingDef'>,
      material: logs.material as Idx<'MaterialDef'>,
      state: 'built',
      origin,
      footprint: tiles,
      orientation: 0,
      itemId: 0,
      mode: '',
      linkedIds: [],
      ownerId: 0,
      settings: { priority: PRIORITY_DEFAULT, materialChoice: 0, inputs: [], yields: { ...logs } },
      toggled: false,
    });
    this.host.entities.add(id, C.Container, { contents: [], capacity: WAGON_CAPACITY, classId: 'wagon' });
    for (const t of tiles) map.setBuildingAt(t, id);
    for (const t of tiles) map.markChunkDirty(t, true, true);
    this.host.emit({ type: 'BuildingPlaced', id, buildingType: row.id, tiles: tiles.slice() });
    this.host.emit({ type: 'BuildingCompleted', id, buildingType: row.id, value: this.valueOf(this.get(id) as Building) });
    return id;
  }

  /**
   * The tile a building-held container's contents lie on, or -1: the wagon's centre for the wagon,
   * and the tile of the built furniture for its linked item (a hospital's chest).
   */
  holderTile(id: EntityId): TileIndex {
    const b = this.get(id);
    if (b !== undefined) return this.anchorOf(b);
    for (const other of this.host.entities.with(C.Building)) {
      const furniture = this.get(other);
      if (furniture !== undefined && furniture.itemId === id && furniture.state === 'built') return furniture.origin;
    }
    return -1;
  }

  /** `SetDoorMode { buildingId, mode }` / `SetHatchMode { buildingId, mode }`: "building has the tag". */
  setMode(cmd: Command, tag: 'door' | 'hatch'): CommandResult {
    const id = cmd['buildingId'];
    const b = typeof id === 'number' ? this.get(id) : undefined;
    if (b === undefined) return reject('not_found');
    if (!this.row(b.type).tags.includes(tag)) return reject('no_tag');
    const mode = cmd['mode'];
    const modes: readonly string[] = tag === 'door' ? DOOR_MODES : HATCH_MODES;
    if (typeof mode !== 'string' || !modes.includes(mode)) return reject('bad_setting');
    if (mode === b.mode) return OK;
    const isHearth = this.host.alert() === 'hearth';
    const settings = mode === 'lock_on_alert'
      ? {
          ...b.settings,
          alertAt: isHearth ? this.host.tick() : null,
          outsideClearSince: isHearth && !this.civilianOutsideDoor(b) ? this.host.tick() : null,
          alertLocked: false,
          lockHeld: false,
        }
      : { ...b.settings, alertAt: null, outsideClearSince: null, alertLocked: false, lockHeld: tag === 'door' && mode === 'locked' && !this.occupied(b) };
    this.write(id as EntityId, { mode, settings });
    // "locking a door dirties its chunk" (22 § Connectivity).
    for (const t of b.footprint) this.map.markChunkDirty(t, true, true);
    this.host.emit({ type: 'BuildingStateChanged', id, state: mode });
    return OK;
  }

  /** A link is worked at the target, then the source, consuming one mechanism. */
  link(cmd: Command, ctx: TickContext): CommandResult {
    const sourceId = cmd['sourceId'];
    const targetId = cmd['targetId'];
    if (typeof sourceId !== 'number' || typeof targetId !== 'number') return reject('not_found');
    const source = this.get(sourceId);
    const target = this.get(targetId);
    if (source === undefined || target === undefined) return reject('not_found');
    const sourceTags = this.row(source.type).tags;
    const targetTags = this.row(target.type).tags;
    if (sourceId === targetId || source.state !== 'built' || target.state !== 'built' ||
      !sourceTags.some((tag) => tag === 'lever' || tag === 'plate') ||
      !targetTags.some((tag) => ['door', 'hatch', 'floodgate', 'bridge', 'trap:spike', 'cage'].includes(tag))) return reject('not_linkable');
    if (source.linkedIds.includes(targetId) || ctx.jobs.exists(linkKey(sourceId, targetId, 'target')) ||
      ctx.jobs.exists(linkKey(sourceId, targetId, 'source'))) return reject('assigned');
    ctx.jobs.create(linkKey(sourceId, targetId, 'target'), {
      type: 'link_mechanism', target: { kind: 'building', ref: targetId }, workTile: 'adjacent',
      inputs: [{ filter: { types: this.typesOf('mechanism') }, count: 1 }],
      data: { sourceId, targetId, stage: 'target', anchorTile: this.anchorOf(target), labor: 'mechanics', buildTicks: LINK_WORK_TICKS },
    });
    return OK;
  }

  unlink(cmd: Command, ctx: TickContext): CommandResult {
    const sourceId = cmd['sourceId'];
    const targetId = cmd['targetId'];
    if (typeof sourceId !== 'number' || typeof targetId !== 'number') return reject('not_found');
    const source = this.get(sourceId);
    const target = this.get(targetId);
    if (source === undefined || target === undefined || !source.linkedIds.includes(targetId)) return reject('not_linkable');
    const materials = (source.settings['linkMaterials'] as [EntityId, number][] | undefined) ?? [];
    const material = materials.find(([id]) => id === targetId)?.[1];
    this.write(sourceId, { linkedIds: source.linkedIds.filter((id) => id !== targetId),
      settings: { ...source.settings, linkMaterials: materials.filter(([id]) => id !== targetId) } });
    this.write(targetId, { linkedIds: target.linkedIds.filter((id) => id !== sourceId) });
    const mechanism = this.itemIndex.get('mechanism');
    if (material !== undefined && mechanism !== undefined) ctx.world.services.spawn.item(mechanism, material, source.origin, 1);
    return OK;
  }

  /** 14 § Mechanisms: plate settings are data on the building; 19 evaluates them. */
  setPlateTrigger(cmd: Command): CommandResult {
    const id = cmd['plateId'];
    const b = typeof id === 'number' ? this.get(id) : undefined;
    if (b === undefined) return reject('not_found');
    if (!this.row(b.type).tags.includes('plate')) return reject('no_tag');
    const trigger = cmd['trigger'];
    if (typeof trigger !== 'object' || trigger === null) return reject('bad_setting');
    const value = trigger as Record<string, unknown>;
    if (value['kind'] === 'creatures') {
      if (typeof value['minSize'] !== 'number' || value['minSize'] < 0 || typeof value['includeFortress'] !== 'boolean') return reject('bad_setting');
    } else if (value['kind'] === 'water' || value['kind'] === 'magma') {
      const level = value['level'];
      if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > FLUID_MAX_LEVEL) return reject('out_of_range');
    } else return reject('bad_setting');
    this.write(id as EntityId, { settings: { ...b.settings, triggerOn: { ...value } } });
    return OK;
  }

  /** Apply a pending trigger after 14's LINK_DELAY_TICKS queue matures. */
  applyMechanism(id: EntityId, on: boolean, ctx: TickContext, rng: RngStream): void {
    const b = this.get(id);
    if (b === undefined || b.state !== 'built') return;
    const tags = this.row(b.type).tags;
    let state = '';
    if (tags.includes('door') || tags.includes('hatch')) {
      this.write(id, {
        mode: on ? 'locked' : 'open',
        ...(tags.includes('door') ? { settings: { ...b.settings, lockHeld: on && !this.occupied(b) } } : {}),
      });
      state = on ? 'locked' : 'open';
    } else if (tags.includes('floodgate')) {
      this.write(id, { toggled: on });
      state = on ? 'open' : 'closed';
    } else if (tags.includes('bridge')) {
      if (b.toggled === on) return;
      this.write(id, { toggled: on });
      state = on ? 'raised' : 'lowered';
      const openTiles = (b.settings['openTiles'] as TileIndex[] | undefined) ?? [];
      for (const tile of openTiles) this.host.services.terrain.setKind(tile, on ? TileKind.Open : TileKind.Floor, on ? 0 : b.material);
      if (on) {
        const footprint = new Set(b.footprint);
        for (const tile of b.footprint) {
          const adjacent = this.map.neighbors8(tile).filter((next) => !footprint.has(next) && ctx.readers.pathing.passable(next, 'walker'));
          let shaftDepth = 0;
          let below = this.map.below(tile);
          while (below >= 0 && this.map.kindAt(below) === TileKind.Open) {
            shaftDepth += 1;
            below = this.map.below(below);
          }
          for (const creature of this.host.creaturesAt(tile)) {
            ctx.emit({ type: 'DamageDealt', defenderId: creature, attackerId: 0,
              part: rng.pick(BODY_SLOTS), damageType: 'blunt', amount: BRIDGE_CRUSH_DAMAGE });
            if (openTiles.includes(tile) && shaftDepth >= 3) this.host.services.movement?.fall(creature, ctx);
            else if (adjacent.length > 0) this.host.services.movement?.teleport(creature, rng.pick(adjacent));
            else if (this.map.kindAt(tile) === TileKind.Open) this.host.services.movement?.fall(creature, ctx);
            else killCreature(ctx, creature, 'bridge_crush');
          }
          for (const item of ctx.readers.entities.at(tile)) {
            if (this.host.entities.get(item, C.Item) !== undefined && adjacent.length > 0) {
              this.host.services.items?.dropAt(item, rng.pick(adjacent));
            }
          }
        }
      }
    } else if (tags.includes('trap:spike')) {
      this.write(id, { toggled: on });
      state = on ? 'extended' : 'retracted';
    } else if (tags.includes('cage') && on) {
      this.releaseCage({ type: 'ReleaseCage', cageBuildingId: id });
      return;
    } else return;
    for (const tile of b.footprint) this.map.markChunkDirty(tile, true, true);
    this.host.emit({ type: 'BuildingStateChanged', id, state });
    this.host.emit({ type: 'MechanismToggled', id, newState: state });
  }

  releaseCage(cmd: Command): CommandResult {
    const id = cmd['cageBuildingId'];
    const b = typeof id === 'number' ? this.get(id) : undefined;
    if (b === undefined) return reject('not_found');
    if (!this.row(b.type).tags.includes('cage')) return reject('no_tag');
    const occupant = b.settings['occupantId'];
    if (typeof occupant !== 'number' || occupant === 0) return reject('precondition_failed');
    for (const tile of this.map.neighbors(b.origin)) {
      if (this.map.kindAt(tile) === TileKind.Floor && this.host.services.movement?.teleport(occupant, tile)) {
        this.write(id as EntityId, { settings: { ...b.settings, occupantId: 0 } });
        this.host.services.items?.setOccupant?.(b.itemId, 0);
        const creature = this.host.entities.get(occupant, C.Creature);
        if (creature !== undefined) this.host.entities.add(occupant, C.Creature, { ...creature, cagedIn: 0 });
        return OK;
      }
    }
    return reject('precondition_failed');
  }

  /** `AlertChanged`: the `lock_on_alert` doors lock or unlock with the alert. */
  onAlertChanged(): void {
    const isHearth = this.host.alert() === 'hearth';
    for (const id of this.all()) {
      const b = this.get(id) as Building;
      if (b.mode !== 'lock_on_alert') continue;
      const outside = isHearth ? this.civilianOutsideDoor(b) : false;
      this.write(id, {
        settings: {
          ...b.settings,
          alertAt: isHearth ? this.host.tick() : null,
          outsideClearSince: isHearth && !outside ? this.host.tick() : null,
          alertLocked: false,
          shutOutNoted: false,
        },
      });
      const locked = isHearth && this.doorLocked(this.get(id) as Building);
      if (locked) {
        this.write(id, { settings: { ...(this.get(id) as Building).settings, alertLocked: true } });
      }
      for (const t of b.footprint) this.map.markChunkDirty(t, true, true);
      this.host.emit({ type: 'BuildingStateChanged', id, state: locked ? 'locked' : 'open' });
    }
    if (isHearth) this.noteShutOut();
  }

  /**
   * 14 § Doors and hatches: a `lock_on_alert` door that locks while every living fortress dwarf stands outdoors shuts
   * the fortress out of its own gate. Said once per alert, in a line that names the locked doors.
   */
  private noteShutOut(): void {
    const doors = this.all().filter((id) => {
      const b = this.get(id) as Building;
      return b.mode === 'lock_on_alert' && b.state === 'built' && b.settings['alertLocked'] === true;
    });
    const first = doors[0];
    if (first === undefined || doors.some((id) => (this.get(id) as Building).settings['shutOutNoted'] === true)) return;
    const entities = this.host.entities;
    let dwarves = 0;
    for (const id of entities.with(C.Labors)) {
      if (entities.get(id, C.Creature)?.faction !== 'fortress') continue;
      const p = entities.get(id, C.Position);
      if (p === undefined) continue;
      dwarves += 1;
      if (!this.map.hasFlag(this.map.index(p.x, p.y, p.z), TileFlag.Outdoor)) return;
    }
    if (dwarves === 0) return;
    for (const id of doors) this.write(id, { settings: { ...(this.get(id) as Building).settings, shutOutNoted: true } });
    this.host.emit({ type: 'FortressShutOut', id: first, doors, tile: (this.get(first) as Building).origin });
  }

  /**
   * A door locked by hand or by a lever does not close on a creature in its doorway: it locks, and its
   * chunks are dirtied, on the first tick the doorway is clear (14 § Doors and hatches).
   */
  tickLockedDoors(): void {
    for (const id of this.all()) {
      const b = this.get(id) as Building;
      if (b.mode !== 'locked' || b.state !== 'built' || b.settings['lockHeld'] === true || !this.row(b.type).tags.includes('door')) continue;
      if (this.occupied(b)) continue;
      this.write(id, { settings: { ...b.settings, lockHeld: true } });
      for (const tile of b.footprint) this.map.markChunkDirty(tile, true, true);
      this.host.emit({ type: 'BuildingStateChanged', id, state: 'locked' });
    }
  }

  /** A creature stands in the building's doorway. */
  private occupied(b: Building): boolean {
    return b.footprint.some((t) => this.host.creaturesAt(t).length !== 0);
  }

  /** A hearth door stays open while civilians pass, up to ALERT_LOCK_GRACE_TICKS. */
  tickAlertDoors(): void {
    if (this.host.alert() !== 'hearth') return;
    for (const id of this.all()) {
      const b = this.get(id) as Building;
      if (b.mode !== 'lock_on_alert' || b.state !== 'built' || b.settings['alertLocked'] === true) continue;
      const outside = this.civilianOutsideDoor(b);
      const clearSince = outside ? null : (typeof b.settings['outsideClearSince'] === 'number' ? b.settings['outsideClearSince'] : this.host.tick());
      this.write(id, { settings: { ...b.settings, outsideClearSince: clearSince } });
      const updated = this.get(id) as Building;
      if (this.doorLocked(updated)) {
        this.write(id, { settings: { ...updated.settings, alertLocked: true } });
        for (const tile of b.footprint) this.map.markChunkDirty(tile, true, true);
        this.host.emit({ type: 'BuildingStateChanged', id, state: 'locked' });
        this.noteShutOut();
      }
    }
  }

  /** An inner airlock door's outside is the corridor side away from the hearth, even indoors. */
  private civilianOutsideDoor(door: Building): boolean {
    const map = this.map;
    const tile = door.origin;
    const hearth = this.get(this.hearthId);
    if (hearth !== undefined) {
      const wall = (dx: number, dy: number): boolean => {
        const next = map.offset(tile, dx, dy, 0);
        return next >= 0 && map.kindAt(next) === TileKind.Wall;
      };
      const axis: 'x' | 'y' | null = wall(-1, 0) && wall(1, 0) ? 'y' : wall(0, -1) && wall(0, 1) ? 'x' : null;
      if (axis !== null) {
        const at = axis === 'x' ? map.xOf(tile) : map.yOf(tile);
        const home = axis === 'x' ? map.xOf(hearth.origin) : map.yOf(hearth.origin);
        if (home !== at) {
          return this.host.entities.with(C.Creature, C.Position).some((id) => {
            const creature = this.host.entities.get(id, C.Creature);
            const pos = this.host.entities.get(id, C.Position);
            if (creature?.faction !== 'fortress' || pos === undefined || pos.z !== map.zOf(tile)) return false;
            const coord = axis === 'x' ? pos.x : pos.y;
            return (coord - at) * (home - at) <= 0;
          });
        }
      }
    }
    return map.neighbors(tile).some((next) => map.hasFlag(next, TileFlag.Outdoor) &&
      this.host.creaturesAt(next).some((id) => this.host.entities.get(id, C.Creature)?.faction === 'fortress'));
  }

  /** Whether a well has water within `WELL_DEPTH` below (14: "`working` when water is present"). */
  wellWorking(id: EntityId): boolean {
    const b = this.get(id);
    if (b === undefined || b.state !== 'built' || !this.row(b.type).tags.includes('well')) return false;
    const below = this.host.waterBelow?.(b.origin, WELL_DEPTH) ?? null;
    if (below !== null) return this.map.kindAt(b.origin) === TileKind.Open && below >= 0;
    return onRuleHolds(this.map, 'open_water_below', b.origin);
  }

  // ---------- terrain and passability ----------

  /** The item a construction on a tile was built from (03's `remove` and collapse return it; D-050). */
  constructionItemAt(tile: TileIndex): string | null {
    const id = this.map.buildingAtTile(tile);
    const b = id === 0 ? undefined : this.get(id);
    if (b === undefined || b.state !== 'built' || this.row(b.type).category !== 'construction') return null;
    const inputs = b.settings['inputs'] as { type: string }[] | undefined;
    return inputs?.[0]?.type ?? null;
  }

  /** A construction whose tile was removed or collapsed is gone (`TilesChanged`). */
  onTilesChanged(tiles: readonly TileIndex[]): void {
    for (const t of tiles) {
      const id = this.map.buildingAtTile(t);
      const b = id === 0 ? undefined : this.get(id);
      if (b === undefined || b.state !== 'built' || this.row(b.type).category !== 'construction') continue;
      if (!this.map.hasFlag(t, TileFlag.Constructed) || this.map.kindAt(t) !== CONSTRUCTION_KIND[this.row(b.type).id]) this.remove(id);
    }
  }

  /** The built building on a tile, or undefined. */
  private builtAt(i: TileIndex): { id: EntityId; b: Building; row: BuildingRow } | undefined {
    const id = this.map.buildingAtTile(i);
    if (id === 0) return undefined;
    const b = this.get(id);
    if (b === undefined || b.state !== 'built') return undefined;
    return { id, b, row: this.row(b.type) };
  }

  /** A door's `locked`, or `lock_on_alert` while the alert is `hearth` (14 § Doors and hatches). */
  doorLocked(b: Building): boolean {
    // A door does not close on a creature in its doorway, whoever locks it: the lock waits until it is clear.
    if (b.mode === 'locked') return b.settings['lockHeld'] === true || !this.occupied(b);
    if (b.mode !== 'lock_on_alert' || this.host.alert() !== 'hearth') return false;
    if (b.settings['alertLocked'] === true) return true;
    // A door does not close on a creature in its doorway: the alert lock waits until it is clear.
    if (this.occupied(b)) return false;
    const at = b.settings['alertAt'];
    if (typeof at !== 'number') return true;
    const clear = b.settings['outsideClearSince'];
    return this.host.tick() - at >= ALERT_LOCK_GRACE_TICKS || (typeof clear === 'number' && this.host.tick() - clear >= ALERT_OUTSIDE_CLEAR_TICKS);
  }

  /**
   * 22's `blocksMovementAt(i, cls, faction)`: a built building that is not passable blocks every
   * class; a planned one is passable; constructions are the terrain's. A door (22 § Passability)
   * blocks everyone when locked; otherwise `large`, `wild` and hostiles without `opensDoors`, and
   * tame animals at a `no_pets` door. With no faction (the connectivity labels) an unlocked door is
   * passable to every class that can use doors. A hatch never blocks horizontal movement; a closed
   * floodgate and a raised bridge block all.
   */
  blocksMovementAt(i: TileIndex, cls: MovementClass, faction: string | undefined, mover?: MoverOptions): boolean {
    const at = this.builtAt(i);
    if (at === undefined) return false;
    const { b, row } = at;
    if (row.category === 'construction') return false;
    if (row.tags.includes('door')) {
      if (this.doorLocked(b)) return true;
      if (cls === 'large') return true;
      if (faction === undefined) return false;
      if (faction === 'wild') return true;
      if ((faction.startsWith('hostile') || faction === 'deep') && mover?.opensDoors !== true) return true;
      return b.mode === 'no_pets' && mover?.tame === true;
    }
    if (row.tags.includes('hatch')) return false;
    if (row.tags.includes('floodgate')) return !b.toggled;
    if (row.tags.includes('bridge')) return b.toggled;
    if (row.passable === false) return true;
    const k = b.footprint.indexOf(i);
    return row.impassableTiles !== undefined && row.impassableTiles.includes(k);
  }

  /** 22's `doorAt(i)`: a built door stands on the tile (+`DOOR_COST_PENALTY`; creatures block there). */
  doorAt(i: TileIndex): boolean {
    return this.builtAt(i)?.row.tags.includes('door') === true;
  }

  /** 22's `lockedHatchAt(i)` and 14's `blocksFallAt(i)`: a built hatch in `locked` mode. */
  lockedHatchAt(i: TileIndex): boolean {
    const at = this.builtAt(i);
    return at !== undefined && at.row.tags.includes('hatch') && at.b.mode === 'locked';
  }

  /**
   * 22's `blocksSightAt(i)`: "closed doors, raised bridges, closed floodgates". A door stands open
   * while a creature is in its doorway and is closed otherwise (the `/` and `+` of
   * `glyphs-and-colors.md`; D-074).
   */
  blocksSightAt(i: TileIndex): boolean {
    const at = this.builtAt(i);
    if (at === undefined) return false;
    if (at.row.tags.includes('door')) return this.doorLocked(at.b) || this.host.creaturesAt(i).length === 0;
    if (at.row.tags.includes('floodgate')) return !at.b.toggled;
    if (at.row.tags.includes('bridge')) return at.b.toggled;
    return false;
  }

  /** 14's `blocksFluidAt(i)`: a `blocks_fluid` building that is shut (closed floodgate, raised bridge). */
  blocksFluidAt(i: TileIndex): boolean {
    const at = this.builtAt(i);
    if (at === undefined || at.row.category === 'construction') return false;
    if (at.row.blocksFluid === true) return true;
    if (at.row.tags.includes('floodgate')) return !at.b.toggled;
    if (at.row.tags.includes('bridge')) return at.b.toggled;
    return false;
  }
}

/** The part of 11's job record the producer reads. */
interface JobLike {
  readonly key: string;
  readonly inputs: readonly { readonly count: number; readonly delivered: readonly EntityId[] }[];
  readonly data: Readonly<Record<string, unknown>>;
}
