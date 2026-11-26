# T-754 — The Population panel's last skip shows a raw reason code, and Year 1's guaranteed wave reads "Eligible: no"

**Closed:** 2026-11-25, in 57f54af8,78950ee0,b27b2c60,83cf17be,a5cbad28,ad7ef300,67a6870b.

**Source:** T-750 (the wealth bar) · **Size:** S · **Needs:** — · **Status:** open

## Why

While adding the wealth figures to the Population panel (`src/ui/panels/population.ts`), two older readings showed up:

- "Last skip: {reason}" is filled with 21's reason code as it is: "Last skip: luck", "Last skip: spirit", "Last skip: cap", "Last skip: winter". Only the wealth skip now reads as words with its figures ("Last skip: wealth (4,100 of 6,000 ☼)"). The skip line in the log already has words for every code (`announce.immigration_skipped.reason.*`).
- After the summer cousins of Year 1, `immigration.eligibility()` is computed for the current season, which is no longer a guaranteed one, so the panel reads "Eligible: no · hall spirit below Content" although the autumn wave is guaranteed and comes whatever the spirit (`test/unit/ui/t332-panel-population-wave.test.ts` pins this text). `immigration.wealthBar()` already looks at the evaluation to come and asks nothing for a guaranteed wave.

## What to do

Decisions:

- **The last skip reads in words**: `ui.population.skip.<code>` strings ("no one set out", "hall spirit below Content", "population cap reached", "winter pass closed", "a raid was under way"), the code itself only for an unknown one.
- **Eligibility answers for the evaluation to come**: before Year 1's guaranteed autumn wave the line reads "Eligible: yes · the cousins are coming" (or the panel's existing "Immigration paused by cap" when the cap holds it).

Spec: `ui-screens/panels.md` § Population; 21 § Reader (`eligibility()` — for the evaluation to come).

## Done

- [x] Tests (`describe` with the task id): a luck skip reads "Last skip: no one set out", and the other codes in words, an unknown one as it is; after the summer cousins the panel reads "Eligible: yes · the cousins are coming" with the autumn wave guaranteed (`test/unit/immigration/t754-population-skip-words.test.ts`). The T-332 panel test's eligibility rows are updated.
- [x] UI only: `eligibility()` gained `guaranteed` and an optional `at` (`{ season, year }`); with none it answers for the evaluation to come, the one `wealthBar()` reads. 21's own evaluation computes as before. The three-years measurement harness, which read the reader at each evaluation, now asks for that evaluation with `at` (before, at a deferred evaluation, it read the current season's). Equality assertions on the reader's result gained `guaranteed: false` (im_cap, im_threshold, t652). No sweep.
