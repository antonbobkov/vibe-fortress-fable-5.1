/**
 * Whether a workshop type has anything to make or do (`12` § Player-facing behavior): a recipe names
 * it, or a job type is worked at it (`jobs.md`: the butcher's shop and the kennel have jobs and no
 * recipes). A workshop with neither, such as the reserved magma kiln, is not offered and not placed.
 */

import type { Registry } from './registry';

export function workshopHasWork(registry: Registry, workshopType: string, recipeCount: number): boolean {
  if (recipeCount > 0) return true;
  return registry.table<{ id: string; workshop?: string }>('jobTypes').rows.some((job) => job.workshop === workshopType);
}
