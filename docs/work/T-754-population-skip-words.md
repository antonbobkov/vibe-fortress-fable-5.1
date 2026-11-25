# T-754 — The Population panel's last skip shows a raw reason code, and Year 1's guaranteed wave reads "Eligible: no"

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

- [ ] Tests (`describe` with the task id): a luck skip reads "Last skip: no one set out"; after the summer cousins the panel reads "Eligible: yes" with the autumn wave guaranteed. Update the T-332 panel test's eligibility rows and list it under `Expectations changed:`.
- [ ] UI only (the reader is read by the panel alone). No sweep.
