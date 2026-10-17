# T-387 — Peril-2 fortresses of the economy fixture die out in year 2

**Source:** the peril-2/4 sweep of 2026-10-17 at `3b75d98`, [data](../../reports/data/2026-10-17-t381-peril-2-4-sweep.json) · **Size:** M · **Needs:** — · **Status:** open

## Why

The four peril-2 seeds that pass their invariant checks all die out: `p2-6` on day 104, `p2-4` on day 139, `p2-5` on day 157, `p2-3` on day 236. Their dwarf deaths are mostly bleeding and killing (fights with raiders, thieves and wild animals: 35 bled out, 12 killed), with 16 starvation deaths in `p2-3` and `p2-5` (starvation is not asserted at peril 2). At peril 4 three of the five seeds that pass are alive at the end (46, 37 and 10 dwarves). The peril-2 raids are smaller (7–9) than peril 4's (11–24), and both perils take the anvil in the wagon, so why the smaller threat ends more fortresses is the question.

T-381 (raid sizes at peril 2) needs living peril-2 fortresses, and `balance.md` expects a competent fortress to handle a raid of ten at peril 2 with a squad of three in mail.

## What to do

1. Diagnosis first, from the data and one probe run of `p2-4` (about 13 minutes): when each dwarf dies, of what and to whom; when the squad was armed and in mail; how many of each raid's members died; the food and drink stocks before the starvation deaths.
2. Decide whether the fixture plays the defence a player would (arming, the gate, the alert, the hospital) or the model is wrong for peril 2, and file the fixture change or the model change.

## Done

- The cause is named in this file, and the change that follows is filed or made.
