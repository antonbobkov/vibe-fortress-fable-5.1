# T-739 — Jobs at scale: identical hauls and builds are a row each

**Closed:** 2026-11-25, in f9e3635e.

**Source:** playtest 2026-11-25 (mid game) ([report](../../../reports/data/2026-11-25-playtest-3.md), finding 6) · **Size:** S · **Needs:** — · **Status:** open

## Why

At 22 dwarves (Spring, Year 2) the Jobs panel counted 331 open jobs; its first rows were "Build kennel" and then "Build bed  waiting: 1»" nine times in a row, one per planned bed, all at priority 4 and blocked for the same input (`11-y2-jobs.png`). At 54 dwarves (Spring, Year 4) the open list was "Haul straw  open 16 da»", "Haul seed  open 16 da»", "Haul straw  open 13 da»" … twenty-five haul rows at priority 6 that nobody took (`48-y4-jobs.png`). Bare-tile jobs already fold ("Smooth ×111  open 72 days", "Gather ×37"), but `panels.md` § Jobs batches only jobs "each on a bare tile", so a list of builds and hauls, which is most of a mid-game fortress's work, is one row each and the panel shows a screen of the same two words.

Reproduce: load `reports/data/2026-11-25-playtest-3/frostvault-y3-summer9.bin` and open `j`; or any fortress that plans ten beds at once.

## What to do

Decisions:

- **Jobs next to each other in the list, of one type and priority, all open or all blocked for the same reason, batch when they name the same target kind**: a building type ("Build bed ×9" with the shared reason), or an item type for a haul ("Haul straw ×18  open 16 days", the oldest's age). Jobs with a creature target (hunt, carry patient) and claimed jobs never batch: a claimed job's worker is its fact.
- The batch's line under the list gives how many and where, as a tile batch does ("9 jobs over (30,12)–(38,20), z26. [Enter] list them.", from the targets' tiles), and `[p]` and `[x]` act on every job of it, as for a tile batch.
- The list's order is unchanged; only adjacent jobs batch, as now.

Spec: `ui-screens/panels.md` § Jobs (the batch rule).

Decided while doing it:

- **Like jobs of one priority gather, not only adjacent ones.** On the playtest save the board makes straw, seed and arrow hauls one at a time as the items appear, so they interleave ("Haul straw", "Haul seed", "Haul straw", …): adjacency alone left 25 rows of 44 open priority-6 hauls, and the "Haul straw ×18" this file asks for cannot be had. A batch stands where its first job stands, and a later job of the same priority and key joins it wherever it stands. The order of the rows that are not batched is unchanged, and so is the order of priorities. This applies to bare-tile jobs too (one rule): two designations of the same kind and priority that are both open are one row, whose box spans both.
- **"The same reason" is the same words in the reason column** (the blocked reason and its short text), so "waiting: 1 log" and "waiting: 1 stone block" stay apart even with the same blocked reason. A job on any entity that is not a creature batches by the name the list gives it ("Build bed", "Haul straw", "Harvest", "Trade, depot #1").
- **An opened batch's jobs stand each in its own place in the list**, and never batch again while they last; a job claimed after the batch was opened keeps its place.
- **A batch's name gives way before its count**: the kind and the count ("Haul ×18"), else the kind cut with `»` ("Haul to de» ×12").
- **A batch with no member on the map** (items in a container) says "9 jobs. [Enter] list them." in place of the box.

On the playtest save (`frostvault-y3-summer9.bin`, Summer, Year 3, 84 live jobs) the list goes from 84 rows to 34: "Build bed ×8  waiting: 1 bed", "Harvest ×9  open 2 days", "Haul straw ×8  open 84 days", "Haul arrow ×5", "Haul plant ×20", "Haul seed ×6".

## Done

- [x] Tests (`describe` with the task id): nine open bed builds blocked for one input make one row with ×9; one of them claimed leaves a row of its own; twenty straw hauls make one row with the oldest age; hunt jobs never batch; `[p]` on the batch row raises all nine. `T-739 Jobs batches jobs on named targets` in `test/unit/ui/t739-jobs-batch-named-targets.test.ts`, with a build blocked for another input staying apart, a member of an opened batch selected on its own and showing its worker, and a long name cut before its count.
- [x] UI only: no world hash moves (no code under `src/` outside `src/ui` changed).
