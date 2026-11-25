# T-739 — Jobs at scale: identical hauls and builds are a row each

**Source:** playtest 2026-11-25 (mid game) ([report](../../reports/data/2026-11-25-playtest-3.md), finding 6) · **Size:** S · **Needs:** — · **Status:** open

## Why

At 22 dwarves (Spring, Year 2) the Jobs panel counted 331 open jobs; its first rows were "Build kennel" and then "Build bed  waiting: 1»" nine times in a row, one per planned bed, all at priority 4 and blocked for the same input (`11-y2-jobs.png`). At 54 dwarves (Spring, Year 4) the open list was "Haul straw  open 16 da»", "Haul seed  open 16 da»", "Haul straw  open 13 da»" … twenty-five haul rows at priority 6 that nobody took (`48-y4-jobs.png`). Bare-tile jobs already fold ("Smooth ×111  open 72 days", "Gather ×37"), but `panels.md` § Jobs batches only jobs "each on a bare tile", so a list of builds and hauls, which is most of a mid-game fortress's work, is one row each and the panel shows a screen of the same two words.

Reproduce: load `reports/data/2026-11-25-playtest-3/frostvault-y3-summer9.bin` and open `j`; or any fortress that plans ten beds at once.

## What to do

Decisions:

- **Jobs next to each other in the list, of one type and priority, all open or all blocked for the same reason, batch when they name the same target kind**: a building type ("Build bed ×9" with the shared reason), or an item type for a haul ("Haul straw ×18  open 16 days", the oldest's age). Jobs with a creature target (hunt, carry patient) and claimed jobs never batch: a claimed job's worker is its fact.
- The batch's line under the list gives how many and where, as a tile batch does ("9 jobs over (30,12)–(38,20), z26. [Enter] list them.", from the targets' tiles), and `[p]` and `[x]` act on every job of it, as for a tile batch.
- The list's order is unchanged; only adjacent jobs batch, as now.

Spec: `ui-screens/panels.md` § Jobs (the batch rule).

## Done

- [ ] Tests (`describe` with the task id): nine open bed builds blocked for one input make one row with ×9; one of them claimed leaves a row of its own; twenty straw hauls make one row with the oldest age; hunt jobs never batch; `[p]` on the batch row raises all nine.
- [ ] UI only: no world hash moves.
