# T-522 — The defence fortress turns back fewer raids, and nothing checks it

**Closed:** 2026-11-07, in 2fb6e1c8.

**Source:** T-503/T-510's runs ([data](../../../reports/data/2026-11-07-t503-defence-seeds.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-466 and T-504 made a well-built defence turn back raids: `defence_year_seeds` gave 7 then 8 of 8 seeds repelled, against a set rule of at least 5. On master after T-518, the same runs give 2 of 8 at the script's cadence of 20 and 4 of 8 at 25. The per-seed jobs do not check the set rule, so no gate caught it. The owner's goal (2026-11-04): a well-armed squad should be able to repel a raid.

## What to do

1. Give `defence_seeds` a verdict job, like the sweep and the instrument: it reads the eight rows and fails if fewer than the set rule's seeds end with every announced raid repelled or wiped. Consider pooling more than one cadence or shift if the noise calls for it.
2. Find when and why the repel rate fell (bisect over T-504, T-508, T-509, T-512, T-518 and later merges with the new verdict), journal one raid that now loots, and name the cause.
3. Fix it the plainest way: a script fault in `defence_year_fortress.ts`, or a game rule. Do not weaken raids in general: the twenty-seed sweep verdict must still pass.
