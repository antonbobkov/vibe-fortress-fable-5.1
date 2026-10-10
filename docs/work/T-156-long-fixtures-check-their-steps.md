# T-156 — The long fixtures check their own steps, and the sweep asserts what it exercises

**Source:** T-114 and its report, [`../../reports/audits/2026-10-08-playthrough-coverage.md`](../../reports/audits/2026-10-08-playthrough-coverage.md) (gaps 6 and 9; bugs 1 and 2) · **Size:** M · **Needs:** T-145 · **Status:** open

**Held (2026-10-10).** T-145, which the cloud agent has, rewrites the same three-year fixture files. Start this task after T-145 is closed. Two notes from other tasks: `hospital_run` hangs on one roll of a fight and should assert on a staged, repeatable casualty; `homestead_year`'s birth check was made robust on branch `t-144`.

## Why

The three-year script ignores the result of most commands it sends. Measured:

- At peril 0 on seed `three-years`, 2,872 `PlaceBuilding` commands are rejected. Three of the six gate walls are never placed, the gate doors are never placed, and no door mode is ever set. The scenario passes.
- `AssignPasture` is rejected `not_tame` three times in every run, at every peril.
- At perils 2 and 4, `three_years_seeds` asserts only the population cap, the wave cap and the mood floor of survivors. The measured peril-2 seed completed two build jobs in three years and the test passed.
- `year_one` builds a depot, receives two caravans at it and never trades.
- No long run saves and reloads.

A playthrough protects a feature only while its step still happens. Today a step can stop happening and nothing reports it.

T-145 rewrites `three_years_fortress.ts` to play at default priorities. This task comes after it, because it edits the same file.

## Decisions

- **Every command of a long script goes through one helper** that throws on an unexpected rejection. A script names the rejections it expects (a ghost test before placement is the normal way to have none). This applies to `three_years_fortress.ts`, `three_years_economy.ts`, `year_one.scenario.ts` and `year_one_seeds.test.ts`.
- **The gate fault and the pasture fault are fixed in the script**, by choosing wall tiles with the ghost reader and by assigning only animals the animals reader reports as tame. If the cause turns out to be in the game and not in the script, file a bug row.
- **Each long run asserts a witness list at its end**: the things the script exists to exercise happened at least once. For `three_years` at every peril: the gate walls and doors are built; the hearth hall, the dining hall and at least seven bedrooms exist with a room tier; the squad exists. At peril 2 and 4, for a fortress that is alive at the end: at least one `SetAlert` to `hearth` and back, and at least one completed trade. For `year_one`: one completed trade with the Hillfolk.
- **The sweep reports and asserts survival honestly.** `three_years_seeds` asserts, for each seed, that the fortress is not extinct at the end of year 1. The balance rows decide the later years; this task does not add a bound for them.
- **`year_one` saves on day 56, loads the save into a second world, and asserts equal hashes on day 57.**
- **The recorder becomes a test helper.** `reports/data/2026-10-08-playthrough-coverage-recorder.ts.txt` is the starting point for `test/scenarios/recorder.ts`: counts of accepted and rejected commands and of events for one `TestWorld`, attached by the scenario, with no prototype patching.

## What to do

1. Add the command helper and the recorder helper.
2. Fix the two script faults.
3. Add the witness lists, the trade in `year_one`, the save and load in `year_one`, and the year-1 survival assertion of the sweep.
4. Describe the witness lists in `testing-strategy.md` § The long scenarios.
5. Run `npm test`, and the peril-2 and peril-4 seeds `three-years-p2-1` and `three-years-p4-1` alone. The full sweep belongs to T-113.

## Done

- `three_years` and `year_one` pass with no unexpected rejected command.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
