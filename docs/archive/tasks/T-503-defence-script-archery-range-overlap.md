# T-503 — `defence_year`'s script zones an archery range over a tile another zone holds

**Closed:** 2026-11-07, in 95560fa1.

**Source:** T-466 ([report](../../../reports/audits/2026-11-05-t466-defence-repels-a-raid.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

`checkDefenceWorks` in `test/scenarios/defence_year_fortress.ts` creates the archery range from the archery target's origin and up to four tiles beside it. It checks the neighbours for another zone but not the origin itself. On `defence-year-6`, with the script looking every 25 ticks instead of 20 (a change that moves only the job timeline), a zone had taken the target's tile first, and the command was refused on tick 75,976: `CreateZone rejected (overlap): {"zoneType":"archery_range","tiles":[60167]}`. `script-commands.ts` throws on that rejection, so the run stops. At the script's own cadence no seed of the eight hits it.

## What to do

- Make the script place the target only on a tile no zone holds and will hold (or choose another site when the origin is taken), so the range never overlaps.
- A test: the script on `defence-year-6` with `watchEvery: 25` plays its two years (`DEFENCE_WATCH_EVERY=25 DEFENCE_SEEDS=defence-year-6`, `test/perf/defence_year_seeds.test.ts`, or `measure.yml` suite `defence_seeds` with `watch=25`).

## Done

- The seed plays through at both cadences, and `defence_year_seeds` gives eight rows at cadence 25.
