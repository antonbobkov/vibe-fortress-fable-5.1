# T-132 — The year-long browser playthrough starves since T-168

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
