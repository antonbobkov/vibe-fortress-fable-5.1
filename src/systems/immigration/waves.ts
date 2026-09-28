import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import { makeDwarf, type DwarfRecord } from '@systems/dwarves/rules/make-dwarf';
import { CHILDREN_MAX, CHILD_AGE_MIN, COVERAGE_SKILL, DOG_PERMILLE, FAMILY_PERMILLE, FINE_INDEX, GUARANTEED_SIZE_MAX, GUARANTEED_SIZE_MIN, IMMIGRANT_BASE, KEY_PROFESSIONS, PEASANT_PERMILLE, PET_PERMILLE, PRIMARY_MAX, PRIMARY_MIN, REP_PER_IMMIGRANT, SECONDARY_MAX, SECONDARY_MIN, SPIRIT_SIZE_STEP, UNCOVERED_WEIGHT, WAVE_MAX, WEALTH_PER_IMMIGRANT } from './constants';
import type { PlannedImmigrant } from './state';

export function waveSize(wealth: number, tier: number, reputation: number, capRemaining: number, winter: boolean): number {
  let size = IMMIGRANT_BASE + Math.floor(wealth / WEALTH_PER_IMMIGRANT) + (tier - FINE_INDEX) * SPIRIT_SIZE_STEP + Math.floor(reputation / REP_PER_IMMIGRANT);
  if (winter) size = Math.ceil(size / 2);
  return Math.max(0, Math.min(Math.min(WAVE_MAX, capRemaining), Math.max(IMMIGRANT_BASE, size)));
}

export function guaranteedSize(rng: RngStream, capRemaining: number): number {
  return Math.min(capRemaining, rng.int(GUARANTEED_SIZE_MIN, GUARANTEED_SIZE_MAX));
}

export function chooseProfession(rng: RngStream, covered: ReadonlySet<string>): typeof KEY_PROFESSIONS[number] | null {
  if (rng.chance(PEASANT_PERMILLE)) return null;
  return rng.weighted(KEY_PROFESSIONS.map((profession) => [profession, 1 + (covered.has(profession.id) ? 0 : UNCOVERED_WEIGHT)] as const));
}

export function coverage(registry: Registry, adultSkills: readonly Readonly<Record<string, number>>[]): Set<string> {
  const covered = new Set<string>();
  for (const profession of KEY_PROFESSIONS) {
    if (registry.table('skills').has(profession.primary) && adultSkills.some((skills) => (skills[profession.primary] ?? 0) >= COVERAGE_SKILL)) covered.add(profession.id);
  }
  return covered;
}

export function planWave(registry: Registry, rng: RngStream, size: number, covered: ReadonlySet<string>, taken: Set<string>): PlannedImmigrant[] {
  const planned: PlannedImmigrant[] = [];
  const makeAdult = (): { record: DwarfRecord; profession: string } => {
    const profession = chooseProfession(rng, covered);
    const skills = profession ? { [profession.primary]: rng.int(PRIMARY_MIN, PRIMARY_MAX), [profession.secondary]: rng.int(SECONDARY_MIN, SECONDARY_MAX) } : {};
    const record = makeDwarf(rng, registry, { taken, skills });
    taken.add(record.name);
    return { record, profession: profession?.id ?? '' };
  };
  while (planned.length < size) {
    const index = planned.length;
    const adult = makeAdult();
    planned.push({ ...adult, spouseIndex: -1, parentIndex: -1, pet: null, tile: -1 });
    if (!rng.chance(FAMILY_PERMILLE) || planned.length >= size) continue;
    const spouseIndex = planned.length;
    const spouse = makeAdult();
    planned.push({ ...spouse, spouseIndex: index, parentIndex: -1, pet: null, tile: -1 });
    (planned[index] as PlannedImmigrant).spouseIndex = spouseIndex;
    const children = rng.int(0, CHILDREN_MAX);
    for (let k = 0; k < children && planned.length < size; k += 1) {
      const child = makeDwarf(rng, registry, { taken, skills: {} });
      child.ageYears = rng.int(CHILD_AGE_MIN, ADULT_AGE_YEARS - 1);
      taken.add(child.name);
      planned.push({ record: child, profession: '', spouseIndex: -1, parentIndex: index, pet: null, tile: -1 });
    }
    if (rng.chance(PET_PERMILLE)) (planned[index] as PlannedImmigrant).pet = rng.chance(DOG_PERMILLE) ? 'dog' : 'cat';
  }
  return planned;
}
