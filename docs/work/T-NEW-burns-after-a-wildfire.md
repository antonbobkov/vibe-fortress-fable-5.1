# T-NEW — A wildfire's light burns go uncleaned and kill by infection

**Source:** [T-665 and T-668's report](../../reports/data/2026-11-22-t665-t668-flux-and-peril2-steel.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-665/T-668's sweep (`45410693300`) had 64 infection deaths against master's 29 (T-666's sweep `45037122991`, the same game but for the script), 41 of them on two timelines, and its pooled deaths (137) broke the bound (132.5). Both were traced with `test/perf/t668_wound_probe.test.ts`: a lightning strike outdoors (`three-years-p4-1` at shift 0, day 255; `three-years-p2-1` at shift 0, days 285 to 288) lit a surface fire that gave the fortress's dwarves 126 and 64 light burns. A light burn admits no one, but it is rolled for infection until it is cleaned (17 § Infection), and the medics could not clean them: `clean_wound` stood `blocked: no_tool` (no bucket, `p2-1`) and then `missing_input` (no brightleaf for an infected wound), `dress_burn` `missing_input` (no cloth), for weeks. Ten to twelve burns took infection a day and 25 and 16 dwarves died of it over the next 75 and 45 days. Master's timelines of the same seeds had the lightning but no such fire among the dwarves; which timeline catches its dwarves in a wildfire is chance, but a fortress of thirty with three buckets and no brightleaf loses a third of itself to one.

## What to do

Find what a player would keep for this (buckets by the hospital and the well, brightleaf gathered and kept, cloth beside the beds' share) and whether 17 should answer a mass burn differently (a light burn cleaned with water alone and no medic, a burn rolled for infection only when it is serious, a medic's cleaning of light wounds batched), and measure the infection deaths on the sweep.

Spec: 17 § Infection, § Patients and hospitals; 05 § Fire; the three-year script's hospital supplies.

## Done

The infection deaths after a wildfire before and after, on the two traced timelines and the sweep.
