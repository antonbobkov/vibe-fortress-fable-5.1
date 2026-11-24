/**
 * Local map generation: `02-systems/03-terrain-and-mining.md` § Local map generation;
 * `algorithms/local-map-generation.md`.
 *
 * `generateLocal(spec, map, registry, progress)` fills a `Map3D` from a `LocalMapSpec` and nothing
 * else, "so a region always generates the same local map". Each stage has its own stream
 * (`terrain.<stage>`) derived from `S = hash64(spec.seed)`.
 */

import { hash64 } from '@core/noise';
import { Map3D } from '@core/map3d';
import type { Registry } from '@core/registry';
import type { TileIndex } from '@core/types';
import type { LocalMapSpec } from '@systems/embark';
import type { LocalGen, SpawnEntry, StackLayer, VeinRecord } from './common';
import { stageHeight } from './height';
import { fillWater, stageRivers } from './rivers';
import { stageColumns } from './layers';
import { stageSea } from './sea';
import { stageCaverns, stageRoosts } from './caverns';
import { stageMinerals } from './minerals';
import { stageVolcano } from './volcano';
import { stageConversions, stageRarePatches, stageVegetation } from './vegetation';
import { stageBoulders, stageRamps, stageSnow } from './surface';
import { stageBattlefieldChannel, stageTraits } from './traits';
import { stageLight } from './light';
import { stageStarfall } from './starfall';
import { stageBoneyards } from './boneyards';
import { stageRuins } from './ruins';
import type { RuinRecord } from '@systems/worldgen';

export type { SpawnEntry, StackLayer, VeinRecord } from './common';

/** The stages in order (`03` § Local map generation 1-11; 12, connectivity, is the pathing core's). */
export const LOCAL_STAGES = [
  'height',
  'rivers',
  'layers',
  'sea',
  'caverns',
  'minerals',
  'volcano',
  'vegetation',
  'traits',
  'light',
] as const;

export type LocalStage = (typeof LOCAL_STAGES)[number];

export type LocalProgress = (stage: LocalStage) => void;

export interface LocalOptions {
  readonly progress?: LocalProgress;
  /** Stop after this stage (tests of the earlier stages). */
  readonly until?: LocalStage;
  /** Stage 10b: the site's ruins, in the order the fortresses ended (02 § Ruins); absent: none. */
  readonly ruins?: readonly RuinRecord[];
}

/** What generation leaves besides the map: the saved layer stack and the fluid lists for 04. */
export interface LocalMapResult {
  readonly spec: LocalMapSpec;
  readonly layerStack: readonly StackLayer[];
  /** Surface z per column (`y × w + x`), the bed in river and lake columns. */
  readonly surface: Int16Array;
  /** Column flags (`COL_RIVER`, `COL_LAKE`, `COL_SOURCE`, `COL_SINK`). */
  readonly columns: Uint8Array;
  readonly waterSources: readonly TileIndex[];
  readonly sinks: readonly TileIndex[];
  /** Open fraction of each cavern band's interior (`Fixed`, index 1-3). */
  readonly cavernOpen: readonly number[];
  readonly cavernFloors: readonly (readonly TileIndex[])[];
  readonly veins: readonly VeinRecord[];
  /** Items and creatures owed to the world (arrival applies them once entities exist). */
  readonly spawns: readonly SpawnEntry[];
  /** `gemsprings` warm spring tiles, for 05. */
  readonly warmSprings: readonly TileIndex[];
  /** `starfall` crater tiles, ascending, for 03's state (`craterTiles`); empty on any other map. */
  readonly craterTiles: readonly TileIndex[];
  /** Stage 9b: each boneyard's skull tiles, ascending, for 03's state (`giantSkulls`); empty on any other map. */
  readonly giantSkulls: readonly (readonly TileIndex[])[];
  /** Stage 9b: each boneyard's cage tiles, ascending, for 03's state (`boneyards`); empty on any other map. */
  readonly boneyards: readonly (readonly TileIndex[])[];
  /** After stage 6, on its own stream: the bat roosts' drop tiles, ascending, for 08's state (`roosts`). */
  readonly roosts: readonly TileIndex[];
  /** Centre column of the volcano pipe, or -1. */
  readonly volcano: number;
}

