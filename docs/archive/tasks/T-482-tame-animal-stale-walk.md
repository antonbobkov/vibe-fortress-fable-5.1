# T-482 — Idle tame animals keep a walk that has arrived, and crowd one hall tile

**Closed:** 2026-11-05, in 32a57124.

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
| The fix ([rows](../../../reports/data/2026-11-02-t463-stale-walk-wildlife.json)) | 13/0/7/139/9/1/11 | blocked: 11 need deaths, all `wildlife-taiga-1` |
| Same, hall ties to the highest index, timeline only ([rows](../../../reports/data/2026-11-02-t463-stale-walk-variant-wildlife.json)) | 12/8/8/141/4/0/0 | blocked: wildlife-free 4 |

taiga-1 sits at the edge of starvation in every row, the accepted one included (T-NEW taiga-1 food margin). So single samples cannot judge this change until that is settled.

## Done

- Measured with more than one sample after the taiga-1 task, by the T-308 rule, and the twenty-seed file's crowd watch shows no hall tile crowded for more than a day by animals alone.

## Decision, added (orchestrator, 2026-11-04)

Fix the stale walk as the task says, then keep the pile as a fun feature (flavour report item 2): an idle pet chooses a **favourite spot** off the main path, such as a tile beside the hearth or a bed, and several pets may heap there. The spreading rule from T-463 still keeps them off the hall's walking lines. List it in [`docs/fun-features.md`](../../fun-features.md) when it lands. Measure with two samples of the annual instrument against the reference.

## What was done (2026-11-05)

As decided. The full measurement is in [the report](../../../reports/audits/2026-11-05-t482-pets-heap.md).

- **The stale walk** (from `ec906c92`): `standTile` ignores a walk whose target is the animal's own tile, such a walk counts neither as heading for a tile nor against standing, and `thinkTame` stops it once the animal is home. 08 § Tame behavior says so. T-463's stale-walk test now uses pigs (dogs heap); it fails on master's code and passes.
- **The pets' heap** (08 § Tame behavior, *The pets' heap*; 22 § Crowding; [fun-features.md](../../fun-features.md) § In the game, removable): an idle tame animal that is no grazer and no larger than `PET_PILE_SIZE_MAX` (35) heaps on the pets' spot, the walkable tile beside the hall's hearth, not a door or beside one and with no building, that has the most of its 8 neighbours taken by a wall, the hearth or furniture (ties by the lowest index). At most `PET_PILE_MAX` (4) heap; the rest spread by T-463's rule, which never sends an animal onto the spot. A heaped pet lies *curled* (`Tame.curled`, optional) and counts for no crowd until it walks. Beds are not used: every hall has a hearth, and a heap by a bed would sit in the bedrooms' lanes. Tests: `test/unit/animals/t482-pet-pile.test.ts`.
- **Measured** on GitHub: the instrument passes in both samples (12.5/9/10/149/7/0/0; one tick later 12.5/3/9/139/7/0/0). The twenty-seed file holds the workflow's set rule (20/20, 7/7, 1 peril-0 seed with need deaths) but not this task's 0/7: `p0-3` starves in year 3, and does not one tick later (T-NEW three-years food under growth). The hall's crowd watch: the longest crowded stretch of a hall tile falls from 379,180 ticks to 23,220, seeds with a hall tile crowded over a day from 19 to 5.
