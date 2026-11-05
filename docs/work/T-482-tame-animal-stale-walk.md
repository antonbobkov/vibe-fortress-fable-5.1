# T-482 — Idle tame animals keep a walk that has arrived, and crowd one hall tile

**Source:** T-463's twenty-seed run on `fb31cc11` · **Size:** S · **Needs:** the taiga-1 food margin task · **Status:** open (code ready, measurement needed)

## Why

T-463 did not clear the crowd it was for. In the twenty-seed run on `fb31cc11`, the crowd watch still showed a hall tile crowded for about 379,000 ticks in most seeds, worst 6 creatures. A read-only probe of `three-years-p0-2` named who stood on that tile (60222, the hall's lowest index): 3 dogs and a cat from day 20, 4 animals from day 40 to day 130, and 3 to 9 tames whose walk target was their own tile.

The cause: a walk is cleared only when it is asked for again, so a tame animal that arrived keeps a walk whose target is its own tile. T-463's rule follows a walk already heading into the hall, so these animals never spread.

## The fix, ready

On branch `t463-stale-walk` (commit `ec906c92`; the code is in `d8fba2cb` beneath it):

- `standTile` ignores a walk whose target is the animal's own tile.
- Such a walk does not count as an animal heading for a tile, and an animal with one counts as standing.
- `tame.ts` stops it once the animal is home.
- `test/unit/animals/t463-hall-spread.test.ts` gains "dogs whose last walk ended where they stand still spread out". It fails on T-463's code (all three dogs on one tile) and passes with the fix.

On `three-years-p0-2` with the fix, the 4-animal crowd is gone on every look from day 10 to day 130. The only crowded hall tiles are a dog with a passing dwarf, on days 80 to 100.

## The measurement so far

Two samples of the annual instrument, against the accepted T-464 row 12.5/7/11/148/7/0/0. Each sample was taken with the party-target fix as well, which has no parties to act on at peril 0.

| Sample | Row | Verdict |
|---|---|---|
| The fix ([rows](../../reports/data/2026-11-02-t463-stale-walk-wildlife.json)) | 13/0/7/139/9/1/11 | blocked: 11 need deaths, all `wildlife-taiga-1` |
| Same, hall ties to the highest index, timeline only ([rows](../../reports/data/2026-11-02-t463-stale-walk-variant-wildlife.json)) | 12/8/8/141/4/0/0 | blocked: wildlife-free 4 |

taiga-1 sits at the edge of starvation in every row, the accepted one included (T-NEW taiga-1 food margin). So single samples cannot judge this change until that is settled.

## Done

- Measured with more than one sample after the taiga-1 task, by the T-308 rule, and the twenty-seed file's crowd watch shows no hall tile crowded for more than a day by animals alone.

## Decision, added (orchestrator, 2026-11-04)

Fix the stale walk as the task says, then keep the pile as a fun feature (flavour report item 2): an idle pet chooses a **favourite spot** off the main path, such as a tile beside the hearth or a bed, and several pets may heap there. The spreading rule from T-463 still keeps them off the hall's walking lines. List it in [`docs/fun-features.md`](../fun-features.md) when it lands. Measure with two samples of the annual instrument against the reference.
