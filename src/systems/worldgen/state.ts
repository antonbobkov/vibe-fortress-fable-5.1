/**
 * 01 World generation state.
 *
 * Transcribes `04-implementation/schemas/system-state.md` (`WorldgenState`, `WorldMap`,
 * `RegionRecord`) and `02-systems/01-world-generation.md` § Region record, § State. The
 * `WorldMap` is immutable after generation and saved with the game.
 */

import type { Civ, Edge } from '@core/types';

export type RiverClass = 'brook' | 'river' | 'major';

export type Geology = 'sedimentary' | 'igneous' | 'metamorphic' | 'mixed';

export interface RegionRiver {
  readonly inflow: readonly Edge[];
  readonly outflow: Edge | null;
  readonly class: RiverClass;
}

export interface RegionRecord {
  readonly id: number;
  readonly elevation: number;
  readonly tempC: number;
  readonly rain: number;
  readonly biome: string;
  readonly geology: Geology;
  readonly volcano: boolean;
  readonly river: RegionRiver | null;
  readonly lake: boolean;
  readonly deepness: number;
  readonly wealth: number;
  readonly peril: number;
  readonly temper: number;
  readonly traits: readonly string[];
  readonly civDistance: Readonly<Record<Civ, number>>;
  readonly nearestEdgeTo: Readonly<Record<Civ, Edge>>;
  readonly name: string;
}

export interface RiverRecord {
  readonly id: number;
  readonly regions: readonly number[];
  readonly class: RiverClass;
}

export interface WorldMap {
  readonly size: number;
  readonly seed: string;
  readonly regions: readonly RegionRecord[];
  readonly civHomes: Readonly<Record<Civ, number>>;
  readonly rivers: readonly RiverRecord[];
  /**
   * The ruins an ended fortress left on its site (`02` § Ruins, T-686), in the order the fortresses
   * ended. Absent on a newly generated world, which is otherwise immutable.
   */
  readonly ruins?: readonly RuinRecord[];
}

/** An item an ended fortress left on its site, weathered (`02` § Ruins). */
export interface RuinItem {
  readonly tile: number;
  /** Item type and material ids. */
  readonly type: string;
  readonly material: string;
  readonly count: number;
  readonly quality: number;
}

/**
 * What an ended fortress left on its site (`02` § Ruins): the tiles it changed from the site as
 * generated, packed (`tiles`, base64; `03` § Local map generation stage 10b), with their materials
 * by a palette of ids, and the items it left.
 */
export interface RuinRecord {
  readonly fortress: string;
  readonly regionId: number;
  readonly endedTick: number;
  readonly tileCount: number;
  readonly materials: readonly string[];
  readonly tiles: string;
  readonly items: readonly RuinItem[];
  /** The furniture still standing (T-690); absent in a ruin told before it: none. */
  readonly buildings?: readonly RuinBuilding[];
  /** The workshops, hearth, depots and wells left as wrecks (T-692); absent in a ruin told before it: none. */
  readonly wrecks?: readonly RuinWreck[];
}

/**
 * A building an ended fortress left as a wreck on its site (`02` § Ruins, T-692): the building type
 * at its origin tile and orientation, its material id, and the inputs it still holds, by item type
 * and material ids in the order they were consumed.
 */
export interface RuinWreck {
  readonly tile: number;
  /** Building type id. */
  readonly type: string;
  readonly orientation: number;
  readonly material: string;
  readonly inputs: readonly { readonly type: string; readonly material: string; readonly count: number }[];
}

/**
 * A piece of furniture an ended fortress left standing on its site (`02` § Ruins, T-690): the
 * building type at its origin tile and orientation, and its linked item, weathered.
 */
export interface RuinBuilding {
  readonly tile: number;
  /** Building type id. */
  readonly type: string;
  readonly orientation: number;
  /** The linked item's type and material ids, and its quality. */
  readonly item: string;
  readonly material: string;
  readonly quality: number;
}

export interface WorldgenState {
  readonly stateVersion: 1;
  readonly world: WorldMap;
}

/** The civilizations in placement order (`01` § Civilizations, steps 1-4). */
export const CIVS: readonly Civ[] = ['mountainhome', 'gloam', 'hillfolk', 'wildwood'];

/** The four edges, `n, e, s, w` (`01` § Region record). */
export const EDGES: readonly Edge[] = ['n', 'e', 's', 'w'];

/** A region while it is being generated: every field writable. */
export interface GenRegion {
  id: number;
  x: number;
  y: number;
  elevation: number;
  tempC: number;
  rain: number;
  biome: string;
  geology: Geology;
  volcano: boolean;
  river: { inflow: Edge[]; outflow: Edge | null; class: RiverClass | null } | null;
  lake: boolean;
  deepness: number;
  wealth: number;
  peril: number;
  temper: number;
  traits: string[];
  civDistance: Record<Civ, number>;
  nearestEdgeTo: Record<Civ, Edge>;
  name: string;
}

/** The working set every stage reads and writes. */
export interface GenWorld {
  readonly seed: string;
  /** `S = hash64(seed)` of `algorithms/world-generation.md`. */
  readonly s: string;
  readonly size: number;
  readonly regions: GenRegion[];
  readonly rivers: { id: number; regions: number[]; class: RiverClass }[];
  civHomes: Record<Civ, number>;
  /** How many elevation attempts were made (1 … 8); a diagnostic, not saved. */
  elevationAttempts: number;
}

export function newGenRegion(id: number, size: number): GenRegion {
  return {
    id,
    x: id % size,
    y: Math.floor(id / size),
    elevation: 0,
    tempC: 0,
    rain: 0,
    biome: 'ocean',
    geology: 'sedimentary',
    volcano: false,
    river: null,
    lake: false,
    deepness: 0,
    wealth: 0,
    peril: 0,
    temper: 0,
    traits: [],
    civDistance: { mountainhome: 0, gloam: 0, hillfolk: 0, wildwood: 0 },
    nearestEdgeTo: { mountainhome: 'n', gloam: 'n', hillfolk: 'n', wildwood: 'n' },
    name: '',
  };
}

/** Freeze a finished working set into the saved `WorldMap`. */
export function freezeWorld(g: GenWorld): WorldMap {
  const regions: RegionRecord[] = g.regions.map((r) =>
    Object.freeze({
      id: r.id,
      elevation: r.elevation,
      tempC: r.tempC,
      rain: r.rain,
      biome: r.biome,
      geology: r.geology,
      volcano: r.volcano,
      river:
        r.river === null
          ? null
          : Object.freeze({
              inflow: Object.freeze([...r.river.inflow]),
              outflow: r.river.outflow,
              class: r.river.class ?? 'brook',
            }),
      lake: r.lake,
      deepness: r.deepness,
      wealth: r.wealth,
      peril: r.peril,
      temper: r.temper,
      traits: Object.freeze([...r.traits]),
      civDistance: Object.freeze({ ...r.civDistance }),
      nearestEdgeTo: Object.freeze({ ...r.nearestEdgeTo }),
      name: r.name,
    }),
  );
  return Object.freeze({
    size: g.size,
    seed: g.seed,
    regions: Object.freeze(regions),
    civHomes: Object.freeze({ ...g.civHomes }),
    rivers: Object.freeze(
      g.rivers.map((rv) => Object.freeze({ id: rv.id, regions: Object.freeze([...rv.regions]), class: rv.class })),
    ),
  });
}
