# Measurement: the sweep after T-482, and the three-year fortress that outgrew its food

**Task:** T-507, widened by the orchestrator · **Date:** 2026-11-05 · **Commits examined:** `947c303c` (T-501, the master before T-482), `d96cfc9c` (T-482 merged) and `d2f68294` (T-508 merged, today's master), each unshifted and one and two ticks later (the same code with `w.step(n)` before the opening, on throwaway branches, now deleted); the fix on the T-507 branch over `d96cfc9c` and over `d2f68294`, unshifted and shifted · **Kind:** a timeline-noise measurement, a food journal, a fault in the three-year script fixed · **Source:** [the T-507 work file](../../docs/archive/tasks/T-507-three-years-food-under-growth.md), [T-482's report](2026-11-05-t482-pets-heap.md#the-sweep), [T-508's report](2026-11-05-t508-idle-dwarves-by-the-hearth.md)

## The answer

- **T-482's sweep was chance in what it was blamed for; one rise may have been real, and T-508 has taken it away.** Over three timelines each, the living at year 3 do not move: 894 on average before T-482 (831 to 980), 884 after it (855 to 924), 895 on today's master (841 to 930). Extinctions and need deaths do not move either; they come from single seeds in single timelines on every commit (the old master loses three seeds two ticks later). Deaths other than hunger did rise with T-482 in all three samples (148 to 192, against 93 to 143 before), in the peril-2 and peril-4 fights; on today's master they are 123 to 135 again. With three samples that rise is likely, not certain, and it is gone, so the heap and the stale-walk fix were not taken apart.
- **`three-years-p0-3` starving is not chance: it is a fault in the three-year script, on every commit.** The seed starves 23 dwarves on T-482's master and on today's master one and two ticks later, 4 before T-482 one tick later, 1 on today's master unshifted. Its cave farm lies west of the stair (T-455 puts it there when the east side opens to the hillside), and the script laid the cave strips, the cave farm's only way to grow, east of the stair as for an east farm: in solid rock, joined to nothing. The first strip's 32 digs stood `blocked (unreachable)` at every look from day 60 to day 336; while a strip waits to be dug no other is planned; the cave seed bought for them (90 dimcap by day 126, 186 by day 245) lay in stock for three years. The cave farm stayed at the wagon's 32 tiles while the fortress grew from 7 to 67.
- **Why that starves the fortress.** The surface farm grows with the dwarves but harvests in spring and early summer only, and nothing in winter, so the cave farm is the food from the end of autumn to spring. 32 cave tiles fed 28 dwarves; they cannot feed 55 to 67. Meals ran out in the spring of year 3 (day 238) and again late in autumn (day 301), and 23 died in the winter. It is the script's farm plan, not a balance margin.
- **Fixed** in `three_years_economy.ts`: `caveStripTiles` mirrors the strips about the stair for a west farm and takes only rock joined to the farm or an earlier strip; a west farm digs its strips from year 2; a strip tile whose designation is gone no longer holds the strips back; and a surface strip takes only sunlit tiles. On today's master `p0-3` digs all four strips (172 cave tiles by day 245) and ends year 3 with 78 dwarves and no death; over three timelines it has no need death (78, 74 and 64 living), where master starves 1, 23 and 23. The sweep's three samples: 131 / 140 / 127 deaths and 973 / 859 / 968 living, against master's 135 / 162 / 147 and 930 / 841 / 915; no peril-0 need death in any. Only the four seeds with a west farm move (`p0-3`, `p0-6`, `p2-2`, `p2-4`); the other sixteen seeds give the same figures, and the main economy run the same progress, day by day.
- **Why a west farm waits for year 2.** Every farm plans its first strip on day 1 (before the farm is zoned the wagon's cave seed counts as spare). An east farm's day-1 strip is part of its first winter's food: holding all strips to year 2 left the main economy run with no meal and no drink on day 224. A west farm's was never dug before T-507; dug in the opening, it left `p2-4`, the file's most fragile seed, extinct on day 65 in three of four sweeps. From year 2 it is dug in time for `p0-3`, and `p2-4`'s first year is master's again.
- **A second fault, left to its own task:** the script sows surface crops too late to ripen (strawberries and barley in late summer, turnips at the end of autumn); the frost killed 101 crops in year 2 and 165 in year 3 on `p0-3`, with their seed. A rule is written and measured once, but it moves every timeline: [T-NEW: the three-year script sows crops too late](../../docs/work/T-512-three-years-sows-crops-too-late.md).

## The timeline samples

Twenty seeds, `measure.yml` suite `sweep`. Need deaths with the number of seeds that have any.

| Commit | Shift | Run | Deaths | Living | Need deaths | Extinct | p0 deaths / living | p2 | p4 |
|---|---|---|---|---|---|---|---|---|---|
| `947c303c` (T-501) | 0 | 42119697821 | 125 | 980 | 0 | 0 | 3 / 389 | 58 / 307 | 64 / 284 |
| | 1 | 42140134127 | 149 | 831 | 6 (2) | 0 | 9 / 413 | 65 / 267 | 75 / 151 |
| | 2 | 42140140260 | 112 | 871 | 19 (1) | 3 | 2 / 366 | 57 / 285 | 53 / 220 |
| `d96cfc9c` (T-482) | 0 | 42134070351 | 220 | 874 | 28 (2) | 2 | 23 / 427 | 81 / 282 | 116 / 165 |
| | 1 | 42140137121 | 150 | 855 | 2 (1) | 0 | 2 / 405 | 94 / 184 | 54 / 266 |
| | 2 | 42140143461 | 173 | 924 | 0 | 1 | 1 / 438 | 74 / 299 | 98 / 187 |
| `d2f68294` (T-508) | 0 | 42144703997 | 135 | 930 | 1 (1) | 0 | 6 / 413 | 60 / 242 | 69 / 275 |
| | 1 | 42144707575 | 162 | 841 | 27 (2) | 1 | 29 / 418 | 68 / 235 | 65 / 188 |
| | 2 | 42144711420 | 147 | 915 | 24 (2) | 1 | 28 / 396 | 65 / 232 | 54 / 287 |

| Commit | Deaths, mean (range) | Deaths but hunger | Living, mean (range) | Extinct seeds |
|---|---|---|---|---|
| `947c303c` | 129 (112–149) | 93–143 | 894 (831–980) | 0, 0, 3 |
| `d96cfc9c` | 181 (150–220) | 148–192 | 884 (855–924) | 2, 0, 1 |
| `d2f68294` | 148 (135–162) | 123–135 | 895 (841–930) | 0, 1, 1 |

- **Living:** the same on the three commits; one commit's spread (831 to 980 on the oldest) is wider than any difference between them.
- **Peril 4's two wipe-outs on T-482's master** (`p4-2`, `p4-3`) were chance: the old master loses three seeds two ticks later (`p2-4`, `p4-1`, `p4-4`), T-482's code one tick later none.
- **Need deaths:** `p0-3` gives 23 in three of the nine samples, and 4 and 1 in two more. The rest are survivors starving after a siege or raid took the fortress apart (`p4-1` 19 on the old master two ticks later, `p4-4` 2 to 4) or a few on a peril-2 seed.
- **Deaths in the fights:** with T-482 peril 2 lost more than the old master in all three samples (74 to 94 against 57 to 65), peril 4 in two. The causes are the usual ones ([data](../data/2026-11-05-t507-sweeps.md)). On today's master peril 2 is at 60 to 68. T-508 gives each idle dwarf its own stand tile in the hall instead of one tile at its way in, a crowd T-482's report found; that it removes the rise is a likely reading, not a probed one.
- **The set rule** held on all nine; peril-0 need deaths came from `p0-3` alone each time, so the rule sat at its limit whenever that seed starved.

**On T-509 (the annual instrument's bounds).** These figures say the same of the sweep: a shift of one or two ticks on unchanged code moves the total deaths by up to 70 and the living by up to 149, flips whole seeds, and turns the set rule's peril-0 count between 0 and 1. A single sweep can only show a change larger than that. Three samples a commit were needed here to say anything.

## The food journal of `three-years-p0-3`

The probe ([source](../data/2026-11-05-t507-food-journal.probe.ts.txt)) plays the seed as the sweep does and writes, every 7 days from day 112: the farm by plot kind (tiles, sown, ripe), harvests, meals cooked and drink brewed, meals and raw plants eaten, stocks, plant food and seed by crop, the food jobs and their blocks, the kitchens' and stills' orders, who has the food labors and what they are doing, and the cave strips' digs ([data](../data/2026-11-05-t507-food-journal-p0-3.txt): master, master one tick later, the fix with the sowing rule, the fix on today's master). Master `d96cfc9c`, unshifted, as the sweep has it (23 starve, 44 living):

| Day | Dwarves | Cave tiles | Surface tiles (sown) | Harvest in 7 days, surface + cave | Meals cooked / eaten | Lavish meals in stock | Plant food | Dimcap seed in stock |
|---|---|---|---|---|---|---|---|---|
| 126 | 28 | 32 | 107 (5) | 0 + 18 | 95 / 75 | 292 | 2 | 90 |
| 168 | 28 | 32 | 107 (66) | 12 + 86 | 176 / 73 | 464 | 128 | 90 |
| 182 | 40 | 32 | 144 (101) | 253 + 40 | 241 / 103 | 666 | 157 | 90 |
| 196 | 40 | 32 | 144 (101) | 0 + 28 | 144 / 108 | 755 | 26 | 91 |
| 203 | 46 | 32 | 164 (0: frost killed 101) | 0 + 61 | 108 / 129 | 660 | 9 | 91 |
| 224 | 46 | 32 | 164 (0) | 0 + 40 | 37 / 122 | 205 | 8 | 91 |
| 238 | 55 | 32 | 193 (99) | 0 + 11 | 16 / 129 + 3 raw | 0 | 2 | 90 |
| 266 | 55 | 32 | 193 (100) | 334 + 26 | 297 / 145 + 13 raw | 155 | 158 | 186 |
| 294 | 67 | 32 | 237 (165) | 0 + 113 | 97 / 161 + 8 raw | 5 | 0 | 186 |
| 301 | 67 | 32 | 237 (165) | 0 + 0 | 0 / 6 + 6 raw | 0 | 0 | 186 |
| 315 | 67 | 32 | 237 (0: frost killed 165) | 0 + 64 | 6 / 6 + 82 raw | 0 | 0 | 186 |
| 322 | 62 | 32 | 237 (0) | 0 + 14 | 4 / 6 + 26 raw; 5 starve | 0 | 0 | 186 |
| 336 | 44 | 32 | 237 (0) | 0 + 104 | 10 / 12 + 74 raw; 23 starved | 0 | 0 | 186 |

- **Labour is not short.** 39 to 49 dwarves have the farming, cooking and brewing labors, and most are idle at each look (36 of 39 at day 245, 49 of 49 at day 301). The kitchens' lavish order is at its cap of 999 from day 231; the kitchens wait on ingredients (`blocked (missing_input)` at day 224).
- **The surface farm yields once a year.** Its harvests are a turnip crop on day 182 (253) and a strawberry crop on day 266 (334), and little else. What was sown after them did not ripen and the frost killed it, seed and all (101 crops, then 165); from day 231 the surface plots have 21 `plant` jobs blocked for `missing_input`. That is [the second fault](#the-second-fault-crops-sown-too-late).
- **The cave farm never grows**, though it is the only winter food: 32 tiles throughout, the strip's digs unreachable, the bought dimcap seed unsown.
- **Drink does not run short:** the brook gives water (107 to 255 drinks of water a week in year 3). The stills' order still takes plants ahead of the kitchens (320 drink, 64 plants, in the week to day 294, while 97 meals were cooked). With water at hand that order costs meals; it is a margin of the script's plan, not changed here.
- **One tick later** (the second table in the data) the fortress grows more slowly (18 dwarves until day 224, 43 at the end) and has the same faults: the strip unreachable, 160 dimcap seed unused, the frost killing 52 and 140 crops. It does not starve because it does not outgrow 32 cave tiles before the winter.

## The fault: cave strips east of a west farm

`caveSite` (T-455) puts the cave farm east of the stair (`cx + 7` to `cx + 14`), or, where that would open it to the hillside, on the side and level with the most soil, possibly west of the stair (`cx − 2` to `cx + 5`). `CAVE_STRIPS` gives the strips as offsets from the centre for an east farm only. On `p0-3` the farm is west (its first tile at x 23, `cx` 22) and the first strip came to x 29 to 36, on the far side of the stair in rock with no open tile beside it. `checkCaveStrips` waits until every tile of its last strip is floor before it plans the next, so one unreachable strip ends the cave farm's growth for the game. Four sweep seeds have a west farm: `p0-3`, `p0-6`, `p2-2` and `p2-4`.

**Fixed** in `test/scenarios/three_years_economy.ts`:

- `caveStripTiles(w, state, n)` mirrors strip `n` about the stair (`cx + 6`) for a west farm and keeps only the rock joined (8-neighbour) to the farm or an earlier strip.
- A west farm plans no strip before day 112 (`WEST_CAVE_STRIPS_FROM_DAY`; below).
- A strip tile whose dig designation is gone without its being dug no longer holds the strip back; the strip's floor tiles are zoned.
- `checkFarm` takes only sunlit tiles for a surface strip. With the strips beside a west farm, `p0-3` two ticks later had a surface strip taken from a level where some tiles are not lit, on day 143; the plot was not a surface plot and the game refused its barley (`light_mismatch`), which stops the seed's run. A strip with an unlit tile always stops the run so, so only such a timeline changes.

**Test:** `test/unit/t507-cave-strips.test.ts` sets up `p0-3` (west) and `p0-1` (east) and checks that each of the four strips is joined to the farm or an earlier strip and that the first has at least 16 tiles. On the old code `p0-3`'s first strip has 32 tiles joined to nothing and the test fails.

### Measured

Today's master `d2f68294` and the fix over it, at the same three shifts:

| Shift | Run, master / fix | Deaths | Living | Need deaths | Extinct | `p0-3` | `p0-6` | `p2-2` | `p2-4` |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 42144703997 / 42159863826 | 135 / 131 | 930 / 973 | 1 / 0 | 0 / 0 | 46, 1 starved / **78** | 53 / 67 | 35 / 35 | 8 / 5 |
| 1 | 42144707575 / 42159922673 | 162 / 140 | 841 / 859 | 27 / 6 | 1 / 2 | 51, 23 starved / **74** | 52 / 59 | 43 / 50 | 19 / 0 (day 313) |
| 2 | 42144711420 / 42159925911 | 147 / 127 | 915 / 968 | 24 / 1 | 1 / 1 | 42, 23 starved / **64** | 53 / 67 | 20 / 38 | 5 / 4 |

On each pair the sixteen east-farm seeds give the same figures seed by seed and the four west seeds move. `p0-3` never starves; `p0-6` gains 7 to 14 dwarves. `p2-2` and `p2-4` go either way in their peril-2 fights; one tick later `p2-4` dies out on day 313 after its raids, with two starving at the end. The set rule holds on all three, with no peril-0 need death.

**Why a west farm waits for year 2.** `checkCaveStrips` counts the cave seed beyond the cave plots' empty tiles, and before the cave farm is dug and zoned there are no cave plots, so on every seed the wagon's cave seed counts as spare on day 1 and a strip is planned at once. An east farm's day-1 strip was always dug. A west farm's was laid in solid rock and never dug, so the fix's first version (strips beside the farm from day 1) gave the four west seeds a strip their openings never had. On `p2-4` the miners dug it in the first five days, and the day-62 ambush at the gate found a weaker fortress: extinct on day 65 in three of four sweeps (run 42143433600 over `d96cfc9c`; 42149770861 and 42156309085 over `d2f68294`), and with 0, 3 and 4 dwarves at day 110 in the [probe](../data/2026-11-05-t507-p2-4.probe.ts.txt) against master's 11, 7 and 6. Holding every farm's strips to year 2 instead (commit `96cf3fea`, reverted) saved `p2-4` (11, 11 and 4) but moved all twenty seeds and left the main economy run with 53 dwarves and no meal, drink or plant food on day 224, against 858 meals on master (run 42154693759 against 42148466240): the east farms' day-1 strip is part of their first winter's food. So only a west farm waits, and its first year is master's again (`p2-4` 7 dwarves at year 1 against 7, and 4 against 8 one tick later, where master's unreachable digs no longer stand on the job board).

The journal of `p0-3` with the fix on today's master: the first strip is dug and sown by day 147 (64 cave tiles), the second by day 175, the third and fourth by day 245 (172 tiles, 160 sown). The fortress grows to 78; lavish meals in stock stay above 360 from day 175 to the end, and no dwarf dies. The frost still kills 98 and 126 surface crops (the second fault).

`three_years_main` (the economy scenario; its farm is east of the stair): run 42159929356 with the fix gives the same progress lines, day by day, as master's run 42148466240: 15 / 40 / 76 dwarves at years 1 / 2 / 3, no death, 8 trades in 8 visits; the test passes.

## The second fault: crops sown too late

`checkCrops` gives each surface plot, for each season, the first crop of `SURFACE_CROPS` whose seed covers half the plot, without asking whether it can ripen. A surface crop needs four stages of `stageDays` and grows only in its seasons; sown with too few days left it lies dormant and the frost kills it and its seed (07 § Growth). On `p0-3` the frost took 101 crops in the first week of year 2's winter and 165 in the first week of year 3's; with the cave fix it still takes 98 and 126 on today's master. A rule (in the season under way sow only what ripens in its seasons with three days to spare, else leave the plot fallow; branch `t507-food-b`, commit `292af817`) cut those to 6 and 45 and gave, with the first version of the cave fix under it on `d96cfc9c` (run 42143696598), 170 deaths, 855 living, no peril-0 need death, three seeds extinct in peril-2 and peril-4 fights. It moves every seed's timeline, and the cave fix alone ends the starvation, so it is [a task of its own](../../docs/work/T-512-three-years-sows-crops-too-late.md).

## Noticed on the way

- **Every east farm digs a cave strip in its first days by accident** (above): the script's comment says strips are for bought seed, but the day-1 strip, planned because the wagon's seed counts as spare before the farm is zoned, is in fact the opening's second cave plot, and the main run's first winter rests on it. Left as it is, and said in `WEST_CAVE_STRIPS_FROM_DAY`'s comment.
- Two shifted master runs failed one seed's own witnesses after the fortress all but died in its fights: `p2-1` on T-482's master one tick later (1 living, "gate walls built") and `p2-4` two ticks later (3 living, "a dining hall"). A fortress of one to three cannot build what a witness asks; the summary and the set rule are unaffected.
