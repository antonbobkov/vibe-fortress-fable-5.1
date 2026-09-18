/**
 * Party generation, presets, skills and the budget: `02-systems/02-embark-and-loadout.md`
 * § Concepts, § Party generation, § Supplies, § Presets, § Fortress name;
 * `algorithms/economy.md` § Embark budget check; `03-content/embark-catalog.md`.
 */

import {
  EMBARK_BUDGET_BASE,
  EMBARK_BUDGET_PER_PERIL,
  EMBARK_DWARF_COUNT,
  EMBARK_SKILL_MAX_PER_SKILL,
  EMBARK_SKILL_POINTS_PER_DWARF,
} from '@core/constants';
import type { Registry } from '@core/registry';
import { RngStream } from '@core/rng';
import { makeDwarf, type DwarfRecord } from '@systems/dwarves/rules/make-dwarf';

/** The embark party's stream (`02` § Party generation: "from the `embark.party` rng stream"). */
export const PARTY_STREAM = 'embark.party';

export function partyStream(worldSeed: string): RngStream {
  return RngStream.forStream(worldSeed, PARTY_STREAM);
}

export interface EmbarkEntryRow {
  readonly id: string;
  readonly entry: string;
  readonly price: number;
  readonly max: number;
  readonly item?: string;
  readonly species?: string;
}

export interface EmbarkPresetRow {
  readonly id: string;
  readonly name: string;
  readonly skills: readonly { readonly dwarf: number; readonly skill: string; readonly level: number }[];
  readonly supplies: readonly { readonly entry: string; readonly count: number }[];
}

export interface SupplyLine {
  readonly entry: string;
  readonly count: number;
}

/** `budget = EMBARK_BUDGET_BASE + EMBARK_BUDGET_PER_PERIL × peril`. */
export function embarkBudget(peril: number): number {
  return EMBARK_BUDGET_BASE + EMBARK_BUDGET_PER_PERIL * peril;
}

/** `total = Σ entry.price × count`. */
export function suppliesTotal(registry: Registry, supplies: readonly SupplyLine[]): number {
  const table = registry.table<EmbarkEntryRow>('embarkCatalog');
  let total = 0;
  for (const line of supplies) {
    const entry = table.byId(line.entry);
    if (entry === undefined) throw new RangeError(`embark: unknown catalog entry ${line.entry}`);
    total += entry.price * line.count;
  }
  return total;
}

/** Skill points a dwarf has spent. */
export function skillPoints(d: DwarfRecord): number {
  let n = 0;
  for (const key of Object.keys(d.skills)) n += d.skills[key] ?? 0;
  return n;
}

/** The reason a party's skills are not allowed, or `null`. */
export function skillProblem(party: readonly DwarfRecord[]): string | null {
  for (let i = 0; i < party.length; i += 1) {
    const d = party[i] as DwarfRecord;
    if (skillPoints(d) > EMBARK_SKILL_POINTS_PER_DWARF) return `too_many_points:${i}`;
    for (const key of Object.keys(d.skills)) {
      const level = d.skills[key] ?? 0;
      if (level < 0 || level > EMBARK_SKILL_MAX_PER_SKILL) return `skill_over_max:${i}:${key}`;
    }
  }
  return null;
}

/** "The Embark button is enabled when `total ≤ budget` and every dwarf has ≤ 10 points with no skill above 5." */
export function canEmbark(
  registry: Registry,
  party: readonly DwarfRecord[],
  supplies: readonly SupplyLine[],
  peril: number,
): { ok: boolean; reason: string | null } {
  if (suppliesTotal(registry, supplies) > embarkBudget(peril)) return { ok: false, reason: 'over_budget' };
  const skills = skillProblem(party);
  return skills === null ? { ok: true, reason: null } : { ok: false, reason: skills };
}

/** `EMBARK_DWARF_COUNT` dwarves from the stream, every name unique, skills all zero. */
export function generateParty(rng: RngStream, registry: Registry, count = EMBARK_DWARF_COUNT): DwarfRecord[] {
  const party: DwarfRecord[] = [];
  const taken = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    const d = makeDwarf(rng, registry, { taken });
    taken.add(d.name);
    party.push(d);
  }
  return party;
}

/**
 * Re-roll one dwarf: new name, attributes and personality; skills kept. The reroll cost
 * (`EMBARK_REROLL_COST`) is charged by the session.
 */
export function rerollDwarf(rng: RngStream, registry: Registry, party: DwarfRecord[], index: number): DwarfRecord {
  const old = party[index];
  if (old === undefined) throw new RangeError(`reroll: no dwarf ${index}`);
  const taken = new Set(party.filter((_, i) => i !== index).map((d) => d.name));
  const d = makeDwarf(rng, registry, { taken, skills: old.skills, needs: old.needs });
  party[index] = d;
  return d;
}

/** A preset fills the party skills (replacing any set before) and returns its supply list. */
export function applyPreset(registry: Registry, party: DwarfRecord[], presetId: string): SupplyLine[] {
  const preset = registry.table<EmbarkPresetRow>('embarkPresets').byId(presetId);
  if (preset === undefined) throw new RangeError(`embark: unknown preset ${presetId}`);
  for (const d of party) d.skills = {};
  for (const s of preset.skills) {
    const d = party[s.dwarf];
    if (d !== undefined) d.skills[s.skill] = s.level;
  }
  return preset.supplies.map((l) => ({ entry: l.entry, count: l.count }));
}

/** Title Thane goes to the dwarf with the highest Charm, ties to the lowest id (index). */
export function thaneIndex(charms: readonly number[]): number {
  let best = -1;
  let bestCharm = -Infinity;
  for (let i = 0; i < charms.length; i += 1) {
    const c = charms[i] as number;
    if (c > bestCharm) {
      best = i;
      bestCharm = c;
    }
  }
  return best;
}

interface FortressNames {
  readonly fortressPrefix: readonly string[];
  readonly fortressSuffix: readonly string[];
  readonly needsSpace: readonly string[];
}

/**
 * The default fortress name: `prefix + suffix` ("Emberhall"); a prefix listed as needing a space
 * is written apart with the suffix capitalised ("Hollow Deep").
 */
export function defaultFortressName(rng: RngStream, registry: Registry): string {
  const names = registry.derived<FortressNames>('names');
  const prefix = rng.pick(names.fortressPrefix);
  const suffix = rng.pick(names.fortressSuffix);
  if (names.needsSpace.includes(prefix)) return `${prefix} ${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}`;
  return `${prefix}${suffix}`;
}
