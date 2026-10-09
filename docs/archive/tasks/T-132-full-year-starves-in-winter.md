# T-132 — The year-long browser playthrough starves since T-168

Closed by `T-132: keep brewing barrels free from stockpile hauls`.

**Source:** found by Codex while closing T-174 and T-177, 2026-10-09; bisected by the orchestrator the same day · **Size:** M · **Needs:** — · **Status:** open

## What is wrong

`test/e2e/full-year.spec.ts` fails on master: the fortress ends the year with too few dwarves ("the hall grew past the initial 7 dwarves" fails). It last passed at T-131. About twenty behaviour fixes were then merged on `npm test` alone, which does not run the browser suite.

## Bisect (measured, 2026-10-09)

`git bisect --first-parent`, good `b7beeb4` (T-131), bad `1c20c25` (master), testing only `npx playwright test test/e2e/full-year.spec.ts`:

| Commit | Merge | Result |
|---|---|---|
| `8394afc` | T-111 draft | pass |
| `3f53c9a` | T-164, T-165 | pass |
| `2bbc86c` | T-166, T-167 | pass |
| `39ac892` | **T-168** | **fail** |
| `9a5244a` | T-162 | fail |

The first bad merge is `39ac892`, which holds the single task commit `07572b4` "T-168: validate zone and hospital settings before storing them". Its source changes are in `src/systems/buildings/zones.ts` (34 lines: `SetZoneSetting` now rejects any key it does not know, and validates `desired_supplies`, `squad`, `owner`, `crop_per_season` and `priority`), `src/systems/plants/index.ts` and `plots.ts` (crop choice moved into one `cropChoice` helper), and `src/systems/health/` (hospital supplies).

## The two runs side by side (measured)

| | `2bbc86c` (pass) | `39ac892` (fail) |
|---|---|---|
| Living dwarves on day 112 | 12 | 3 |
| First `Starving` event | day 113 | day 48 |
| Harvests over 112 days | 79 | 79 |
| Cave crops planted, all year / in winter | 63 / 9 | 63 / 9 |
| Stock at the end: meals / plant food / drink | 0 / 0 / 2 | not read |
| Wealth | 1,731 | 1,764 |

Two things follow, and neither is explained yet:

- **Farming is not what changed.** Harvests and plantings are identical. Whatever T-168 changed sits between the harvest and the dwarf's mouth, or in what the playthrough's commands now do. A command of the playthrough that used to be accepted may now be rejected as `bad_setting`; the playthrough does not check command results (T-114, gap 9).
- **The playthrough was already at the edge.** Even the passing run ends with no meals and no plant food, and its dwarves start starving on day 113, one day after the assertions are read. So it is a fragile witness, and T-150 (the full year through the real UI) should give it a real food margin.

## What to do

1. Find the difference. Record every command result of the playthrough at both commits and compare: which commands are rejected at `39ac892` that were accepted at `2bbc86c`, and with what reason. If none differ, compare the first day on which meal or drink stock differs and what the kitchen, still and haulers were doing then.
2. Decide by the evidence:
   - **The game rejects a setting it should accept** (a key that a panel or a system really uses, a value shape that is valid): fix `SetZoneSetting`, with a regression test, and state the accepted keys in the spec.
   - **The playthrough sent a setting that never did what it meant** and the game is now right to refuse it: make the smallest change to the playthrough that says what it meant.
   - **Something else in T-168 changed behaviour** (the crop helper, the hospital supplies): fix that.
3. Verify with the six static checks, `npm test` and the whole `npm run test:e2e`.

Do not add farms or re-time the playthrough to get it green; its food margin is T-150's.

## Done

- The cause is stated with evidence from a run.
- `full-year` passes, and the whole browser suite with it.
- T-174 and T-177, parked on this, are restored and closed.

## Resolution and measurements (2026-10-09)

Case (a): a game bug in stockpile hauling. This is not a rejected zone setting and the measured bisect boundary does not establish T-168 as its cause. Instrumented runs at both `2bbc86c` and `39ac892` failed with three surviving dwarves; all 27 commands, their ticks and successful results matched, and all 111 daily stock/job snapshots matched byte for byte. The original passing and failing runs therefore sampled different execution histories. No command, fixture, farm, timing, capacity, rate or balance constant was changed.

At current master `2d6fd58`, brew job 452 was fetching on tick 98,400 (day 83), with its reserved barrel 16777244 empty and room for 20 drinks. By tick 99,600 (day 84), the job was working at progress 999 but the reserved barrel had only 9 units of room: pending food hauls had filled it even after it moved to the still. The job remained stalled until day 97; drink reached zero on day 86 despite plants and an active brewer. A later brew job hit the same fault, and all dwarves died by day 111. The unchanged playthrough passes after protecting those destinations: 12 living dwarves and 9 drinks at tick 134,400. Food margin remains separate work for T-150.

The fix excludes reserved containers during slot selection and rechecks reservation and destination-stockpile membership before a pending haul fills a container. A stale haul leaves its item on the delivery tile, releases its slot, and lets ordinary hauling reconsider it. Five task-tagged headless regressions include a real still and brewer with a pending food haul; the unmodified source fails four cases (including a brew completion timeout), while the fixed source passes all five. Existing assertions are unchanged.

The selected command/job/container evidence is saved in `reports/data/2026-10-09-t132-command-and-barrel-trace.json`. T-188's recorded open/fetching failures have not been reproduced here; this witnessed stall is at progress 999 because the output barrel is filled by unrelated hauls.
