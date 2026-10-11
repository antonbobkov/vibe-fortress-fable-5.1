# T-136 — How many dwarves wild animals cost a fortress, measured over many seeds

Closed by `T-136: measure annual wildlife survival over twelve seeds`.

**Source:** T-221, T-134 and T-135 (the browser year moved from 9 living to 8 to 6 across three correct fixes); decided by the local orchestrator, 2026-10-11 · **Size:** M · **Needs:** — · **Status:** open

## Why

`test/e2e/full-year.spec.ts` is deterministic since T-221, and for a day its count of living dwarves was used as a floor that could only go up. That was a mistake in method. One year is one sample, and the sample is chaotic: a fix that changes where one dwarf stands on day 60 re-rolls every wolf encounter after it. T-134 (a soldier now joins a fight and kills the wolf) took the year from 9 to 8, and T-135 (medics treat patients under a hearth alert, correct in its unit tests) took it to 6, with different dwarves dying on different days. Neither is evidence against either fix, and the floor would have blocked both.

The browser year now asserts only what one year can witness: the fortress is not wiped out (at least 4 alive) and nobody dies of hunger or thirst. The balance question it was being made to answer needs many seeds.

## What to do

1. **An instrument, headless, in the performance tier** (`test/perf/wildlife_year.test.ts`): a year of a fortress that plays as the browser year's script does (the same embark, the squad of three, the alert raised when a predator is near and held until it leaves, haulers kept in), on at least ten seeds across temperate forest, taiga and grassland at peril 0. Drive it by commands; no browser. Record per seed: living dwarves at the end, each death with day, cause and killer, Starving events, livestock lost.
2. **Report the distribution:** median, worst seed, and the share of seeds with no dwarf lost to wildlife. Write a dated report and the figures into `balance.md` § Wild animals and `balance-status.md`.
3. **A target the instrument asserts,** proposed: median at least 11 of 12 alive; no seed below 8; no death of hunger or thirst on any seed. If the game does not meet it today, the instrument records the measured figures as its floor with the target beside them, and T-220 (the seeds where a pack kills several) works against that floor. The floor here is a property of a distribution, so it does not move at random.
4. **Run it before and after** each fix that touches wildlife, fleeing, alerts or treatment, and put both rows in the commit body. That replaces reading one browser year.

## Related

- T-220 diagnoses the bad seeds. T-253 re-measures the earlier probes.
- Two things seen in the browser year's traces that this instrument should confirm or clear: a dwarf asleep at the wagon under a `watchful` alert is bitten and the dwarves near her flee, so nobody bandages her (the flee rule comes before work); and a `hearth` alert held for 1,900 ticks leaves a dwarf at critical hunger with the food stockpile 17 tiles outside the hall.

## Done

- The instrument runs in `npm run test:perf` and its report is filed.
- `balance.md` states the target and the measured distribution.

## Progress (2026-10-11, codex-a)

Instrument in progress: twelve distinct seeds, four each for forest, taiga and grassland, standard-size generated local maps, peril 0 and Balanced embark. The browser's commands and opening schedule are reproduced headless, with the same three farm capacities, six building placements, work-order targets, three-member squad and alert policy. Regions have a west arrival and no suppressing traits; this is a controlled wildlife instrument, not a sample of arbitrary climates or a retuned three-year fixture. Taiga's same-sized dimcap plot uses its deeper soil floor one level below the surface (forest and grassland use two); no extra farm or supply is added. The browser's wildlife response begins after the opening on day 20, and that qualification is retained for this initial measurement.

First forest seed: 10 living of 13 arrivals at tick 134400; three dwarves bled out after wolf attacks on days 100, 101 and 105; two dogs killed by wolves; nine Starving events but no dwarf hunger/thirst death. The full twelve-seed run is measuring the distribution before pinning its measured floors next to the proposed target.

## Final measurement (2026-10-11)

Both full twelve-seed runs agree on every world hash. Overall median 12.5, minimum 0, 8/12 without a wildlife dwarf death, one extinction and two deaths labelled starvation. Forest median/minimum 10/8, taiga 11.5/0, grassland 14.5/14. The proposed minimum and no-need-death target fail; the work file's accepted measured-bounds case is implemented, retaining the target beside those bounds and additionally capping extinctions and guarding the wildlife-free share. The new instrument changes no game rule or balance constant. T-260 diagnoses the two need-related deaths; T-220 uses this cohort for pack losses.

The final run records sleeping dwarves bitten with nearby dwarves fleeing, and critical need maxima during long hearth holds. The [dated report](../../../reports/audits/2026-10-11-wildlife-survival-over-twelve-seeds.md) states the evidence and its limits. Instrument: twelve seed cases passed; three accounting controls passed; `npm test`: 263 files, 2346 tests passed. No golden moved. The browser's updated survival/need-death assertions and the instrument method are folded into testing-strategy.md; target and measured distribution into balance.md and balance-status.md.
