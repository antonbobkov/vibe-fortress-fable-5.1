/** System 25's saved state: `04-implementation/schemas/system-state.md` § MagicState. */

import type { EntityId, Tick, TileIndex } from '@core/types';

/** The last mishap of a sanctum, for its panel. */
export interface MishapRecord {
  kind: string;
  dwarfId: EntityId;
  tick: Tick;
}

/** A Firebloom cast and not yet bloomed (§ Spells). */
export interface Bloom {
  tile: TileIndex;
  at: Tick;
  casterId: EntityId;
  raw: number;
}

export interface MagicStateV1 {
  stateVersion: 1;
  /** Attune sessions today by dwarf, ascending id; omitted when none. */
  sessionsToday?: [EntityId, number][];
  /** The first dwarf to reach `runecraft` 10 has been announced. */
  firstRunecasterDone?: boolean;
  /** The last mishap of each sanctum zone, ascending zone id; omitted when none. */
  lastMishaps?: [EntityId, MishapRecord][];
  /** Fireblooms cast and not yet bloomed, in cast order; omitted when none. */
  pendingBlooms?: Bloom[];
  /** Casters whose firebloom caught a fortress creature today, ascending; omitted when none. */
  bloomAlertsToday?: EntityId[];
}
