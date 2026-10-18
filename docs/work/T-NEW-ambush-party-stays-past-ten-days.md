# T-NEW — An ambush party stays on the map for more than ten days

**Source:** T-387's rerun of the peril-2 seeds, 2026-10-18 at `062f3c8`, [data](../../reports/data/2026-10-18-t387-peril-2-sweep.json); the invariant is `party.active-over-10d` (T-176) · **Size:** M · **Needs:** — · **Status:** open

## Why

Two seeds of the peril-2 sweep stop on it, each with a Gloam ambush that has neither retreated nor been destroyed ten days after it arrived:

| Seed | Tick (day) | Party | State then | Arrived | Members | Flags |
|---|---|---|---|---|---|---|
| `three-years-p2-6` | 213,600 (179) | 150995577, size 3 | `loiter` since 212,414 | 200,400 | 3 of 3 alive, 3 items looted | `goalUnreachable`, `walkUnreachable` |
| `three-years-p2-1` | 349,200 (292) | 251660093, size 6 | `engage` since 349,181 | 336,000 | 4 of 6 alive, no loot | — |

18 § Parties says a loitering raid retreats after `LOITER_DAYS_RAID` (2 days) and that an ambush targets the nearest dwarf outdoors. Both parties changed state shortly before the finding (1,186 ticks before it on `p2-6`, 19 ticks on `p2-1`), so a party that cycles between `approach`, `engage` and `loiter` seems to restart its loiter timer on each cycle and never reaches the retreat. Since T-387 the three-year script keeps its dwarves below ground more of the time, which leaves an ambush with no outdoor dwarf to target for longer.

## What to do

1. Diagnosis first: rerun `p2-6` alone (`-t "p2-6'"`, about 4 minutes to the finding) with a probe that logs the party's state, `stateSince`, goal and flags on every threats tick from its arrival, with the outdoor dwarves the ambush could target.
2. Name the cause against 18 § Parties: a loiter timer that each new goal or state restarts, an ambush with no outdoor dwarf that is never sent to `loiter` or `retreat`, or the checker counting a party that the rules keep on the map legitimately.
3. A game fault: a failing stepped test first, the fix, and the rule in 18 (for instance, the time a party may spend on the map without a fight, whatever its state changes). A checker fault: fix the checker with a unit test, and say why in testing-strategy.md.

## Done

- `p2-6` and `p2-1` pass their daily checks past the ticks above, or this file records why the party stays.
