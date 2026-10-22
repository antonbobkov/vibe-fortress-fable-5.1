# Measurement: one infection roll a day per dwarf (not taken)

**Task:** T-420 · **Date:** 2026-10-22 · **Commit examined:** `1d25311` (master with T-419 and T-418; before) and `1d25311` with one infection roll a day per creature (after) · **Kind:** trial of a rule change, measured and not taken; nothing in the game changed · **Source:** [a light burn admits no one](2026-10-22-light-burn.md)

## The answer

- **Not taken.** The rule was adopted only if p4-2 came back with margin (at least 3 alive at day 112), every peril seed stayed alive at year 1, and the instrument held. p4-2 stays dead at day 112 (0 → 0: 4 infection, 9 bled out, 2 killed), and p2-2 falls from 6 to 1.
- **The trial rule:** each day a creature with any exposed wound (a cut, puncture or burn not cleaned, sutured or bandaged, a day old) rolls `INFECTION_PERMILLE` once, and a hit infects the first such wound. It changes nothing where a dwarf has one wound: the ward's one-wound patients give the same figures to the tick. It matters only for a dwarf with several exposed wounds, which is p4-2's fire.
- **p4-2 is dead again on master.** With T-418 (no self-treatment) on top of T-419, before this trial, p4-2 ends year 1 with no dwarf: 15 deaths (3 infection, 7 killed, 4 bled out, 1 starvation). It was alive with 1 at T-419. With [the bisection](2026-10-22-p4-2-year-one.md) its year-1 outcome has now flipped four times in six commits that did not aim at it: dead → alive (T-413), alive → dead (T-415), dead → alive (T-419), alive → dead (T-418). The infection-roll trial does not change that.
- **The instrument was not run for the trial**, because p4-2 already failed the condition.

## Figures

### Year 1 of `three_years_seeds` (living at day 112), before → after

| Seed | Before | After | Seed | Before | After |
|---|---|---|---|---|---|
| p4-1 | 11 | 11 | p2-1 | 12 | 12 |
| p4-2 | **0** | **0** | p2-2 | 6 | **1** |
| p4-3 | 11 | 11 | p2-3 | 16 | 16 |
| p4-4 | 15 | 15 | p2-4 | 14 | 14 |
| p4-5 | 11 | 11 | p2-5 | 12 | 12 |
| p4-6 | 13 | 13 | p2-6 | 10 | 10 |
| | | | p2-7 | 18 | 18 |

The peril-0 seeds with the trial rule: p0-1 to p0-7 had 13, 11, 17, 13, 16, 15 and 17 living.

### Wards

The cut and burn wards (light, serious and grievous cut; light and serious burn; medic 5 and 0 at one wound a day, medic 5 at one every 400 ticks) are identical before and after, to the tick. Every ward patient has a single wound, so one roll per dwarf is one roll per wound.

## What was run

The year-1 copy of `three_years_seeds`' `runThreeYearsSeed` (its world, script and invariant watcher, stopped at day 112), filtered to the seeds. The ward probe of [wound recovery](2026-10-21-wound-recovery.md) with the T-413 recording additions and the light-burn case. Figures are in [`2026-10-22-infection-roll-per-dwarf.json`](../data/2026-10-22-infection-roll-per-dwarf.json).
