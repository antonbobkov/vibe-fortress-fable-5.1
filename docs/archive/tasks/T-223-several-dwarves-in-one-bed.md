# T-223 — Several dwarves sleep in one bed at the same time

Closed by `T-223: beds hold one sleeper or patient`.

**Source:** T-134 (`docs/archive/tasks/T-134-soldier-need-interruptions.md` § Findings) · **Size:** S · **Needs:** — · **Status:** open; decided 2026-10-11, see Decision

## Why

A dwarf going to sleep without a bedroom takes the nearest reachable bed from `buildings.freeBeds()`. That list excludes only beds in owned bedrooms (14 § Ownership); it does not exclude a bed in which another dwarf already sleeps, and the plan reserves nothing. So several dwarves sleep on one bed tile at once while other beds stand empty.

## Reproduction

`hospital_run` (seed `hospital-run-4`) on `cloud/main` `d36dd19`: at ticks 5400–5500 dwarves 16777275, 16777279 and 16777281 are all in `need`/`sleep` on tile (41, 6), one bed; 16777279 and 16777281 wake at tick 5502 with `Slept { onFloor: false }`. On `cloud/T-134` at tick 6000 dwarves 16777276, 16777278 and 16777281 sleep on the same tile; a fire lit there burned all three (T-222, item 3).

## What the spec says

10 § Sleeping: "own bed (assigned bedroom), else any unassigned free bed, else the floor of the hearth hall". 14 § Ownership: "`freeBeds` excludes beds inside owned bedrooms." Whether "free" also means "not slept in now" is not stated; the code reads it as "unassigned" only.

## What to do

Decide, by the ambiguity protocol, whether a bed holds one sleeper. The conservative reading of "free" is "unassigned and not in use": a sleeper (or a dwarf walking to sleep there) holds its bed until it wakes or gives up, and the next dwarf takes the next free bed, else the hall floor. Write the rule into 10 § Sleeping and 14's `freeBeds`, implement it with a saved hold, and pin it with a stepped-world test of two tired dwarves and two beds.

## Done

Two dwarves who go to sleep together sleep in two beds; the test names T-223; goldens that move are named in the commit.

## Decision (2026-10-11, local orchestrator, under the owner's standing instruction to use judgement; the owner was told and may overrule)

**A bed holds one sleeper.** The conservative reading stands, as the task proposes: a bed is free when it is unassigned and not in use. A dwarf that is asleep in a bed, or walking to one it has chosen, holds it until it wakes, gives up or dies. The next dwarf takes the next free bed, else sleeps on the floor of the hall with the floor's penalty. Hospital beds follow the same rule: one patient per bed, and a tired medic does not get into a patient's bed.
