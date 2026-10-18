# T-389 — An ambush party stays on the map for more than ten days

**Closed:** 2026-10-18, in 613a0e2, c5c9f3c, 79acb99.

**Source:** T-387's rerun of the peril-2 seeds, 2026-10-18 at `062f3c8`, [data](../../../reports/data/2026-10-18-t387-peril-2-sweep.json); the invariant is `party.active-over-10d` (T-176) · **Size:** M · **Needs:** — · **Status:** open

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

## Findings

- 2026-10-18, `three-years-p2-6` (reproduced at the same tick, 213,600): the Gloam ambush arrives on day 168 at the north edge and finds no dwarf outdoors, so its goal is the hearth (35, 7, 26), which the connectivity labels join to it. Its leader's walk fails at once: the mover does not open the gate door (`opensDoors` is read at the top of the creature row, the content has it under `flags`; new row `T-400-hostiles-never-open-doors.md`). So it loiters where it stands. Each `TilesChanged` of the miners then cleared `walkUnreachable` and, with the hearth label-reachable, sent the party back to `approach` with a new `stateSince` (`src/systems/threats/index.ts:483-496`); the walk failed again within two ticks and the loiter restarted, every 50 to 700 ticks for the rest of the run. Fixed: a party whose own walk failed is not sent back by a terrain change, and a broken door clears the failed walk (18 § Loiter).
- `three-years-p2-1`: at this commit it no longer reaches the finding before the fix (its day-281 party does not come in that form; the run has two parties after day 270, both gone within two days). With the fix, both seeds play the three years with no invariant finding.
- The caged leader of `defence_year` (the predecessor's commit) is a second cause, with traps.
