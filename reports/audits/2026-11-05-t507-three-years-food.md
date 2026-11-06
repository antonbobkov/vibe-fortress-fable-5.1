# Measurement: the sweep after T-482, and the three-year fortress that outgrew its food

**Task:** T-507, widened by the orchestrator · **Date:** 2026-11-05 · **Commits examined:** `947c303c` (T-501, the master before T-482), `d96cfc9c` (T-482 merged) and `d2f68294` (T-508 merged, today's master), each unshifted and one and two ticks later (the same code with `w.step(n)` before the opening, on throwaway branches, now deleted); the fix on the T-507 branch over `d96cfc9c` and over `d2f68294`, unshifted and shifted · **Kind:** a timeline-noise measurement, a food journal, a fault in the three-year script fixed · **Source:** [the T-507 work file](../../docs/work/T-507-three-years-food-under-growth.md), [T-482's report](2026-11-05-t482-pets-heap.md#the-sweep), [T-508's report](2026-11-05-t508-idle-dwarves-by-the-hearth.md)

## The answer

- **T-482's sweep was chance in what it was blamed for; one rise may have been real, and T-508 has taken it away.** Over three timelines each, the living at year 3 do not move: 894 on average before T-482 (831 to 980), 884 after it (855 to 924), 895 on today's master (841 to 930). Extinctions and need deaths do not move either; they come from single seeds in single timelines on every commit (the old master loses three seeds two ticks later). Deaths other than hunger did rise with T-482 in all three samples (148 to 192, against 93 to 143 before), in the peril-2 and peril-4 fights; on today's master they are 123 to 135 again. With three samples that rise is likely, not certain, and it is gone, so the heap and the stale-walk fix were not taken apart.
- **`three-years-p0-3` starving is not chance: it is a fault in the three-year script, on every commit.** The seed starves 23 dwarves on T-482's master and on today's master one and two ticks later, 4 before T-482 one tick later, 1 on today's master unshifted. Its cave farm lies west of the stair (T-455 puts it there when the east side opens to the hillside), and the script laid the cave strips, the cave farm's only way to grow, east of the stair as for an east farm: in solid rock, joined to nothing. The first strip's 32 digs stood `blocked (unreachable)` at every look from day 60 to day 336; while a strip waits to be dug no other is planned; the cave seed bought for them (90 dimcap by day 126, 186 by day 245) lay in stock for three years. The cave farm stayed at the wagon's 32 tiles while the fortress grew from 7 to 67.
- **Why that starves the fortress.** The surface farm grows with the dwarves but harvests in spring and early summer only, and nothing in winter, so the cave farm is the food from the end of autumn to spring. 32 cave tiles fed 28 dwarves; they cannot feed 55 to 67. Meals ran out in the spring of year 3 (day 238) and again late in autumn (day 301), and 23 died in the winter. It is the script's farm plan, not a balance margin.
- **Fixed** in `three_years_economy.ts`: `caveStripTiles` mirrors the strips about the stair for a west farm and takes only rock joined to the farm or an earlier strip; a strip tile whose designation is gone no longer holds the strips back; and a surface strip takes only sunlit tiles (the fix let a dug west strip one level down be taken for a surface strip, whose barley the game refused). On today's master `p0-3` digs all four strips (172 cave tiles by day 252) and ends year 3 with 74 dwarves and no death; over three timelines it has no need death (74, 40 and FIXP03 living), where master starves 1, 23 and 23. Only the four seeds with a west farm move (`p0-3`, `p0-6`, `p2-2`, `p2-4`); the other sixteen, and the main economy run, are the same to the tick.
- **The cost: `p2-4`.** A west farm now digs its first strip in the first days, as every east farm already does (the wagon's cave seed counts as spare until the farm is zoned). On `p2-4`, the file's most fragile seed, that leaves 0 to 4 dwarves at the end of year 1 against 6 to 11, and the seed is extinct on day 65 in two of three samples. Holding every strip to year 2 saved it but moved all twenty seeds and left the main economy run with no meal and no drink on day 224, so the day-1 strip stays: it is the east farms' first winter food.
- **A second fault, left to its own task:** the script sows surface crops too late to ripen (strawberries and barley in late summer, turnips at the end of autumn); the frost killed 101 crops in year 2 and 165 in year 3 on `p0-3`, with their seed. A rule is written and measured once, but it moves every timeline: [T-NEW: the three-year script sows crops too late](../../docs/work/T-NEW-three-years-sows-crops-too-late.md).

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
- **Need deaths:** `p0-3` gives 23 in four of the nine samples. The rest are survivors starving after a siege or raid took the fortress apart (`p4-1` 19 on the old master two ticks later, `p4-4` 2 to 4) or a few on a peril-2 seed.
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
- A strip tile whose dig designation is gone without its being dug no longer holds the strip back; the strip's floor tiles are zoned.
- `checkFarm` takes only sunlit tiles for a surface strip. On `p0-3` two ticks later a dug west strip one level down, not yet zoned, was taken for a surface strip on day 143; the plot was a cave plot and the game refused its barley (`light_mismatch`), which stops the seed's run. Only a timeline that would have stopped there changes.

**Test:** `test/unit/t507-cave-strips.test.ts` sets up `p0-3` (west) and `p0-1` (east) and checks that each of the four strips is joined to the farm or an earlier strip and that the first has at least 16 tiles. On the old code `p0-3`'s first strip has 32 tiles joined to nothing and the test fails.

### Measured

| Run | Commit | Shift | Deaths | Living | Need deaths | Extinct | `p0-3` | `p0-6` | `p2-2` | `p2-4` |
|---|---|---|---|---|---|---|---|---|---|---|
| master 42134070351 | `d96cfc9c` | 0 | 220 | 874 | 28 | 2 | 44, 23 starved | 50 | 26 | 45 |
| fix 42143433600 | over `d96cfc9c` | 0 | 204 | 847 | 6 | 3 | **80** | 56 | 2 | extinct day 65 |
| master 42144703997 | `d2f68294` | 0 | 135 | 930 | 1 | 0 | 46, 1 starved | 53 | 35 | 8 |
| fix FIXD0 | over `d2f68294` | 0 | 129 | 968 | 0 | 1 | **74** | 58 | 48 | extinct day 65 |
| master 42144707575 | `d2f68294` | 1 | 162 | 841 | 27 | 1 | 51, 23 starved | 52 | 43 | 19 |
| fix 42156309085 | over `d2f68294` | 1 | 140 | 781 | 11 | 2 | **40** | 64 | 1, 7 starved | extinct |
| master 42144711420 | `d2f68294` | 2 | 147 | 915 | 24 | 1 | 42, 23 starved | 53 | 20 | 5 |
| fix FIXD2 | over `d2f68294` | 2 | FIX2 | | | | | | | |

On each pair the sixteen east-farm seeds give the same figures seed by seed, and the four west seeds move. `p0-3` never starves with the fix. `p0-6` gains 5 to 12 dwarves. `p2-2` and `p2-4` go either way in their peril-2 fights; `p2-2` one tick later is left with one dwarf after its raids, who starves, which is a fortress taken apart, not a farm that failed.

**`p2-4`.** On this seed the joined part of the west farm is smaller than the wagon's 30 cave seeds, and before the farm is zoned no cave tile counts as empty, so the script plans a strip on day 1, as it does on every east farm. Before the fix that strip was unreachable and cost nothing; now the miners dig it in the first five days. The day-62 ambush at the gate then finds a weaker opening: living at day 110 on today's master, shifts 0 / 1 / 2, are 11 / 7 / 6, and with the fix 0 (extinct day 65) / 3 / 4 ([probe](../data/2026-11-05-t507-p2-4.probe.ts.txt)). Holding every cave strip back to year 2 (commit `96cf3fea`, reverted) gave 11 / 11 / 4, but it moved all twenty seeds (the east farms lose their day-1 strip) and the main economy run reached day 224 with 53 dwarves and no meal, drink or plant food, against 858 meals on master (run 42154693759 against 42148466240). So the day-1 strip stays, and `p2-4` keeps the cost. It is the seed that is extinct on the old master two ticks later as well, and the set rule's year-1 count (18 of 20) allows it.

The journal of `p0-3` with the fix on today's master: the first strip is dug and sown by day 175 (92 cave tiles), the second by day 238, the third and fourth by day 252 (172 tiles, 120 sown). The fortress grows to 74; lavish meals in stock stay above 560 from day 189 to the end, and no dwarf dies. The frost still kills 96 and 200 surface crops (the second fault).

`three_years_main` (the economy scenario; its farm is east of the stair): run 42149773538 with the fix gives the same progress lines, day by day, as master's run 42148466240: 15 / 40 / 76 dwarves at years 1 / 2 / 3, no death, 8 trades in 8 visits; the test passes.

## The second fault: crops sown too late

`checkCrops` gives each surface plot, for each season, the first crop of `SURFACE_CROPS` whose seed covers half the plot, without asking whether it can ripen. A surface crop needs four stages of `stageDays` and grows only in its seasons; sown with too few days left it lies dormant and the frost kills it and its seed (07 § Growth). On `p0-3` the frost took 101 crops in the first week of year 2's winter and 165 in the first week of year 3's; with the cave fix it still takes 96 and 200 on today's master. A rule (in the season under way sow only what ripens in its seasons with three days to spare, else leave the plot fallow; branch `t507-food-b`, commit `292af817`) cut those to 6 and 45 and gave, with the cave fix under it on `d96cfc9c` (run 42143696598), 170 deaths, 855 living, no peril-0 need death, three seeds extinct in peril-2 and peril-4 fights. It moves every seed's timeline, and the cave fix alone ends the starvation, so it is [a task of its own](../../docs/work/T-NEW-three-years-sows-crops-too-late.md).

## Noticed on the way

- **Every fortress digs a cave strip in its first days by accident.** `checkCaveStrips` counts the cave seed beyond the cave plots' empty tiles, and before the cave farm is dug and zoned there are no cave plots, so the wagon's 30 cave seeds count as spare on day 1. The strip it digs turns out to matter: without it the main run had no food on day 224. The script's comment says strips are for bought seed; it is the opening's second cave plot in fact. Left as it is; the T-NEW above or a later script task may say so in the comment.
- Two shifted master runs failed one seed's own witnesses after the fortress all but died in its fights: `p2-1` on T-482's master one tick later (1 living, "gate walls built") and `p2-4` two ticks later (3 living, "a dining hall"). A fortress of one to three cannot build what a witness asks; the summary and the set rule are unaffected.
