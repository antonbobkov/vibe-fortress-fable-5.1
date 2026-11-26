# T-753 — A civilian already in the only room behind a door finds no shelter there

**Closed:** 2026-11-26, in a6c7b71c.

**Source:** T-745 (found while writing `test/unit/ui/t745-shut-in-thirst.test.ts`) · **Size:** S · **Needs:** — · **Status:** open

## Why

19 § Hearth alert retreat step 2 looks for "an indoor tile behind a door" by a breadth-first search from the dwarf that counts a tile only once the search has passed a door. A civilian who is already standing in a room whose one door leads outdoors (a flat-test room: a wall across the map, a `lock_on_alert` door, indoor tiles behind it, no hearth) finds none: its search leaves by the door into the open and never comes back. With no hearth hall and no bedroom it is one of 10's `unsheltered()`, works as under a Watchful alert, and the Military panel says "No shelter: 2 dwarves keep working, unable to reach the hall or a room behind a door." while it stands in that room with the door locked behind it. Its fellows who were outside when the alert came walk in and shelter on the same tiles.

Seen in the T-745 test: two dwarves teleported into the room before the alert stayed `idle` under Hearth; with a hearth there (a 5×5 hall) they retreated. A fortress with a hearth hall, or with interior doors, does not meet it, so it is rare in play.

## What to do

Decide in 19 whether a civilian already on the indoor side of a door (the side away from the outdoors, as 14 reads a door's outside) shelters where it stands, and pin it with a test. Keep the retreat tile rules of T-447 and the fixed-tile rule as they are.

## Tried

**Shelter in place, any door (taken back out).** When step 2's search finds no tile behind a door, a dwarf standing on an indoor tile, not a doorway, whose indoor tiles (walked without passing a door, hatch, floodgate or drawbridge) reach a door, locked or not, sheltered on its own tile (fixed as any step-2 tile). It passed the bounds but cost the fortress, measured against the same commit with only that line off:

| Sweep | Run | Pooled living | Pooled deaths |
|---|---|---|---|
| Rule on (78950ee0) | 45719961875 | 1130.25 | 121.5 |
| Rule off (8ccf3cbf, probe) | 45720106958 | 1169.25 | 110.25 |

Peril 0 was identical with and without it; every loss was in the raided seeds (perils 2 and 4), at every shift. The worst: `three-years-p4-1` at shift 50 fell from 49 living and 20 deaths to 5 and 39. The defence check passed with it (run 45719965506: raids turned back 7.13 of 8, a soldier killed 6.50).

Reading (not traced): the rule fires only for dwarves the search finds nothing for, who before were `unsheltered()` and worked as under a Watchful alert, free to flee. With it they "shelter" where they stand in rooms whose only doors lead outdoors, including doors that never lock (not `lock_on_alert`), so they wait in the room the raiders walk into.

**To try next.** Shelter in place only when every door around the room (every door the dwarf's indoor tiles reach) is `lock_on_alert` or locked, so the room really is shut when the alert locks the doors. Measure it the same way: the sweep against a probe of the same commit with the line off, and the defence check.

`test/unit/defense/t753-shelter-from-inside.test.ts` pins today's behaviour (the dwarves inside are unsheltered and the Military panel counts them); the rule's change turns it around.

Found while trying it: with no hearth, the door locks 20 ticks into the alert on a dwarf walking to it from a few tiles out (`T-777-hearthless-door-shuts-out.md`, added with T-752–T-754). A squad member killed the tick before an invariant sample was still listed (sweep seed p4-1 at shift 50): fixed with T-752–T-754, a dead member or leader leaves its squad when its `CreatureDied` is handled (16 § Squads; `test/unit/combat/t753-dead-member-leaves-squad.test.ts`).

**Narrowed rule (this pass).** When step 2's search finds no tile behind a door, a dwarf shelters on its own tile only when it stands in a room the alert shuts: its tile is indoor and not a doorway, and the indoor tiles it walks to without passing a door, hatch, floodgate or drawbridge (within `RETREAT_SEARCH_LIMIT`) reach at least one door, every door they reach is `lock_on_alert` or `locked`, and none of them steps onto an `outdoor` tile. Decided beyond the brief: the last clause (no open way out) is the same reading as the doors one, since a room open to the outdoors is not shut whatever its doors do; and a room too large to walk within the limit is not judged shut. Hatches, floodgates and drawbridges bound the room but are not judged.

## Done

- [x] Decide in 19 (and 10's step 2) whether a civilian already on the inner side of a door shelters where it stands, and under which doors: only in a room the alert shuts (19 § Hearth alert retreat step 2; 10 § Behavior selection step 2).
- [x] Test: a civilian inside a one-door room shelters there under Hearth (`lock_on_alert`, and a door locked by hand); the panel's no-shelter line does not count it; behind an `open` door, in a room with an open side, or under a roof with no door it has no shelter (`test/unit/defense/t753-shelter-from-inside.test.ts`).
- [x] The sweep and the defence check on GitHub, the narrowed rule alone on master (branch `probe-t753-only`, 1d52842f), against the master figures and a sweep of the same master with only T-777 on (the rule off):

  | Sweep | Run | Pooled living | Pooled deaths |
  |---|---|---|---|
  | Narrowed rule on (1d52842f) | 45775758880 | 1169.5 | 111 |
  | Rule off, T-777 on (f9ba0194) | 45775769548 | 1171.25 | 110 |
  | Master (as given) | — | about 1169.25 | 110.25 |

  Verdict pass, every seed job passed; the two sweeps differ in two seed-shifts only (p4-4 at 100, p4-6 at 150), so the narrowed rule rarely fires in the sweep. Defence check (run 45775763301): raids turned back 7.25 of 8, a soldier killed 6.38 of 8, pass. Adopted.
