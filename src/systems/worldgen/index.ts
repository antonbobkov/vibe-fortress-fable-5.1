/**
 * 01 World generation. `02-systems/01-world-generation.md`; `algorithms/world-generation.md`.
 *
 * `generate(seed, size, registry, onProgress)` runs the fixed stage sequence, each stage with its
 * own rng stream, and returns the immutable `WorldMap`. It is invoked by the app, runs once per
 * game and is not part of the tick loop, so 01 is not a `GameSystem`.
 */

import { hash64 } from '@core/noise';
import type { Registry } from '@core/registry';
import { freezeWorld, newGenRegion, type GenWorld, type WorldMap } from './state';
import { continentalMask, stageElevation, type ContinentalMask } from './stages/elevation';
import { stageClimate } from './stages/climate';
import { stageBiomes } from './stages/biomes';
import { stageRivers } from './stages/rivers';
import { stageGeology } from './stages/geology';
import { stageCivilizations } from './stages/civilizations';
import { stageRatings } from './stages/ratings';
import { stageTraits } from './stages/traits';
import { stageNames } from './stages/names';

export type {
  GenRegion,
  GenWorld,
  Geology,
  RegionRecord,
  RegionRiver,
  RiverClass,
  RiverRecord,
  WorldMap,
  WorldgenState,
} from './state';
export { CIVS, EDGES } from './state';
export { matchesFilter, worldReader, type RegionFilter, type WorldgenReader } from './reader';

/** The stage names, in order (`01` § Stage order and rng streams). */
export const WORLDGEN_STAGES = [
  'elevation',
  'climate',
  'biomes',
  'rivers',
  'geology',
  'civilizations',
  'ratings',
  'traits',
  'names',
] as const;

export type WorldgenStage = (typeof WORLDGEN_STAGES)[number];

/** "Each stage reports progress to the app so the world generation screen can draw the map." */
export type WorldgenProgress = (stage: WorldgenStage, pct: number, partial: GenWorld) => void;

export interface GenerateOptions {
  readonly onProgress?: WorldgenProgress;
  /** Replaces the continental mask (tests rig it; "the continental mask is one function"). */
  readonly mask?: ContinentalMask;
}

/** A fresh working set: every region ocean-default, `S = hash64(seed)`. */
export function newGenWorld(seed: string, size: number): GenWorld {
  const regions = new Array(size * size);
  for (let id = 0; id < size * size; id += 1) regions[id] = newGenRegion(id, size);
  return {
    seed,
    s: hash64(seed),
    size,
    regions,
    rivers: [],
    civHomes: { mountainhome: 0, gloam: 0, hillfolk: 0, wildwood: 0 },
    elevationAttempts: 0,
  };
}

/** Stages 1-5 on a working set. */
export function runPhysicalStages(g: GenWorld, registry: Registry, options: GenerateOptions = {}): void {
  const progress = options.onProgress ?? ((): void => {});
  stageElevation(g, options.mask ?? continentalMask);
  progress('elevation', 100, g);
  stageClimate(g);
  progress('climate', 100, g);
  stageBiomes(g, registry);
  progress('biomes', 100, g);
  stageRivers(g);
  progress('rivers', 100, g);
  stageGeology(g);
  progress('geology', 100, g);
}

/** Stages 6-9 on a working set whose physical stages have run. */
export function runPoliticalStages(g: GenWorld, registry: Registry, options: GenerateOptions = {}): void {
  const progress = options.onProgress ?? ((): void => {});
  stageCivilizations(g);
  progress('civilizations', 100, g);
  stageRatings(g, registry);
  progress('ratings', 100, g);
  stageTraits(g, registry);
  progress('traits', 100, g);
  stageNames(g, registry);
  progress('names', 100, g);
}

/** `worldgen.generate(seed, size, onProgress): WorldMap`: all nine stages, then frozen. */
export function generate(seed: string, size: number, registry: Registry, options: GenerateOptions = {}): WorldMap {
  const g = newGenWorld(seed, size);
  runPhysicalStages(g, registry, options);
  runPoliticalStages(g, registry, options);
  return freezeWorld(g);
}

/** `WorldGenerated { seed, size }`, dispatched by the app's flow once `generate` returns. */
export function worldGeneratedEvent(world: WorldMap): { type: 'WorldGenerated'; seed: string; size: number } {
  return { type: 'WorldGenerated', seed: world.seed, size: world.size };
}
