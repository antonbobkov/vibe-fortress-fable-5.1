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
import type { LocalGen, StackLayer } from './common';
import { stageHeight } from './height';
import { fillWater, stageRivers } from './rivers';
import { stageColumns } from './layers';
import { stageSea } from './sea';

export type { StackLayer } from './common';

export type LocalStage = 'height' | 'rivers' | 'layers' | 'sea';

export type LocalProgress = (stage: LocalStage) => void;

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
  progress: LocalProgress = () => {},
): LocalMapResult {
  const g = newLocalGen(spec, map, registry);
  map.kind.fill(0);
  map.material.fill(0);
  map.fluid.fill(0);
  map.flags.fill(0);
  stageHeight(g);
  progress('height');
  stageRivers(g);
  progress('rivers');
  stageColumns(g);
  fillWater(g);
  progress('layers');
  stageSea(g);
  progress('sea');
  dirtyAll(map);
  return {
    spec,
    layerStack: g.stack,
    surface: g.heights,
    columns: g.colFlags,
    waterSources: g.waterSources,
    sinks: g.sinks,
  };
}

/** A fresh standard-size map generated from a spec. */
export function generateLocalMap(spec: LocalMapSpec, registry: Registry): { map: Map3D; result: LocalMapResult } {
  const map = new Map3D();
  return { map, result: generateLocal(spec, map, registry) };
}
