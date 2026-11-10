# T-543 — The sweep's dwarf deaths drift up across merges that each pass

**Closed:** 2026-11-10, in 8034778b,c169e32c.

**Source:** the orchestrator, 2026-11-10 · **Size:** M · **Needs:** — · **Status:** open

## Why

Pooled dwarf deaths in the twenty-seed sweep rose across today's merges while every verdict passed: 132.75 (T-535), 146 (T-538), 150.75 (T-539), 142.25 (T-540, measured without T-539), 154.25 (T-541, measured with T-539). The bound is 155.25. `SWEEP_REFERENCE` (20 / 7 / 0 / 948.5 / 125.25) predates all of them. In T-539's and T-541's runs, raider kills rose from 366 to 430, and no raid code changed.

## What to do

1. Use the sweep logs to attribute the rise since T-535, by killer and by merge: raids, wolves and bears, or noise. Is the raid rise real and has a mechanism, or is it timeline noise? Check against more than one sweep, and rerun a base commit if that helps.
2. If one cause is plain and fixable in the three-year script or in a wrong game rule, fix it, with a test. A script that plays like a sensible player is fair. Making raiders or animals weaker is not.
3. If the new level is the honest cost of the rules, say so in a dated report under `reports/audits/`. Propose a refreshed `SWEEP_REFERENCE` and bounds with the evidence.

## Done

- The rise is attributed, with the evidence.
- The cause is fixed with a test, or a report says why the level is honest, and the reference and bounds are refreshed from it.

## Outcome

[The report](../../../reports/audits/2026-11-10-t543-sweep-deaths-drift.md) and [the deaths by killer](../../../reports/data/2026-11-10-t543-deaths-by-killer.txt) give the evidence.

- **Eight shifts each, before and after.** Master `48b754d1` (after T-535) and master `6e6a6ec3` (after T-541) were each swept at shifts 0 to 350. Pooled deaths per sweep went from 134.38 to 146.38 (+12) and living from 939.75 to 882.25.
- **Raids did not move.** Raid deaths went from 104.25 to 101.63, and raid parties were the same in every run. The raider rise from 366 to 430 was two high draws: T-539's and T-541's runs were the highest of twelve, at 111 and 115.5 a sweep. No mechanism linking wildlife to raid deaths shows in the data.
- **Wild animals did.** Wild deaths went from 22.75 to 41.63 a sweep, four standard errors. By merge: T-538 +15 (+25 with the old script), T-539 −8, T-540 about +11 (noise and closeness wake sleeping wolves and bears near dwarves), T-541 none visible.
- **Nothing plain to fix.** A probe of the fights (run 42903590270) found that 86 of the 96 dwarves killed by wolves and bears were struck first by the animal. For 62 of those 86, no alert was up at the first blow. Most bled out within a quarter of a day. The rules do what 08 says, and an answer after the first blow comes too late. Hunting bears before they maul is a tactical choice, not a fix. It is filed as [T-544-bear-mauls-unanswered](../../work/T-544-bear-mauls-unanswered.md).
- **Reference refreshed.** `SWEEP_REFERENCE` is now master `6e6a6ec3` at shifts 0 to 150 (run 42872065870): 19.75 / 7 / 0.25 / 886 / 147. `SWEEP_MEASURED` is that master's 8-shift means, 882.25 living and 146.38 deaths. The bounds are 782.25 and 176.38. The old best, 125.25, was a low draw, and today's level sat about one standard error under its bound.
