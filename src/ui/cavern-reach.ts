/**
 * Whether a cavern's monsters can walk to the fortress (18 § Player-facing behavior): a monster
 * reaches the halls when 22's walker label of its tile is the label of some fortress dwarf's tile.
 * The labels know the terrain only, so a door does not cut a monster off; a wall, a cave-in or rock
 * does. Read-only: every reader it calls is a pure query.
 */
import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { EntityId } from '@core/types';
import type { DwarvesReader } from '@systems/dwarves';

/** The walker labels the fortress dwarves stand on now; null when there is no pathing to ask. */
export function fortressLabels(readers: ReaderSet): ReadonlySet<number> | null {
  if (!readers.has('pathing') || !readers.has('10')) return null;
  const out = new Set<number>();
  for (const id of readers.of<DwarvesReader>('10').list()) {
    const label = labelOf(readers, id);
    if (label !== 0) out.add(label);
  }
  return out;
}

/** A creature reaches the fortress: its walker label is one of `labels` (every creature does when `labels` is null). */
export function reachesFortress(readers: ReaderSet, id: EntityId, labels: ReadonlySet<number> | null): boolean {
  if (labels === null) return true;
  const label = labelOf(readers, id);
  return label !== 0 && labels.has(label);
}

function labelOf(readers: ReaderSet, id: EntityId): number {
  const p = readers.entities.get(id, C.Position);
  if (p === undefined || !readers.map.inBounds(p.x, p.y, p.z)) return 0;
  return readers.pathing.labelOf(readers.map.index(p.x, p.y, p.z), 'walker');
}
