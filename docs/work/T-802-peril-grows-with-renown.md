# T-802 — Peril grows with renown

**Source:** T-793-late-game-idle (playtest 7, [report](../../reports/data/2026-11-26-playtest-7.md), finding 6), its option 3 · **Size:** M (a balance change and a sweep) · **Needs:** — (owner decided 2026-11-28) · **Status:** open

## Why

Peril 2 sends the same Gloam raid of 16 a year from Year 2 to Year 6. The playtest's fortress was "fair and safe, but dull" from Year 4: one raid a year, always a horde, looted while the fortress sat locked in, and never a siege. T-793 took the two parts of its finding that need no balance call (the hearth hall relieves purpose; a hint at the population cap names the sinks). This third one changes the threat schedules, so it is the owner's choice.

## Owner's decision (2026-11-28)

Adopted: "Lower peril should just mean powerful raids come later than sooner." Peril sets how soon the stronger threats come, not whether: a settled, renowned fortress at peril 2 meets the next perils' kinds (sieges, bigger bands) later than one at peril 3 or 4 would, but it does meet them.

## What to do

- A renown above 60 (Year 4 in the playtest) adds the next peril's kinds (a siege) or its band sizes to the schedule (18 § Schedule).
- Measure on the three-year sweep at peril 2 extended to six years: deaths, living, raids turned back, and the defence check. T-793's six-year probe (`test/scenarios/t793-probe.test.ts` on the branch `t793-probe-base`; its work file says how it was run) is a starting point.

## Decisions (the agent, 2026-11-28)

The rule is 18 § Schedule peril; these are the choices behind it.

- **Step through thresholds, not a single switch and not a blend.** The schedule reads the rows of the *schedule peril*: the region's peril plus one per `RENOWN_PERIL_STEP` (60) of renown, at most 4. So renown 60 reads the next peril's rows (the proposal's rule) and renown 120 the one after. A blend of band sizes was rejected because it could not bring a new kind (a siege) and would give rows that no table states. In practice 120 is out of reach: playtest 7's fortress held about 74 at Year 7.
- **Hysteresis.** A step is lost only `RENOWN_PERIL_FALL` (10) below its threshold. This keeps a renown that wavers about 60 from turning sieges and the panel's preview on and off. A fortress that loses its wealth or its people does step back down, which gives a beaten fortress some relief. It is not a ratchet.
- **What a step changes.** Every kind's interval, `base`, `perRenown`, `max` and warning come from the new row. A kind already possible keeps its first date and its next roll. A kind that becomes possible is first possible from the later of its row's `earliest` and the day of the step, with its first roll drawn as at embark (1 to `min(intervalMin, 20)` days). The row's `earliest` still holds, so a peril-2 fortress that reached 60 in Year 2 would get no siege before peril 3's Spring of Year 3. A kind that a fall stopped keeps its next roll, and on a later rise it takes whichever is later, that roll or a fresh one, so wavering cannot bring a second siege early.
- **Makeup by the schedule peril, gear by the region's.** Trollkin and hexers read the schedule peril (`HEXER_FIRST_YEAR` is the "first year by peril" row the siege-breaker proposal will copy, with a renown floor). The gear tier stays at the region's peril, so renown brings the Gloam sooner and in greater numbers, not better armed. The passes stay closed in winter at a region peril ≤ 2, now for sieges as well as raids. That changes nothing that existed before, since no siege came at peril ≤ 2.
- **Peril 0.** A `serene_vale` never steps: it keeps thieves only, at the peril-0 row, as its trait promises ("peril fixed at 0"). The sweep's peril-0 seeds are all `serene_vale`. A plain peril-0 region does step, to peril 1 (small raids, at most 12), following the owner's rule that a lower peril means later, not never. This also matches the siege-breaker proposal ("peril 0 … nothing in serene_vale").
- **The player can read it.** A rise is an alert, `PerilRose` ("Word of the fortress's riches has spread. The Gloam will come as they do at peril 3: more often, and more of them."). A fall is silent. The Threats panel's line under the peril names the next threshold or the step taken. The schedule preview gains a Sieges row, which it never had: peril 3 and 4 sieges were never previewed.
- **Saves.** `renownStep` is saved only when it is above 0. A load reads that peril's rows, then the saved ticks. An older save loads at step 0 and steps on its next day, if its renown allows.

## Done

- [x] The owner's decision recorded here and in 18.
- [ ] If adopted: the rule in 18 § Schedule, its sweep and defence figures before and after.
