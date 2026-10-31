/**
 * Shared state of local map generation (`02-systems/03-terrain-and-mining.md` § Local map
 * generation; `algorithms/local-map-generation.md`).
 */

import { hash } from '@core/noise';
import type { Map3D } from '@core/map3d';
import type { Registry } from '@core/registry';
import { RngStream } from '@core/rng';
import type { TileIndex } from '@core/types';
import type { LocalMapSpec } from '@systems/embark';

/** One layer of the rolled rock stack. */
export interface StackLayer {
  readonly material: string;
  readonly thickness: number;
}

/** Column flags of the working set. */
export const COL_RIVER = 1;
export const COL_LAKE = 2;
export const COL_SOURCE = 4;
export const COL_SINK = 8;

/**
 * Something generation owes the world once entities exist (`algorithms/local-map-generation.md`
 * step 8: "recorded as a spawn list applied by 02 arrival").
 */
export interface SpawnEntry {
  readonly kind: 'item' | 'creature';
  /** Item type id or species id. */
  readonly type: string;
  readonly material?: string;
  readonly quality?: number;
  readonly tile: TileIndex;
  readonly asleep?: boolean;
  /** The trait that asked for it. */
  readonly source: string;
}

/** Veins and clusters of one mineral: the expected count (`Fixed`) and how many were placed. */
export interface VeinRecord {
  readonly mineral: string;
  readonly expected: number;
  placed: number;
}

/** Everything the stages share. The map is written in place; per-column arrays are `y × w + x`. */
export interface LocalGen {
  readonly spec: LocalMapSpec;
  readonly map: Map3D;
  readonly registry: Registry;
  /** `S = hash64(spec.seed)`. */
  readonly s: string;
  readonly w: number;
  readonly h: number;
  readonly d: number;
  /** Surface z per column, after carving (the bed in wet columns). */
  readonly heights: Int16Array;
  /** Wet columns: the water fills `heights … waterTop − 1`; 0 where dry. */
  readonly waterTop: Int16Array;
  /** `COL_*` bits. */
  readonly colFlags: Uint8Array;
  /** The rolled rock stack, top first (saved in `TerrainState.layerStack`). */
  stack: StackLayer[];
  /** Filled by the water pass, ascending. */
  readonly waterSources: TileIndex[];
  readonly sinks: TileIndex[];
  /** Cavern floor tiles per tier (index 1-3), ascending. */
  readonly cavernFloors: TileIndex[][];
  /** Open fraction of each cavern band's interior right after thresholding, `Fixed` (index 1-3). */
  readonly cavernOpen: number[];
  /** Columns that grow no vegetation (volcano obsidian). */
  readonly bare: Uint8Array;
  /** Columns of a drinking step (stage 2), whose every rise becomes a ramp (stage 9). */
  readonly drinkStep: Uint8Array;
  /** Columns of bare rock with no soil (outcrops and crags, stage 1). */
  readonly rocky: Uint8Array;
  /** Columns of scree around a crag, where boulders lie thick (stage 9). */
  readonly scree: Uint8Array;
  readonly veins: VeinRecord[];
  readonly spawns: SpawnEntry[];
  readonly warmSprings: TileIndex[];
  /** Centre column of the volcano pipe, or -1. */
  volcano: number;
}

/** `stream(S, 'terrain.<stage>')`: each stage's own stream. */
export function stageStream(s: string, name: string): RngStream {
  return new RngStream(hash(s, name));
}

export function clamp(lo: number, hi: number, v: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function materialIndex(g: LocalGen, id: string): number {
  return g.registry.table('materials').index(id);
}

export function hasTrait(g: LocalGen, trait: string): boolean {
  return g.spec.traits.includes(trait);
}
