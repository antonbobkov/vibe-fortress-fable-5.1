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
