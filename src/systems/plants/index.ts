/**
 * 07 Plants & farming: the system. `02-systems/07-plants-and-farming.md` § Growth, § Farm plots,
 * § Seeds, § State, § Interfaces; `04-implementation/algorithms/environment.md` § Plant growth;
 * `tick-order.md` (07 runs at `(tick − 11) % 50`, once per game hour).
 *
 * Trees, saplings, shrubs, grass and ash join in T-M4-02; this file carries their state and the
 * daily hook so that the saved shape is the one `schemas/system-state.md` `PlantsState` gives.
 *
 * Every tile flag and designation this system writes goes through the terrain API inside 07's own
 * tick or a command, never in an event handler (D-089).
 */

import { C, type Crop } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import { SEASONS_PER_YEAR } from '@core/constants';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { EntityStore } from '@core/entities';
import { TICKS_PER_DAY } from '@core/constants';
import { Designation, TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { LocalMapSpec } from '@systems/embark/spec';
import type { MaterialsReader } from '@systems/materials';
import { ASH_DURATION_DAYS, FROST_KILL_C } from '@systems/materials/constants';
import { GLASSLANDS_TREE_DENSITY } from '@systems/terrain/constants';
import type { WeatherReader } from '@systems/weather';
import { WILT_PERMILLE } from '@systems/weather/constants';
import { CROP_DROWN_LEVEL, HARVEST_PRIORITY, PLANTS_CADENCE, PLANTS_PHASE } from './constants';
import { PlantFacts, type PlantRow } from './facts';
import { advance, growthPerHour, isMature, progressPercent, seasonAllows, stageLength } from './growth';
import { FARM_PLOT, cropsOf, lightMatches, plotKindOf, withCrop, type PlotKind } from './plots';
import { PlantsProducer } from './producer';
import type { CropInfo, PlantsReader } from './reader';
import type { PlantsStateV1 } from './state';
import { growSaplings, regrowGrass, regrowthTries, type WildHost } from './wild';

export * from './constants';
export * from './growth';
export { PlantFacts, type PlantRow } from './facts';
export { FARM_PLOT, CROP_SETTING, cropsOf, lightMatches, plotKindOf, type PlotKind } from './plots';
export { AUTO_HARVEST, PlantsProducer, harvestKey, plantKey } from './producer';
export { CAVERN_BANDS, clearOfTrees, hasGrassNeighbor, plantable, weighted, type WildHost } from './wild';
export type { CropInfo, PlantsReader } from './reader';

/** The id 07 registers its reader under. */
export const PLANTS_ID = '07';

export interface PlantsOptions {
  /** The embark region: its biome and traits decide which trees regrow and how densely. */
  readonly spec: Pick<LocalMapSpec, 'biome' | 'traits'>;
}

interface BiomeRow {
  readonly id: string;
  readonly treeDensity: number;
}

/** `CropDied { tile, reason }`: the reasons this system uses. */
export type CropDeathReason = 'frost' | 'flooded' | 'tile' | 'zone_removed';

export class PlantsSystem extends BaseSystem<PlantsStateV1> {
  readonly id = PLANTS_ID;
  readonly order = 7;
  override readonly cadence = PLANTS_CADENCE;
  override readonly phase = PLANTS_PHASE;
  override readonly subscribes: readonly EventType[] = [
    'DayPassed',
    'SeasonEffectsChanged',
    'ZoneChanged',
    'TilesChanged',
    'GrassGrazed',
    'FireOut',
    'JobCompleted',
  ];
  override readonly ownsCommands: readonly CommandType[] = ['SetPlotCrop', 'DesignateHarvest'];

  private readonly options: PlantsOptions;
  private mapRef: Map3D | null = null;
  private storeRef: EntityStore | null = null;
  private rngRef: RngStream | null = null;
  private factsRef: PlantFacts | null = null;
  private readersRef: InitContext['readers'] | null = null;
  private readerRef: PlantsReader | null = null;
  private producerRef: PlantsProducer | null = null;

  // State (`07` § State, `schemas/system-state.md` `PlantsState`).
  readonly cropAtTile = new Map<TileIndex, EntityId>();
  readonly plotIndex: EntityId[] = [];
  readonly saplings = new Map<TileIndex, number>();
  readonly shrubTimers = new Map<TileIndex, number>();
  readonly bareSoil: TileIndex[] = [];
  readonly ashTiles = new Map<TileIndex, number>();
  readonly needsSeedsAnnounced = new Map<EntityId, number>();
  dailyDue = false;
  wired = false;
  /** Tiles a grazer cleared this tick, and tiles that became bare soil; worked off in 07's tick. */
  private readonly pendingGrazed: TileIndex[] = [];
  private readonly pendingBare: TileIndex[] = [];
  private readonly pendingPlotTiles: TileIndex[] = [];
  private treeDensity = 0;
  private treeWeights: (readonly [number, number])[] = [];
  private fungusByTier: (readonly [number, number])[][] = [];
  private caveLoam = -1;
  private soilClasses: string[] = [];

  constructor(options: PlantsOptions = { spec: { biome: '', traits: [] } }) {
    super();
    this.options = options;
  }

  get map(): Map3D {
    if (this.mapRef === null) throw new Error('07 plants: used before init');
    return this.mapRef;
  }

  get store(): EntityStore {
    if (this.storeRef === null) throw new Error('07 plants: used before init');
    return this.storeRef;
  }

  get facts(): PlantFacts {
    if (this.factsRef === null) throw new Error('07 plants: used before init');
    return this.factsRef;
  }

  get rng(): RngStream {
    if (this.rngRef === null) throw new Error('07 plants: used before init');
    return this.rngRef;
  }

  get readers(): InitContext['readers'] {
    if (this.readersRef === null) throw new Error('07 plants: used before init');
    return this.readersRef;
  }

  get producer(): PlantsProducer {
    if (this.producerRef === null) throw new Error('07 plants: used before init');
    return this.producerRef;
  }

  override init(ctx: InitContext): void {
    this.mapRef = ctx.world.map;
    this.storeRef = ctx.world.entities;
    this.rngRef = ctx.rng;
    this.readersRef = ctx.readers;
    this.factsRef = new PlantFacts(ctx.registry);
    this.loadBiome(ctx);
    this.producerRef = new PlantsProducer({
      facts: this.facts,
      map: this.map,
      readers: ctx.readers,
      rng: ctx.rng,
      cropAtTile: this.cropAtTile,
      plots: () => this.plotIndex,
      plantCrop: (c, tile, plant, zoneId) => this.plantCrop(c, tile, plant, zoneId),
      removeCrop: (id) => this.removeCrop(id),
      announceNeedsSeeds: (c, zoneId, plant) => this.announceNeedsSeeds(c, zoneId, plant),
    });
    this.readerRef = this.makeReader();
    // `07` § Registrations.
    ctx.register.jobProducer(this.producer);
    ctx.register.announcement('PlotNeedsSeeds', { severity: 'note', stringKey: 'announce.plot_needs_seeds' });
    ctx.register.inspector('tile', { id: 'plant', order: 40 });
    ctx.register.inspector('zone', { id: 'farm_plot', order: 20 });
  }

  /**
   * The biome's tree density and species weights (`07` § Trees, § Regrowth; the same tables and
   * the `glasslands` override stage 9 of local map generation uses).
   */
  private loadBiome(ctx: InitContext): void {
    const facts = this.facts;
    const materials = ctx.registry.table<{ id: string; class: string }>('materials');
    this.caveLoam = materials.has('cave_loam') ? materials.index('cave_loam') : -1;
    this.soilClasses = [];
    for (let m = 1; m <= materials.size; m += 1) this.soilClasses[m] = materials.byIndex(m)?.class ?? '';
    const spec = this.options.spec;
    const biome = ctx.registry.table<BiomeRow>('biomes').byId(spec.biome);
    this.treeDensity = spec.traits.includes('glasslands') ? GLASSLANDS_TREE_DENSITY : (biome?.treeDensity ?? 0);
    this.treeWeights = [];
    this.fungusByTier = [[], [], [], []];
    for (let p = 1; p <= facts.size; p += 1) {
      const row = facts.row(p) as PlantRow;
      if (row.kind === 'tree') {
        const w = row.biomes?.find((b) => b.biome === spec.biome)?.weight ?? 0;
        if (w > 0) this.treeWeights.push([p, w]);
      } else if (row.kind === 'fungus_tree') {
        for (const c of row.caverns ?? []) {
          if (c.weight > 0 && c.tier >= 1 && c.tier <= 3) (this.fungusByTier[c.tier] as (readonly [number, number])[]).push([p, c.weight]);
        }
      }
    }
  }

  private wildHost(ctx: TickContext): WildHost {
    const buildings = this.buildings();
    return {
      map: this.map,
      facts: this.facts,
      rng: this.rng,
      terrain: ctx.terrain,
      tick: ctx.tick,
      season: ctx.readers.calendar.season,
      classOf: (m) => this.soilClasses[m] ?? '',
      caveLoam: this.caveLoam,
      treeDensity: this.treeDensity,
      treeWeights: this.treeWeights,
      fungusWeights: (tier) => this.fungusByTier[tier] ?? [],
      // "Trees never spread onto farm plots, roads or constructed floors", and nothing grows under
      // a building.
      isReserved: (i) => this.map.buildingAtTile(i) !== 0 || (buildings !== null && this.plotIndex.includes(buildings.zoneAt(i))),
    };
  }

  // ---------- the hourly tick ----------

  override tick(ctx: TickContext): void {
    if (!this.wired) this.wire();
    this.applyPendingTiles(ctx);
    this.grow(ctx);
    this.validate(ctx);
    if (this.dailyDue) {
      this.dailyDue = false;
      this.daily(ctx);
    }
    this.producer.due = true;
  }

  /**
   * The tile writes the event handlers asked for, made in 07's own tick (D-089): grass cleared by
   * grazing and by a new farm plot, and the tiles that became bare soil.
   */
  private applyPendingTiles(ctx: TickContext): void {
    const map = this.map;
    for (const tile of this.pendingGrazed.splice(0)) {
      if (!map.validIndex(tile)) continue;
      if (map.hasFlag(tile, TileFlag.Grass)) ctx.terrain.setFlag(tile, TileFlag.Grass, false);
      this.addBare(tile);
    }
    for (const tile of this.pendingPlotTiles.splice(0)) {
      if (map.validIndex(tile) && map.hasFlag(tile, TileFlag.Grass)) ctx.terrain.setFlag(tile, TileFlag.Grass, false);
    }
    for (const tile of this.pendingBare.splice(0)) this.addBare(tile);
  }

  /** `07` § Grass: `bareSoil`, a sorted set of soil floors waiting for grass. */
  private addBare(tile: TileIndex): void {
    const map = this.map;
    if (!map.validIndex(tile) || map.kindAt(tile) !== TileKind.Floor || map.hasFlag(tile, TileFlag.Grass)) return;
    if (map.hasFlag(tile, TileFlag.Constructed)) return;
    const m = map.materialAt(tile);
    const outdoor = map.hasFlag(tile, TileFlag.Outdoor);
    if (outdoor ? this.soilClasses[m] !== 'soil' : m !== this.caveLoam) return;
    let lo = 0;
    let hi = this.bareSoil.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((this.bareSoil[mid] as number) < tile) lo = mid + 1;
      else hi = mid;
    }
    if (this.bareSoil[lo] === tile) return;
    this.bareSoil.splice(lo, 0, tile);
  }

  /** The lazy first-tick indexing of plots (D-082: a load repeats it). */
  private wire(): void {
    this.wired = true;
    const buildings = this.buildings();
    if (buildings === null) return;
    for (const id of buildings.zonesOfType(FARM_PLOT)) this.addPlot(id);
  }

  private buildings(): BuildingsReader | null {
    return this.readers.has('14') ? this.readers.of<BuildingsReader>('14') : null;
  }

  /** `environment.md` § Plant growth, the hourly loop over `crops (ascending id)`. */
  private grow(ctx: TickContext): void {
    const entities = ctx.world.entities;
    const crops = entities.with(C.Crop);
    if (crops.length === 0) return;
    const season = ctx.readers.calendar.season;
    const weather = ctx.readers.has('06') ? ctx.readers.of<WeatherReader>('06') : null;
    const materials = ctx.readers.has('05') ? ctx.readers.of<MaterialsReader>('05') : null;
    const modifier = weather?.growthModifier() ?? 100;
    const heatwave = weather?.state() === 'heatwave';
    const map = this.map;
    for (const id of crops) {
      const crop = entities.get(id, C.Crop);
      if (crop === undefined) continue;
      const row = this.facts.row(crop.plant);
      if (row === undefined) continue;
      const cave = this.facts.isCave(crop.plant);
      const tile = crop.tile;
      const tempC = materials?.temperatureAt(tile) ?? weather?.surfaceTempC() ?? 0;
      if (!seasonAllows(row, cave, season)) {
        // "Winter with `surfaceTempC < FROST_KILL_C` at the crop's tile kills surface crops";
        // outside its seasons an unfrozen surface crop is dormant, not dead.
        if (!cave && tempC < FROST_KILL_C) this.killCrop(ctx, id, 'frost');
        continue;
      }
      const gained = growthPerHour(row, cave, {
        season,
        lit: this.buildings()?.cropLitAt(tile) ?? map.hasFlag(tile, TileFlag.Lit),
        tempC,
        growthModifier: modifier,
      });
      let next = advance({ stage: crop.stage, growth: crop.growth }, gained, stageLength(row));
      // "each heatwave hour a surface crop at stage ≥ 1 loses one stage with `WILT_PERMILLE`".
      if (heatwave && !cave && next.stage >= 1 && this.rng.chance(WILT_PERMILLE)) {
        next = { stage: next.stage - 1, growth: next.growth };
      }
      if (next.stage !== crop.stage || next.growth !== crop.growth) {
        entities.add(id, C.Crop, { ...crop, stage: next.stage as Crop['stage'], growth: next.growth });
      }
    }
  }

  /** "A crop on a tile that stops qualifying (construction placed, tile dug, flooded to level ≥ 4) dies." */
  private validate(ctx: TickContext): void {
    if (this.cropAtTile.size === 0) return;
    const entities = ctx.world.entities;
    const buildings = this.buildings();
    for (const tile of Array.from(this.cropAtTile.keys()).sort((a, b) => a - b)) {
      const id = this.cropAtTile.get(tile) as EntityId;
      const crop = entities.get(id, C.Crop);
      if (crop === undefined) {
        this.cropAtTile.delete(tile);
        continue;
      }
      if (this.map.fluidLevelAt(tile) >= CROP_DROWN_LEVEL) {
        this.killCrop(ctx, id, 'flooded');
        continue;
      }
      if (buildings === null) continue;
      if (buildings.zoneAt(tile) !== crop.plotZoneId || !buildings.zoneTileQualifies(FARM_PLOT, tile)) {
        this.killCrop(ctx, id, 'tile');
      }
    }
  }

  /** `environment.md`: "daily: saplings …; regrowth tries; grass regrowth over `bareSoil`; shrub timers; ash expiry". */
  private daily(ctx: TickContext): void {
    const host = this.wildHost(ctx);
    for (const grown of growSaplings(host, this.saplings)) {
      ctx.emit({ type: 'SaplingGrew', tile: grown.tile, species: grown.species });
    }
    regrowthTries(host, this.saplings);
    const regrown = regrowGrass(host, this.bareSoil);
    if (regrown.length > 0) ctx.emit({ type: 'GrassRegrown', tiles: regrown.sort((a, b) => a - b) });
    // `07` § Shrubs: a regrowing shrub is mature again at its timer.
    for (const tile of Array.from(this.shrubTimers.keys()).sort((a, b) => a - b)) {
      if (this.map.kindAt(tile) !== TileKind.Shrub) {
        this.shrubTimers.delete(tile);
        continue;
      }
      if (ctx.tick < (this.shrubTimers.get(tile) as number)) continue;
      this.shrubTimers.delete(tile);
      ctx.emit({ type: 'ShrubRegrown', tile });
    }
    // `07` § Ash: "this system clears it after `ASH_DURATION_DAYS`".
    for (const tile of Array.from(this.ashTiles.keys()).sort((a, b) => a - b)) {
      if (!this.map.hasFlag(tile, TileFlag.Ash)) {
        this.ashTiles.delete(tile);
        continue;
      }
      if (ctx.tick < (this.ashTiles.get(tile) as number)) continue;
      this.ashTiles.delete(tile);
      ctx.terrain.setFlag(tile, TileFlag.Ash, false);
      this.addBare(tile);
    }
  }

  // ---------- crops ----------

  /** `plant` completion: the `Crop` entity at stage 0, and `CropPlanted`. */
  plantCrop(ctx: TickContext, tile: TileIndex, plant: number, zoneId: EntityId): EntityId {
    const id = ctx.world.entities.create('crop');
    ctx.world.entities.add(id, C.Crop, { plotZoneId: zoneId, plant, stage: 0, growth: 0, tile });
    this.cropAtTile.set(tile, id);
    ctx.emit({ type: 'CropPlanted', tile, species: this.facts.row(plant)?.id ?? '' });
    return id;
  }

  /** Destroy a crop entity and drop it from the index; no event (the caller emits). */
  removeCrop(id: EntityId): void {
    const store = this.store;
    const crop = store.get(id, C.Crop);
    if (crop !== undefined && this.cropAtTile.get(crop.tile) === id) this.cropAtTile.delete(crop.tile);
    store.destroy(id);
    this.producer.due = true;
  }

  killCrop(ctx: TickContext, id: EntityId, reason: CropDeathReason): void {
    const crop = ctx.world.entities.get(id, C.Crop);
    if (crop === undefined) return;
    const tile = crop.tile;
    this.removeCrop(id);
    if (this.map.designationAt(tile) === Designation.Harvest) ctx.terrain.setDesignation(tile, Designation.None, 0);
    ctx.emit({ type: 'CropDied', tile, species: this.facts.row(crop.plant)?.id ?? '', reason });
  }

  /** "the plot is marked `needsSeeds` once per season with a note". */
  announceNeedsSeeds(ctx: TickContext, zoneId: EntityId, plant: number): void {
    const season = ctx.readers.calendar.season;
    if (this.needsSeedsAnnounced.get(zoneId) === season) return;
    this.needsSeedsAnnounced.set(zoneId, season);
    ctx.emit({ type: 'PlotNeedsSeeds', zoneId, species: this.facts.row(plant)?.id ?? '' });
  }

  // ---------- plots ----------

  private addPlot(id: EntityId): void {
    if (this.plotIndex.includes(id)) return;
    this.plotIndex.push(id);
    this.plotIndex.sort((a, b) => a - b);
  }

  private removePlot(id: EntityId): void {
    const at = this.plotIndex.indexOf(id);
    if (at >= 0) this.plotIndex.splice(at, 1);
    this.needsSeedsAnnounced.delete(id);
  }

  plotKind(zoneId: EntityId): PlotKind | 'none' {
    const zone = this.buildings()?.zone(zoneId);
    if (zone === undefined || zone.type !== FARM_PLOT) return 'none';
    return plotKindOf(this.map, zone.tiles, (tile) => this.buildings()?.cropLitAt(tile) ?? this.map.hasFlag(tile, TileFlag.Lit));
  }

  // ---------- events ----------

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'DayPassed') {
      this.dailyDue = true;
      return;
    }
    if (event.type === 'GrassGrazed') {
      // 08 clears no tile itself: 07 owns grass and clears the flag in its own tick (D-089).
      this.pendingGrazed.push(event['tile'] as TileIndex);
      return;
    }
    if (event.type === 'TilesChanged') {
      // "`bareSoil` … maintained from grazing events and construction removal".
      for (const tile of (event['tiles'] as readonly TileIndex[]) ?? []) this.pendingBare.push(tile);
      return;
    }
    if (event.type === 'FireOut') {
      // 05 leaves `ash` on a burnt-out tile; 07 clears it after `ASH_DURATION_DAYS`.
      const until = ctx.tick + ASH_DURATION_DAYS * TICKS_PER_DAY;
      for (const tile of (event['tiles'] as readonly TileIndex[]) ?? []) {
        if (this.map.validIndex(tile) && this.map.hasFlag(tile, TileFlag.Ash)) this.ashTiles.set(tile, until);
      }
      return;
    }
    if (event.type === 'JobCompleted') {
      // `07` § Shrubs: a gathered shrub "enters `regrowing` for `regrowDays`".
      if (event['jobType'] !== 'gather') return;
      const tile = event['target'] as TileIndex;
      if (!this.map.validIndex(tile) || this.map.kindAt(tile) !== TileKind.Shrub) return;
      const row = this.facts.row(this.facts.plantOfMaterial(this.map.materialAt(tile)));
      if (row?.regrowDays === undefined) return;
      this.shrubTimers.set(tile, ctx.tick + row.regrowDays * TICKS_PER_DAY);
      return;
    }
    if (event.type === 'SeasonEffectsChanged') {
      // A new season means new crop choices and a fresh `needsSeeds` note per plot.
      this.needsSeedsAnnounced.clear();
      this.producer.due = true;
      return;
    }
    if (event.type !== 'ZoneChanged' || event['zoneType'] !== FARM_PLOT) return;
    const zoneId = event['zoneId'] as EntityId;
    const change = event['change'] as string;
    const tiles = (event['tiles'] as readonly TileIndex[]) ?? [];
    if (change === 'removed') {
      // "Removing the zone kills its crops and returns nothing."
      this.removePlot(zoneId);
      for (const tile of tiles) {
        const id = this.cropAtTile.get(tile);
        if (id !== undefined) this.killCrop(ctx, id, 'zone_removed');
        this.pendingBare.push(tile);
      }
      return;
    }
    this.addPlot(zoneId);
    // "Constructions, roads and farm plots clear `grass` permanently while they exist."
    for (const tile of tiles) this.pendingPlotTiles.push(tile);
    this.producer.due = true;
  }

  // ---------- commands ----------

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    if (cmd.type === 'SetPlotCrop') return this.setPlotCrop(cmd, ctx);
    if (cmd.type === 'DesignateHarvest') return this.designateHarvest(cmd, ctx);
    return reject('not_found');
  }

  /** `SetPlotCrop { zoneId, season, speciesId | 0 }`: "zone is a farm plot; species light matches the plot kind". */
  private setPlotCrop(cmd: Command, ctx: TickContext): CommandResult {
    const zoneId = cmd['zoneId'];
    const season = cmd['season'];
    if (typeof zoneId !== 'number' || typeof season !== 'number') return reject('not_found');
    if (!Number.isInteger(season) || season < 0 || season >= SEASONS_PER_YEAR) return reject('out_of_range');
    const entities = ctx.world.entities;
    const zone = entities.get(zoneId, C.Zone);
    const view = this.buildings()?.zone(zoneId);
    if (zone === undefined || view === undefined || view.type !== FARM_PLOT) return reject('not_found');
    const raw = cmd['speciesId'];
    let plant = 0;
    if (typeof raw === 'string') {
      plant = this.facts.indexOf(raw);
      if (plant === 0) return reject('not_found');
    } else if (typeof raw === 'number') {
      plant = raw;
    }
    if (plant !== 0) {
      const row = this.facts.row(plant);
      if (row === undefined || !this.facts.isFarmed(plant)) return reject('not_found');
      if (!lightMatches(row, plotKindOf(this.map, view.tiles,
        (tile) => this.buildings()?.cropLitAt(tile) ?? this.map.hasFlag(tile, TileFlag.Lit)))) return reject('light_mismatch');
    }
    entities.add(zoneId, C.Zone, { ...zone, settings: withCrop(zone.settings, season, plant) });
    this.addPlot(zoneId);
    this.needsSeedsAnnounced.delete(zoneId);
    this.producer.due = true;
    return OK;
  }

  /** `DesignateHarvest { tiles }`: "crops at stage 3". */
  private designateHarvest(cmd: Command, ctx: TickContext): CommandResult {
    const tiles = cmd['tiles'];
    if (!Array.isArray(tiles) || tiles.length === 0) return reject('out_of_bounds');
    const wanted: TileIndex[] = [];
    for (const t of tiles as unknown[]) {
      if (typeof t !== 'number' || !Number.isInteger(t) || !this.map.validIndex(t)) return reject('out_of_bounds');
      wanted.push(t);
    }
    let marked = 0;
    for (const tile of wanted) {
      const id = this.cropAtTile.get(tile);
      if (id === undefined) continue;
      const crop = ctx.world.entities.get(id, C.Crop);
      const row = crop === undefined ? undefined : this.facts.row(crop.plant);
      if (crop === undefined || row === undefined) continue;
      if (!isMature({ stage: crop.stage, growth: crop.growth }, stageLength(row))) continue;
      ctx.terrain.setDesignation(tile, Designation.Harvest, HARVEST_PRIORITY);
      marked += 1;
    }
    if (marked === 0) return reject('precondition_failed');
    this.producer.due = true;
    return OK;
  }

  // ---------- the reader ----------

  private makeReader(): PlantsReader {
    const map = this.map;
    const facts = this.facts;
    return {
      cropAt: (i) => this.cropAtTile.get(i) ?? 0,
      cropInfo: (id) => {
        const crop = this.store.get(id, C.Crop);
        return crop === undefined ? undefined : this.cropInfoOf(crop);
      },
      crops: () => Array.from(this.cropAtTile.values()).sort((a, b) => a - b),
      cropReady: (i) => {
        const id = this.cropAtTile.get(i);
        const crop = id === undefined ? undefined : this.store.get(id, C.Crop);
        const row = crop === undefined ? undefined : facts.row(crop.plant);
        return crop !== undefined && row !== undefined && isMature({ stage: crop.stage, growth: crop.growth }, stageLength(row));
      },
      plotAt: (i) => {
        const zone = this.buildings()?.zoneAt(i) ?? 0;
        return zone !== 0 && this.plotIndex.includes(zone) ? zone : 0;
      },
      plotSettings: (zoneId) => cropsOf(this.buildings()?.zone(zoneId)?.settings ?? {}),
      plotKind: (zoneId) => this.plotKind(zoneId),
      plots: () => this.plotIndex.slice(),
      speciesAt: (i) => {
        if (!map.validIndex(i)) return '';
        const k = map.kindAt(i);
        if (k !== TileKind.Tree && k !== TileKind.Sapling && k !== TileKind.Shrub) return '';
        return facts.row(facts.plantOfMaterial(map.materialAt(i)))?.id ?? '';
      },
      shrubReady: (i) => map.validIndex(i) && map.kindAt(i) === TileKind.Shrub && !this.shrubTimers.has(i),
      hasGrass: (i) => map.validIndex(i) && map.hasFlag(i, TileFlag.Grass),
      grassIsDry: () => this.options.spec.biome === 'cold_steppe' || this.options.spec.biome === 'tundra' || this.options.spec.biome === 'savanna',
      def: (speciesId) => (typeof speciesId === 'number' ? facts.row(speciesId) : facts.row(facts.indexOf(speciesId))),
      bareSoil: () => this.bareSoil.slice(),
      ashTiles: () => Array.from(this.ashTiles.keys()).sort((a, b) => a - b),
      saplings: () => Array.from(this.saplings.keys()).sort((a, b) => a - b),
    };
  }

  private cropInfoOf(crop: Crop): CropInfo {
    const row = this.facts.row(crop.plant) as PlantRow | undefined;
    return {
      species: row?.id ?? '',
      plant: crop.plant,
      stage: crop.stage,
      percent: row === undefined ? 0 : progressPercent({ stage: crop.stage, growth: crop.growth }, stageLength(row)),
      tile: crop.tile,
      plotZoneId: crop.plotZoneId,
    };
  }

  override reader(): PlantsReader {
    if (this.readerRef === null) throw new Error('07 plants: reader before init');
    return this.readerRef;
  }

  serialize(): PlantsStateV1 {
    return {
      stateVersion: 1,
      cropAtTile: Array.from(this.cropAtTile.keys())
        .sort((a, b) => a - b)
        .map((t): [TileIndex, EntityId] => [t, this.cropAtTile.get(t) as EntityId]),
      plotIndex: this.plotIndex.slice(),
      saplings: Array.from(this.saplings.keys())
        .sort((a, b) => a - b)
        .map((t): [TileIndex, number] => [t, this.saplings.get(t) as number]),
      shrubTimers: Array.from(this.shrubTimers.keys())
        .sort((a, b) => a - b)
        .map((t): [TileIndex, number] => [t, this.shrubTimers.get(t) as number]),
      bareSoil: this.bareSoil.slice(),
      ashTiles: Array.from(this.ashTiles.keys())
        .sort((a, b) => a - b)
        .map((t): [TileIndex, number] => [t, this.ashTiles.get(t) as number]),
      needsSeedsAnnounced: Array.from(this.needsSeedsAnnounced.keys())
        .sort((a, b) => a - b)
        .map((z): [EntityId, number] => [z, this.needsSeedsAnnounced.get(z) as number]),
      rng: this.rng.state(),
      dailyDue: this.dailyDue,
      wired: this.wired,
      pendingGrazed: this.pendingGrazed.slice(),
      pendingBare: this.pendingBare.slice(),
      pendingPlotTiles: this.pendingPlotTiles.slice(),
      producerDue: this.producer.due,
    };
  }

  deserialize(state: PlantsStateV1, ctx: InitContext): void {
    if (this.mapRef === null) this.init(ctx);
    this.cropAtTile.clear();
    for (const [t, id] of state.cropAtTile) this.cropAtTile.set(t, id);
    this.plotIndex.length = 0;
    this.plotIndex.push(...state.plotIndex);
    this.saplings.clear();
    for (const [t, at] of state.saplings) this.saplings.set(t, at);
    this.shrubTimers.clear();
    for (const [t, at] of state.shrubTimers) this.shrubTimers.set(t, at);
    this.bareSoil.length = 0;
    this.bareSoil.push(...state.bareSoil);
    this.ashTiles.clear();
    for (const [t, at] of state.ashTiles) this.ashTiles.set(t, at);
    this.needsSeedsAnnounced.clear();
    for (const [z, s] of state.needsSeedsAnnounced) this.needsSeedsAnnounced.set(z, s);
    this.rng.setState(state.rng);
    this.dailyDue = state.dailyDue;
    this.wired = state.wired;
    this.pendingGrazed.length = 0;
    this.pendingGrazed.push(...(state.pendingGrazed ?? []));
    this.pendingBare.length = 0;
    this.pendingBare.push(...(state.pendingBare ?? []));
    this.pendingPlotTiles.length = 0;
    this.pendingPlotTiles.push(...(state.pendingPlotTiles ?? []));
    this.producer.due = state.producerDue !== false;
  }
}