export function newLocalGen(spec: LocalMapSpec, map: Map3D, registry: Registry): LocalGen {
  return {
    spec,
    map,
    registry,
    s: hash64(spec.seed),
    w: map.w,
    h: map.h,
    d: map.d,
    heights: new Int16Array(map.w * map.h),
    waterTop: new Int16Array(map.w * map.h),
    colFlags: new Uint8Array(map.w * map.h),
    stack: [],
    waterSources: [],
    sinks: [],
    cavernFloors: [[], [], [], []],
    cavernOpen: [0, 0, 0, 0],
    bare: new Uint8Array(map.w * map.h),
    rocky: new Uint8Array(map.w * map.h),
    scree: new Uint8Array(map.w * map.h),
    veins: [],
    spawns: [],
    warmSprings: [],
    craterTiles: [],
    giantSkulls: [],
    boneyards: [],
    roosts: [],
    volcano: -1,
  };
}

/** Mark every chunk for its first render and pathing pass (the grids were written directly). */
function dirtyAll(map: Map3D): void {
  for (let c = 0; c < map.chunkCount; c += 1) {
    const rec = map.chunk(c);
    if (rec === undefined) continue;
    rec.dirtyRender = true;
    rec.dirtyPath = true;
  }
}

/** Run the stages in order into `map` (a fresh map is all `open`). */
export function generateLocal(
  spec: LocalMapSpec,
  map: Map3D,
  registry: Registry,
  options: LocalOptions = {},
): LocalMapResult {
  const g = newLocalGen(spec, map, registry);
  map.kind.fill(0);
  map.material.fill(0);
  map.fluid.fill(0);
  map.flags.fill(0);
  const run: Record<LocalStage, () => void> = {
    height: () => stageHeight(g),
    rivers: () => stageRivers(g),
    layers: () => {
      stageColumns(g);
      fillWater(g);
    },
    sea: () => stageSea(g),
    caverns: () => {
      stageCaverns(g);
      // 03 � Local map generation, after stage 6: the bat roosts, on their own stream.
      stageRoosts(g);
    },
    minerals: () => stageMinerals(g),
    volcano: () => stageVolcano(g),
    vegetation: () => {
      stageRamps(g);
      stageBoulders(g);
      stageVegetation(g);
      stageRarePatches(g);
      stageSnow(g);
      // 03 § Local map generation, stage 9b: the boneyards, on their own stream.
      stageBoneyards(g);
    },
    traits: () => {
      stageTraits(g);
      stageBattlefieldChannel(g);
      // 03 § Local map generation, stage 10: the conversions, so no other trait feature reads them.
      stageConversions(g);
      // The crater last: every other stream of the map draws on the ground as it was.
      stageStarfall(g);
    },
    light: () => {
      // Stage 10b: an ended fortress's ruins, drawing nothing, so a site without any is unchanged.
      if (options.ruins !== undefined && options.ruins.length > 0) stageRuins(map, options.ruins, registry, g.spawns);
      stageLight(map);
    },
  };
  for (const stage of LOCAL_STAGES) {
    run[stage]();
    options.progress?.(stage);
    if (stage === options.until) break;
  }
  dirtyAll(map);
  return {
    spec,
    layerStack: g.stack,
    surface: g.heights,
    columns: g.colFlags,
    waterSources: g.waterSources,
    sinks: g.sinks,
    cavernOpen: g.cavernOpen,
    cavernFloors: g.cavernFloors,
    veins: g.veins,
    spawns: g.spawns,
    warmSprings: g.warmSprings,
    craterTiles: g.craterTiles,
    giantSkulls: g.giantSkulls,
    boneyards: g.boneyards,
    roosts: g.roosts,
    volcano: g.volcano,
  };
}

/** A fresh standard-size map generated from a spec. */
export function generateLocalMap(
  spec: LocalMapSpec,
  registry: Registry,
  options: LocalOptions = {},
): { map: Map3D; result: LocalMapResult } {
  const map = new Map3D();
  return { map, result: generateLocal(spec, map, registry, options) };
}
