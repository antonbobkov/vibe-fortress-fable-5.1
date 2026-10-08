/**
 * `makeDwarf`: one new dwarf's identity, shared by 02 embark (the party) and 21 immigration.
 *
 * Implements `algorithms/economy.md` § Immigration wave (`makeDwarf()`), `02-embark-and-loadout.md`
 * § Party generation and `03-content/names.md` § Dwarf given names, § Hall-names (and the
 * uniqueness rule of its preamble), `03-content/personality-and-thoughts.md` (three traits, one
 * from each of three randomly chosen pairs, weighted by `freq` within the pair).
 *
 * A pure rule: it draws only from the stream it is given and returns a plain record; the spawn
 * path turns the record into components.
 */

import { ATTRIBUTE_BASELINE, ATTRIBUTE_MAX, ATTRIBUTE_MIN, NEED_MAX } from '@core/constants';
import type { Attributes } from '@core/components';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import { EMBARK_AGE_MAX, EMBARK_AGE_MIN } from '@systems/embark/constants';

/** Each attribute is `ATTRIBUTE_BASELINE + sum of three rolls in −8..8`. */
export const ATTRIBUTE_ROLLS = 3;
export const ATTRIBUTE_ROLL_SPREAD = 8;

/** `names.md`: "a shared list used for either at 20% weight". */
export const SHARED_NAME_PERMILLE = 200;

/** `names.md`: "the generator retries up to 20 times then appends a numeral suffix in words". */
export const NAME_RETRIES = 20;

/** `economy.md` `makeDwarf`: "needs 30". Embark arrival overrides to 20 (02 § Arrival step 5). */
export const NEW_DWARF_NEEDS = 30;

/** Attribute keys in the order they are rolled (`components.md` § Attributes). */
export const ATTRIBUTE_KEYS: readonly (keyof Attributes)[] = ['str', 'agi', 'tou', 'end', 'wil', 'wit', 'cha'];

const ORDINALS = [
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
];

interface NamesTable {
  readonly givenA: readonly string[];
  readonly givenB: readonly string[];
  readonly shared: readonly string[];
  readonly hallFirst: readonly string[];
  readonly hallSecond: readonly string[];
}

interface TraitRow {
  readonly id: string;
  readonly pair: string;
  readonly freq: number;
}

/** A dwarf before it is an entity. Skills are level by skill id; absent means 0. */
export interface DwarfRecord {
  name: string;
  /** 0 draws from list A, 1 from list B (docs/03-content/names.md). */
  sex: 0 | 1;
  ageYears: number;
  attributes: Attributes;
  /** Three trait ids, one from each of three distinct pairs. */
  personality: [string, string, string];
  skills: Record<string, number>;
  needs: number;
}

/** `ATTRIBUTE_BASELINE + Σ3 rng.int(−8, 8)`, clamped to `ATTRIBUTE_MIN … ATTRIBUTE_MAX`. */
export function rollAttribute(rng: RngStream): number {
  let v = ATTRIBUTE_BASELINE;
  for (let k = 0; k < ATTRIBUTE_ROLLS; k += 1) v += rng.int(-ATTRIBUTE_ROLL_SPREAD, ATTRIBUTE_ROLL_SPREAD);
  return Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, v));
}

export function rollAttributes(rng: RngStream): Attributes {
  const out = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) out[key] = rollAttribute(rng);
  return out;
}

/** "one from each of three randomly chosen pairs (never both of a pair)", weighted by `freq`. */
export function rollPersonality(rng: RngStream, registry: Registry): [string, string, string] {
  const table = registry.table<TraitRow>('personality');
  const rows = table.ids().map((id) => table.byId(id) as TraitRow);
  const pairs = Array.from(new Set(rows.map((r) => r.pair))).sort();
  if (pairs.length < 3) throw new RangeError('personality: fewer than three trait pairs');
  rng.shuffle(pairs);
  const chosen = pairs.slice(0, 3).map((pair) =>
    rng.weighted(rows.filter((r) => r.pair === pair).map((r) => [r.id, r.freq] as const)),
  );
  return [chosen[0] as string, chosen[1] as string, chosen[2] as string];
}

/** One candidate name: a given name (by sex, or the shared list at 20%) and a hall-name. */
export function rollName(rng: RngStream, names: NamesTable, sex: 0 | 1): string {
  const list = rng.chance(SHARED_NAME_PERMILLE) ? names.shared : sex === 0 ? names.givenA : names.givenB;
  const given = rng.pick(list);
  const hall = `${rng.pick(names.hallFirst)}${rng.pick(names.hallSecond)}`;
  return `${given} ${hall}`;
}

/**
 * `names.unique(rng)`: retry up to `NAME_RETRIES` times for a name no living dwarf has, then take
 * the last candidate with the first free ordinal suffix ("the Second").
 */
export function uniqueName(rng: RngStream, names: NamesTable, sex: 0 | 1, taken: ReadonlySet<string>): string {
  let name = rollName(rng, names, sex);
  for (let k = 0; k < NAME_RETRIES && taken.has(name); k += 1) name = rollName(rng, names, sex);
  if (!taken.has(name)) return name;
  for (const ord of ORDINALS) {
    const candidate = `${name} the ${ord}`;
    if (!taken.has(candidate)) return candidate;
  }
  let n = ORDINALS.length + 2;
  while (taken.has(`${name} ${n}`)) n += 1;
  return `${name} ${n}`;
}

export interface MakeDwarfOptions {
  /** Names of the living dwarves, so the new one differs from all of them. */
  readonly taken?: ReadonlySet<string>;
  readonly skills?: Readonly<Record<string, number>>;
  readonly needs?: number;
}

/**
 * `makeDwarf()`: sex, a unique name, age uniform in `EMBARK_AGE_MIN … EMBARK_AGE_MAX` years, the
 * seven attributes and three personality traits, in that draw order (the name depends on the
 * sex, so the sex is drawn first; D-043). Needs 30 unless the caller says otherwise.
 */
export function makeDwarf(rng: RngStream, registry: Registry, options: MakeDwarfOptions = {}): DwarfRecord {
  const names = registry.derived<NamesTable>('names');
  const sex = rng.int(0, 1) as 0 | 1;
  const name = uniqueName(rng, names, sex, options.taken ?? new Set());
  const ageYears = rng.int(EMBARK_AGE_MIN, EMBARK_AGE_MAX);
  const attributes = rollAttributes(rng);
  const personality = rollPersonality(rng, registry);
  const needs = Math.max(0, Math.min(NEED_MAX, options.needs ?? NEW_DWARF_NEEDS));
  return { name, sex, ageYears, attributes, personality, skills: { ...(options.skills ?? {}) }, needs };
}
