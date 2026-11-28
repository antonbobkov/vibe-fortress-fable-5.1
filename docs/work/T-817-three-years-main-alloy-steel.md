# T-817 — three_years_main makes no alloy steel

**Source:** T-810 (`three_years_main` runs 46099451914 on `master`, 46099449775 and 46072704388 on the T-810 branches) · **Size:** M · **Needs:** — · **Status:** open

## Why

`three_years_main` fails on `master` (at least since 4c8e61d7), in `test/scenarios/three_years.scenario.ts:286`. The assertion "alloy_steel completed through normal jobs: expected 0 to be greater than 0" fails because seed `three-years-p0-3` completes no `alloy_steel` job in three years. The T-810 runs fail in the same place, with and without the trader hold, so T-810 is not the cause.

## What to do

- Find when the main fortress stopped making steel: bisect over the recent merges, on GitHub with `gh workflow run measure.yml -f suite=three_years_main`.
- Then fix the cause, or, if a balance change made steel unreachable on this seed, record that and change the witness as the ambiguity protocol says.

## Done

- [x] The cause found and fixed, or the witness changed with its reason.
- [x] `three_years_main` green on GitHub (run 46131813738).

## Findings

- **Seed `three-years-p0-3` at shift 0 of the sweep is the main scenario's game** (identical figures at ee41d537: sweep 46090218732 against main 46099451914), so the sweeps' per-seed logs date the break without new runs. `alloy_steel` on that seed: 1 at 73db6406 (main 43917024320), 3 at 20f4297c (T-606, sweep 44428448217); 0 at 5d0d1ad2 and 2b57e3da (T-619/T-620, sweeps 44550544871 and 44563920219), and 0 at every later master base sampled (b9cbb113, 9a13599a, 4c8e61d7, ee41d537, d7332c86). `three_years_main` was not run between 2026-11-16 and 2026-11-27, so the break went unseen.
- **Breaking commit: T-620's merge e5f15aa1** (2b57e3da), which made the smelter smelt the map's coal "after the steel, before the iron"; T-642 (b9cbb113) reordered it "first while the fuel under a roof is short", which kept it broken on this seed by another route.
- **Mechanism.** The peril-0 fortress never works below: its wood furnace and smelter stand on the surface with its 40 charcoal. The script's fuel test (`fuelIndoors`) counted only fuel under a roof, so it read 0 all of year 3 (probe: `fuelIndoors 0, smelterOut true, furnaceOut true`), and `keepCoal` kept both coal orders first. Lignite ore kept coming, so the smelter smelted lignite (37 jobs) ahead of the iron; the few iron bars it made went to the forge's standing iron orders before a steel job could start, and the 30-bar alloy order made nothing while 160 iron ore lay unsmelted.

## Decision

The scenario's player is wrong, not the game: the smelter takes its first runnable order, and the forge takes free iron bars, as 12 says. A player who sees 40 charcoal beside a surface smelter does not call the fuel short. The fuel test now counts the fuel on the smelter's side of the gate (`fuelToHand`): under a roof for a smelter below (T-642's locked-gate case unchanged), every bar for a smelter on the surface. The `alloy_steel > 0` witness is kept as it is. No game rule, world hash or golden moves, so no paired sweep; the peril-0 sweep seeds play the same script and may move (their smelters stand on the surface too).

## Result

- `three_years_main` at 3bf4e2af, locally and on GitHub (run 46131813738, success): passed, `alloy_steel` 1, `smelt_hematite` 46, coal smelts 1, no dwarf death, 80 dwarves at the end. The year-3 order list is now alloy, iron, coal.
- The margin is thin (one bar, the same as the pre-T-620 runs' lowest): the open steel jobs lose their iron bar to the forge's standing iron orders. That race is a separate task (`T-NEW-peril0-steel-race.md`).
