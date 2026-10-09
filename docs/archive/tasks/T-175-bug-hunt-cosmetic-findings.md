# T-175 — Cosmetic findings of the bug hunt

Closed by `T-175: reject invalid settings and retire stale simulation records`.

**Source:** T-115 and its report, [`../../../reports/audits/2026-10-08-bug-hunt.md`](../../../reports/audits/2026-10-08-bug-hunt.md) (the cosmetic list) · **Size:** M · **Needs:** — · **Status:** open

## Why

Twelve small faults, none of which changes a played fortress. They are grouped so that one agent can clear them in one pass.

## Reproduction

[`commands.probe.ts`](../../../reports/data/2026-10-08-bug-hunt-commands.probe.ts.txt) for the command items; the long runs for the others.

## What to do

Each item with its decision:

1. **`SetPopulationCap` clamps out-of-range values and returns `ok`.** Reject with `out_of_range` outside 20 … 200, as `command-catalog.md` says. The population panel already keeps its control inside the range.
2. **`SetStandingOrder` accepts `toString`, `constructor`, `hasOwnProperty`, `__proto__`.** Test the name with `Object.hasOwn`; reject a non-boolean `on` with `bad_setting`.
3. **`AssignPasture` answers `not_tame` for a tame animal that is not a grazer.** Add the reason `not_grazer` to the fixed list and the strings table, and use it. (T-156 stops the fixture from sending the command for dogs and cats.)
4. **`SetSquadLeader` accepts a dwarf who is not a member.** Reject with `not_found`; `CreateSquad { leaderId }` adds the leader as the first member.
5. **`SetSquadEquipment` stores unknown values.** `weaponClass` is `any` or a weapon class of the content, `armor` is `metal`, `leather` or `any`, `ranged` is a boolean; else `bad_setting`.
6. **`LinkStockpile` accepts a source that is not a stockpile.** Reject with `not_found`.
7. **`SetPlateTrigger` accepts a fractional level; `SetStockpileContainers` accepts 1,000,000,000.** Levels are integers 1 … 7; container counts are integers from 0 to the number of tiles of the stockpile; else `out_of_range`.
8. **A `Party` entity in state `gone` is never destroyed.** Destroy it one day after it ends; the legend keeps what it needs from `RaidEnded`.
9. **A caravan guard's dagger and arrows outlive the guard.** T-163 removes them; check it here.
10. **`command-catalog.md` has a double-encoded en dash** in "values outside 1 to 9 rejected". Fix the text.
11. **A cavern creature stood on a tree tile for 17 days** (`three-years-p4-1`, `blind_stalker` at (37, 42, 13), from tick 382,850). 07 must not grow a tree on a tile that holds a creature; if it already does not, find how the creature got there.
12. **A craft job listed a delivered input that no longer existed for three days** (`three-years`, peril 0, job 968, ticks 26,900 to 30,300). The board should drop a delivered input when the item is destroyed, on `ItemDestroyed`.

Every item gets a unit test named `T-175`.

## Done

- The tests pass and `command-catalog.md` reads correctly.
