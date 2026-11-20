# T-652 — The immigration roll on a stream of its own

**Source:** [T-650's measurement](../../reports/data/2026-11-20-t650-peril-4-immigration.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

21's one rng stream rolls each eligible season's wave (`IMMIGRATION_PERMILLE + reputation × REP_PERMILLE_PER_POINT`) and plans each wave's members (professions, skills, families, pets). A wave one immigrant larger or smaller, from a wealth step crossed or not at that tick, draws a different number of times, and every later roll of that fortress differs. T-650 found the 128 fewer year-3 immigrants at peril 4 that T-642's sweep showed against master to be mostly this: master's rolls drew a wave at 81% of its eligible year-3 evaluations against a 70% chance (82 immigrants above the expectation), T-642's at 70%, and T-639's sweep, which kept master's rolls in 15 of 24 timelines, at 83%. The sweep's living, guarded at the best minus 100, reads a change through rolls that any change to a wave's size reshuffles.

## What to do

Draw the season's roll so that it does not depend on the draws of earlier waves' plans: a second stream for the rolls (`rngFor('21:roll')` or the world's way of naming a sub-stream), or a roll derived from the world seed, the year and the season. Saved state, load and the world hashes follow (save-format.md, the golden hashes move once, said in the commit). The odds and every other rule are unchanged. Then sweep it, and compare the peril-4 year-3 waves against the expectation as T-650's report does.

Spec: 21 § Evaluation, § State; save-format.md (21's state); testing-strategy.md § The twenty-seed sweep (one sentence: two codes are compared on the same rolls).

## Done

- [x] A unit test that a wave of another size leaves the next season's roll unchanged (`test/unit/immigration/t652-season-roll.test.ts`).
- [x] The sweep's verdict: `44716548319`, 79 of 80 seed jobs green, pooled 19.25 / 7 / 0 / 1050.25 living / 105.5 deaths, within every bound. It was not judged because `p4-4` at shift 150 failed with T-653's known station-order rejection, which master's own sweep (`44715696949`) shows too ([T-652's report](../../reports/data/2026-11-20-t652-immigration-roll-stream.md)).
- [x] The peril-4 year-3 rolls against their chance: 45 waves from 58 rolls at 70.3% (40.8 expected); 391 immigrants against 340 expected. The rolls are now the same in every shift of a seed: 169 of 169 seasons ([T-652's report](../../reports/data/2026-11-20-t652-immigration-roll-stream.md)).
