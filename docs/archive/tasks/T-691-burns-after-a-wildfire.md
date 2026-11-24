# T-691 — A wildfire's light burns go uncleaned and kill by infection

**Closed:** 2026-11-24, in 5111f947,ad5a8386.

**Source:** T-665 and T-668's report (`reports/data/2026-11-22-t665-t668-flux-and-peril2-steel.md`, on `t665-flux-steel`) · **Size:** M · **Needs:** — · **Status:** done

## Why

T-665/T-668's sweep (`45410693300`) had 64 infection deaths against master's 29 (T-666's sweep `45037122991`, the same game but for the script), 41 of them on two timelines, and its pooled deaths (137) broke the bound (132.5). Both were traced with `test/perf/t668_wound_probe.test.ts`: a lightning strike outdoors (`three-years-p4-1` at shift 0, day 255; `three-years-p2-1` at shift 0, days 285 to 288) lit a surface fire that gave the fortress's dwarves 126 and 64 light burns. A light burn admits no one, but it is rolled for infection until it is cleaned (17 § Infection), and the medics could not clean them: `clean_wound` stood `blocked: no_tool` (no bucket, `p2-1`) and then `missing_input` (no brightleaf for an infected wound), `dress_burn` `missing_input` (no cloth), for weeks. Ten to twelve burns took infection a day and 25 and 16 dwarves died of it over the next 75 and 45 days. Master's timelines of the same seeds had the lightning but no such fire among the dwarves; which timeline catches its dwarves in a wildfire is chance, but a fortress of thirty with three buckets and no brightleaf loses a third of itself to one.

## What to do

Find what a player would keep for this (buckets by the hospital and the well, brightleaf gathered and kept, cloth beside the beds' share) and whether 17 should answer a mass burn differently (a light burn cleaned with water alone and no medic, a burn rolled for infection only when it is serious, a medic's cleaning of light wounds batched), and measure the infection deaths on the sweep.

Spec: 17 § Infection, § Patients and hospitals; 05 § Fire; the three-year script's hospital supplies.

## Done

- [x] The rule (17 § Infection): a light burn is never rolled for infection and asks for no cleaning; it is still dressed (the dressing halves its pain). A serious or grievous burn, and every cut and puncture, as before. Water-only or batched cleaning was weighed and not taken: once a light burn cannot be infected, a mass of them waits on nothing. `test/unit/health/t691-light-burn-infection.test.ts`.
- [x] The script: the carpenter keeps three buckets (`make_bucket` maintain 3, ahead of the barrels) for the medics' cleaning and the patients' water. Brightleaf and cloth unchanged: brightleaf now cures only cuts' and serious burns' infections, and the cloth needs a loom the script does not run.
- [x] `hospital_run` got its `clean_wound` only from its light burns; it now stages a light cut that clots before its bandage.
- [x] The infection deaths after a wildfire, before and after, on the two traced timelines (`t668_wound_probe`, days 215 to 340, on T-665's branch merged with this one; the probe counted no dwarf deaths, so it was replayed with the dead dwarves remembered): `three-years-p4-1` at shift 0, 126 light burns, 45 infections, **24** infection deaths → with the rule alone 141 light burns, 0 infections, **0** infection deaths (bled out 3 → 5, killed 1 → 1); `three-years-p2-1` at shift 0, 64 light burns, 30 infections, **16** → 59 light burns, 0 infections, **0** (bled out 5 → 6, killed 4 → 4). With the bucket order too both timelines part before the fire and no fire reaches the dwarves (0 burns, 0 infections; 2 and 0 dwarf deaths).
- [x] The sweep (`45439262137`, at `ad5a8386`): pooled 1124 living, 112.5 deaths, verdict pass (master, T-686's `45413363867`: 1097, 122.75). Infection deaths over the 80 runs 30 → 14; bled out 322 → 271, killed 136 → 162, starvation 2 → 1.
