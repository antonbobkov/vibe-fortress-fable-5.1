# T-NEW — The hand-laid defence of `defence_year` does not repel a raid

**Source:** T-462 ([measurement](../../reports/audits/2026-11-01-defence-year-noise.md)) · **Size:** M · **Needs:** — · **Status:** open (measurement first)

## Why

`defence_year` builds a kill corridor with walls, fortifications, three traps, a drawbridge on a lever and a trained squad. In the four runs with party detail, the 3 bandits and the raid of 9 or 10 ended `looted` every time. Raiders dead in a run are 1 to 5 of about 17 who came. A party was `repelled` in 8 of 12 runs, and in the runs with detail it was never an announced one.

Nothing yet says whether the fault is the script's use of the defence, the rule for what counts as looting, or a defence that cannot do this at peril 2.

## What to do

1. **Journal the raid of one seed:** where its members went, what the traps and the bridge did to them, where they took their loot from, and how long the squad fought.
2. **Name the cause.** A fault gets a failing test and a fix. A balance cause goes to the orchestrator with the rows.

## Done

- A report with the journal and the cause.
- If the answer shows a raid can be repelled, `defence_year` may assert it by a set rule, with its noise measured.
