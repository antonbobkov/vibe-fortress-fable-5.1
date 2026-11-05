# T-466 — The hand-laid defence of `defence_year` does not repel a raid

**Source:** T-462 ([measurement](../../reports/audits/2026-11-01-defence-year-noise.md)) · **Size:** M · **Needs:** T-483 · **Status:** blocked (needs T-483)

## Why

`defence_year` builds a kill corridor with walls, fortifications, three traps, a drawbridge on a lever and a trained squad. In the four runs with party detail, the 3 bandits and the raid of 9 or 10 ended `looted` every time. Raiders dead in a run are 1 to 5 of about 17 who came. A party was `repelled` in 8 of 12 runs, and in the runs with detail it was never an announced one.

Nothing yet says whether the fault is the script's use of the defence, the rule for what counts as looting, or a defence that cannot do this at peril 2.

## What to do

1. **Journal the raid of one seed:** where its members went, what the traps and the bridge did to them, where they took their loot from, and how long the squad fought.
2. **Name the cause.** A fault gets a failing test and a fix. A balance cause goes to the orchestrator with the rows.

## Done

- A report with the journal and the cause.
- If the answer shows a raid can be repelled, `defence_year` may assert it by a set rule, with its noise measured.

## Decision (the owner, 2026-11-04)

"Yes, a well-armed squad should be able to repel a raid." A decisive defence is a goal, not a lucky outcome.

- **Target:** with the hand-laid defence of `defence_year` (walls, fortifications, traps, a drawbridge on a lever, a trained squad), most peril-2 raids end `repelled` or `wiped`, not `looted`. Write the target as a set rule once its noise is measured; a first aim is a majority of seeds.
- **Order:** journal one raid first and name the cause (the script's use of the defence, the loot rule, or raid morale and defence strength). Fix a fault before any tuning. Tune the plainest lever that matches the cause: when a party counts as having looted, how its retreat on losses works, or what the defence does.
- **Do not make raids toothless.** A raid against a fortress with no defence, or an untrained squad, should still loot; the three-years survival file and its set rule must hold, and the defence must have to be built and manned to win.
- **Measure after T-483**, because careless raider archers already weaken raids.
