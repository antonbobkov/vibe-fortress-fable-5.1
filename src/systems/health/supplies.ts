/** Hospital setting validation, shared by 17's command and 14's zone settings. */
import { HOSPITAL_DEFAULT_SUPPLIES, HOSPITAL_SUPPLY_MAX } from './constants';

export function validHospitalSupplies(value: unknown): value is Record<string, number> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.entries(value).every(([kind, count]) =>
    Object.hasOwn(HOSPITAL_DEFAULT_SUPPLIES, kind) && typeof count === 'number' &&
    Number.isInteger(count) && count >= 0 && count <= HOSPITAL_SUPPLY_MAX);
}

/** The hospital zones and their settings, as 14's reader gives them. */
export interface HospitalZones {
  zonesOfType(type: string): readonly number[];
  zoneSetting(id: number, key: string): unknown;
}

/** One hospital's wanted supplies: its `desired supplies` setting, or `HOSPITAL_DEFAULT_SUPPLIES`. */
export function hospitalWantsOf(buildings: HospitalZones, zoneId: number): Readonly<Record<string, number>> {
  return (buildings.zoneSetting(zoneId, 'desired supplies') ?? buildings.zoneSetting(zoneId, 'wants') ??
    HOSPITAL_DEFAULT_SUPPLIES) as Record<string, number>;
}

/**
 * 17 § Patients and hospitals: the dressings the fortress's hospitals keep, the sum of their `cloth`
 * and `bandages` supply settings (as 13's hospital chests read them); `none` without a hospital.
 */
export function hospitalDressings(buildings: HospitalZones | null, none = 0): number {
  if (buildings === null) return none;
  const zones = buildings.zonesOfType('hospital');
  if (zones.length === 0) return none;
  let kept = 0;
  for (const zoneId of zones) {
    const wants = hospitalWantsOf(buildings, zoneId);
    kept += (wants['cloth'] ?? 0) + (wants['bandages'] ?? 0);
  }
  return kept;
}

/**
 * 12 § Cloth kept for dressings: the dressings no workshop order takes: the hospitals' (above), or,
 * while the fortress has no hospital, what a hospital keeps by default (`HOSPITAL_DEFAULT_SUPPLIES`).
 */
export function keptDressings(buildings: HospitalZones | null): number {
  return hospitalDressings(buildings, (HOSPITAL_DEFAULT_SUPPLIES['cloth'] ?? 0) + (HOSPITAL_DEFAULT_SUPPLIES['bandages'] ?? 0));
}
