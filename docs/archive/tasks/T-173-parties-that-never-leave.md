# T-173 — A party always leaves

Closed by `T-173: hostile parties keep their exit route and always leave`.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md) (bug 14) · **Size:** M · **Needs:** T-169 · **Status:** open

## Why

Two ways a hostile party stays on the map without limit were measured on `three-years-p4-1`:

- a thief that had stolen stood in `retreat` at (29, 13, 32) from day 47 to day 83, with nine to twelve dwarves alive;
- a raid of eleven and an ambush of four reached the hearth after the last dwarf died on day 61 and were still there in `approach` on day 116. In the three-year runs, twelve of the thirty parties at peril 4 and five of the thirteen at peril 2 had not ended when the run stopped.

18 gives `loiter` a limit (`LOITER_DAYS_RAID`, `LOITER_DAYS_SIEGE`) and gives `approach` and `retreat` none.

## Reproduction

`raid.probe.ts`, seed `three-years-p4-1`, peril 4, 120 days: the daily lines from day 48 (the thief) and from day 65 (the raid and the ambush). The cause of the thief's standstill was not established; its loot list named an entity that no longer existed on day 66 (`party.loot-missing`), so it may have stolen an animal.

## What to do

**Decision.** Every party state has a limit.

- `approach`: a party that has arrived at its goal (on it or adjacent) and has no reachable target in perception for `ENGAGE_IDLE_TICKS` goes to `loiter`, and `loiter` ends as today. A raid at the hearth of an empty fortress therefore loots and leaves after two days.
- `retreat`: a member that cannot make progress toward its edge for `RETREAT_STUCK_TICKS` (new, 600) picks the nearest reachable edge tile of any edge; after `RETREAT_GIVE_UP_DAYS` (new, 2) in `retreat` the remaining members are removed and the party ends with the outcome it has.

1. Amend 18 § Party AI and its constants table. Find the cause of the thief's standstill first; if it is the stolen animal, fix that too.
2. Tests, `describe('T-173 …')`: a raid on a flat-test map with a hearth and no dwarves ends within three days; a thief walled off from its edge after stealing ends within `RETREAT_GIVE_UP_DAYS`.

## Done

- The tests pass.
- No `party.active-over-10d`, `party.approach-over-3d` or `party.retreat-over-2d` in the long runs, and every `RaidArrived` has a `RaidEnded`.
