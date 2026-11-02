/**
 * Core scalar types.
 *
 * The "core scalars" block of `04-implementation/schemas/components.md`, verbatim. They live in
 * one module so that `map3d.ts`, `entities.ts` and `components.ts` share them without a cycle.
 */

export type { Fixed } from './fixed';

/** `(z * LOCAL_MAP_H + y) * LOCAL_MAP_W + x`. */
export type TileIndex = number;

/** Bits 0-23 index, bits 24-31 generation. */
export type EntityId = number;

export type ChunkIndex = number;

/** Absolute tick since embark. */
export type Tick = number;

/** 0 .. 1000. */
export type Permille = number;

/** 0 .. 100, integer. */
export type Percent = number;

/** spring, summer, autumn, winter. */
export type Season = 0 | 1 | 2 | 3;

export type Edge = 'n' | 'e' | 's' | 'w';

export type Civ = 'mountainhome' | 'hillfolk' | 'wildwood' | 'gloam';

export type Faction = 'fortress' | 'wild' | 'deep' | `hostile:${Civ}` | `trader:${Civ}`;

export type MovementClass = 'walker' | 'small' | 'large' | 'aquatic' | 'amphibious';

export type BodySlot = 'head' | 'torso' | 'left_arm' | 'right_arm' | 'left_leg' | 'right_leg';

export type DamageType = 'edge' | 'blunt' | 'pierce' | 'ember' | 'frost';

export type WoundType = 'cut' | 'puncture' | 'bruise' | 'fracture' | 'burn' | 'frost' | 'wasting';

export type Severity = 'light' | 'serious' | 'grievous';

/** poor, common, fine, superior, exceptional, masterwork. */
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

/** bare, modest, decent, fine, grand, royal. */
export type RoomTier = 0 | 1 | 2 | 3 | 4 | 5;

/** miserable, unhappy, fine, content, ecstatic. */
export type MoodTier = 0 | 1 | 2 | 3 | 4;

export type Alert = 'calm' | 'watchful' | 'hearth';

export type Priority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** A string content id, as written in the tables and in saves. */
export type Id<_T> = string;

/** The dense registry index a content id resolves to at load. */
export type Idx<_T> = number;

/** The four season names in order, matching {@link Season}. */
export const SEASON_NAMES: readonly ['spring', 'summer', 'autumn', 'winter'] = [
  'spring',
  'summer',
  'autumn',
  'winter',
];

/** The six body slots in `Body.parts` order. */
export const BODY_SLOTS: readonly BodySlot[] = [
  'head',
  'torso',
  'left_arm',
  'right_arm',
  'left_leg',
  'right_leg',
];
