# T-604 — The three-year script answers the Thane in its first year

**Closed:** 2026-11-18, in 8b87d014.

**Source:** [T-602](T-602-whims-the-fortress-cannot-meet.md) (the reach probe on its branch at 0e82a55c, Measure run 44364933808, the twenty sweep seeds at shift 0: 85 of 177 whims met, all of them from the second year) · **Size:** S · **Needs:** — · **Status:** open

## Why

Since T-602 the Thane wishes only for what the fortress could make from what it has, and in the three-year fortress that is almost always fine meals or something strong. The script answers both, but only from the second year (`MAKING_DO_FROM_DAY` in `test/scenarios/three_years_making_do.ts`), so that the first year the sweep measures is played as it was before T-588. The two whims of the first year (drawn on days 57 and 85) are missed on nearly every seed: about forty of the hundred and eighty whims over the twenty fortresses.

## What to do

Answer the whims of fine meals and spirits from the first day (the kitchen's fine meals first, the batch of deepfire ahead of the brew, the share set aside), keeping the rest of the Making Do strand where it starts. Measure the whims met with the reach probe (`gh workflow run measure.yml --ref <branch> -f suite=making_do`), and run the sweep: the first-year rows (alive at year 1) are the ones to watch. If the sweep's reference moves, take the new reference by the sweep's rule.

## Done

The script answers the first year's whims, the probe's whims met before and after, and the sweep's verdict.

## Measured

The reach probe (`making_do`, the twenty sweep seeds at shift 0; it now lists each whim judged with its day): whims met 85 of 177 before (run 44388633222, on d53e9a0b, the probe change alone), 0 of the 56 judged by the second year's first day; 132 of 192 after (run 44389430549, on 8b87d014), 34 of 59 by then (17 of 28 fine meals, 17 of 31 spirits), and a whim met in all 20 fortresses (18 before). The sweep's year-one rows did not move beyond their noise: alive at year 1 pooled 20 (19.5 on T-602's 0e82a55c), the twenty fortresses' dwarves at year 1 295.75 a sweep (285.5).
