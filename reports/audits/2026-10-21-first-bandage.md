# Measurement: the first bandage decides a serious wound

**Task:** T-405 · **Date:** 2026-10-21 · **Commit examined:** master `f3a2245` (before) and `f3a2245` with the T-405 change (after); `src/` is the same at `4639c81` · **Kind:** re-measure of [wound recovery](2026-10-21-wound-recovery.md) after a rule change; no constant, formula or content value was changed · **Source:** [the first bandage decides a serious wound](../../docs/archive/tasks/T-405-first-bandage-decides-a-serious-wound.md)

## The answer

- **A serious wound no longer kills in a ward with a medic.** Two rules changed: `stop_bleeding` never fails, and a bleeding patient is bandaged where it lies (a conscious one waits on its tile, an unconscious one is not carried, for at most `RESERVE_KEEP_TICKS` after the wound while a medic can come). At one wound a day under a skill-5 medic, serious-cut deaths fall from **6 of 30 to 0**, serious punctures from 5 to 0, grievous fractures from 2 to 0.
- **A grievous cut still kills one patient in five**: **16 of 30 to 6** under the skill-5 medic, below the floor ward's 7 before the change (3 now). It bleeds 6 a health tick and puts a dwarf down in about 300 ticks; the first bandage now comes at a median 309 ticks (380 before).
- **The first bandage comes sooner everywhere**: a median 286 to 375 ticks under the skill-5 medic (365 to 501 before), and 521 for a serious fracture (633). The floor ward is still faster for a serious fracture (263); this run does not say why.
- **At skill 0** the same holds: serious cuts 7 to 2 (both of infection), punctures 8 to 0, grievous cuts 18 to 8.
- **Under load, infection is now the killer.** One wound every 400 ticks: serious-cut deaths 18 to 10, but all ten are infection (9 bled out before, none now); grievous cuts 24 to 15 (bled out 23 to 12). A medic with three new patients a day sutures and cleans late. Filed as [a loaded ward's serious cuts die of infection](../../docs/work/T-411-loaded-ward-dies-of-infection.md).
- Discharge and healing times barely move, except at skill 0, where a serious fracture leaves the hospital in 1.1 days instead of 3.7 and a serious burn in 4.0 instead of 4.8.

## What was run

The ward probe of the earlier measurement, unchanged: `reports/data/2026-10-21-wound-recovery.probe.ts.txt`, copied to `test/perf/` and run with `npx vitest run -c vitest.perf.config.ts`, summarised by `…-wound-recovery-summary.mjs.txt`. A stepped hospital on `flat-test` with 40 beds (none in the floor case), a stocked chest, one medic, two haulers and thirty patients, each given one wound through `DamageDealt`. Cases `med5`, `med0` and `med5-floor` at one wound every 1,200 ticks (`T367_GAP=1200`, `T367_DAYS=60`), and `med5` at one every 400 ticks for the serious cut, grievous cut and serious puncture. The before rows at `f3a2245` reproduce the earlier report's figures (taken at `a5cd51c`) to within one tick of median bandage time. The summaries of both runs are in [`2026-10-21-first-bandage.json`](../data/2026-10-21-first-bandage.json).

## One wound a day, 30 patients a case: died, before → after

| Wound | Medic 5 | Medic 0 | Medic 5, no beds | First bandage, median ticks (medic 5) | Unconscious (medic 5) |
|---|---|---|---|---|---|
| Light cut (9) | 0 → 0 | 0 → 0 | 0 → 0 | 382 → 286 | 0 → 0 |
| Serious cut (21) | **6 → 0** | 7 → 2 (infection) | 2 → 0 | 365 → 315 | 6 → 0 |
| Grievous cut (36) | **16 → 6** | 18 → 8 | 7 → 3 | 380 → 309 | 27 → 18 |
| Serious puncture (21) | 5 → 0 | 8 → 0 | 2 → 0 | 432 → 320 | 17 → 1 |
| Serious fracture (13, leg) | 0 → 0 | 0 → 0 | 0 → 0 | 633 → 521 | 1 → 0 |
| Grievous fracture (22, leg) | 2 → 0 | 6 → 1 | 0 → 0 | 501 → 375 | 8 → 0 |
| Serious burn (13, arm) | 4 → 2 (infection) | 6 → 3 (infection) | 0 → 0 | 400 → 342 | 1 → 0 |

Failed treatments: `stop_bleeding` failed 2 to 12 times a case before and never after; the other treatments fail as before (2 to 18 a case at skill 5).

## One wound every 400 ticks, medic 5: died (bled out, infection), before → after

| Wound | Died | Infected | First bandage, median ticks |
|---|---|---|---|
| Serious cut | 18 (9, 9) → 10 (0, 10) | 11 → 18 | 514 → 351 |
| Grievous cut | 24 (23, 1) → 15 (12, 3) | 2 → 5 | 365 → 289 |
| Serious puncture | 17 (14, 3) → 13 (4, 9) | 7 → 13 | 469 → 393 |

## Annual wildlife instrument

Before (`4639c81`, the T-410 row, not re-run: `src/` there is the same as at `f3a2245`, where a run for this task on the earlier fixture matched the T-410 before row seed for seed, world hashes included): median 12.5, worst 2, second-worst 8, living 139, wildlife-free 7, extinct 0, hunger/thirst 0. After (`4639c81` with this change, [rows](../data/2026-10-21-t405-wildlife.json)): **median 13, worst 2, second-worst 8, living 140, wildlife-free 8, extinct 0, hunger/thirst 0**. Ten seeds end with the same world hash; forest seed 3's dwarf that bled out on day 108 lives (12 to 13), and taiga seed 3 changes its hash but not its eleven deaths. Every guarded figure holds or improves.

## What this does not measure

- A fight's wounds, several to a dwarf and to several dwarves at once, with the medic also fighting or sheltering.
- A patient who waits on its tile in the open during a `hearth` alert; the flee rule is unchanged and pinned by a unit test, but no fight was staged here.
