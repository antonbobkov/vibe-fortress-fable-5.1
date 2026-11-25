/**
 * The sheltering dwarves a Hearth alert has locked away from their drink or their food
 * (19 § Hearth alert retreat, 24 § Announcements and the log, `panels.md` § Military).
 *
 * The lock rule does not change: a locked door does not open for a drink. These readers only say
 * so. A civilian counts while the alert is `hearth`, some door stands locked, its hunger or thirst
 * is at 10's critical mark, it is still retreating (10 found nothing to serve the need from where it
 * shelters: no reachable item, well or water) and the fortress stores some of it, none of which
 * the dwarf can reach. Read-only: every reader it calls is a pure query.
 */
import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import type { DwarvesReader } from '@systems/dwarves';
import { CRITICAL } from '@systems/dwarves/needs';
import type { ItemsReader } from '@systems/items';

/** The two needs a locked door can keep from a sheltering dwarf. */
export type ShutNeed = 'thirst' | 'hunger';

export const SHUT_NEEDS: readonly ShutNeed[] = ['thirst', 'hunger'];

/** What serves each need, as 10 looks for it (13's filter). */
const FILTER: Readonly<Record<ShutNeed, { drinkable?: true; edible?: true }>> = {
  thirst: { drinkable: true },
  hunger: { edible: true },
};

/**
 * The sheltering civilians cut off from `need` now, ascending; empty unless the alert is `hearth`
 * with a door locked and the fortress stores some of it.
 */
export function cutOff(readers: ReaderSet, need: ShutNeed): EntityId[] {
  if (!readers.has('10') || !readers.has('13') || !readers.has('14') || !readers.has('16')) return [];
  const combat = readers.of<CombatReader>('16');
  if (combat.alert() !== 'hearth') return [];
  const critical = CRITICAL[need] as number;
  const dwarves = readers.of<DwarvesReader>('10');
  const candidates = dwarves.list().filter((id) => {
    if (combat.onDuty(id) || dwarves.isUnsheltered(id)) return false;
    if ((readers.entities.get(id, C.Needs)?.[need] ?? 0) < critical) return false;
    return readers.entities.get(id, C.Brain)?.behavior === 'retreat';
  });
  if (candidates.length === 0) return [];
  const buildings = readers.of<BuildingsReader>('14');
  if (!buildings.byTag('door').some((door) => buildings.mechanismState(door) === 'locked')) return [];
  const items = readers.of<ItemsReader>('13');
  if (items.countAvailable(FILTER[need]) <= 0) return [];
  // One search per walker region: the dwarves sheltering together reach the same things.
  const reach = new Map<number, boolean>();
  const out: EntityId[] = [];
  for (const id of candidates) {
    const tile = tileOf(readers, id);
    if (tile < 0) continue;
    const label = readers.pathing.labelOf(tile, 'walker');
    let found = reach.get(label);
    if (found === undefined) {
      found = items.findItem(FILTER[need], tile, 'walker', { reservable: true }) !== 0;
      reach.set(label, found);
    }
    if (!found) out.push(id);
  }
  return out.sort((a, b) => a - b);
}

function tileOf(readers: ReaderSet, id: EntityId): TileIndex {
  const p = readers.entities.get(id, C.Position);
  return p === undefined ? -1 : readers.map.index(p.x, p.y, p.z);
}

/**
 * The once-per-alert shut-in alert (24 § Announcements and the log): checked each game hour; a need
 * is told when some civilian has been cut off from it at two checks in a row (an hour at a critical
 * need with nothing served, so a dwarf whose need has only just turned critical, and who is about
 * to walk to a well inside, is not counted), once per need until the alert leaves `hearth`.
 * Presentation state, not saved: a game loaded under the alert may tell it once more.
 */
export class ShutInWatch {
  private readonly said = new Set<ShutNeed>();
  private readonly lastHour = new Map<ShutNeed, ReadonlySet<EntityId>>();

  /** The alert changed: a new Hearth alert may tell each need again. */
  reset(): void {
    this.said.clear();
    this.lastHour.clear();
  }

  /** The needs to tell this hour and the civilians cut off from each now. */
  check(readers: ReaderSet): { need: ShutNeed; ids: EntityId[] }[] {
    if (!readers.has('16') || readers.of<CombatReader>('16').alert() !== 'hearth') { this.reset(); return []; }
    const out: { need: ShutNeed; ids: EntityId[] }[] = [];
    for (const need of SHUT_NEEDS) {
      if (this.said.has(need)) continue;
      const ids = cutOff(readers, need);
      const before = this.lastHour.get(need);
      this.lastHour.set(need, new Set(ids));
      if (before === undefined || !ids.some((id) => before.has(id))) continue;
      this.said.add(need);
      out.push({ need, ids });
    }
    return out;
  }
}
